/* 像素战斗特效：从牌桌记录里读技能 / 攻击 / 防御 / 装备 / 阵亡，在目标卡上画像素特效 */
(function () {
  const canvas = document.getElementById('pixelFx');
  const arena = document.querySelector('.arena');
  const history = document.getElementById('history');
  if (!canvas || !arena || !history) return;
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1;
  let lastRows = 0;
  let first = true;
  const effects = [];
  const lastRects = new Map();
  const skillColors = {
    刚健: '#d8c47a', 口舌: '#d6785e', 光明: '#f0d88a', 动: '#7fc4b0',
    入: '#8fbf7a', 险: '#c4472f', 止: '#9fb4bb', 承载: '#c2a24c',
  };

  function resize() {
    const r = arena.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width / 2));
    H = Math.max(1, Math.floor(r.height / 2));
    canvas.width = W; canvas.height = H;
  }

  function unitRect(name) {
    if (!name) return null;
    const units = [...document.querySelectorAll('.unit')];
    for (const u of units) {
      const n = u.querySelector('.uname');
      if (n && n.textContent.trim() === name) {
        const r = u.getBoundingClientRect();
        const a = arena.getBoundingClientRect();
        return { x: (r.left + r.width / 2 - a.left) / 2, y: (r.top + r.height / 2 - a.top) / 2, r };
      }
    }
    return lastRects.get(name) || null;
  }

  function spawn(kind, target, skill) {
    const rect = unitRect(target);
    if (!rect) return;
    const color = skillColors[skill] || (kind === 'attack' ? '#f7f3e8' : kind === 'defend' ? '#c2a24c' : kind === 'death' ? '#b4472f' : '#d8c47a');
    effects.push({
      kind, x: rect.x, y: rect.y, color,
      skill: skill || '', age: 0,
      life: kind === 'skill' ? 1.05 : kind === 'death' ? 0.9 : 0.68,
      seed: Math.random() * 10,
    });
  }

  function scan() {
    const rows = [...history.querySelectorAll('.hrow')];
    if (first) { lastRows = rows.length; first = false; return; }
    if (rows.length < lastRows) lastRows = 0;
    for (const u of document.querySelectorAll('.unit')) {
      const n = u.querySelector('.uname');
      if (!n) continue;
      const r = u.getBoundingClientRect();
      const a = arena.getBoundingClientRect();
      lastRects.set(n.textContent.trim(), { x: (r.left + r.width / 2 - a.left) / 2, y: (r.top + r.height / 2 - a.top) / 2, r });
    }
    const fresh = rows.slice(lastRows);
    lastRows = rows.length;
    for (const row of fresh) {
      const classes = row.className.split(/\s+/);
      const kind = ['attack', 'skill', 'defend', 'equip', 'death', 'place', 'turn'].find(k => classes.includes(k));
      if (!kind) continue;
      const text = row.innerText || row.textContent || '';
      if (kind === 'turn') { if (window.PixelSFX) PixelSFX.play('turn'); continue; }
      let m;
      if (kind === 'attack') {
        m = /→「([^」]+)」/.exec(text);
        if (m) { spawn('attack', m[1]); if (window.PixelSFX) PixelSFX.play('attack'); }
      } else if (kind === 'skill') {
        m = /对「([^」]+)」施「([^」]+)」/.exec(text);
        if (m) { spawn('skill', m[1], m[2]); if (window.PixelSFX) PixelSFX.play('skill', m[2]); }
      } else if (kind === 'defend') {
        m = /「([^」]+)」/.exec(text);
        if (m) { spawn('defend', m[1]); if (window.PixelSFX) PixelSFX.play('defend'); }
      } else if (kind === 'equip') {
        m = /给「([^」]+)」装备/.exec(text) || /「([^」]+)」的.*(销毁|装上)/.exec(text);
        if (m) { spawn('equip', m[1]); if (window.PixelSFX) PixelSFX.play('equip'); }
      } else if (kind === 'death') {
        m = /「([^」]+)」阵亡/.exec(text);
        if (m) { spawn('death', m[1]); if (window.PixelSFX) PixelSFX.play('death'); }
      } else if (kind === 'place') {
        m = /落「([^」]+)」/.exec(text);
        if (m) { spawn('place', m[1]); if (window.PixelSFX) PixelSFX.play('place'); }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.age += 1 / 60;
      const t = Math.min(1, e.age / e.life);
      const a = 1 - t;
      ctx.globalAlpha = Math.max(0, a);
      ctx.shadowBlur = e.kind === 'death' ? 12 : 8;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      if (e.kind === 'attack') {
        ctx.fillStyle = '#f7f3e8';
        for (let k = 0; k < 16; k++) {
          const r = 1 + t * 12;
          const ang = e.seed + k * Math.PI / 8;
          ctx.fillRect(Math.floor(e.x + Math.cos(ang) * r), Math.floor(e.y + Math.sin(ang) * r), 2, 2);
        }
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x - 13, e.y - 9);
        ctx.lineTo(e.x + 13, e.y + 9);
        ctx.stroke();
      } else if (e.kind === 'skill') {
        const r = 4 + t * 22;
        for (let k = 0; k < 24; k++) {
          const ang = k * Math.PI / 12 + e.seed;
          ctx.fillRect(Math.floor(e.x + Math.cos(ang) * r), Math.floor(e.y + Math.sin(ang) * r), 2, 2);
        }
        // 上升符文
        for (let k = 0; k < 5; k++) {
          const yy = e.y - 6 - t * 18 - k * 4;
          ctx.fillRect(Math.floor(e.x - 8 + k * 4), Math.floor(yy), 2, 3);
        }
        if (e.skill) {
          ctx.globalAlpha = Math.max(0, a * 0.95);
          ctx.fillStyle = e.color;
          ctx.font = '13px "FusionPixel", "PingFang SC", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(e.skill.slice(0, 1), e.x, e.y + 5);
        }
      } else if (e.kind === 'defend') {
        for (let k = 0; k < 18; k++) {
          const ang = Math.PI * 0.15 + k * (Math.PI * 0.7 / 17);
          const r = 15 + Math.sin(t * 3) * 1.5;
          ctx.fillRect(Math.floor(e.x + Math.cos(ang) * r), Math.floor(e.y + Math.sin(ang) * r), 2, 2);
        }
        ctx.globalAlpha = Math.max(0, a * 0.9);
        ctx.fillStyle = '#f1e6c4';
        ctx.fillRect(e.x - 3, e.y - 4, 6, 7);
      } else if (e.kind === 'death') {
        ctx.fillStyle = '#b4472f';
        for (let k = 0; k < 26; k++) {
          const ang = e.seed + k * 2.399;
          const r = t * (12 + (k % 5) * 5);
          ctx.fillRect(Math.floor(e.x + Math.cos(ang) * r), Math.floor(e.y + Math.sin(ang) * r), 2 + (k % 3), 2);
        }
        ctx.fillStyle = '#17191b';
        for (let k = 0; k < 9; k++) {
          const ang = e.seed * 2 + k * 2.1;
          const r = t * 9;
          ctx.fillRect(Math.floor(e.x + Math.cos(ang) * r), Math.floor(e.y + Math.sin(ang) * r), 3, 3);
        }
      } else if (e.kind === 'equip') {
        ctx.fillStyle = e.color;
        for (let k = 0; k < 8; k++) {
          const ang = k * Math.PI / 4 + e.seed;
          const r = 5 + t * 12;
          ctx.fillRect(Math.floor(e.x + Math.cos(ang) * r), Math.floor(e.y + Math.sin(ang) * r), 2, 2);
        }
      } else if (e.kind === 'place') {
        const r = 3 + t * 16;
        for (let k = 0; k < 16; k++) {
          const ang = k * Math.PI / 8;
          ctx.fillRect(Math.floor(e.x + Math.cos(ang) * r), Math.floor(e.y + Math.sin(ang) * r), 2, 2);
        }
      }
      ctx.shadowBlur = 0;
      if (t >= 1) effects.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(arena);
  resize();
  setInterval(scan, 140);
  requestAnimationFrame(draw);
})();
