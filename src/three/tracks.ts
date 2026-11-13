import * as THREE from 'three';
import { TRACKS, TrackId, WeatherType } from '../types/game';
import { ProceduralTexturePack } from './textures';

export interface TrackSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  heading: number; // atan2(tangent.x, tangent.z)
}

export interface BuiltTrack {
  id: TrackId;
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  totalLength: number;
  roadHalfWidth: number;
  samples: TrackSample[];
  minimapPoints: Array<{ x: number; y: number }>;
  countdownLights: THREE.MeshStandardMaterial[];
  checkpointMats: THREE.MeshStandardMaterial[];
  sampleAt: (s: number, outPoint: THREE.Vector3, outTangent: THREE.Vector3, outRight: THREE.Vector3) => void;
  dispose: () => void;
}

const SAMPLE_COUNT = 480;

function getControlPoints(trackId: TrackId): THREE.Vector3[] {
  switch (trackId) {
    case 'city':
      return [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -140),
        new THREE.Vector3(65, 0, -230),
        new THREE.Vector3(175, 0, -235),
        new THREE.Vector3(245, 0, -155),
        new THREE.Vector3(210, 0, -60),
        new THREE.Vector3(135, 0, -20),
        new THREE.Vector3(165, 0, 75),
        new THREE.Vector3(245, 0, 145),
        new THREE.Vector3(185, 0, 230),
        new THREE.Vector3(70, 0, 215),
        new THREE.Vector3(10, 0, 130),
      ];
    case 'highway':
      return [
        new THREE.Vector3(0, 2, 0),
        new THREE.Vector3(0, 2, -190),
        new THREE.Vector3(85, 5, -310),
        new THREE.Vector3(235, 7, -305),
        new THREE.Vector3(315, 4, -185),
        new THREE.Vector3(285, 2, -25),
        new THREE.Vector3(270, 5, 145),
        new THREE.Vector3(175, 6, 255),
        new THREE.Vector3(45, 3, 215),
        new THREE.Vector3(-5, 2, 115),
      ];
    case 'desert':
      return [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-15, 0, -145),
        new THREE.Vector3(55, 2.5, -245),
        new THREE.Vector3(165, 4, -225),
        new THREE.Vector3(185, 1.5, -110),
        new THREE.Vector3(105, 0, -40),
        new THREE.Vector3(195, 2, 65),
        new THREE.Vector3(250, 3.5, 180),
        new THREE.Vector3(145, 1, 250),
        new THREE.Vector3(35, 0, 185),
        new THREE.Vector3(5, 0, 95),
      ];
    case 'mountain':
    default:
      return [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 3, -135),
        new THREE.Vector3(75, 12, -235),
        new THREE.Vector3(195, 19, -245),
        new THREE.Vector3(260, 14, -140),
        new THREE.Vector3(175, 8, -70),
        new THREE.Vector3(245, 13, 35),
        new THREE.Vector3(225, 16, 155),
        new THREE.Vector3(115, 9, 225),
        new THREE.Vector3(25, 3, 155),
        new THREE.Vector3(0, 0, 75),
      ];
  }
}

