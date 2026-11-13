import * as THREE from 'three';
import { VehicleDefinition } from '../types/game';

export interface VehicleVisualRig {
  root: THREE.Group;
  leanGroup: THREE.Group;
  wheels: THREE.Object3D[];
  frontWheelPivots: THREE.Object3D[];
  brakeLightMat: THREE.MeshStandardMaterial;
  nitroFlames: THREE.Mesh[];
  headlightBeams: THREE.Mesh[];
  paintMaterial: THREE.MeshPhysicalMaterial;
  setColor: (hex: string) => void;
  setBraking: (braking: boolean) => void;
  setNitro: (active: boolean, time: number) => void;
  setNightLights: (enabled: boolean) => void;
}

function createCarWheel(radius: number, width: number, rimColor: number): THREE.Group {
  const wheel = new THREE.Group();

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.86,
    metalness: 0.05,
  });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheel.add(tire);

  // Alloy rim hub
  const rimGeo = new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width + 0.02, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: 0.22,
    metalness: 0.88,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheel.add(rim);

  // Spokes cross for visible rotation
  const spokeGeo = new THREE.BoxGeometry(width + 0.035, radius * 1.12, 0.055);
  const spokeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.9,
  });
  const spoke1 = new THREE.Mesh(spokeGeo, spokeMat);
  const spoke2 = new THREE.Mesh(spokeGeo, spokeMat);
  spoke2.rotation.x = Math.PI / 3;
  const spoke3 = new THREE.Mesh(spokeGeo, spokeMat);
  spoke3.rotation.x = -Math.PI / 3;
  wheel.add(spoke1, spoke2, spoke3);

  return wheel;
}

