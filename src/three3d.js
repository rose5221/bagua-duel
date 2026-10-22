/* 八卦对决 · three.js 3D 版
   3D 圆桌 + 八卦盘 + 两位对手 + 3D 手牌/场上牌；规则复用 Engine。 */
import * as THREE from '../vendor/three.module.js';

const D = window.DATA, E = window.Engine, AI = window.AI;
const { ELEMENTS, TRIGRAMS, ROLES, CARDS, SKILLS, DIFFICULTY, FIELD_RULES, SEATS } = D;
const HUMAN = 0, FOE = 1;
const S = {
  g: null, sel: null, mode: null, extra: null, pending: null, preview: null,
  difficulty: 'normal', aiTimer: 0, hover: null, lastTerm: '', lastRound: 0, flash: '', flashTimer: 0,
  logSeen: 0, shake: 0, weather: '',
};

/* ---------- 音效：不依赖外部音频文件，首次点击后启动 ---------- */
const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null, started = false;
  function init() {
    if (started) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 山风：一层很低的滤波噪声，一直垫底
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 290; wf.Q.value = 0.8;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    wind.connect(wf).connect(wg).connect(master); wind.start();
    started = true;
  }
  function env(g, t, dur, vol) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, dur, vol, type = 'sine', to = null, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    env(g, t, dur, vol); o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, q = 1, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, dur, vol);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.03);
  }
  return {
    init,
    place() { tone(190, 0.14, 0.3, 'triangle', 92); noise(0.06, 0.16, 1300, 2); },
    hit() { tone(108, 0.2, 0.42, 'sine', 46); noise(0.1, 0.34, 1700, 0.8); tone(70, 0.16, 0.28, 'triangle', 40, 0.02); },
    kill() { tone(82, 1.3, 0.32, 'sine', 40); tone(123, 0.9, 0.16, 'sine', 61, 0.03); noise(0.24, 0.26, 380, 0.7); },
    skill() { tone(660, 0.4, 0.16); tone(990, 0.5, 0.12, 'sine', null, 0.06); noise(0.16, 0.06, 3600, 2); },
    equip() { tone(1480, 0.1, 0.12, 'square', 820); noise(0.05, 0.14, 2600, 2); },
    defend() { tone(420, 0.2, 0.18, 'triangle'); tone(840, 0.12, 0.1, 'sine', 620, 0.02); },
    move() { noise(0.22, 0.1, 900, 1.4); },
    month() { tone(523, 0.55, 0.1); tone(784, 0.7, 0.08, 'sine', null, 0.1); },
    result(win) { if (win) { tone(523, 0.5, 0.14); tone(659, 0.55, 0.12, 'sine', null, 0.12); tone(784, 0.9, 0.12, 'sine', null, 0.24); } else { tone(220, 0.9, 0.14, 'sine', 110); tone(165, 1.2, 0.1, 'sine', 82, 0.15); } },
    ui() { tone(620, 0.05, 0.07, 'square', 520); },
  };
})();

/* ---------- 基础场景 ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e10);
scene.fog = new THREE.Fog(0x0a0e10, 12, 30);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 140);
const camTarget = new THREE.Vector3(0, 0.18, 0);

/* ---------- 自适应取景 ----------
   竖屏横向视野很窄（390x844 时只有约 24°），固定机位会把八卦环两侧切掉，
   导致半边宫位点不到。这里按实际投影解出距离，保证八个宫位与手牌都在画内。 */
const RING_R = 1.06;
const HAND_CARD = { w: 0.30, h: 0.42 };
const VIEW = { d: 4.4, camY: 1.8, camZ: 4.1, fov: 50, handY: 0.6, handZ: 1.5, handSp: 0.12 };

const vnorm = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function fitView() {
  const W = window.innerWidth, H = window.innerHeight;
  const aspect = W / H;
  const fov = aspect < 0.85 ? 62 : aspect < 1.25 ? 56 : 50;
  const th = Math.tan(fov * Math.PI / 360);
  const elev = 21 * Math.PI / 180;
  const tgtY = 0.18;

  // 八个宫位（用场上牌的中心高度）
  const pts = D.RING.map((k, i) => {
    const a = i * Math.PI / 4;
    return [Math.sin(a) * RING_R, 0.23, -Math.cos(a) * RING_R];
  });

  // 二分不出手，直接细扫：找最小的 d 让所有宫位都落在 ±0.84 的画幅内
  let d = 1.8, cy = 0, cz = 0, fwd = null, up = null;
  for (; d <= 9; d += 0.04) {
    cy = tgtY + Math.sin(elev) * d;
    cz = Math.cos(elev) * d;
    fwd = vnorm([0, tgtY - cy, -cz]);
    // right = (1,0,0)，故 up = cross(right, fwd) = (0, -fwd.z, fwd.y)
    up = [0, -fwd[2], fwd[1]];
    let ok = true;
    for (const p of pts) {
      const v = [p[0], p[1] - cy, p[2] - cz];
      const zc = vdot(v, fwd);
      if (zc <= 0.25) { ok = false; break; }
      const nx = v[0] / (zc * th * aspect);
      const ny = vdot(v, up) / (zc * th);
      if (Math.abs(nx) > 0.84 || ny > 0.80 || ny < -0.62) { ok = false; break; }
    }
    if (ok) break;
  }

  // 别贴太近：太近会让近端宫位贴脸、手牌坐到棋盘中间
  d = Math.max(3.6, Math.min(7.0, d));
  cy = tgtY + Math.sin(elev) * d;
  cz = Math.cos(elev) * d;
  fwd = vnorm([0, tgtY - cy, -cz]);
  up = [0, -fwd[2], fwd[1]];

  VIEW.d = d; VIEW.camY = cy; VIEW.camZ = cz; VIEW.fov = fov;
  camera.fov = fov;
  camera.position.set(0, cy, cz);
  camera.lookAt(camTarget);
  camera.updateProjectionMatrix();

  // 手牌：举在台沿前上方，落在底栏上方一点
  const handZ = Math.max(1.2, cz - 1.7);
  const hudPx = W < 900 ? 116 : 100;
  const wantNdcY = 1 - 2 * ((H - hudPx - 70) / H);
  let bestY = 0.5, bestErr = 9;
  for (let y = 0.2; y <= 2.0; y += 0.005) {
    const v = [0, y - cy, handZ - cz];
    const zc = vdot(v, fwd);
    if (zc <= 0.2) continue;
    const ny = vdot(v, up) / (zc * th);
    const err = Math.abs(ny - wantNdcY);
    if (err < bestErr) { bestErr = err; bestY = y; }
  }
  // 不能沉进石台面以下
  VIEW.handY = Math.max(0.34, bestY);
  VIEW.handZ = handZ;

  // 手牌间距：按该深度的可用宽度算，8 张刚好不越界
  const vh = [0, VIEW.handY - cy, handZ - cz];
  const depth = vdot(vh, fwd);
  const halfW = depth * th * aspect * 0.88;
  VIEW.handSp = Math.max(0.085, Math.min(0.30, (2 * halfW - HAND_CARD.w) / 7));
}
fitView();

scene.add(new THREE.AmbientLight(0x9fb4bb, 0.58));
const spot = new THREE.SpotLight(0xd8e6ea, 2.8, 16, Math.PI / 4.2, 0.6, 1.1);
spot.position.set(0.4, 5.0, 2.2);
spot.target.position.set(0, 0, -0.25);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0005;
scene.add(spot, spot.target);
const rim = new THREE.PointLight(0x8fb0b8, 12, 11, 2);
rim.position.set(2.6, 2.0, -2.4);
scene.add(rim);
// 环境补光：让松与鹤从黑里浮出来
const treeRim = new THREE.PointLight(0x9fc0c8, 7.0, 7, 2);
treeRim.position.set(-3.0, 2.2, -3.4);
scene.add(treeRim);
const craneRim = new THREE.PointLight(0xbfd0d4, 4.8, 7, 2);
craneRim.position.set(2.5, 1.8, -3.2);
scene.add(craneRim);
const moonFill = new THREE.DirectionalLight(0xb7ccd2, 0.5);
moonFill.position.set(4, 7, -3);
scene.add(moonFill);
// 冷灰世界里唯一的一点暖红，呼应崖上那支红缨
const accent = new THREE.PointLight(0xc4472f, 5, 6, 2);
accent.position.set(-1.9, 0.35, 0.7);
scene.add(accent);

/* ---------- 环境：山巅云海 ---------- */
// 天空穹顶：天顶墨黑 → 地平线亮灰 → 下方再沉入暗
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0.00, '#06090b');
  grd.addColorStop(0.38, '#182124');
  grd.addColorStop(0.58, '#63737a');
  grd.addColorStop(0.70, '#b3bfc1');
  grd.addColorStop(0.80, '#77868b');
  grd.addColorStop(1.00, '#080c0e');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(45, 24, 16),
  new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
);
scene.add(sky);

