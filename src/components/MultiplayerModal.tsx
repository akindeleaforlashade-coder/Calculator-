import React, { useEffect, useState } from 'react';
import { X, Globe, Plus, Users, Play, RefreshCw, Copy, Check } from 'lucide-react';
import {
  multiplayerClient,
  PublicLobbySummary,
  RoomState,
} from '../network/multiplayerClient';
import { PlayerSaveData, TRACKS, TrackId, VEHICLES, WeatherType } from '../types/game';

interface MultiplayerModalProps {
  saveData: PlayerSaveData;
  onStartMultiplayerRace: (room: RoomState) => void;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  saveData,
  onStartMultiplayerRace,
  onClose,
}) => {
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState<RoomState | null>(multiplayerClient.currentRoom);
  const [publicRooms, setPublicRooms] = useState<PublicLobbySummary[]>(multiplayerClient.publicRooms);
  const [copied, setCopied] = useState(false);

  const selectedVehicle =
    VEHICLES.find((v) => v.id === saveData.selectedVehicleId) || VEHICLES[0];
  const selectedColor =
    saveData.vehicleColors[selectedVehicle.id] || selectedVehicle.defaultColor;

  useEffect(() => {
    let mounted = true;
    const unsub = multiplayerClient.subscribe((ev) => {
      if (!mounted) return;
      if (ev.type === 'welcome' || ev.type === 'room:list') {
        if (ev.rooms) setPublicRooms(ev.rooms);
      }
      if (ev.type === 'room:joined' || ev.type === 'room:state') {
        if (ev.room) {
          setRoom({ ...ev.room });
          setErrorMsg(null);
        }
      }
      if (ev.type === 'room:left') {
        setRoom(null);
        if (ev.rooms) setPublicRooms(ev.rooms);
      }
      if (ev.type === 'room:error' && ev.message) {
        setErrorMsg(ev.message);
      }
      if (ev.type === 'race:started' && ev.room) {
        onStartMultiplayerRace(ev.room);
      }
    });

    multiplayerClient
      .connect()
      .then(() => {
        if (!mounted) return;
        setConnected(true);
        multiplayerClient.requestRoomList();
      })
      .catch(() => {
        if (!mounted) return;
        setErrorMsg('Unable to connect to multiplayer server.');
      });

    return () => {
      mounted = false;
      unsub();
    };
  }, [onStartMultiplayerRace]);

  const handleCreate = () => {
    setErrorMsg(null);
    multiplayerClient.createRoom({
      name: saveData.settings.playerName,
      vehicleId: selectedVehicle.id,
      color: selectedColor,
      trackId: 'city',
      weather: 'sunny',
      laps: 3,
    });
  };

  const handleJoin = (code: string) => {
    if (!code.trim()) return;
    setErrorMsg(null);
    multiplayerClient.joinRoom({
      code: code.trim().toUpperCase(),
      name: saveData.settings.playerName,
      vehicleId: selectedVehicle.id,
      color: selectedColor,
    });
  };

  const handleLeave = () => {
    multiplayerClient.leaveRoom();
    setRoom(null);
  };

  const handleClose = () => {
    if (room) {
      multiplayerClient.leaveRoom();
    }
    onClose();
  };

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isHost = room && room.hostId === multiplayerClient.playerId;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 bg-[#070a12]/80">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0e1525] border border-slate-700/80 shadow-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-wide">ONLINE MULTIPLAYER</h2>
              <p className="text-xs text-slate-400">
                {connected ? 'Live WebSocket Server Connected' : 'Connecting to lobby server...'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {!room ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={!connected}
                onClick={handleCreate}
                className="p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>CREATE RACE ROOM</span>
              </button>

              <div className="flex gap-2">
                <input
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ROOM CODE"
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold tracking-widest uppercase text-sm focus:outline-none focus:border-sky-400"
                />
                <button
                  disabled={!connected || !roomCodeInput.trim()}
                  onClick={() => handleJoin(roomCodeInput)}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black text-sm cursor-pointer"
                >
                  JOIN
                </button>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Open Lobby Rooms ({publicRooms.length})
                </span>
                <button
                  onClick={() => multiplayerClient.requestRoomList()}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No open rooms right now. Create a room and share the 4-letter code with a friend or second tab!
                </p>
              ) : (
                <div className="space-y-2">
                  {publicRooms.map((r) => {
                    const tName = TRACKS.find((t) => t.id === r.trackId)?.name || r.trackId;
                    return (
                      <div
                        key={r.code}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        <div>
                          <div className="font-mono font-black text-sm text-white">
                            Room {r.code}
                          </div>
                          <div className="text-[11px] text-slate-400 capitalize">
                            {tName} · {r.weather} · {r.laps} Laps
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-300 flex items-center gap-1 tabular-nums">
                            <Users className="w-3.5 h-3.5 text-emerald-400" />
                            {r.playerCount}/6
                          </span>
                          <button
                            onClick={() => handleJoin(r.code)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Room Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-900 border border-slate-700">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400">
                  Room Code (Share to Invite)
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-2xl font-black tracking-widest text-emerald-400">
                    {room.code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    aria-label="Copy room code"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLeave}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Leave Room
              </button>
            </div>

            {/* Host Race Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Circuit
                </label>
                <select
                  disabled={!isHost}
                  value={room.trackId}
                  onChange={(e) =>
                    multiplayerClient.updateRoomConfig({ trackId: e.target.value as TrackId })
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white disabled:opacity-70"
                >
                  {TRACKS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Weather
                </label>
                <select
                  disabled={!isHost}
                  value={room.weather}
                  onChange={(e) =>
                    multiplayerClient.updateRoomConfig({ weather: e.target.value as WeatherType })
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white disabled:opacity-70"
                >
                  <option value="sunny">Sunny</option>
                  <option value="rainy">Rainy</option>
                  <option value="night">Night</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Laps
                </label>
                <select
                  disabled={!isHost}
                  value={room.laps}
                  onChange={(e) =>
                    multiplayerClient.updateRoomConfig({ laps: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white disabled:opacity-70"
                >
                  <option value={2}>2 Laps</option>
                  <option value={3}>3 Laps</option>
                  <option value={5}>5 Laps</option>
                </select>
              </div>
            </div>

            {/* Player Roster */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Racers in Grid ({room.players.length}/6 · AI fills open slots)
              </div>
              {room.players.map((p) => {
                const vName = VEHICLES.find((v) => v.id === p.vehicleId)?.name || p.vehicleId;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/40"
                        style={{ backgroundColor: p.color }}
                      />
                      <div>
                        <div className="text-sm font-bold text-white">
                          {p.name}
                          {p.id === room.hostId && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                              Host
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{vName}</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
                      {p.ready ? 'READY' : 'WAITING'}
                    </span>
                  </div>
                );
              })}
            </div>

            {isHost ? (
              <button
                onClick={() => multiplayerClient.startRace()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>LAUNCH MULTIPLAYER RACE</span>
              </button>
            ) : (
              <div className="py-3 text-center text-xs font-bold text-slate-300 bg-slate-900 rounded-xl border border-slate-800">
                Waiting for host to start the race...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
