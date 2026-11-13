import React, { useState } from 'react';
import { X, Check, Lock, Coins, Zap, Bike, Car } from 'lucide-react';
import {
  getEffectiveStats,
  getUpgradeCost,
  PlayerSaveData,
  UPGRADE_LABELS,
  UpgradeStat,
  VEHICLES,
} from '../types/game';

interface GarageModalProps {
  saveData: PlayerSaveData;
  previewVehicleId: string;
  onPreviewVehicle: (vehicleId: string, color: string) => void;
  onSelectVehicle: (vehicleId: string) => void;
  onUnlockVehicle: (vehicleId: string, price: number) => void;
  onChangeColor: (vehicleId: string, color: string) => void;
  onUpgradeStat: (vehicleId: string, stat: UpgradeStat, cost: number) => void;
  onClose: () => void;
}

const STAT_KEYS: UpgradeStat[] = ['speed', 'acceleration', 'handling', 'braking', 'nitro'];

export const GarageModal: React.FC<GarageModalProps> = ({
  saveData,
  previewVehicleId,
  onPreviewVehicle,
  onSelectVehicle,
  onUnlockVehicle,
  onChangeColor,
  onUpgradeStat,
  onClose,
}) => {
  const [tab, setTab] = useState<'vehicles' | 'upgrades'>('vehicles');
  const vehicle = VEHICLES.find((v) => v.id === previewVehicleId) || VEHICLES[0];
  const isUnlocked = saveData.unlockedVehicles.includes(vehicle.id);
  const isSelected = saveData.selectedVehicleId === vehicle.id;
  const activeColor = saveData.vehicleColors[vehicle.id] || vehicle.defaultColor;
  const upgrades = saveData.upgrades[vehicle.id] || {
    speed: 0,
    acceleration: 0,
    handling: 0,
    braking: 0,
    nitro: 0,
  };
  const stats = getEffectiveStats(vehicle, upgrades);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0d1320]/95 border border-slate-700/80">
          {vehicle.type === 'bike' ? (
            <Bike className="w-5 h-5 text-sky-400" />
          ) : (
            <Car className="w-5 h-5 text-rose-400" />
          )}
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-wide leading-tight">
              {vehicle.name}
            </h2>
            <p className="text-[11px] text-slate-400">{vehicle.brand}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 rounded-xl bg-[#0d1320]/95 border border-slate-700/80 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-300 tabular-nums text-sm">
              {saveData.coins.toLocaleString()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-[#0d1320]/95 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Bottom Dock (keeps central 3D turntable unobstructed!) */}
      <div className="w-full max-w-4xl mx-auto rounded-2xl bg-[#0c1220]/95 border border-slate-700/80 p-3.5 sm:p-4 pointer-events-auto shadow-2xl">
        {/* Tabs + Paint Swatches */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl">
            <button
              onClick={() => setTab('vehicles')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                tab === 'vehicles' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Showroom ({VEHICLES.length})
            </button>
            <button
              onClick={() => setTab('upgrades')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                tab === 'upgrades' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Tune & Upgrade
            </button>
          </div>

          {/* Paint Swatches */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
              Paint
            </span>
            {vehicle.swatchColors.map((hex) => (
              <button
                key={hex}
                onClick={() => {
                  onChangeColor(vehicle.id, hex);
                  onPreviewVehicle(vehicle.id, hex);
                }}
                aria-label={`Select color ${hex}`}
                className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                  activeColor.toLowerCase() === hex.toLowerCase()
                    ? 'border-white scale-110'
                    : 'border-slate-700 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

        {tab === 'vehicles' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Vehicle Strip */}
            <div className="md:col-span-7 flex gap-2 overflow-x-auto pb-1">
              {VEHICLES.map((v) => {
                const unlocked = saveData.unlockedVehicles.includes(v.id);
                const selected = saveData.selectedVehicleId === v.id;
                const active = v.id === vehicle.id;
                const col = saveData.vehicleColors[v.id] || v.defaultColor;
                return (
                  <button
                    key={v.id}
                    onClick={() => onPreviewVehicle(v.id, col)}
                    className={`min-w-[132px] p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-slate-800/95 border-sky-400'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {v.type === 'bike' ? 'Moto' : 'Car'}
                      </span>
                      {selected ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : !unlocked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      ) : null}
                    </div>
                    <div className="text-xs font-bold text-white truncate">{v.name}</div>
                    <div className="text-[11px] text-amber-300 font-semibold mt-0.5 tabular-nums">
                      {unlocked ? (selected ? 'Equipped' : 'Owned') : `${v.price} Coins`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Vehicle Quick Stats + Buy/Select CTA */}
            <div className="md:col-span-5 flex flex-col gap-2">
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {STAT_KEYS.map((k) => (
                  <div key={k} className="bg-slate-900/90 rounded-lg py-1.5 px-1 border border-slate-800">
                    <div className="text-[9px] uppercase text-slate-400 truncate">
                      {k === 'acceleration' ? 'Accel' : k}
                    </div>
                    <div className="text-xs font-black text-white tabular-nums">{stats[k]}</div>
                  </div>
                ))}
              </div>

              {isUnlocked ? (
                <button
                  onClick={() => onSelectVehicle(vehicle.id)}
                  disabled={isSelected}
                  className={`w-full py-2.5 rounded-xl font-black text-sm tracking-wide transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  {isSelected ? 'EQUIPPED FOR RACE' : 'SELECT VEHICLE'}
                </button>
              ) : (
                <button
                  onClick={() => onUnlockVehicle(vehicle.id, vehicle.price)}
                  disabled={saveData.coins < vehicle.price}
                  className={`w-full py-2.5 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 transition cursor-pointer ${
                    saveData.coins >= vehicle.price
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>
                    {saveData.coins >= vehicle.price
                      ? `UNLOCK FOR ${vehicle.price}`
                      : `NEED ${vehicle.price} COINS`}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {STAT_KEYS.map((stat) => {
              const lvl = upgrades[stat] || 0;
              const maxed = lvl >= 5;
              const cost = getUpgradeCost(lvl);
              const canBuy = isUnlocked && !maxed && saveData.coins >= cost;
              return (
                <div
                  key={stat}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{UPGRADE_LABELS[stat]}</span>
                    <span className="text-xs font-black text-sky-400 tabular-nums">{stats[stat]}</span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 flex-1 rounded-full ${
                          step < lvl ? 'bg-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    disabled={!canBuy}
                    onClick={() => onUpgradeStat(vehicle.id, stat, cost)}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                      !isUnlocked
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : maxed
                          ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                          : canBuy
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>{!isUnlocked ? 'Locked' : maxed ? 'MAXED' : `${cost} Coins`}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
