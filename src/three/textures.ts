import * as THREE from 'three';

export interface ProceduralTexturePack {
  asphalt: THREE.CanvasTexture;
  curb: THREE.CanvasTexture;
  checker: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  particleGlow: THREE.CanvasTexture;
  facadeDay: THREE.CanvasTexture;
  facadeNight: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Road Asphalt with lane markings
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d')!;
  rCtx.fillStyle = '#232730';
  rCtx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 28 + Math.floor(Math.random() * 24);
    rCtx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    rCtx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear tracks
  rCtx.fillStyle = 'rgba(12, 14, 18, 0.25)';
  rCtx.fillRect(108, 0, 44, 512);
  rCtx.fillRect(360, 0, 44, 512);

  // Outer white solid shoulder stripes
  rCtx.fillStyle = '#e2e8f0';
  rCtx.fillRect(22, 0, 10, 512);
  rCtx.fillRect(480, 0, 10, 512);

  // Center dashed lane dividers (two lanes + center double yellow/white)
  rCtx.fillStyle = '#f8fafc';
  for (let y = 16; y < 512; y += 64) {
    rCtx.fillRect(172, y, 6, 34);
    rCtx.fillRect(334, y, 6, 34);
  }
  rCtx.fillStyle = '#fbbf24';
  for (let y = 8; y < 512; y += 64) {
    rCtx.fillRect(253, y, 6, 40);
  }

  const asphalt = new THREE.CanvasTexture(roadCanvas);
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.anisotropy = aniso;

  // 2. Racing Curb Rumble Strip
  const curbCanvas = document.createElement('canvas');
  curbCanvas.width = 128;
  curbCanvas.height = 256;
  const cCtx = curbCanvas.getContext('2d')!;
  for (let y = 0; y < 256; y += 64) {
    cCtx.fillStyle = (y / 64) % 2 === 0 ? '#ef4444' : '#f8fafc';
    cCtx.fillRect(0, y, 128, 64);
  }
  const curb = new THREE.CanvasTexture(curbCanvas);
  curb.colorSpace = THREE.SRGBColorSpace;
  curb.wrapS = THREE.RepeatWrapping;
  curb.wrapT = THREE.RepeatWrapping;
  curb.anisotropy = aniso;

  // 3. Checkered Finish Line
  const chkCanvas = document.createElement('canvas');
  chkCanvas.width = 512;
  chkCanvas.height = 128;
  const kCtx = chkCanvas.getContext('2d')!;
  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      const dark = ((x / sq) + (y / sq)) % 2 === 0;
      kCtx.fillStyle = dark ? '#0f172a' : '#f8fafc';
      kCtx.fillRect(x, y, sq, sq);
    }
  }
  const checker = new THREE.CanvasTexture(chkCanvas);
  checker.colorSpace = THREE.SRGBColorSpace;
  checker.wrapS = THREE.RepeatWrapping;
  checker.wrapT = THREE.RepeatWrapping;
  checker.anisotropy = aniso;

  // 4. Radial Contact Shadow
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 256;
  shCanvas.height = 256;
  const sCtx = shCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 16, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.36)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(shCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 5. Soft Particle Glow
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 128;
  pCanvas.height = 128;
  const pCtx = pCanvas.getContext('2d')!;
  const pGrad = pCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  pGrad.addColorStop(0, 'rgba(255,255,255,1)');
  pGrad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  pGrad.addColorStop(1, 'rgba(255,255,255,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 128, 128);
  const particleGlow = new THREE.CanvasTexture(pCanvas);
  particleGlow.colorSpace = THREE.SRGBColorSpace;

  // 6. Building Facades (Day & Night)
  const makeFacade = (night: boolean) => {
    const fCanvas = document.createElement('canvas');
    fCanvas.width = 256;
    fCanvas.height = 512;
    const fCtx = fCanvas.getContext('2d')!;
    fCtx.fillStyle = night ? '#0f172a' : '#334155';
    fCtx.fillRect(0, 0, 256, 512);
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 8; col++) {
        const lit = night ? Math.random() > 0.42 : Math.random() > 0.25;
        if (night) {
          fCtx.fillStyle = lit
            ? (Math.random() > 0.35 ? '#38bdf8' : '#fbbf24')
            : '#1e293b';
        } else {
          fCtx.fillStyle = lit ? '#93c5fd' : '#475569';
        }
        fCtx.fillRect(10 + col * 30, 8 + row * 15.5, 20, 10);
      }
    }
    const tex = new THREE.CanvasTexture(fCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = aniso;
    return tex;
  };

  const facadeDay = makeFacade(false);
  const facadeNight = makeFacade(true);

  return {
    asphalt,
    curb,
    checker,
    contactShadow,
    particleGlow,
    facadeDay,
    facadeNight,
    dispose: () => {
      asphalt.dispose();
      curb.dispose();
      checker.dispose();
      contactShadow.dispose();
      particleGlow.dispose();
      facadeDay.dispose();
      facadeNight.dispose();
    },
  };
}
