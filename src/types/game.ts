export type VehicleType = 'car' | 'bike';

export type WeatherType = 'sunny' | 'rainy' | 'night';

export type TrackId = 'city' | 'highway' | 'desert' | 'mountain';

export type GameMode = 'quick' | 'career' | 'timetrial' | 'multiplayer';

export type UpgradeStat = 'speed' | 'acceleration' | 'handling' | 'braking' | 'nitro';

export interface VehicleStats {
  speed: number;        // 1..100
  acceleration: number; // 1..100
  handling: number;     // 1..100
  braking: number;      // 1..100
  nitro: number;        // 1..100
}

export interface VehicleDefinition {
  id: string;
  name: string;
  brand: string;
  type: VehicleType;
  tagline: string;
  price: number; // 0 = unlocked by default
  baseStats: VehicleStats;
  defaultColor: string;
  swatchColors: string[];
}

export interface TrackDefinition {
  id: TrackId;
  name: string;
  subtitle: string;
  environment: string;
  lengthMeters: number;
  difficulty: 'Rookie' | 'Pro' | 'Expert' | 'Master';
  targetGoldSec: number;
  targetSilverSec: number;
  targetBronzeSec: number;
  accentColor: string;
  roadWidth: number;
}

export interface CareerEvent {
  id: string;
  tier: number;
  title: string;
  description: string;
  trackId: TrackId;
  weather: WeatherType;
  laps: number;
  aiDifficulty: number; // 0.85 .. 1.12
  rewardFirst: number;
  rewardSecond: number;
  rewardThird: number;
  requiredStars: number;
}

export interface VehicleUpgradeLevels {
  speed: number;        // 0..5
  acceleration: number; // 0..5
  handling: number;     // 0..5
  braking: number;      // 0..5
  nitro: number;        // 0..5
}

export interface GameSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  touchControlsMode: 'auto' | 'always' | 'off';
  steeringStyle: 'buttons' | 'slider';
  cameraDistance: 'close' | 'far';
  playerName: string;
}

export interface PlayerSaveData {
  coins: number;
  selectedVehicleId: string;
  unlockedVehicles: string[];
  vehicleColors: Record<string, string>;
  upgrades: Record<string, VehicleUpgradeLevels>;
  careerStars: Record<string, number>; // eventId -> 0..3 stars
  bestLapTimes: Partial<Record<TrackId, number>>;
  settings: GameSettings;
}

export interface RaceConfig {
  mode: GameMode;
  trackId: TrackId;
  weather: WeatherType;
  laps: number;
  aiDifficulty: number;
  careerEventId?: string;
  roomCode?: string;
}

export interface RacerStandingsEntry {
  id: string;
  name: string;
  vehicleName: string;
  color: string;
  isPlayer: boolean;
  isRemote?: boolean;
  position: number;
  lap: number;
  totalProgress: number;
  speedKmh: number;
  finished: boolean;
  finishTimeMs: number | null;
  bestLapMs: number | null;
}

export interface RaceHudState {
  phase: 'countdown' | 'racing' | 'paused' | 'finished';
  countdownValue: number; // 3, 2, 1, 0 (GO)
  speedKmh: number;
  rpmNorm: number; // 0..1
  gear: number; // 1..6
  nitro: number; // 0..100
  isNitroActive: boolean;
  isDrifting: boolean;
  position: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  raceTimeMs: number;
  currentLapMs: number;
  bestLapMs: number | null;
  wrongWay: boolean;
  checkpointBanner: string | null;
  standings: RacerStandingsEntry[];
  minimapRacers: Array<{
    id: string;
    x: number; // normalized 0..1
    y: number; // normalized 0..1
    isPlayer: boolean;
    color: string;
  }>;
  overtakes: number;
  driftScore: number;
}

export interface RaceRewardSummary {
  position: number;
  totalRacers: number;
  totalTimeMs: number;
  bestLapMs: number | null;
  baseCoins: number;
  overtakeBonus: number;
  driftBonus: number;
  medalEarned?: 'gold' | 'silver' | 'bronze' | null;
  starsEarned?: number;
  totalCoinsEarned: number;
  standings: RacerStandingsEntry[];
}

