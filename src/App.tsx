import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getEffectiveStats,
  loadSaveData,
  persistSaveData,
  PlayerSaveData,
  RaceConfig,
  RaceHudState,
  RaceRewardSummary,
  TrackId,
  UpgradeStat,
  VEHICLES,
} from './types/game';
import { RacingEngine, InputState } from './three/RacingEngine';
import { soundEngine } from './audio/SoundEngine';
import { multiplayerClient, RoomState } from './network/multiplayerClient';
import { MainMenu } from './components/MainMenu';
import { GarageModal } from './components/GarageModal';
import { RaceSetupModal } from './components/RaceSetupModal';
import { CareerModal } from './components/CareerModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { SettingsModal } from './components/SettingsModal';
import { RaceHUD } from './components/RaceHUD';
import { RaceResultsModal } from './components/RaceResultsModal';

type ScreenState =
  | 'menu'
  | 'garage'
  | 'playSetup'
  | 'career'
  | 'multiplayer'
  | 'settings'
  | 'racing';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);

  const [saveData, setSaveData] = useState<PlayerSaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<ScreenState>('menu');
  const [previewVehicleId, setPreviewVehicleId] = useState<string>(saveData.selectedVehicleId);
  const [hud, setHud] = useState<RaceHudState | null>(null);
  const [minimapPath, setMinimapPath] = useState<Array<{ x: number; y: number }>>([]);
  const [raceSummary, setRaceSummary] = useState<RaceRewardSummary | null>(null);
  const [activeRaceConfig, setActiveRaceConfig] = useState<RaceConfig | null>(null);
  const [muted, setMuted] = useState(false);

  const saveRef = useRef(saveData);
  saveRef.current = saveData;
  const activeConfigRef = useRef(activeRaceConfig);
  activeConfigRef.current = activeRaceConfig;
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const updateSave = useCallback((updater: (prev: PlayerSaveData) => PlayerSaveData) => {
    setSaveData((prev) => {
      const next = updater(prev);
      persistSaveData(next);
      return next;
    });
  }, []);

  const handleRaceFinish = useCallback(
    (summary: RaceRewardSummary) => {
      setRaceSummary(summary);
      const cfg = activeConfigRef.current;
      updateSave((prev) => {
        const nextStars = { ...prev.careerStars };
        if (cfg?.mode === 'career' && cfg.careerEventId && summary.starsEarned) {
          nextStars[cfg.careerEventId] = Math.max(
            nextStars[cfg.careerEventId] || 0,
            summary.starsEarned
          );
        }
        const nextBest = { ...prev.bestLapTimes };
        if (cfg && summary.bestLapMs != null) {
          const curBest = nextBest[cfg.trackId];
          if (curBest == null || summary.bestLapMs < curBest) {
            nextBest[cfg.trackId] = summary.bestLapMs;
          }
        }
        return {
          ...prev,
          coins: prev.coins + summary.totalCoinsEarned,
          careerStars: nextStars,
          bestLapTimes: nextBest,
        };
      });
    },
    [updateSave]
  );

  // Initialize Three.js RacingEngine once in isolated canvas container
  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new RacingEngine(canvasMountRef.current, {
      onHudUpdate: (nextHud) => setHud(nextHud),
      onRaceFinish: (summary) => handleRaceFinish(summary),
    });
    engineRef.current = engine;

    const initSave = saveRef.current;
    const vDef = VEHICLES.find((v) => v.id === initSave.selectedVehicleId) || VEHICLES[0];
    const color = initSave.vehicleColors[vDef.id] || vDef.defaultColor;
    engine.showShowcase(vDef.id, color, 'menu');
    engine.setCameraDistance(initSave.settings.cameraDistance);

    soundEngine.setPreferences(
      initSave.settings.sfxEnabled,
      initSave.settings.musicEnabled
    );

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleRaceFinish]);

  // Forward multiplayer remote updates to engine
  useEffect(() => {
    const unsub = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'player:sync' && ev.player) {
        engineRef.current?.syncRemotePlayer(ev.player);
      }
    });
    return unsub;
  }, []);

  // Unlock Web Audio + Start Music on first interaction
  useEffect(() => {
    const unlock = () => {
      soundEngine.unlock();
      if (saveRef.current.settings.musicEnabled) {
        soundEngine.startMusic();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Keyboard Driving Controls + Blur safety
  useEffect(() => {
    const mapKey = (code: string, pressed: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
          engine.input.left = pressed;
          break;
        case 'ArrowRight':
        case 'KeyD':
          engine.input.right = pressed;
          break;
        case 'ArrowUp':
        case 'KeyW':
          engine.input.accelerate = pressed;
          break;
        case 'ArrowDown':
        case 'KeyS':
          engine.input.brake = pressed;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
          engine.input.drift = pressed;
          break;
        case 'Space':
          engine.input.nitro = pressed;
          break;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (screenRef.current === 'racing') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        if (e.code === 'Escape') {
          if (hud?.phase === 'racing') {
            engineRef.current?.setPaused(true);
          } else if (hud?.phase === 'paused') {
            engineRef.current?.setPaused(false);
          }
          return;
        }
        mapKey(e.code, true);
      } else if (screenRef.current === 'menu' && e.code === 'Enter') {
        setScreen('playSetup');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      mapKey(e.code, false);
    };

    const clearAllInputs = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.input.left = false;
      engine.input.right = false;
      engine.input.steerAnalog = 0;
      engine.input.accelerate = false;
      engine.input.brake = false;
      engine.input.drift = false;
      engine.input.nitro = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllInputs);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllInputs);
    };
  }, [hud?.phase]);

  const launchRace = useCallback((config: RaceConfig, room?: RoomState) => {
    soundEngine.playUiClick();
    const curSave = saveRef.current;
    const vDef = VEHICLES.find((v) => v.id === curSave.selectedVehicleId) || VEHICLES[0];
    const color = curSave.vehicleColors[vDef.id] || vDef.defaultColor;
    const stats = getEffectiveStats(vDef, curSave.upgrades[vDef.id]);

    setActiveRaceConfig(config);
    setRaceSummary(null);
    setScreen('racing');

    if (engineRef.current) {
      engineRef.current.setCameraDistance(curSave.settings.cameraDistance);
      engineRef.current.startRace(
        config,
        vDef.id,
        color,
        stats,
        curSave.settings.playerName,
        room?.players
      );
      setMinimapPath(engineRef.current.getMinimapPath());
    }
  }, []);

  const handleReturnToShowcase = useCallback((target: 'menu' | 'garage') => {
    soundEngine.playUiClick();
    if (screenRef.current === 'racing' && activeConfigRef.current?.mode === 'multiplayer') {
      multiplayerClient.leaveRoom();
    }
    setRaceSummary(null);
    setHud(null);
    setScreen(target);
    const cur = saveRef.current;
    const vDef = VEHICLES.find((v) => v.id === cur.selectedVehicleId) || VEHICLES[0];
    const color = cur.vehicleColors[vDef.id] || vDef.defaultColor;
    setPreviewVehicleId(vDef.id);
    engineRef.current?.showShowcase(vDef.id, color, target);
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
  }, [muted]);

  const handleInputChange = useCallback((patch: Partial<InputState>) => {
    if (!engineRef.current) return;
    Object.assign(engineRef.current.input, patch);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090d16] text-white">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* Main Menu */}
      {screen === 'menu' && (
        <MainMenu
          saveData={saveData}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenPlay={() => {
            soundEngine.playUiClick();
            setScreen('playSetup');
          }}
          onOpenGarage={() => handleReturnToShowcase('garage')}
          onOpenCareer={() => {
            soundEngine.playUiClick();
            setScreen('career');
          }}
          onOpenMultiplayer={() => {
            soundEngine.playUiClick();
            setScreen('multiplayer');
          }}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setScreen('settings');
          }}
        />
      )}

      {/* Garage Modal */}
      {screen === 'garage' && (
        <GarageModal
          saveData={saveData}
          previewVehicleId={previewVehicleId}
          onPreviewVehicle={(vid, col) => {
            soundEngine.playUiClick();
            setPreviewVehicleId(vid);
            engineRef.current?.updateShowcaseVehicle(vid, col);
          }}
          onSelectVehicle={(vid) => {
            soundEngine.playUiClick();
            updateSave((prev) => ({ ...prev, selectedVehicleId: vid }));
          }}
          onUnlockVehicle={(vid, price) => {
            soundEngine.playCheckpoint();
            updateSave((prev) => {
              if (prev.coins < price || prev.unlockedVehicles.includes(vid)) return prev;
              return {
                ...prev,
                coins: prev.coins - price,
                selectedVehicleId: vid,
                unlockedVehicles: [...prev.unlockedVehicles, vid],
                upgrades: {
                  ...prev.upgrades,
                  [vid]: prev.upgrades[vid] || {
                    speed: 0,
                    acceleration: 0,
                    handling: 0,
                    braking: 0,
                    nitro: 0,
                  },
                },
              };
            });
          }}
          onChangeColor={(vid, color) => {
            soundEngine.playUiClick();
            updateSave((prev) => ({
              ...prev,
              vehicleColors: { ...prev.vehicleColors, [vid]: color },
            }));
          }}
          onUpgradeStat={(vid, stat: UpgradeStat, cost) => {
            soundEngine.playCheckpoint();
            updateSave((prev) => {
              if (prev.coins < cost) return prev;
              const curUp = prev.upgrades[vid] || {
                speed: 0,
                acceleration: 0,
                handling: 0,
                braking: 0,
                nitro: 0,
              };
              const curLvl = curUp[stat] || 0;
              if (curLvl >= 5) return prev;
              return {
                ...prev,
                coins: prev.coins - cost,
                upgrades: {
                  ...prev.upgrades,
                  [vid]: { ...curUp, [stat]: curLvl + 1 },
                },
              };
            });
          }}
          onClose={() => handleReturnToShowcase('menu')}
        />
      )}

      {/* Quick Race & Time Trial Setup */}
      {screen === 'playSetup' && (
        <RaceSetupModal
          saveData={saveData}
          onStartRace={(cfg) => launchRace(cfg)}
          onClose={() => setScreen('menu')}
        />
      )}

      {/* Career Championship */}
      {screen === 'career' && (
        <CareerModal
          saveData={saveData}
          onStartEvent={(cfg) => launchRace(cfg)}
          onClose={() => setScreen('menu')}
        />
      )}

      {/* Multiplayer Lobby */}
      {screen === 'multiplayer' && (
        <MultiplayerModal
          saveData={saveData}
          onStartMultiplayerRace={(room) =>
            launchRace(
              {
                mode: 'multiplayer',
                trackId: room.trackId as TrackId,
                weather: room.weather,
                laps: room.laps,
                aiDifficulty: 0.96,
                roomCode: room.code,
              },
              room
            )
          }
          onClose={() => setScreen('menu')}
        />
      )}

      {/* Settings */}
      {screen === 'settings' && (
        <SettingsModal
          settings={saveData.settings}
          onUpdate={(nextSettings) => {
            soundEngine.setPreferences(nextSettings.sfxEnabled, nextSettings.musicEnabled);
            if (nextSettings.musicEnabled) soundEngine.startMusic();
            engineRef.current?.setCameraDistance(nextSettings.cameraDistance);
            updateSave((prev) => ({ ...prev, settings: nextSettings }));
          }}
          onClose={() => setScreen('menu')}
        />
      )}

      {/* Active Race HUD */}
      {screen === 'racing' && hud && (
        <RaceHUD
          hud={hud}
          minimapPath={minimapPath}
          settings={saveData.settings}
          muted={muted}
          onInputChange={handleInputChange}
          onToggleMute={handleToggleMute}
          onPause={() => engineRef.current?.setPaused(true)}
          onResume={() => engineRef.current?.setPaused(false)}
          onRestart={() => {
            if (activeRaceConfig) launchRace(activeRaceConfig);
          }}
          onQuit={() => handleReturnToShowcase('menu')}
        />
      )}

      {/* Post-Race Results & Coin Rewards */}
      {screen === 'racing' && raceSummary && (
        <RaceResultsModal
          summary={raceSummary}
          onRaceAgain={() => {
            if (activeRaceConfig) launchRace(activeRaceConfig);
          }}
          onOpenGarage={() => handleReturnToShowcase('garage')}
          onMainMenu={() => handleReturnToShowcase('menu')}
        />
      )}
    </div>
  );
}
