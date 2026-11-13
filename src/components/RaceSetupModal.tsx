import React, { useState } from 'react';
import { X, Sun, CloudRain, Moon, Flag, Timer, Play, MapPin } from 'lucide-react';
import {
  formatTimeMs,
  PlayerSaveData,
  RaceConfig,
  TRACKS,
  TrackId,
  WeatherType,
} from '../types/game';

interface RaceSetupModalProps {
  saveData: PlayerSaveData;
  onStartRace: (config: RaceConfig) => void;
  onClose: () => void;
}

export const RaceSetupModal: React.FC<RaceSetupModalProps> = ({
  saveData,
  onStartRace,
  onClose,
}) => {
  const [mode, setMode] = useState<'quick' | 'timetrial'>('quick');
  const [trackId, setTrackId] = useState<TrackId>('city');
  const [weather, setWeather] = useState<WeatherType>('sunny');
  const [laps, setLaps] = useState<number>(3);
  const [aiDifficulty, setAiDifficulty] = useState<number>(0.96);

  const selectedTrack = TRACKS.find((t) => t.id === trackId) || TRACKS[0];
  const bestLap = saveData.bestLapTimes[trackId];

  const handleLaunch = () => {
    onStartRace({
      mode,
      trackId,
      weather,
      laps: mode === 'timetrial' ? 2 : laps,
      aiDifficulty,
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 bg-[#070a12]/80">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0e1525] border border-slate-700/80 shadow-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-black tracking-wide">RACE SETUP</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            onClick={() => setMode('quick')}
            className={`p-3 rounded-xl border flex items-center gap-3 text-left transition cursor-pointer ${
              mode === 'quick'
                ? 'bg-rose-600/20 border-rose-500 text-white'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Flag className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">Quick Race</div>
              <div className="text-[11px] opacity-80">6-racer grid vs competitive AI</div>
            </div>
          </button>

          <button
            onClick={() => setMode('timetrial')}
            className={`p-3 rounded-xl border flex items-center gap-3 text-left transition cursor-pointer ${
              mode === 'timetrial'
                ? 'bg-sky-600/20 border-sky-500 text-white'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Timer className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">Time Trial</div>
              <div className="text-[11px] opacity-80">Chase Gold medal vs Ghost pacer</div>
            </div>
          </button>
        </div>

        {/* Track Picker */}
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Select Circuit
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TRACKS.map((t) => {
              const active = t.id === trackId;
              return (
                <button
                  key={t.id}
                  onClick={() => setTrackId(t.id)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    active
                      ? 'bg-slate-800/95 border-sky-400'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" style={{ color: t.accentColor }} />
                      {t.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-950 text-slate-300">
                      {t.difficulty}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-sky-400">{t.subtitle}</div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{t.environment}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Weather + Laps + AI Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Weather
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'sunny', label: 'Sunny', Icon: Sun },
                  { id: 'rainy', label: 'Rain', Icon: CloudRain },
                  { id: 'night', label: 'Night', Icon: Moon },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setWeather(id)}
                  className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition cursor-pointer ${
                    weather === id
                      ? 'bg-sky-500/20 border-sky-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {mode === 'quick' ? (
            <>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Laps
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[2, 3, 5].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLaps(l)}
                      className={`py-3 rounded-xl border text-sm font-black transition cursor-pointer tabular-nums ${
                        laps === l
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  AI Rivals
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Easy', val: 0.86 },
                    { label: 'Pro', val: 0.96 },
                    { label: 'Ace', val: 1.08 },
                  ].map((d) => (
                    <button
                      key={d.label}
                      onClick={() => setAiDifficulty(d.val)}
                      className={`py-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        aiDifficulty === d.val
                          ? 'bg-rose-500 text-white border-rose-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase">Target Medal Times</div>
                <div className="text-xs text-slate-200 mt-1 tabular-nums">
                  Gold {selectedTrack.targetGoldSec}s · Silver {selectedTrack.targetSilverSec}s · Bronze {selectedTrack.targetBronzeSec}s
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Personal Best</div>
                <div className="text-sm font-black text-sky-400 tabular-nums">
                  {formatTimeMs(bestLap)}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleLaunch}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black tracking-wide text-base flex items-center justify-center gap-2 shadow-lg cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>START RACE</span>
        </button>
      </div>
    </div>
  );
};