export const VEHICLES: VehicleDefinition[] = [
  {
    id: 'valkyrie',
    name: 'Valkyrie GT-7',
    brand: 'Aurelia Motors',
    type: 'car',
    tagline: 'Balanced twin-turbo street coupe built for precision apexes.',
    price: 0,
    baseStats: { speed: 74, acceleration: 72, handling: 76, braking: 74, nitro: 70 },
    defaultColor: '#e11d48',
    swatchColors: ['#e11d48', '#2563eb', '#f59e0b', '#10b981', '#e2e8f0', '#1e293b'],
  },
  {
    id: 'ronin',
    name: 'Ronin ZX-900',
    brand: 'Kurogane Moto',
    type: 'bike',
    tagline: 'Razor-lean superbike with blistering launch and tight cornering.',
    price: 900,
    baseStats: { speed: 78, acceleration: 86, handling: 84, braking: 72, nitro: 74 },
    defaultColor: '#06b6d4',
    swatchColors: ['#06b6d4', '#ef4444', '#a855f7', '#84cc16', '#f8fafc', '#0f172a'],
  },
  {
    id: 'kestrel',
    name: 'Kestrel Apex-R',
    brand: 'Vanguard Aero',
    type: 'car',
    tagline: 'Downforce-sculpted track prototype with extreme lateral grip.',
    price: 1600,
    baseStats: { speed: 82, acceleration: 80, handling: 90, braking: 88, nitro: 78 },
    defaultColor: '#f97316',
    swatchColors: ['#f97316', '#14b8a6', '#eab308', '#ec4899', '#f1f5f9', '#111827'],
  },
  {
    id: 'phantom',
    name: 'Phantom Volt-RR',
    brand: 'Helios Racing',
    type: 'bike',
    tagline: 'Carbon-fairing GP machine engineered for straightaway dominance.',
    price: 2400,
    baseStats: { speed: 90, acceleration: 92, handling: 86, braking: 82, nitro: 88 },
    defaultColor: '#8b5cf6',
    swatchColors: ['#8b5cf6', '#f43f5e', '#22d3ee', '#fbbf24', '#ffffff', '#18181b'],
  },
  {
    id: 'titan',
    name: 'Titan V12 Hyper',
    brand: 'Apex Dynamics',
    type: 'car',
    tagline: 'Flagship hypercar with relentless top-end velocity and twin nitro.',
    price: 3500,
    baseStats: { speed: 95, acceleration: 88, handling: 84, braking: 86, nitro: 94 },
    defaultColor: '#fbbf24',
    swatchColors: ['#fbbf24', '#dc2626', '#0ea5e9', '#10b981', '#e5e7eb', '#09090b'],
  },
];

export const TRACKS: TrackDefinition[] = [
  {
    id: 'city',
    name: 'Neo Harbor Circuit',
    subtitle: 'City Streets',
    environment: 'Neon waterfront avenues, technical chicanes & harbor straights',
    lengthMeters: 1650,
    difficulty: 'Rookie',
    targetGoldSec: 36,
    targetSilverSec: 42,
    targetBronzeSec: 49,
    accentColor: '#38bdf8',
    roadWidth: 15,
  },
  {
    id: 'highway',
    name: 'Skyline Autobahn',
    subtitle: 'Elevated Highway',
    environment: 'Wide sweeping expressway bends built for 300+ km/h drafting',
    lengthMeters: 1950,
    difficulty: 'Pro',
    targetGoldSec: 38,
    targetSilverSec: 44,
    targetBronzeSec: 52,
    accentColor: '#f59e0b',
    roadWidth: 16.5,
  },
  {
    id: 'desert',
    name: 'Redrock Canyon Run',
    subtitle: 'Desert Roads',
    environment: 'Sun-scorched sandstone curves, mesas & fast desert S-bends',
    lengthMeters: 1820,
    difficulty: 'Expert',
    targetGoldSec: 40,
    targetSilverSec: 46,
    targetBronzeSec: 54,
    accentColor: '#fb7185',
    roadWidth: 15,
  },
  {
    id: 'mountain',
    name: 'Alpen Ridge Pass',
    subtitle: 'Mountain Track',
    environment: 'High-altitude switchbacks, elevation climbs & pine cliffside drops',
    lengthMeters: 1900,
    difficulty: 'Master',
    targetGoldSec: 43,
    targetSilverSec: 50,
    targetBronzeSec: 58,
    accentColor: '#34d399',
    roadWidth: 14.2,
  },
];