// 云海：三层叠放，靠纹理偏移缓慢流动
function cloudTexture(seed) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let r = seed;
  const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 110; i++) {
    const x = rand() * 512, y = rand() * 512, rad = 34 + rand() * 96;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.05 + rand() * 0.13;
    grd.addColorStop(0, `rgba(236,244,246,${a})`);
    grd.addColorStop(1, 'rgba(236,244,246,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const cloudLayers = [];
for (let i = 0; i < 3; i++) {
  const tex = cloudTexture(1207 + i * 991);
  tex.repeat.set(2.2, 2.2);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55 - i * 0.12, depthWrite: false, fog: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.62 - i * 0.62;
  m.userData.speed = 0.00055 + i * 0.0003;
  scene.add(m);
  cloudLayers.push(m);
}

// 远山剪影
function ridgeTexture(w, h, seed, color, rough) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  let r = seed;
  const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  g.beginPath(); g.moveTo(0, h);
  const step = 26;
  for (let x = 0; x <= w; x += step) {
    const t = x / w;
    const ridge = Math.sin(t * 9.1 + seed * 0.7) * 0.26 + Math.sin(t * 21.7 + seed) * 0.12;
    const y = h * (0.52 - ridge * rough - rand() * 0.05);
    g.lineTo(x, y);
  }
  g.lineTo(w, h); g.closePath();
  const grd = g.createLinearGradient(0, h * 0.3, 0, h);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(12,17,19,0)');
  g.fillStyle = grd; g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const ridges = [
  { z: -13, w: 26, h: 7, seed: 3, color: '#0c1214', op: 0.95 },
  { z: -19, w: 34, h: 9, seed: 11, color: '#131b1e', op: 0.8 },
  { z: -26, w: 44, h: 12, seed: 29, color: '#1b2427', op: 0.6 },
];
for (const rg of ridges) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(rg.w, rg.h),
    new THREE.MeshBasicMaterial({ map: ridgeTexture(512, 256, rg.seed, rg.color, 1), transparent: true, opacity: rg.op, depthWrite: false, fog: false })
  );
  m.position.set(0, rg.h / 2 - 0.6, rg.z);
  scene.add(m);
}

// 云中楼阁剪影（参照图里远处那一座）
function pagodaTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0f11';
  let y = 128, w = 56;
  for (let i = 0; i < 5; i++) {
    g.fillRect(64 - w / 2 - 4, y, w + 8, 5);          // 飞檐
    g.fillRect(64 - w * 0.3, y + 5, w * 0.6, 9);      // 塔身
    y -= 20; w *= 0.86;
  }
  g.fillRect(62, y - 14, 4, 18);                       // 塔刹
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const pagoda = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 3.25),
  new THREE.MeshBasicMaterial({ map: pagodaTexture(), transparent: true, opacity: 0.9, depthWrite: false, fog: false })
);
pagoda.position.set(-1.4, 2.6, -21);
scene.add(pagoda);

/* ---------- 崖上松、鹤、月、石灯 ----------
   先用程序化低模占位，之后用 Meshy 的 GLB 直接替换。
   位置按“山巅对弈”构图：左松、右鹤、后月、两侧石灯。 */
function moonTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  const halo = g.createRadialGradient(256, 256, 150, 256, 256, 256);
  halo.addColorStop(0, 'rgba(226,224,208,.16)');
  halo.addColorStop(1, 'rgba(226,224,208,0)');
  g.fillStyle = halo; g.fillRect(0, 0, 512, 512);
  g.beginPath(); g.arc(256, 256, 148, 0, Math.PI * 2);
  g.fillStyle = '#ded9c6'; g.fill();
  let r = 19;
  const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 26; i++) {
    const x = 170 + rand() * 172, y = 170 + rand() * 172, rad = 5 + rand() * 22;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = `rgba(122,124,116,${0.04 + rand() * 0.08})`; g.fill();
  }
  // 月缘被云擦掉一点
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(355, 310, 86, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.55)'; g.fill();
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const moon = new THREE.Mesh(
  new THREE.PlaneGeometry(5.8, 5.8),
  new THREE.MeshBasicMaterial({ map: moonTexture(), transparent: true, opacity: 0.9, depthWrite: false, fog: false })
);
moon.position.set(0.9, 6.4, -12);
moon.scale.setScalar(0.9);
scene.add(moon);

// 星子，稀疏几颗就够
function starField() {
  const n = 90, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, h = 0.15 + Math.random() * 0.75;
    const rad = 34;
    pos[i * 3] = Math.cos(a) * rad * Math.sqrt(1 - h * h);
    pos[i * 3 + 1] = 2 + h * 24;
    pos[i * 3 + 2] = Math.sin(a) * rad * Math.sqrt(1 - h * h);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(230,236,232,.9)');
    grd.addColorStop(.25, 'rgba(230,236,232,.55)');
    grd.addColorStop(1, 'rgba(230,236,232,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    return c;
  })());
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, map: tex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(pts);
}
starField();

// 松：树干 + 扁平云片状松冠，带一点风
const pineGroup = new THREE.Group();
{
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), new THREE.MeshStandardMaterial({ color: 0x101719, roughness: 1, flatShading: true }));
  rock.scale.set(1.7, 0.45, 1.25); rock.position.y = 0.1; rock.receiveShadow = true; pineGroup.add(rock);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b241f, roughness: 1, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.21, 3.55, 7), trunkMat);
  trunk.position.y = 1.82; trunk.rotation.z = -0.07; trunk.castShadow = true; pineGroup.add(trunk);
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.075, 1.05, 5), trunkMat);
  branch.position.set(0.35, 2.55, 0); branch.rotation.z = -0.9; pineGroup.add(branch);
  const tones = [0x4d6656, 0x5b7563, 0x405a4b];
  const canopy = [
    [0.0, 2.42, 0, 1.65, 0.34, 1.05, 0],
    [-0.72, 2.82, 0.08, 1.15, 0.28, 0.78, 1],
    [0.7, 3.18, -0.05, 1.05, 0.27, 0.72, 2],
    [-0.3, 3.46, 0.02, 0.92, 0.24, 0.64, 1],
    [0.24, 3.8, 0.03, 0.72, 0.22, 0.52, 0],
    [0.0, 4.02, 0, 0.5, 0.19, 0.4, 2],
  ];
  for (const [x, y, z, sx, sy, sz, ti] of canopy) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.72, 7, 5), new THREE.MeshStandardMaterial({ color: tones[ti], roughness: 1, flatShading: true }));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; pineGroup.add(m);
  }
  // 红缨：给冷墨色一点暖色，和场上红方呼应
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x9d3a28, roughness: 0.92, side: THREE.DoubleSide });
  for (let i = 0; i < 2; i++) {
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.62), ribbonMat);
    ribbon.position.set(0.74 + i * 0.08, 2.42 - i * 0.06, 0.18 + i * 0.05);
    ribbon.rotation.z = 0.18 + i * 0.25; ribbon.rotation.y = 0.2;
    pineGroup.add(ribbon);
  }
}
pineGroup.position.set(-2.95, 0, -4.5);
pineGroup.rotation.y = 0.35;
scene.add(pineGroup);

// 鹤：立在右侧崖石上
const craneGroup = new THREE.Group();
{
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), new THREE.MeshStandardMaterial({ color: 0x121a1c, roughness: 1, flatShading: true }));
  rock.scale.set(1.3, 0.42, 0.95); rock.position.y = 0.18; craneGroup.add(rock);
  const white = new THREE.MeshStandardMaterial({ color: 0xe4dfcf, roughness: 0.9, flatShading: true });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1e1e, roughness: 0.95, flatShading: true });
  const red = new THREE.MeshStandardMaterial({ color: 0xa8432f, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), white);
  body.scale.set(1.2, 0.72, 0.78); body.position.y = 0.95; body.castShadow = true; craneGroup.add(body);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 1.1, 0.02),
    new THREE.Vector3(0.32, 1.42, 0.03),
    new THREE.Vector3(0.27, 1.68, 0.05),
    new THREE.Vector3(0.37, 1.79, 0.06),
  ]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.045, 6, false), black);
  neck.castShadow = true; craneGroup.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), white);
  head.position.set(0.39, 1.8, 0.06); craneGroup.add(head);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), red);
  crown.scale.set(1.2, 0.55, 0.9); crown.position.set(0.38, 1.87, 0.06); craneGroup.add(crown);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.17, 6), black);
  beak.rotation.z = -Math.PI / 2; beak.position.set(0.51, 1.79, 0.06); craneGroup.add(beak);
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), white);
    wing.scale.set(0.95, 0.12, 0.36); wing.position.set(-0.03, 1.0, sx * 0.21); craneGroup.add(wing);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), black);
    tip.scale.set(0.85, 0.1, 0.28); tip.position.set(-0.28, 1.0, sx * 0.22); craneGroup.add(tip);
    // 腿
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.62, 5), black);
    leg.position.set(sx * 0.1, 0.56, 0.02); leg.rotation.z = sx * 0.05; craneGroup.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.08), black);
    foot.position.set(sx * 0.1, 0.24, 0.06); craneGroup.add(foot);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), black);
  tail.rotation.z = Math.PI / 2; tail.position.set(-0.36, 0.94, 0); craneGroup.add(tail);
}
craneGroup.position.set(2.45, 0.02, -3.7);
craneGroup.rotation.y = -0.45;
craneGroup.scale.setScalar(0.92);
scene.add(craneGroup);