function buildSportsCar(
  vehicle: VehicleDefinition,
  colorHex: string,
  contactShadowTex: THREE.Texture
): VehicleVisualRig {
  const root = new THREE.Group();
  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  const isHyper = vehicle.id === 'titan';
  const isAero = vehicle.id === 'kestrel';

  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    metalness: 0.62,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x181b22,
    roughness: 0.45,
    metalness: 0.35,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1220,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.16,
    metalness: 0.95,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  // Grounded contact shadow at y = 0.02
  const shadowGeo = new THREE.PlaneGeometry(2.55, 5.1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  // 1. Primary Silhouette: Extruded beveled side profile along X, centered
  const halfWidth = isHyper ? 0.96 : 0.9;
  const profile = new THREE.Shape();
  // Side profile in (z, y) coordinates where -z is forward (-Z forward in Three.js)
  if (isHyper) {
    profile.moveTo(-2.35, 0.22);
    profile.lineTo(-2.38, 0.46);
    profile.lineTo(-1.35, 0.68);
    profile.lineTo(-0.55, 1.06);
    profile.lineTo(0.72, 1.08);
    profile.lineTo(1.75, 0.82);
    profile.lineTo(2.25, 0.74);
    profile.lineTo(2.28, 0.28);
    profile.lineTo(-2.35, 0.22);
  } else if (isAero) {
    profile.moveTo(-2.25, 0.22);
    profile.lineTo(-2.22, 0.52);
    profile.lineTo(-1.25, 0.72);
    profile.lineTo(-0.42, 1.12);
    profile.lineTo(0.82, 1.12);
    profile.lineTo(1.88, 0.82);
    profile.lineTo(2.2, 0.72);
    profile.lineTo(2.18, 0.26);
    profile.lineTo(-2.25, 0.22);
  } else {
    profile.moveTo(-2.18, 0.24);
    profile.lineTo(-2.15, 0.56);
    profile.lineTo(-1.18, 0.78);
    profile.lineTo(-0.38, 1.18);
    profile.lineTo(0.75, 1.18);
    profile.lineTo(1.72, 0.86);
    profile.lineTo(2.12, 0.78);
    profile.lineTo(2.1, 0.28);
    profile.lineTo(-2.18, 0.24);
  }

  const bodyGeo = new THREE.ExtrudeGeometry(profile, {
    depth: halfWidth * 2 - 0.14,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 3,
  });
  // Extrude is along +Z in shape space -> rotate so shape X maps to -Z or +Z, extrude depth along X
  bodyGeo.translate(0, 0, -(halfWidth - 0.07));
  bodyGeo.rotateY(-Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  leanGroup.add(bodyMesh);

  // 2. Carbon Fiber Front Splitter & Side Skirts & Rear Diffuser
  const skirtGeo = new THREE.BoxGeometry(halfWidth * 2 + 0.06, 0.1, 4.45);
  const skirt = new THREE.Mesh(skirtGeo, carbonMat);
  skirt.position.set(0, 0.24, 0.02);
  skirt.castShadow = true;
  leanGroup.add(skirt);

  const splitterGeo = new THREE.BoxGeometry(halfWidth * 2 + 0.12, 0.06, 0.55);
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.21, -2.22);
  leanGroup.add(splitter);

  // 3. Tinted Glass Cabin Canopy
  const cabinGeo = new THREE.BoxGeometry(halfWidth * 1.44, 0.36, 1.82);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, isHyper ? 0.96 : 1.03, 0.1);
  leanGroup.add(cabin);

  // Windshield slant wedge
  const shieldGeo = new THREE.BoxGeometry(halfWidth * 1.4, 0.08, 0.92);
  const shield = new THREE.Mesh(shieldGeo, glassMat);
  shield.position.set(0, isHyper ? 0.87 : 0.92, -0.82);
  shield.rotation.x = 0.42;
  leanGroup.add(shield);

  // 4. Rear GT Wing / Spoiler (pylons + wing blade)
  const wingY = isHyper ? 1.06 : isAero ? 1.18 : 1.04;
  const wingBladeGeo = new THREE.BoxGeometry(halfWidth * 2 + 0.16, 0.06, 0.34);
  const wingBlade = new THREE.Mesh(wingBladeGeo, isAero || isHyper ? carbonMat : paintMaterial);
  wingBlade.position.set(0, wingY, 2.02);
  wingBlade.rotation.x = -0.1;
  wingBlade.castShadow = true;
  leanGroup.add(wingBlade);

  const pylonGeo = new THREE.BoxGeometry(0.06, 0.28, 0.22);
  const pylonL = new THREE.Mesh(pylonGeo, carbonMat);
  pylonL.position.set(-0.48, wingY - 0.14, 2.02);
  const pylonR = new THREE.Mesh(pylonGeo, carbonMat);
  pylonR.position.set(0.48, wingY - 0.14, 2.02);
  leanGroup.add(pylonL, pylonR);

  // Wing endplates
  const endplateGeo = new THREE.BoxGeometry(0.04, 0.18, 0.4);
  const endL = new THREE.Mesh(endplateGeo, paintMaterial);
  endL.position.set(-(halfWidth + 0.08), wingY, 2.02);
  const endR = new THREE.Mesh(endplateGeo, paintMaterial);
  endR.position.set(halfWidth + 0.08, wingY, 2.02);
  leanGroup.add(endL, endR);

  // 5. Headlights & Taillights
  const hlGeo = new THREE.BoxGeometry(0.38, 0.1, 0.12);
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-0.62, 0.52, -2.22);
  const hlR = new THREE.Mesh(hlGeo, headlightMat);
  hlR.position.set(0.62, 0.52, -2.22);
  leanGroup.add(hlL, hlR);

  const tlGeo = new THREE.BoxGeometry(0.48, 0.09, 0.08);
  const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
  tlL.position.set(-0.58, 0.64, 2.18);
  const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
  tlR.position.set(0.58, 0.64, 2.18);
  const tlCenter = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.07), brakeLightMat);
  tlCenter.position.set(0, 0.64, 2.18);
  leanGroup.add(tlL, tlR, tlCenter);

  // 6. Twin Exhaust Tips + Nitro Flame Cones
  const exGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.22, 12);
  exGeo.rotateX(Math.PI / 2);
  const exL = new THREE.Mesh(exGeo, chromeMat);
  exL.position.set(-0.34, 0.34, 2.22);
  const exR = new THREE.Mesh(exGeo, chromeMat);
  exR.position.set(0.34, 0.34, 2.22);
  leanGroup.add(exL, exR);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameGeo = new THREE.ConeGeometry(0.11, 0.95, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.48);
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.34, 0.34, 2.26);
  flameL.visible = false;
  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.34, 0.34, 2.26);
  flameR.visible = false;
  leanGroup.add(flameL, flameR);

  // 7. Night Headlight Beams (translucent additive road glow cones)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamGeo = new THREE.ConeGeometry(2.1, 14, 16, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, -7);
  const beamL = new THREE.Mesh(beamGeo, beamMat);
  beamL.position.set(-0.62, 0.45, -2.25);
  beamL.visible = false;
  const beamR = new THREE.Mesh(beamGeo, beamMat);
  beamR.position.set(0.62, 0.45, -2.25);
  beamR.visible = false;
  leanGroup.add(beamL, beamR);

  // 8. Four Wheels with Front Steering Pivots (bottom of tire touches y = 0)
  const wheelRadius = 0.36;
  const wheelWidth = 0.28;
  const wheelX = halfWidth + 0.04;
  const rimTint = isHyper ? 0xfbbf24 : 0x94a3b8;

  const frontPivotL = new THREE.Group();
  frontPivotL.position.set(-wheelX, wheelRadius, -1.42);
  const wFL = createCarWheel(wheelRadius, wheelWidth, rimTint);
  frontPivotL.add(wFL);

  const frontPivotR = new THREE.Group();
  frontPivotR.position.set(wheelX, wheelRadius, -1.42);
  const wFR = createCarWheel(wheelRadius, wheelWidth, rimTint);
  frontPivotR.add(wFR);

  const wRL = createCarWheel(wheelRadius * 1.04, wheelWidth * 1.12, rimTint);
  wRL.position.set(-wheelX, wheelRadius * 1.04, 1.38);

  const wRR = createCarWheel(wheelRadius * 1.04, wheelWidth * 1.12, rimTint);
  wRR.position.set(wheelX, wheelRadius * 1.04, 1.38);

  root.add(frontPivotL, frontPivotR, wRL, wRR);

  return {
    root,
    leanGroup,
    wheels: [wFL, wFR, wRL, wRR],
    frontWheelPivots: [frontPivotL, frontPivotR],
    brakeLightMat,
    nitroFlames: [flameL, flameR],
    headlightBeams: [beamL, beamR],
    paintMaterial,
    setColor: (hex: string) => paintMaterial.color.set(hex),
    setBraking: (braking: boolean) => {
      brakeLightMat.emissiveIntensity = braking ? 3.2 : 0.85;
    },
    setNitro: (active: boolean, time: number) => {
      const flicker = 0.85 + Math.sin(time * 42) * 0.25;
      flameL.visible = active;
      flameR.visible = active;
      if (active) {
        flameL.scale.set(1, 1, flicker);
        flameR.scale.set(1, 1, flicker);
      }
    },
    setNightLights: (enabled: boolean) => {
      beamL.visible = enabled;
      beamR.visible = enabled;
      headlightMat.emissiveIntensity = enabled ? 3.0 : 1.4;
    },
  };
}

