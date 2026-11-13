import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AI_RIVALS,
  RaceConfig,
  RaceHudState,
  RaceRewardSummary,
  RacerStandingsEntry,
  TRACKS,
  VEHICLES,
  VehicleStats,
  WeatherType,
} from '../types/game';
import { soundEngine } from '../audio/SoundEngine';
import { createProceduralTextures, ProceduralTexturePack } from './textures';
import { createVehicleVisualRig, VehicleVisualRig } from './vehicles';
import { buildTrack, BuiltTrack } from './tracks';
import { multiplayerClient, RemotePlayerState } from '../network/multiplayerClient';

export interface InputState {
  left: boolean;
  right: boolean;
  steerAnalog: number; // -1..1 for slider/analog
  accelerate: boolean;
  brake: boolean;
  drift: boolean;
  nitro: boolean;
}

interface ActiveRacer {
  id: string;
  name: string;
  vehicleId: string;
  vehicleName: string;
  isBike: boolean;
  color: string;
  isPlayer: boolean;
  isRemote: boolean;
  isGhost: boolean;
  rig: VehicleVisualRig;
  stats: VehicleStats;

  // Track-relative & world kinematics
  s: number;           // 0..1 normalized position along track
  lateral: number;     // lateral offset from centerline (m)
  speed: number;       // m/s (1 m/s = 3.6 km/h)
  headingOffset: number; // yaw relative to track tangent
  visualDriftAngle: number;
  leanAngle: number;
  steerInput: number;

  // Race progress
  lap: number;
  nextCheckpoint: number; // 0..3 for 0.2, 0.4, 0.6, 0.8; 4 = finish line
  totalProgress: number;  // lap + s
  finished: boolean;
  finishTimeMs: number | null;
  lapStartMs: number;
  bestLapMs: number | null;

  // Player nitro & drift
  nitroCharge: number; // 0..100
  isNitroActive: boolean;
  isDrifting: boolean;

  // AI parameters
  aiTargetLane: number;
  aiBasePace: number;
  aiLaneTimer: number;

  // Remote interpolation targets
  remoteTargetS: number;
  remoteTargetLateral: number;
  remoteTargetSpeed: number;
  remoteTargetLean: number;
}

interface SparkParticle {
  mesh: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const _pt = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _vTmp = new THREE.Vector3();

export class RacingEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTexturePack;

  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  // Showcase / Garage objects
  private showcaseGroup: THREE.Group;
  private showcaseVehicleRig: VehicleVisualRig | null = null;
  private showcaseVehicleId = 'valkyrie';
  private showcaseColor = '#e11d48';
  private showcaseAngle = 0.65;
  private showcaseDragActive = false;
  private showcaseLastX = 0;

  // Race objects
  private mode: 'showcase' | 'race' = 'showcase';
  private showcaseStyle: 'menu' | 'garage' = 'menu';
  private activeTrack: BuiltTrack | null = null;
  private racers: ActiveRacer[] = [];
  private raceConfig: RaceConfig | null = null;
  private rainPoints: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private sparks: SparkParticle[] = [];

  // Race timing & state
  private phase: 'countdown' | 'racing' | 'paused' | 'finished' = 'countdown';
  private countdownTimer = 3.4;
  private lastBeepSec = 4;
  private raceElapsedMs = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private overtakes = 0;
  private lastPlayerPosition = 1;
  private driftScore = 0;
  private checkpointBanner: string | null = null;
  private checkpointBannerTimer = 0;
  private telemetryTimer = 0;
  private hudEmitTimer = 0;
  private cameraDistanceMode: 'close' | 'far' = 'close';

  // Loop management
  private frameId = 0;
  private lastTime = performance.now();
  private disposed = false;