export const CAREER_EVENTS: CareerEvent[] = [
  {
    id: 'ev1',
    tier: 1,
    title: 'Harbor Sprint Cup',
    description: 'Prove your pace on Neo Harbor streets against local contenders.',
    trackId: 'city',
    weather: 'sunny',
    laps: 2,
    aiDifficulty: 0.86,
    rewardFirst: 550,
    rewardSecond: 350,
    rewardThird: 200,
    requiredStars: 0,
  },
  {
    id: 'ev2',
    tier: 2,
    title: 'Autobahn Velocity',
    description: 'High-speed highway slipstream showdown under clear golden skies.',
    trackId: 'highway',
    weather: 'sunny',
    laps: 2,
    aiDifficulty: 0.92,
    rewardFirst: 750,
    rewardSecond: 480,
    rewardThird: 280,
    requiredStars: 1,
  },
  {
    id: 'ev3',
    tier: 3,
    title: 'Redrock Sunset Duel',
    description: 'Master drifting around canyon hairpins and scorching straights.',
    trackId: 'desert',
    weather: 'sunny',
    laps: 3,
    aiDifficulty: 0.97,
    rewardFirst: 1000,
    rewardSecond: 650,
    rewardThird: 400,
    requiredStars: 3,
  },
  {
    id: 'ev4',
    tier: 4,
    title: 'Neon Monsoon GP',
    description: 'Slick wet tarmac and pouring rain test your braking discipline.',
    trackId: 'city',
    weather: 'rainy',
    laps: 3,
    aiDifficulty: 1.02,
    rewardFirst: 1350,
    rewardSecond: 850,
    rewardThird: 520,
    requiredStars: 5,
  },
  {
    id: 'ev5',
    tier: 5,
    title: 'Midnight Ridge Climb',
    description: 'Headlights pierce the alpine darkness on narrow mountain switchbacks.',
    trackId: 'mountain',
    weather: 'night',
    laps: 3,
    aiDifficulty: 1.07,
    rewardFirst: 1750,
    rewardSecond: 1100,
    rewardThird: 680,
    requiredStars: 7,
  },
  {
    id: 'ev6',
    tier: 6,
    title: 'Apex World Championship',
    description: 'Three-lap rainstorm finale across the toughest mountain pass.',
    trackId: 'mountain',
    weather: 'rainy',
    laps: 3,
    aiDifficulty: 1.13,
    rewardFirst: 2500,
    rewardSecond: 1550,
    rewardThird: 950,
    requiredStars: 10,
  },
];

export const AI_RIVALS = [
  { name: 'K. Sato', color: '#3b82f6', vehicleId: 'kestrel' },
  { name: 'L. Vance', color: '#10b981', vehicleId: 'ronin' },
  { name: 'M. Rossi', color: '#f97316', vehicleId: 'valkyrie' },
  { name: 'Z. Chen', color: '#a855f7', vehicleId: 'phantom' },
  { name: 'E. Mercer', color: '#eab308', vehicleId: 'titan' },
];

export const UPGRADE_LABELS: Record<UpgradeStat, string> = {
  speed: 'Top Speed',
  acceleration: 'Acceleration',
  handling: 'Handling',
  braking: 'Braking',
  nitro: 'Nitro Power',
};

export function getUpgradeCost(currentLevel: number): number {
  return 220 + currentLevel * 180;
}

export function getEffectiveStats(
  vehicle: VehicleDefinition,
  upgrades?: VehicleUpgradeLevels
): VehicleStats {
  const u = upgrades || { speed: 0, acceleration: 0, handling: 0, braking: 0, nitro: 0 };
  return {
    speed: Math.min(100, vehicle.baseStats.speed + u.speed * 3),
    acceleration: Math.min(100, vehicle.baseStats.acceleration + u.acceleration * 3),
    handling: Math.min(100, vehicle.baseStats.handling + u.handling * 3),
    braking: Math.min(100, vehicle.baseStats.braking + u.braking * 3),
    nitro: Math.min(100, vehicle.baseStats.nitro + u.nitro * 3),
  };
}

const SAVE_KEY = 'apex_velocity_save_v1';

export function createDefaultSaveData(): PlayerSaveData {
  return {
    coins: 650,
    selectedVehicleId: 'valkyrie',
    unlockedVehicles: ['valkyrie'],
    vehicleColors: {
      valkyrie: '#e11d48',
      ronin: '#06b6d4',
      kestrel: '#f97316',
      phantom: '#8b5cf6',
      titan: '#fbbf24',
    },
    upgrades: {
      valkyrie: { speed: 0, acceleration: 0, handling: 0, braking: 0, nitro: 0 },
    },
    careerStars: {},
    bestLapTimes: {},
    settings: {
      sfxEnabled: true,
      musicEnabled: true,
      touchControlsMode: 'auto',
      steeringStyle: 'buttons',
      cameraDistance: 'close',
      playerName: 'Apex Driver',
    },
  };
}

export function loadSaveData(): PlayerSaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSaveData();
    const parsed = JSON.parse(raw) as Partial<PlayerSaveData>;
    const def = createDefaultSaveData();
    return {
      ...def,
      ...parsed,
      vehicleColors: { ...def.vehicleColors, ...(parsed.vehicleColors || {}) },
      upgrades: { ...def.upgrades, ...(parsed.upgrades || {}) },
      careerStars: { ...(parsed.careerStars || {}) },
      bestLapTimes: { ...(parsed.bestLapTimes || {}) },
      settings: { ...def.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return createDefaultSaveData();
  }
}

export function persistSaveData(data: PlayerSaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatTimeMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '--:--.--';
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}
