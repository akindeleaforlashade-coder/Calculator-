export interface RemotePlayerState {
  id: string;
  name: string;
  vehicleId: string;
  color: string;
  ready: boolean;
  s: number;
  offset: number;
  speed: number;
  heading: number;
  lean: number;
  drifting: boolean;
  nitro: boolean;
  lap: number;
  finished: boolean;
  finishTime: number | null;
}

export interface RoomState {
  code: string;
  trackId: string;
  weather: 'sunny' | 'rainy' | 'night';
  laps: number;
  hostId: string;
  status: 'lobby' | 'racing' | 'finished';
  startTime: number;
  players: RemotePlayerState[];
}

export interface PublicLobbySummary {
  code: string;
  trackId: string;
  weather: string;
  laps: number;
  playerCount: number;
  status: string;
}

type Listener = (event: {
  type: string;
  playerId?: string;
  room?: RoomState;
  rooms?: PublicLobbySummary[];
  player?: RemotePlayerState;
  message?: string;
}) => void;

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  public playerId: string | null = null;
  public currentRoom: RoomState | null = null;
  public publicRooms: PublicLobbySummary[] = [];
  private connecting = false;

  public connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connecting) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
    }

    this.connecting = true;
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.connecting = false;
        resolve();
      };

      ws.onerror = () => {
        this.connecting = false;
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        this.connecting = false;
        this.ws = null;
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as {
            type: string;
            playerId?: string;
            room?: RoomState;
            rooms?: PublicLobbySummary[];
            player?: RemotePlayerState;
            message?: string;
          };
          if (data.type === 'welcome' && data.playerId) {
            this.playerId = data.playerId;
            if (data.rooms) this.publicRooms = data.rooms;
          }
          if (data.type === 'room:list' && data.rooms) {
            this.publicRooms = data.rooms;
          }
          if (
            (data.type === 'room:joined' ||
              data.type === 'room:state' ||
              data.type === 'race:started') &&
            data.room
          ) {
            this.currentRoom = data.room;
          }
          if (data.type === 'room:left') {
            this.currentRoom = null;
            if (data.rooms) this.publicRooms = data.rooms;
          }
          if (data.type === 'player:sync' && data.player && this.currentRoom) {
            const idx = this.currentRoom.players.findIndex((p) => p.id === data.player!.id);
            if (idx >= 0) {
              this.currentRoom.players[idx] = data.player;
            }
          }
          this.listeners.forEach((fn) => fn(data));
        } catch {
          // ignore malformed messages
        }
      };
    });
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public requestRoomList() {
    this.send({ type: 'room:list' });
  }

  public createRoom(params: {
    name: string;
    vehicleId: string;
    color: string;
    trackId: string;
    weather: 'sunny' | 'rainy' | 'night';
    laps: number;
  }) {
    this.send({ type: 'room:create', ...params });
  }

  public joinRoom(params: {
    code: string;
    name: string;
    vehicleId: string;
    color: string;
  }) {
    this.send({ type: 'room:join', ...params });
  }

  public leaveRoom() {
    this.currentRoom = null;
    this.send({ type: 'room:leave' });
  }

  public updateRoomConfig(config: { trackId?: string; weather?: string; laps?: number }) {
    this.send({ type: 'room:config', ...config });
  }

  public updateReady(params: { ready?: boolean; vehicleId?: string; color?: string; name?: string }) {
    this.send({ type: 'room:ready', ...params });
  }

  public startRace() {
    this.send({ type: 'race:start' });
  }

  public sendTelemetry(telemetry: {
    s: number;
    offset: number;
    speed: number;
    heading: number;
    lean: number;
    drifting: boolean;
    nitro: boolean;
    lap: number;
    finished: boolean;
    finishTime: number | null;
  }) {
    this.send({ type: 'player:update', ...telemetry });
  }
}

export const multiplayerClient = new MultiplayerClient();
