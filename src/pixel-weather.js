/* 像素天气：按月份切换花瓣 / 火星 / 尘土 / 落叶 / 雪，画在低分辨率画布上再放大 */
(function () {
  const canvas = document.getElementById('pixelWeather');
  const arena = document.querySelector('.arena');
  if (!canvas || !arena) return;
  const ctx = canvas.getContext('2d');
  const D = window.DATA;
  let W = 1, H = 1, parts = [], type = 'wood', month = 0;
  const palettes = {
    wood: ['#d77f8f', '#9fbf8e', '#e3c08f', '#f0d6c2'],
    fire: ['#e0a85a', '#e8c47e', '#d06a3a', '#f3d9a2'],
    earth: ['#b9a07a', '#d0bd9a', '#8e7a5b', '#e3d6b8'],
    metal: ['#c2a24c', '#d6c48c', '#8a6a3a', '#e8d9a0'],
    water: ['#e4edf0', '#c6d8de', '#ffffff', '#a9c3ca'],
  };
  const elements = ['wood', 'fire', 'earth', 'metal', 'water'];

  function resize() {
    const r = arena.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width / 2));
    H = Math.max(1, Math.floor(r.height / 2));
    canvas.width = W; canvas.height = H;
    init();
  }

  function init() {
    parts = [];
    const n = 52;
    for (let i = 0; i < n; i++) parts.push(makeParticle(true));
  }

  function makeParticle(anywhere) {
    const colors = palettes[type] || palettes.wood;
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -4,
      size: 1 + Math.floor(Math.random() * 2),
      vy: type === 'fire' ? -0.12 - Math.random() * 0.25 : 0.18 + Math.random() * 0.45,
      vx: (Math.random() - 0.5) * 0.18,
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
    };
  }

  function setType(el) {
    if (elements.includes(el)) type = el;
    else type = 'wood';
    init();
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!W || !H) return;
    // 从 UI 的节气行读取月份
    const season = document.getElementById('season');
    const line = season && season.querySelector('.termline');
    if (line) {
      const m = /第\s*(\d+)\s*月/.exec(line.textContent || '');
      if (m) {
        const mm = +m[1];
        if (mm !== month) {
          month = mm;
          const term = D && D.TERMS ? D.TERMS[(month - 1) % 12] : null;
          setType(term ? term.element : 'wood');
        }
      }
    }
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx + Math.sin(p.phase + performance.now() * 0.0005) * (type === 'earth' ? 0.02 : 0.01);
      p.y += p.vy;
      if (type === 'fire') {
        if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      } else {
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
      }
      if (p.x < -4) p.x = W + 4;
      if (p.x > W + 4) p.x = -4;
      ctx.fillStyle = p.color;
      const w = (type === 'wood' || type === 'metal') ? p.size + 1 : p.size;
      const h = (type === 'wood' || type === 'metal') ? 1 : p.size;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), w, h);
    }
  }

  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(arena);
  resize();
  tick();
})();