// 石灯：两侧各一盏，暖光只照台沿
function stoneLantern(x, z) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x20282a, roughness: 1, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.14, 6), stone); base.position.y = 0.07; g.add(base);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.62, 6), stone); shaft.position.y = 0.45; g.add(shaft);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), new THREE.MeshStandardMaterial({ color: 0x2a3233, roughness: 0.94, emissive: 0x5a3216, emissiveIntensity: 0.45 }));
  housing.position.y = 0.92; g.add(housing);
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.22), new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  flame.position.set(0, 0.92, 0.212); g.add(flame);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.2, 6), stone); roof.position.y = 1.2; g.add(roof);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), stone); cap.position.y = 1.34; g.add(cap);
  const light = new THREE.PointLight(0xffa25e, 2.6, 4.6, 2); light.position.set(0, 1.02, 0); g.add(light);
  g.position.set(x, 0, z); g.rotation.y = x > 0 ? -0.4 : 0.4;
  scene.add(g);
  return g;
}
stoneLantern(-2.55, -1.0);
stoneLantern(2.55, -1.0);

/* ---------- 墨岩台面 ---------- */
// 不规则多边形柱体：按角度抖动半径，做出凿出来的石头感
function rockGeometry(topR, botR, h, segs, seed) {
  const geo = new THREE.CylinderGeometry(topR, botR, h, segs, 1);
  const pos = geo.attributes.position;
  let r = seed;
  const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const jit = [];
  for (let i = 0; i <= segs; i++) jit.push(0.88 + rand() * 0.18);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (x === 0 && z === 0) continue;
    const ang = Math.atan2(z, x);
    let idx = Math.round(((ang + Math.PI) / (Math.PI * 2)) * segs);
    const k = jit[Math.min(idx, segs)];
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function stoneTopTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#191e20'; g.fillRect(0, 0, 1024, 1024);
  let r = 7;
  const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  // 石面斑驳
  for (let i = 0; i < 1100; i++) {
    const x = rand() * 1024, y = rand() * 1024, rad = 8 + rand() * 54;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.02 + rand() * 0.05;
    grd.addColorStop(0, `rgba(198,214,218,${a})`);
    grd.addColorStop(1, 'rgba(198,214,218,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // 边缘暗下去，显得台面有厚度
  const vig = g.createRadialGradient(512, 512, 300, 512, 512, 512);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.72)');
  g.fillStyle = vig; g.fillRect(0, 0, 1024, 1024);
  // 刻线
  g.strokeStyle = 'rgba(176,196,200,.22)'; g.lineWidth = 3;
  g.beginPath(); g.arc(512, 512, 470, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.setLineDash([9, 13]);
  g.beginPath(); g.arc(512, 512, 430, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  // 八宫刻痕
  D.RING.forEach((key, i) => {
    const t = TRIGRAMS[key], ec = ELEMENTS[t.element];
    const a = i * Math.PI / 4;
    const x = 512 + Math.sin(a) * 308, y = 512 - Math.cos(a) * 308;
    g.save(); g.translate(x, y);
    g.strokeStyle = 'rgba(176,196,200,.20)'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 74, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'center';
    g.fillStyle = 'rgba(196,212,216,.40)';
    g.font = 'bold 50px "Songti SC","STSong",serif';
    g.fillText(t.sym, 0, -16);
    g.font = 'bold 28px "Songti SC","STSong",serif';
    g.fillText(t.name, 0, 20);
    g.font = '16px "PingFang SC",sans-serif';
    g.fillStyle = ec.light; g.globalAlpha = 0.5;
    g.fillText(t.dir + ' · ' + ec.name, 0, 46);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

const stoneSide = new THREE.MeshStandardMaterial({ color: 0x101517, roughness: 0.96, metalness: 0.02 });
const stoneTop = new THREE.MeshStandardMaterial({ map: stoneTopTexture(), roughness: 0.86, metalness: 0.04 });
const stoneBottom = new THREE.MeshStandardMaterial({ color: 0x090d0f, roughness: 1 });
const table = new THREE.Mesh(rockGeometry(2.26, 2.32, 0.30, 11, 42), [stoneSide, stoneTop, stoneBottom]);
table.position.y = -0.07; table.castShadow = true; table.receiveShadow = true;
scene.add(table);

// 岩体往下收，沉进云里
const pedestal = new THREE.Mesh(
  rockGeometry(1.62, 0.5, 2.4, 9, 91),
  new THREE.MeshStandardMaterial({ color: 0x0a0f11, roughness: 1 })
);
pedestal.position.y = -1.42; pedestal.castShadow = true; pedestal.receiveShadow = true;
scene.add(pedestal);

/* ---------- 太极刻纹 ---------- */
function taijiTexture(fire) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const line = 'rgba(198,214,218,.62)';
  const fill = fire ? 'rgba(196,74,48,.75)' : 'rgba(198,214,218,.28)';
  g.strokeStyle = line; g.lineWidth = 4;
  g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  g.fillStyle = fill;
  g.beginPath();
  g.arc(128, 128, 60, -Math.PI / 2, Math.PI / 2, false);
  g.arc(128, 188, 30, Math.PI / 2, -Math.PI / 2, true);
  g.arc(128, 68, 30, Math.PI / 2, -Math.PI / 2, false);
  g.closePath(); g.fill();
  g.beginPath(); g.arc(128, 68, 10, 0, Math.PI * 2); g.fillStyle = '#0d1214'; g.fill();
  g.beginPath(); g.arc(128, 188, 10, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
const matGroup = new THREE.Group();
scene.add(matGroup);
const taijiBig = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), new THREE.MeshBasicMaterial({ map: taijiTexture(false), transparent: true, depthWrite: false }));
taijiBig.rotation.x = -Math.PI / 2; taijiBig.position.y = 0.095; matGroup.add(taijiBig);
const taijiSmall = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), new THREE.MeshBasicMaterial({ map: taijiTexture(true), transparent: true, depthWrite: false }));
taijiSmall.rotation.x = -Math.PI / 2; taijiSmall.position.set(0.33, 0.096, 0.33); matGroup.add(taijiSmall);

/* ---------- 卡牌纹理 ---------- */
const cardTexCache = new Map();

/* 立绘：assets/art/cards/<id>.webp，铺满 3D 卡面 */
const ART_DIR = 'assets/art/cards/';
const artImg = new Map();
let artRaf = 0;
function scheduleArtRefresh() {
  if (artRaf) return;
  artRaf = requestAnimationFrame(() => {
    artRaf = 0;
    cardTexCache.forEach(tex => tex.dispose());
    cardTexCache.clear();
    if (S.g) refresh();
  });
}
for (const id of Object.keys(CARDS)) {
  const img = new Image();
  img.decoding = 'async';
  img.onload = scheduleArtRefresh;
  img.src = ART_DIR + id + '.webp';
  artImg.set(id, img);
}

function badge(g, cx, cy, r, fill, text, color) {
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = fill; g.fill();
  g.strokeStyle = 'rgba(23,25,27,.5)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = color; g.font = 'bold 21px monospace'; g.textAlign = 'center';
  g.fillText(text, cx, cy + 7);
}

function cardTexture(card, u) {
  const key = [card.id, u.owner, u.atk, u.hp, u.maxHp, u.weapon ? u.weapon.key : '', u.fieldDmg, u.fieldArmor, u.fieldVuln, u.fieldBurnOnHit, u.burn, u.justPlayed, u.acted, u.extraActions, u.guard, u.poison, !!u.selected].join('|');
  if (cardTexCache.has(key)) return cardTexCache.get(key);
  const W = 256, H = 352, PAD = 8;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const ec = ELEMENTS[card.element], rc = ELEMENTS[card.roleElement];

  g.fillStyle = '#f7f3e8'; g.fillRect(0, 0, W, H);

  // 立绘铺满卡面（3:4 原图按 cover 裁切）
  const ix = PAD, iy = PAD, iw = W - PAD * 2, ih = H - PAD * 2;
  const img = artImg.get(card.id);
  g.save();
  g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
  if (img && img.complete && img.naturalWidth) {
    const s = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    g.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
  } else {
    g.fillStyle = ec.color + '18'; g.fillRect(ix, iy, iw, ih);
    g.fillStyle = rc.color; g.beginPath(); g.arc(W / 2, 150, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f7f3e8'; g.font = 'bold 40px "Songti SC",serif'; g.textAlign = 'center';
    g.fillText(card.role, W / 2, 164);
  }
  g.restore();

  g.fillStyle = ec.color; g.fillRect(ix, iy, iw, 6);

  // 底部信息带
  const fade = g.createLinearGradient(0, H - 108, 0, H);
  fade.addColorStop(0, 'rgba(23,25,27,0)');
  fade.addColorStop(.45, 'rgba(23,25,27,.55)');
  fade.addColorStop(.75, 'rgba(23,25,27,.88)');
  fade.addColorStop(1, 'rgba(23,25,27,.96)');
  g.fillStyle = fade; g.fillRect(ix, H - 108, iw, 100);

  g.textAlign = 'left';
  g.fillStyle = '#f7f3e8'; g.font = 'bold 27px "Songti SC","STSong",serif';
  g.fillText(card.name, 20, H - 44);
  g.fillStyle = ec.light; g.font = 'bold 13px "PingFang SC",sans-serif';
  g.fillText(card.sym + ' ' + card.attr + ' · ' + card.role, 20, H - 22);

  badge(g, 176, H - 46, 21, '#17191b', String(u.atk), '#f7f3e8');
  badge(g, 228, H - 46, 21, '#f7f3e8', String(u.hp), '#17191b');

  // 状态
  const tags = [];
  if (u.weapon) tags.push(u.weapon.name);
  if (u.guard === 'firm') tags.push('坚守');
  else if (u.guard === 'hasty') tags.push('御');
  if (u.poison) tags.push('毒' + u.poison);
  if (u.burn) tags.push('烧' + u.burn);
  if (u.fieldDmg) tags.push('伤' + (u.fieldDmg > 0 ? '+1' : '-1'));
  if (u.fieldArmor) tags.push('减伤');
  if (u.fieldVuln) tags.push('增伤');
  if (u.fieldBurnOnHit) tags.push('火');
  if (u.justPlayed) tags.push('新');
  else if (u.acted) tags.push('已');
  if (u.extraActions) tags.push('+' + u.extraActions + '行');
  if (tags.length) {
    const t = tags.join(' · ');
    g.font = 'bold 12px monospace';
    const tw = g.measureText(t).width;
    g.fillStyle = 'rgba(23,25,27,.82)'; g.fillRect(16, 20, tw + 14, 20);
    g.fillStyle = '#f7f3e8'; g.textAlign = 'left';
    g.fillText(t, 23, 34);
  }

  // 边框：墨线 + 归属色
  g.strokeStyle = '#17191b'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
  g.strokeStyle = u.owner === 0 ? '#b4472f' : '#3f6e7a'; g.lineWidth = 3;
  g.strokeRect(6.5, 6.5, W - 13, H - 13);

  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  cardTexCache.set(key, tex);
  return tex;
}
function cardBackTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 352;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2022'; g.fillRect(0, 0, 256, 352);
  g.strokeStyle = '#c2a24c'; g.lineWidth = 4; g.strokeRect(10, 10, 236, 332);
  g.strokeStyle = 'rgba(247,243,232,.25)'; g.lineWidth = 2;
  for (let r = 30; r < 120; r += 18) { g.beginPath(); g.arc(128, 176, r, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#f7f3e8'; g.font = 'bold 48px "Songti SC",serif'; g.textAlign = 'center';
  g.fillText('八', 128, 164); g.fillText('卦', 128, 220);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
const BACK_TEX = cardBackTexture();
function makeCardMesh(texture, w, h) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- 场上 / 手牌 ---------- */
const boardGroup = new THREE.Group(); scene.add(boardGroup);
const handGroup = new THREE.Group(); scene.add(handGroup);
const oppGroup = new THREE.Group(); scene.add(oppGroup);
const slotGroup = new THREE.Group(); scene.add(slotGroup);

function viewOrder() { return E.viewOrder(S.g ? S.g.humanSeat : 'N'); }
function slotPos(key, r = 1.12) {
  const idx = viewOrder().indexOf(key);
  const a = idx * Math.PI / 4;
  return new THREE.Vector3(Math.sin(a) * r, 0.4, -Math.cos(a) * r);
}
function makeSlotRings() {
  slotGroup.clear();
  for (const key of D.RING) {
    const p = slotPos(key, 1.12); p.y = 0.085;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 40), new THREE.MeshBasicMaterial({ color: 0x9fb4bb, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(p);
    ring.userData = { kind: 'slot', slot: key };
    slotGroup.add(ring);
    // 整个宫位都是点击区：细圆环在手机上几乎点不中
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.rotation.x = -Math.PI / 2; hit.position.copy(p); hit.position.y += 0.002;
    hit.userData = { kind: 'slot', slot: key, isHit: true };
    slotGroup.add(hit);
  }
}

/* ---------- 对手模型（道童占位，之后换 Meshy 模型） ---------- */
const oppFigure = new THREE.Group();
{
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.6, 0.09, 28), new THREE.MeshStandardMaterial({ color: 0x3d2a24, roughness: 1 }));
  cushion.position.y = 0.045; cushion.receiveShadow = true; oppFigure.add(cushion);

  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.54, 1.02, 22), new THREE.MeshStandardMaterial({ color: 0x141a1c, roughness: 0.94 }));
  robe.position.y = 0.56; robe.castShadow = true; oppFigure.add(robe);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 12), new THREE.MeshStandardMaterial({ color: 0x1b2325, roughness: 0.94 }));
  shoulders.scale.set(1.15, 0.42, 0.8); shoulders.position.y = 0.95; shoulders.castShadow = true; oppFigure.add(shoulders);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xc2b59b, roughness: 0.9 }));
  neck.position.y = 1.09; oppFigure.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 18), new THREE.MeshStandardMaterial({ color: 0xcabda3, roughness: 0.85 }));
  head.position.y = 1.24; head.castShadow = true; oppFigure.add(head);
  // 发髻与发带：道童
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.212, 20, 14), new THREE.MeshStandardMaterial({ color: 0x101314, roughness: 1 }));
  hair.scale.set(1.01, 0.72, 1.01); hair.position.set(0, 1.34, -0.015); oppFigure.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshStandardMaterial({ color: 0x101314, roughness: 1 }));
  bun.position.set(0, 1.46, -0.01); oppFigure.add(bun);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.077, 0.014, 6, 16), new THREE.MeshStandardMaterial({ color: 0xb4472f, roughness: 0.8 }));
  band.rotation.x = Math.PI / 2; band.position.set(0, 1.435, -0.01); oppFigure.add(band);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x17191b });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), eyeMat); eL.position.set(-0.065, 1.25, 0.19); oppFigure.add(eL);
  const eR = eL.clone(); eR.position.x = 0.065; oppFigure.add(eR);
  // 胸前纸符
  const talisman = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshStandardMaterial({ color: 0xd9cfae, roughness: 0.95, side: THREE.DoubleSide }));
  talisman.position.set(0, 0.78, 0.26); talisman.rotation.x = -0.12; oppFigure.add(talisman);
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x9c3a28 }));
  seal.position.set(0, 0.76, 0.262); seal.rotation.x = -0.12; oppFigure.add(seal);
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1a2123, roughness: 0.96 });
  for (const sx of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.4, 10), sleeveMat);
    sleeve.position.set(sx * 0.34, 0.62, 0.08); sleeve.rotation.z = sx * 0.22; sleeve.castShadow = true; oppFigure.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc2b59b, roughness: 0.9 }));
    hand.position.set(sx * 0.38, 0.44, 0.12); oppFigure.add(hand);
  }
}
oppFigure.position.set(0, 0, -2.7);
oppFigure.userData.baseY = 0;
scene.add(oppFigure);

