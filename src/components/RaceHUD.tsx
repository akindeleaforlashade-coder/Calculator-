import React, { useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Home,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import {
  formatTimeMs,
  GameSettings,
  RaceHudState,
} from '../types/game';
import { InputState } from '../three/RacingEngine';

interface RaceHUDProps {
  hud: RaceHudState;
  minimapPath: Array<{ x: number; y: number }>;
  settings: GameSettings;
  muted: boolean;
  onInputChange: (patch: Partial<InputState>) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

function getOrdinalSuffix(pos: number): string {
  if (pos === 1) return 'ST';
  if (pos === 2) return 'ND';
  if (pos === 3) return 'RD';
  return 'TH';
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  hud,
  minimapPath,
  settings,
  muted,
  onInputChange,
  onToggleMute,
  onPause,
  onResume,
  onRestart,
  onQuit,
}) => {
  const [sliderValue, setSliderValue] = useState(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const showTouchControls =
    settings.touchControlsMode === 'always' ||
    (settings.touchControlsMode === 'auto' && isTouchDevice);

  const svgPoints = useMemo(() => {
    if (!minimapPath.length) return '';
    return minimapPath.map((p) => `${(10 + p.x * 80).toFixed(1)},${(10 + p.y * 80).toFixed(1)}`).join(' ');
  }, [minimapPath]);

  const handleSliderPointer = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const norm = ((clientX - rect.left) / rect.width) * 2 - 1;
    const clamped = Math.max(-1, Math.min(1, norm));
    setSliderValue(clamped);
    onInputChange({ steerAnalog: clamped });
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left: Position + Lap + Timer */}
        <div className="flex items-stretch gap-2">
          <div className="px-3.5 py-2 rounded-xl bg-[#090e1a]/88 border border-slate-700/70 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums leading-none">
              {hud.position}
            </span>
            <span className="text-[10px] font-black text-amber-300">{getOrdinalSuffix(hud.position)}</span>
            <span className="text-xs font-bold text-slate-400 ml-1 tabular-nums">
              /{hud.totalRacers}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#090e1a]/88 border border-slate-700/70 flex flex-col justify-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Lap <span className="text-white font-black tabular-nums">{hud.lap}/{hud.totalLaps}</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-sky-300 tabular-nums">
              {formatTimeMs(hud.currentLapMs)}
            </div>
          </div>
        </div>

        {/* Top-Right: Mini-Map + Pause/Mute */}
        <div className="flex items-start gap-2">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#090e1a]/88 border border-slate-700/70 p-1.5">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              {svgPoints && (
                <polygon
                  points={svgPoints}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
              )}
              {hud.minimapRacers.map((r) => (
                <circle
                  key={r.id}
                  cx={10 + r.x * 80}
                  cy={10 + r.y * 80}
                  r={r.isPlayer ? 5.2 : 3.6}
                  fill={r.isPlayer ? '#fbbf24' : r.color}
                  stroke="#090e1a"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </div>

          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <button
              onClick={onPause}
              aria-label="Pause Race"
              className="p-2.5 rounded-xl bg-[#090e1a]/90 hover:bg-slate-800 border border-slate-700/70 text-white cursor-pointer"
            >
              <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="p-2.5 rounded-xl bg-[#090e1a]/90 hover:bg-slate-800 border border-slate-700/70 text-white cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Center Callouts (Countdown, Checkpoints, Wrong Way) */}
      <div className="flex flex-col items-center justify-center my-auto gap-2">
        {hud.phase === 'countdown' && (
          <div className="px-8 py-4 rounded-2xl bg-[#090e1a]/85 border border-slate-700/80 text-center">
            <div
              className={`text-5xl sm:text-7xl font-black italic tracking-tight tabular-nums ${
                hud.countdownValue === 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {hud.countdownValue > 0 ? hud.countdownValue : 'GO!'}
            </div>
          </div>
        )}

        {hud.phase === 'racing' && hud.checkpointBanner && (
          <div className="px-4 py-1.5 rounded-xl bg-sky-500/90 text-slate-950 font-black text-xs sm:text-sm tracking-widest uppercase shadow-lg">
            {hud.checkpointBanner}
          </div>
        )}

        {hud.phase === 'racing' && hud.wrongWay && (
          <div className="px-4 py-2 rounded-xl bg-rose-600/95 text-white font-black text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>REVERSE / WRONG WAY</span>
          </div>
        )}
      </div>

      {/* Bottom Area: Touch Controls (flanks) + Speedometer & Nitro Gauge (center) */}
      <div className="flex items-end justify-between gap-2">
        {/* Left Touch Steering */}
        <div className="pointer-events-auto">
          {showTouchControls && settings.steeringStyle === 'buttons' && (
            <div className="flex items-center gap-2.5 touch-none">
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onInputChange({ left: true });
                }}
                onPointerUp={() => onInputChange({ left: false })}
                onPointerCancel={() => onInputChange({ left: false })}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#090e1a]/85 active:bg-sky-500/40 border-2 border-slate-600/80 flex items-center justify-center text-white"
                aria-label="Steer Left"
              >
                <ChevronLeft className="w-9 h-9" />
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onInputChange({ right: true });
                }}
                onPointerUp={() => onInputChange({ right: false })}
                onPointerCancel={() => onInputChange({ right: false })}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#090e1a]/85 active:bg-sky-500/40 border-2 border-slate-600/80 flex items-center justify-center text-white"
                aria-label="Steer Right"
              >
                <ChevronRight className="w-9 h-9" />
              </button>
            </div>
          )}

          {showTouchControls && settings.steeringStyle === 'slider' && (
            <div
              ref={sliderRef}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                handleSliderPointer(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons > 0) handleSliderPointer(e.clientX);
              }}
              onPointerUp={() => {
                setSliderValue(0);
                onInputChange({ steerAnalog: 0 });
              }}
              onPointerCancel={() => {
                setSliderValue(0);
                onInputChange({ steerAnalog: 0 });
              }}
              className="w-40 h-14 rounded-2xl bg-[#090e1a]/85 border-2 border-slate-600/80 relative flex items-center px-2 touch-none"
            >
              <div className="w-full h-1.5 bg-slate-700 rounded-full" />
              <div
                className="w-10 h-10 rounded-xl bg-sky-400 border-2 border-white absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${50 + sliderValue * 38}%` }}
              />
            </div>
          )}
        </div>

        {/* Center Compact Speedometer + Nitro Gauge */}
        <div className="mx-auto px-4 py-2.5 rounded-2xl bg-[#090e1a]/90 border border-slate-700/80 flex items-center gap-4 min-w-[205px] sm:min-w-[250px]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black italic tabular-nums text-white leading-none">
              {hud.speedKmh}
            </span>
            <span className="text-[10px] font-bold text-slate-400">KM/H</span>
          </div>

          <div className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-black text-amber-400 tabular-nums">
            G{hud.gear}
          </div>

          {/* RPM & Nitro Bars */}
          <div className="flex-1 space-y-1.5">
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-[width] duration-75"
                style={{ width: `${Math.min(100, hud.rpmNorm * 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Flame
                className={`w-3.5 h-3.5 shrink-0 ${
                  hud.isNitroActive ? 'text-sky-300' : 'text-sky-500'
                }`}
              />
              <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    hud.isNitroActive ? 'bg-amber-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${hud.nitro}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Touch Pedals + Drift + Nitro */}
        <div className="pointer-events-auto">
          {showTouchControls && (
            <div className="grid grid-cols-2 gap-2 touch-none">
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onInputChange({ drift: true });
                }}
                onPointerUp={() => onInputChange({ drift: false })}
                onPointerCancel={() => onInputChange({ drift: false })}
                className="w-14 h-12 sm:w-16 sm:h-14 rounded-xl bg-amber-500/20 active:bg-amber-500/60 border border-amber-400/70 text-[11px] font-black text-amber-300"
              >
                DRIFT
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onInputChange({ nitro: true });
                }}
                onPointerUp={() => onInputChange({ nitro: false })}
                onPointerCancel={() => onInputChange({ nitro: false })}
                className="w-14 h-12 sm:w-16 sm:h-14 rounded-xl bg-sky-500/25 active:bg-sky-400/70 border border-sky-400/80 text-[11px] font-black text-sky-200"
              >
                NITRO
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onInputChange({ brake: true });
                }}
                onPointerUp={() => onInputChange({ brake: false })}
                onPointerCancel={() => onInputChange({ brake: false })}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-rose-600/30 active:bg-rose-500/75 border border-rose-500/80 text-xs font-black text-rose-200"
              >
                BRAKE
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onInputChange({ accelerate: true });
                }}
                onPointerUp={() => onInputChange({ accelerate: false })}
                onPointerCancel={() => onInputChange({ accelerate: false })}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-emerald-600/35 active:bg-emerald-500/80 border border-emerald-400/80 text-xs font-black text-emerald-100"
              >
                GAS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <div className="fixed inset-0 z-30 bg-[#070a12]/80 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-sm rounded-2xl bg-[#0e1525] border border-slate-700 p-6 space-y-3 text-center shadow-2xl">
            <h2 className="text-2xl font-black tracking-wide">RACE PAUSED</h2>
            <p className="text-xs text-slate-400">
              WASD / Arrows Drive · Shift Drift · Space Nitro
            </p>
            <div className="pt-2 space-y-2.5">
              <button
                onClick={onResume}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>RESUME RACE</span>
              </button>
              <button
                onClick={onRestart}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESTART</span>
              </button>
              <button
                onClick={onQuit}
                className="w-full py-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-200 font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>MAIN MENU</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
