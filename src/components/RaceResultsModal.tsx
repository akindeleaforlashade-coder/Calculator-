import React from 'react';
import { Trophy, Coins, RotateCcw, Wrench, Home, Star } from 'lucide-react';
import { formatTimeMs, RaceRewardSummary } from '../types/game';

interface RaceResultsModalProps {
  summary: RaceRewardSummary;
  onRaceAgain: () => void;
  onOpenGarage: () => void;
  onMainMenu: () => void;
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  summary,
  onRaceAgain,
  onOpenGarage,
  onMainMenu,
}) => {
  const isPodium = summary.position <= 3;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-[#070a12]/85">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0e1525] border border-slate-700/80 shadow-2xl p-5 sm:p-6 space-y-5">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 mb-1">
            <Trophy className={`w-7 h-7 ${isPodium ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black italic tracking-wide">
            {summary.position === 1
              ? 'VICTORY! 1ST PLACE'
              : `FINISHED #${summary.position} OF ${summary.totalRacers}`}
          </h2>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-300 tabular-nums">
            <span>Total: {formatTimeMs(summary.totalTimeMs)}</span>
            <span>Best Lap: {formatTimeMs(summary.bestLapMs)}</span>
          </div>

          {summary.starsEarned !== undefined && summary.starsEarned > 0 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`w-5 h-5 ${
                    s <= summary.starsEarned!
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>
          )}

          {summary.medalEarned && (
            <div className="inline-block px-3 py-1 rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-300 font-black text-xs uppercase tracking-widest mt-1">
              {summary.medalEarned} Medal Unlocked
            </div>
          )}
        </div>

        {/* Coins Breakdown */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Race Finish Reward</span>
            <span className="font-bold tabular-nums">+{summary.baseCoins}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Overtake Bonus</span>
            <span className="font-bold tabular-nums">+{summary.overtakeBonus}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Drift Style Bonus</span>
            <span className="font-bold tabular-nums">+{summary.driftBonus}</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="font-black text-sm text-white">TOTAL EARNED</span>
            <span className="font-black text-lg text-amber-300 flex items-center gap-1.5 tabular-nums">
              <Coins className="w-4 h-4 text-amber-400" />
              +{summary.totalCoinsEarned}
            </span>
          </div>
        </div>

        {/* Standings Table */}
        <div className="space-y-1.5">
          {summary.standings.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                r.isPlayer
                  ? 'bg-sky-500/15 border-sky-400/60 text-white font-bold'
                  : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 font-black tabular-nums text-amber-400">#{r.position}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
                <span>{r.name}</span>
                <span className="text-slate-500 hidden sm:inline">({r.vehicleName})</span>
              </div>
              <span className="tabular-nums font-mono">
                {r.finishTimeMs ? formatTimeMs(r.finishTimeMs) : `Lap ${r.lap}`}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={onRaceAgain}
            className="py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry</span>
          </button>
          <button
            onClick={onOpenGarage}
            className="py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            <span>Garage</span>
          </button>
          <button
            onClick={onMainMenu}
            className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