function buildMotorcycle(
  vehicle: VehicleDefinition,
  colorHex: string,
  contactShadowTex: THREE.Texture
): VehicleVisualRig {
  const root = new THREE.Group();
  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  const isGP = vehicle.id === 'phantom';

  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    metalness: 0.65,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x161922,
    roughness: 0.42,
    metalness: 0.4,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.94,
  });

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.1,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    roughness: 0.05,
    metalness: 0.3,
    clearcoat: 1.0,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.6,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.9,
  });

  // Grounded contact shadow
  const shadowGeo = new THREE.PlaneGeometry(1.15, 2.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  // 1. Fairing + Tank + Tail Cowl silhouette (Extruded)
  const bikeShape = new THREE.Shape();
  bikeShape.moveTo(-1.02, 0.56);
  bikeShape.lineTo(-0.78, 0.96);
  bikeShape.lineTo(-0.28, 1.04);
  bikeShape.lineTo(0.18, 0.84);
  bikeShape.lineTo(0.75, 0.98);
  bikeShape.lineTo(1.04, 0.92);
  bikeShape.lineTo(0.66, 0.55);
  bikeShape.lineTo(0.18, 0.36);
  bikeShape.lineTo(-0.55, 0.36);
  bikeShape.lineTo(-1.02, 0.56);

  const fairingGeo = new THREE.ExtrudeGeometry(bikeShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  fairingGeo.translate(0, 0, -0.21);
  fairingGeo.rotateY(-Math.PI / 2);
  const fairing = new THREE.Mesh(fairingGeo, paintMaterial);
  fairing.castShadow = true;
  leanGroup.add(fairing);

  // Lower engine belly pan
  const engineGeo = new THREE.BoxGeometry(0.36, 0.34, 0.72);
  const engineBlock = new THREE.Mesh(engineGeo, carbonMat);
  engineBlock.position.set(0, 0.42, -0.05);
  leanGroup.add(engineBlock);

  // Windscreen
  const screenGeo = new THREE.BoxGeometry(0.34, 0.24, 0.38);
  const screen = new THREE.Mesh(screenGeo, visorMat);
  screen.position.set(0, 1.04, -0.68);
  screen.rotation.x = 0.55;
  leanGroup.add(screen);

  // Front Steering Fork + Handlebars
  const frontPivot = new THREE.Group();
  frontPivot.position.set(0, 0.34, -0.82);

  const forkGeo = new THREE.CylinderGeometry(0.032, 0.028, 0.72, 10);
  const forkL = new THREE.Mesh(forkGeo, chromeMat);
  forkL.position.set(-0.13, 0.3, 0.08);
  forkL.rotation.x = -0.35;
  const forkR = new THREE.Mesh(forkGeo, chromeMat);
  forkR.position.set(0.13, 0.3, 0.08);
  forkR.rotation.x = -0.35;

  const barGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.68, 8);
  barGeo.rotateZ(Math.PI / 2);
  const handlebars = new THREE.Mesh(barGeo, carbonMat);
  handlebars.position.set(0, 0.62, 0.22);

  const wFront = createCarWheel(0.34, 0.16, isGP ? 0x22d3ee : 0x94a3b8);
  frontPivot.add(forkL, forkR, handlebars, wFront);
  leanGroup.add(frontPivot);

  // Rear Tire & Swingarm
  const wRear = createCarWheel(0.35, 0.22, isGP ? 0x22d3ee : 0x94a3b8);
  wRear.position.set(0, 0.35, 0.84);
  leanGroup.add(wRear);

  const swingGeo = new THREE.BoxGeometry(0.32, 0.09, 0.72);
  const swing = new THREE.Mesh(swingGeo, chromeMat);
  swing.position.set(0, 0.36, 0.5);
  leanGroup.add(swing);

  // Exhaust Pipe & Nitro Flame
  const exGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.52, 10);
  exGeo.rotateX(Math.PI / 2);
  const exhaust = new THREE.Mesh(exGeo, chromeMat);
  exhaust.position.set(0.22, 0.44, 0.68);
  exhaust.rotation.x = 0.2;
  leanGroup.add(exhaust);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameGeo = new THREE.ConeGeometry(0.09, 0.85, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.42);
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0.22, 0.5, 0.95);
  flame.visible = false;
  leanGroup.add(flame);

  // Crouched Aero Rider (Torso, Arms, Helmet, Visor)
  const torsoGeo = new THREE.CapsuleGeometry(0.18, 0.42, 6, 12);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.set(0, 1.14, 0.12);
  torso.rotation.x = 0.95;
  torso.castShadow = true;
  leanGroup.add(torso);

  const suitAccentGeo = new THREE.BoxGeometry(0.34, 0.14, 0.4);
  const suitAccent = new THREE.Mesh(suitAccentGeo, paintMaterial);
  suitAccent.position.set(0, 1.24, 0.12);
  suitAccent.rotation.x = 0.95;
  leanGroup.add(suitAccent);

  const helmetGeo = new THREE.SphereGeometry(0.165, 16, 14);
  const helmet = new THREE.Mesh(helmetGeo, paintMaterial);
  helmet.position.set(0, 1.38, -0.22);
  helmet.castShadow = true;
  leanGroup.add(helmet);

  const visorGeo = new THREE.BoxGeometry(0.24, 0.1, 0.18);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 1.37, -0.31);
  leanGroup.add(visor);

  // Headlight & Brake Tail Strip
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.08), headlightMat);
  hl.position.set(0, 0.72, -1.0);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.08), brakeLightMat);
  tl.position.set(0, 0.92, 1.02);
  leanGroup.add(hl, tl);

  // Night Headlight Beam
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamGeo = new THREE.ConeGeometry(2.0, 14, 16, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, -7);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, 0.65, -1.04);
  beam.visible = false;
  leanGroup.add(beam);

  return {
    root,
    leanGroup,
    wheels: [wFront, wRear],
    frontWheelPivots: [frontPivot],
    brakeLightMat,
    nitroFlames: [flame],
    headlightBeams: [beam],
    paintMaterial,
    setColor: (hex: string) => paintMaterial.color.set(hex),
    setBraking: (braking: boolean) => {
      brakeLightMat.emissiveIntensity = braking ? 3.2 : 0.9;
    },
    setNitro: (active: boolean, time: number) => {
      flame.visible = active;
      if (active) {
        flame.scale.set(1, 1, 0.85 + Math.sin(time * 44) * 0.25);
      }
    },
    setNightLights: (enabled: boolean) => {
      beam.visible = enabled;
      headlightMat.emissiveIntensity = enabled ? 3.2 : 1.6;
    },
  };
}

export function createVehicleVisualRig(
  vehicle: VehicleDefinition,
  colorHex: string,
  contactShadowTex: THREE.Texture
): VehicleVisualRig {
  if (vehicle.type === 'bike') {
    return buildMotorcycle(vehicle, colorHex, contactShadowTex);
  }
  return buildSportsCar(vehicle, colorHex, contactShadowTex);
}
