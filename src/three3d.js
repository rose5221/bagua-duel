/* 八卦对决 · three.js 3D 版
   3D 圆桌 + 八卦盘 + 两位对手 + 3D 手牌/场上牌；规则复用 Engine。 */
import * as THREE from '../vendor/three.module.js';

const D = window.DATA, E = window.Engine, AI = window.AI;
const { ELEMENTS, TRIGRAMS, ROLES, CARDS, SKILLS, DIFFICULTY, FIELD_RULES, SEATS } = D;
const HUMAN = 0, FOE = 1;
const S = {
  g: null, sel: null, mode: null, extra: null, pending: null, preview: null,
  difficulty: 'normal', aiTimer: 0, hover: null, lastTerm: '', lastRound: 0, flash: '', flashTimer: 0,
};

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
scene.background = new THREE.Color(0x050607);
scene.fog = new THREE.Fog(0x050607, 7.5, 15);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0, 1.95, 3.35);
const camTarget = new THREE.Vector3(0, 0.28, -0.05);
camera.lookAt(camTarget);

scene.add(new THREE.AmbientLight(0xbfc2b8, 0.5));
const spot = new THREE.SpotLight(0xffe6c0, 2.6, 10, Math.PI / 4.2, 0.55, 1.2);
spot.position.set(0.2, 4.4, 1.4);
spot.target.position.set(0, 0, -0.3);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0005;
scene.add(spot, spot.target);
const rim = new THREE.PointLight(0x6d8a90, 18, 9, 2);
rim.position.set(-2.6, 2.4, -2.2);
scene.add(rim);

/* ---------- 圆桌 ---------- */
function woodMat() {
  return new THREE.MeshStandardMaterial({ color: 0xc7b08c, roughness: 0.72, metalness: 0.04 });
}
const table = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.14, 80), woodMat());
table.position.y = 0; table.receiveShadow = true; table.castShadow = true;
scene.add(table);
const edge = new THREE.Mesh(new THREE.CylinderGeometry(2.37, 2.37, 0.035, 80), new THREE.MeshStandardMaterial({ color: 0x8a7456, roughness: 0.8 }));
edge.position.y = -0.08; edge.receiveShadow = true; scene.add(edge);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.05, 1.9, 48), new THREE.MeshStandardMaterial({ color: 0xa38c6c, roughness: 0.85 }));
pedestal.position.y = -1.0; pedestal.castShadow = true; pedestal.receiveShadow = true; scene.add(pedestal);
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0x0a0c0d, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -1.95; floor.receiveShadow = true; scene.add(floor);

/* ---------- 八卦垫 ---------- */
function makeMatTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(512, 512, 120, 512, 512, 512);
  grd.addColorStop(0, '#f4eddc'); grd.addColorStop(0.72, '#e9e0cc'); grd.addColorStop(1, '#cfc2a6');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(23,25,27,.5)'; g.lineWidth = 4;
  g.beginPath(); g.arc(512, 512, 495, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.setLineDash([7, 11]);
  g.beginPath(); g.arc(512, 512, 455, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(23,25,27,.25)';
  g.beginPath(); g.arc(512, 512, 220, 0, Math.PI * 2); g.stroke();
  const ring = D.RING;
  ring.forEach((key, i) => {
    const t = TRIGRAMS[key], ec = ELEMENTS[t.element];
    const a = i * Math.PI / 4;
    const x = 512 + Math.sin(a) * 405, y = 512 - Math.cos(a) * 405;
    g.save(); g.translate(x, y);
    g.fillStyle = '#17191b'; g.textAlign = 'center';
    g.font = 'bold 54px "Songti SC","STSong",serif';
    g.fillText(t.sym, 0, -26);
    g.font = 'bold 34px "Songti SC","STSong",serif';
    g.fillText(t.name, 0, 16);
    g.font = '20px "PingFang SC","Heiti SC",sans-serif';
    g.fillStyle = ec.color;
    g.fillText(t.dir + ' · ' + ec.name, 0, 46);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
const matGroup = new THREE.Group();
scene.add(matGroup);
const mat = new THREE.Mesh(new THREE.CircleGeometry(1.66, 96), new THREE.MeshStandardMaterial({ map: makeMatTexture(), roughness: 0.9 }));
mat.rotation.x = -Math.PI / 2; mat.position.y = 0.078; mat.receiveShadow = true;
matGroup.add(mat);

/* 太极纹理 */
function taijiTexture(fire) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = '#f7f3e8'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#17191b'; g.lineWidth = 5; g.stroke();
  g.fillStyle = fire ? '#b4472f' : '#17191b';
  g.beginPath();
  g.arc(128, 128, 62, -Math.PI / 2, Math.PI / 2, false);
  g.arc(128, 190, 31, Math.PI / 2, -Math.PI / 2, true);
  g.arc(128, 66, 31, Math.PI / 2, -Math.PI / 2, false);
  g.closePath(); g.fill();
  g.beginPath(); g.arc(128, 66, 11, 0, Math.PI * 2); g.fillStyle = '#f7f3e8'; g.fill();
  g.beginPath(); g.arc(128, 190, 11, 0, Math.PI * 2); g.fillStyle = fire ? '#b4472f' : '#17191b'; g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
const taijiBig = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), new THREE.MeshBasicMaterial({ map: taijiTexture(false), transparent: true }));
taijiBig.rotation.x = -Math.PI / 2; taijiBig.position.y = 0.086; matGroup.add(taijiBig);
const taijiSmall = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), new THREE.MeshBasicMaterial({ map: taijiTexture(true), transparent: true }));
taijiSmall.rotation.x = -Math.PI / 2; taijiSmall.position.set(0.33, 0.088, 0.33); matGroup.add(taijiSmall);

