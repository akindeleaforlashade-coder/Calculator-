import React from 'react';
import { X, Volume2, Music, Smartphone, Camera, User } from 'lucide-react';
import { GameSettings } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const update = (patch: Partial<GameSettings>) => {
    onUpdate({ ...settings, ...patch });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 bg-[#070a12]/80">
      <div className="w-full max-w-lg rounded-2xl bg-[#0e1525] border border-slate-700/80 shadow-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-black tracking-wide">SETTINGS</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Driver Name */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <User className="w-4 h-4 text-sky-400" />
            <span>Driver Name</span>
          </label>
          <input
            value={settings.playerName}
            maxLength={16}
            onChange={(e) => update({ playerName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-sky-400"
          />
        </div>

        {/* Audio Toggles */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => update({ sfxEnabled: !settings.sfxEnabled })}
            className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer ${
              settings.sfxEnabled
                ? 'bg-sky-500/15 border-sky-400 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-bold">
              <Volume2 className="w-4 h-4" />
              Engine & SFX
            </span>
            <span className="text-xs font-black">
              {settings.sfxEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            onClick={() => update({ musicEnabled: !settings.musicEnabled })}
            className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer ${
              settings.musicEnabled
                ? 'bg-sky-500/15 border-sky-400 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-bold">
              <Music className="w-4 h-4" />
              Race Music
            </span>
            <span className="text-xs font-black">
              {settings.musicEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Mobile Touch Controls */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>On-Screen Touch Controls</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'auto', label: 'Auto' },
                { id: 'always', label: 'Always On' },
                { id: 'off', label: 'Off' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => update({ touchControlsMode: opt.id })}
                className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                  settings.touchControlsMode === opt.id
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-950 text-slate-300 border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-slate-300">Touch Steering Style</span>
            <div className="flex gap-1.5">
              {(['buttons', 'slider'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => update({ steeringStyle: style })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                    settings.steeringStyle === style
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Camera Distance */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Camera className="w-4 h-4 text-amber-400" />
            <span>Chase Camera</span>
          </span>
          <div className="flex gap-1.5">
            {(['close', 'far'] as const).map((cam) => (
              <button
                key={cam}
                onClick={() => update({ cameraDistance: cam })}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                  settings.cameraDistance === cam
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-950 text-slate-400'
                }`}
              >
                {cam}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
