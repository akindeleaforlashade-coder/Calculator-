import React from 'react';
import {
  Play,
  Wrench,
  Trophy,
  Globe,
  Settings,
  Coins,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PlayerSaveData, VEHICLES } from '../types/game';

interface MainMenuProps {
  saveData: PlayerSaveData;
  muted: boolean;
  onToggleMute: () => void;
  onOpenPlay: () => void;
  onOpenGarage: () => void;
  onOpenCareer: () => void;
  onOpenMultiplayer: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  muted,
  onToggleMute,
  onOpenPlay,
  onOpenGarage,
  onOpenCareer,
  onOpenMultiplayer,
  onOpenSettings,
}) => {
  const activeVehicle =
    VEHICLES.find((v) => v.id === saveData.selectedVehicleId) || VEHICLES[0];
  const totalStars = Object.values(saveData.careerStars).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-8 pointer-events-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#0d1320]/90 border border-slate-700/70 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-300 tabular-nums text-sm sm:text-base">
              {saveData.coins.toLocaleString()}
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-[#0d1320]/90 border border-slate-700/70 hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Trophy className="w-4 h-4 text-sky-400" />
            <span className="tabular-nums">{totalStars} / 18 Stars</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="p-2.5 rounded-xl bg-[#0d1320]/90 hover:bg-slate-800 border border-slate-700/70 text-slate-200 transition cursor-pointer"
          >
            {muted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-sky-400" />}
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Open Settings"
            className="p-2.5 rounded-xl bg-[#0d1320]/90 hover:bg-slate-800 border border-slate-700/70 text-slate-200 transition cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Left-side Title Lockup & Menu Stack (leaves right/center 3D vehicle visible) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 my-auto md:my-0">
        <div className="max-w-md pointer-events-auto">
          {/* Bespoke SVG Title Lockup */}
          <div className="mb-5">
            <svg
              viewBox="0 0 420 96"
              className="w-64 sm:w-80 h-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
              aria-label="Apex Velocity"
            >
              <defs>
                <linearGradient id="apexGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="55%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <path d="M8 76 L28 18 L40 18 L20 76 Z" fill="#ef4444" />
              <path d="M26 76 L46 18 L54 18 L34 76 Z" fill="#38bdf8" />
              <text
                x="66"
                y="50"
                fill="url(#apexGrad)"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontStyle="italic"
                fontSize="44"
                letterSpacing="2"
              >
                APEX
              </text>
              <text
                x="68"
                y="82"
                fill="#f8fafc"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="800"
                fontStyle="italic"
                fontSize="26"
                letterSpacing="6"
              >
                VELOCITY
              </text>
            </svg>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 pl-1">
              Active Ride: <span className="text-white font-bold">{activeVehicle.name}</span> ·{' '}
              <span className="text-sky-400 uppercase tracking-wider text-xs">
                {activeVehicle.type === 'bike' ? 'Superbike' : 'Sports Car'}
              </span>
            </p>
          </div>

          {/* Primary Menu Navigation */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              onClick={onOpenPlay}
              className="col-span-2 flex items-center justify-between px-5 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black tracking-wide text-base sm:text-lg shadow-lg shadow-rose-950/50 transition active:scale-[0.98] cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Play className="w-5 h-5 fill-current" />
                PLAY RACE
              </span>
              <span className="text-xs font-bold uppercase tracking-widest opacity-90">
                Quick / Time Trial
              </span>
            </button>

            <button
              onClick={onOpenCareer}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0d1320]/92 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-sm sm:text-base transition active:scale-[0.98] cursor-pointer"
            >
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Career</span>
            </button>

            <button
              onClick={onOpenGarage}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0d1320]/92 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-sm sm:text-base transition active:scale-[0.98] cursor-pointer"
            >
              <Wrench className="w-5 h-5 text-sky-400 shrink-0" />
              <span>Garage</span>
            </button>

            <button
              onClick={onOpenMultiplayer}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0d1320]/92 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-sm sm:text-base transition active:scale-[0.98] cursor-pointer"
            >
              <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Multiplayer</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0d1320]/92 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-sm sm:text-base transition active:scale-[0.98] cursor-pointer"
            >
              <Settings className="w-5 h-5 text-slate-300 shrink-0" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 font-medium">
        <span>Drag screen to rotate vehicle · Enter to race</span>
        <span className="hidden sm:inline">WASD / Arrows Drive · Shift Drift · Space Nitro · Esc Pause</span>
      </div>
    </div>
  );
};
