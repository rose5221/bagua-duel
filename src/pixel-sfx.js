/* 像素音效：全部 WebAudio 实时合成；首次点击后启用 */
(function () {
  const btn = document.getElementById('btnSfx');
  const KEY = 'bagua.sfx.v1';
  let ctx = null, master = null, delay = null;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch {}
  let started = false;

  function init() {
    if (started) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.34 : 0.0001;
    master.connect(ctx.destination);
    delay = ctx.createDelay(0.6);
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    delay.connect(fb).connect(delay);
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    delay.connect(wet).connect(master);
    started = true;
    label();
  }
  function label() {
    if (!btn) return;
    btn.textContent = enabled ? '音效开' : '音效关';
  }
  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch {}
    if (!started) init();
    if (master) master.gain.value = enabled ? 0.34 : 0.0001;
    label();
  }
  function tone(freq, dur, vol, type = 'sine', to = null, delaySec = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delaySec;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(22, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    g.connect(delay);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, q = 1, delaySec = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delaySec;
    const len = Math.floor(ctx.sampleRate * Math.max(0.02, dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }
  const skillNotes = {
    刚健: [330, 440, 660], 口舌: [440, 587, 880], 光明: [523, 659, 1047],
    动: [392, 523, 784], 入: [349, 466, 698], 险: [196, 277, 415],
    止: [294, 392, 588], 承载: [262, 349, 523],
  };
  function play(kind, skill) {
    if (!enabled) return;
    if (!started) init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    switch (kind) {
      case 'click':
        tone(980, 0.045, 0.09, 'square', 760);
        break;
      case 'place':
        tone(150, 0.2, 0.3, 'triangle', 70);
        noise(0.06, 0.12, 1600, 2);
        tone(620, 0.22, 0.07, 'sine', null, 0.03);
        tone(930, 0.2, 0.05, 'sine', null, 0.07);
        break;
      case 'attack':
        noise(0.16, 0.2, 2200, 0.7);
        tone(120, 0.2, 0.35, 'sine', 48);
        noise(0.06, 0.14, 4200, 2, 0.02);
        tone(1600, 0.08, 0.08, 'triangle', 820, 0.01);
        break;
      case 'skill': {
        const notes = skillNotes[skill] || [520, 780, 1040];
        notes.forEach((f, i) => tone(f, 0.55 + i * 0.12, 0.12, i === 0 ? 'triangle' : 'sine', null, i * 0.065));
        tone(notes[0] * 2, 0.7, 0.05, 'sine', null, 0.18);
        noise(0.2, 0.08, 3200, 2);
        break;
      }
      case 'defend':
        tone(300, 0.2, 0.2, 'triangle', 220);
        tone(1180, 0.14, 0.1, 'sine', 900, 0.02);
        noise(0.1, 0.1, 3000, 2);
        break;
      case 'equip':
        tone(1800, 0.1, 0.12, 'square', 900);
        noise(0.05, 0.1, 2800, 2);
        break;
      case 'death':
        tone(92, 1.2, 0.3, 'sine', 40);
        tone(138, 0.9, 0.14, 'sine', 61, 0.04);
        noise(0.2, 0.18, 360, 0.7);
        break;
      case 'turn':
        tone(523, 0.2, 0.08, 'sine');
        tone(784, 0.25, 0.06, 'sine', null, 0.09);
        break;
      case 'reward':
        [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.55, 0.11, 'sine', null, i * 0.09));
        noise(0.25, 0.05, 4200, 2);
        break;
      case 'error':
        tone(150, 0.16, 0.14, 'square', 90);
        break;
    }
  }

  if (btn) {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    label();
  }
  document.addEventListener('pointerdown', () => { if (!started) init(); }, { once: true });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('button,.htile,.slot,.skill,.wcard,.diff')) play('click');
  }, true);
  window.PixelSFX = { play, toggle, init, isEnabled: () => enabled };
})();