/* ---------- 天气 ---------- */
const particleCount = 130;
const particleGeo = new THREE.BufferGeometry();
const particlePos = new Float32Array(particleCount * 3);
const particleCol = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  particlePos[i * 3] = (Math.random() - 0.5) * 5.2;
  particlePos[i * 3 + 1] = Math.random() * 2.4 + 0.2;
  particlePos[i * 3 + 2] = (Math.random() - 0.5) * 4.4;
  const red = Math.random() < 0.5;
  const c = new THREE.Color(red ? 0xb4472f : 0x5b7a4b);
  particleCol[i * 3] = c.r; particleCol[i * 3 + 1] = c.g; particleCol[i * 3 + 2] = c.b;
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3));
const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
scene.add(particles);

/* ---------- HUD ---------- */
const $ = id => document.getElementById(id);
const KIND = { month: '月', turn: '手', place: '出', attack: '攻', equip: '装', move: '移', skill: '技', death: '亡', end: '终', term: '场', round: '转' };
function flashMsg(t) {
  S.flash = t; $('prompt').textContent = t;
  clearTimeout(S.flashTimer); S.flashTimer = setTimeout(() => { S.flash = ''; renderHud(); }, 1700);
}
function seatOf(id) { return S.g ? (id === 0 ? (S.g.humanSeat === 'N' ? '北' : '南') : (S.g.humanSeat === 'N' ? '南' : '北')) : ''; }