/* ---------- 卡牌纹理 ---------- */
const cardTexCache = new Map();
function cardTexture(card, u) {
  const key = [card.id, u.owner, u.atk, u.hp, u.maxHp, u.weapon ? u.weapon.key : '', u.fieldDmg, u.fieldArmor, u.fieldVuln, u.fieldBurnOnHit, u.burn, u.justPlayed, u.acted, u.extraActions, !!u.selected].join('|');
  if (cardTexCache.has(key)) return cardTexCache.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 352;
  const g = c.getContext('2d');
  const ec = ELEMENTS[card.element], rc = ELEMENTS[card.roleElement];
  g.fillStyle = '#f7f3e8'; g.fillRect(0, 0, 256, 352);
  g.fillStyle = ec.color; g.fillRect(0, 0, 256, 12);
  g.strokeStyle = '#17191b'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 346);
  g.strokeStyle = u.owner === 0 ? '#b4472f' : '#3f6e7a'; g.lineWidth = 7; g.strokeRect(9, 9, 238, 334);
  g.fillStyle = ec.color; g.font = 'bold 40px "Songti SC",serif'; g.textAlign = 'center';
  g.fillText(card.sym, 128, 58);
  g.fillStyle = ec.color + '22'; g.fillRect(18, 72, 220, 150);
  g.fillStyle = rc.color; g.beginPath(); g.arc(128, 142, 52, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f7f3e8'; g.font = 'bold 46px "Songti SC",serif';
  g.fillText(card.role, 128, 158);
  g.fillStyle = '#17191b'; g.font = 'bold 25px "Songti SC",serif';
  g.fillText(card.name, 128, 262);
  g.fillStyle = '#4b5257'; g.font = '16px "PingFang SC",sans-serif';
  g.fillText(card.attr + ' · ' + card.role, 128, 288);
  // 数值
  g.fillStyle = '#17191b'; g.beginPath(); g.arc(44, 322, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f7f3e8'; g.font = 'bold 20px monospace'; g.fillText(String(u.atk), 44, 329);
  g.fillStyle = '#f7f3e8'; g.beginPath(); g.arc(212, 322, 22, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#17191b'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#17191b'; g.fillText(String(u.hp), 212, 329);
  // 装备/场地小字
  const tags = [];
  if (u.weapon) tags.push(u.weapon.name);
  if (u.fieldDmg) tags.push('伤' + (u.fieldDmg > 0 ? '+1' : '-1'));
  if (u.fieldArmor) tags.push('减伤');
  if (u.fieldVuln) tags.push('增伤');
  if (u.fieldBurnOnHit) tags.push('火');
  if (u.burn) tags.push('烧' + u.burn);
  if (u.justPlayed) tags.push('新');
  else if (u.acted) tags.push('已');
  if (u.extraActions) tags.push('+' + u.extraActions + '行');
  if (tags.length) {
    g.fillStyle = '#17191b'; g.font = 'bold 13px monospace'; g.textAlign = 'left';
    g.fillText(tags.join(' '), 16, 348);
  }
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
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 40), new THREE.MeshBasicMaterial({ color: 0x17191b, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(p);
    ring.userData = { kind: 'slot', slot: key };
    slotGroup.add(ring);
  }
}

/* ---------- 对手模型 ---------- */
const oppFigure = new THREE.Group();
{
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.05, 20), new THREE.MeshStandardMaterial({ color: 0x161a1c, roughness: 0.9 }));
  robe.position.y = 0.52; robe.castShadow = true; oppFigure.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 18), new THREE.MeshStandardMaterial({ color: 0xc9bfa9, roughness: 0.85 }));
  head.position.y = 1.18; head.castShadow = true; oppFigure.add(head);
  const mask = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshStandardMaterial({ color: 0xf7f3e8, roughness: 0.9, side: THREE.DoubleSide }));
  mask.position.set(0, 1.16, 0.2); oppFigure.add(mask);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb4472f });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), eyeMat); eL.position.set(-0.055, 1.19, 0.205); oppFigure.add(eL);
  const eR = eL.clone(); eR.position.x = 0.055; oppFigure.add(eR);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.17, 24), new THREE.MeshStandardMaterial({ color: 0x0b0e10, roughness: 0.9 }));
  hat.position.y = 1.42; hat.castShadow = true; oppFigure.add(hat);
}
oppFigure.position.set(0, 0, -2.7);
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
const KIND = { month: '月', turn: '手', place: '出', attack: '攻', equip: '装', move: '移', skill: '技', death: '亡', end: '终', term: '场' };
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
    const m = makeCardMesh(tex, 0.54, 0.75);
    const p = slotPos(key, 1.12);
    m.position.set(p.x, 0.42, p.z);
    m.rotation.x = -0.42;
    m.rotation.y = Math.atan2(-p.x, -p.z);
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
    const m = makeCardMesh(tex, 0.34, 0.48);
    m.position.set((i - 3.5) * 0.27, sel ? 0.48 : 0.32, 1.72 - Math.abs(i - 3.5) * 0.012);
    m.rotation.x = -0.38; m.rotation.y = -(i - 3.5) * 0.04;
    m.userData = { kind: 'hand', index: i, id };
    handGroup.add(m);
  });
  // 对手手牌（公开）
  g.players[FOE].hand.forEach((id, i) => {
    const st = g.players[FOE].cardState[id];
    if (st !== 'hand') return;
    const card = CARDS[id];
    const tex = cardTexture(card, { owner: 1, atk: card.atk, hp: card.hp, maxHp: card.hp, weapon: null, fieldDmg: 0, fieldArmor: 0, fieldVuln: 0, fieldBurnOnHit: false, burn: 0, justPlayed: false, acted: false, extraActions: 0, selected: false });
    const m = makeCardMesh(tex, 0.24, 0.33);
    m.position.set((i - 3.5) * 0.22, 0.58, -1.86);
    m.rotation.x = 0.42; m.rotation.y = Math.PI;
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
    const on = v.slots.includes(ring.userData.slot);
    ring.material.color.set(on ? 0xb4472f : 0x17191b);
    ring.material.opacity = on ? 0.85 : 0.3;
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
  if (S.mode === 'unit') { el.textContent = '点敌人攻击 · 点相邻空位移动'; return; }
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
function refresh() { syncScene(); renderHud(); updateTerm(); }
function updateTerm() {
  if (!S.g) return;
  if (S.lastTerm !== S.g.term.name || S.lastRound !== S.g.round) {
    S.lastTerm = S.g.term.name; S.lastRound = S.g.round;
    const el = $('termFlash');
    el.innerHTML = `<div class="tf1">${S.g.term.name}</div><div class="tf2">${S.g.term.zhong}</div><div class="tf3">场地效果刷新</div>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2100);
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
    <p class="lead">两个人面对面，中间一张八卦盘；开局纯黑。<br>每人 2 属性 × 各 4 张人物牌，共 8 张；场上最多 3 张。</p>
    <div class="diffhead">人机难度</div>
    <div class="diffbtns">${DIFFICULTY.map(d => `<button class="diff ${S.difficulty === d.key ? 'sel' : ''}" data-diff="${d.key}"><b>${d.name}</b><span>${d.desc}</span></button>`).join('')}</div>
    <div class="startbtns"><button class="primary" id="btnStart">入座</button><button id="btnRules2">规则</button></div>
    <div class="startfoot">3D 圆桌 · 第一人称 · 占位牌面</div>
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
      <div><b>牌组</b><p>8 属性 × 8 家庭成员共 64 张；每人随机 2 属性 × 4 张 = 8 张；场上最多 3 张。</p></div>
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
  $('btnAgain').onclick = () => { el.classList.remove('show'); startGame(); };
  $('btnMenu').onclick = () => { S.g = null; clearSel(); showStart(); };
}
function startGame() {
  S.g = E.newGame({ difficulty: S.difficulty });
  clearSel(); S.preview = null; S.lastTerm = ''; S.lastRound = 0;
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
      m.position.y = on ? 0.4 : (S.sel && S.sel.type === 'card' && S.sel.id === m.userData.id ? 0.48 : 0.32);
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- 渲染循环 ---------- */
let hoverT = 0;
function animate(ts) {
  requestAnimationFrame(animate);
  taijiBig.rotation.z = -ts * 0.00012;
  taijiSmall.rotation.z = ts * 0.00035;
  // 天气
  const pos = particles.geometry.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    pos[i * 3 + 1] -= 0.0016 + (i % 7) * 0.00022;
    pos[i * 3] += Math.sin(ts * 0.0004 + i) * 0.0006;
    if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 2.6; pos[i * 3] = (Math.random() - 0.5) * 5.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 4.4; }
  }
  particles.geometry.attributes.position.needsUpdate = true;
  // 轻微视差
  if (!S.pending) {
    camera.position.x += ((pointer.x * 0.12) - camera.position.x) * 0.04;
    camera.position.y += ((1.9 + pointer.y * 0.05) - camera.position.y) * 0.04;
    camera.lookAt(camTarget);
  }
  renderer.render(scene, camera);
}

makeSlotRings();
showStart();
requestAnimationFrame(animate);
