import React from 'react';
import { X, Star, Lock, Play, Coins, Sun, CloudRain, Moon } from 'lucide-react';
import {
  CAREER_EVENTS,
  PlayerSaveData,
  RaceConfig,
  TRACKS,
} from '../types/game';

interface CareerModalProps {
  saveData: PlayerSaveData;
  onStartEvent: (config: RaceConfig) => void;
  onClose: () => void;
}

export const CareerModal: React.FC<CareerModalProps> = ({
  saveData,
  onStartEvent,
  onClose,
}) => {
  const totalStars = Object.values(saveData.careerStars).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 bg-[#070a12]/80">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0e1525] border border-slate-700/80 shadow-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-wide">CAREER CHAMPIONSHIP</h2>
            <p className="text-xs text-slate-400">
              Finish Top 3 to earn stars and unlock elite championship tiers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-1.5 text-sm font-bold text-amber-300 tabular-nums">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{totalStars} / 18</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CAREER_EVENTS.map((ev) => {
            const track = TRACKS.find((t) => t.id === ev.trackId) || TRACKS[0];
            const earnedStars = saveData.careerStars[ev.id] || 0;
            const unlocked = totalStars >= ev.requiredStars;
            const WeatherIcon =
              ev.weather === 'sunny' ? Sun : ev.weather === 'rainy' ? CloudRain : Moon;

            return (
              <div
                key={ev.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  unlocked
                    ? 'bg-slate-900/90 border-slate-700/80'
                    : 'bg-slate-950/80 border-slate-800/70 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                      Tier {ev.tier} · {ev.laps} Laps
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= earnedStars
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="font-black text-base text-white">{ev.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{ev.description}</p>

                  <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-slate-300">
                    <span className="font-semibold">{track.name}</span>
                    <span className="flex items-center gap-1 capitalize text-sky-300">
                      <WeatherIcon className="w-3.5 h-3.5" />
                      {ev.weather}
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-bold tabular-nums">
                      <Coins className="w-3.5 h-3.5" />
                      1st: {ev.rewardFirst}
                    </span>
                  </div>
                </div>

                {unlocked ? (
                  <button
                    onClick={() =>
                      onStartEvent({
                        mode: 'career',
                        trackId: ev.trackId,
                        weather: ev.weather,
                        laps: ev.laps,
                        aiDifficulty: ev.aiDifficulty,
                        careerEventId: ev.id,
                      })
                    }
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>RACE EVENT</span>
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-xl bg-slate-800/80 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Requires {ev.requiredStars} Career Stars</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