export function buildTrack(
  trackId: TrackId,
  weather: WeatherType,
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean
): BuiltTrack {
  const def = TRACKS.find((t) => t.id === trackId) || TRACKS[0];
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const points = getControlPoints(trackId);
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.45);
  const totalLength = curve.getLength();
  const roadHalfWidth = def.roadWidth * 0.5;

  // Precompute dense lookup samples
  const samples: TrackSample[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const s = i / SAMPLE_COUNT;
    const pt = curve.getPointAt(s);
    const tan = curve.getTangentAt(s).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const heading = Math.atan2(-tan.x, -tan.z); // -Z forward convention
    samples.push({ point: pt, tangent: tan, right, heading });
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }

  // Normalized minimap polyline (64 points)
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const padX = (span - (maxX - minX)) * 0.5;
  const padZ = (span - (maxZ - minZ)) * 0.5;
  const minimapPoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 72; i++) {
    const idx = Math.floor((i / 72) * SAMPLE_COUNT) % SAMPLE_COUNT;
    const p = samples[idx].point;
    minimapPoints.push({
      x: (p.x - minX + padX) / span,
      y: (p.z - minZ + padZ) / span,
    });
  }

  // Build Road Ribbon, Curbs & Guardrail Geometry
  const segs = SAMPLE_COUNT;
  const roadPositions: number[] = [];
  const roadNormals: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const curbPositions: number[] = [];
  const curbNormals: number[] = [];
  const curbUvs: number[] = [];
  const curbIndices: number[] = [];

  const railPositions: number[] = [];
  const railNormals: number[] = [];
  const railIndices: number[] = [];

  const curbWidth = 1.15;
  const railOffset = roadHalfWidth + curbWidth + 0.55;
  const roadTileScale = totalLength / 18;
  const curbTileScale = totalLength / 7;

  for (let i = 0; i <= segs; i++) {
    const idx = i % SAMPLE_COUNT;
    const smp = samples[idx];
    const vCoord = (i / segs) * roadTileScale;
    const cCoord = (i / segs) * curbTileScale;

    const pL = smp.point.clone().addScaledVector(smp.right, -roadHalfWidth);
    const pR = smp.point.clone().addScaledVector(smp.right, roadHalfWidth);

    // Road vertices
    roadPositions.push(pL.x, pL.y + 0.04, pL.z, pR.x, pR.y + 0.04, pR.z);
    roadNormals.push(0, 1, 0, 0, 1, 0);
    roadUvs.push(0, vCoord, 1, vCoord);

    // Left + Right Curb vertices (4 verts per row)
    const cLL = smp.point.clone().addScaledVector(smp.right, -(roadHalfWidth + curbWidth));
    const cLR = pL;
    const cRL = pR;
    const cRR = smp.point.clone().addScaledVector(smp.right, roadHalfWidth + curbWidth);
    curbPositions.push(
      cLL.x, cLL.y + 0.055, cLL.z,
      cLR.x, cLR.y + 0.045, cLR.z,
      cRL.x, cRL.y + 0.045, cRL.z,
      cRR.x, cRR.y + 0.055, cRR.z
    );
    curbNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    curbUvs.push(0, cCoord, 1, cCoord, 0, cCoord, 1, cCoord);

    // Guardrails (vertical barrier strips on both edges)
    const gL = smp.point.clone().addScaledVector(smp.right, -railOffset);
    const gR = smp.point.clone().addScaledVector(smp.right, railOffset);
    railPositions.push(
      gL.x, gL.y + 0.0, gL.z,
      gL.x, gL.y + 0.85, gL.z,
      gR.x, gR.y + 0.0, gR.z,
      gR.x, gR.y + 0.85, gR.z
    );
    railNormals.push(
      smp.right.x, 0, smp.right.z,
      smp.right.x, 0, smp.right.z,
      -smp.right.x, 0, -smp.right.z,
      -smp.right.x, 0, -smp.right.z
    );

    if (i < segs) {
      const rBase = i * 2;
      roadIndices.push(rBase, rBase + 1, rBase + 2, rBase + 1, rBase + 3, rBase + 2);

      const cBase = i * 4;
      curbIndices.push(
        cBase, cBase + 1, cBase + 4, cBase + 1, cBase + 5, cBase + 4,
        cBase + 2, cBase + 3, cBase + 6, cBase + 3, cBase + 7, cBase + 6
      );

      const gBase = i * 4;
      railIndices.push(
        gBase, gBase + 1, gBase + 4, gBase + 1, gBase + 5, gBase + 4,
        gBase + 2, gBase + 6, gBase + 3, gBase + 3, gBase + 6, gBase + 7
      );
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const isRainy = weather === 'rainy';
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: isRainy ? 0.18 : 0.78,
    metalness: isRainy ? 0.35 : 0.08,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  disposables.push(roadGeo, roadMat);

  // Curbs
  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
  curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNormals, 3));
  curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
  curbGeo.setIndex(curbIndices);
  const curbMat = new THREE.MeshStandardMaterial({
    map: textures.curb,
    roughness: 0.65,
    metalness: 0.1,
  });
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.receiveShadow = true;
  group.add(curbMesh);
  disposables.push(curbGeo, curbMat);

  // Guardrails
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
  railGeo.setAttribute('normal', new THREE.Float32BufferAttribute(railNormals, 3));
  railGeo.setIndex(railIndices);
  const railMat = new THREE.MeshStandardMaterial({
    color: trackId === 'city' ? 0x1e293b : trackId === 'desert' ? 0x9a3412 : 0x64748b,
    roughness: 0.38,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });
  const railMesh = new THREE.Mesh(railGeo, railMat);
  railMesh.castShadow = !isSoftwareGl;
  railMesh.receiveShadow = true;
  group.add(railMesh);
  disposables.push(railGeo, railMat);

  // Extended Ground Plane (no floating rectangular void!)
  const groundColor =
    trackId === 'city'
      ? 0x111827
      : trackId === 'highway'
        ? 0x1e293b
        : trackId === 'desert'
          ? 0xb45309
          : 0x1f3a2e;
  const groundGeo = new THREE.PlaneGeometry(2400, 2400);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: groundColor,
    roughness: 0.94,
    metalness: 0.04,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set((minX + maxX) * 0.5, -0.35, (minZ + maxZ) * 0.5);
  ground.receiveShadow = true;
  group.add(ground);
  disposables.push(groundGeo, groundMat);

  // Start/Finish Line Strip + Overhead Gantry with Countdown Lights
  const startSmp = samples[0];
  const finishGroup = new THREE.Group();
  finishGroup.position.copy(startSmp.point);
  finishGroup.rotation.y = startSmp.heading;

  const stripGeo = new THREE.PlaneGeometry(def.roadWidth, 3.2);
  stripGeo.rotateX(-Math.PI / 2);
  const stripMat = new THREE.MeshStandardMaterial({
    map: textures.checker,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.position.y = 0.075;
  strip.receiveShadow = true;
  finishGroup.add(strip);
  disposables.push(stripGeo, stripMat);

  // Gantry Pillars + Header Beam
  const gantryMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.8,
  });
  const pillarGeo = new THREE.BoxGeometry(0.9, 7.2, 0.9);
  const pillarL = new THREE.Mesh(pillarGeo, gantryMat);
  pillarL.position.set(-(roadHalfWidth + 1.2), 3.6, 0);
  const pillarR = new THREE.Mesh(pillarGeo, gantryMat);
  pillarR.position.set(roadHalfWidth + 1.2, 3.6, 0);
  const beamGeo = new THREE.BoxGeometry(def.roadWidth + 3.4, 1.4, 1.1);
  const headerBeam = new THREE.Mesh(beamGeo, gantryMat);
  headerBeam.position.set(0, 6.8, 0);
  const bannerGeo = new THREE.PlaneGeometry(def.roadWidth + 1.4, 1.0);
  const bannerMat = new THREE.MeshStandardMaterial({
    map: textures.checker,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const bannerFront = new THREE.Mesh(bannerGeo, bannerMat);
  bannerFront.position.set(0, 6.8, 0.57);
  const bannerBack = new THREE.Mesh(bannerGeo, bannerMat);
  bannerBack.position.set(0, 6.8, -0.57);
  finishGroup.add(pillarL, pillarR, headerBeam, bannerFront, bannerBack);
  disposables.push(gantryMat, pillarGeo, beamGeo, bannerGeo, bannerMat);

  // 4 Countdown Lights on the Gantry
  const countdownLights: THREE.MeshStandardMaterial[] = [];
  const lightGeo = new THREE.SphereGeometry(0.28, 12, 12);
  disposables.push(lightGeo);
  for (let i = 0; i < 4; i++) {
    const lMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xef4444,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    const bulb = new THREE.Mesh(lightGeo, lMat);
    bulb.position.set(-2.4 + i * 1.6, 5.75, 0.45);
    finishGroup.add(bulb);
    countdownLights.push(lMat);
    disposables.push(lMat);
  }
  group.add(finishGroup);

  // 4 Visible Checkpoint Arches (at s = 0.2, 0.4, 0.6, 0.8)
  const checkpointMats: THREE.MeshStandardMaterial[] = [];
  const cpFractions = [0.2, 0.4, 0.6, 0.8];
  const cpPillarGeo = new THREE.BoxGeometry(0.45, 5.4, 0.45);
  const cpTopGeo = new THREE.BoxGeometry(def.roadWidth + 1.8, 0.42, 0.55);
  disposables.push(cpPillarGeo, cpTopGeo);

  cpFractions.forEach((frac) => {
    const idx = Math.floor(frac * SAMPLE_COUNT) % SAMPLE_COUNT;
    const smp = samples[idx];
    const cpGroup = new THREE.Group();
    cpGroup.position.copy(smp.point);
    cpGroup.rotation.y = smp.heading;

    const cpMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.2,
      roughness: 0.25,
    });
    checkpointMats.push(cpMat);
    disposables.push(cpMat);

    const pL = new THREE.Mesh(cpPillarGeo, cpMat);
    pL.position.set(-(roadHalfWidth + 0.8), 2.7, 0);
    const pR = new THREE.Mesh(cpPillarGeo, cpMat);
    pR.position.set(roadHalfWidth + 0.8, 2.7, 0);
    const top = new THREE.Mesh(cpTopGeo, cpMat);
    top.position.set(0, 5.4, 0);
    cpGroup.add(pL, pR, top);
    group.add(cpGroup);
  });

  // Track-specific InstancedMesh Scenery (Trees, Skyscrapers, Mesas, Pylons, Streetlamps)
  buildTrackScenery(trackId, weather, samples, roadHalfWidth, group, textures, disposables);

  const outSampleTmp = new THREE.Vector3();
  const sampleAt = (
    s: number,
    outPoint: THREE.Vector3,
    outTangent: THREE.Vector3,
    outRight: THREE.Vector3
  ) => {
    const wrapped = ((s % 1) + 1) % 1;
    const fIdx = wrapped * SAMPLE_COUNT;
    const i0 = Math.floor(fIdx) % SAMPLE_COUNT;
    const i1 = (i0 + 1) % SAMPLE_COUNT;
    const alpha = fIdx - Math.floor(fIdx);

    const s0 = samples[i0];
    const s1 = samples[i1];
    outPoint.lerpVectors(s0.point, s1.point, alpha);
    outTangent.lerpVectors(s0.tangent, s1.tangent, alpha).normalize();
    outRight.lerpVectors(s0.right, s1.right, alpha).normalize();
    void outSampleTmp;
  };

  return {
    id: trackId,
    group,
    curve,
    totalLength,
    roadHalfWidth,
    samples,
    minimapPoints,
    countdownLights,
    checkpointMats,
    sampleAt,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

function buildTrackScenery(
  trackId: TrackId,
  weather: WeatherType,
  samples: TrackSample[],
  roadHalfWidth: number,
  group: THREE.Group,
  textures: ProceduralTexturePack,
  disposables: Array<{ dispose: () => void }>
) {
  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();

  // Helper to check minimum distance from any track sample so scenery never blocks the road
  const isClearOfTrack = (x: number, z: number, minDist: number): boolean => {
    const minSq = minDist * minDist;
    for (let i = 0; i < samples.length; i += 4) {
      const dx = x - samples[i].point.x;
      const dz = z - samples[i].point.z;
      if (dx * dx + dz * dz < minSq) return false;
    }
    return true;
  };

  // Streetlamps along track edges (City, Highway, and Night mode)
  if (trackId === 'city' || trackId === 'highway' || weather === 'night') {
    const poleCount = 48;
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.35 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, poleCount);

    const bulbGeo = new THREE.BoxGeometry(0.9, 0.18, 0.35);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: trackId === 'city' ? 0x38bdf8 : 0xfde68a,
      emissiveIntensity: weather === 'night' ? 2.8 : 0.8,
    });
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, poleCount);

    for (let i = 0; i < poleCount; i++) {
      const sIdx = Math.floor((i / poleCount) * samples.length);
      const smp = samples[sIdx];
      const side = i % 2 === 0 ? -1 : 1;
      const dist = roadHalfWidth + 2.5;
      const px = smp.point.x + smp.right.x * side * dist;
      const pz = smp.point.z + smp.right.z * side * dist;

      dummy.position.set(px, smp.point.y + 3.1, pz);
      dummy.rotation.set(0, smp.heading, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);

      dummy.position.set(
        px - smp.right.x * side * 0.65,
        smp.point.y + 6.1,
        pz - smp.right.z * side * 0.65
      );
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
    }
    poles.computeBoundingSphere();
    bulbs.computeBoundingSphere();
    group.add(poles, bulbs);
    disposables.push(poleGeo, poleMat, bulbGeo, bulbMat);
  }

  if (trackId === 'city') {
    const bCount = 85;
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const bMat = new THREE.MeshStandardMaterial({
      map: weather === 'night' ? textures.facadeNight : textures.facadeDay,
      roughness: 0.45,
      metalness: 0.3,
    });
    const buildings = new THREE.InstancedMesh(bGeo, bMat, bCount);
    let placed = 0;
    let attempts = 0;
    while (placed < bCount && attempts < 600) {
      attempts++;
      const smp = samples[Math.floor(Math.random() * samples.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = roadHalfWidth + 16 + Math.random() * 58;
      const bx = smp.point.x + smp.right.x * side * offset;
      const bz = smp.point.z + smp.right.z * side * offset;
      if (!isClearOfTrack(bx, bz, roadHalfWidth + 11)) continue;

      const w = 10 + Math.random() * 14;
      const d = 10 + Math.random() * 14;
      const h = 22 + Math.random() * 64;
      dummy.position.set(bx, h * 0.5 - 0.35, bz);
      dummy.rotation.set(0, smp.heading, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      buildings.setMatrixAt(placed, dummy.matrix);
      colorTmp.setHSL(0.58 + Math.random() * 0.08, 0.25, weather === 'night' ? 0.65 : 0.85);
      buildings.setColorAt(placed, colorTmp);
      placed++;
    }
    buildings.count = placed;
    buildings.computeBoundingSphere();
    group.add(buildings);
    disposables.push(bGeo, bMat);
  } else if (trackId === 'highway') {
    // Support Pylons beneath elevated highway + outer solar/modern towers
    const pylonCount = 48;
    const pGeo = new THREE.CylinderGeometry(1.1, 1.4, 8, 12);
    const pMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
    const pylons = new THREE.InstancedMesh(pGeo, pMat, pylonCount);
    for (let i = 0; i < pylonCount; i++) {
      const smp = samples[Math.floor((i / pylonCount) * samples.length)];
      dummy.position.set(smp.point.x, smp.point.y - 4.0, smp.point.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pylons.setMatrixAt(i, dummy.matrix);
    }
    pylons.computeBoundingSphere();
    group.add(pylons);
    disposables.push(pGeo, pMat);

    const towerCount = 55;
    const tGeo = new THREE.BoxGeometry(1, 1, 1);
    const tMat = new THREE.MeshStandardMaterial({
      map: weather === 'night' ? textures.facadeNight : textures.facadeDay,
      roughness: 0.4,
    });
    const towers = new THREE.InstancedMesh(tGeo, tMat, towerCount);
    let placed = 0;
    let attempts = 0;
    while (placed < towerCount && attempts < 500) {
      attempts++;
      const smp = samples[Math.floor(Math.random() * samples.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = roadHalfWidth + 24 + Math.random() * 70;
      const x = smp.point.x + smp.right.x * side * offset;
      const z = smp.point.z + smp.right.z * side * offset;
      if (!isClearOfTrack(x, z, roadHalfWidth + 16)) continue;
      const h = 18 + Math.random() * 48;
      dummy.position.set(x, h * 0.5 - 0.35, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.set(12 + Math.random() * 12, h, 12 + Math.random() * 12);
      dummy.updateMatrix();
      towers.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    towers.count = placed;
    towers.computeBoundingSphere();
    group.add(towers);
    disposables.push(tGeo, tMat);
  } else if (trackId === 'desert') {
    // Sandstone Mesas + Saguaro Cacti
    const mesaCount = 55;
    const mesaGeo = new THREE.CylinderGeometry(0.65, 1.0, 1, 7);
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.92, flatShading: true });
    const mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, mesaCount);

    let placed = 0;
    let attempts = 0;
    while (placed < mesaCount && attempts < 500) {
      attempts++;
      const smp = samples[Math.floor(Math.random() * samples.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = roadHalfWidth + 20 + Math.random() * 85;
      const x = smp.point.x + smp.right.x * side * offset;
      const z = smp.point.z + smp.right.z * side * offset;
      if (!isClearOfTrack(x, z, roadHalfWidth + 15)) continue;

      const r = 8 + Math.random() * 18;
      const h = 10 + Math.random() * 28;
      dummy.position.set(x, h * 0.5 - 0.4, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.set(r, h, r * (0.7 + Math.random() * 0.6));
      dummy.updateMatrix();
      mesas.setMatrixAt(placed, dummy.matrix);
      colorTmp.setHSL(0.05 + Math.random() * 0.04, 0.72, 0.36 + Math.random() * 0.14);
      mesas.setColorAt(placed, colorTmp);
      placed++;
    }
    mesas.count = placed;
    mesas.computeBoundingSphere();
    group.add(mesas);
    disposables.push(mesaGeo, mesaMat);

    // Cacti
    const cCount = 90;
    const cGeo = new THREE.CapsuleGeometry(0.42, 2.8, 4, 8);
    const cMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const cacti = new THREE.InstancedMesh(cGeo, cMat, cCount);
    let cPlaced = 0;
    let cAttempts = 0;
    while (cPlaced < cCount && cAttempts < 500) {
      cAttempts++;
      const smp = samples[Math.floor(Math.random() * samples.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = roadHalfWidth + 6 + Math.random() * 36;
      const x = smp.point.x + smp.right.x * side * offset;
      const z = smp.point.z + smp.right.z * side * offset;
      if (!isClearOfTrack(x, z, roadHalfWidth + 4.5)) continue;
      const sc = 0.75 + Math.random() * 0.65;
      dummy.position.set(x, 1.4 * sc - 0.3, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      cacti.setMatrixAt(cPlaced, dummy.matrix);
      cPlaced++;
    }
    cacti.count = cPlaced;
    cacti.computeBoundingSphere();
    group.add(cacti);
    disposables.push(cGeo, cMat);
  } else {
    // Mountain Track: Alpine Pine Trees & Rock Peaks
    const treeCount = 130;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const crownGeo = new THREE.ConeGeometry(2.1, 6.2, 7);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85, flatShading: true });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);

    let placed = 0;
    let attempts = 0;
    while (placed < treeCount && attempts < 700) {
      attempts++;
      const smp = samples[Math.floor(Math.random() * samples.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = roadHalfWidth + 7 + Math.random() * 52;
      const x = smp.point.x + smp.right.x * side * offset;
      const z = smp.point.z + smp.right.z * side * offset;
      if (!isClearOfTrack(x, z, roadHalfWidth + 5)) continue;

      const sc = 0.75 + Math.random() * 0.75;
      const baseY = Math.max(-0.3, smp.point.y - 1.5);
      dummy.position.set(x, baseY + 1.1 * sc, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(x, baseY + 4.4 * sc, z);
      dummy.updateMatrix();
      crowns.setMatrixAt(placed, dummy.matrix);
      colorTmp.setHSL(0.36 + Math.random() * 0.06, 0.55, 0.18 + Math.random() * 0.12);
      crowns.setColorAt(placed, colorTmp);
      placed++;
    }
    trunks.count = placed;
    crowns.count = placed;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    group.add(trunks, crowns);
    disposables.push(trunkGeo, trunkMat, crownGeo, crownMat);

    // Jagged Alpine Peaks
    const peakCount = 34;
    const peakGeo = new THREE.ConeGeometry(1, 1, 5);
    const peakMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, flatShading: true });
    const peaks = new THREE.InstancedMesh(peakGeo, peakMat, peakCount);
    let pPlaced = 0;
    let pAttempts = 0;
    while (pPlaced < peakCount && pAttempts < 400) {
      pAttempts++;
      const smp = samples[Math.floor(Math.random() * samples.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = roadHalfWidth + 42 + Math.random() * 90;
      const x = smp.point.x + smp.right.x * side * offset;
      const z = smp.point.z + smp.right.z * side * offset;
      if (!isClearOfTrack(x, z, roadHalfWidth + 28)) continue;
      const r = 18 + Math.random() * 24;
      const h = 38 + Math.random() * 55;
      dummy.position.set(x, h * 0.5 - 1, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.set(r, h, r);
      dummy.updateMatrix();
      peaks.setMatrixAt(pPlaced, dummy.matrix);
      pPlaced++;
    }
    peaks.count = pPlaced;
    peaks.computeBoundingSphere();
    group.add(peaks);
    disposables.push(peakGeo, peakMat);
  }
}
