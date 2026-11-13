import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

interface PlayerTelemetry {
  id: string;
  name: string;
  vehicleId: string;
  color: string;
  ready: boolean;
  s: number; // normalized track progress 0..1
  offset: number; // lateral track offset
  speed: number;
  heading: number;
  lean: number;
  drifting: boolean;
  nitro: boolean;
  lap: number;
  finished: boolean;
  finishTime: number | null;
}

interface RaceRoom {
  code: string;
  trackId: string;
  weather: 'sunny' | 'rainy' | 'night';
  laps: number;
  hostId: string;
  status: 'lobby' | 'racing' | 'finished';
  startTime: number;
  players: Map<string, PlayerTelemetry>;
  sockets: Map<string, WebSocket>;
}

const rooms = new Map<string, RaceRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function serializeRoom(room: RaceRoom) {
  return {
    code: room.code,
    trackId: room.trackId,
    weather: room.weather,
    laps: room.laps,
    hostId: room.hostId,
    status: room.status,
    startTime: room.startTime,
    players: Array.from(room.players.values()),
  };
}

function broadcastRoom(room: RaceRoom, payload: unknown, excludeId?: string) {
  const raw = JSON.stringify(payload);
  for (const [pid, ws] of room.sockets.entries()) {
    if (excludeId && pid === excludeId) continue;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function getPublicLobbyList() {
  const list: Array<{
    code: string;
    trackId: string;
    weather: string;
    laps: number;
    playerCount: number;
    status: string;
  }> = [];
  for (const room of rooms.values()) {
    if (room.status === 'lobby') {
      list.push({
        code: room.code,
        trackId: room.trackId,
        weather: room.weather,
        laps: room.laps,
        playerCount: room.players.size,
        status: room.status,
      });
    }
  }
  return list;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: getPublicLobbyList() });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const playerId = `p_${Math.random().toString(36).slice(2, 9)}`;
    let currentRoomCode: string | null = null;

    const send = (data: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    const leaveCurrentRoom = () => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.players.delete(playerId);
        room.sockets.delete(playerId);
        if (room.players.size === 0) {
          rooms.delete(currentRoomCode);
        } else {
          if (room.hostId === playerId) {
            const nextHost = room.players.keys().next().value;
            if (nextHost) room.hostId = nextHost;
          }
          broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) });
        }
      }
      currentRoomCode = null;
    };

    send({ type: 'welcome', playerId, rooms: getPublicLobbyList() });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room:list') {
        send({ type: 'room:list', rooms: getPublicLobbyList() });
        return;
      }

      if (type === 'room:create') {
        leaveCurrentRoom();
        const code = generateRoomCode();
        const trackId = String(msg.trackId || 'city');
        const weather = (['sunny', 'rainy', 'night'].includes(String(msg.weather))
          ? String(msg.weather)
          : 'sunny') as 'sunny' | 'rainy' | 'night';
        const laps = Math.max(1, Math.min(5, Number(msg.laps) || 3));

        const player: PlayerTelemetry = {
          id: playerId,
          name: String(msg.name || 'Racer').slice(0, 16),
          vehicleId: String(msg.vehicleId || 'valkyrie'),
          color: String(msg.color || '#ef4444'),
          ready: true,
          s: 0,
          offset: -2.2,
          speed: 0,
          heading: 0,
          lean: 0,
          drifting: false,
          nitro: false,
          lap: 1,
          finished: false,
          finishTime: null,
        };

        const room: RaceRoom = {
          code,
          trackId,
          weather,
          laps,
          hostId: playerId,
          status: 'lobby',
          startTime: 0,
          players: new Map([[playerId, player]]),
          sockets: new Map([[playerId, ws]]),
        };
        rooms.set(code, room);
        currentRoomCode = code;
        send({ type: 'room:joined', playerId, room: serializeRoom(room) });
        return;
      }

      if (type === 'room:join') {
        const code = String(msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) {
          send({ type: 'room:error', message: `Room "${code}" not found.` });
          return;
        }
        if (room.status !== 'lobby') {
          send({ type: 'room:error', message: `Race in room "${code}" already started.` });
          return;
        }
        if (room.players.size >= 6) {
          send({ type: 'room:error', message: `Room "${code}" is full (6/6).` });
          return;
        }
        leaveCurrentRoom();
        const slotIndex = room.players.size;
        const player: PlayerTelemetry = {
          id: playerId,
          name: String(msg.name || 'Challenger').slice(0, 16),
          vehicleId: String(msg.vehicleId || 'kestrel'),
          color: String(msg.color || '#3b82f6'),
          ready: true,
          s: 0,
          offset: (slotIndex % 2 === 0 ? -1 : 1) * 2.2,
          speed: 0,
          heading: 0,
          lean: 0,
          drifting: false,
          nitro: false,
          lap: 1,
          finished: false,
          finishTime: null,
        };
        room.players.set(playerId, player);
        room.sockets.set(playerId, ws);
        currentRoomCode = code;
        send({ type: 'room:joined', playerId, room: serializeRoom(room) });
        broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) }, playerId);
        return;
      }

      if (type === 'room:leave') {
        leaveCurrentRoom();
        send({ type: 'room:left', rooms: getPublicLobbyList() });
        return;
      }

      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      if (type === 'room:config' && room.hostId === playerId && room.status === 'lobby') {
        if (msg.trackId) room.trackId = String(msg.trackId);
        if (msg.weather && ['sunny', 'rainy', 'night'].includes(String(msg.weather))) {
          room.weather = msg.weather as 'sunny' | 'rainy' | 'night';
        }
        if (msg.laps) room.laps = Math.max(1, Math.min(5, Number(msg.laps) || 3));
        broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) });
        return;
      }

      if (type === 'room:ready' && room.status === 'lobby') {
        const p = room.players.get(playerId);
        if (!p) return;
        if (typeof msg.ready === 'boolean') p.ready = msg.ready;
        if (msg.vehicleId) p.vehicleId = String(msg.vehicleId);
        if (msg.color) p.color = String(msg.color);
        if (msg.name) p.name = String(msg.name).slice(0, 16);
        broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) });
        return;
      }

      if (type === 'race:start' && room.hostId === playerId && room.status === 'lobby') {
        room.status = 'racing';
        room.startTime = Date.now() + 3600;
        let idx = 0;
        for (const p of room.players.values()) {
          p.s = 0;
          p.offset = (idx % 2 === 0 ? -2.2 : 2.2);
          p.speed = 0;
          p.lap = 1;
          p.finished = false;
          p.finishTime = null;
          idx++;
        }
        broadcastRoom(room, { type: 'race:started', room: serializeRoom(room) });
        return;
      }

      if (type === 'player:update' && room.status === 'racing') {
        const p = room.players.get(playerId);
        if (!p) return;
        p.s = Number(msg.s) || 0;
        p.offset = Number(msg.offset) || 0;
        p.speed = Number(msg.speed) || 0;
        p.heading = Number(msg.heading) || 0;
        p.lean = Number(msg.lean) || 0;
        p.drifting = Boolean(msg.drifting);
        p.nitro = Boolean(msg.nitro);
        p.lap = Number(msg.lap) || 1;
        if (msg.finished && !p.finished) {
          p.finished = true;
          p.finishTime = Number(msg.finishTime) || Date.now() - room.startTime;
        }

        broadcastRoom(
          room,
          {
            type: 'player:sync',
            player: p,
          },
          playerId
        );
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom();
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Velocity server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
