/* 八卦对决 · 界面 v2 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DATA, E = window.Engine;
  const { ELEMENTS, TRIGRAMS, ROLES, CARDS, SKILLS, TERMS, DIFFICULTY, FIELD_RULES } = D;
  const HUMAN = 0, FOE = 1;
  const TAIJI = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#F7F3E8" stroke="#17191B" stroke-width="2"/><path d="M50 2 A48 48 0 0 1 50 98 A24 24 0 0 1 50 50 A24 24 0 0 0 50 2 Z" fill="#17191B"/><circle cx="50" cy="26" r="7.5" fill="#F7F3E8"/><circle cx="50" cy="74" r="7.5" fill="#17191B"/></svg>';
  const TAIJI_FIRE = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#F7F3E8" stroke="#17191B" stroke-width="2"/><path d="M50 2 A48 48 0 0 1 50 98 A24 24 0 0 1 50 50 A24 24 0 0 0 50 2 Z" fill="#B4472F"/><circle cx="50" cy="26" r="7.5" fill="#F7F3E8"/><circle cx="50" cy="74" r="7.5" fill="#B4472F"/></svg>';

  const S = { g: null, sel: null, mode: null, extra: null, preview: null, pending: null, difficulty: 'normal', aiTimer: 0, lastTerm: '', lastRound: 0, flash: '', flashTimer: 0 };

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
    const el = $('screens');
    el.innerHTML = `<div class="panel startpanel">
      <div class="kick">BAGUA DUEL · 64</div>
      <h1>八卦对决</h1>
      <p class="lead">两个人面对面，中间一张八卦盘；开局纯黑，方位随机。<br>每人 2 个属性、各随机 4 张人物牌，共 8 张；场上最多 3 张。</p>
      <div class="startrow">
        <div class="startbox"><b>行动</b><span>每回合落 1 张人物牌；场上每张牌各攻击 / 装备 / 移动一次；技能最多 2 张。</span></div>
        <div class="startbox"><b>场地</b><span>每轮开始按卦位五行触发：相生、同五行、相克各有不同效果。</span></div>
        <div class="startbox"><b>胜负</b><span>一方 8 张人物牌全部失去即负。</span></div>
      </div>
      <div class="starttrigrams">${D.ATTRS.map(a => `<span style="--c:${ELEMENTS[a.element].color}">${a.sym} ${a.name}</span>`).join('')}</div>
      <div class="diffhead">人机难度</div>
      <div class="diffbtns">${DIFFICULTY.map(d => `<button class="diff ${S.difficulty === d.key ? 'sel' : ''}" data-diff="${d.key}"><b>${d.name}</b><span>${d.desc}</span></button>`).join('')}</div>
      <div class="startbtns"><button class="primary" id="btnStart">入座</button><button id="btnRules2">规则</button></div>
      <div class="startfoot">坐北朝南先手 · 人物牌暂时使用程序化占位</div>
    </div>`;
    el.classList.add('show');
    el.querySelectorAll('.diff').forEach(b => b.onclick = () => {
      S.difficulty = b.dataset.diff;
      el.querySelectorAll('.diff').forEach(x => x.classList.toggle('sel', x === b));
    });
    $('btnStart').onclick = () => { el.classList.remove('show'); startGame(); };
    $('btnRules2').onclick = showRules;
  }

  function showRules() {
    const el = $('screens');
    el.innerHTML = `<div class="panel rulespanel">
      <div class="phead"><h2>规则</h2><button id="rulesClose">收起</button></div>
      <div class="rulegrid">
        <div><b>牌组</b><p>8 属性 × 8 家庭成员共 64 张。每人随机 2 个属性，每个属性随机 4 张，共 8 张；场上最多 3 张。</p></div>
        <div><b>落子</b><p>每回合 1 张。牌属性与席同五行 +2 攻/+4 血；席生牌 +4 血；席克牌 -2 攻；家庭物象与席同五行 +2 攻/+4 血。移动不触发这些。</p></div>
        <div><b>行动</b><p>场上每张牌每回合可攻击一次、获得一件装备、或移动到相邻空位，三选一。新落的牌当回合不能行动，但可以被攻击。</p></div>
        <div><b>攻击</b><p>空手/近战/盾牌打邻位，远程和长枪打距离 2。相生正常；克制方对被克方伤害 +1。无反击。</p></div>
        <div><b>技能</b><p>每回合最多 2 张且不能重复；每张技能整局 2 次。目标带对应属性/家庭成员时增强。</p></div>
        <div><b>胜负</b><p>一方 8 张人物牌全部失去，立即结束。</p></div>
      </div>
      <div class="fieldguide"><div class="fghead">场地 · 每轮开始</div>${FIELD_RULES.map(f => `<div class="fgrow" style="--c:${ELEMENTS[f.el].color}"><b>${ELEMENTS[f.el].name}</b><span>生：${f.gen}</span><span>同：${f.equal}</span><span>克：${f.over}</span></div>`).join('')}</div>
      <div class="skillref">${SKILLS.map(s => `<div><b>${s.name}</b><span>${s.desc}</span></div>`).join('')}</div>
      <div class="rulesfoot">点击人物牌→空席落子；点击己方牌→攻击/移动；点击武器→装备；点击技能→选牌。</div>
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
        <div><b>你</b><span>余 ${E.remaining(g.players[0])} / 8</span></div>
        <div><b>庄家</b><span>余 ${E.remaining(g.players[1])} / 8</span></div>
        <div><b>历时</b><span>${g.turnNo} 手 · ${g.round} 轮</span></div>
      </div>
      <div class="startbtns"><button class="primary" id="btnAgain">再来一局</button><button id="btnMenu">回到封面</button></div>
    </div>`;
    el.classList.add('show');
    $('btnAgain').onclick = () => { el.classList.remove('show'); startGame(); };
    $('btnMenu').onclick = () => { S.g = null; S.sel = null; showStart(); };
  }

  function startGame() {
    S.g = E.newGame({ difficulty: S.difficulty });
    S.sel = null; S.mode = null; S.extra = null; S.preview = null; S.pending = null;
    S.lastTerm = ''; S.lastRound = 0;
    updateTerm(true);
    renderAll();
    if (S.g.turn === FOE) startAI();
  }

  /* ---------- 渲染 ---------- */
  function renderAll() {
    if (!S.g) return;
    renderSeatbar(); renderStatus(); renderOppPublic(); renderMyFigure(); renderInfo();
    renderWeapons(); renderSkills(); renderBoard(); renderHand(); renderPreview();
    renderPrompt(); renderSeason(); renderHistory();
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

  function renderWeapons() {
    const p = S.g.players[HUMAN], el = $('weapons');
    if (!p.weapons.length) { el.innerHTML = '<div class="emptyhint">没有装备</div>'; return; }
    el.innerHTML = p.weapons.map(wk => {
      const w = D.WEAPON_BY_KEY[wk], sel = S.sel && S.sel.type === 'weapon' && S.sel.key === wk;
      return `<button class="wcard ${sel ? 'sel' : ''}" data-weapon="${wk}">
        <span class="wname">${w.name}</span><span class="wtype">${w.type === 'melee' ? '近战' : w.type === 'ranged' ? '远程' : '盾'}${w.range > 1 ? ' · 距2' : ''}</span>
        <span class="wstats">${w.atk ? '攻' + (w.atk > 0 ? '+' : '') + w.atk : ''}${w.hp ? ' 血' + (w.hp > 0 ? '+' : '') + w.hp : ''}${w.shield ? ' 盾' + w.shield : ''}</span>
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

  function fieldBadge(u) {
    const t = [];
    if (u.fieldDmg > 0) t.push('<i class="st buff">伤+1</i>');
    if (u.fieldDmg < 0) t.push('<i class="st debuff">伤-1</i>');
    if (u.fieldArmor > 0) t.push('<i class="st armor">减伤</i>');
    if (u.fieldVuln > 0) t.push('<i class="st vuln">增伤</i>');
    if (u.fieldBurnOnHit) t.push('<i class="st fire">火</i>');
    if (u.burn > 0) t.push(`<i class="st burn">烧${u.burn}</i>`);
    if (u.justPlayed) t.push('<i class="st new">新</i>');
    else if (u.acted && !(u.extraActions > 0)) t.push('<i class="st done">已</i>');
    if (u.extraActions > 0) t.push(`<i class="st extra">+${u.extraActions}行</i>`);
    if (u.attackBan > 0) t.push(`<i class="st ban">攻禁${u.banTurns || u.attackBan}</i>`);
    if (u.skillBan > 0) t.push('<i class="st sban">技禁</i>');
    return t.length ? `<div class="ubadges">${t.join('')}</div>` : '';
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
        inner = `<div class="unit ${u.owner === HUMAN ? 'mine' : 'foe'} ${sel ? 'sel' : ''}" data-slot="${key}">
          <div class="uport">${D.portraitHtml(u.card, 30, 34)}</div>
          <div class="uname">${u.card.name}</div>
          <div class="ustats"><span class="a">${u.atk}</span><span class="h">${u.hp}</span></div>
          ${u.shield > 0 ? `<div class="ushield">盾${u.shield}</div>` : ''}
          ${u.weapon ? `<div class="uweapon">${u.weapon.name}</div>` : ''}
          ${fieldBadge(u)}
        </div>`;
      } else {
        inner = `<div class="cempty"><b>${t.sym} ${t.name}</b><span>${t.dir} · ${ec.name}</span><em>空位 · ${ROLES.find(r => r.name === t.role).name}</em></div>`;
      }
      html += `<div class="slot ${valid ? 'valid' : ''} ${target ? 'target' : ''} ${move ? 'move' : ''} ${eq ? 'equipable' : ''} ${sk ? 'skillable' : ''} ${dongA ? 'ally' : ''} ${isSeat ? 'seat' : ''} ${sel ? 'selected' : ''}" data-slot="${key}" style="--a:${i * 45}deg;--c:${ec.color}">
        <div class="slothead"><b>${t.sym} ${t.name}</b><span>${t.dir} · ${ec.name}</span></div>
        ${inner}
      </div>`;
    }
    $('board').innerHTML = html;
  }

  function handTile(cid, p, opts) {
    const c = CARDS[cid], st = p.cardState[cid];
    const sel = S.sel && S.sel.type === 'card' && S.sel.id === cid;
    return `<button class="htile ${st} ${sel ? 'sel' : ''} ${opts && opts.mini ? 'mini' : ''}" data-card="${cid}" ${st !== 'hand' && !(opts && opts.showState) ? 'disabled' : ''}>
      <span class="hport">${D.portraitHtml(c, opts && opts.mini ? 22 : 30, opts && opts.mini ? 25 : 34)}</span>
      <span class="hname">${c.name}</span>
      <span class="hstats">${c.atk}/${c.hp}</span>
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
    if (S.mode === 'place') { el.innerHTML = '落子：点一个空席 <span class="sub">或再点一张牌取消</span>'; return; }
    if (S.mode === 'unit') { el.innerHTML = '点红色敌人攻击 · 点蓝色邻位移动 <span class="sub">每张牌本回合一次</span>'; return; }
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
    $('season').innerHTML = `<div class="seasontop"><span>场地 · 每轮开始</span><b>${g.term.name}</b></div>
      ${FIELD_RULES.map(f => `<div class="fgrow" style="--c:${ELEMENTS[f.el].color}"><b>${ELEMENTS[f.el].name}</b><span>生 ${f.gen}</span><span>同 ${f.equal}</span><span>克 ${f.over}</span></div>`).join('')}
      <div class="termline">第 ${g.month} 月 · ${g.term.name}/${g.term.zhong}</div>`;
  }

  const KIND = { month: '月', turn: '手', place: '出', attack: '攻', equip: '装', move: '移', skill: '技', death: '亡', end: '终', term: '场' };
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
  function shakeArena() {
    const el = document.querySelector('.arena');
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 320);
  }
  function clearSel() { S.sel = null; S.mode = null; S.extra = null; S.pending = null; }
  function refresh() { renderAll(); updateTerm(false); }

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
  }

  function onWeapon(wk, mine) {
    if (!S.g || S.g.over) return;
    if (!mine) { S.preview = { type: 'weapon', key: wk }; renderPreview(); return; }
    if (S.g.turn !== HUMAN) { S.sel = { type: 'weapon', key: wk }; S.mode = null; renderAll(); return; }
    if (S.mode === 'cheng' && S.extra && S.extra.slot) {
      const r = E.useSkill(S.g, HUMAN, S.sel.key, S.extra.slot, wk);
      if (!r.ok) { flashMsg(r.msg); return; }
      clearSel(); refresh(); checkOver(); return;
    }
    if (S.sel && S.sel.type === 'weapon' && S.sel.key === wk) { clearSel(); renderAll(); return; }
    S.preview = null; S.pending = null;
    S.sel = { type: 'weapon', key: wk };
    S.mode = 'equip'; S.extra = null;
    renderAll();
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
  }

  function onSlot(key) {
    const g = S.g;
    if (!g || g.over) return;
    const u = E.unitAt(g, key);
    if (g.turn !== HUMAN) {
      if (u) { S.sel = { type: 'unit', slot: key }; S.mode = null; renderAll(); }
      return;
    }
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
        const r = E.equip(g, HUMAN, S.sel.key, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'skill' && S.sel && S.sel.type === 'skill') {
      if (u && u.owner === HUMAN && E.skillTargets(g, HUMAN).includes(key)) {
        const sk = S.sel.key;
        const matches = E.skillMatches(u, D.SKILL_BY_KEY[sk]);
        if (sk === 'zhi') {
          if (!E.rangeEnemies(g, key).length) { flashMsg('该单位范围内没有敌人'); return; }
          S.extra = { slot: key }; S.mode = 'zhi'; renderAll(); return;
        }
        if (sk === 'chengzai') {
          if (!g.players[HUMAN].weapons.length) { flashMsg('手上没有装备'); return; }
          S.extra = { slot: key }; S.mode = 'cheng'; renderAll(); return;
        }
        if (sk === 'dong' && matches === 2) {
          const allies = E.adjacent(key).filter(k => { const a = E.unitAt(g, k); return a && a.owner === HUMAN; });
          if (!allies.length) { flashMsg('没有相邻友军'); return; }
          S.extra = { slot: key }; S.mode = 'dong'; renderAll(); return;
        }
        const r = E.useSkill(g, HUMAN, sk, key, null);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'zhi' && S.extra) {
      if (u && u.owner !== HUMAN && E.rangeEnemies(g, S.extra.slot).includes(key)) {
        const r = E.useSkill(g, HUMAN, S.sel.key, S.extra.slot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'dong' && S.extra) {
      const a = u;
      if (a && a.owner === HUMAN && E.adjacent(S.extra.slot).includes(key)) {
        const r = E.useSkill(g, HUMAN, S.sel.key, S.extra.slot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
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
    clearSel(); refresh(); checkOver();
    if (S.g && !S.g.over && S.g.turn === FOE) startAI();
  }

  function startAI() {
    clearTimeout(S.aiTimer);
    if (!S.g || S.g.over || S.g.turn !== FOE) return;
    S.aiTimer = setTimeout(() => {
      if (!S.g || S.g.over || S.g.turn !== FOE) return;
      const r = AI.step(S.g, FOE);
      S.sel = null; S.mode = null; S.extra = null; S.pending = null;
      refresh();
      if (S.g.over) { setTimeout(showResult, 500); return; }
      if (!r.done) startAI();
      else if (S.g.turn === FOE) startAI();
    }, 520);
  }

  /* ---------- 绑定 ---------- */
  function init() {
    FX.start();
    $('btnEnd').addEventListener('click', endTurn);
    $('btnRules').addEventListener('click', showRules);
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
      if (t) onWeapon(t.dataset.weapon, true);
    });
    $('skills').addEventListener('click', e => {
      const t = e.target.closest('.skill');
      if (t) onSkill(t.dataset.skill);
    });
    showStart();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