/* 卡牌牌面/手牌/场上同步 */
function syncScene() {
  boardGroup.clear(); handGroup.clear(); oppGroup.clear();
  if (!S.g) return;
  const g = S.g;
  // 场上
  for (const key of D.RING) {
    const u = E.unitAt(g, key);
    if (!u) continue;
    const tex = cardTexture(u.card, { ...u, owner: u.owner, selected: !!(S.sel && S.sel.type === 'unit' && S.sel.slot === key) });
    const m = makeCardMesh(tex, 0.56, 0.78);
    const p = slotPos(key, 1.06);
    m.position.set(p.x, 0.105, p.z);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = 0;
    m.userData = { kind: 'unit', slot: key };
    boardGroup.add(m);
  }
  // 玩家手牌
  g.players[HUMAN].hand.forEach((id, i) => {
    const st = g.players[HUMAN].cardState[id];
    if (st !== 'hand') return;
    const card = CARDS[id];
    const sel = S.sel && S.sel.type === 'card' && S.sel.id === id;
    const tex = cardTexture(card, { owner: 0, atk: card.atk, hp: card.hp, maxHp: card.hp, weapon: null, fieldDmg: 0, fieldArmor: 0, fieldVuln: 0, fieldBurnOnHit: false, burn: 0, justPlayed: false, acted: false, extraActions: 0, selected: sel });
    const m = makeCardMesh(tex, HAND_CARD.w, HAND_CARD.h);
    m.position.set((i - 3.5) * VIEW.handSp, VIEW.handY + (sel ? 0.10 : 0), VIEW.handZ - Math.abs(i - 3.5) * 0.012);
    m.rotation.x = -0.4; m.rotation.y = -(i - 3.5) * 0.04;
    m.userData = { kind: 'hand', index: i, id };
    handGroup.add(m);
  });
  // 对手手牌（公开）
  g.players[FOE].hand.forEach((id, i) => {
    const st = g.players[FOE].cardState[id];
    if (st !== 'hand') return;
    const card = CARDS[id];
    const tex = cardTexture(card, { owner: 1, atk: card.atk, hp: card.hp, maxHp: card.hp, weapon: null, fieldDmg: 0, fieldArmor: 0, fieldVuln: 0, fieldBurnOnHit: false, burn: 0, justPlayed: false, acted: false, extraActions: 0, selected: false });
    const m = makeCardMesh(tex, 0.26, 0.36);
    m.position.set((i - 3.5) * 0.24, 0.62, -1.78);
    m.rotation.x = 0.5; m.rotation.y = Math.PI;
    m.userData = { kind: 'opphand', id };
    oppGroup.add(m);
  });
  // 对手武器小牌背（公开信息）
  const oppP = g.players[FOE];
  oppP.weapons.forEach((wk, i) => {
    const w = D.WEAPON_BY_KEY[wk];
    const c = document.createElement('canvas'); c.width = 128; c.height = 96;
    const x = c.getContext('2d'); x.fillStyle = '#171c1e'; x.fillRect(0, 0, 128, 96);
    x.strokeStyle = '#c2a24c'; x.lineWidth = 2; x.strokeRect(5, 5, 118, 86);
    x.fillStyle = '#f7f3e8'; x.font = 'bold 30px "Songti SC",serif'; x.textAlign = 'center';
    x.fillText(w.name, 64, 48); x.font = '15px monospace'; x.fillStyle = '#c2a24c'; x.fillText('庄家', 64, 76);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = makeCardMesh(tex, 0.2, 0.15);
    m.position.set((i - 1.5) * 0.22, 0.2, -2.1); m.rotation.x = 0.42; m.rotation.y = Math.PI;
    oppGroup.add(m);
  });
  // 高亮
  updateHighlights();
}

function validInfo() {
  const g = S.g;
  if (!g || g.over) return { slots: [], units: [], hand: [] };
  const placeable = S.mode === 'place' && S.sel && S.sel.type === 'card' ? E.validSlots(g, HUMAN, S.sel.id) : [];
  const targets = S.mode === 'unit' && S.sel && S.sel.slot ? E.attackTargets(g, HUMAN, S.sel.slot) : [];
  const moves = S.mode === 'unit' && S.sel && S.sel.slot ? E.moveTargets(g, HUMAN, S.sel.slot) : [];
  const equipable = S.mode === 'equip' ? E.equipTargets(g, HUMAN) : [];
  const skillable = S.mode === 'skill' ? E.skillTargets(g, HUMAN) : [];
  return { slots: placeable.concat(moves), units: targets.concat(equipable, skillable), hand: [] };
}
function updateHighlights() {
  const v = validInfo();
  for (const ring of slotGroup.children) {
    if (ring.userData.isHit) continue;
    const on = v.slots.includes(ring.userData.slot);
    ring.material.color.set(on ? 0xc4472f : 0x9fb4bb);
    ring.material.opacity = on ? 0.9 : 0.4;
  }
  for (const m of boardGroup.children) {
    const on = v.units.includes(m.userData.slot);
    m.material.emissive = new THREE.Color(on ? 0x553322 : 0x000000);
    m.material.emissiveIntensity = on ? 0.7 : 0;
  }
}

function renderHud() {
  const g = S.g;
  if (!g) { $('status').textContent = '未入座'; return; }
  $('status').innerHTML = `第 ${g.turnNo} 手 · <b>${g.turn === HUMAN ? '你' : '庄家'}</b> · 落子 ${g.placedThisTurn ? '已用' : '1'} · 技能 ${g.skillsLeft}/2<br>你 ${E.remaining(g.players[0])}/8 · 庄家 ${E.remaining(g.players[1])}/8 · ${DIFFICULTY.find(d => d.key === g.difficulty).name}`;
  // 武器
  const p = g.players[HUMAN];
  $('weapons').innerHTML = p.weapons.map(wk => {
    const w = D.WEAPON_BY_KEY[wk];
    const sel = S.sel && S.sel.type === 'weapon' && S.sel.key === wk;
    return `<button class="${sel ? 'sel' : ''}" data-weapon="${wk}"><b>${w.name}</b><span>${w.atk ? '攻' + (w.atk > 0 ? '+' : '') + w.atk + ' ' : ''}${w.hp ? '血' + (w.hp > 0 ? '+' : '') + w.hp + ' ' : ''}${w.shield ? '盾' + w.shield : ''}</span></button>`;
  }).join('');
  // 技能
  $('skills').innerHTML = SKILLS.map(sk => {
    const used = g.skillsUsedThisTurn[sk.key], left = 2 - (p.skillUses[sk.key] || 0);
    const sel = S.sel && S.sel.type === 'skill' && S.sel.key === sk.key;
    return `<button class="${used ? 'used' : ''} ${sel ? 'sel' : ''}" data-skill="${sk.key}" title="${sk.desc}"><b>${sk.name}</b><span>${sk.attr}/${ROLES.find(r => r.name === sk.role).name} · ${left}/2</span></button>`;
  }).join('');
  // 场地
  $('fieldGuide').innerHTML = `<div class="hudlabel">场地 · 每轮开始</div>` + FIELD_RULES.map(f => `<div class="fgrow" style="--c:${ELEMENTS[f.el].color}"><b>${ELEMENTS[f.el].name}</b><span>生 ${f.gen} · 同 ${f.equal} · 克 ${f.over}</span></div>`).join('');
  // 记录
  $('log').innerHTML = g.log.slice(-40).map(l => `<div class="hrow ${l.kind}"><span class="hk">${KIND[l.kind] || '·'}</span><span>${l.text}</span></div>`).join('');
  $('log').scrollTop = $('log').scrollHeight;
  // 预览
  renderPreview();
  renderPrompt();
  $('btnEnd').disabled = !(g.turn === HUMAN && !g.over);
}