  // Inputs & Callbacks
  public input: InputState = {
    left: false,
    right: false,
    steerAnalog: 0,
    accelerate: false,
    brake: false,
    drift: false,
    nitro: false,
  };
  private onHudUpdate?: (hud: RaceHudState) => void;
  private onRaceFinish?: (summary: RaceRewardSummary) => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onHudUpdate?: (hud: RaceHudState) => void;
      onRaceFinish?: (summary: RaceRewardSummary) => void;
    }
  ) {
    this.container = container;
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onRaceFinish = callbacks.onRaceFinish;

    // 1. Software WebGL probe
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b101b);
    this.scene.fog = new THREE.FogExp2(0x0b101b, 0.012);

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.25, 650);
    this.camera.position.set(4.5, 2.2, 5.5);

    // Mandatory studio environment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-point warm/cool lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.75);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3d6, 2.1);
    this.sunLight.position.set(30, 55, 25);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 140;
    const d = 32;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    this.rimLight.position.set(-25, 18, -30);
    this.scene.add(this.rimLight);

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // Build Showcase Showroom Turntable
    this.showcaseGroup = new THREE.Group();
    this.buildShowcaseStage();
    this.scene.add(this.showcaseGroup);

    // Pre-allocate pooled spark particles
    this.initParticlePool();

    // Events
    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTime = performance.now();
    this.scheduleNextTick();
  }

  private buildShowcaseStage() {
    const floorGeo = new THREE.CircleGeometry(42, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.45,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.showcaseGroup.add(floor);

    // Turntable plinth (raised 0.08m above floor)
    const plinthGeo = new THREE.CylinderGeometry(3.6, 3.9, 0.14, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.28,
      metalness: 0.72,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.07;
    plinth.receiveShadow = true;
    this.showcaseGroup.add(plinth);

    const ringGeo = new THREE.RingGeometry(3.52, 3.68, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.15;
    this.showcaseGroup.add(ring);

    // Subtle vertical light pillars around the showroom horizon
    const colGeo = new THREE.BoxGeometry(0.35, 9, 0.35);
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });
    const pillars = new THREE.InstancedMesh(colGeo, colMat, 12);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 18, 4.5, Math.sin(a) * 18);
      dummy.rotation.y = -a;
      dummy.updateMatrix();
      pillars.setMatrixAt(i, dummy.matrix);
    }
    pillars.computeBoundingSphere();
    this.showcaseGroup.add(pillars);
  }

  private initParticlePool() {
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.particleGlow,
        color: 0xfbbf24,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this.sparks.push({
        mesh: sprite,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.35,
      });
    }
  }

  private spawnBurst(pos: THREE.Vector3, colorHex: number, count = 8, speedScale = 6) {
    let spawned = 0;
    for (let i = 0; i < this.sparks.length && spawned < count; i++) {
      const sp = this.sparks[i];
      if (sp.life <= 0) {
        sp.life = 0.28 + Math.random() * 0.22;
        sp.maxLife = sp.life;
        sp.mesh.position.copy(pos);
        sp.mesh.position.y += 0.4;
        sp.mesh.scale.setScalar(0.45 + Math.random() * 0.35);
        (sp.mesh.material as THREE.SpriteMaterial).color.setHex(colorHex);
        (sp.mesh.material as THREE.SpriteMaterial).opacity = 0.95;
        sp.mesh.visible = true;
        sp.vel.set(
          (Math.random() - 0.5) * speedScale,
          1.8 + Math.random() * speedScale * 0.5,
          (Math.random() - 0.5) * speedScale
        );
        spawned++;
      }
    }
  }

  public setCameraDistance(mode: 'close' | 'far') {
    this.cameraDistanceMode = mode;
  }

  public showShowcase(vehicleId: string, colorHex: string, style: 'menu' | 'garage') {
    this.clearRaceScene();
    this.mode = 'showcase';
    this.showcaseStyle = style;
    this.showcaseGroup.visible = true;
    soundEngine.stopEngine();

    this.scene.background = new THREE.Color(0x090d16);
    this.scene.fog = new THREE.FogExp2(0x090d16, 0.025);
    this.hemiLight.color.setHex(0x93c5fd);
    this.hemiLight.groundColor.setHex(0x0f172a);
    this.hemiLight.intensity = 0.85;
    this.sunLight.color.setHex(0xfff1d6);
    this.sunLight.intensity = 2.2;
    this.sunLight.position.set(8, 14, 10);
    this.sunLight.target.position.set(0, 0.6, 0);

    this.updateShowcaseVehicle(vehicleId, colorHex);
  }

  public updateShowcaseVehicle(vehicleId: string, colorHex: string) {
    if (this.showcaseVehicleRig && this.showcaseVehicleId === vehicleId) {
      this.showcaseColor = colorHex;
      this.showcaseVehicleRig.setColor(colorHex);
      return;
    }

    if (this.showcaseVehicleRig) {
      this.showcaseGroup.remove(this.showcaseVehicleRig.root);
      this.showcaseVehicleRig = null;
    }

    const def = VEHICLES.find((v) => v.id === vehicleId) || VEHICLES[0];
    this.showcaseVehicleId = def.id;
    this.showcaseColor = colorHex;
    const rig = createVehicleVisualRig(def, colorHex, this.textures.contactShadow);
    rig.root.position.set(0, 0.14, 0);
    rig.setNightLights(false);
    this.showcaseGroup.add(rig.root);
    this.showcaseVehicleRig = rig;
  }

  public startRace(
    config: RaceConfig,
    playerVehicleId: string,
    playerColor: string,
    playerStats: VehicleStats,
    playerName: string,
    remotePlayers?: RemotePlayerState[]
  ) {
    this.clearRaceScene();
    this.mode = 'race';
    this.showcaseGroup.visible = false;
    this.raceConfig = config;

    this.applyWeatherLighting(config.weather);
    this.activeTrack = buildTrack(config.trackId, config.weather, this.textures, this.isSoftwareGl);
    this.scene.add(this.activeTrack.group);

    if (config.weather === 'rainy') {
      this.createRainSystem();
    }

    const playerDef = VEHICLES.find((v) => v.id === playerVehicleId) || VEHICLES[0];

    // Spawn Player + Opponents on staggered starting grid behind finish line
    const gridOffsetStart = 0.986; // just behind finish line s=0

    // Player Racer
    const playerRig = createVehicleVisualRig(playerDef, playerColor, this.textures.contactShadow);
    playerRig.setNightLights(config.weather === 'night');
    this.scene.add(playerRig.root);

    const playerRacer: ActiveRacer = {
      id: 'player',
      name: playerName || 'Apex Driver',
      vehicleId: playerDef.id,
      vehicleName: playerDef.name,
      isBike: playerDef.type === 'bike',
      color: playerColor,
      isPlayer: true,
      isRemote: false,
      isGhost: false,
      rig: playerRig,
      stats: playerStats,
      s: gridOffsetStart,
      lateral: -2.2,
      speed: 0,
      headingOffset: 0,
      visualDriftAngle: 0,
      leanAngle: 0,
      steerInput: 0,
      lap: 1,
      nextCheckpoint: 0,
      totalProgress: 0,
      finished: false,
      finishTimeMs: null,
      lapStartMs: 0,
      bestLapMs: null,
      nitroCharge: 100,
      isNitroActive: false,
      isDrifting: false,
      aiTargetLane: 0,
      aiBasePace: 1,
      aiLaneTimer: 0,
      remoteTargetS: gridOffsetStart,
      remoteTargetLateral: -2.2,
      remoteTargetSpeed: 0,
      remoteTargetLean: 0,
    };
    this.racers.push(playerRacer);

    // Opponents depending on mode
    if (config.mode === 'timetrial') {
      // Spawn translucent Ghost Pacer target
      const ghostDef = playerDef;
      const ghostRig = createVehicleVisualRig(ghostDef, '#38bdf8', this.textures.contactShadow);
      ghostRig.paintMaterial.transparent = true;
      ghostRig.paintMaterial.opacity = 0.42;
      this.scene.add(ghostRig.root);
      this.racers.push({
        id: 'ghost',
        name: 'Gold Pacer',
        vehicleId: ghostDef.id,
        vehicleName: ghostDef.name,
        isBike: ghostDef.type === 'bike',
        color: '#38bdf8',
        isPlayer: false,
        isRemote: false,
        isGhost: true,
        rig: ghostRig,
        stats: { speed: 84, acceleration: 82, handling: 86, braking: 85, nitro: 80 },
        s: gridOffsetStart,
        lateral: 2.2,
        speed: 0,
        headingOffset: 0,
        visualDriftAngle: 0,
        leanAngle: 0,
        steerInput: 0,
        lap: 1,
        nextCheckpoint: 0,
        totalProgress: 0,
        finished: false,
        finishTimeMs: null,
        lapStartMs: 0,
        bestLapMs: null,
        nitroCharge: 100,
        isNitroActive: false,
        isDrifting: false,
        aiTargetLane: 1.5,
        aiBasePace: 0.96,
        aiLaneTimer: 2,
        remoteTargetS: gridOffsetStart,
        remoteTargetLateral: 2.2,
        remoteTargetSpeed: 0,
        remoteTargetLean: 0,
      });
    } else {
      // Remote multiplayer racers (excluding local socket id)
      const myId = multiplayerClient.playerId;
      let gridSlot = 1;
      if (config.mode === 'multiplayer' && remotePlayers) {
        remotePlayers.forEach((rp) => {
          if (rp.id === myId) return;
          const vDef = VEHICLES.find((v) => v.id === rp.vehicleId) || VEHICLES[0];
          const rig = createVehicleVisualRig(vDef, rp.color, this.textures.contactShadow);
          rig.setNightLights(config.weather === 'night');
          this.scene.add(rig.root);
          const sPos = gridOffsetStart - Math.floor(gridSlot / 2) * 0.005;
          const lat = (gridSlot % 2 === 0 ? -1 : 1) * 2.2;
          this.racers.push({
            id: rp.id,
            name: rp.name,
            vehicleId: vDef.id,
            vehicleName: vDef.name,
            isBike: vDef.type === 'bike',
            color: rp.color,
            isPlayer: false,
            isRemote: true,
            isGhost: false,
            rig,
            stats: vDef.baseStats,
            s: sPos,
            lateral: lat,
            speed: 0,
            headingOffset: 0,
            visualDriftAngle: 0,
            leanAngle: 0,
            steerInput: 0,
            lap: 1,
            nextCheckpoint: 0,
            totalProgress: 0,
            finished: false,
            finishTimeMs: null,
            lapStartMs: 0,
            bestLapMs: null,
            nitroCharge: 100,
            isNitroActive: false,
            isDrifting: false,
            aiTargetLane: lat,
            aiBasePace: 1,
            aiLaneTimer: 0,
            remoteTargetS: sPos,
            remoteTargetLateral: lat,
            remoteTargetSpeed: 0,
            remoteTargetLean: 0,
          });
          gridSlot++;
        });
      }

      // Fill remaining grid slots up to 6 racers with competitive AI rivals
      const maxRacers = 6;
      for (let i = 0; i < AI_RIVALS.length && this.racers.length < maxRacers; i++) {
        const aiMeta = AI_RIVALS[i];
        const vDef = VEHICLES.find((v) => v.id === aiMeta.vehicleId) || VEHICLES[0];
        const rig = createVehicleVisualRig(vDef, aiMeta.color, this.textures.contactShadow);
        rig.setNightLights(config.weather === 'night');
        this.scene.add(rig.root);

        const sPos = gridOffsetStart - Math.floor(gridSlot / 2) * 0.0048;
        const lat = (gridSlot % 2 === 0 ? -1 : 1) * 2.3;
        const skillFactor = config.aiDifficulty * (0.93 + (i / AI_RIVALS.length) * 0.14);

        this.racers.push({
          id: `ai_${i}`,
          name: aiMeta.name,
          vehicleId: vDef.id,
          vehicleName: vDef.name,
          isBike: vDef.type === 'bike',
          color: aiMeta.color,
          isPlayer: false,
          isRemote: false,
          isGhost: false,
          rig,
          stats: {
            speed: Math.min(99, vDef.baseStats.speed * skillFactor),
            acceleration: Math.min(99, vDef.baseStats.acceleration * skillFactor),
            handling: Math.min(99, vDef.baseStats.handling * skillFactor),
            braking: vDef.baseStats.braking,
            nitro: vDef.baseStats.nitro,
          },
          s: sPos,
          lateral: lat,
          speed: 0,
          headingOffset: 0,
          visualDriftAngle: 0,
          leanAngle: 0,
          steerInput: 0,
          lap: 1,
          nextCheckpoint: 0,
          totalProgress: -gridSlot * 0.005,
          finished: false,
          finishTimeMs: null,
          lapStartMs: 0,
          bestLapMs: null,
          nitroCharge: 100,
          isNitroActive: false,
          isDrifting: false,
          aiTargetLane: lat,
          aiBasePace: skillFactor,
          aiLaneTimer: 1 + Math.random() * 2,
          remoteTargetS: sPos,
          remoteTargetLateral: lat,
          remoteTargetSpeed: 0,
          remoteTargetLean: 0,
        });
        gridSlot++;
      }
    }

    // Position all vehicles on the grid initially
    this.racers.forEach((r) => this.syncRacerTransform(r, 0.016));

    // Snap camera behind player
    this.snapCameraBehindPlayer();

    this.phase = 'countdown';
    this.countdownTimer = 3.4;
    this.lastBeepSec = 4;
    this.raceElapsedMs = 0;
    this.overtakes = 0;
    this.lastPlayerPosition = 1;
    this.driftScore = 0;
    this.checkpointBanner = null;
    this.checkpointBannerTimer = 0;

    soundEngine.startEngine(playerDef.type);
    this.emitHud();
  }

  public syncRemotePlayer(rp: RemotePlayerState) {
    if (this.mode !== 'race') return;
    const racer = this.racers.find((r) => r.id === rp.id);
    if (!racer) return;
    racer.remoteTargetS = rp.s;
    racer.remoteTargetLateral = rp.offset;
    racer.remoteTargetSpeed = rp.speed;
    racer.remoteTargetLean = rp.lean;
    racer.isDrifting = rp.drifting;
    racer.isNitroActive = rp.nitro;
    racer.lap = rp.lap;
    racer.finished = rp.finished;
    racer.finishTimeMs = rp.finishTime;
  }

  public setPaused(paused: boolean) {
    if (this.mode !== 'race' || this.phase === 'finished') return;
    this.phase = paused ? 'paused' : 'racing';
    if (paused) {
      soundEngine.updateEngine(0, 0, 0, false);
    }
    this.emitHud();
  }

  private applyWeatherLighting(weather: WeatherType) {
    if (weather === 'sunny') {
      this.scene.background = new THREE.Color(0x60a5fa);
      this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0022);
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x3f2e1d);
      this.hemiLight.intensity = 0.85;
      this.sunLight.color.setHex(0xfff1c9);
      this.sunLight.intensity = 2.35;
      this.rimLight.color.setHex(0x93c5fd);
      this.rimLight.intensity = 0.65;
    } else if (weather === 'rainy') {
      this.scene.background = new THREE.Color(0x334155);
      this.scene.fog = new THREE.FogExp2(0x334155, 0.0046);
      this.hemiLight.color.setHex(0x94a3b8);
      this.hemiLight.groundColor.setHex(0x1e293b);
      this.hemiLight.intensity = 0.9;
      this.sunLight.color.setHex(0xcbd5e1);
      this.sunLight.intensity = 1.25;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 0.7;
    } else {
      // Night race
      this.scene.background = new THREE.Color(0x050814);
      this.scene.fog = new THREE.FogExp2(0x050814, 0.0052);
      this.hemiLight.color.setHex(0x1e3a8a);
      this.hemiLight.groundColor.setHex(0x090d16);
      this.hemiLight.intensity = 0.6;
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.85;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 1.05;
    }
  }

  private createRainSystem() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 26;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.22,
      transparent: true,
      opacity: 0.65,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.rainPoints = points;
    this.rainPositions = positions;
  }

  private clearRaceScene() {
    this.racers.forEach((r) => this.scene.remove(r.rig.root));
    this.racers = [];
    if (this.activeTrack) {
      this.scene.remove(this.activeTrack.group);
      this.activeTrack.dispose();
      this.activeTrack = null;
    }
    if (this.rainPoints) {
      this.scene.remove(this.rainPoints);
      this.rainPoints.geometry.dispose();
      (this.rainPoints.material as THREE.Material).dispose();
      this.rainPoints = null;
      this.rainPositions = null;
    }
  }

  private scheduleNextTick() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        this.frameId = requestAnimationFrame(this.tick);
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    if (this.mode === 'showcase') {
      this.updateShowcase(dt, now / 1000);
    } else if (this.mode === 'race') {
      this.updateRace(dt, now / 1000);
    }

    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  private updateShowcase(dt: number, elapsedSec: number) {
    if (!this.showcaseDragActive) {
      this.showcaseAngle += dt * (this.showcaseStyle === 'menu' ? 0.34 : 0.22);
    }
    const radius = this.showcaseStyle === 'menu' ? 5.6 : 4.7;
    const camY = this.showcaseStyle === 'menu' ? 1.95 : 1.75;
    _camGoal.set(
      Math.cos(this.showcaseAngle) * radius,
      camY,
      Math.sin(this.showcaseAngle) * radius
    );
    this.camera.position.lerp(_camGoal, 1 - Math.exp(-8 * dt));
    _lookGoal.set(this.showcaseStyle === 'menu' ? -0.6 : 0, 0.72, 0);
    this.camera.lookAt(_lookGoal);

    if (this.showcaseVehicleRig) {
      this.showcaseVehicleRig.setNitro(false, elapsedSec);
      this.showcaseVehicleRig.wheels.forEach((w) => {
        w.rotation.x -= dt * 1.4;
      });
    }
  }

  private updateRace(dt: number, elapsedSec: number) {
    if (!this.activeTrack || !this.raceConfig) return;

    if (this.phase === 'paused') {
      return;
    }

    // Impact hitstop freeze for crunchy collision weight
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.5);
      this.updateCameraRace(dt);
      return;
    }

    // Countdown sequence
    if (this.phase === 'countdown') {
      this.countdownTimer -= dt;
      const secVal = Math.max(0, Math.ceil(this.countdownTimer));
      if (secVal < this.lastBeepSec && secVal >= 0) {
        this.lastBeepSec = secVal;
        soundEngine.playCountdownBeep(secVal === 0);
      }

      // Gantry light progression
      const lights = this.activeTrack.countdownLights;
      if (secVal >= 1) {
        const litCount = 4 - secVal;
        lights.forEach((mat, idx) => {
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = idx <= litCount ? 3.5 : 0;
        });
      } else {
        lights.forEach((mat) => {
          mat.emissive.setHex(0x22c55e);
          mat.emissiveIntensity = 4.0;
        });
      }

      if (this.countdownTimer <= 0) {
        this.phase = 'racing';
      }

      // Rev engine in neutral if holding throttle
      const player = this.racers[0];
      if (player) {
        const rev = this.input.accelerate ? 0.78 : 0.14;
        soundEngine.updateEngine(rev, 0, 0, false);
        this.syncRacerTransform(player, dt);
      }
      this.updateCameraRace(dt);
      this.hudEmitTimer += dt;
      if (this.hudEmitTimer >= 0.05) {
        this.hudEmitTimer = 0;
        this.emitHud();
      }
      return;
    }

    if (this.phase === 'racing') {
      this.raceElapsedMs += dt * 1000;
    }

    if (this.checkpointBannerTimer > 0) {
      this.checkpointBannerTimer -= dt;
      if (this.checkpointBannerTimer <= 0) {
        this.checkpointBanner = null;
      }
    }

    // Update each racer
    for (let i = 0; i < this.racers.length; i++) {
      const r = this.racers[i];
      if (r.isPlayer) {
        this.stepPlayerPhysics(r, dt, elapsedSec);
      } else if (r.isRemote) {
        this.stepRemoteInterpolation(r, dt, elapsedSec);
      } else {
        this.stepAiPhysics(r, dt, elapsedSec);
      }
      this.syncRacerTransform(r, dt);
    }

    // Vehicle-to-vehicle collisions
    this.resolveCollisions();

    // Update ranking & overtakes
    this.updateStandings();

    // Update rain particles around camera
    if (this.rainPoints && this.rainPositions && this.racers[0]) {
      const pPos = this.racers[0].rig.root.position;
      this.rainPoints.position.set(pPos.x, pPos.y, pPos.z);
      for (let i = 0; i < this.rainPositions.length; i += 3) {
        this.rainPositions[i + 1] -= dt * 36;
        if (this.rainPositions[i + 1] < -2) {
          this.rainPositions[i + 1] = 24;
        }
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Sun shadow follows player tightly
    if (this.racers[0]) {
      const pPos = this.racers[0].rig.root.position;
      this.sunLight.position.set(pPos.x + 28, pPos.y + 48, pPos.z + 24);
      this.sunLight.target.position.copy(pPos);
    }

    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.2);
    this.updateCameraRace(dt);

    // Multiplayer 20Hz telemetry emit
    if (this.raceConfig.mode === 'multiplayer' && this.racers[0]) {
      this.telemetryTimer += dt;
      if (this.telemetryTimer >= 0.05) {
        this.telemetryTimer = 0;
        const p = this.racers[0];
        multiplayerClient.sendTelemetry({
          s: p.s,
          offset: p.lateral,
          speed: p.speed,
          heading: p.headingOffset,
          lean: p.leanAngle,
          drifting: p.isDrifting,
          nitro: p.isNitroActive,
          lap: p.lap,
          finished: p.finished,
          finishTime: p.finishTimeMs,
        });
      }
    }

    // Emit HUD state at ~20Hz
    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.05) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private stepPlayerPhysics(r: ActiveRacer, dt: number, elapsedSec: number) {
    if (!this.activeTrack || !this.raceConfig) return;
    if (r.finished) {
      // Gentle AI coast after finishing
      r.speed = THREE.MathUtils.damp(r.speed, 22, 2.0, dt);
      r.s = (r.s + (r.speed * dt) / this.activeTrack.totalLength) % 1;
      r.isNitroActive = false;
      r.isDrifting = false;
      soundEngine.updateEngine(0.25, 0.3, 0, false);
      return;
    }

    const isRain = this.raceConfig.weather === 'rainy';
    const gripFactor = isRain ? 0.84 : 1.0;

    // Convert 1..100 stats to physical tuning
    const maxSpeedMs = (54 + (r.stats.speed / 100) * 34); // ~195 to 316 km/h base
    const accelRate = (16 + (r.stats.acceleration / 100) * 20) * (isRain ? 0.92 : 1.0);
    const brakeRate = (32 + (r.stats.braking / 100) * 28) * gripFactor;
    const handlingRate = (12.5 + (r.stats.handling / 100) * 11.5) * gripFactor;
    const nitroBonus = 1.18 + (r.stats.nitro / 100) * 0.14;

    // Steer input (-1 left, +1 right)
    let steer = 0;
    if (this.input.left) steer -= 1;
    if (this.input.right) steer += 1;
    if (Math.abs(this.input.steerAnalog) > 0.04) {
      steer = THREE.MathUtils.clamp(this.input.steerAnalog, -1, 1);
    }
    r.steerInput = THREE.MathUtils.damp(r.steerInput, steer, 12, dt);

    // Nitro logic
    const wantsNitro = this.input.nitro && r.nitroCharge > 2 && r.speed > 10;
    if (wantsNitro && !r.isNitroActive) {
      soundEngine.playNitroBurst();
    }
    r.isNitroActive = wantsNitro;
    if (r.isNitroActive) {
      r.nitroCharge = Math.max(0, r.nitroCharge - dt * 26);
    } else {
      r.nitroCharge = Math.min(100, r.nitroCharge + dt * 4.5);
    }

    // Drift logic
    const speedRatio = Math.min(1, r.speed / maxSpeedMs);
    r.isDrifting = this.input.drift && Math.abs(r.steerInput) > 0.15 && r.speed > 18;
    if (r.isDrifting) {
      r.nitroCharge = Math.min(100, r.nitroCharge + dt * 16);
      this.driftScore += Math.round(dt * 120 * speedRatio);
      if (Math.random() < 0.35) {
        this.spawnBurst(r.rig.root.position, 0xe2e8f0, 1, 2.2);
      }
    }

    // Acceleration / Braking
    const effectiveTopSpeed = maxSpeedMs * (r.isNitroActive ? nitroBonus : 1.0);
    if (r.isNitroActive || this.input.accelerate) {
      const curveFactor = 1 - 0.45 * Math.pow(Math.min(1, r.speed / effectiveTopSpeed), 1.4);
      const boostMult = r.isNitroActive ? 1.55 : 1.0;
      r.speed += accelRate * curveFactor * boostMult * dt;
    } else if (this.input.brake) {
      r.speed -= brakeRate * dt;
    } else {
      // Aerodynamic + rolling drag
      r.speed -= (6.5 + r.speed * 0.14) * dt;
    }
    r.speed = THREE.MathUtils.clamp(r.speed, -12, effectiveTopSpeed);

    // Lateral steering + drift boost
    const driftSteerMult = r.isDrifting ? 1.38 : 1.0;
    const steerEffectiveness = Math.min(1, Math.abs(r.speed) / 14);
    r.lateral += r.steerInput * handlingRate * driftSteerMult * steerEffectiveness * dt;

    // Curb / Guardrail boundary collision
    const maxLat = this.activeTrack.roadHalfWidth + 0.35;
    if (Math.abs(r.lateral) > maxLat) {
      const hitVel = Math.abs(r.lateral) - maxLat;
      r.lateral = Math.sign(r.lateral) * maxLat;
      if (r.speed > 20 && hitVel > 0.05) {
        r.speed *= 0.92;
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.25);
        this.spawnBurst(r.rig.root.position, 0xfbbf24, 5, 5);
        soundEngine.playCollision(0.45);
      }
    }

    // Visual drift yaw & motorcycle lean
    const targetDriftAngle = r.isDrifting ? -r.steerInput * 0.34 : -r.steerInput * 0.11;
    r.visualDriftAngle = THREE.MathUtils.damp(r.visualDriftAngle, targetDriftAngle, 10, dt);

    const targetLean = r.isBike
      ? -r.steerInput * 0.56 * steerEffectiveness
      : -r.steerInput * 0.065 * steerEffectiveness;
    r.leanAngle = THREE.MathUtils.damp(r.leanAngle, targetLean, 10, dt);

    // Advance along track spline
    const prevS = r.s;
    const ds = (r.speed * dt) / this.activeTrack.totalLength;
    r.s = ((r.s + ds) % 1 + 1) % 1;

    // Checkpoints & Lap progression
    this.checkCheckpointsAndLaps(r, prevS, ds);

    // Audio & Rig VFX
    const gearFloat = Math.min(5.99, (Math.max(0, r.speed) / effectiveTopSpeed) * 6);
    const rpmNorm = (gearFloat % 1) * 0.65 + 0.32;
    soundEngine.updateEngine(
      rpmNorm,
      speedRatio,
      r.isDrifting ? Math.abs(r.steerInput) : 0,
      r.isNitroActive
    );

    r.rig.setBraking(this.input.brake && r.speed > 2);
    r.rig.setNitro(r.isNitroActive, elapsedSec);
  }

  private stepAiPhysics(r: ActiveRacer, dt: number, elapsedSec: number) {
    if (!this.activeTrack || !this.raceConfig) return;

    const player = this.racers[0];
    const maxSpeedMs = (54 + (r.stats.speed / 100) * 34) * r.aiBasePace;
    const accelRate = (15 + (r.stats.acceleration / 100) * 19) * r.aiBasePace;

    // Subtle competitive rubber-banding (except Time Trial Ghost)
    let paceMod = 1.0;
    if (!r.isGhost && player && !player.finished) {
      const gap = r.totalProgress - player.totalProgress;
      if (gap < -0.18) paceMod = 1.09; // catch up to challenge player
      else if (gap > 0.25) paceMod = 0.94; // keep pack competitive
    }

    // Overtake & obstacle avoidance logic
    r.aiLaneTimer -= dt;
    if (r.aiLaneTimer <= 0) {
      r.aiLaneTimer = 1.4 + Math.random() * 1.8;
      r.aiTargetLane = (Math.random() - 0.5) * (this.activeTrack.roadHalfWidth * 1.15);
    }

    // Check if another racer is directly ahead within 0.025 track units (~40m)
    if (!r.isGhost) {
      for (let j = 0; j < this.racers.length; j++) {
        const other = this.racers[j];
        if (other.id === r.id || other.isGhost) continue;
        const dsAhead = ((other.s - r.s) + 1) % 1;
        if (dsAhead > 0.001 && dsAhead < 0.022 && Math.abs(other.lateral - r.lateral) < 3.1) {
          // Shift to whichever side of the road has more room to overtake cleanly
          const passDir = other.lateral > 0 ? -1 : 1;
          r.aiTargetLane = THREE.MathUtils.clamp(
            other.lateral + passDir * 3.8,
            -this.activeTrack.roadHalfWidth * 0.78,
            this.activeTrack.roadHalfWidth * 0.78
          );
          break;
        }
      }
    }

    // Corner slowing anticipation (look ahead 0.025 along curve)
    this.activeTrack.sampleAt(r.s, _pt, _tan, _right);
    const curHeading = Math.atan2(_tan.x, _tan.z);
    this.activeTrack.sampleAt((r.s + 0.022) % 1, _pt, _tan, _right);
    const aheadHeading = Math.atan2(_tan.x, _tan.z);
    let deltaHeading = Math.abs(aheadHeading - curHeading);
    if (deltaHeading > Math.PI) deltaHeading = Math.PI * 2 - deltaHeading;
    const cornerFactor = deltaHeading > 0.22 ? 0.82 : 1.0;

    // Occasional AI nitro on straights
    const useNitro = !r.isGhost && cornerFactor === 1.0 && r.nitroCharge > 40 && Math.random() < 0.015;
    if (useNitro) r.isNitroActive = true;
    if (r.isNitroActive) {
      r.nitroCharge = Math.max(0, r.nitroCharge - dt * 28);
      if (r.nitroCharge <= 5 || cornerFactor < 1) r.isNitroActive = false;
    } else {
      r.nitroCharge = Math.min(100, r.nitroCharge + dt * 6);
    }

    const targetSpeed = maxSpeedMs * paceMod * cornerFactor * (r.isNitroActive ? 1.14 : 1.0);
    if (r.speed < targetSpeed) {
      r.speed = Math.min(targetSpeed, r.speed + accelRate * dt);
    } else {
      r.speed = THREE.MathUtils.damp(r.speed, targetSpeed, 3.2, dt);
    }

    const latDiff = r.aiTargetLane - r.lateral;
    const latStep = THREE.MathUtils.clamp(latDiff * 2.8, -11, 11);
    r.lateral += latStep * dt;
    r.steerInput = THREE.MathUtils.clamp(latStep / 11, -1, 1);

    const targetLean = r.isBike ? -r.steerInput * 0.45 : -r.steerInput * 0.05;
    r.leanAngle = THREE.MathUtils.damp(r.leanAngle, targetLean, 8, dt);
    r.visualDriftAngle = THREE.MathUtils.damp(r.visualDriftAngle, -r.steerInput * 0.08, 8, dt);

    const prevS = r.s;
    const ds = (r.speed * dt) / this.activeTrack.totalLength;
    r.s = (r.s + ds) % 1;
    this.checkCheckpointsAndLaps(r, prevS, ds);

    r.rig.setBraking(r.speed > targetSpeed + 4);
    r.rig.setNitro(r.isNitroActive, elapsedSec);
  }

  private stepRemoteInterpolation(r: ActiveRacer, dt: number, elapsedSec: number) {
    if (!this.activeTrack) return;
    // Shortest modular wrap interpolation along s in [0, 1)
    let diff = r.remoteTargetS - r.s;
    if (diff < -0.5) diff += 1;
    if (diff > 0.5) diff -= 1;
    r.s = ((r.s + diff * Math.min(1, dt * 12)) % 1 + 1) % 1;
    r.lateral = THREE.MathUtils.damp(r.lateral, r.remoteTargetLateral, 10, dt);
    r.speed = THREE.MathUtils.damp(r.speed, r.remoteTargetSpeed, 10, dt);
    r.leanAngle = THREE.MathUtils.damp(r.leanAngle, r.remoteTargetLean, 10, dt);
    r.totalProgress = (r.lap - 1) + (r.s > 0.9 && r.lap === 1 ? r.s - 1 : r.s);
    r.rig.setNitro(r.isNitroActive, elapsedSec);
  }

  private checkCheckpointsAndLaps(r: ActiveRacer, prevS: number, ds: number) {
    if (!this.raceConfig || !this.activeTrack) return;

    const cpFractions = [0.2, 0.4, 0.6, 0.8];
    if (r.nextCheckpoint < 4) {
      const targetS = cpFractions[r.nextCheckpoint];
      if (prevS < targetS && r.s >= targetS && ds > 0) {
        r.nextCheckpoint++;
        if (r.isPlayer) {
          soundEngine.playCheckpoint();
          this.checkpointBanner = `CHECKPOINT ${r.nextCheckpoint}/4`;
          this.checkpointBannerTimer = 1.4;
          const cpMat = this.activeTrack.checkpointMats[r.nextCheckpoint - 1];
          if (cpMat) cpMat.emissive.setHex(0x22c55e);
        }
      }
    }

    // Finish line crossing (prevS > 0.85 && r.s < 0.15)
    if (prevS > 0.85 && r.s < 0.15 && ds > 0) {
      if (r.nextCheckpoint >= 3) {
        const lapTime = this.raceElapsedMs - r.lapStartMs;
        if (r.lap >= 1 && (r.bestLapMs === null || lapTime < r.bestLapMs)) {
          r.bestLapMs = lapTime;
        }
        r.lapStartMs = this.raceElapsedMs;
        r.nextCheckpoint = 0;

        if (r.isPlayer) {
          // Reset checkpoint arch colors for next lap
          this.activeTrack.checkpointMats.forEach((m) => m.emissive.setHex(0x38bdf8));
        }

        if (r.lap >= this.raceConfig.laps) {
          r.finished = true;
          r.finishTimeMs = this.raceElapsedMs;
          if (r.isPlayer) {
            this.completePlayerRace();
          }
        } else {
          r.lap++;
          if (r.isPlayer) {
            soundEngine.playCheckpoint();
            this.checkpointBanner =
              r.lap === this.raceConfig.laps ? 'FINAL LAP!' : `LAP ${r.lap}/${this.raceConfig.laps}`;
            this.checkpointBannerTimer = 2.0;
          }
        }
      }
    }

    // Continuous progress score for standings (account for starting behind line s=0.986)
    const effectiveS = r.lap === 1 && r.nextCheckpoint === 0 && r.s > 0.88 ? r.s - 1 : r.s;
    r.totalProgress = r.finished
      ? this.raceConfig.laps + 10 - (r.finishTimeMs || 0) * 0.000001
      : (r.lap - 1) + effectiveS;
  }

  private resolveCollisions() {
    if (!this.activeTrack) return;
    const trackLen = this.activeTrack.totalLength;
    for (let i = 0; i < this.racers.length; i++) {
      const a = this.racers[i];
      if (a.isGhost) continue;
      for (let j = i + 1; j < this.racers.length; j++) {
        const b = this.racers[j];
        if (b.isGhost) continue;

        let ds = b.s - a.s;
        if (ds < -0.5) ds += 1;
        if (ds > 0.5) ds -= 1;
        const longitudinalDist = ds * trackLen;
        const lateralDist = b.lateral - a.lateral;

        const minLong = 4.0;
        const minLat = a.isBike || b.isBike ? 1.45 : 1.95;

        if (Math.abs(longitudinalDist) < minLong && Math.abs(lateralDist) < minLat) {
          // Push apart laterally & exchange slight momentum
          const pushDir = lateralDist >= 0 ? 1 : -1;
          const overlap = minLat - Math.abs(lateralDist);
          a.lateral -= pushDir * overlap * 0.52;
          b.lateral += pushDir * overlap * 0.52;

          if (a.isPlayer || b.isPlayer) {
            const p = a.isPlayer ? a : b;
            p.speed *= 0.94;
            this.hitstopTimer = 0.038;
            this.shakeIntensity = Math.max(this.shakeIntensity, 0.48);
            this.spawnBurst(p.rig.root.position, 0xf97316, 8, 7);
            soundEngine.playCollision(0.75);
          }
        }
      }
    }
  }

  private updateStandings() {
    const ranked = this.racers
      .filter((r) => !r.isGhost)
      .sort((a, b) => b.totalProgress - a.totalProgress);

    const playerIdx = ranked.findIndex((r) => r.isPlayer);
    const currentPos = playerIdx >= 0 ? playerIdx + 1 : 1;
    if (this.phase === 'racing' && currentPos < this.lastPlayerPosition) {
      this.overtakes += this.lastPlayerPosition - currentPos;
    }
    this.lastPlayerPosition = currentPos;
  }

  private completePlayerRace() {
    if (!this.raceConfig || this.phase === 'finished') return;
    this.phase = 'finished';
    soundEngine.playFinishFanfare();
    soundEngine.updateEngine(0.2, 0.2, 0, false);

    const standings = this.buildStandingsList();
    const playerEntry = standings.find((s) => s.isPlayer);
    const position = playerEntry ? playerEntry.position : 1;
    const totalRacers = standings.length;
    const player = this.racers[0];

    const posRewards = [600, 400, 260, 160, 110, 80];
    let baseCoins = posRewards[Math.min(posRewards.length - 1, position - 1)] || 100;
    let medalEarned: 'gold' | 'silver' | 'bronze' | null = null;
    let starsEarned = 0;

    if (this.raceConfig.mode === 'timetrial') {
      const trackDef = TRACKS.find((t) => t.id === this.raceConfig!.trackId) || TRACKS[0];
      const bestSec = (player.bestLapMs || player.finishTimeMs || 999999) / 1000;
      if (bestSec <= trackDef.targetGoldSec) {
        medalEarned = 'gold';
        baseCoins = 750;
      } else if (bestSec <= trackDef.targetSilverSec) {
        medalEarned = 'silver';
        baseCoins = 450;
      } else if (bestSec <= trackDef.targetBronzeSec) {
        medalEarned = 'bronze';
        baseCoins = 250;
      } else {
        baseCoins = 140;
      }
    } else if (this.raceConfig.mode === 'career') {
      starsEarned = position === 1 ? 3 : position === 2 ? 2 : position === 3 ? 1 : 0;
    }

    const overtakeBonus = this.overtakes * 35;
    const driftBonus = Math.min(250, Math.floor(this.driftScore / 20));
    const totalCoinsEarned = baseCoins + overtakeBonus + driftBonus;

    this.emitHud();
    if (this.onRaceFinish) {
      this.onRaceFinish({
        position,
        totalRacers,
        totalTimeMs: player.finishTimeMs || this.raceElapsedMs,
        bestLapMs: player.bestLapMs,
        baseCoins,
        overtakeBonus,
        driftBonus,
        medalEarned,
        starsEarned,
        totalCoinsEarned,
        standings,
      });
    }
  }

  private syncRacerTransform(r: ActiveRacer, dt: number) {
    if (!this.activeTrack) return;
    this.activeTrack.sampleAt(r.s, _pt, _tan, _right);
    r.rig.root.position.copy(_pt).addScaledVector(_right, r.lateral);

    const heading = Math.atan2(-_tan.x, -_tan.z);
    r.rig.root.rotation.set(0, heading + r.visualDriftAngle, 0);
    r.rig.leanGroup.rotation.z = r.leanAngle;

    // Spin wheels & steer front wheel pivots
    const spinDelta = (r.speed * dt) / 0.35;
    r.rig.wheels.forEach((w) => {
      w.rotation.x -= spinDelta;
    });
    r.rig.frontWheelPivots.forEach((p) => {
      p.rotation.y = -r.steerInput * 0.34;
    });
  }

  private snapCameraBehindPlayer() {
    const p = this.racers[0];
    if (!p || !this.activeTrack) return;
    this.activeTrack.sampleAt(p.s, _pt, _tan, _right);
    const dist = this.cameraDistanceMode === 'far' ? 9.4 : 7.0;
    const height = this.cameraDistanceMode === 'far' ? 3.8 : 2.75;
    this.camera.position
      .copy(p.rig.root.position)
      .addScaledVector(_tan, -dist);
    this.camera.position.y += height;
    _lookGoal.copy(p.rig.root.position).addScaledVector(_tan, 8);
    _lookGoal.y += 1.1;
    this.camera.lookAt(_lookGoal);
  }

  private updateCameraRace(dt: number) {
    const p = this.racers[0];
    if (!p || !this.activeTrack) return;

    this.activeTrack.sampleAt(p.s, _pt, _tan, _right);
    const baseDist = this.cameraDistanceMode === 'far' ? 9.4 : 7.0;
    const baseHeight = this.cameraDistanceMode === 'far' ? 3.8 : 2.75;
    const speedZoom = p.isNitroActive ? 0.95 : 0;

    _camGoal
      .copy(p.rig.root.position)
      .addScaledVector(_tan, -(baseDist + speedZoom));
    _camGoal.y += baseHeight;

    if (this.shakeIntensity > 0.005) {
      _camGoal.x += (Math.random() - 0.5) * this.shakeIntensity;
      _camGoal.y += (Math.random() - 0.5) * this.shakeIntensity * 0.6;
    }

    this.camera.position.lerp(_camGoal, 1 - Math.exp(-11 * dt));

    _lookGoal.copy(p.rig.root.position).addScaledVector(_tan, 10);
    _lookGoal.y += 1.15;
    this.camera.lookAt(_lookGoal);

    // Dynamic FOV warp with speed & nitro
    const targetFov = 58 + Math.min(14, (Math.max(0, p.speed) / 85) * 11) + (p.isNitroActive ? 8 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.08) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private updateParticles(dt: number) {
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      if (sp.life > 0) {
        sp.life -= dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        sp.vel.y -= 14 * dt;
        const alpha = Math.max(0, sp.life / sp.maxLife);
        (sp.mesh.material as THREE.SpriteMaterial).opacity = alpha;
        if (sp.life <= 0) {
          sp.mesh.visible = false;
        }
      }
    }
  }

  private buildStandingsList(): RacerStandingsEntry[] {
    const sorted = this.racers
      .filter((r) => !r.isGhost)
      .sort((a, b) => b.totalProgress - a.totalProgress);

    return sorted.map((r, idx) => ({
      id: r.id,
      name: r.name,
      vehicleName: r.vehicleName,
      color: r.color,
      isPlayer: r.isPlayer,
      isRemote: r.isRemote,
      position: idx + 1,
      lap: r.lap,
      totalProgress: r.totalProgress,
      speedKmh: Math.max(0, Math.round(r.speed * 3.6)),
      finished: r.finished,
      finishTimeMs: r.finishTimeMs,
      bestLapMs: r.bestLapMs,
    }));
  }

  private emitHud() {
    if (!this.onHudUpdate || !this.activeTrack || !this.raceConfig || !this.racers[0]) return;
    const player = this.racers[0];
    const standings = this.buildStandingsList();
    const pEntry = standings.find((s) => s.isPlayer);

    const maxSpeedMs = (54 + (player.stats.speed / 100) * 34) * (player.isNitroActive ? 1.25 : 1);
    const speedKmh = Math.max(0, Math.round(Math.abs(player.speed) * 3.6));
    const gear = Math.min(6, Math.max(1, Math.ceil((Math.abs(player.speed) / maxSpeedMs) * 6)));
    const gearFloat = Math.min(5.99, (Math.abs(player.speed) / maxSpeedMs) * 6);
    const rpmNorm = player.speed < 1 ? 0.14 : (gearFloat % 1) * 0.68 + 0.3;

    // Minimap dot normalization
    const samples = this.activeTrack.samples;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < samples.length; i += 4) {
      const p = samples[i].point;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    const padX = (span - (maxX - minX)) * 0.5;
    const padZ = (span - (maxZ - minZ)) * 0.5;

    const minimapRacers = this.racers.map((r) => ({
      id: r.id,
      x: THREE.MathUtils.clamp((r.rig.root.position.x - minX + padX) / span, 0, 1),
      y: THREE.MathUtils.clamp((r.rig.root.position.z - minZ + padZ) / span, 0, 1),
      isPlayer: r.isPlayer,
      color: r.color,
    }));

    this.onHudUpdate({
      phase: this.phase,
      countdownValue: Math.max(0, Math.ceil(this.countdownTimer)),
      speedKmh,
      rpmNorm,
      gear,
      nitro: Math.round(player.nitroCharge),
      isNitroActive: player.isNitroActive,
      isDrifting: player.isDrifting,
      position: pEntry ? pEntry.position : 1,
      totalRacers: standings.length,
      lap: player.lap,
      totalLaps: this.raceConfig.laps,
      raceTimeMs: this.raceElapsedMs,
      currentLapMs: this.raceElapsedMs - player.lapStartMs,
      bestLapMs: player.bestLapMs,
      wrongWay: player.speed < -3,
      checkpointBanner: this.checkpointBanner,
      standings,
      minimapRacers,
      overtakes: this.overtakes,
      driftScore: this.driftScore,
    });
  }

  public getMinimapPath(): Array<{ x: number; y: number }> {
    return this.activeTrack ? this.activeTrack.minimapPoints : [];
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'showcase') return;
    this.showcaseDragActive = true;
    this.showcaseLastX = e.clientX;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.showcaseDragActive || this.mode !== 'showcase') return;
    const dx = e.clientX - this.showcaseLastX;
    this.showcaseLastX = e.clientX;
    this.showcaseAngle += dx * 0.008;
  };

  private onPointerUp = () => {
    this.showcaseDragActive = false;
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    soundEngine.stopEngine();
    this.clearRaceScene();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

void _vTmp;
