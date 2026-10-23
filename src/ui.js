/* 八卦对决 · 界面 v2 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DATA, E = window.Engine;
  const { ELEMENTS, TRIGRAMS, ROLES, CARDS, SKILLS, TERMS, DIFFICULTY, FIELD_RULES } = D;
  const HUMAN = 0, FOE = 1;
  const TAIJI = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#F7F3E8" stroke="#17191B" stroke-width="2"/><path d="M50 2 A48 48 0 0 1 50 98 A24 24 0 0 1 50 50 A24 24 0 0 0 50 2 Z" fill="#17191B"/><circle cx="50" cy="26" r="7.5" fill="#F7F3E8"/><circle cx="50" cy="74" r="7.5" fill="#17191B"/></svg>';
  const TAIJI_FIRE = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#F7F3E8" stroke="#17191B" stroke-width="2"/><path d="M50 2 A48 48 0 0 1 50 98 A24 24 0 0 1 50 50 A24 24 0 0 0 50 2 Z" fill="#B4472F"/><circle cx="50" cy="26" r="7.5" fill="#F7F3E8"/><circle cx="50" cy="74" r="7.5" fill="#B4472F"/></svg>';

  const S = { g: null, sel: null, mode: null, extra: null, preview: null, pending: null, difficulty: 'normal', character: 'daotong', charChoice: null, metaSettled: false, lossChoice: null, seasonBlessing: null, seasonOffering: false, trickPicks: [], cooldownSettled: false, level: 0, campaignCleared: false, paused: false, aiTimer: 0, aiTurn: false, aiStep: 0, aiActions: [], aiDeaths: [], aiFast: false, lastTerm: '', lastRound: 0, flash: '', flashTimer: 0 };

  /* ---------- 天气层 ---------- */
  const FX = (function () {
    const cv = $('fx'), ctx = cv.getContext('2d');
    let W = 1, H = 1, parts = [], type = 'petal', tint = '#7c9c69', raf = 0, last = 0;
    const PRESETS = [
      { type: 'petal', tint: '#8AA473' }, { type: 'rain', tint: '#8AA473' }, { type: 'drizzle', tint: '#C9A473' },
      { type: 'sunrain', tint: '#D57A5E' }, { type: 'rain', tint: '#D57A5E' }, { type: 'heat', tint: '#C9A473' },
      { type: 'leaf', tint: '#D9BF7A' }, { type: 'mist', tint: '#D9BF7A' }, { type: 'leaf', tint: '#b08a50' },
      { type: 'snow', tint: '#7A9DA6' }, { type: 'snow', tint: '#7A9DA6' }, { type: 'snow', tint: '#7A9DA6' },
    ];
    const rnd = (a, b) => a + Math.random() * (b - a);
    function resize() { const r = cv.parentElement.getBoundingClientRect(); W = cv.width = Math.max(1, Math.floor(r.width)); H = cv.height = Math.max(1, Math.floor(r.height)); }
    function make(kind) {
      const p = { x: rnd(0, W), y: rnd(-H * .3, H), vx: 0, vy: 0, s: 1, a: rnd(.3, .8), rot: rnd(0, 6.28), vr: rnd(-.02, .02), kind };
      if (kind === 'rain') { p.vy = rnd(6, 11); p.vx = rnd(-1, -.2); p.s = rnd(5, 12); p.a = rnd(.2, .5); }
      if (kind === 'petal') { p.vy = rnd(.45, 1.4); p.vx = rnd(-.7, .7); p.s = rnd(2.4, 5); p.a = rnd(.5, .95); p.color = Math.random() < .5 ? '#B4472F' : '#5B7A4B'; }
      if (kind === 'leaf') { p.vy = rnd(.7, 1.6); p.vx = rnd(-.8, .8); p.s = rnd(3, 6.5); p.a = rnd(.5, .95); p.color = Math.random() < .5 ? '#A97B4A' : '#C2A24C'; }
      if (kind === 'snow') { p.vy = rnd(.5, 1.6); p.vx = rnd(-.5, .5); p.s = rnd(1.1, 3); p.a = rnd(.5, 1); }
      if (kind === 'mist') { p.vy = rnd(-.12, -.03); p.vx = rnd(-.15, .15); p.s = rnd(60, 150); p.a = rnd(.02, .05); }
      if (kind === 'mote') { p.vy = rnd(-.5, -.15); p.vx = rnd(-.2, .2); p.s = rnd(1, 2); p.a = rnd(.15, .4); }
      return p;
    }
    function init() {
      parts = []; let n = 40;
      if (type === 'rain') n = 90; if (type === 'drizzle') n = 55; if (type === 'snow') n = 100;
      if (type === 'leaf') n = 38; if (type === 'mist') n = 14; if (type === 'heat' || type === 'sunrain' || type === 'petal') n = 48;
      for (let i = 0; i < n; i++) parts.push(make(type === 'mist' ? 'mist' : type === 'rain' ? 'rain' : type === 'snow' ? 'snow' : type === 'leaf' ? 'leaf' : type === 'heat' ? 'mote' : 'petal'));
    }
    function flash(term, month) {
      const el = $('termFlash'); if (!el) return;
      document.documentElement.style.setProperty('--season', ELEMENTS[term.element].color);
      el.innerHTML = `<div class="tf1">${term.name}</div><div class="tf2">${term.zhong}</div><div class="tf3">场地效果刷新</div>`;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2200);
    }
    function setTerm(term, month) {
      const p = PRESETS[(month - 1) % 12]; type = p.type; tint = p.tint;
      document.documentElement.style.setProperty('--season', tint); init(); flash(term, month);
    }
    function step(ts) {
      if (!last) last = ts;
      const dt = Math.min(3, (ts - last) / 16.7); last = ts;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1; ctx.fillStyle = tint; ctx.globalAlpha = .025; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      for (const p of parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > H + 20) { p.y = -20; p.x = rnd(0, W); }
        if (p.y < -30) { p.y = H + 20; p.x = rnd(0, W); }
        if (p.x < -30) p.x = W + 20; if (p.x > W + 30) p.x = -20;
        ctx.globalAlpha = p.a;
        if (p.kind === 'rain') { ctx.strokeStyle = '#6B7A80'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 1.4, p.y + p.s); ctx.stroke(); }
        else if (p.kind === 'snow') { ctx.fillStyle = '#C9D6DA'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
        else if (p.kind === 'mist') { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s); g.addColorStop(0, 'rgba(180,190,190,.18)'); g.addColorStop(1, 'rgba(180,190,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color || '#e8d8b0'; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .5, 0, 0, 6.283); ctx.fill(); ctx.restore(); }
      }
      drawInk(dt); drawFloats(dt); ctx.globalAlpha = 1; raf = requestAnimationFrame(step);
    }
    const inks = []; const floats = [];
    function inkAt(rect) {
      if (!rect) return;
      const cr = cv.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - cr.left, y = rect.top + rect.height / 2 - cr.top;
      const blobs = [];
      for (let i = 0; i < 6; i++) blobs.push({ x: x + rnd(-28, 28), y: y + rnd(-22, 22), r: rnd(12, 34), a: rnd(.05, .16), dx: rnd(-.2, .2), dy: rnd(-.15, .1), vr: rnd(-.01, .01), rot: rnd(0, 6.28) });
      inks.push({ blobs, life: 1 });
    }
    function drawInk(dt) {
      for (let i = inks.length - 1; i >= 0; i--) {
        const k = inks[i]; k.life -= .012 * dt;
        if (k.life <= 0) { inks.splice(i, 1); continue; }
        for (const b of k.blobs) {
          b.x += b.dx; b.y += b.dy; b.rot += b.vr;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          ctx.globalAlpha = b.a * k.life; ctx.fillStyle = '#17191B';
          ctx.beginPath(); ctx.moveTo(b.r, 0);
          for (let a = 0; a < 6.283; a += .5) { const rr = b.r * (0.75 + Math.random() * .5); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .8); }
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    }
    function hitAt(rect, text, kill) {
      if (!rect) return;
      const cr = cv.getBoundingClientRect();
      floats.push({ x: rect.left + rect.width / 2 - cr.left, y: rect.top + rect.height / 2 - cr.top, text, kill, life: 1 });
      inkAt(rect);
    }
    function drawFloats(dt) {
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.life -= .018 * dt; f.y -= .7 * dt;
        if (f.life <= 0) { floats.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life * 1.7);
        ctx.textAlign = 'center';
        ctx.font = (f.kill ? 'bold 34px' : 'bold 24px') + ' "Iowan Old Style", serif';
        ctx.lineWidth = 3; ctx.strokeStyle = '#F7F3E8'; ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.kill ? '#B4472F' : '#17191B';
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      }
    }
    function start() { resize(); new ResizeObserver(resize).observe(cv.parentElement); init(); if (!raf) raf = requestAnimationFrame(step); }
    return { start, setTerm, inkAt, hitAt };
  })();

  /* ---------- 工具 ---------- */
  function flashMsg(t) {
    S.flash = t; $('prompt').textContent = t;
    clearTimeout(S.flashTimer); S.flashTimer = setTimeout(() => { S.flash = ''; renderPrompt(); }, 1800);
  }
  const mySeat = () => S.g ? D.SEATS[S.g.humanSeat] : null;
  const foeSeat = () => S.g ? D.SEATS[S.g.humanSeat === 'N' ? 'S' : 'N'] : null;
  const pname = id => id === 0 ? '你' : '庄家';
  const wname = k => D.WEAPON_BY_KEY[k] ? D.WEAPON_BY_KEY[k].name : k;

  function figHtml(id, seat, mine) {
    const p = S.g.players[id];
    return `<div class="figbox ${mine ? 'mine' : 'foe'}">
      <div class="figmask"><i class="hat"></i><i class="face"></i><i class="eye l"></i><i class="eye r"></i></div>
      <div class="figmeta"><b>${p.name}</b><span>${seat.text} · 余 ${E.remaining(p)}/8</span></div>
    </div>`;
  }

  /* ---------- 开始 / 规则 / 结算 ---------- */
  function showStart() {
    closeSheets();
    const el = $('screens');
    const meta = window.Meta;
    const charOpen = c => meta ? meta.characterOpen(c.key) : c.open;
    const charTag = c => meta ? meta.characterTag(c.key) : c.tag;
    if (meta) {
      if (!meta.get().run.active) meta.resetRun();
      const currentRun = meta.get().run;
      if (currentRun.locked && currentRun.character && meta.characterOpen(currentRun.character)) S.character = currentRun.character;
      else {
        const saved = meta.get().character;
        if (meta.characterOpen(saved)) S.character = saved;
        else if (!meta.characterOpen(S.character)) S.character = 'daotong';
      }
    }
    const streak = meta ? meta.get().oldYinStreak : 0;
    const chierOpen = !!(meta && meta.characterOpen('chier'));
    const run = meta ? meta.get().run : null;
    const locked = !!(run && run.locked);
    const runH = meta ? meta.aliveHuns().length : 3;
    const runP = meta ? meta.alivePos().length : 7;
    const camp = window.Campaign;
    const prog = meta ? meta.campaign() : { unlocked: 1, cleared: [] };
    if (camp) {
      S.level = Math.max(0, Math.min(S.level, camp.count - 1));
      if (!meta || !meta.levelUnlocked(S.level)) S.level = Math.min(prog.unlocked - 1, camp.count - 1);
      S.difficulty = camp.get(S.level).difficulty;
    }
    const cur = camp ? camp.get(S.level) : null;
    el.innerHTML = `<div class="panel startpanel">
      <div class="kick">BAGUA DUEL · 64</div>
      <h1>八卦弈魂</h1>
      <p class="lead">两个人面对面，中间一张八卦盘；开局纯黑，方位随机。<br>每人 4 属性 × 8 张 = 32 张牌库；入座后随机取 2 属性 × 4 张 = 8 张出战；场上最多 3 张。</p>
      <div class="startrow">
        <div class="startbox"><b>行动</b><span>每回合落 1 张人物牌；场上每张牌各攻击 / 装备 / 移动一次；技能最多 2 张。</span></div>
        <div class="startbox"><b>场地</b><span>每轮开始按卦位五行触发：相生、同五行、相克各有不同效果。</span></div>
        <div class="startbox"><b>胜负</b><span>一方 8 张人物牌全部失去即负。</span></div>
      </div>
      <div class="starttrigrams">${D.ATTRS.map(a => `<span style="--c:${ELEMENTS[a.element].color}">${a.sym} ${a.name}</span>`).join('')}</div>
      <div class="charhead">角色</div>
      <div class="charpick">${D.CHARACTERS.map(c => {
        const open = charOpen(c);
        const lockedOut = locked && c.key !== S.character;
        const tag = locked ? (c.key === S.character ? '已锁' : '锁定') : charTag(c);
        return `<button class="charpick-btn ${S.character === c.key ? 'sel' : ''}" data-char="${c.key}" ${open && !lockedOut ? '' : 'disabled'}><b>${c.name}</b><span>${c.desc}</span><i>${tag}</i></button>`;
      }).join('')}</div>
      <div class="charstreak">${locked ? '角色已锁定 · 整条弈魂不可更换' : chierOpen ? '痴儿已解锁 · 可在上方直接选择' : streak ? `道童老阴连续 ${streak}/3 · 再成一次解锁痴儿` : '痴儿：道童卜卦连续三次老阴后解锁'}</div>
      <div class="runmeta">弈魂 · 第 ${run ? run.round : 1} 局 · 魂 ${runH}/3 · 魄 ${runP}/7 · 献祭 ${run ? run.sacrifices : 0}</div>
      <div class="levelhead">剧情关卡</div>
      <div class="levelpick">${camp ? camp.LEVELS.map((lv, i) => {
        const open = meta ? meta.levelUnlocked(i) : i === 0;
        const cleared = prog.cleared.includes(i);
        return `<button class="levelbtn ${S.level === i ? 'sel' : ''} ${cleared ? 'cleared' : ''}" data-level="${i}" ${open ? '' : 'disabled'}><b>${lv.num}</b><span>${lv.name}</span><i>${cleared ? '已过' : open ? lv.boss : '未解锁'}</i></button>`;
      }).join('') : ''}</div>
      ${cur ? `<div class="leveldesc">${cur.taiji ? '<div class="taijiboss">☯</div>' : (cur.portrait ? D.portraitHtml(D.CARDS[cur.portrait], 44, 58) : '')}<div><b>${cur.num} · ${cur.name} · ${cur.boss}</b><span>${cur.story}</span><em>${cur.desc}</em></div></div>` : ''}
      <div class="startbtns"><button class="primary" id="btnStart">${cur ? '入座 · ' + cur.num : '入座'}</button><button id="btnRules2">规则</button></div>
      <div class="startfoot">${chierOpen ? '四角色均可选' : '坐北朝南先手 · 道童 / 清风 / 旁门可选；痴儿连续三次老阴解锁'} · 随机 2 属性 × 4 张出战</div>
    </div>`;
    el.classList.add('show');
    el.querySelectorAll('.levelbtn').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      S.level = Number(b.dataset.level);
      if (camp) S.difficulty = camp.get(S.level).difficulty;
      showStart();
    });
    el.querySelectorAll('.charpick-btn').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      S.character = b.dataset.char;
      if (meta) meta.selectCharacter(S.character);
      el.querySelectorAll('.charpick-btn').forEach(x => x.classList.toggle('sel', x === b));
    });
    $('btnStart').onclick = () => { el.classList.remove('show'); beginSeason(); };
    $('btnRules2').onclick = showRules;
  }

  function prepValid() {
    const p = S.prep;
    if (!p || p.chosenAttrs.length !== 2) return false;
    return p.chosenAttrs.every(a => p.cards.filter(cid => CARDS[cid].attrKey === a).length === 4);
  }

  function showPrep() {
    closeSheets();
    const el = $('screens');
    const attrs = D.ATTRS.map(a => a.key);
    for (let i = attrs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[attrs[i], attrs[j]] = [attrs[j], attrs[i]]; }
    S.prep = { attrs: attrs.slice(0, 4), chosenAttrs: [], cards: [] };
    renderPrep();
  }

  function renderPrep() {
    const el = $('screens');
    const p = S.prep;
    if (!p) return;
    const prevPanel = el.querySelector('.preppanel');
    const prevScroll = prevPanel ? prevPanel.scrollTop : 0;
    const count = a => p.cards.filter(cid => CARDS[cid].attrKey === a).length;
    const total = p.cards.length;
    const valid = prepValid();
    const attrButtons = p.attrs.map(a => {
      const def = D.ATTR_BY_KEY[a], ec = ELEMENTS[def.element];
      const on = p.chosenAttrs.includes(a);
      const n = count(a);
      return `<button class="prepatt ${on ? 'sel' : ''}" data-prep-attr="${a}" style="--c:${ec.color}"><b>${def.sym} ${def.name}</b><span>${ec.name} · ${n}/4</span></button>`;
    }).join('');
    let cardsHtml = '';
    if (p.chosenAttrs.length) {
      cardsHtml = `<div class="prepgrid">${p.chosenAttrs.map(a => {
        const def = D.ATTR_BY_KEY[a], ec = ELEMENTS[def.element];
        const ids = D.ROLES.map(r => a + '-' + r.key);
        return `<section class="prepcol" style="--c:${ec.color}"><div class="prepcolhead"><b>${def.sym} ${def.name}</b><span>${count(a)}/4</span></div><div class="prepcards">${ids.map(cid => {
          const c = CARDS[cid], on = p.cards.includes(cid), full = count(a) >= 4 && !on;
          return `<button class="prepcard ${on ? 'sel' : ''}" data-prep-card="${cid}" ${full ? 'disabled' : ''}>
            <span class="prepport">${D.portraitHtml(c, 34, 45, 'prep-portrait')}</span>
            <span class="prepname">${c.role}</span><span class="prepstat">${c.atk}/${c.hp}</span>
          </button>`;
        }).join('')}</div></section>`;
      }).join('')}</div>`;
    } else {
      cardsHtml = '<div class="prephint">先选 2 个属性；再从每个属性里选 4 张人物牌。</div>';
    }
    el.innerHTML = `<div class="panel preppanel">
      <div class="kick">单局准备</div>
      <h2>选出战 8 张</h2>
      <p class="preplead">从 4 个属性中选 2 个，再从每个属性选 4 张。未出战的 24 张留在牌库。</p>
      <div class="prepattrs">${attrButtons}</div>
      ${cardsHtml}
      <div class="prepbar">
        <span class="prepcount">已选 ${total}/8 · ${p.chosenAttrs.length}/2 属性</span>
        <span class="prepactions">
          <button id="prepRandom">随机出战</button>
          <button id="prepCancel">返回</button>
          <button class="primary" id="prepStart" ${valid ? '' : 'disabled'}>入座</button>
        </span>
      </div>
    </div>`;
    el.classList.add('show');
    const panel = el.querySelector('.preppanel');
    if (panel && prevScroll) panel.scrollTop = prevScroll;
    el.querySelectorAll('[data-prep-attr]').forEach(b => b.onclick = () => {
      const a = b.dataset.prepAttr;
      if (p.chosenAttrs.includes(a)) {
        p.chosenAttrs = p.chosenAttrs.filter(x => x !== a);
        p.cards = p.cards.filter(cid => CARDS[cid].attrKey !== a);
      } else if (p.chosenAttrs.length < 2) {
        p.chosenAttrs.push(a);
      } else {
        flashMsg('只能选 2 个属性');
        return;
      }
      renderPrep();
    });
    el.querySelectorAll('[data-prep-card]').forEach(b => b.onclick = () => {
      const cid = b.dataset.prepCard, a = CARDS[cid].attrKey;
      const idx = p.cards.indexOf(cid);
      if (idx >= 0) p.cards.splice(idx, 1);
      else {
        if (count(a) >= 4) { flashMsg('该属性已选满 4 张'); return; }
        p.cards.push(cid);
      }
      renderPrep();
    });
    $('prepRandom').onclick = () => {
      const chosen = p.attrs.slice();
      for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
      p.chosenAttrs = chosen.slice(0, 2);
      p.cards = [];
      for (const a of p.chosenAttrs) {
        const ids = D.ROLES.map(r => a + '-' + r.key).slice();
        for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[ids[i], ids[j]] = [ids[j], ids[i]]; }
        p.cards.push(...ids.slice(0, 4));
      }
      startGame();
    };
    $('prepCancel').onclick = () => { el.classList.remove('show'); S.prep = null; showStart(); };
    $('prepStart').onclick = () => { if (!prepValid()) return; startGame(); };
  }

  function showRules() {
    const el = $('screens');
    el.innerHTML = `<div class="panel rulespanel">
      <div class="phead"><h2>规则</h2><button id="rulesClose">收起</button></div>
      <div class="rulegrid">
        <div><b>牌组</b><p>8 属性 × 8 家庭成员共 64 张。每人随机 4 个属性组成 32 张牌库；入座后随机取 2 属性 × 4 张 = 8 张；场上最多 3 张。</p></div>
        <div><b>落子</b><p>每回合 1 张。牌属性与席同五行 +2 攻/+4 血；席生牌 +4 血；席克牌 -2 攻；家庭物象与席同五行 +2 攻/+4 血。移动不触发这些。</p></div>
        <div><b>行动</b><p>场上每张牌每回合可攻击一次、获得一件装备、或移动到相邻空位，三选一。新落的牌当回合不能行动，但可以被攻击。</p></div>
        <div><b>攻击</b><p>空手/近战/盾牌打邻位，远程和长枪打距离 2。相生正常；克制方对被克方伤害 +1。无反击。</p></div>
        <div><b>技能</b><p>每回合最多 2 张且不能重复；每张技能整局 2 次。目标带对应属性/家庭成员时增强。</p></div>
        <div><b>角色</b><p>开始界面选择。当前道童每回合可求签一次、卜卦一次，均不占人物行动，也不消耗技能卡次数；求签签文只在角色面板显示。清风/旁门/痴儿随三魂七魄多局流程开放。</p></div>
        <div><b>胜负</b><p>一方 8 张人物牌全部失去，立即结束。</p></div>
      </div>
      <div class="fieldguide"><div class="fghead">场地 · 每轮开始</div>${FIELD_RULES.map(f => `<div class="fgrow" style="--c:${ELEMENTS[f.el].color}"><b>${ELEMENTS[f.el].name}</b><span>生：${f.gen}</span><span>同：${f.equal}</span><span>克：${f.over}</span></div>`).join('')}</div>
      <div class="skillref">${SKILLS.map(s => `<div><b>${s.name}</b><span>${s.desc}</span></div>`).join('')}</div>
      <div class="rulesfoot">点击人物牌→空席落子；点击己方牌→攻击/移动；点击武器→装备；点击技能→选牌。</div>
    </div>`;
    el.classList.add('show');
    $('rulesClose').onclick = () => { if (!S.g) showStart(); else el.classList.remove('show'); };
  }

  function showResult(silent, metaMsg) {
    const g = S.g; if (!g) return;
    closeSheets();
    const win = g.winner === HUMAN;
    const el = $('screens');
    const meta = window.Meta;
    if (meta) {
      for (const k of g.lostHuns || []) meta.loseHun(k);
      for (const k of g.pseudoPos || []) meta.markPseudoPos(k);
      if (!S.cooldownSettled) { meta.settleMatch(g.summoned || []); S.cooldownSettled = true; }
    }
    const run = meta ? meta.get().run : null;
    const camp = window.Campaign;
    const level = camp ? camp.get(S.level) : null;
    const isFinal = S.level >= (camp ? camp.count - 1 : 0);
    if (win && level && meta && !S.campaignCleared) { meta.clearLevel(S.level); S.campaignCleared = true; }
    const aliveH = meta ? meta.aliveHuns() : [];
    const aliveP = meta ? meta.alivePos() : [];
    const failed = meta ? (aliveH.length <= 1 && aliveP.length <= 1) : false;
    if (failed) meta.failRun();
    const soulNames = { tian: '天魂', di: '地魂', ren: '人魂' };
    const posNames = { shigou: '尸狗', fushi: '伏矢', queyin: '雀阴', tunzei: '吞贼', feidu: '非毒', chuhui: '除秽', choufei: '臭肺' };
    let metaHtml = '';
    if (meta && run) {
      metaHtml = `<div class="metaline"><b>弈魂 · 第 ${run.round} 局</b><span>魂 ${aliveH.length}/3 · 魄 ${aliveP.length}/7 · 献祭 ${run.sacrifices}</span></div>`;
      if (failed) {
        metaHtml += `<div class="metafail"><b>全局失败</b><span>三魂七魄已断，整条弈魂到此为止。</span></div>`;
      } else if (metaMsg) {
        metaHtml += `<div class="metamsg">${metaMsg}</div>`;
      } else if (!win && !S.metaSettled) {
        if (!S.lossChoice) {
          metaHtml += `<div class="metachoice"><div>败者结算：失一魂，或失两魄；三魂至少留其一。选中后自己决定失去哪一个。</div><div class="metabtns">
            <button data-loss="hun" ${aliveH.length <= 1 ? 'disabled' : ''}>失一魂</button>
            <button data-loss="pos" ${aliveP.length < 2 ? 'disabled' : ''}>失两魄</button>
          </div></div>`;
        } else if (S.lossChoice.kind === 'hun') {
          metaHtml += `<div class="metachoice"><div>选择要失去的一魂（至少保留一魂）：</div>
            <div class="losslist">${aliveH.map(k => `<button data-pick-soul="${k}">${soulNames[k]}</button>`).join('')}</div>
            <button class="lossback" data-loss-back>返回</button></div>`;
        } else {
          const picks = S.lossChoice.picks || [];
          metaHtml += `<div class="metachoice"><div>选择要失去的两魄（已选 ${picks.length}/2）：</div>
            <div class="losslist">${aliveP.map(k => `<button class="${picks.includes(k) ? 'sel' : ''}" data-pick-pos="${k}" ${!picks.includes(k) && picks.length >= 2 ? 'disabled' : ''}>${posNames[k]}</button>`).join('')}</div>
            <div class="metabtns"><button data-loss-back>返回</button><button data-confirm-loss ${picks.length === 2 ? '' : 'disabled'}>确认失两魄</button></div></div>`;
        }
      } else if (win && g.character === 'pangmen' && E.ownUnits(g, HUMAN).length === 3) {
        const lostReal = Object.keys(run.pos).filter(k => run.pos[k].lost && !run.pos[k].pseudo);
        metaHtml += `<div class="metachoice"><div>夺魄：胜利时场上仍有 3 张，可选一个已空缺的魄位炼为伪魄。</div>${lostReal.length
          ? `<div class="metabtns">${lostReal.map(k => `<button data-seize="${k}">${posNames[k]} → 伪魄</button>`).join('')}</div>`
          : '<span class="metamsg">你的七魄没有空缺，无法炼伪。</span>'}</div>`;
      }
      if (!failed && !win && S.metaSettled) {
        const lostRealH = Object.keys(run.souls).filter(k => run.souls[k].lost && !run.souls[k].pseudo);
        const lostRealP = Object.keys(run.pos).filter(k => run.pos[k].lost && !run.pos[k].pseudo);
        const attrsLeft = D.ATTRS.filter(a => (!run.lastAttrs || !run.lastAttrs.length || run.lastAttrs.includes(a.key)) && run.usedSacrificeAttrs.filter(x => x === a.key).length < 2);
        if (lostRealH.length || lostRealP.length) {
          metaHtml += `<div class="metachoice sacbox"><div>献祭窗口：每次消耗一个属性的 4 张牌；伪魂需累计 2 次，伪魄需累计 1 次。</div>
            <div class="metabtns sacattrs">${attrsLeft.map(a => `<button data-sacrifice="${a.key}">${a.sym} ${a.name}</button>`).join('') || '<span class="metamsg">四属性已献尽</span>'}</div>
            <div class="metabtns">${lostRealH.map(k => `<button data-pseudo-hun="${k}" ${run.sacrifices < 2 ? 'disabled' : ''}>${soulNames[k]} → 伪魂</button>`).join('')}${lostRealP.map(k => `<button data-pseudo-pos="${k}" ${run.sacrifices < 1 ? 'disabled' : ''}>${posNames[k]} → 伪魄</button>`).join('')}</div>
          </div>`;
        }
      }
    }
    const canNext = meta && !failed && (win || S.metaSettled);
    const canLeave = !meta || win || S.metaSettled || failed;
    const nextLabel = level ? (win ? (isFinal ? '回到主界面' : '下一关') : '重试本关') : '下一局';
    el.innerHTML = `<div class="panel resultpanel">
      <div class="kick">${win ? 'WIN' : 'LOSE'}</div>
      <h1>${win ? '你赢了' : '庄家赢了'}</h1>
      <p class="lead">${win ? '庄家 8 张人物牌尽失。' : '你的 8 张人物牌尽失。'}${level ? ` · ${level.num} ${level.name} · ${level.boss}` : ''}</p>
      <div class="resultrow">
        <div><b>你</b><span>余 ${E.remaining(g.players[0])} / 8</span></div>
        <div><b>庄家</b><span>余 ${E.remaining(g.players[1])} / 8</span></div>
        <div><b>历时</b><span>${g.turnNo} 手 · ${g.round} 轮</span></div>
      </div>
      ${metaHtml}
      <div class="startbtns">
        ${canNext ? `<button class="primary" id="btnNext">${nextLabel}</button>` : ''}
        ${failed ? '<button class="primary" id="btnResetMeta">重开弈魂</button>' : ''}
        ${canLeave ? '<button id="btnMenu">回到封面</button>' : ''}
      </div>
      <div class="metafoot">三魂：${meta ? aliveH.map(k => soulNames[k]).join('、') || '尽失' : '—'} · 七魄：${meta ? aliveP.map(k => posNames[k]).join('、') || '尽失' : '—'}</div>
    </div>`;
    el.classList.add('show');
    if (!silent) document.dispatchEvent(new CustomEvent('bagua:result', { detail: { win, g } }));
    el.querySelectorAll('[data-loss]').forEach(b => b.onclick = () => {
      if (!meta) return;
      S.lossChoice = { kind: b.dataset.loss, picks: [] };
      showResult(true);
    });
    el.querySelectorAll('[data-pick-soul]').forEach(b => b.onclick = () => {
      if (!meta) return;
      const k = b.dataset.pickSoul;
      if (meta.aliveHuns().length <= 1) return;
      meta.loseHun(k);
      S.metaSettled = true;
      S.lossChoice = null;
      showResult(true, `你失去了${soulNames[k]}。`);
    });
    el.querySelectorAll('[data-pick-pos]').forEach(b => b.onclick = () => {
      if (!meta || !S.lossChoice || S.lossChoice.kind !== 'pos') return;
      const k = b.dataset.pickPos;
      const picks = S.lossChoice.picks || [];
      const idx = picks.indexOf(k);
      if (idx >= 0) picks.splice(idx, 1);
      else if (picks.length < 2) picks.push(k);
      S.lossChoice.picks = picks;
      showResult(true);
    });
    el.querySelectorAll('[data-loss-back]').forEach(b => b.onclick = () => {
      S.lossChoice = null;
      showResult(true);
    });
    el.querySelectorAll('[data-confirm-loss]').forEach(b => b.onclick = () => {
      if (!meta || !S.lossChoice || S.lossChoice.kind !== 'pos') return;
      const picks = S.lossChoice.picks || [];
      if (picks.length !== 2) return;
      picks.forEach(k => meta.losePos(k));
      S.metaSettled = true;
      const lost = picks.slice();
      S.lossChoice = null;
      showResult(true, `你失去了${lost.map(k => posNames[k]).join('、')}。`);
    });
    el.querySelectorAll('[data-seize]').forEach(b => b.onclick = () => {
      if (!meta) return;
      const k = b.dataset.seize;
      if (meta.gainPseudoPos(k)) showResult(true, `夺魄：${posNames[k]}已炼为伪魄，其失魄效果清除。`);
    });
    el.querySelectorAll('[data-sacrifice]').forEach(b => b.onclick = () => {
      if (!meta) return;
      const a = b.dataset.sacrifice;
      const def = D.ATTR_BY_KEY[a];
      if (meta.sacrifice(a)) showResult(true, `献祭${def ? def.name : a}属性：消耗 4 张，累计 ${meta.get().run.sacrifices} 次。`);
    });
    el.querySelectorAll('[data-pseudo-hun]').forEach(b => b.onclick = () => {
      if (!meta) return;
      const k = b.dataset.pseudoHun;
      if (meta.makePseudoSoul(k)) showResult(true, `${soulNames[k]}已炼为伪魂，失魂增益/减益清除。`);
    });
    el.querySelectorAll('[data-pseudo-pos]').forEach(b => b.onclick = () => {
      if (!meta) return;
      const k = b.dataset.pseudoPos;
      if (meta.makePseudoPos(k)) showResult(true, `${posNames[k]}已炼为伪魄，失魄增益/减益清除。`);
    });
    const next = $('btnNext');
    if (next) next.onclick = () => {
      el.classList.remove('show');
      if (level) {
        if (win) {
          if (isFinal) { S.g = null; showStart(); return; }
          S.level = Math.min(S.level + 1, camp.count - 1);
          if (meta) meta.startNextRound();
          beginSeason();
        } else {
          beginSeason();
        }
        return;
      }
      if (meta) meta.startNextRound();
      beginSeason();
    };
    const reset = $('btnResetMeta');
    if (reset) reset.onclick = () => {
      if (meta) meta.resetRun();
      el.classList.remove('show');
      S.g = null; showStart();
    };
    const menu = $('btnMenu');
    if (menu) menu.onclick = () => { el.classList.remove('show'); S.g = null; S.sel = null; showStart(); };
  }

  function beginSeason() {
    closeSheets();
    const meta = window.Meta;
    const round = meta ? meta.get().run.round : 1;
    const B = window.Blessings;
    if (!B) { startGame(); return; }
    const season = B.seasonForRound(round);
    const draw = B.draw(season, true);
    const level = window.Campaign ? window.Campaign.get(S.level) : null;
    const bossBless = level && level.effect ? B.BY_KEY[level.effect] : null;
    const foeDraw = B.draw(season, false);
    const foe = level ? (bossBless || null) : foeDraw.options[Math.floor(Math.random() * foeDraw.options.length)];
    S.seasonBlessing = { season, options: draw.options, foe, player: null, level: S.level, mode: 'start' };
    renderSeasonBlessing();
  }
  function renderSeasonBlessing() {
    const el = $('screens');
    const p = S.seasonBlessing;
    if (!p) { startGame(); return; }
    const B = window.Blessings;
    const seasonName = B.seasonName(p.season);
    const changing = p.mode === 'change';
    el.innerHTML = `<div class="panel blessingpanel">
      <div class="kick">天时 · ${seasonName}${changing && p.term ? ' · ' + p.term : ''}</div>
      <h2>${changing ? '换囊' : '三囊择一'}</h2>
      <p class="blesslead">${changing ? `${seasonName}季到了，旧锦囊失效；选一枚新锦囊，本季有效。` : `本局${seasonName}季，选一枚锦囊带入对局。`}${p.options.some(x => x.kind === 'trick') ? '有一枚黑金绳妙计混在其中。' : (changing ? '' : '庄家也会同时开囊。')}</p>
      <div class="pouchrow">${p.options.map((o, i) => `<button class="pouch artpouch ${o.kind === 'trick' ? 'trick' : ''}" data-blessing="${i}">
        <img class="pouchart" src="${o.art || ''}" alt="${o.name}" loading="lazy">
        <span class="pouchseal">${o.term || ''}</span>
        <span class="pouchname">${o.name}</span><span class="pouchterm">${o.kind === 'trick' ? '妙计 · 本季一次' : o.term}</span>
        <span class="pouchtext">${o.text || ''}</span>
        ${o.kind === 'trick' ? '<i class="trickmark">妙</i>' : ''}
      </button>`).join('')}</div>
      <div class="blessfoot">自选一枚 · 不重抽 · ${changing ? '本季有效' : '本局有效'} · 庄家：${p.foe ? p.foe.name : '无'}</div>
    </div>`;
    el.classList.add('show');
    el.querySelectorAll('[data-blessing]').forEach(btn => btn.onclick = () => {
      if (S.seasonBlessing.player) return;
      const mode = S.seasonBlessing.mode || 'start';
      const opt = S.seasonBlessing.options[Number(btn.dataset.blessing)];
      S.seasonBlessing.player = opt;
      btn.classList.add('picked');
      el.querySelectorAll('[data-blessing]').forEach(x => x.classList.toggle('dim', x !== btn));
      showCastBanner(`${opt.name} · ${opt.text}`, opt.kind === 'trick' ? 'weapon' : 'skill');
      if (mode === 'change') {
        setTimeout(() => {
          if (!S.g) return;
          E.setBlessing(S.g, HUMAN, opt);
          S.g.pendingBlessing = null;
          S.seasonOffering = false;
          S.seasonBlessing = null;
          el.classList.remove('show');
          refresh();
          if (S.g.turn === FOE && !S.g.over) startAI();
        }, 500);
      } else {
        setTimeout(() => { el.classList.remove('show'); S.seasonOffering = false; startGame(); }, 650);
      }
    });
  }


  function openPause() {
    if (!S.g || S.g.over) return;
    if ($('screens').classList.contains('show')) return;
    S.paused = true;
    clearTimeout(S.aiTimer);
    const el = $('screens');
    el.innerHTML = `<div class="panel pausepanel">
      <div class="kick">八卦弈魂</div><h2>暂停</h2>
      <p class="blesslead">${S.g.turn === FOE ? '庄家正在行动；继续后会从当前步骤接着播放。' : '牌局已暂停。'}</p>
      <div class="startbtns"><button class="primary" id="pauseResume">继续</button><button id="pauseRestart">重新开始</button><button id="pauseHome">回到主界面</button></div>
    </div>`;
    el.classList.add('show');
    $('pauseResume').onclick = () => {
      el.classList.remove('show'); S.paused = false;
      if (!S.g) return;
      if (S.g.turn === FOE) {
        refresh();
        S.aiTimer = setTimeout(() => {
          if (!S.g || S.g.over) return;
          if (S.aiTurn) aiNextStep(); else startAI();
        }, 400);
      }
    };
    $('pauseRestart').onclick = () => {
      el.classList.remove('show'); S.paused = false;
      clearTimeout(S.aiTimer); S.aiTurn = false;
      if (S.g && window.Meta) window.Meta.settleMatch(S.g.summoned || []);
      S.g = null;
      beginSeason();
    };
    $('pauseHome').onclick = () => {
      el.classList.remove('show'); S.paused = false;
      clearTimeout(S.aiTimer); S.aiTurn = false;
      if (S.g && window.Meta) window.Meta.settleMatch(S.g.summoned || []);
      S.g = null; S.seasonBlessing = null;
      showStart();
    };
  }

  function maybeOfferSeasonChange() {
    const g = S.g;
    if (!g || !g.pendingBlessing || S.seasonOffering) return;
    if ($('screens').classList.contains('show')) return;
    const B = window.Blessings;
    if (!B) return;
    const season = g.pendingBlessing.season;
    S.seasonOffering = true;
    const draw = B.draw(season, true);
    S.seasonBlessing = { season, term: g.pendingBlessing.term || '', options: draw.options, foe: g.blessings[1] || null, player: null, mode: 'change' };
    renderSeasonBlessing();
  }

  function startGame() {
    closeSheets();
    if (window.Meta) {
      window.Meta.selectCharacter(S.character);
      window.Meta.lockCharacter(S.character);
    }
    const mods = window.Meta ? window.Meta.gameMods() : {};
    const run = window.Meta ? window.Meta.get().run : null;
    const lostHuns = run ? Object.keys(run.souls).filter(k => run.souls[k].lost && !run.souls[k].pseudo) : [];
    const B = window.Blessings;
    const level = window.Campaign ? window.Campaign.get(S.level) : null;
    if (level) S.difficulty = level.difficulty;
    const season = S.seasonBlessing ? S.seasonBlessing.season : (B ? B.seasonForRound(run ? run.round : 1) : 'spring');
    const spot = S.seasonBlessing ? S.seasonBlessing.player : (B ? B.draw(season, false).options[0] : null);
    const foeSpot = S.seasonBlessing ? S.seasonBlessing.foe : (level && level.effect && B ? B.BY_KEY[level.effect] : null);
    S.g = E.newGame({
      difficulty: S.difficulty, character: S.character, mods, lostHuns,
      blessing: spot, foeBlessing: foeSpot, season,
      startMonth: B ? B.startMonth(season) : 1,
      cooldowns: run && run.cooldowns ? run.cooldowns : {},
      levelName: level ? level.name : '', bossName: level ? level.boss : '', levelIndex: S.level,
    });
    S.seasonBlessing = null;
    if (window.Meta) {
      window.Meta.get().run.lastAttrs = S.g.players[0].attrs.slice();
      window.Meta.save();
    }
    S.prep = null;
    $('screens').classList.remove('show');
    clearTimeout(S.aiTimer);
    S.aiTurn = false; S.aiStep = 0; S.aiActions = []; S.aiDeaths = []; S.aiFast = false;
    const aiBar = document.querySelector('.aibanner'); if (aiBar) aiBar.classList.remove('show');
    const aiTrack = document.querySelector('.aitrack'); if (aiTrack) aiTrack.classList.remove('show');
    S.sel = null; S.mode = null; S.extra = null; S.preview = null; S.pending = null; S.charChoice = null; S.metaSettled = false; S.lossChoice = null; S.cooldownSettled = false; S.paused = false; S.campaignCleared = false; S.seasonOffering = false;
    S.lastTerm = ''; S.lastRound = 0;
    updateTerm(true);
    applyBoardSkin();
    renderAll();
    if (S.g.turn === FOE) startAI();
  }

  /* ---------- 渲染 ---------- */
  function renderAll() {
    if (!S.g) return;
    renderSeatbar(); renderStatus(); renderOppPublic(); renderMyFigure(); renderInfo();
    renderWeapons(); renderSkills(); renderCharacter(); renderBoard(); renderHand(); renderPreview();
    renderPrompt(); renderSeason(); renderHistory(); renderQuickbar();
    maybeOfferSeasonChange();
    $('btnEnd').disabled = !(S.g.turn === HUMAN && !S.g.over);
  }

  function renderSeatbar() {
    const g = S.g, my = mySeat(), foe = foeSeat();
    $('seatbar').innerHTML = `<span class="sbme">你 ${my.text} · ${g.first === HUMAN ? '先手' : '后手'}</span><span class="sbfoe">庄家 ${foe.text} · ${g.first === FOE ? '先手' : '后手'}</span><span class="sbdiff">${DIFFICULTY.find(d => d.key === g.difficulty).name}</span>`;
  }

  function renderStatus() {
    const g = S.g, p = g.players[g.turn];
    const placed = g.placedThisTurn ? '已落子' : '可落子';
    $('status').innerHTML = `第 ${g.turnNo} 手 · <b>${p.name}</b> · ${placed} · 技能 ${g.skillsLeft}/2<br>你 ${E.remaining(g.players[0])}/8 · 庄家 ${E.remaining(g.players[1])}/8`;
  }

  function renderOppPublic() {
    const g = S.g, p = g.players[FOE];
    const hand = p.hand.map(id => {
      const c = CARDS[id], st = p.cardState[id];
      const sel = S.preview && S.preview.type === 'card' && S.preview.id === id;
      return `<button class="htile mini ${st} ${sel ? 'sel' : ''}" data-pcard="${id}" ${st !== 'hand' ? 'disabled' : ''} title="${c.name}">${D.portraitHtml(c, 20, 23)}<span>${c.role}</span></button>`;
    }).join('');
    const weapons = p.weapons.map(k => `<button class="wmini" data-pweapon="${k}" title="${wname(k)}">${wname(k)}</button>`).join('');
    $('oppPublic').innerHTML = `${figHtml(FOE, foeSeat(), false)}
      <div class="oppu"><div class="oplabel">可见手牌 · 武器</div><div class="ophand">${hand}</div><div class="opweapons">${weapons || '<span class="none">无</span>'}</div></div>`;
  }

  function renderMyFigure() { $('myFigure').innerHTML = figHtml(HUMAN, mySeat(), true); }

  function renderInfo() {
    const g = S.g, p = g.players[HUMAN];
    const board = E.ownUnits(g, HUMAN).length;
    $('myInfo').innerHTML = `<div class="myhead"><span>你</span><b>${mySeat().label}位</b></div>
      <div class="myline">人物牌 <b>${E.remaining(p)}</b>/8 · 手牌 <b>${p.hand.filter(c => p.cardState[c] === 'hand').length}</b></div>
      <div class="myline">场上 <b>${board}</b>/${E.BOARD_MAX} · 武器 <b>${p.weapons.length}</b> · 技能 <b>${g.skillsLeft}</b></div>`;
  }

  function weaponIconHtml(key, cls) {
    const store = window.WeaponSkinStore;
    if (!store || !store.icon) return '';
    return `<img class="${cls || ''}" src="${store.icon(key)}" alt="">`;
  }

  function renderWeapons() {
    const p = S.g.players[HUMAN], el = $('weapons');
    if (!p.weapons.length) { el.innerHTML = '<div class="emptyhint">没有装备</div>'; return; }
    el.innerHTML = p.weapons.map(wk => {
      const w = D.WEAPON_BY_KEY[wk], sel = S.sel && S.sel.type === 'weapon' && S.sel.key === wk;
      return `<button class="wcard ${sel ? 'sel' : ''}" data-weapon="${wk}">
        ${weaponIconHtml(wk, 'wicon')}
        <span class="wtext">
          <span class="wname">${w.name}</span>
          <span class="wtype">${w.type === 'melee' ? '近战' : w.type === 'ranged' ? '远程' : '盾'}${w.range > 1 ? ' · 距2' : ''}</span>
          <span class="wstats">${w.atk ? '攻' + (w.atk > 0 ? '+' : '') + w.atk : ''}${w.hp ? ' 血' + (w.hp > 0 ? '+' : '') + w.hp : ''}${w.shield ? ' 盾' + w.shield : ''}</span>
        </span>
      </button>`;
    }).join('');
  }

  function renderSkills() {
    const g = S.g, p = g.players[HUMAN], el = $('skills');
    el.innerHTML = SKILLS.map(sk => {
      const used = g.skillsUsedThisTurn[sk.key];
      const left = 2 - (p.skillUses[sk.key] || 0);
      const sel = S.sel && S.sel.type === 'skill' && S.sel.key === sk.key;
      return `<button class="skill ${used ? 'used' : ''} ${sel ? 'sel' : ''}" data-skill="${sk.key}" style="--c:${ELEMENTS[sk.element].color}">
        <span class="skname">${sk.name}<i>${TRIGRAMS[sk.trigram].sym}</i></span>
        <span class="skcond">${sk.attr}/${ROLES.find(r => r.name === sk.role).name} · <b class="uses">${left}/2</b></span>
      </button>`;
    }).join('');
  }

  function renderCharacter() {
    const wrap = $('charSkills');
    if (!wrap || !S.g) return;
    const g = S.g;
    const ch = D.CHARACTERS.find(c => c.key === g.character) || D.CHARACTERS[0];
    const myTurn = g.turn === HUMAN && !g.over;
    const res = g.charResult;
    const skills = ch.skills.map(key => {
      const sk = D.CHAR_SKILLS[key];
      const onceGame = key === 'avatar' || key === 'clone' || key === 'seize';
      const used = onceGame ? !!g.charUsedGame[key] : !!g.charUsed[key];
      const onBoard = (key === 'avatar' || key === 'clone') && g.summon && g.summon.type === key;
      const dis = used || !myTurn || key === 'seize' || ((key === 'avatar' || key === 'clone') && !!g.summon);
      const sub = key === 'sign' ? '系统判签' : key === 'divine' ? '三枚铜钱'
        : key === 'avatar' ? '选一魂入场' : key === 'clone' ? '选一魄入场' : '胜利结算';
      const state = onBoard ? '在场' : used ? '已用' : sk.limit;
      return `<button class="cskill ${used ? 'used' : ''}" data-cskill="${key}" ${dis ? 'disabled' : ''} title="${sk.desc}">
        <b>${sk.name}</b><i>${state}</i><span>${sub}</span>
      </button>`;
    }).join('');
    let choiceHtml = '';
    if (S.charChoice && myTurn) {
      const isAvatar = S.charChoice.type === 'avatar';
      const run = window.Meta ? window.Meta.get().run : null;
      const list = (isAvatar ? D.HUNS : D.POS).filter(x => {
        if (!run) return true;
        const st = isAvatar ? run.souls[x.key] : run.pos[x.key];
        return st && !st.lost && !(window.Meta && window.Meta.cooldown(x.key) > 0);
      });
      choiceHtml = `<div class="cchoice">
        <div class="cchoicehead">${isAvatar ? '选一魂化为化身（木 · 20/40 · 不占上限）' : '选一魄化为分身（金 · 20/30 · 占上限）'}</div>
        <div class="cchoicegrid">${list.map(x => `<button data-summon="${x.key}"><b>${x.name}</b><span>${isAvatar ? x.effect : '分身无额外特效；阵亡后转伪魄'}</span></button>`).join('')}</div>
        <button class="cchoicecancel" data-char-cancel>取消</button>
      </div>`;
    }
    let resHtml;
    if (res && res.kind === 'sign') {
      resHtml = `<div class="charres ${res.tone || 'plain'}"><b>${res.tier}</b><span>${res.effect}</span><i>${res.reason || ''}</i></div>`;
    } else if (res && res.kind === 'divine') {
      resHtml = `<div class="charres divine"><div class="coins">${res.coins.map((c, i) => `<i class="${c === '背' ? 'yang' : 'yin'}" style="--d:${i}">${c}</i>`).join('')}</div><b>${res.type}</b><span>${res.effect}${res.kills ? ` · 击杀 ${res.kills}` : ''}</span></div>`;
    } else if (g.summon) {
      resHtml = `<div class="charres plain"><b>${g.summon.type === 'avatar' ? '化身在场' : '分身在场'}</b><span>${g.summon.name} · 与另一形态不可同时在场</span></div>`;
    } else if (g.character === 'qingfeng') {
      resHtml = `<div class="charhint">化身不占 3 张上限，木 20/40；分身占上限，金 20/30。两者每局各一次、不可同时在场。化身阵亡失去对应魂；分身阵亡该魄转伪。</div>`;
    } else if (g.character === 'pangmen') {
      resHtml = `<div class="charhint">炼魂：每回合开始己方场上 +1 攻 / -2 血。夺魄在胜利结算时触发。</div>`;
    } else if (g.character === 'chier') {
      resHtml = `<div class="charhint">痴相：己方受伤 -4（蠢笨 + 愚痴）；每回合最多 2 张己方牌攻击且这两次 +2 伤害；推荐提示已隐去。本回合已攻击 ${g.chierAttacks || 0}/2。</div>`;
    } else {
      resHtml = `<div class="charhint">每回合各 1 次，不占人物行动；求签结果只有你可见。</div>`;
    }
    wrap.innerHTML = `<div class="charwho"><b>${ch.name}</b><span>${ch.passive}</span></div><div class="cskills">${skills}</div>${choiceHtml}${resHtml}`;
  }

  function renderQuickbar() {
    const bar = $('quickbar');
    if (!bar) return;
    if (!S.g) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const g = S.g, p = g.players[HUMAN];
    const myTurn = g.turn === HUMAN && !g.over;
    const cancel = !!(S.sel || S.pending);
    const wc = $('qWeaponCount'), sc = $('qSkillCount'), end = $('btnQuickEnd');
    if (wc) { wc.textContent = p.weapons.length; wc.classList.toggle('zero', p.weapons.length === 0); }
    if (sc) { sc.textContent = g.skillsLeft; sc.classList.toggle('zero', g.skillsLeft === 0); }
    if (end) {
      end.disabled = !(myTurn || cancel);
      end.classList.toggle('cancel', cancel);
      end.innerHTML = cancel ? '<b>返</b><span>取消</span>' : myTurn ? '<b>终</b><span>结束</span>' : '<b>…</b><span>等待</span>';
    }
  }

  function sheetDetailEl(kind) { return $(kind === 'weapon' ? 'weaponDetail' : 'skillDetail'); }
  function sheetError(kind, msg) {
    const el = sheetDetailEl(kind);
    if (el) el.innerHTML = `<b class="sderr">${msg}</b>`;
  }
  function showSheetDetail(kind, key) {
    const el = sheetDetailEl(kind);
    if (!el) return;
    const box = $(kind === 'weapon' ? 'weapons' : 'skills');
    if (box) box.querySelectorAll('.inspect').forEach(x => x.classList.remove('inspect'));
    if (!key) {
      el.innerHTML = `<span class="sdhint">${kind === 'weapon' ? '单击查看武器，双击后选择场上角色装备。' : '单击查看技能，双击后选择场上角色施放。'}</span>`;
      return;
    }
    const g = S.g;
    if (kind === 'weapon') {
      const w = D.WEAPON_BY_KEY[key];
      if (!w) return;
      const card = box && box.querySelector(`[data-weapon="${key}"]`);
      if (card) card.classList.add('inspect');
      const targets = g ? E.equipTargets(g, HUMAN).length : 0;
      el.innerHTML = `<b>${w.name}</b><span class="sdmeta">${w.type === 'melee' ? '近战' : w.type === 'ranged' ? '远程' : '盾牌'}${w.range > 1 ? ' · 距离 2' : ''} · ${w.atk ? '攻' + (w.atk > 0 ? '+' : '') + w.atk + ' ' : ''}${w.hp ? '血' + (w.hp > 0 ? '+' : '') + w.hp + ' ' : ''}${w.shield ? '盾' + w.shield : ''}</span><div>${w.desc}</div><div class="sdhint">双击装备，或点下面的按钮 · 当前可装备单位 ${targets} 张</div><div class="sduse"><button data-use-weapon="${key}">装备这件武器</button></div>`;
      return;
    }
    const sk = D.SKILL_BY_KEY[key], p = g ? g.players[HUMAN] : null;
    if (!sk) return;
    const card = box && box.querySelector(`[data-skill="${key}"]`);
    if (card) card.classList.add('inspect');
    const left = p ? 2 - (p.skillUses[key] || 0) : 2;
    el.innerHTML = `<b>${sk.name}</b><span class="sdmeta">${sk.attr}/${sk.role} · 整局剩余 ${left}/2 · ${g && g.skillsUsedThisTurn[key] ? '本手已用' : '本手可用'}</span><div>${sk.desc}</div><div class="sdhint">双击施放，或点下面的按钮后选择场上角色；不想用点“返回”。</div><div class="sduse"><button data-use-skill="${key}">施放这个技能</button></div>`;
  }
  function openSheet(kind) {
    if (!S.g || S.g.over) return;
    closeSheets();
    const sheet = $(kind === 'weapon' ? 'weaponSheet' : 'skillSheet');
    if (!sheet) return;
    sheet.classList.add('show');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('px-sheet-open');
    showSheetDetail(kind, null);
  }
  function closeSheets() {
    for (const id of ['weaponSheet', 'skillSheet']) {
      const el = $(id);
      if (!el) continue;
      el.classList.remove('show');
      el.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('px-sheet-open');
  }
  function tryUseWeaponFromSheet(wk) {
    const g = S.g;
    if (!g || g.over) return;
    if (S.mode === 'cheng' && S.extra && S.extra.slot) { closeSheets(); onWeapon(wk, true); return; }
    if (g.turn !== HUMAN) { sheetError('weapon', '现在不是你的回合'); return; }
    if (!E.equipTargets(g, HUMAN).length) { sheetError('weapon', '没有可以装备的己方单位（刚落子或已行动）'); return; }
    closeSheets();
    clearSel();
    onWeapon(wk, true);
    ensureBoardVisible();
    flashMsg('选择场上角色装备');
  }
  function tryUseSkillFromSheet(key) {
    const g = S.g, p = g && g.players[HUMAN];
    if (!g || g.over || !p) return;
    if (g.turn !== HUMAN) { sheetError('skill', '现在不是你的回合'); return; }
    if (g.skillsLeft <= 0) { sheetError('skill', '本手技能已经用完'); return; }
    if (g.skillsUsedThisTurn[key]) { sheetError('skill', '本手已经用过这张技能'); return; }
    if ((p.skillUses[key] || 0) >= 2) { sheetError('skill', '这张技能整局已经用完'); return; }
    if (key === 'chengzai' && !p.weapons.length) { sheetError('skill', '手上没有装备可以换'); return; }
    if (!E.skillTargets(g, HUMAN).length) { sheetError('skill', '没有可以施法的己方单位'); return; }
    closeSheets();
    clearSel();
    onSkill(key);
    ensureBoardVisible();
    flashMsg('选择场上角色施放');
  }

  function fieldBadge(u) {
    const t = [];
    if (u.fieldDmg > 0) t.push('<i class="st buff">伤+1</i>');
    if (u.fieldDmg < 0) t.push('<i class="st debuff">伤-1</i>');
    if (u.fieldArmor > 0) t.push('<i class="st armor">减伤</i>');
    if (u.fieldVuln > 0) t.push('<i class="st vuln">增伤</i>');
    if (u.fieldBurnOnHit) t.push('<i class="st fire">火</i>');
    if (u.burn > 0) t.push(`<i class="st burn">烧${u.burn}</i>`);
    if (u.poison > 0) t.push(`<i class="st poison">毒${u.poison}</i>`);
    if (u.guard === 'firm') t.push('<i class="st guard">坚守</i>');
    else if (u.guard === 'hasty') t.push('<i class="st guard">御</i>');
    if (u.justPlayed) t.push('<i class="st new">新</i>');
    else if (u.acted && !(u.extraActions > 0)) t.push('<i class="st done">已</i>');
    if (u.extraActions > 0) t.push(`<i class="st extra">+${u.extraActions}行</i>`);
    if (u.attackBan > 0) t.push(`<i class="st ban">攻禁${u.banTurns || u.attackBan}</i>`);
    if (u.skillBan > 0) t.push('<i class="st sban">技禁</i>');
    return t.length ? `<div class="ubadges">${t.join('')}</div>` : '';
  }

  function applyBoardSkin() {
    const b = $('board');
    if (!b || !S.g) return;
    const level = window.Campaign ? window.Campaign.get(S.g.levelIndex || 0) : null;
    const key = level ? level.key : 'taiji';
    b.style.backgroundImage = `url('assets/pixel/boards/table_${key}.png')`;
    b.dataset.level = key;
  }

  function renderBoard() {
    const g = S.g;
    const order = E.viewOrder(g.humanSeat);
    const placeable = S.mode === 'place' && S.sel && S.sel.type === 'card' ? E.validSlots(g, HUMAN, S.sel.id) : [];
    const targets = S.mode === 'unit' && S.sel && S.sel.slot ? E.attackTargets(g, HUMAN, S.sel.slot) : [];
    const moves = S.mode === 'unit' && S.sel && S.sel.slot ? E.moveTargets(g, HUMAN, S.sel.slot) : [];
    const equipable = S.mode === 'equip' ? E.equipTargets(g, HUMAN) : [];
    const skillable = S.mode === 'skill' ? E.skillTargets(g, HUMAN) : [];
    const zhi = S.mode === 'zhi' && S.extra ? E.rangeEnemies(g, S.extra.slot) : [];
    const dong = S.mode === 'dong' && S.extra ? E.adjacent(S.extra.slot) : [];
    const mySeatKey = E.seatSlot(g.humanSeat), foeSeatKey = E.farSlot(g.humanSeat);
    let html = `<div class="taiji big">${TAIJI}</div><div class="taiji small">${TAIJI_FIRE}</div>`;
    html += `<div class="seatmark bottom">你 · ${mySeat().label}位</div><div class="seatmark top">庄家 · ${foeSeat().label}位</div>`;
    for (let i = 0; i < order.length; i++) {
      const key = order[i], t = TRIGRAMS[key], u = E.unitAt(g, key), ec = ELEMENTS[t.element];
      const sel = S.sel && S.sel.type === 'unit' && S.sel.slot === key;
      const valid = placeable.includes(key);
      const target = targets.includes(key) || zhi.includes(key);
      const move = moves.includes(key);
      const eq = equipable.includes(key);
      const sk = skillable.includes(key);
      const dongA = dong.includes(key) && u && u.owner === HUMAN;
      const isSeat = key === mySeatKey || key === foeSeatKey;
      let inner;
      if (u) {
        const guardCls = u.guard ? `guarding ${u.guard}` : '';
        inner = `<div class="unit ${u.owner === HUMAN ? 'mine' : 'foe'} ${guardCls} ${sel ? 'sel' : ''}" style="--ec:${ec.color}" data-slot="${key}">
          <div class="uport">${D.portraitHtml(u.card, 30, 34)}</div>
          <div class="uname">${u.card.name}</div>
          <div class="ustats"><span class="a">${u.atk}</span><span class="h">${u.hp}</span></div>
          ${u.shield > 0 ? `<div class="ushield">盾${u.shield}</div>` : ''}
          ${u.weapon ? `<div class="uweapon">${weaponIconHtml(u.weapon.key, 'uwicon')}${u.weapon.name}</div>` : ''}
          ${fieldBadge(u)}
        </div>`;
      } else {
        inner = `<div class="cempty"><b>${t.sym} ${t.name}</b><span>${t.dir} · ${ec.name}</span><em>空位 · ${ROLES.find(r => r.name === t.role).name}</em></div>`;
      }
      const sideCls = u ? (u.owner === HUMAN ? 'has-mine' : 'has-foe') : '';
      html += `<div class="slot ${valid ? 'valid' : ''} ${target ? 'target' : ''} ${move ? 'move' : ''} ${eq ? 'equipable' : ''} ${sk ? 'skillable' : ''} ${dongA ? 'ally' : ''} ${isSeat ? 'seat' : ''} ${sel ? 'selected' : ''} ${sideCls}" data-slot="${key}" style="--a:${i * 45}deg;--c:${ec.color}">
        <div class="slothead"><b>${t.sym} ${t.name}</b><span>${t.dir} · ${ec.name}</span></div>
        ${inner}
      </div>`;
    }
    $('board').innerHTML = html;
  }

  function handTile(cid, p, opts) {
    const c = CARDS[cid], st = p.cardState[cid];
    const sel = S.sel && S.sel.type === 'card' && S.sel.id === cid;
    const ec = D.ELEMENTS[c.element] || D.ELEMENTS.metal;
    const pixel = document.body.classList.contains('pixelbody');
    const label = pixel ? c.role : c.name;
    return `<button class="htile ${st} ${sel ? 'sel' : ''} ${opts && opts.mini ? 'mini' : ''}" data-card="${cid}" title="${c.name} · ${c.atk}/${c.hp}" style="--ec:${ec.color}" ${st !== 'hand' && !(opts && opts.showState) ? 'disabled' : ''}>
      <span class="htop"><b>${c.sym} ${c.attr}</b><i>${c.role}</i></span>
      <span class="hattr">${c.attr}</span>
      <span class="hport">${D.portraitHtml(c, opts && opts.mini ? 22 : 70, opts && opts.mini ? 25 : 74)}</span>
      <span class="hname">${label}</span>
      <span class="hstats"><i class="a">${c.atk}</i><i class="h">${c.hp}</i></span>
      ${st === 'board' ? '<span class="hstate">场上</span>' : st === 'dead' ? '<span class="hstate dead">亡</span>' : ''}
    </button>`;
  }

  function renderHand() {
    const g = S.g, p = g.players[HUMAN];
    const board = E.ownUnits(g, HUMAN).length;
    $('handHead').innerHTML = `<span>人物牌 · 手牌 ${p.hand.filter(c => p.cardState[c] === 'hand').length}/8</span><span>场上 ${board}/${E.BOARD_MAX}</span><span>${g.placedThisTurn ? '本手已落子' : '可落子 1 张'}</span>`;
    $('hand').innerHTML = p.hand.map(cid => handTile(cid, p)).join('');
  }

  function selectedCard() {
    if (!S.g || !S.sel || S.sel.type !== 'card') return null;
    const p = S.g.players[HUMAN];
    return p.cardState[S.sel.id] === 'hand' ? CARDS[S.sel.id] : null;
  }
  function bestPlacementNote(card) {
    if (S.g && S.g.character === 'chier') return '愚钝：＊';
    const empties = E.RING.filter(k => !S.g.board[k]);
    if (!empties.length) return '场上没有空位。';
    let best = null;
    for (const k of empties) {
      const b = E.placement(card, TRIGRAMS[k]);
      if (!best || b.atk + b.hp > best.atk + best.hp) best = { k, ...b };
    }
    return `最佳落位：${TRIGRAMS[best.k].name}席 → ${best.atk} 攻 / ${best.hp} 血`;
  }

  function renderPreview() {
    const el = $('previewPanel');
    if (!S.g) { el.innerHTML = '<div class="pvhint">点击人物牌、场上单位、武器或技能查看介绍</div>'; return; }
    if (S.pending && S.sel && S.sel.type === 'unit') {
      const fc = E.forecast(S.g, HUMAN, S.pending.from, S.pending.to);
      const a = E.unitAt(S.g, S.pending.from), t = E.unitAt(S.g, S.pending.to);
      if (fc && a && t) {
        el.innerHTML = `<div class="fc">
          <div class="fcnames">${a.card.name} → ${t.card.name}</div>
          <div class="fcdmg">${fc.dmg}<small> 伤</small></div>
          <div class="fcbreak">${a.atk} 攻${fc.fieldDmg ? ' · 场地' + (fc.fieldDmg > 0 ? '+1' : '-1') : ''}${fc.over ? ' · 克+1' : ''}${fc.mult > 1 ? ' · ×' + fc.mult : ''}${fc.absorbed ? ' · 盾挡' + fc.absorbed : ''}${fc.armor ? ' · 减伤' + fc.armor : ''}${fc.vuln ? ' · 增伤' + fc.vuln : ''}</div>
          <div class="fchp">目标 ${t.hp} → ${fc.hpAfter} 血${fc.kill ? ' · <b class="kill">击杀</b>' : ''}${fc.burn ? ' · 灼烧' : ''}</div>
          <div class="fcconfirm">再点一次「${t.card.name}」确认攻击</div>
        </div>`;
        return;
      }
    }
    const sc = selectedCard();
    if (sc) {
      const ec = ELEMENTS[sc.element], rc = ELEMENTS[sc.roleElement];
      el.innerHTML = `<div class="pvport">${D.portraitHtml(sc, 70, 82)}</div>
        <div class="pvinfo"><div class="pvt"><b>${sc.name}</b><span>${sc.attr} · ${sc.role}</span></div>
        <div class="pvstats"><span>${sc.atk} 攻</span><span>${sc.hp} 血</span></div>
        <div class="pvline">牌属${ec.name}，家庭物象属${rc.name}。${bestPlacementNote(sc)}</div>
        <div class="pvnote">点击空席落子；落子后当回合不能行动</div></div>`;
      return;
    }
    if (S.sel && S.sel.type === 'unit') {
      const u = E.unitAt(S.g, S.sel.slot);
      if (!u) { el.innerHTML = '<div class="pvhint">这个卦位已经空了</div>'; return; }
      const st = [];
      if (u.weapon) st.push(u.weapon.name);
      if (u.fieldDmg) st.push(u.fieldDmg > 0 ? '本回合伤害 +1' : '本回合伤害 -1');
      if (u.fieldArmor) st.push('本回合受伤 -1');
      if (u.fieldVuln) st.push('本回合受伤 +1');
      if (u.fieldBurnOnHit) st.push('攻击附加灼烧');
      if (u.burn) st.push(`灼烧 ${u.burn} 回合`);
      if (u.justPlayed) st.push('刚落子');
      else if (u.acted) st.push('已行动');
      if (u.extraActions) st.push(`额外行动 ${u.extraActions}`);
      el.innerHTML = `<div class="pvport">${D.portraitHtml(u.card, 70, 82)}</div>
        <div class="pvinfo"><div class="pvt"><b>${u.card.name}</b><span>${u.owner === HUMAN ? '你' : '庄家'} · ${TRIGRAMS[u.slot].name}席</span></div>
        <div class="pvstats"><span>${u.atk} 攻</span><span>${u.hp}/${u.maxHp} 血</span>${u.shield ? `<span>盾 ${u.shield}</span>` : ''}</div>
        <div class="pvline">${st.length ? st.join(' · ') : '待命'} · 攻击距离 ${u.range}</div>
        <div class="pvnote">${u.owner === HUMAN ? '点击可攻击红色目标或移动到相邻空位' : '敌方单位'}</div></div>`;
      return;
    }
    if (S.sel && S.sel.type === 'weapon') {
      const w = D.WEAPON_BY_KEY[S.sel.key];
      el.innerHTML = `<div class="pvicon">${w.type === 'shield' ? '盾' : w.type === 'ranged' ? '弓' : '刃'}</div>
        <div class="pvinfo"><div class="pvt"><b>${w.name}</b><span>${w.type === 'melee' ? '近战' : w.type === 'ranged' ? '远程' : '盾牌'}</span></div>
        <div class="pvstats">${w.atk ? `<span>攻 ${w.atk > 0 ? '+' : ''}${w.atk}</span>` : ''}${w.hp ? `<span>血 ${w.hp > 0 ? '+' : ''}${w.hp}</span>` : ''}${w.shield ? `<span>盾 ${w.shield}</span>` : ''}</div>
        <div class="pvline">${w.desc}</div><div class="pvnote">点击一张能行动的己方单位装备</div></div>`;
      return;
    }
    if (S.sel && S.sel.type === 'skill') {
      const sk = D.SKILL_BY_KEY[S.sel.key];
      el.innerHTML = `<div class="pvicon" style="color:${ELEMENTS[sk.element].color}">${TRIGRAMS[sk.trigram].sym}</div>
        <div class="pvinfo"><div class="pvt"><b>${sk.name}</b><span>${sk.attr}/${ROLES.find(r => r.name === sk.role).name}</span></div>
        <div class="pvline">${sk.desc}</div>
        <div class="pvnote">本手最多 2 张不同技能；每张整局 2 次</div></div>`;
      return;
    }
    if (S.preview) {
      if (S.preview.type === 'card') {
        const c = CARDS[S.preview.id];
        el.innerHTML = `<div class="pvport">${D.portraitHtml(c, 70, 82)}</div>
          <div class="pvinfo"><div class="pvt"><b>${c.name}</b><span>庄家手牌</span></div>
          <div class="pvstats"><span>${c.atk} 攻</span><span>${c.hp} 血</span></div>
          <div class="pvline">牌属${ELEMENTS[c.element].name} · 物象属${ELEMENTS[c.roleElement].name}</div></div>`;
        return;
      }
      if (S.preview.type === 'weapon') {
        const w = D.WEAPON_BY_KEY[S.preview.key];
        el.innerHTML = `<div class="pvicon">${w.type === 'shield' ? '盾' : w.type === 'ranged' ? '弓' : '刃'}</div>
          <div class="pvinfo"><div class="pvt"><b>${w.name}</b><span>庄家武器</span></div><div class="pvline">${w.desc}</div></div>`;
        return;
      }
    }
    el.innerHTML = '<div class="pvhint">点击人物牌、场上单位、武器或技能查看介绍</div>';
  }

  function renderPrompt() {
    const g = S.g, el = $('prompt');
    if (S.flash) { el.textContent = S.flash; return; }
    if (g.over) { el.textContent = '对局结束'; return; }
    if (g.turn === FOE) { el.innerHTML = '<b>庄家行动中…</b>'; return; }
    if (S.pending) { el.innerHTML = '再点一次目标确认攻击 · 点别处取消'; return; }
    if (S.mode === 'trick') {
      const b = g.blessings ? g.blessings[HUMAN] : null;
      const two = b && b.key === 't_autumn';
      el.innerHTML = `妙计「${b ? b.name : ''}」：${two ? (S.trickPicks.length ? '再选第二张牌' : '选第一张牌') : '选一个目标'}`;
      return;
    }
    if (S.mode === 'place') { el.innerHTML = '落子：点一个空席 <span class="sub">或再点一张牌取消</span>'; return; }
    if (S.mode === 'unit') {
      let bar = '';
      let cooldown = false;
      const slot = S.sel && S.sel.slot;
      if (slot) {
        const u = E.unitAt(g, slot);
        if (u && u.owner === HUMAN) {
          cooldown = g.turnNo < (u.hastyCdUntil || 0);
          const b = [];
          if (E.defendValid(g, HUMAN, slot, 'hasty').ok) b.push(`<button class="dbtn" data-defend="hasty" data-slot="${slot}">仓促防御</button>`);
          if (E.defendValid(g, HUMAN, slot, 'firm').ok) b.push(`<button class="dbtn" data-defend="firm" data-slot="${slot}">坚守防御</button>`);
          if (E.defendValid(g, HUMAN, slot, 'cancel').ok) b.push(`<button class="dbtn warn" data-defend="cancel" data-slot="${slot}">解除坚守</button>`);
          if (b.length) bar = `<span class="defendbar">${b.join('')}</span>`;
        }
      }
      el.innerHTML = '点红色敌人攻击 · 点蓝色邻位移动 <span class="sub">每张牌本回合一次</span>' + (cooldown && !bar ? '<span class="sub cooldownhint">防御冷却中 · 本回合不能再防御</span>' : '') + bar;
      return;
    }
    if (S.mode === 'equip') { el.innerHTML = '装备：点一张能行动的己方单位'; return; }
    if (S.mode === 'skill') { el.innerHTML = `技能「${D.SKILL_BY_KEY[S.sel.key].name}」：点一个自己的单位`; return; }
    if (S.mode === 'zhi') { el.innerHTML = '止：点该单位范围内的一名敌人'; return; }
    if (S.mode === 'cheng') { el.innerHTML = '承载：点一件手牌武器换上'; return; }
    if (S.mode === 'dong') { el.innerHTML = '动：点一个相邻友军获得额外行动'; return; }
    const board = E.ownUnits(g, HUMAN).length;
    el.innerHTML = `落子 1 张 · 场上每张牌行动一次 · 技能 ${g.skillsLeft}/2 <span class="sub">场上 ${board}/${E.BOARD_MAX}</span>`;
  }

  function renderSeason() {
    const g = S.g;
    const idx = (g.month - 1) % 12;
    const B = window.Blessings;
    const b = g.blessings ? g.blessings[HUMAN] : null;
    const foe = g.blessings ? g.blessings[FOE] : null;
    const st = g.blessState ? g.blessState[HUMAN] : null;
    const trickReady = !!(b && b.kind === 'trick' && b.key !== 't_winter' && st && !st.trick);
    const seasonTxt = B ? B.seasonName(g.season) : '—';
    $('season').innerHTML = `${g.levelName ? `<div class="levelbadge">${g.levelName} · ${g.bossName}</div>` : ''}<div class="blessbar"><span>天时 · ${seasonTxt}</span><b class="${b && b.kind === 'trick' ? 'trick' : ''}">${b ? b.name : '无'}</b>${trickReady ? `<button class="trickbtn" data-trick-start>妙计可用</button>` : ''}</div>
      <div class="foebless">庄家福缘：${foe ? foe.name : '无'}</div>
      <div class="seasontop"><span>场地 · 每轮开始</span><b>${g.term.name}</b></div>
      ${FIELD_RULES.map(f => `<div class="fgrow" style="--c:${ELEMENTS[f.el].color}"><b>${ELEMENTS[f.el].name}</b><span>生 ${f.gen}</span><span>同 ${f.equal}</span><span>克 ${f.over}</span></div>`).join('')}
      <div class="termline">第 ${g.month} 月 · ${g.term.name}/${g.term.zhong}</div>`;
  }

  function startTrick() {
    const g = S.g;
    if (!g || g.over || g.turn !== HUMAN) return;
    const b = g.blessings ? g.blessings[HUMAN] : null;
    const st = g.blessState ? g.blessState[HUMAN] : null;
    if (!b || b.kind !== 'trick' || b.key === 't_winter') { flashMsg('这个妙计会在阵亡时自动触发'); return; }
    if (st && st.trick) { flashMsg('本季妙计已经用过'); return; }
    S.mode = 'trick'; S.trickPicks = []; S.sel = { type: 'trick' }; S.extra = null; S.pending = null;
    renderAll();
  }
  function useTrickAt(key) {
    const g = S.g, b = g && g.blessings ? g.blessings[HUMAN] : null;
    if (!b || b.kind !== 'trick') return;
    if (b.key === 't_autumn') {
      if (!S.trickPicks.length) {
        if (!E.unitAt(g, key)) { flashMsg('选一张场上的牌'); return; }
        S.trickPicks = [key]; renderAll(); return;
      }
      if (S.trickPicks[0] === key) { flashMsg('选另一张牌'); return; }
      const r = E.useTrick(g, HUMAN, S.trickPicks[0], key);
      if (!r.ok) { flashMsg(r.msg); return; }
      showCastBanner(`妙计 · ${b.name}`, 'weapon');
      pulseSlot(key, 'weapon');
      clearSel(); S.trickPicks = []; refresh(); checkOver(); return;
    }
    const u = E.unitAt(g, key);
    if (b.key === 't_spring' && (!u || u.owner === HUMAN)) { flashMsg('借东风要选一名敌人'); return; }
    if (b.key === 't_summer' && (!u || u.owner === HUMAN || !u.burn)) { flashMsg('火中取栗要选一名已灼烧的敌人'); return; }
    const r = E.useTrick(g, HUMAN, key);
    if (!r.ok) { flashMsg(r.msg); return; }
    showCastBanner(`妙计 · ${b.name}`, 'weapon');
    pulseSlot(key, 'weapon');
    clearSel(); refresh(); checkOver();
  }

  const KIND = { month: '月', turn: '手', place: '出', attack: '攻', equip: '装', move: '移', skill: '技', death: '亡', end: '终', term: '场', defend: '御', round: '转', sign: '签', divine: '卦' };
  function renderHistory() {
    const g = S.g;
    const logs = g.log.slice(-70);
    $('history').innerHTML = `<div class="hhead"><span>牌桌记录</span><i>${g.log.length} 条</i></div><div class="hbody">` +
      logs.map(l => `<div class="hrow ${l.kind} ${l.actor === HUMAN ? 'me' : l.actor === FOE ? 'foe' : ''}"><span class="hk">${KIND[l.kind] || '·'}</span><span class="ht">${l.text}</span></div>`).join('') +
      `</div>`;
    const b = $('history').querySelector('.hbody');
    if (b) b.scrollTop = b.scrollHeight;
  }

  /* ---------- 交互 ---------- */
  function updateTerm(force) {
    const t = S.g.term;
    if (force || S.lastTerm !== t.name || S.lastRound !== S.g.round) {
      S.lastTerm = t.name; S.lastRound = S.g.round;
      FX.setTerm(t, S.g.month);
    }
  }
  function showCombo(text, kill) {
    const el = $('comboBanner');
    if (!el) return;
    el.textContent = text + (kill ? ' · 击杀' : '');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function announceSkill(r, fallbackKey, slot) {
    if (!r || !r.note) return;
    const name = r.skill || (D.SKILL_BY_KEY[fallbackKey] || {}).name || '技能';
    showCombo(`${name} · ${r.note}`, false);
    showCastBanner(`${name} · ${r.note}`, 'skill');
    if (slot) pulseSlot(slot, 'skill');
  }

  function ensureAiUi() {
    const host = $('app') || document.body;
    if ($('aiBanner')) return;
    const wrap = document.createElement('div');
    wrap.className = 'aiui';
    wrap.innerHTML = `<div class="castbanner" id="castBanner"></div>
      <div class="aibanner" id="aiBanner"><span id="aiBannerText"></span><button id="btnAiSkip">加速</button></div>
      <div class="aitrack" id="aiTrack"></div>
      <div class="deathcard" id="deathCard"></div>
      <div class="airecap" id="aiRecap"><div id="aiRecapBody"></div><button id="aiRecapClose">收起</button></div>`;
    host.appendChild(wrap);
    const skip = $('btnAiSkip');
    if (skip) skip.addEventListener('click', () => { S.aiFast = true; });
    const close = $('aiRecapClose');
    if (close) close.addEventListener('click', () => $('aiRecap').classList.remove('show'));
  }
  function showCastBanner(text, type) {
    ensureAiUi();
    const el = $('castBanner');
    if (!el) return;
    el.className = 'castbanner ' + (type || '');
    el.textContent = text;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1500);
  }
  function pulseAt(rect, type) {
    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'pxpulse ' + (type || 'skill');
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    const colors = type === 'weapon' ? ['#f0cc6e', '#d0ae58', '#f7f3e8'] : ['#f0cc6e', '#6f9ca3', '#b4472f', '#f7f3e8'];
    el.innerHTML = Array.from({ length: 14 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 14 + Math.random() * .4;
      const d = 18 + Math.random() * 28;
      return `<i style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--c:${colors[i % colors.length]};--dl:${Math.random() * .12}s"></i>`;
    }).join('');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  function pulseSlot(slot, type) {
    const el = document.querySelector(`.slot[data-slot="${slot}"] .unit`);
    if (el) pulseAt(el.getBoundingClientRect(), type);
  }
  function showAiBanner(text) {
    ensureAiUi();
    const b = $('aiBanner');
    const t = $('aiBannerText');
    if (t) t.textContent = text;
    if (b) b.classList.add('show');
  }
  function hideAiBanner() {
    const b = $('aiBanner');
    if (b) b.classList.remove('show');
  }
  function aiLabel(a) {
    if (!a) return '行动';
    if (a.type === 'skill') return `技能「${a.name}」→ ${a.targetName || '目标'}`;
    if (a.type === 'place') return `落子「${a.name}」→ ${D.TRIGRAMS[a.slot] ? D.TRIGRAMS[a.slot].name : a.slot}`;
    if (a.type === 'attack') return `攻击「${a.targetName}」- ${a.damage}`;
    if (a.type === 'equip') return `装备「${a.name}」→ ${a.targetName}`;
    if (a.type === 'move') return `移动 ${D.TRIGRAMS[a.from] ? D.TRIGRAMS[a.from].name : a.from} → ${D.TRIGRAMS[a.to] ? D.TRIGRAMS[a.to].name : a.to}`;
    if (a.type === 'defend') return `${a.mode === 'firm' ? '坚守' : '仓促'}防御 · ${a.targetName}`;
    return '行动';
  }
  function renderAiTrack() {
    const el = $('aiTrack');
    if (!el) return;
    if (!S.aiTurn || !S.aiActions.length) { el.classList.remove('show'); el.innerHTML = ''; return; }
    el.classList.add('show');
    el.innerHTML = `<b>庄家 · 第 ${S.aiActions.length} 步</b>` + S.aiActions.map((a, i) =>
      `<span class="${i === S.aiActions.length - 1 ? 'cur' : ''}">${i + 1} ${aiLabel(a)}</span>`).join('');
  }
  function markAi(a, on) {
    document.querySelectorAll('.ai-source,.ai-target').forEach(x => x.classList.remove('ai-source', 'ai-target'));
    if (!on || !a) return;
    const add = (slot, cls) => { if (!slot) return; const el = document.querySelector(`.slot[data-slot="${slot}"]`); if (el) el.classList.add(cls); };
    if (a.type === 'attack') { add(a.from, 'ai-source'); add(a.to, 'ai-target'); }
    else if (a.type === 'move') { add(a.from, 'ai-source'); add(a.to, 'ai-target'); }
    else { add(a.slot, 'ai-target'); if (a.type === 'place') add(a.slot, 'ai-target'); }
  }
  function showDeathCard(a, logs) {
    ensureAiUi();
    const el = $('deathCard');
    if (!el) return;
    const death = (logs || []).filter(l => l.kind === 'death').slice(-1)[0];
    let formula = '';
    if (a && a.type === 'attack' && a.forecast) {
      const f = a.forecast;
      formula = `基础 ${f.base} · 盾挡 ${f.absorbed}${f.halved ? ` · 防御减半 -${f.halved}` : ''} · 实伤 ${a.damage}`;
    } else if (a && a.type === 'skill') {
      formula = `${a.name}${a.note ? ' · ' + a.note : ''}`;
    }
    el.innerHTML = `<b>「${a && a.targetName ? a.targetName : '人物牌'}」阵亡</b><span>${a && a.fromName ? a.fromName + ' → ' + a.targetName : '阵亡'}</span>${formula ? `<div>${formula}</div>` : ''}${death ? `<small>${death.text}</small>` : ''}`;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function showAiRecap() {
    ensureAiUi();
    const el = $('aiRecap'), body = $('aiRecapBody');
    if (!el || !body || !S.aiActions.length) return;
    const deaths = S.aiDeaths.slice(-2);
    body.innerHTML = `<b>庄家这一手 · ${S.aiActions.length} 步</b><ol>${S.aiActions.map(a => `<li>${aiLabel(a)}</li>`).join('')}</ol>${deaths.length ? `<div class="recapdeath">${deaths.map(d => `<span>${d}</span>`).join('')}</div>` : ''}`;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 8000);
  }
  function aiActionSlot(a) {
    if (!a) return null;
    if (a.type === 'attack') return a.to;
    if (a.type === 'move') return a.to;
    return a.slot;
  }
  function aiNextStep() {
    if (!S.g || S.g.over || S.g.turn !== FOE) { finishAiTurn(); return; }
    const beforeLog = S.g.log.length;
    const r = AI.step(S.g, FOE);
    if (!r || !r.action) { finishAiTurn(); return; }
    const a = r.action;
    S.aiStep++;
    S.aiActions.push(a);
    S.sel = null; S.mode = null; S.extra = null; S.pending = null;
    showAiBanner(`第 ${S.aiActions.length} 步 · ${aiLabel(a)}`);
    markAi(a, true);
    renderAiTrack();
    const slot = aiActionSlot(a);
    const rect = slot ? document.querySelector(`.slot[data-slot="${slot}"]`)?.getBoundingClientRect() || null : null;
    const intentDelay = S.aiFast || S.aiActions.length >= 5 ? 180 : 430;
    S.aiTimer = setTimeout(() => {
      refresh();
      markAi(a, false);
      if (a.type === 'skill') {
        showCastBanner(`庄家 · ${a.name}${a.targetName ? ' → ' + a.targetName : ''}`, 'skill');
        pulseAt(rect, 'skill');
      } else if (a.type === 'equip') {
        showCastBanner(`庄家装备 · ${a.name} → ${a.targetName}`, 'weapon');
        pulseAt(rect, 'weapon');
      } else if (a.type === 'attack' && rect) {
        FX.hitAt(rect, String(a.damage), a.kill);
      }
      const newLogs = S.g.log.slice(beforeLog);
      const newDeaths = newLogs.filter(l => l.kind === 'death');
      S.aiDeaths.push(...newDeaths.map(l => l.text));
      if (a.kill || newDeaths.length) showDeathCard(a, newLogs);
      renderAiTrack();
      const resultDelay = S.aiFast || S.aiActions.length >= 5 ? 300 : 700;
      S.aiTimer = setTimeout(aiNextStep, resultDelay);
    }, intentDelay);
  }
  function finishAiTurn() {
    clearTimeout(S.aiTimer);
    S.aiTurn = false;
    hideAiBanner();
    markAi(null, false);
    renderAiTrack();
    if (!S.g) return;
    refresh();
    showAiRecap();
    if (S.g.over) setTimeout(showResult, 1100);
  }
  function shakeArena() {
    const el = document.querySelector('.arena');
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 320);
  }
  function clearSel() { S.sel = null; S.mode = null; S.extra = null; S.pending = null; }
  function refresh() { renderAll(); updateTerm(false); }
  function ensureBoardVisible() {
    const b = document.querySelector('.boardwrap');
    if (!b) return;
    const r = b.getBoundingClientRect();
    if (r.top < 64 || r.bottom > innerHeight - 70) b.scrollIntoView({ behavior: 'auto', block: 'center' });
  }

  function onCard(cid, mine) {
    if (!S.g || S.g.over) return;
    const p = S.g.players[HUMAN];
    if (!mine) {
      S.preview = { type: 'card', id: cid }; renderPreview(); return;
    }
    if (p.cardState[cid] !== 'hand') { flashMsg('这张牌已经不在手上'); return; }
    if (S.g.turn !== HUMAN) { S.sel = { type: 'card', id: cid }; S.mode = null; renderAll(); return; }
    if (S.sel && S.sel.type === 'card' && S.sel.id === cid) { clearSel(); renderAll(); return; }
    S.preview = null; S.pending = null;
    S.sel = { type: 'card', id: cid };
    S.mode = 'place'; S.extra = null;
    renderAll();
    ensureBoardVisible();
  }

  function onWeapon(wk, mine) {
    if (!S.g || S.g.over) return;
    if (!mine) { S.preview = { type: 'weapon', key: wk }; renderPreview(); return; }
    if (S.g.turn !== HUMAN) { S.sel = { type: 'weapon', key: wk }; S.mode = null; renderAll(); return; }
    if (S.mode === 'cheng' && S.extra && S.extra.slot) {
      const r = E.useSkill(S.g, HUMAN, S.sel.key, S.extra.slot, wk);
      if (!r.ok) { flashMsg(r.msg); return; }
      announceSkill(r, S.sel.key, S.extra.slot);
      clearSel(); refresh(); checkOver(); return;
    }
    if (S.sel && S.sel.type === 'weapon' && S.sel.key === wk) { clearSel(); renderAll(); return; }
    S.preview = null; S.pending = null;
    S.sel = { type: 'weapon', key: wk };
    S.mode = 'equip'; S.extra = null;
    renderAll();
    ensureBoardVisible();
  }

  function onSkill(key) {
    if (!S.g || S.g.over) return;
    const g = S.g, p = g.players[HUMAN];
    if (g.turn !== HUMAN) { S.sel = { type: 'skill', key }; S.mode = null; renderAll(); return; }
    if (g.skillsLeft <= 0 || g.skillsUsedThisTurn[key] || (p.skillUses[key] || 0) >= 2) {
      S.sel = { type: 'skill', key }; S.mode = null; renderAll();
      flashMsg(g.skillsLeft <= 0 ? '本手技能已用完' : g.skillsUsedThisTurn[key] ? '本手已用过这张' : '这张技能整局已用完');
      return;
    }
    if (S.sel && S.sel.type === 'skill' && S.sel.key === key) { clearSel(); renderAll(); return; }
    S.preview = null; S.pending = null;
    S.sel = { type: 'skill', key }; S.mode = 'skill'; S.extra = null;
    renderAll();
    ensureBoardVisible();
  }

  function onSlot(key) {
    const g = S.g;
    if (!g || g.over) return;
    const u = E.unitAt(g, key);
    if (g.turn !== HUMAN) {
      if (u) { S.sel = { type: 'unit', slot: key }; S.mode = null; renderAll(); }
      return;
    }
    if (S.mode === 'trick') { useTrickAt(key); return; }
    if (S.mode === 'place' && S.sel && S.sel.type === 'card') {
      const r = E.place(g, HUMAN, S.sel.id, key);
      if (!r.ok) { flashMsg(r.msg); return; }
      FX.inkAt(document.querySelector(`.slot[data-slot="${key}"]`)?.getBoundingClientRect());
      clearSel(); refresh(); checkOver(); return;
    }
    if (S.mode === 'unit' && S.sel && S.sel.slot) {
      if (u && u.owner !== HUMAN && E.attackTargets(g, HUMAN, S.sel.slot).includes(key)) {
        if (!S.pending || S.pending.from !== S.sel.slot || S.pending.to !== key) {
          S.pending = { from: S.sel.slot, to: key };
          renderAll();
          return;
        }
        const fc = E.forecast(g, HUMAN, S.sel.slot, key);
        const rect = document.querySelector(`.slot[data-slot="${key}"]`)?.getBoundingClientRect();
        const r = E.attack(g, HUMAN, S.sel.slot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        if (fc) {
          FX.hitAt(rect, String(fc.dmg), fc.kill);
          const parts = [];
          if (fc.over) parts.push('克制 +1');
          if (fc.fieldDmg) parts.push('场地 ' + (fc.fieldDmg > 0 ? '+1' : '-1'));
          if (fc.mult > 1) parts.push('入 ×' + fc.mult);
          if (fc.burn) parts.push('灼烧');
          if (fc.kill) parts.push('击杀');
          if (parts.length) showCombo(parts.join(' · '), fc.kill);
          shakeArena();
        }
        clearSel(); refresh(); checkOver(); return;
      }
      if (!u && E.moveTargets(g, HUMAN, S.sel.slot).includes(key)) {
        const r = E.move(g, HUMAN, S.sel.slot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'equip' && S.sel && S.sel.type === 'weapon') {
      if (u && u.owner === HUMAN && E.equipTargets(g, HUMAN).includes(key)) {
        const wk = S.sel.key;
        const r = E.equip(g, HUMAN, wk, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        const w = D.WEAPON_BY_KEY[wk];
        showCastBanner(`装备 · ${w ? w.name : wk} → ${u.card.name}`, 'weapon');
        pulseSlot(key, 'weapon');
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'skill' && S.sel && S.sel.type === 'skill') {
      if (!u || u.owner !== HUMAN) { flashMsg('技能要选择己方场上角色'); return; }
      if (!E.skillTargets(g, HUMAN).includes(key)) { flashMsg(u.skillBan > 0 ? '该角色技能被封' : '该角色当前不能成为技能目标'); return; }
      {
        const sk = S.sel.key;
        const matches = E.skillMatches(u, D.SKILL_BY_KEY[sk]);
        if (sk === 'zhi') {
          if (!E.rangeEnemies(g, key).length) { flashMsg('该单位范围内没有敌人'); return; }
          S.extra = { slot: key }; S.mode = 'zhi'; renderAll(); return;
        }
        if (sk === 'chengzai') {
          if (!g.players[HUMAN].weapons.length) { flashMsg('手上没有装备'); return; }
          S.extra = { slot: key }; S.mode = 'cheng'; renderAll(); openSheet('weapon'); return;
        }
        if (sk === 'dong' && matches === 2) {
          const allies = E.adjacent(key).filter(k => { const a = E.unitAt(g, k); return a && a.owner === HUMAN; });
          if (!allies.length) { flashMsg('没有相邻友军'); return; }
          S.extra = { slot: key }; S.mode = 'dong'; renderAll(); return;
        }
        const r = E.useSkill(g, HUMAN, sk, key, null);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); announceSkill(r, sk, key); checkOver(); return;
      }
    }
    if (S.mode === 'zhi' && S.extra) {
      if (u && u.owner !== HUMAN && E.rangeEnemies(g, S.extra.slot).includes(key)) {
        const skKey = S.sel && S.sel.key;
        const targetSlot = S.extra.slot;
        const r = E.useSkill(g, HUMAN, skKey, targetSlot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); announceSkill(r, skKey, targetSlot); checkOver(); return;
      }
    }
    if (S.mode === 'dong' && S.extra) {
      const a = u;
      if (a && a.owner === HUMAN && E.adjacent(S.extra.slot).includes(key)) {
        const skKey = S.sel && S.sel.key;
        const targetSlot = S.extra.slot;
        const r = E.useSkill(g, HUMAN, skKey, targetSlot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); announceSkill(r, skKey, targetSlot); checkOver(); return;
      }
    }
    if (u) {
      S.preview = null; S.pending = null;
      S.sel = { type: 'unit', slot: key };
      S.mode = u.owner === HUMAN && E.canUnitAct(g, HUMAN, u) ? 'unit' : null;
      S.extra = null;
      renderAll();
      return;
    }
    clearSel(); renderAll();
  }

  function checkOver() { if (S.g && S.g.over) setTimeout(showResult, 500); }

  function endTurn() {
    if (!S.g || S.g.over || S.g.turn !== HUMAN) return;
    E.endTurn(S.g);
    S.charChoice = null;
    clearSel(); refresh(); checkOver();
    if (S.g && !S.g.over && S.g.turn === FOE) startAI();
  }

  function startAI() {
    ensureAiUi();
    if (!S.g || S.g.over || S.g.turn !== FOE) return;
    if (S.g.pendingBlessing) return;
    if (S.aiTurn) return;
    S.aiTurn = true;
    S.aiStep = 0;
    S.aiActions = [];
    S.aiDeaths = [];
    S.aiFast = false;
    showAiBanner('庄家正在行动…');
    renderAiTrack();
    S.aiTimer = setTimeout(aiNextStep, 450);
  }

  /* ---------- 绑定 ---------- */
  function init() {
    FX.start();
    $('btnEnd').addEventListener('click', endTurn);
    $('prompt').addEventListener('click', e => {
      const b = e.target.closest('[data-defend]');
      if (!b || !S.g || S.g.over) return;
      const r = E.defend(S.g, HUMAN, b.dataset.slot, b.dataset.defend);
      if (!r.ok) { flashMsg(r.msg); return; }
      clearSel(); refresh(); checkOver();
    });
    $('btnRules').addEventListener('click', showRules);
    const pauseBtn = $('btnPause'); if (pauseBtn) pauseBtn.addEventListener('click', openPause);
    $('season').addEventListener('click', e => { if (e.target.closest('[data-trick-start]')) startTrick(); });
    $('board').addEventListener('click', e => {
      const s = e.target.closest('.slot');
      if (s) onSlot(s.dataset.slot);
    });
    $('hand').addEventListener('click', e => {
      const t = e.target.closest('.htile');
      if (t && !t.disabled) onCard(t.dataset.card, true);
    });
    $('oppPublic').addEventListener('click', e => {
      const c = e.target.closest('.htile');
      if (c && c.dataset.pcard) { onCard(c.dataset.pcard, false); return; }
      const w = e.target.closest('.wmini');
      if (w && w.dataset.pweapon) onWeapon(w.dataset.pweapon, false);
    });
    $('weapons').addEventListener('click', e => {
      const t = e.target.closest('.wcard');
      if (!t) return;
      if (t.closest('.px-sheet')) showSheetDetail('weapon', t.dataset.weapon);
      else onWeapon(t.dataset.weapon, true);
    });
    $('weapons').addEventListener('dblclick', e => {
      const t = e.target.closest('.wcard');
      if (t && t.closest('.px-sheet')) tryUseWeaponFromSheet(t.dataset.weapon);
    });
    $('skills').addEventListener('click', e => {
      const t = e.target.closest('.skill');
      if (!t) return;
      if (t.closest('.px-sheet')) showSheetDetail('skill', t.dataset.skill);
      else onSkill(t.dataset.skill);
    });
    $('skills').addEventListener('dblclick', e => {
      const t = e.target.closest('.skill');
      if (t && t.closest('.px-sheet')) tryUseSkillFromSheet(t.dataset.skill);
    });
    const wb = $('btnWeaponSheet'), sb = $('btnSkillSheet'), qe = $('btnQuickEnd');
    if (wb) wb.addEventListener('click', () => openSheet('weapon'));
    if (sb) sb.addEventListener('click', () => openSheet('skill'));
    if (qe) qe.addEventListener('click', () => {
      if (!S.g || S.g.over) return;
      if (S.sel || S.pending) { clearSel(); refresh(); return; }
      if (S.g.turn === HUMAN) endTurn();
    });
    for (const [id, kind] of [['weaponSheet', 'weapon'], ['skillSheet', 'skill']]) {
      const sheet = $(id);
      if (!sheet) continue;
      sheet.addEventListener('click', e => {
        const uw = e.target.closest('[data-use-weapon]');
        if (uw) { tryUseWeaponFromSheet(uw.dataset.useWeapon); return; }
        const us = e.target.closest('[data-use-skill]');
        if (us) { tryUseSkillFromSheet(us.dataset.useSkill); return; }
        if (e.target === sheet || e.target.closest('[data-sheet-close]')) closeSheets();
      });
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheets(); if (S.paused) $('pauseResume') && $('pauseResume').click(); } });
    const csk = $('charSkills');
    if (csk) csk.addEventListener('click', e => {
      if (!S.g || S.g.over) return;
      const cancel = e.target.closest('[data-char-cancel]');
      if (cancel) { S.charChoice = null; renderCharacter(); return; }
      const pick = e.target.closest('[data-summon]');
      if (pick && S.charChoice) {
        const r = E.summon(S.g, HUMAN, S.charChoice.type, pick.dataset.summon);
        if (!r.ok) { flashMsg(r.msg); return; }
        S.charChoice = null;
        if (window.PixelSFX) window.PixelSFX.play('skill');
        clearSel(); refresh();
        showCombo(S.g.summon ? S.g.summon.name + ' 入场' : '化身入场', false);
        return;
      }
      const b = e.target.closest('[data-cskill]');
      if (!b) return;
      const key = b.dataset.cskill;
      if (key === 'avatar' || key === 'clone') {
        S.charChoice = { type: key };
        renderCharacter();
        return;
      }
      if (key === 'seize') { flashMsg('夺魄在胜利结算时触发'); return; }
      const r = key === 'sign' ? E.sign(S.g, HUMAN) : E.divine(S.g, HUMAN);
      if (!r.ok) { flashMsg(r.msg); return; }
      let combo = key === 'sign' ? `求签 · ${r.tier}` : `卜卦 · ${r.type}`;
      if (key === 'divine' && window.Meta) {
        const m = window.Meta.recordDivine(r.type);
        if (m.unlocked) combo = '痴儿解锁 · ' + combo;
      }
      if (window.PixelSFX) window.PixelSFX.play('skill');
      clearSel(); refresh(); checkOver();
      showCombo(combo, r.kills > 0);
      if (r.kills || (key === 'sign' && r.tier === '下下')) shakeArena();
    });
    document.addEventListener('bagua:skins', () => { if (S.g) { renderWeapons(); renderBoard(); } });
    const mpanelTabs = $('mpanelTabs'), stageEl = document.querySelector('.stage');
    if (mpanelTabs && stageEl) {
      const setPanel = name => {
        stageEl.dataset.mpanel = name;
        mpanelTabs.querySelectorAll('[data-mpanel]').forEach(b => {
          const on = b.dataset.mpanel === name;
          b.classList.toggle('sel', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (window.matchMedia('(max-width: 1199px)').matches) {
          mpanelTabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      mpanelTabs.addEventListener('click', e => {
        const b = e.target.closest('[data-mpanel]');
        if (b) setPanel(b.dataset.mpanel);
      });
      setPanel('hand');
    }
    if (new URLSearchParams(location.search).has('debug')) window.__bagua = { S, startGame, showResult, showPrep, refresh, Engine: E };
    showStart();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