function renderPreview() {
  const g = S.g, el = $('preview');
  if (!g) { el.innerHTML = '<div class="hudhint">点击手牌落子 · 点击场上牌攻击或移动</div>'; return; }
  if (S.pending && S.sel && S.sel.type === 'unit') {
    const fc = E.forecast(g, HUMAN, S.pending.from, S.pending.to);
    const a = E.unitAt(g, S.pending.from), t = E.unitAt(g, S.pending.to);
    if (fc && a && t) {
      const bits = [];
      if (fc.over) bits.push('克制+1');
      if (fc.fieldDmg) bits.push('场地' + (fc.fieldDmg > 0 ? '+1' : '-1'));
      if (fc.mult > 1) bits.push('入×' + fc.mult);
      if (fc.absorbed) bits.push('盾挡' + fc.absorbed);
      if (fc.armor) bits.push('减伤' + fc.armor);
      if (fc.vuln) bits.push('增伤' + fc.vuln);
      el.innerHTML = `<div class="fcname">${a.card.name} → ${t.card.name}</div><div class="fcdmg">${fc.dmg}<small style="font-size:11px"> 伤</small></div><div>${bits.join(' · ') || '无额外修正'} · ${a.atk} 攻 · 目标 ${t.hp} → ${fc.hpAfter} 血</div><div class="fck">${fc.kill ? '击杀' : '不击杀'}</div><div>再点一次「${t.card.name}」确认攻击，点别处取消</div>`;
      return;
    }
  }
  if (S.sel && S.sel.type === 'card') {
    const c = CARDS[S.sel.id];
    el.innerHTML = `<div class="pvname">${c.name} · ${c.atk}/${c.hp}</div><div>${c.attr}属${ELEMENTS[c.element].name} · 物象属${ELEMENTS[c.roleElement].name}</div><div class="hint">点击空席落子；新牌当回合不能行动</div>`;
    return;
  }
  if (S.sel && S.sel.type === 'unit') {
    const u = E.unitAt(g, S.sel.slot);
    if (!u) { el.innerHTML = '<div class="hudhint">这个位置已经空了</div>'; return; }
    const bits = [];
    if (u.weapon) bits.push(u.weapon.name);
    if (u.fieldDmg) bits.push('伤' + (u.fieldDmg > 0 ? '+1' : '-1'));
    if (u.fieldArmor) bits.push('减伤');
    if (u.fieldVuln) bits.push('增伤');
    if (u.burn) bits.push('烧' + u.burn);
    if (u.justPlayed) bits.push('刚落子'); else if (u.acted) bits.push('已行动');
    el.innerHTML = `<div class="pvname">${u.card.name} · ${u.atk}/${u.hp}</div><div>${u.owner === HUMAN ? '你' : '庄家'} · ${TRIGRAMS[u.slot].name}位 · ${bits.join(' · ') || '待命'}</div><div class="hint">点敌人攻击（再点确认） · 点相邻空位移动</div>`;
    return;
  }
  if (S.sel && S.sel.type === 'weapon') {
    const w = D.WEAPON_BY_KEY[S.sel.key];
    el.innerHTML = `<div class="pvname">${w.name}</div><div>${w.desc}</div><div class="hint">点一张能行动的己方牌装备</div>`;
    return;
  }
  if (S.sel && S.sel.type === 'skill') {
    const sk = D.SKILL_BY_KEY[S.sel.key];
    el.innerHTML = `<div class="pvname">${sk.name} · ${sk.attr}/${ROLES.find(r => r.name === sk.role).name}</div><div>${sk.desc}</div><div class="hint">点一张自己的牌施放</div>`;
    return;
  }
  if (S.preview) {
    if (S.preview.type === 'card') {
      const c = CARDS[S.preview.id];
      el.innerHTML = `<div class="pvname">${c.name} · ${c.atk}/${c.hp}</div><div>庄家手牌 · ${c.attr}/${c.role}</div>`;
      return;
    }
  }
  el.innerHTML = '<div class="hudhint">点击手牌落子 · 点击场上牌攻击或移动</div>';
}

function renderPrompt() {
  const g = S.g, el = $('prompt');
  if (!g) return;
  if (S.flash) { el.textContent = S.flash; return; }
  if (g.over) { el.textContent = '对局结束'; return; }
  if (g.turn === FOE) { el.textContent = '庄家行动中…'; return; }
  if (S.pending) { el.textContent = '再点一次目标确认攻击 · 点别处取消'; return; }
  if (S.mode === 'place') { el.textContent = '落子：点一个空位'; return; }
  if (S.mode === 'unit' && S.sel && S.sel.slot) {
    const u = E.unitAt(g, S.sel.slot);
    let bar = '';
    if (u && u.owner === HUMAN) {
      const b = [];
      if (E.defendValid(g, HUMAN, S.sel.slot, 'hasty').ok) b.push(`<button class="dbtn" data-defend="hasty" data-slot="${S.sel.slot}">仓促防御</button>`);
      if (E.defendValid(g, HUMAN, S.sel.slot, 'firm').ok) b.push(`<button class="dbtn" data-defend="firm" data-slot="${S.sel.slot}">坚守防御</button>`);
      if (E.defendValid(g, HUMAN, S.sel.slot, 'cancel').ok) b.push(`<button class="dbtn warn" data-defend="cancel" data-slot="${S.sel.slot}">解除坚守</button>`);
      if (b.length) bar = ' ' + b.join('');
    }
    el.innerHTML = '点敌人攻击 · 点相邻空位移动' + bar;
    return;
  }
  if (S.mode === 'equip') { el.textContent = '装备：点一张能行动的己方牌'; return; }
  if (S.mode === 'skill') { el.textContent = `技能「${D.SKILL_BY_KEY[S.sel.key].name}」：点自己的牌`; return; }
  if (S.mode === 'zhi') { el.textContent = '止：点范围内敌人'; return; }
  if (S.mode === 'cheng') { el.textContent = '承载：点手牌武器换上'; return; }
  if (S.mode === 'dong') { el.textContent = '动：点相邻友军'; return; }
  el.textContent = `落子 1 张 · 场上每张牌行动一次 · 技能 ${g.skillsLeft}/2`;
}

/* ---------- 交互 ---------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
function pick(e) {
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const objs = [...handGroup.children, ...boardGroup.children, ...slotGroup.children, ...oppGroup.children];
  const hits = raycaster.intersectObjects(objs, false);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.kind) o = o.parent;
  return o ? o.userData : null;
}
function clearSel() { S.sel = null; S.mode = null; S.extra = null; S.pending = null; }
function refresh() { playNewLogs(); syncScene(); renderHud(); updateTerm(); }

/* 把 engine 的新日志翻成声音与镜头震动，AI 的行动也能听到 */
function playNewLogs() {
  const g = S.g;
  if (!g) return;
  if (!S.logSeen) { S.logSeen = g.log.length; return; }
  if (S.logSeen > g.log.length) S.logSeen = 0;
  const fresh = g.log.slice(S.logSeen);
  S.logSeen = g.log.length;
  if (!fresh.length) return;
  const kinds = new Set(fresh.map(l => l.kind));
  if (kinds.has('death')) { SFX.kill(); S.shake = 0.12; }
  else if (kinds.has('attack')) { SFX.hit(); S.shake = 0.055; }
  else if (kinds.has('skill')) SFX.skill();
  else if (kinds.has('place')) SFX.place();
  else if (kinds.has('equip')) SFX.equip();
  else if (kinds.has('defend')) SFX.defend();
  else if (kinds.has('move')) SFX.move();
}

