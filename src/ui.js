/* 八卦对决 · 界面 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const D = window.DATA;
  const E = window.Engine;
  const { ELEMENTS, TRIGRAMS, ROLES, CARDS, SKILLS, TERMS } = D;
  const HUMAN = 0, FOE = 1;
  const ORDER = D.RING;
  const TAIJI = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#F7F3E8" stroke="#17191B" stroke-width="2"/><path d="M50 2 A48 48 0 0 1 50 98 A24 24 0 0 1 50 50 A24 24 0 0 0 50 2 Z" fill="#17191B"/><circle cx="50" cy="26" r="7.5" fill="#F7F3E8"/><circle cx="50" cy="74" r="7.5" fill="#17191B"/></svg>';
  const TAIJI_FIRE = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#F7F3E8" stroke="#17191B" stroke-width="2"/><path d="M50 2 A48 48 0 0 1 50 98 A24 24 0 0 1 50 50 A24 24 0 0 0 50 2 Z" fill="#B4472F"/><circle cx="50" cy="26" r="7.5" fill="#F7F3E8"/><circle cx="50" cy="74" r="7.5" fill="#B4472F"/></svg>';

  const S = {
    g: null, sel: null, mode: null, extra: null, preview: null,
    busy: false, aiTimer: 0, lastTerm: '', lastLog: 0, started: false,
    flash: '', flashTimer: 0,
  };

  /* ---------- 天气层 ---------- */
  const FX = (function () {
    const cv = $('fx');
    const ctx = cv.getContext('2d');
    let W = 1, H = 1, parts = [], type = 'petal', tint = '#7c9c69', raf = 0, last = 0;
    const PRESETS = [
      { type: 'petal', tint: '#8AA473' }, { type: 'rain', tint: '#8AA473' }, { type: 'drizzle', tint: '#C9A473' },
      { type: 'sunrain', tint: '#D57A5E' }, { type: 'rain', tint: '#D57A5E' }, { type: 'heat', tint: '#C9A473' },
      { type: 'leaf', tint: '#D9BF7A' }, { type: 'mist', tint: '#D9BF7A' }, { type: 'leaf', tint: '#b08a50' },
      { type: 'snow', tint: '#7A9DA6' }, { type: 'snow', tint: '#7A9DA6' }, { type: 'snow', tint: '#7A9DA6' },
    ];
    function resize() {
      const r = cv.parentElement.getBoundingClientRect();
      W = cv.width = Math.max(1, Math.floor(r.width));
      H = cv.height = Math.max(1, Math.floor(r.height));
    }
    const rnd = (a, b) => a + Math.random() * (b - a);
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
      parts = [];
      let n = 40;
      if (type === 'rain') n = 90;
      if (type === 'drizzle') n = 55;
      if (type === 'snow') n = 100;
      if (type === 'leaf') n = 38;
      if (type === 'mist') n = 14;
      if (type === 'heat' || type === 'sunrain' || type === 'petal') n = 48;
      for (let i = 0; i < n; i++) parts.push(make(type === 'mist' ? 'mist' : type === 'rain' ? 'rain' : type === 'snow' ? 'snow' : type === 'leaf' ? 'leaf' : type === 'heat' ? 'mote' : 'petal'));
    }
    function flash(term, month) {
      const el = $('termFlash');
      if (!el) return;
      document.documentElement.style.setProperty('--season', ELEMENTS[term.element].color);
      el.innerHTML = `<div class="tf1">${term.name}</div><div class="tf2">${term.zhong} · 月建${ELEMENTS[term.element].name}</div><div class="tf3">${term.desc}</div>`;
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2300);
    }
    function setTerm(term, month) {
      const p = PRESETS[(month - 1) % 12];
      type = p.type; tint = p.tint;
      document.documentElement.style.setProperty('--season', tint);
      init();
      flash(term, month);
    }
    function step(ts) {
      if (!last) last = ts;
      const dt = Math.min(3, (ts - last) / 16.7);
      last = ts;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = tint; ctx.globalAlpha = .025; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      for (const p of parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > H + 20) { p.y = -20; p.x = rnd(0, W); }
        if (p.y < -30) { p.y = H + 20; p.x = rnd(0, W); }
        if (p.x < -30) p.x = W + 20;
        if (p.x > W + 30) p.x = -20;
        ctx.globalAlpha = p.a;
        if (p.kind === 'rain') {
          ctx.strokeStyle = '#6B7A80'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 1.4, p.y + p.s); ctx.stroke();
        } else if (p.kind === 'snow') {
          ctx.fillStyle = '#C9D6DA'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
        } else if (p.kind === 'mist') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);
          g.addColorStop(0, 'rgba(180,190,190,.18)'); g.addColorStop(1, 'rgba(180,190,190,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color || '#e8d8b0';
          ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .5, 0, 0, 6.283); ctx.fill(); ctx.restore();
        }
      }
      drawInk(dt);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(step);
    }
    const inks = [];
    function inkAt(rect) {
      if (!rect) return;
      const cr = cv.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - cr.left;
      const y = rect.top + rect.height / 2 - cr.top;
      const blobs = [];
      for (let i = 0; i < 6; i++) blobs.push({ x: x + rnd(-28, 28), y: y + rnd(-22, 22), r: rnd(12, 34), a: rnd(.05, .16), dx: rnd(-.2, .2), dy: rnd(-.15, .1), vr: rnd(-.01, .01), rot: rnd(0, 6.28) });
      inks.push({ blobs, life: 1 });
    }
    function drawInk(dt) {
      for (let i = inks.length - 1; i >= 0; i--) {
        const k = inks[i];
        k.life -= .012 * dt;
        if (k.life <= 0) { inks.splice(i, 1); continue; }
        for (const b of k.blobs) {
          b.x += b.dx; b.y += b.dy; b.rot += b.vr;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          ctx.globalAlpha = b.a * k.life; ctx.fillStyle = '#17191B';
          ctx.beginPath();
          ctx.moveTo(b.r, 0);
          for (let a = 0; a < 6.283; a += .5) { const rr = b.r * (0.75 + Math.random() * .5); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .8); }
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    }
    function start() {
      resize();
      new ResizeObserver(resize).observe(cv.parentElement);
      init();
      if (!raf) raf = requestAnimationFrame(step);
    }
    return { start, setTerm, inkAt };
  })();

  /* ---------- 通用 ---------- */
  function flashMsg(text) {
    S.flash = text;
    $('prompt').textContent = text;
    clearTimeout(S.flashTimer);
    S.flashTimer = setTimeout(() => { S.flash = ''; renderPrompt(); }, 1800);
  }
  function mySeat() { return S.g ? D.SEATS[S.g.humanSeat] : null; }
  function foeSeat() { return S.g ? D.SEATS[S.g.humanSeat === 'N' ? 'S' : 'N'] : null; }
  function pname(id) { return id === 0 ? '你' : '庄家'; }
  function cardOf(u) { return u.card; }

  /* ---------- 开始 / 规则 / 结算 ---------- */
  function showStart() {
    const el = $('screens');
    el.innerHTML = `<div class="panel startpanel">
      <div class="kick">BAGUA DUEL · 64</div>
      <h1>八卦对决</h1>
      <p class="lead">两个人面对面，中间一张八卦盘。<br>八席为八属性，每人 32 张人物牌、四属性。方位随机，坐北朝南者先手。<br>一局一年，十二建轮转；年末按余下人物牌判定。</p>
      <div class="startrow">
        <div class="startbox"><b>八席</b><span>乾·兑金 / 离火 / 震·巽木 / 坎水 / 艮·坤土</span></div>
        <div class="startbox"><b>一回合</b><span>一次落子或攻击或装备，外加一次技能。</span></div>
        <div class="startbox"><b>胜负</b><span>32 张全部失去立即结束；否则年末按余牌判定。</span></div>
      </div>
      <div class="starttrigrams">${D.ATTRS.map(a => `<span style="--c:${ELEMENTS[a.element].color}">${a.sym} ${a.name}</span>`).join('')}</div>
      <div class="startbtns"><button class="primary" id="btnStart">入座</button><button id="btnRules2">规则</button></div>
      <div class="startfoot">随机坐向 · 先手由北位决定 · 角色牌暂用程序化占位</div>
    </div>`;
    el.classList.add('show');
    $('btnStart').onclick = () => { el.classList.remove('show'); startGame(); };
    $('btnRules2').onclick = showRules;
  }

  function showRules() {
    const el = $('screens');
    el.innerHTML = `<div class="panel rulespanel">
      <div class="phead"><h2>规则</h2><button id="rulesClose">收起</button></div>
      <div class="rulegrid">
        <div><b>八席</b><p>乾兑金、离火、震巽木、坎水、艮坤土。每席只能放一张人物牌。</p></div>
        <div><b>落子加成</b><p>牌属性与席同五行 +1/+1；席生牌 +1 血；席克牌 -1 攻；牌的家庭物象（夫少女中女长女少男中男长男母）与席同五行 +2/+2。当月五行再 +1 攻。</p></div>
        <div><b>行动</b><p>每手：落一张人物牌，或让一张牌攻击一次，或给一张牌一件装备。技能不占这个行动。</p></div>
        <div><b>攻击距离</b><p>空手、近战、盾牌只能打邻位；远程武器可打距离 2。</p></div>
        <div><b>装备</b><p>近战加攻（部分减伤），远程加攻但可能减血，盾牌加血并每回合刷新护盾。装备不可替换，除非「承载」。</p></div>
        <div><b>技能</b><p>八席各有一张技能，每手限用一次；技能落在自己的单位上。目标带有对应属性或家庭成员时，效果增强。</p></div>
        <div><b>一局一年</b><p>十二月建走完即年末；先比余下人物牌，再比场上人数与总血。若中途一方 32 张全失则立即结束。</p></div>
      </div>
      <div class="skillref">${DATA.SKILLS.map(s => `<div><b>${s.name}</b><span>${s.desc}</span></div>`).join('')}</div>
      <div class="rulesfoot">触发：点击人物牌→空席落子；点击自己的单位→攻击；点击武器→装备；点击技能→选自己的单位。</div>
    </div>`;
    el.classList.add('show');
    $('rulesClose').onclick = () => { if (!S.g) showStart(); else el.classList.remove('show'); };
  }

  function showResult() {
    const g = S.g;
    if (!g) return;
    const el = $('screens');
    const win = g.winner === HUMAN;
    el.innerHTML = `<div class="panel resultpanel">
      <div class="kick">${win ? 'WIN' : 'LOSE'}</div>
      <h1>${win ? '你赢了' : '庄家赢了'}</h1>
      <p class="lead">${win ? '庄家 32 张人物牌尽失。' : '你的 32 张人物牌尽失。'}</p>
      <div class="resultrow">
        <div><b>你</b><span>余 ${E.remaining(g.players[0])} / 32</span></div>
        <div><b>庄家</b><span>余 ${E.remaining(g.players[1])} / 32</span></div>
        <div><b>历时</b><span>${g.year} 年 ${g.month} 月 · 第 ${g.turnNo} 手</span></div>
      </div>
      <div class="startbtns"><button class="primary" id="btnAgain">再来一局</button><button id="btnMenu">回到封面</button></div>
    </div>`;
    el.classList.add('show');
    $('btnAgain').onclick = () => { el.classList.remove('show'); startGame(); };
    $('btnMenu').onclick = () => { S.g = null; S.started = false; showStart(); };
  }

  function startGame() {
    S.g = E.newGame({});
    S.sel = null; S.mode = null; S.extra = null; S.preview = null; S.started = true;
    S.lastTerm = '';
    updateTerm(true);
    renderAll();
    if (S.g.turn === FOE) startAI();
  }

  /* ---------- 渲染 ---------- */
  function renderAll() {
    if (!S.g) return;
    renderSeatbar();
    renderStatus();
    renderFigures();
    renderInfo();
    renderWeapons();
    renderSkills();
    renderBoard();
    renderRoster();
    renderPreview();
    renderPrompt();
    renderSeason();
    renderHistory();
    $('btnEnd').disabled = !(S.g.turn === HUMAN && !S.g.over);
  }

  function renderSeatbar() {
    const g = S.g, my = mySeat(), foe = foeSeat();
    $('seatbar').innerHTML = `<span class="sbme">你 ${my.text} · ${g.first === HUMAN ? '先手' : '后手'}</span>
      <span class="sbfoe">庄家 ${foe.text} · ${g.first === FOE ? '先手' : '后手'}</span>`;
  }

  function renderStatus() {
    const g = S.g;
    const p = g.players[g.turn];
    $('status').innerHTML = `第 ${g.year} 年 ${g.month} 月 · <b>${p.name}</b> · 行动 ${g.actionsLeft} · 技能 ${g.skillLeft}<br>
      你 ${E.remaining(g.players[0])}/32 · 庄家 ${E.remaining(g.players[1])}/32`;
  }

  function figureHtml(id, seat, mine) {
    const p = S.g.players[id];
    return `<div class="figbox ${mine ? 'mine' : 'foe'}">
      <div class="figmask"><i class="hat"></i><i class="face"></i><i class="eye l"></i><i class="eye r"></i></div>
      <div class="figmeta"><b>${p.name}</b><span>${seat.text} · 余 ${E.remaining(p)}/32</span></div>
    </div>`;
  }
  function renderFigures() {
    $('oppFigure').innerHTML = figureHtml(FOE, foeSeat(), false);
    $('myFigure').innerHTML = figureHtml(HUMAN, mySeat(), true);
  }

  function renderInfo() {
    const p = S.g.players[HUMAN];
    $('myInfo').innerHTML = `<div class="myhead"><span>你</span><b>${mySeat().label}位</b></div>
      <div class="myline">人物牌 <b>${E.remaining(p)}</b>/32 · 手牌 <b>${p.roster.filter(c => p.cardState[c] === 'hand').length}</b></div>
      <div class="myline">武器 <b>${p.weapons.length}</b> · 技能 <b>${p.skillLeft}</b></div>`;
  }

  function renderWeapons() {
    const p = S.g.players[HUMAN];
    const el = $('weapons');
    if (!p.weapons.length) { el.innerHTML = '<div class="emptyhint">没有装备</div>'; return; }
    el.innerHTML = p.weapons.map(wk => {
      const w = D.WEAPON_BY_KEY[wk];
      const sel = S.sel && S.sel.type === 'weapon' && S.sel.key === wk;
      return `<button class="wcard ${sel ? 'sel' : ''}" data-weapon="${wk}">
        <span class="wname">${w.name}</span><span class="wtype">${w.type === 'melee' ? '近战' : w.type === 'ranged' ? '远程' : '盾'}</span>
        <span class="wstats">${w.atk ? '攻+' + w.atk : ''}${w.hp ? ' 血' + (w.hp > 0 ? '+' : '') + w.hp : ''}${w.shield ? ' 盾' + w.shield : ''}${w.range > 1 ? ' 距2' : ''}</span>
      </button>`;
    }).join('');
  }

  function renderSkills() {
    const p = S.g.players[HUMAN];
    const el = $('skills');
    el.innerHTML = SKILLS.map(sk => {
      const used = !!p.skillUsed[sk.key];
      const sel = S.sel && S.sel.type === 'skill' && S.sel.key === sk.key;
      return `<button class="skill ${used ? 'used' : ''} ${sel ? 'sel' : ''}" data-skill="${sk.key}" style="--c:${ELEMENTS[sk.element].color}">
        <span class="skname">${sk.name}<i>${TRIGRAMS[sk.trigram].sym}</i></span>
        <span class="skcond">${sk.attr} / ${ROLES.find(r => r.name === sk.role).name}</span>
      </button>`;
    }).join('');
  }

  function slotAngle(key) {
    const order = E.viewOrder(S.g.humanSeat);
    return order.indexOf(key) * 45;
  }
  function unitStatusHtml(u) {
    const tags = [];
    if (u.attackBan > 0) tags.push(`<i class="st ban">攻禁${u.banTurns || u.attackBan}</i>`);
    if (u.skillBan > 0) tags.push(`<i class="st sban">技禁</i>`);
    if (u.mult > 1) tags.push(`<i class="st mult">×${u.mult}</i>`);
    if (u.equip) tags.push(`<i class="st eq">${u.equip.name}</i>`);
    return tags.join('');
  }
  function renderBoard() {
    const g = S.g;
    const el = $('board');
    const order = E.viewOrder(g.humanSeat);
    const placeable = S.mode === 'place' && S.sel && S.sel.type === 'card' ? E.validSlots(g, HUMAN, S.sel.id) : [];
    const targets = S.mode === 'attack' && S.sel && S.sel.slot ? E.attackTargets(g, HUMAN, S.sel.slot) : [];
    const zhiTargets = S.mode === 'skill-zhi' && S.extra ? E.attackTargets(g, HUMAN, S.extra.slot) : [];
    const equipable = S.mode === 'equip' ? E.ownUnits(g, HUMAN).filter(k => !E.unitAt(g, k).equip) : [];
    const skillable = S.mode === 'skill' ? E.ownUnits(g, HUMAN).filter(k => E.unitAt(g, k).skillBan <= 0) : [];
    const mySeatKey = E.seatSlot(g.humanSeat), foeSeatKey = E.farSlot(g.humanSeat);
    let html = `<div class="taiji big">${TAIJI}</div><div class="taiji small">${TAIJI_FIRE}</div>`;
    html += `<div class="seatmark bottom">你 · ${mySeat().label}位</div><div class="seatmark top">庄家 · ${foeSeat().label}位</div>`;
    for (const key of order) {
      const t = TRIGRAMS[key], u = E.unitAt(g, key), ec = ELEMENTS[t.element];
      const sel = (S.sel && S.sel.type === 'unit' && S.sel.slot === key);
      const valid = placeable.includes(key) || targets.includes(key) || zhiTargets.includes(key) || equipable.includes(key) || skillable.includes(key);
      const target = targets.includes(key) || zhiTargets.includes(key);
      const isSeat = key === mySeatKey || key === foeSeatKey;
      let inner;
      if (u) {
        const c = u.card;
        inner = `<div class="unit ${u.owner === HUMAN ? 'mine' : 'foe'} ${sel ? 'sel' : ''}" data-slot="${key}">
          <div class="uport">${D.portraitHtml(c, 30, 34)}</div>
          <div class="uname">${c.name}</div>
          <div class="ustats"><span class="a">${u.atk}</span><span class="h">${u.hp}</span></div>
          ${u.shield > 0 ? `<div class="ushield">盾${u.shield}</div>` : ''}
          ${unitStatusHtml(u)}
        </div>`;
      } else {
        inner = `<div class="cempty"><b>${t.sym} ${t.name}</b><span>${t.dir} · ${ec.name}</span><em>空位 · ${ROLES.find(r => r.name === t.role).name}</em></div>`;
      }
      html += `<div class="slot ${valid ? 'valid' : ''} ${target ? 'target' : ''} ${isSeat ? 'seat' : ''} ${sel ? 'selected' : ''}" data-slot="${key}" style="--a:${slotAngle(key)}deg;--c:${ec.color}">
        <div class="slothead"><b>${t.sym} ${t.name}</b><span>${t.dir} · ${ec.name}</span></div>
        ${inner}
      </div>`;
    }
    el.innerHTML = html;
  }

  function renderRoster() {
    const g = S.g, p = g.players[HUMAN];
    $('rosterHead').innerHTML = `<div class="rhcorner">人物牌 · 4 属性 × 8 家庭成员</div>` +
      ROLES.map(r => `<div class="rhcol">${r.name}<i>${TRIGRAMS[r.trigram].sym}</i></div>`).join('');
    let html = '';
    for (const ak of p.attrs) {
      const a = D.ATTR_BY_KEY[ak];
      html += `<div class="rrow"><div class="rrowhead" style="--c:${ELEMENTS[a.element].color}"><b>${a.sym} ${a.name}</b><span>${ELEMENTS[a.element].name}</span></div>`;
      for (const r of ROLES) {
        const id = ak + '-' + r.key, c = CARDS[id], st = p.cardState[id];
        const sel = S.sel && S.sel.type === 'card' && S.sel.id === id;
        html += `<button class="rtile ${st} ${sel ? 'sel' : ''}" data-card="${id}" ${st !== 'hand' ? 'disabled' : ''}>
          <span class="rport">${D.portraitHtml(c, 24, 27)}</span>
          <span class="rnm">${c.name}<em>${c.atk}/${c.hp}</em></span>
          ${st === 'placed' ? '<span class="rstate">场上</span>' : st === 'dead' ? '<span class="rstate dead">亡</span>' : ''}
        </button>`;
      }
      html += `</div>`;
    }
    $('roster').innerHTML = html;
  }

  function selectedCard() {
    if (!S.g || !S.sel || S.sel.type !== 'card') return null;
    return S.g.players[HUMAN].cardState[S.sel.id] === 'hand' ? CARDS[S.sel.id] : null;
  }
  function bestPlacementNote(card) {
    const empties = E.RING.filter(k => !S.g.board[k]);
    if (!empties.length) return '场上已满。';
    let best = null;
    for (const k of empties) {
      const b = E.placement(card, TRIGRAMS[k], E.monthElement(S.g));
      if (!best || b.atk + b.hp > best.atk + best.hp) best = { k, ...b };
    }
    return `最佳落位：${TRIGRAMS[best.k].name}席 → ${best.atk} 攻 / ${best.hp} 血`;
  }
  function renderPreview() {
    const el = $('previewPanel');
    if (!S.g) { el.innerHTML = '<div class="pvhint">点击人物牌、场上单位、武器或技能查看介绍</div>'; return; }
    let html = '';
    if (S.sel && S.sel.type === 'card') {
      const c = selectedCard();
      if (!c) { el.innerHTML = '<div class="pvhint">这张牌已不在手上</div>'; return; }
      const ec = ELEMENTS[c.element], rc = ELEMENTS[c.roleElement];
      html = `<div class="pvport">${D.portraitHtml(c, 74, 88)}</div>
        <div class="pvinfo"><div class="pvt"><b>${c.name}</b><span>${c.attr}属性 · ${c.role}</span></div>
        <div class="pvstats"><span>${c.atk} 攻</span><span>${c.hp} 血</span></div>
        <div class="pvline">牌属${ec.name}，家庭物象属${rc.name}。${bestPlacementNote(c)}</div>
        <div class="pvnote">点击空席落子 · 同席五行/相生/相克/物象加成会立即结算</div></div>`;
    } else if (S.sel && S.sel.type === 'unit') {
      const u = E.unitAt(S.g, S.sel.slot);
      if (!u) { el.innerHTML = '<div class="pvhint">这个卦位已经空了</div>'; return; }
      const c = u.card, t = TRIGRAMS[u.slot];
      const status = [];
      if (u.attackBan > 0) status.push('下次攻击失效');
      if (u.skillBan > 0) status.push('技能失效');
      if (u.mult > 1) status.push(`下 ${u.multUses} 次攻击 ×${u.mult}`);
      if (!u.equip) status.push('空手');
      html = `<div class="pvport">${D.portraitHtml(c, 74, 88)}</div>
        <div class="pvinfo"><div class="pvt"><b>${c.name}</b><span>${u.owner === HUMAN ? '你' : '庄家'} · ${t.name}席（${t.dir}）</span></div>
        <div class="pvstats"><span>${u.atk} 攻</span><span>${u.hp}/${u.maxHp} 血</span>${u.shield ? `<span>盾 ${u.shield}</span>` : ''}</div>
        <div class="pvline">${c.attr}属${ELEMENTS[c.element].name} · ${c.role}属${ELEMENTS[c.roleElement].name} · 距离 ${u.range}${u.equip ? ' · ' + u.equip.name : ''}</div>
        <div class="pvline">${status.length ? status.join(' · ') : '待命'}${u.armor ? ' · 减伤 ' + u.armor : ''}</div>
        <div class="pvnote">${u.owner === HUMAN ? '点击它可查看攻击范围' : '敌方单位'}</div></div>`;
    } else if (S.sel && S.sel.type === 'weapon') {
      const w = D.WEAPON_BY_KEY[S.sel.key];
      html = `<div class="pvicon">${w.type === 'shield' ? '盾' : w.type === 'ranged' ? '弓' : '刃'}</div>
        <div class="pvinfo"><div class="pvt"><b>${w.name}</b><span>${w.type === 'melee' ? '近战武器' : w.type === 'ranged' ? '远程武器' : '盾牌'}</span></div>
        <div class="pvstats">${w.atk ? `<span>攻 +${w.atk}</span>` : ''}${w.hp ? `<span>血 ${w.hp > 0 ? '+' : ''}${w.hp}</span>` : ''}${w.shield ? `<span>盾 ${w.shield}</span>` : ''}</div>
        <div class="pvline">${w.desc}</div><div class="pvnote">点击一件没有装备的己方单位装备它</div></div>`;
    } else if (S.sel && S.sel.type === 'skill') {
      const sk = D.SKILL_BY_KEY[S.sel.key];
      html = `<div class="pvicon" style="color:${ELEMENTS[sk.element].color}">${TRIGRAMS[sk.trigram].sym}</div>
        <div class="pvinfo"><div class="pvt"><b>${sk.name}</b><span>${TRIGRAMS[sk.trigram].name} · ${sk.attr}/${ROLES.find(r => r.name === sk.role).name}</span></div>
        <div class="pvline">${sk.desc}</div>
        <div class="pvnote">每手限一次 · 点击自己的单位施放</div></div>`;
    } else {
      el.innerHTML = '<div class="pvhint">点击人物牌、场上单位、武器或技能查看介绍</div>';
      return;
    }
    el.innerHTML = html;
  }

  function renderPrompt() {
    const g = S.g;
    const el = $('prompt');
    if (S.flash) { el.textContent = S.flash; return; }
    if (g.over) { el.textContent = '对局结束'; return; }
    if (g.turn === FOE) { el.innerHTML = '<b>庄家行动中…</b>'; return; }
    if (S.mode === 'place') { el.innerHTML = `落子：点一个空席 <span class="sub">或再点一张牌取消</span>`; return; }
    if (S.mode === 'attack') { el.innerHTML = `攻击：点一个红色范围内的敌方单位 <span class="sub">距离受武器影响</span>`; return; }
    if (S.mode === 'equip') { el.innerHTML = `装备：点一个没有装备的己方单位 <span class="sub">装备不可替换，除非承载</span>`; return; }
    if (S.mode === 'skill-zhi') { el.innerHTML = `止：点目标单位攻击范围内的一名敌人`; return; }
    if (S.mode === 'skill') { el.innerHTML = `技能「${D.SKILL_BY_KEY[S.sel.key].name}」：点一个自己的单位`; return; }
    if (g.actionsLeft <= 0 && g.skillLeft <= 0) { el.innerHTML = `本手已用完 · 点「结束回合」`; return; }
    el.innerHTML = `点人物牌落子 · 点自己的单位攻击 · 点武器装备 · 点技能施放 <span class="sub">行动 ${g.actionsLeft} · 技能 ${g.skillLeft}</span>`;
  }

  function renderSeason() {
    const g = S.g;
    const idx = (g.month - 1) % 12;
    const next = [1, 2].map(d => TERMS[(idx + d) % 12]);
    $('season').innerHTML = `<div class="seasontop"><span>天时</span><b>${g.year} 年 · ${g.month} 月</b></div>
      <div class="termnow"><b>${g.term.name} · ${g.term.zhong}</b><span>月建 ${ELEMENTS[g.term.element].name}</span><p>${g.term.desc}</p></div>
      ${next.map((t, i) => `<div class="termnext"><span>${i + 1} 回合后</span><b>${t.name} · ${t.zhong}</b><em>${t.desc}</em></div>`).join('')}`;
  }

  const KIND = { month: '月', weather: '时', turn: '手', place: '出', attack: '攻', equip: '装', skill: '技', death: '亡', end: '终', term: '节' };
  function renderHistory() {
    const g = S.g;
    const el = $('history');
    const logs = g.log.slice(-60);
    el.innerHTML = `<div class="hhead"><span>牌桌记录</span><i>${g.log.length} 条</i></div><div class="hbody">` +
      logs.map(l => `<div class="hrow ${l.kind} ${l.actor === HUMAN ? 'me' : l.actor === FOE ? 'foe' : ''}"><span class="hk">${KIND[l.kind] || '·'}</span><span class="ht">${l.text}</span></div>`).join('') +
      `</div>`;
    const b = el.querySelector('.hbody');
    if (b) b.scrollTop = b.scrollHeight;
  }

  /* ---------- 交互 ---------- */
  function updateTerm(force) {
    const t = S.g.term;
    if (force || S.lastTerm !== t.name) {
      S.lastTerm = t.name;
      FX.setTerm(t, S.g.month);
    }
  }
  function clearSel() { S.sel = null; S.mode = null; S.extra = null; }
  function refresh() { renderAll(); updateTerm(false); }

  function onRoster(id) {
    if (!S.g || S.g.over) return;
    const p = S.g.players[HUMAN];
    if (p.cardState[id] !== 'hand') return;
    if (S.sel && S.sel.type === 'card' && S.sel.id === id) { clearSel(); renderAll(); return; }
    S.sel = { type: 'card', id };
    S.mode = S.g.turn === HUMAN && S.g.actionsLeft > 0 ? 'place' : null;
    S.extra = null;
    renderAll();
  }

  function onWeapon(wk) {
    if (!S.g || S.g.turn !== HUMAN || S.g.over) {
      S.sel = { type: 'weapon', key: wk }; S.mode = null; renderAll(); return;
    }
    if (S.sel && S.sel.type === 'weapon' && S.sel.key === wk) { clearSel(); renderAll(); return; }
    S.sel = { type: 'weapon', key: wk };
    S.mode = S.g.actionsLeft > 0 ? 'equip' : null;
    S.extra = null;
    renderAll();
  }

  function onSkill(key) {
    if (!S.g || S.g.turn !== HUMAN || S.g.over) {
      S.sel = { type: 'skill', key }; S.mode = null; renderAll(); return;
    }
    if (S.g.skillLeft <= 0 || S.g.players[HUMAN].skillUsed[key]) {
      S.sel = { type: 'skill', key }; S.mode = null; renderAll(); flashMsg('本手技能已用完'); return;
    }
    if (S.sel && S.sel.type === 'skill' && S.sel.key === key) { clearSel(); renderAll(); return; }
    S.sel = { type: 'skill', key }; S.mode = 'skill'; S.extra = null; renderAll();
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
    if (S.mode === 'attack') {
      if (u && u.owner !== HUMAN) {
        const r = E.attack(g, HUMAN, S.sel.slot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        FX.inkAt(document.querySelector(`.slot[data-slot="${key}"]`)?.getBoundingClientRect());
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'equip') {
      if (u && u.owner === HUMAN && !u.equip) {
        const r = E.equip(g, HUMAN, S.sel.key, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'skill') {
      if (u && u.owner === HUMAN) {
        const keySk = S.sel.key;
        if (keySk === 'zhi') {
          if (!E.attackTargets(g, HUMAN, key).length) { flashMsg('该单位范围内没有敌人'); return; }
          S.extra = { slot: key }; S.mode = 'skill-zhi'; renderAll(); return;
        }
        let extra = null;
        if (keySk === 'chengzai') {
          const w = g.players[HUMAN].weapons[0];
          if (!w) { flashMsg('手上没有可换的装备'); return; }
          extra = w;
        }
        const r = E.useSkill(g, HUMAN, keySk, key, extra);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (S.mode === 'skill-zhi') {
      if (u && u.owner !== HUMAN) {
        const r = E.useSkill(g, HUMAN, S.sel.key, S.extra.slot, key);
        if (!r.ok) { flashMsg(r.msg); return; }
        clearSel(); refresh(); checkOver(); return;
      }
    }
    if (u) {
      S.sel = { type: 'unit', slot: key };
      S.mode = u.owner === HUMAN && g.actionsLeft > 0 ? 'attack' : null;
      S.extra = null;
      renderAll();
      return;
    }
    clearSel(); renderAll();
  }

  function checkOver() {
    if (S.g && S.g.over) setTimeout(showResult, 500);
  }

  function endTurn() {
    if (!S.g || S.g.over || S.g.turn !== HUMAN) return;
    E.endTurn(S.g);
    clearSel();
    refresh();
    checkOver();
    if (S.g && !S.g.over && S.g.turn === FOE) startAI();
  }

  function startAI() {
    clearTimeout(S.aiTimer);
    if (!S.g || S.g.over || S.g.turn !== FOE) return;
    S.aiTimer = setTimeout(() => {
      if (!S.g || S.g.over || S.g.turn !== FOE) return;
      const r = AI.step(S.g, FOE);
      S.sel = null; S.mode = null; S.extra = null;
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
    $('board').addEventListener('click', (e) => {
      const slot = e.target.closest('.slot');
      if (slot) onSlot(slot.dataset.slot);
    });
    $('roster').addEventListener('click', (e) => {
      const t = e.target.closest('.rtile');
      if (t) onRoster(t.dataset.card);
    });
    $('weapons').addEventListener('click', (e) => {
      const t = e.target.closest('.wcard');
      if (t) onWeapon(t.dataset.weapon);
    });
    $('skills').addEventListener('click', (e) => {
      const t = e.target.closest('.skill');
      if (t) onSkill(t.dataset.skill);
    });
    showStart();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