const SEASON = {
  wood:  { tint: 0xc2d2bd, fog: 0x0c1412, cols: [0xd6a7ae, 0xa9c39b, 0xe0c7a1], size: 0.04 },
  fire:  { tint: 0xd2b6a0, fog: 0x120c0a, cols: [0xd06a3a, 0xe0a85a, 0xb4472f], size: 0.038 },
  earth: { tint: 0xc6b79f, fog: 0x14100c, cols: [0xb9a07a, 0x8e7a5b, 0xd0bd9a], size: 0.04 },
  metal: { tint: 0xcfc6a8, fog: 0x121210, cols: [0xc2a24c, 0x8a6a3a, 0xd6c48c], size: 0.045 },
  water: { tint: 0xaebfc6, fog: 0x0a1012, cols: [0xe4edf0, 0xb9cdd4, 0x8fa8b0], size: 0.05 },
};
function applySeason(el) {
  const s = SEASON[el] || SEASON.wood;
  if (S.weather === el) return;
  S.weather = el;
  sky.material.color.setHex(s.tint);
  scene.fog.color.setHex(s.fog);
  if (!particles) return;
  particles.material.size = s.size;
  const col = particles.geometry.attributes.color;
  for (let i = 0; i < particleCount; i++) {
    const c = new THREE.Color(s.cols[i % s.cols.length]);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

function updateTerm() {
  if (!S.g) return;
  applySeason(S.g.term.element);
  if (S.lastTerm !== S.g.term.name || S.lastRound !== S.g.round) {
    S.lastTerm = S.g.term.name; S.lastRound = S.g.round;
    const el = $('termFlash');
    el.innerHTML = `<div class="tf1">${S.g.term.name}</div><div class="tf2">${S.g.term.zhong}</div><div class="tf3">场地效果刷新</div>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2100);
    SFX.month();
  }
}
function onHand(id, index) {
  const g = S.g;
  if (!g || g.over) return;
  if (g.turn !== HUMAN) { S.preview = { type: 'card', id }; renderPreview(); return; }
  if (g.players[HUMAN].cardState[id] !== 'hand') return;
  if (S.sel && S.sel.type === 'card' && S.sel.id === id) { clearSel(); refresh(); return; }
  S.sel = { type: 'card', id }; S.mode = 'place'; S.preview = null; S.pending = null;
  refresh();
}
function onUnit(slot) {
  const g = S.g;
  if (!g || g.over) return;
  const u = E.unitAt(g, slot);
  if (!u) return;
  if (g.turn !== HUMAN) { S.preview = { type: 'unit', slot }; S.sel = { type: 'unit', slot }; S.mode = null; refresh(); return; }
  if (S.mode === 'unit' && S.sel && S.sel.slot) {
    if (u.owner !== HUMAN && E.attackTargets(g, HUMAN, S.sel.slot).includes(slot)) {
      if (!S.pending || S.pending.from !== S.sel.slot || S.pending.to !== slot) {
        S.pending = { from: S.sel.slot, to: slot };
        refresh();
        return;
      }
      const fc = E.forecast(g, HUMAN, S.sel.slot, slot);
      const r = E.attack(g, HUMAN, S.sel.slot, slot);
      if (!r.ok) { flashMsg(r.msg); return; }
      if (fc && fc.kill) {
        const el = $('termFlash');
        el.innerHTML = '<div class="tf1">杀</div><div class="tf2">' + fc.dmg + ' 伤 · 击杀</div>';
        el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 800);
      }
      clearSel(); refresh(); checkOver();
      return;
    }
  }
  if (S.mode === 'equip' && S.sel && S.sel.type === 'weapon') {
    if (u.owner === HUMAN && E.equipTargets(g, HUMAN).includes(slot)) {
      const r = E.equip(g, HUMAN, S.sel.key, slot);
      if (!r.ok) { flashMsg(r.msg); return; }
      clearSel(); refresh(); checkOver(); return;
    }
  }
  if (S.mode === 'skill' && S.sel && S.sel.type === 'skill') {
    if (u.owner === HUMAN && E.skillTargets(g, HUMAN).includes(slot)) {
      const sk = S.sel.key;
      if (sk === 'zhi') {
        if (!E.rangeEnemies(g, slot).length) { flashMsg('该牌范围内没有敌人'); return; }
        S.extra = { slot }; S.mode = 'zhi'; refresh(); return;
      }
      if (sk === 'chengzai') {
        if (!g.players[HUMAN].weapons.length) { flashMsg('手上没有装备'); return; }
        S.extra = { slot }; S.mode = 'cheng'; refresh(); return;
      }
      if (sk === 'dong' && E.skillMatches(u, D.SKILL_BY_KEY[sk]) === 2) {
        const allies = E.adjacent(slot).filter(k => { const a = E.unitAt(g, k); return a && a.owner === HUMAN; });
        if (!allies.length) { flashMsg('没有相邻友军'); return; }
        S.extra = { slot }; S.mode = 'dong'; refresh(); return;
      }
      const r = E.useSkill(g, HUMAN, sk, slot, null);
      if (!r.ok) { flashMsg(r.msg); return; }
      clearSel(); refresh(); checkOver(); return;
    }
  }
  if (S.mode === 'zhi' && S.extra) {
    if (u.owner !== HUMAN && E.rangeEnemies(g, S.extra.slot).includes(slot)) {
      const r = E.useSkill(g, HUMAN, S.sel.key, S.extra.slot, slot);
      if (!r.ok) { flashMsg(r.msg); return; }
      clearSel(); refresh(); checkOver(); return;
    }
  }
  if (S.mode === 'dong' && S.extra) {
    if (u.owner === HUMAN && E.adjacent(S.extra.slot).includes(slot)) {
      const r = E.useSkill(g, HUMAN, S.sel.key, S.extra.slot, slot);
      if (!r.ok) { flashMsg(r.msg); return; }
      clearSel(); refresh(); checkOver(); return;
    }
  }
  S.preview = null; S.pending = null;
  S.sel = { type: 'unit', slot };
  S.mode = u.owner === HUMAN && E.canUnitAct(g, HUMAN, u) ? 'unit' : null;
  refresh();
}
function onSlot(slot) {
  const g = S.g;
  if (!g || g.over || g.turn !== HUMAN) return;
  if (S.mode === 'place' && S.sel && S.sel.type === 'card') {
    const r = E.place(g, HUMAN, S.sel.id, slot);
    if (!r.ok) { flashMsg(r.msg); return; }
    clearSel(); refresh(); checkOver(); return;
  }
  if (S.mode === 'unit' && S.sel && S.sel.slot) {
    if (!E.unitAt(g, slot) && E.moveTargets(g, HUMAN, S.sel.slot).includes(slot)) {
      const r = E.move(g, HUMAN, S.sel.slot, slot);
      if (!r.ok) { flashMsg(r.msg); return; }
      clearSel(); refresh(); checkOver(); return;
    }
  }
  const u = E.unitAt(g, slot);
  if (u) { onUnit(slot); return; }
  clearSel(); refresh();
}
function checkOver() { if (S.g && S.g.over) setTimeout(showResult, 500); }

function onWeapon(wk) {
  const g = S.g;
  if (!g || g.over) return;
  if (S.mode === 'cheng' && S.extra && S.sel && S.sel.type === 'skill') {
    const r = E.useSkill(g, HUMAN, S.sel.key, S.extra.slot, wk);
    if (!r.ok) { flashMsg(r.msg); return; }
    clearSel(); refresh(); checkOver(); return;
  }
  if (S.sel && S.sel.type === 'weapon' && S.sel.key === wk) { clearSel(); refresh(); return; }
  S.sel = { type: 'weapon', key: wk }; S.mode = 'equip'; S.pending = null;
  refresh();
}
function onSkill(key) {
  const g = S.g, p = g.players[HUMAN];
  if (!g || g.over || g.turn !== HUMAN) return;
  if (g.skillsLeft <= 0 || g.skillsUsedThisTurn[key] || (p.skillUses[key] || 0) >= 2) {
    flashMsg(g.skillsLeft <= 0 ? '本手技能已用完' : g.skillsUsedThisTurn[key] ? '本手已用过' : '这张技能整局已用完');
    return;
  }
  if (S.sel && S.sel.type === 'skill' && S.sel.key === key) { clearSel(); refresh(); return; }
  S.sel = { type: 'skill', key }; S.mode = 'skill'; S.pending = null;
  refresh();
}
function endTurn() {
  if (!S.g || S.g.over || S.g.turn !== HUMAN) return;
  E.endTurn(S.g);
  clearSel(); refresh(); checkOver();
  if (S.g && !S.g.over && S.g.turn === FOE) startAI();
}
function startAI() {
  clearTimeout(S.aiTimer);
  if (!S.g || S.g.over || S.g.turn !== FOE) return;
  S.aiTimer = setTimeout(() => {
    if (!S.g || S.g.over || S.g.turn !== FOE) return;
    const r = AI.step(S.g, FOE);
    clearSel(); refresh();
    if (S.g.over) { setTimeout(showResult, 500); return; }
    if (!r.done) startAI();
    else if (S.g.turn === FOE) startAI();
  }, 620);
}

/* ---------- 开始 / 规则 / 结算 ---------- */
function showStart() {
  const el = $('screens');
  el.innerHTML = `<div class="panel startpanel">
    <div class="kick">BAGUA DUEL · 3D</div>
    <h1>八卦对决</h1>
    <p class="lead">两个人面对面，中间一张八卦盘；开局纯黑。<br>每人 4 属性 × 8 张 = 32 张牌库；本局随机取 2 属性 × 4 张 = 8 张出战；场上最多 3 张。</p>
    <div class="diffhead">人机难度</div>
    <div class="diffbtns">${DIFFICULTY.map(d => `<button class="diff ${S.difficulty === d.key ? 'sel' : ''}" data-diff="${d.key}"><b>${d.name}</b><span>${d.desc}</span></button>`).join('')}</div>
    <div class="startbtns"><button class="primary" id="btnStart">入座</button><button id="btnRules2">规则</button></div>
    <div class="startfoot">3D 山巅 · 第一人称 · 64 张卡图已接入</div>
  </div>`;
  el.classList.add('show');
  el.querySelectorAll('.diff').forEach(b => b.onclick = () => { S.difficulty = b.dataset.diff; el.querySelectorAll('.diff').forEach(x => x.classList.toggle('sel', x === b)); });
  $('btnStart').onclick = () => { el.classList.remove('show'); startGame(); };
  $('btnRules2').onclick = showRules;
}
function showRules() {
  const el = $('screens');
  el.innerHTML = `<div class="panel rulespanel">
    <div class="phead"><h2>规则</h2><button id="rulesClose">收起</button></div>
    <div class="rulegrid">
      <div><b>牌组</b><p>8 属性 × 8 家庭成员共 64 张；每人随机 4 属性组成 32 张牌库；本局随机取 2 属性 × 4 张 = 8 张；场上最多 3 张。</p></div>
      <div><b>行动</b><p>每回合落 1 张；场上每张牌各攻击 / 装备 / 移动一次；技能最多 2 张，每张整局 2 次。</p></div>
      <div><b>落子</b><p>属性同席 +2/+4；席生牌 +4 血；席克牌 -2 攻；物象同席 +2/+4。移动不触发。</p></div>
      <div><b>场地</b><p>每轮开始按卦位五行触发：相生、同五行、相克各有不同效果；灼烧 2 回合，临时盾整轮。</p></div>
      <div><b>战斗</b><p>近战/盾/空手距离 1，远程和长枪距离 2；克制方伤害 +1；无反击。</p></div>
      <div><b>胜负</b><p>一方 8 张人物牌全部失去即负。</p></div>
    </div>
    <div class="rulesfoot">点击手牌→空位落子；点击己方牌→攻击/移动；点敌人第一次看预演，再点确认。</div>
  </div>`;
  el.classList.add('show');
  $('rulesClose').onclick = () => { if (!S.g) showStart(); else el.classList.remove('show'); };
}
function showResult() {
  const g = S.g; if (!g) return;
  const win = g.winner === HUMAN;
  const el = $('screens');
  el.innerHTML = `<div class="panel resultpanel">
    <div class="kick">${win ? 'WIN' : 'LOSE'}</div>
    <h1>${win ? '你赢了' : '庄家赢了'}</h1>
    <p class="lead">${win ? '庄家 8 张人物牌尽失。' : '你的 8 张人物牌尽失。'}</p>
    <div class="resultrow">
      <div><b>你</b><span>余 ${E.remaining(g.players[0])}/8</span></div>
      <div><b>庄家</b><span>余 ${E.remaining(g.players[1])}/8</span></div>
      <div><b>历时</b><span>${g.turnNo} 手 · ${g.round} 轮</span></div>
    </div>
    <div class="startbtns"><button class="primary" id="btnAgain">再来一局</button><button id="btnMenu">回到封面</button></div>
  </div>`;
  el.classList.add('show');
  SFX.result(win);
  $('btnAgain').onclick = () => { el.classList.remove('show'); startGame(); };
  $('btnMenu').onclick = () => { S.g = null; clearSel(); showStart(); };
}
function startGame() {
  SFX.init();
  S.g = E.newGame({ difficulty: S.difficulty });
  clearSel(); S.preview = null; S.lastTerm = ''; S.lastRound = 0; S.logSeen = 0; S.shake = 0;
  matGroup.rotation.y = S.g.humanSeat === 'S' ? Math.PI : 0;
  makeSlotRings();
  syncScene(); renderHud(); updateTerm();
  if (S.g.turn === FOE) startAI();
}

/* ---------- 事件 ---------- */
canvas.addEventListener('pointermove', e => {
  const hit = pick(e);
  const id = hit ? hit.kind + ':' + (hit.slot || hit.id || '') : null;
  if (id !== S.hover) {
    S.hover = id;
    for (const m of handGroup.children) {
      const on = hit && hit.kind === 'hand' && m.userData.id === hit.id;
      m.position.y = VIEW.handY + (on ? 0.06 : (S.sel && S.sel.type === 'card' && S.sel.id === m.userData.id ? 0.10 : 0));
    }
    canvas.style.cursor = hit ? 'pointer' : 'default';
  }
});
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const hit = pick(e);
  if (!hit) { if (!S.pending) { clearSel(); refresh(); } return; }
  if (hit.kind === 'hand') onHand(hit.id, hit.index);
  else if (hit.kind === 'unit') onUnit(hit.slot);
  else if (hit.kind === 'slot') onSlot(hit.slot);
  else if (hit.kind === 'opphand') { S.preview = { type: 'card', id: hit.id }; renderPreview(); }
});
$('btnEnd').addEventListener('click', endTurn);
$('btnRules').addEventListener('click', showRules);
$('weapons').addEventListener('click', e => { const b = e.target.closest('[data-weapon]'); if (b) onWeapon(b.dataset.weapon); });
$('skills').addEventListener('click', e => { const b = e.target.closest('[data-skill]'); if (b) onSkill(b.dataset.skill); });
$('prompt').addEventListener('click', e => {
  const b = e.target.closest('[data-defend]');
  if (!b || !S.g || S.g.over) return;
  const r = E.defend(S.g, HUMAN, b.dataset.slot, b.dataset.defend);
  if (!r.ok) { flashMsg(r.msg); return; }
  clearSel(); refresh(); checkOver();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitView();
  if (S.g) refresh();
});

/* ---------- 渲染循环 ---------- */
let hoverT = 0;
function animate(ts) {
  requestAnimationFrame(animate);
  taijiBig.rotation.z = -ts * 0.00012;
  taijiSmall.rotation.z = ts * 0.00035;
  // 松与鹤的微动，别让场景完全静止
  pineGroup.rotation.z = Math.sin(ts * 0.00055) * 0.008;
  craneGroup.position.y = 0.02 + Math.sin(ts * 0.001) * 0.008;
  craneGroup.rotation.y = -0.5 + Math.sin(ts * 0.0004) * 0.04;
  oppFigure.position.y = Math.sin(ts * 0.0009) * 0.006;
  // 云海流动
  for (const m of cloudLayers) {
    m.material.map.offset.x += m.userData.speed;
    m.material.map.offset.y += m.userData.speed * 0.35;
  }
  // 节气粒子：春花瓣横飞、夏火星上升、秋叶下落、冬雪缓落
  const pos = particles.geometry.attributes.position.array;
  const el = S.weather;
  for (let i = 0; i < particleCount; i++) {
    if (el === 'water') {
      pos[i * 3] += Math.sin(ts * 0.0009 + i) * 0.0012;
      pos[i * 3 + 1] -= 0.0045 + (i % 4) * 0.0007;
      if (pos[i * 3 + 1] < 0.1) { pos[i * 3 + 1] = 2.6; pos[i * 3] = (Math.random() - 0.5) * 5.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 4.4; }
    } else if (el === 'metal') {
      pos[i * 3] += 0.004 + Math.sin(ts * 0.001 + i) * 0.0015;
      pos[i * 3 + 1] -= 0.0022;
      if (pos[i * 3 + 1] < 0.1 || pos[i * 3] > 6) { pos[i * 3] = -6; pos[i * 3 + 1] = 0.4 + Math.random() * 2.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 4.4; }
    } else if (el === 'fire') {
      pos[i * 3] += Math.sin(ts * 0.0013 + i) * 0.0015;
      pos[i * 3 + 1] += 0.0025 + (i % 5) * 0.0004;
      if (pos[i * 3 + 1] > 2.9) { pos[i * 3 + 1] = 0.15; pos[i * 3] = (Math.random() - 0.5) * 5.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 4.4; }
    } else {
      pos[i * 3] += 0.0032 + (i % 5) * 0.0008;
      pos[i * 3 + 1] += Math.sin(ts * 0.0007 + i) * 0.0004;
      if (pos[i * 3] > 6) {
        pos[i * 3] = -6;
        pos[i * 3 + 1] = 0.15 + Math.random() * 2.4;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 4.4;
      }
    }
  }
  particles.geometry.attributes.position.needsUpdate = true;
  // 轻微视差
  if (!S.pending) {
    camera.position.x += ((pointer.x * 0.10) - camera.position.x) * 0.04;
    camera.position.y += ((VIEW.camY + pointer.y * 0.05) - camera.position.y) * 0.04;
    camera.lookAt(camTarget);
  }
  // 命中震屏
  if (S.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * S.shake;
    camera.position.y += (Math.random() - 0.5) * S.shake * 0.7;
    S.shake *= 0.86;
  } else S.shake = 0;
  renderer.render(scene, camera);
}

makeSlotRings();
showStart();
requestAnimationFrame(animate);
