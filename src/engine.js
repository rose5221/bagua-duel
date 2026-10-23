/* 八卦对决 · 引擎 v2
   每人 8 张人物牌（2 属性 × 各 4 张），场上最多 3 张；每张牌每回合可攻击/装备/移动一次；
   每回合可放 1 张人物牌 + 2 张不同技能（每张技能整局 2 次）。 */
(function () {
  'use strict';
  const D = window.DATA;
  const { ELEMENTS, RING, TRIGRAMS, ATTRS, ROLES, CARDS, WEAPONS, WEAPON_BY_KEY, SKILLS, SKILL_BY_KEY, TERMS } = D;
  const HAND = 8, BOARD_MAX = 3, WIN_DEAD = 8, HUMAN = 0, FOE = 1;

  const rnd = n => Math.floor(Math.random() * n);
  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  const byId = (g, id) => g.players[id];
  const unitAt = (g, key) => g.board[key] ? g.board[key].unit : null;
  const ringIndex = key => RING.indexOf(key);
  function ringDist(a, b) { const i = ringIndex(a), j = ringIndex(b); const d = Math.abs(i - j); return Math.min(d, 8 - d); }
  function adjacent(key) { const i = ringIndex(key); return [RING[(i + 7) % 8], RING[(i + 1) % 8]]; }
  const other = id => id === 0 ? 1 : 0;
  const remaining = p => HAND - p.dead.length;
  function viewOrder(seat) { return seat === 'S' ? RING.slice(4).concat(RING.slice(0, 4)) : RING.slice(); }
  const viewIndex = (seat, key) => viewOrder(seat).indexOf(key);
  const seatSlot = seat => viewOrder(seat)[4];
  const farSlot = seat => viewOrder(seat)[0];
  const firstPlayer = seat => seat === 'N' ? HUMAN : FOE;

  function log(g, actor, kind, text) {
    g.log.push({ turn: g.turnNo, actor, kind, text });
    if (g.log.length > 400) g.log.shift();
  }

  function makePlayer(id, name, poolAttrs, activeAttrs, activeCards) {
    const hand = [], cardState = {};
    // 局外牌库：4 个属性 × 8 类人物 = 32 张；未出战的 24 张留作献祭
    for (const ak of poolAttrs) {
      for (const r of ROLES) {
        const cid = ak + '-' + r.key;
        cardState[cid] = 'reserve';
      }
    }
    // 本局出战：优先使用准备界面选好的 8 张
    const picked = Array.isArray(activeCards) ? activeCards.filter((cid, i, a) => a.indexOf(cid) === i && cardState[cid]) : [];
    if (picked.length === 8) {
      for (const cid of picked) { hand.push(cid); cardState[cid] = 'hand'; }
    } else {
      for (const ak of activeAttrs) {
        for (const r of shuffle(ROLES).slice(0, 4)) {
          const cid = ak + '-' + r.key;
          hand.push(cid); cardState[cid] = 'hand';
        }
      }
    }
    return { id, name, attrs: poolAttrs, activeAttrs, hand, cardState, weapons: [], skillUses: {}, dead: [] };
  }

  function newGame(opts) {
    opts = opts || {};
    const mods = opts.mods || {};
    const humanSeat = opts.humanSeat || mods.forcedSeat || (Math.random() < .5 ? 'N' : 'S');
    const difficulty = opts.difficulty || 'normal';
    const first = firstPlayer(humanSeat);
    const attrs = shuffle(ATTRS.map(a => a.key));
    const pickedAttrs = Array.isArray(opts.p0Attrs)
      ? opts.p0Attrs.filter((a, i, arr) => ATTRS.some(x => x.key === a) && arr.indexOf(a) === i).slice(0, 4)
      : [];
    const pool0 = pickedAttrs.length === 4 ? pickedAttrs : attrs.slice(0, 4);
    const pool1 = attrs.filter(a => !pool0.includes(a)).concat(attrs.filter(a => pool0.includes(a))).slice(0, 4);
    const cards0 = Array.isArray(opts.p0Cards) ? opts.p0Cards.filter(cid => typeof cid === 'string' && CARDS[cid]) : [];
    const active0 = cards0.length === 8 ? [...new Set(cards0.map(cid => CARDS[cid].attrKey))] : shuffle(pool0).slice(0, 2);
    const active1 = shuffle(pool1).slice(0, 2);
    const p0 = makePlayer(0, '你', pool0, active0, cards0);
    const p1 = makePlayer(1, '庄家', pool1, active1);
    const weapons = shuffle(WEAPONS.map(w => w.key));
    p0.weapons = weapons.slice(0, 4);
    p1.weapons = weapons.slice(4, 8);
    const g = {
      humanSeat, difficulty, first, turn: first, turnNo: 0,
      round: Math.max(0, (opts.startMonth || 1) - 1), month: 1, season: opts.season || '',
      levelName: opts.levelName || '', bossName: opts.bossName || '', levelIndex: opts.levelIndex || 0,
      blessingSeason: opts.season || '', pendingBlessing: null,
      character: D.CHARACTERS.some(c => c.key === opts.character) ? opts.character : 'daotong',
      blessings: [opts.blessing || null, opts.foeBlessing || null],
      blessState: [{ round: {}, game: {}, trick: false }, { round: {}, game: {}, trick: false }],
      summoned: [], cooldowns: opts.cooldowns || {},
      charUsed: { sign: false, divine: false },
      charUsedGame: { avatar: false, clone: false, seize: false },
      charResult: null, summon: null, lostHuns: Array.isArray(opts.lostHuns) ? opts.lostHuns.slice() : [], pseudoPos: [], chierAttacks: 0,
      mods, firstImmuneUsed: false,
      term: TERMS[0], over: false, winner: null, board: {}, players: [p0, p1],
      placedThisTurn: false, skillsLeft: 2, skillsUsedThisTurn: {}, log: [],
    };
    for (const k of RING) g.board[k] = null;
    log(g, -1, 'month', `${D.SEATS[humanSeat].text} · ${first === HUMAN ? '你先手' : '庄家先手'} · 难度 ${D.DIFFICULTY.find(d => d.key === difficulty).name}`);
    log(g, -1, 'month', `双方牌库各 32 张（4 属性 × 8 人物）；本局出战 2 属性 × 4 张 = 8 张`);
    startTurn(g);
    return g;
  }

  /* ---------- 回合 / 场地 ---------- */
  function startTurn(g) {
    const p = g.players[g.turn];
    g.turnNo++;
    g.placedThisTurn = false;
    g.skillsLeft = 2;
    g.skillsUsedThisTurn = {};
    g.charUsed = { sign: false, divine: false };
    g.chierAttacks = 0;
    if (g.turn === g.first) startRound(g);
    if (g.over) return;
    for (const k of RING) {
      const u = unitAt(g, k);
      if (!u || u.owner !== p.id) continue;
      u.acted = false;
      u.justPlayed = false;
      if (u.guard === 'hasty') {
        u.guard = null;
        log(g, p.id, 'defend', `「${u.card.name}」的仓促防御结束（回到自己回合）`);
      }
      u.extraActions = 0;
      u.shield = u.shieldMax + u.tempShield;
    }
    if (p.id === HUMAN && g.mods) {
      const m = g.mods;
      for (const k of RING) {
        const u = unitAt(g, k);
        if (!u || u.owner !== p.id) continue;
        if (m.shieldBonus) {
          u.shieldMax = Math.max(0, u.shieldMax + m.shieldBonus);
          u.shield = Math.max(0, u.shield + m.shieldBonus);
        }
        if (m.regen) {
          u.hp = Math.min(u.maxHp, u.hp + m.regen);
          log(g, p.id, 'term', `伏矢：${u.card.name} ${m.regen > 0 ? '+' : ''}${m.regen} 血（${Math.max(0, u.hp)}/${u.maxHp}）`);
          if (u.hp <= 0) killUnit(g, u, '失魄');
        }
      }
    }
    log(g, p.id, 'turn', `第 ${g.turnNo} 手 · ${p.name} · 场上 ${ownUnits(g, p.id).length}/${BOARD_MAX} · 手牌 ${p.hand.length} · 余 ${remaining(p)}/8`);

    // 剧毒结算：每层扣 1 点，先扣护盾再扣血
    for (const k of RING) {
      const u = unitAt(g, k);
      if (!u || u.owner !== p.id || u.poison <= 0) continue;
      const n = u.poison;
      const absorbed = Math.min(u.shield, n);
      u.shield -= absorbed;
      u.hp -= (n - absorbed);
      log(g, p.id, 'term', `剧毒 ${n} 层：${CARDS[u.cardId].name}${absorbed ? ` 盾挡 ${absorbed}` : ''} -${n - absorbed} 血（${Math.max(0, u.hp)}/${u.maxHp}）`);
      // 本轮窗口内没有叠加新层，就衰减 1 层
      if (!u.poisonAdded) u.poison = Math.max(0, u.poison - 1);
      u.poisonAdded = false;
      if (u.hp <= 0) { killUnit(g, u, '剧毒'); continue; }
    }
    // 旁门道人【炼魂】：己方场上每回合开始 +1 攻 / -2 血
    if (!g.over && g.character === 'pangmen' && p.id === HUMAN) {
      for (const k of RING) {
        const u = unitAt(g, k);
        if (!u || u.owner !== p.id) continue;
        u.atk += 1;
        u.hp -= 2;
        log(g, p.id, 'term', `炼魂：${u.card.name} +1 攻 / -2 血（${Math.max(0, u.hp)}/${u.maxHp}）`);
        if (u.hp <= 0) killUnit(g, u, '炼魂');
      }
    }
    checkEnd(g);
  }

  function startRound(g) {
    g.round++;
    g.month = ((g.round - 1) % 12) + 1;
    g.term = TERMS[(g.month - 1) % 12];
    const seasonForMonth = m => m <= 3 ? 'spring' : m <= 6 ? 'summer' : m <= 9 ? 'autumn' : 'winter';
    const seasonNow = seasonForMonth(g.month);
    const seasonStart = { spring: '立春', summer: '立夏', autumn: '立秋', winter: '立冬' };
    g.season = seasonNow;
    if (g.blessingSeason && seasonNow !== g.blessingSeason) {
      g.pendingBlessing = { season: seasonNow, term: seasonStart[seasonNow] };
      g.blessingSeason = seasonNow;
      log(g, -1, 'month', `节气更替 · ${seasonStart[seasonNow]} · 锦囊换新`);
    } else if (!g.blessingSeason) {
      g.blessingSeason = seasonNow;
    }
    log(g, -1, 'month', `第 ${g.month} 月 · ${g.term.name}/${g.term.zhong} · 场地效果刷新`);
    for (const k of RING) {
      const u = unitAt(g, k);
      if (!u) continue;
      u.tempShield = 0;
      u.shield = u.shieldMax;
      u.tempAtk = 0;
      u.atkPenalty = 0;
      u.blessMoved = false;
      u.fieldDmg = 0; u.fieldArmor = 0; u.fieldVuln = 0; u.fieldBurnOnHit = false;
      if (u.burn > 0) {
        u.burn--;
        u.hp -= 1;
        log(g, u.owner, 'term', `灼烧：${CARDS[u.cardId].name} -1 血（${Math.max(0, u.hp)}/${u.maxHp}）`);
        if (u.hp <= 0) { killUnit(g, u, '灼烧'); continue; }
      }
      applyField(g, u);
      u.shield = u.shieldMax + u.tempShield;
    }
    if (!g.over) blessRoundStart(g);
    if (g.mods && g.mods.poisonEvery2 && g.round % 2 === 0) {
      for (const k of RING) {
        const u = unitAt(g, k);
        if (!u || u.owner !== HUMAN) continue;
        applyPoison(u, 1);
        log(g, HUMAN, 'term', `非毒失魄：${u.card.name} 获得 1 层剧毒`);
      }
    }
    checkEnd(g);
  }

  function applyField(g, u) {
    const se = TRIGRAMS[u.slot].element, ce = u.card.element, E = ELEMENTS;
    u.fieldDmg = 0; u.fieldArmor = 0; u.fieldVuln = 0; u.fieldBurnOnHit = false;
    if (se === ce) u.fieldDmg += 1;
    else if (E[se].gen === ce) {
      if (se === 'metal') u.fieldDmg += 1;
      else if (se === 'wood') u.hp = Math.min(u.maxHp, u.hp + 1);
      else if (se === 'water') { u.tempShield += 2; u.shield += 2; }
      else if (se === 'fire') u.fieldBurnOnHit = true;
      else if (se === 'earth') u.fieldArmor += 1;
    } else if (E[se].over === ce) {
      if (se === 'metal') u.fieldDmg -= 1;
      else if (se === 'fire') applyBurn(u);
      else if (se === 'earth') u.fieldVuln += 1;
    }
  }
  function applyBurn(u) { u.burn = 2; }

  /* ---------- 基础 ---------- */
  const ownUnits = (g, pid) => RING.filter(k => { const u = unitAt(g, k); return u && u.owner === pid; });
  function canUnitAct(g, pid, u) { return u && u.owner === pid && g.turn === pid && !u.justPlayed && (u.extraActions > 0 || !u.acted); }
  function spendUnitAction(u) { if (u.extraActions > 0) u.extraActions--; else u.acted = true; }
  function placement(card, slot) {
    let atk = card.atk, hp = card.hp;
    if (card.element === slot.element) { atk += 2; hp += 4; }
    if (ELEMENTS[slot.element].gen === card.element) hp += 4;
    if (ELEMENTS[slot.element].over === card.element) atk -= 2;
    if (card.roleElement === slot.element) { atk += 2; hp += 4; }
    return { atk: Math.max(0, atk), hp: Math.max(1, hp) };
  }

  function place(g, pid, cardId, slotKey) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    if (g.placedThisTurn) return { ok: false, msg: '本手已经落过一张人物牌' };
    if (ownUnits(g, pid).length >= BOARD_MAX) return { ok: false, msg: '场上最多 3 张人物牌' };
    if (g.board[slotKey]) return { ok: false, msg: '该卦位已有牌' };
    const p = g.players[pid];
    if (p.cardState[cardId] !== 'hand') return { ok: false, msg: '这张人物牌不在手上' };
    const card = CARDS[cardId], slot = TRIGRAMS[slotKey];
    const b = placement(card, slot);
    const mods = (pid === HUMAN && g.mods) ? g.mods : {};
    const atk = Math.max(0, Math.round(b.atk * (1 + (mods.entranceAtkPct || 0))) + (mods.entranceAtk || 0));
    const hp = Math.max(1, Math.round(b.hp * (1 + (mods.entranceHpPct || 0))) + (mods.entranceHp || 0));
    const firstImmune = !!mods.firstImmune && !g.firstImmuneUsed;
    if (firstImmune) g.firstImmuneUsed = true;
    const u = {
      cardId, owner: pid, slot: slotKey, card, atk, maxHp: hp, hp,
      weapon: null, weaponHp: 0, shield: 0, shieldMax: 0, tempShield: 0, range: 1,
      acted: false, justPlayed: true, extraActions: 0, mult: 1, multUses: 0,
      burn: 0, attackBan: 0, skillBan: 0, banTurns: 0,
      guard: null, hastyTurn: -99, hastyCdUntil: 0, poison: 0, poisonAdded: false,
      fieldDmg: 0, fieldArmor: 0, fieldVuln: 0, fieldBurnOnHit: false, dead: false,
      immuneOnce: firstImmune,
    };
    g.board[slotKey] = { unit: u };
    p.cardState[cardId] = 'board';
    g.placedThisTurn = true;
    log(g, pid, 'place', `${p.name} 在「${slot.name}」落「${card.name}」（${u.atk}/${u.hp}）${card.element === slot.element ? ' · 同宫 +2/+4' : ''}${card.roleElement === slot.element ? ' · 物象同宫 +2/+4' : ''}${ELEMENTS[slot.element].gen === card.element ? ' · 席生牌 +4 血' : ''}${ELEMENTS[slot.element].over === card.element ? ' · 席克牌 -2 攻' : ''}`);
    blessOnPlace(g, pid, u);
    return { ok: true, unit: u };
  }

  function applyWeapon(u, w) {
    u.weapon = w;
    u.atk += w.atk;
    u.maxHp += w.hp;
    u.hp += w.hp;
    u.weaponHp += w.hp;
    u.range = Math.max(u.range, w.range);
    u.shieldMax += w.shield;
    u.shield += w.shield;
  }
  function removeWeapon(u, w) {
    if (!w) return;
    u.atk -= w.atk;
    u.maxHp = Math.max(1, u.maxHp - w.hp);
    u.hp = Math.min(u.hp, u.maxHp);
    u.weaponHp -= w.hp;
    u.shieldMax = Math.max(0, u.shieldMax - w.shield);
    u.shield = Math.min(u.shield, u.shieldMax);
    u.range = 1;
    u.weapon = null;
  }
  function destroyWeapon(u) {
    const w = u.weapon;
    if (!w) return;
    removeWeapon(u, w);
    log(gGlobal, u.owner, 'equip', `「${u.card.name}」的长枪在攻击后销毁`);
  }
  let gGlobal = null;

  function equip(g, pid, weaponKey, slotKey) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    const p = g.players[pid], u = unitAt(g, slotKey);
    if (!u || u.owner !== pid) return { ok: false, msg: '不是你的单位' };
    if (u.justPlayed) return { ok: false, msg: '刚落下的牌本回合不能行动' };
    if (!canUnitAct(g, pid, u)) return { ok: false, msg: '这张牌本回合已行动' };
    if (u.guard === 'firm') return { ok: false, msg: '坚守中不能装备' };
    if (u.weapon) return { ok: false, msg: '已有装备，只有「承载」能换' };
    const wi = p.weapons.indexOf(weaponKey);
    if (wi < 0) return { ok: false, msg: '没有这件装备' };
    spendUnitAction(u);
    const w = WEAPON_BY_KEY[weaponKey];
    applyWeapon(u, w);
    p.weapons.splice(wi, 1);
    log(g, pid, 'equip', `${p.name} 给「${u.card.name}」装备「${w.name}」`);
    if (u.hp <= 0) killUnit(g, u, '装备反噬');
    checkEnd(g);
    return { ok: true };
  }

  function move(g, pid, fromKey, toKey) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    const u = unitAt(g, fromKey);
    if (!u || u.owner !== pid) return { ok: false, msg: '不是你的单位' };
    if (u.justPlayed) return { ok: false, msg: '刚落下的牌本回合不能行动' };
    if (!canUnitAct(g, pid, u)) return { ok: false, msg: '这张牌本回合已行动' };
    if (u.guard === 'firm') return { ok: false, msg: '坚守中不能移动，需先解除' };
    if (!adjacent(fromKey).includes(toKey)) return { ok: false, msg: '只能移动到邻位' };
    if (g.board[toKey]) return { ok: false, msg: '目标卦位已有牌' };
    const free = blessFreeMove(g, pid);
    if (!free) spendUnitAction(u);
    g.board[fromKey] = null;
    g.board[toKey] = { unit: u };
    u.slot = toKey;
    log(g, pid, 'move', `${g.players[pid].name} 的「${u.card.name}」移动到「${TRIGRAMS[toKey].name}」${free ? '（剪春：不消耗行动）' : ''}`);
    blessAfterMove(g, pid, u);
    return { ok: true };
  }

  /* ---------- 防御 / 剧毒 ---------- */
  function applyPoison(u, n) {
    u.poison += n;
    u.poisonAdded = true;
    u.poison = Math.max(0, u.poison);
  }

  function defendValid(g, pid, slotKey, mode) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    const u = unitAt(g, slotKey);
    if (!u || u.owner !== pid) return { ok: false, msg: '不是你的单位' };
    if (mode === 'cancel') {
      if (u.guard !== 'firm') return { ok: false, msg: '没有在坚守' };
      if (!canUnitAct(g, pid, u)) return { ok: false, msg: '这张牌本回合已行动' };
      return { ok: true, u };
    }
    if (u.justPlayed) return { ok: false, msg: '刚落下的牌本回合不能行动' };
    if (mode !== 'cancel' && g.turnNo < (u.hastyCdUntil || 0)) return { ok: false, msg: '防御冷却中：本回合不能再防御' };
    if (u.guard === 'firm') return { ok: false, msg: '已在坚守防御中' };
    if (!canUnitAct(g, pid, u)) return { ok: false, msg: '这张牌本回合已行动' };
    return { ok: true, u };
  }

  function defend(g, pid, slotKey, mode) {
    const v = defendValid(g, pid, slotKey, mode);
    if (!v.ok) return v;
    const u = v.u, p = g.players[pid];
    spendUnitAction(u);
    if (mode === 'cancel') {
      u.guard = null;
      log(g, pid, 'defend', `${p.name} 的「${u.card.name}」解除坚守`);
      return { ok: true };
    }
    if (mode === 'firm') {
      u.guard = 'firm';
      log(g, pid, 'defend', `${p.name} 的「${u.card.name}」坚守防御：攻击伤害减半，直到解除`);
      return { ok: true };
    }
    u.guard = 'hasty';
    u.hastyTurn = g.turnNo;
    u.hastyCdUntil = g.turnNo + 4;
    log(g, pid, 'defend', `${p.name} 的「${u.card.name}」仓促防御：下次受到的攻击伤害减半；回到自己回合后失效，并有一回合防御冷却`);
    return { ok: true };
  }

  function forecast(g, pid, fromKey, toKey) {
    const a = unitAt(g, fromKey), t = unitAt(g, toKey);
    if (!a || !t || a.owner !== pid || t.owner === pid) return null;
    const over = ELEMENTS[a.card.element].over === t.card.element;
    const chierBonus = g.character === 'chier' && pid === HUMAN && (g.chierAttacks || 0) < 2 ? 2 : 0;
    const base = Math.max(0, a.atk + (a.fieldDmg || 0) + (over ? 1 : 0)) + chierBonus;
    const mult = a.mult || 1;
    let dmg = base * mult;
    const absorbed = Math.min(t.shield, dmg);
    let afterShield = dmg - absorbed;
    const armor = t.fieldArmor || 0, vuln = t.fieldVuln || 0;
    const raw = Math.max(0, afterShield - armor + vuln);
    const guarded = t.guard ? Math.ceil(raw / 2) : raw;
    const halved = raw - guarded;
    const chierReduce = g.character === 'chier' && t.owner === HUMAN ? 4 : 0;
    const final = Math.max(0, guarded - chierReduce);
    return { base, mult, over, fieldDmg: a.fieldDmg || 0, absorbed, afterShield, armor, vuln, guard: t.guard || null, halved, chierBonus, chierReduce, dmg: final, hpAfter: Math.max(0, t.hp - final), kill: t.hp - final <= 0, burn: !!a.fieldBurnOnHit, range: a.range };
  }

  function attack(g, pid, fromKey, toKey) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    const a = unitAt(g, fromKey), t = unitAt(g, toKey);
    if (!a || a.owner !== pid) return { ok: false, msg: '不是你的单位' };
    if (!t || t.owner === pid) return { ok: false, msg: '目标不是敌方单位' };
    if (a.justPlayed) return { ok: false, msg: '刚落下的牌本回合不能攻击' };
    if (!canUnitAct(g, pid, a)) return { ok: false, msg: '这张牌本回合已行动' };
    if (a.guard === 'firm') return { ok: false, msg: '坚守中不能攻击' };
    if (ringDist(fromKey, toKey) > a.range) return { ok: false, msg: '超出攻击距离' };
    let chierBonus = 0;
    if (g.character === 'chier' && pid === HUMAN) {
      if ((g.chierAttacks || 0) >= 2) return { ok: false, msg: '痴戾：本回合最多两张己方人物攻击' };
      g.chierAttacks = (g.chierAttacks || 0) + 1;
      chierBonus = 2;
    }
    spendUnitAction(a);
    if (a.attackBan > 0) {
      a.attackBan = 0; a.banTurns = 0;
      log(g, pid, 'attack', `${g.players[pid].name} 的「${a.card.name}」攻击被「止」化去`);
      return { ok: true, nullified: true };
    }
    if (pid === HUMAN && g.mods && g.mods.missChance && Math.random() < g.mods.missChance) {
      log(g, pid, 'attack', `地魂失魄：「${a.card.name}」的攻击落空`);
      return { ok: true, missed: true };
    }
    const over = ELEMENTS[a.card.element].over === t.card.element;
    const metaBonus = (pid === HUMAN && g.mods && g.mods.damageDealt) || 0;
    const bm = blessAttackMod(g, pid, a, t);
    let dmg = Math.max(0, a.atk + (a.tempAtk || 0) - (a.atkPenalty || 0) + (a.fieldDmg || 0) + (over ? 1 : 0)) + chierBonus + metaBonus + bm.bonus;
    const mult = a.mult || 1;
    dmg *= mult;
    if (a.multUses > 0) { a.multUses--; if (a.multUses === 0) a.mult = 1; }
    let absorbed = 0;
    if (!bm.ignoreShield) { absorbed = Math.min(t.shield, dmg); t.shield -= absorbed; dmg -= absorbed; }
    dmg = Math.max(0, dmg - (t.fieldArmor || 0) + (t.fieldVuln || 0));
    if (bm.reduce) dmg = Math.max(0, dmg - bm.reduce);
    let halved = 0;
    if (t.guard) {
      const before = dmg;
      dmg = Math.ceil(dmg / 2);
      halved = before - dmg;
      // 仓促防御只挡一次，坚守防御持续生效
      if (t.guard === 'hasty') t.guard = null;
    }
    const chierReduce = g.character === 'chier' && t.owner === HUMAN ? 4 : 0;
    if (chierReduce) dmg = Math.max(0, dmg - chierReduce);
    let immune = false;
    if (t.immuneOnce) {
      t.immuneOnce = false;
      immune = true;
      dmg = 0;
      log(g, pid, 'term', `吞贼：${t.card.name} 免疫了这次伤害`);
    }
    const metaReduce = (t.owner === HUMAN && g.mods && g.mods.damageTaken) || 0;
    if (metaReduce) dmg = Math.max(0, dmg - metaReduce);
    t.hp -= dmg;
    log(g, pid, 'attack', `${g.players[pid].name} 的「${a.card.name}」→「${t.card.name}」：${a.atk}${a.fieldDmg ? (a.fieldDmg > 0 ? '+1' : '-1') : ''}${over ? '+克1' : ''}${chierBonus ? '+痴2' : ''}${metaBonus ? (metaBonus > 0 ? '+' : '') + metaBonus : ''}${bm.bonus ? '+福' + bm.bonus : ''}${mult > 1 ? '×' + mult : ''}，盾挡 ${absorbed}${halved ? `，防御减半 -${halved}` : ''}${chierReduce ? `，痴相 -${chierReduce}` : ''}${immune ? '，免疫' : ''}，实伤 ${dmg}（${Math.max(0, t.hp)}/${t.maxHp}）${bm.note ? ' · ' + bm.note.trim() : ''}`);
    if (!immune && t.hp > 0 && bm.extraTrue) {
      t.hp -= bm.extraTrue;
      log(g, pid, 'term', `福缘·蝉鸣：${t.card.name} 追加 ${bm.extraTrue} 真实伤害（${Math.max(0, t.hp)}/${t.maxHp}）`);
    }
    blessAfterAttack(g, pid, a, t);
    const extraChance = (a.summon && a.summon.type === 'avatar' && a.summon.key === 'di' ? .3 : 0)
      + (pid === HUMAN && g.mods ? (g.mods.extraAttackChance || 0) : 0);
    if (!immune && t.hp > 0 && extraChance && Math.random() < extraChance) {
      const extra = Math.max(1, Math.ceil(a.atk / 2));
      t.hp -= extra;
      log(g, pid, 'attack', `追魂再攻：「${a.card.name}」追加 ${extra} 伤害（${Math.max(0, t.hp)}/${t.maxHp}）`);
    }
    if (pid === HUMAN && g.mods && g.mods.poisonOnHit && t.hp > 0) {
      applyPoison(t, 1);
      log(g, pid, 'term', `非毒：${t.card.name} 获得 1 层剧毒`);
    }
    if (a.fieldBurnOnHit) { applyBurn(t); log(g, pid, 'term', `「${t.card.name}」被点燃（灼烧 2 回合）`); }
    if (a.weapon && a.weapon.spear) {
      const w = a.weapon; removeWeapon(a, w);
      log(g, pid, 'equip', `「${a.card.name}」的长枪在攻击后销毁`);
    }
    const wasKilled = t.hp <= 0;
    if (wasKilled) killUnit(g, t, '战斗');
    if (wasKilled && t.dead) blessAfterKill(g, pid, a, t);
    checkEnd(g);
    return { ok: true, damage: dmg };
  }

  function killUnit(g, u, cause) {
    if (!u || u.dead) return;
    if (blessBeforeDeath(g, u)) return;
    u.dead = true;
    const p = g.players[u.owner];
    if (g.board[u.slot] && g.board[u.slot].unit === u) g.board[u.slot] = null;
    if (!u.summon && p.cardState[u.cardId] === 'board') { p.cardState[u.cardId] = 'dead'; p.dead.push(u.cardId); }
    if (u.weapon) { u.weapon = null; u.weaponHp = 0; }
    log(g, u.owner, 'death', `${p.name} 的「${u.card.name}」阵亡（${cause}）· 余 ${remaining(p)}/8`);
    if (u.summon) {
      const s = u.summon;
      g.summon = null;
      if (s.type === 'avatar') {
        g.lostHuns.push(s.key);
        log(g, u.owner, 'death', `化身消散：永久失去${(D.HUNS.find(h => h.key === s.key) || {}).name || s.key}（本局已失 ${g.lostHuns.length}/3 魂）`);
        if (g.lostHuns.length >= 3) {
          g.over = true; g.winner = other(u.owner);
          log(g, -1, 'end', `三魂尽失 · ${g.players[g.winner].name} 胜`);
        }
      } else {
        g.pseudoPos.push(s.key);
        log(g, u.owner, 'death', `分身消散：${(D.POS.find(p => p.key === s.key) || {}).name || s.key}转为伪魄`);
      }
    }
  }

  /* ---------- 技能 ---------- */
  function skillMatches(u, sk) {
    return (u.card.attr === sk.attr ? 1 : 0) + (u.card.role === sk.role ? 1 : 0);
  }
  function skillValid(g, pid, key, slotKey, extra) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    if (g.skillsLeft <= 0) return { ok: false, msg: '本手技能已用完（2 张）' };
    if (g.skillsUsedThisTurn[key]) return { ok: false, msg: '本手已经用过这张技能' };
    const p = g.players[pid], sk = SKILL_BY_KEY[key];
    if (!sk) return { ok: false, msg: '没有这个技能' };
    if ((p.skillUses[key] || 0) >= 2) return { ok: false, msg: '这张技能整局已用完' };
    const u = unitAt(g, slotKey);
    if (!u || u.owner !== pid) return { ok: false, msg: '技能要放在自己的单位上' };
    if (u.skillBan > 0) return { ok: false, msg: '该单位技能被封' };
    if (key === 'zhi') {
      const e = unitAt(g, extra);
      if (!e || e.owner === pid) return { ok: false, msg: '再选一个范围内的敌人' };
      if (ringDist(slotKey, extra) > u.range) return { ok: false, msg: '目标不在该单位攻击范围' };
    }
    if (key === 'dong' && skillMatches(u, sk) === 2) {
      const e = unitAt(g, extra);
      if (!e || e.owner !== pid || !adjacent(slotKey).includes(extra)) return { ok: false, msg: '再选一个邻位友军' };
    }
    if (key === 'chengzai') {
      if (!p.weapons.includes(extra)) return { ok: false, msg: '需要手上一件装备' };
    }
    return { ok: true, sk, u };
  }

  function useSkill(g, pid, key, slotKey, extra) {
    const v = skillValid(g, pid, key, slotKey, extra);
    if (!v.ok) return v;
    const { sk, u } = v;
    const p = g.players[pid];
    const m = skillMatches(u, sk);
    let note = '';
    if (key === 'gangjian') {
      const a = 4 + 2 * m, h = 8 + 4 * m;
      u.atk += a; u.maxHp += h; u.hp += h;
      note = `+${a} 攻/+${h} 血`;
    } else if (key === 'koushe') {
      const a = 4 + 2 * m;
      u.atk += a; note = `+${a} 攻`;
    } else if (key === 'guangming') {
      const targets = [u];
      for (const k of adjacent(slotKey)) { const a = unitAt(g, k); if (a && a.owner === pid) targets.push(a); }
      let healed = 0;
      // 光明始终生效：满血也可以加上限之外，形成临时灵光血
      const heal = x => { const before = x.hp; x.hp += 4; healed += x.hp - before; };
      heal(u);
      for (const k of adjacent(slotKey)) { const a = unitAt(g, k); if (a && a.owner === pid) heal(a); }
      if (m >= 1) heal(u);
      if (m === 2) { heal(u); for (const k of adjacent(slotKey)) { const a = unitAt(g, k); if (a && a.owner === pid) heal(a); } }
      note = `灵光 +${healed} 血（匹配 ${m}/2）`;
    } else if (key === 'dong') {
      const add = 1 + (m >= 1 ? 1 : 0);
      u.extraActions += add;
      if (m === 2) { const ally = unitAt(g, extra); if (ally) ally.extraActions += 1; }
      note = `额外行动 +${add}${m === 2 ? '，并给邻位友军 +1' : ''}`;
    } else if (key === 'ru') {
      u.mult = m === 2 ? 3 : 2;
      u.multUses = m >= 1 ? 2 : 1;
      note = `接下来 ${u.multUses} 次 ×${u.mult}`;
    } else if (key === 'xian') {
      u.atk *= 2;
      const wpn = u.weaponHp || 0;
      if (m === 2) {
        const bm = u.maxHp - wpn, bh = u.hp - wpn;
        u.maxHp = bm * 2 + wpn; u.hp = bh * 2 + wpn;
        note = '攻/血翻倍（武器血不计）';
      } else if (m === 1) {
        note = '攻翻倍，免生命减半';
      } else {
        const bm = Math.max(1, Math.ceil((u.maxHp - wpn) / 2)), bh = Math.max(1, Math.ceil((u.hp - wpn) / 2));
        u.maxHp = bm + wpn; u.hp = Math.min(u.hp, bh + wpn);
        note = '攻翻倍，血减半（武器血不计）';
      }
    } else if (key === 'zhi') {
      const e = unitAt(g, extra), turns = m === 2 ? 5 : 3;
      e.attackBan = turns; e.banTurns = turns;
      if (m >= 1) e.skillBan = turns;
      note = `敌「${e.card.name}」${turns} 回合内下次攻击失效${m >= 1 ? '、技能失效' : ''}`;
    } else if (key === 'chengzai') {
      const old = u.weapon;
      const nw = WEAPON_BY_KEY[extra];
      leaveWeapon:
      if (old) {
        removeWeapon(u, old);
        p.weapons.push(old.key);
      }
      const wi = p.weapons.indexOf(extra);
      if (wi >= 0) p.weapons.splice(wi, 1);
      applyWeapon(u, nw);
      if (m >= 1 && old) {
        u.atk += old.atk;
        u.maxHp += old.hp; u.hp += old.hp;
      }
      if (m === 2) {
        if (nw.atk < 0) u.atk -= nw.atk;
        if (nw.hp < 0) { u.maxHp -= nw.hp; u.hp -= nw.hp; }
      }
      note = `换上「${nw.name}」${old ? '，旧装备回手' : ''}${m >= 1 ? '，保留旧攻/血' : ''}${m === 2 ? '，去掉新装备减益' : ''}`;
    }
    blessAfterSkill(g, pid, u, m);
    p.skillUses[key] = (p.skillUses[key] || 0) + 1;
    g.skillsUsedThisTurn[key] = true;
    g.skillsLeft--;
    log(g, pid, 'skill', `${p.name} 对「${u.card.name}」施「${sk.name}」（匹配 ${m}/2）：${note}`);
    if (u.hp <= 0) killUnit(g, u, '技能');
    checkEnd(g);
    return { ok: true, m, note, skill: sk.name };
  }

  function endTurn(g) {
    if (!g || g.over) return { ok: false };
    const p = g.players[g.turn];
    log(g, p.id, 'end', `${p.name} 结束本手`);
    g.turn = other(g.turn);
    startTurn(g);
    return { ok: true };
  }

  /* ---------- 角色 · 道童 ---------- */
  function charGuard(g, pid, key) {
    if (!g || g.over) return { ok: false, msg: '对局已结束' };
    if (g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    if (g.character !== 'daotong') return { ok: false, msg: '当前角色没有这个技能' };
    if (g.charUsed[key]) return { ok: false, msg: '本回合已经用过了' };
    return { ok: true };
  }

  // 求签：系统按双方场面强弱判签，签文只回给求签者
  function sign(g, pid) {
    const guard = charGuard(g, pid, 'sign');
    if (!guard.ok) return guard;
    const mine = ownUnits(g, pid).map(k => unitAt(g, k));
    if (!mine.length) return { ok: false, msg: '场上没有己方人物牌，签无可依' };
    const foes = ownUnits(g, other(pid)).map(k => unitAt(g, k));
    const hpRatio = list => list.length ? list.reduce((s, u) => s + u.hp / u.maxHp, 0) / list.length : 0;
    const fieldScore = list => list.reduce((s, u) => s + u.fieldDmg * .8 + u.fieldArmor * .6 - u.fieldVuln * .6 + u.shield * .05, 0);
    const adv = (mine.length - foes.length) * 1.4
      + (hpRatio(mine) - hpRatio(foes)) * 3
      + (mine.reduce((s, u) => s + u.atk, 0) - foes.reduce((s, u) => s + u.atk, 0)) / 12
      + (fieldScore(mine) - fieldScore(foes)) * .15;
    const favor = Math.max(.12, Math.min(.88, .5 + adv * .07));
    const roll = Math.random();
    let idx;
    if (roll < .05 + favor * .18) idx = 0;
    else if (roll < .25 + favor * .28) idx = 1;
    else if (roll < .6) idx = 2;
    else if (roll < .85) idx = 3;
    else idx = 4;
    const tier = D.SIGNS[idx];
    for (const u of mine) {
      if (idx === 0) { u.atk += 2; u.maxHp += 2; u.hp += 2; }
      else if (idx === 1) { u.atk += 1; u.hp = Math.min(u.maxHp, u.hp + 3); }
      else if (idx === 2) u.hp = Math.min(u.maxHp, u.hp + 4);
      else if (idx === 3) u.hp = Math.min(u.maxHp, u.hp + 2);
      else u.atk = Math.max(0, u.atk - 1);
    }
    const reason = mine.length > foes.length ? '我方人多势众'
      : mine.length < foes.length ? '我方势单'
      : hpRatio(mine) >= hpRatio(foes) ? '双方相持，我方气足' : '双方相持，敌方气盛';
    g.charUsed.sign = true;
    g.charResult = { kind: 'sign', tier: tier.key, tone: tier.tone, effect: tier.effect, reason };
    log(g, pid, 'sign', '求签：签已入筒，签文只在求签者角色面板显示');
    return { ok: true, sign: tier.key, tier: tier.key, effect: tier.effect, reason, kills: 0 };
  }

  // 卜卦：三枚铜钱，三背老阳伤敌，三字老阴伤己，其余无事
  function divine(g, pid) {
    const guard = charGuard(g, pid, 'divine');
    if (!guard.ok) return guard;
    const coins = [0, 1, 2].map(() => Math.random() < .5 ? '背' : '字');
    const bei = coins.filter(c => c === '背').length;
    let type, effect = '无效果', targets = [];
    if (bei === 3) {
      type = '老阳'; effect = '敌方全体 -2 攻 / -2 血';
      targets = ownUnits(g, other(pid)).map(k => unitAt(g, k));
      for (const u of targets) {
        u.atk = Math.max(0, u.atk - 2);
        u.hp -= 2;
        log(g, pid, 'divine', `老阳：敌方「${u.card.name}」-2 攻 / -2 血（${Math.max(0, u.hp)}/${u.maxHp}）`);
      }
    } else if (bei === 0) {
      type = '老阴'; effect = '己方全体 -1 攻 / -1 血';
      targets = ownUnits(g, pid).map(k => unitAt(g, k));
      for (const u of targets) {
        u.atk = Math.max(0, u.atk - 1);
        u.hp -= 1;
        log(g, pid, 'divine', `老阴：己方「${u.card.name}」-1 攻 / -1 血（${Math.max(0, u.hp)}/${u.maxHp}）`);
      }
    } else {
      type = bei === 1 ? '少阳' : '少阴';
    }
    let kills = 0;
    for (const u of targets) {
      if (u.hp <= 0 && !u.dead) { killUnit(g, u, '卜卦'); kills++; }
    }
    g.charUsed.divine = true;
    g.charResult = { kind: 'divine', coins, type, effect, kills };
    log(g, pid, 'divine', `卜卦：${coins.join(' ')} · ${type} · ${effect}`);
    checkEnd(g);
    return { ok: true, coins, type, effect, kills };
  }

  // 清风道长：化身（三魂）/ 分身（七魄），每局各 1 次，不可同时在场
  function summon(g, pid, type, key) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    if (g.character !== 'qingfeng') return { ok: false, msg: '当前角色没有化身/分身' };
    if (type !== 'avatar' && type !== 'clone') return { ok: false, msg: '未知化身类型' };
    if (g.charUsedGame[type]) return { ok: false, msg: '本局已经用过' };
    if (g.cooldowns && g.cooldowns[key] > 0) return { ok: false, msg: '这一魂/魄还在冷却中' };
    if (g.summon) return { ok: false, msg: '化身与分身不可同时在场' };
    const list = type === 'avatar' ? (D.HUNS || []) : (D.POS || []);
    const picked = list.find(x => x.key === key);
    if (!picked) return { ok: false, msg: '请选择一魂/一魄' };
    if (type === 'avatar' && (g.lostHuns || []).includes(key)) return { ok: false, msg: '这一魂已经失去' };
    const owned = ownUnits(g, pid);
    if (type === 'clone' && owned.length >= BOARD_MAX) return { ok: false, msg: '分身受场上 3 张上限限制' };
    const slot = RING.find(k => !g.board[k]);
    if (!slot) return { ok: false, msg: '场上没有空卦位' };
    const repId = type === 'avatar' ? 'zhen-changnan' : 'dui-changnv';
    const base = CARDS[repId];
    const name = type === 'avatar' ? `化身·${picked.name}` : `分身·${picked.name}`;
    const card = Object.assign({}, base, {
      name, attr: type === 'avatar' ? '木' : '金',
      element: type === 'avatar' ? 'wood' : 'metal',
      role: type === 'avatar' ? '化身' : '分身',
    });
    let atk = 20, hp = type === 'avatar' ? 40 : 30;
    if (type === 'avatar' && key === 'tian') atk = Math.round(atk * 1.5);
    if (type === 'avatar' && key === 'ren') hp = Math.round(hp * 1.3);
    const u = {
      cardId: repId, owner: pid, slot, card,
      atk, maxHp: hp, hp,
      weapon: null, weaponHp: 0, shield: 0, shieldMax: 0, tempShield: 0, range: 1,
      acted: false, justPlayed: true, extraActions: 0, mult: 1, multUses: 0,
      burn: 0, attackBan: 0, skillBan: 0, banTurns: 0,
      guard: null, hastyTurn: -99, hastyCdUntil: 0, poison: 0, poisonAdded: false,
      fieldDmg: 0, fieldArmor: 0, fieldVuln: 0, fieldBurnOnHit: false, dead: false,
      summon: { type, key, name },
    };
    g.board[slot] = { unit: u };
    g.charUsedGame[type] = true;
    if (!g.summoned.includes(key)) g.summoned.push(key);
    g.summon = { type, key, name, slot, unit: u };
    log(g, pid, 'skill', `清风道长以「${name}」入场（${u.atk}/${u.hp} · ${type === 'avatar' ? '不占 3 张上限' : '占 3 张上限'}）`);
    return { ok: true, unit: u, slot };
  }

  /* ---------- 天时 · 福缘 / 妙计 ---------- */
  function blessDef(g, pid) { return (g && g.blessings && g.blessings[pid]) || null; }
  function blessSt(g, pid) {
    if (!g.blessState) g.blessState = [{ round: {}, game: {}, trick: false }, { round: {}, game: {}, trick: false }];
    if (!g.blessState[pid]) g.blessState[pid] = { round: {}, game: {}, trick: false };
    return g.blessState[pid];
  }
  function blessOnceRound(g, pid, key) {
    const st = blessSt(g, pid);
    if (st.round[key]) return false;
    st.round[key] = true; return true;
  }
  function blessOnceGame(g, pid, key) {
    const st = blessSt(g, pid);
    if (st.game[key]) return false;
    st.game[key] = true; return true;
  }
  function blessBehind(g, pid) {
    const mine = ownUnits(g, pid).map(k => unitAt(g, k));
    const foe = ownUnits(g, other(pid)).map(k => unitAt(g, k));
    if (mine.length !== foe.length) return mine.length < foe.length;
    const hp = list => list.reduce((s, u) => s + Math.max(0, u.hp), 0);
    return hp(mine) < hp(foe);
  }
  function blessLog(g, pid, b, text) {
    if (b) log(g, pid, 'term', `福缘·${b.name}：${text}`);
  }
  function blessRoundStart(g) {
    for (const pid of [0, 1]) {
      const b = blessDef(g, pid);
      if (!b) continue;
      const st = blessSt(g, pid);
      st.round = {};
      const mine = ownUnits(g, pid).map(k => unitAt(g, k));
      const low = mine.slice().sort((a, c) => (a.hp / a.maxHp) - (c.hp / c.maxHp))[0];
      if (b.key === 's_yushui' && low) {
        low.hp = Math.min(low.maxHp, low.hp + 3);
        if (low.hp < low.maxHp * .5) low.shield += 2;
        blessLog(g, pid, b, `${low.card.name} 回复 3${low.hp < low.maxHp * .5 ? '，并获得 2 护盾' : ''}`);
      } else if (b.key === 's_xiaoxue') {
        for (const u of mine) u.shield += 1;
        blessLog(g, pid, b, `己方全体获得 1 护盾`);
      } else if (b.key === 's_xiaohan' && low) {
        low.hp = Math.min(low.maxHp, low.hp + 2);
        if (low.hp < low.maxHp * .3) low.shield += 3;
        blessLog(g, pid, b, `${low.card.name} 回复 2${low.hp < low.maxHp * .3 ? '，并获得 3 护盾' : ''}`);
      } else if (b.key === 's_dashu') {
        const foes = ownUnits(g, other(pid)).map(k => unitAt(g, k));
        const n = blessBehind(g, pid) ? 2 : 1;
        for (const u of foes.slice(0, n)) { applyBurn(u); }
        blessLog(g, pid, b, `${n} 名敌人被点燃`);
      }
    }
  }
  function blessOnPlace(g, pid, u) {
    const b = blessDef(g, pid);
    if (!b || !u) return;
    if (b.key === 's_lichun' && blessOnceGame(g, pid, 's_lichun')) {
      const behind = blessBehind(g, pid);
      const a = behind ? 5 : 3, h = behind ? 9 : 6;
      u.atk += a; u.maxHp += h; u.hp += h;
      blessLog(g, pid, b, `${u.card.name} +${a} 攻/+${h} 血${behind ? '（逆境）' : ''}`);
    } else if (b.key === 's_guyu' && blessOnceRound(g, pid, 's_guyu')) {
      u.hp = Math.min(u.maxHp, u.hp + 4); u.shield += 1;
      blessLog(g, pid, b, `${u.card.name} 回复 4 并获 1 护盾`);
    } else if (b.key === 's_lidong' && blessOnceGame(g, pid, 's_lidong')) {
      const n = blessBehind(g, pid) ? 8 : 5;
      u.shield += n;
      blessLog(g, pid, b, `${u.card.name} 获得 ${n} 护盾`);
    }
  }
  function blessFreeMove(g, pid) {
    const b = blessDef(g, pid);
    return !!(b && b.key === 's_chunfen' && blessOnceRound(g, pid, 's_chunfen'));
  }
  function blessAfterMove(g, pid, u) {
    u.blessMoved = true;
    const foeBless = blessDef(g, other(pid));
    if (foeBless && foeBless.key === 's_daxue' && blessOnceRound(g, other(pid), 's_daxue')) {
      u.atkPenalty = (u.atkPenalty || 0) + 2;
      blessLog(g, other(pid), foeBless, `${u.card.name} 移动后本回合攻击 -2`);
    }
  }
  // 攻击前修正：返回额外伤害、无视护盾、减伤
  function blessAttackMod(g, pid, a, t) {
    const b = blessDef(g, pid), out = { bonus: 0, ignoreShield: false, reduce: 0, extraTrue: 0, note: '' };
    if (b) {
      if (b.key === 's_jingzhe' && blessOnceRound(g, pid, 's_jingzhe')) {
        out.bonus += 2 + (t.hp >= t.maxHp ? 2 : 0); out.note += '惊雷 ';
      } else if (b.key === 's_lixia' && blessOnceRound(g, pid, 's_lixia')) {
        out.bonus += 2 + (ownUnits(g, other(pid)).length >= 2 ? 2 : 0); out.note += '榴火 ';
      } else if (b.key === 's_xiaoman' && blessOnceRound(g, pid, 's_xiaoman')) {
        out.bonus += blessBehind(g, pid) ? 3 : 2; out.note += '满仓 ';
      } else if (b.key === 's_bailu' && blessOnceRound(g, pid, 's_bailu')) {
        out.bonus += t.acted ? 1 : 3; out.note += '霜刃 ';
      } else if (b.key === 's_liqiu' && blessOnceRound(g, pid, 's_liqiu')) {
        out.ignoreShield = true; out.bonus += t.hp < t.maxHp * .5 ? 2 : 0; out.note += '一叶 ';
      } else if (b.key === 's_qiufen' && blessOnceRound(g, pid, 's_qiufen') && blessBehind(g, pid)) {
        out.bonus += 2; a.shield += 2; out.note += '秤星 ';
      } else if (b.key === 's_dahan' && ownUnits(g, pid).length === 1) {
        out.bonus += 4; out.note += '岁终 ';
      } else if (b.key === 's_xiaoshu' && Math.random() < (ownUnits(g, other(pid)).length >= 3 ? .5 : .3)) {
        out.extraTrue += 1; out.note += '蝉鸣 ';
      }
    }
    const df = blessDef(g, other(pid));
    if (df && df.key === 's_hanlu' && blessOnceRound(g, other(pid), 's_hanlu')) {
      out.reduce += blessBehind(g, other(pid)) ? 4 : 2;
      out.note += '冷月 ';
    }
    return out;
  }
  function blessAfterAttack(g, pid, a, t) {
    const b = blessDef(g, pid);
    if (b && b.key === 's_shuangjiang' && blessOnceRound(g, other(pid), 's_shuangjiang')) {
      a.atkPenalty = (a.atkPenalty || 0) + 2;
      blessLog(g, other(pid), b, `${a.card.name} 的下次攻击 -2`);
    }
  }
  function blessAfterKill(g, pid, a, t) {
    const b = blessDef(g, pid);
    if (!b) return;
    if (b.key === 's_mangzhong' && blessOnceRound(g, pid, 's_mangzhong')) {
      for (const k of adjacent(t.slot)) {
        const e = unitAt(g, k);
        if (e && e.owner !== pid) {
          e.hp -= 2;
          log(g, pid, 'term', `福缘·连镰：${e.card.name} -2 血`);
          if (e.hp <= 0) killUnit(g, e, '连镰');
        }
      }
    } else if (b.key === 's_chushu' && blessOnceRound(g, pid, 's_chushu')) {
      for (const k of ownUnits(g, pid)) { const u = unitAt(g, k); u.hp = Math.min(u.maxHp, u.hp + 2); }
      blessLog(g, pid, b, '击杀后己方全体回复 2');
    }
  }
  function blessAfterSkill(g, pid, u, m) {
    const b = blessDef(g, pid);
    if (b && b.key === 's_xiazhi' && blessOnceRound(g, pid, 's_xiazhi')) {
      u.tempAtk = (u.tempAtk || 0) + (m === 2 ? 4 : 2);
      blessLog(g, pid, b, `${u.card.name} 本回合 +${m === 2 ? 4 : 2} 攻`);
    }
  }
  function blessBeforeDeath(g, u) {
    const pid = u.owner, b = blessDef(g, pid);
    if (!b) return false;
    if (b.key === 's_qingming' && blessOnceGame(g, pid, 's_qingming')) {
      const n = blessBehind(g, pid) ? 8 : 5;
      for (const k of ownUnits(g, pid)) { const x = unitAt(g, k); x.hp = Math.min(x.maxHp, x.hp + n); }
      blessLog(g, pid, b, `阵亡触发，己方全体回复 ${n}`);
    } else if (b.key === 's_dongzhi' && blessOnceGame(g, pid, 's_dongzhi')) {
      if (blessBehind(g, pid)) {
        u.hp = 1; u.dead = false;
        blessLog(g, pid, b, `${u.card.name} 以 1 血留在原席（逆境）`);
        return true;
      }
      for (const k of ownUnits(g, pid)) { const x = unitAt(g, k); x.hp = Math.min(x.maxHp, x.hp + 4); }
      blessLog(g, pid, b, `己方全体回复 4`);
    } else if (b.kind === 'trick' && b.key === 't_winter' && !blessSt(g, pid).trick) {
      blessSt(g, pid).trick = true;
      const p = g.players[pid];
      const slot = u.slot;
      g.board[slot] = null;
      if (p.cardState[u.cardId] === 'board') { p.cardState[u.cardId] = 'hand'; if (!p.hand.includes(u.cardId)) p.hand.push(u.cardId); }
      const shell = Object.assign({}, u, {
        hp: 1, maxHp: 1, atk: 0, weapon: null, weaponHp: 0, shield: 0, shieldMax: 0, tempShield: 0,
        ranged: false, range: 1, acted: true, justPlayed: true, dead: false, shell: true,
        card: Object.assign({}, u.card, { name: '空壳' }),
      });
      g.board[slot] = { unit: shell };
      log(g, pid, 'term', `妙计·金蝉脱壳：${u.card.name} 以 1 血回手，原席留下空壳`);
      return true;
    }
    return false;
  }
  function setBlessing(g, pid, b) {
    if (!g || g.over) return { ok: false, msg: '对局已结束' };
    g.blessings[pid] = b || null;
    g.blessState[pid] = { round: {}, game: {}, trick: false };
    if (b) log(g, pid, 'term', `天时换囊 · ${b.name}：${b.text}`);
    return { ok: true };
  }

  function useTrick(g, pid, target1, target2) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    const b = blessDef(g, pid);
    if (!b || b.kind !== 'trick' || b.key === 't_winter') return { ok: false, msg: '没有可主动使用的妙计' };
    const st = blessSt(g, pid);
    if (st.trick) return { ok: false, msg: '本季妙计已经用过' };
    if (b.key === 't_spring') {
      const u = unitAt(g, target1);
      if (!u || u.owner === pid) return { ok: false, msg: '选择一名敌人' };
      const empties = adjacent(u.slot).filter(k => !g.board[k]);
      if (empties.length) {
        g.board[u.slot] = null; u.slot = empties[0]; g.board[u.slot] = { unit: u };
        log(g, pid, 'term', `妙计·借东风：${u.card.name} 被推到「${TRIGRAMS[u.slot].name}」`);
      } else {
        u.hp -= 2; log(g, pid, 'term', `妙计·借东风：${u.card.name} 无路可退，-2 血`);
        if (u.hp <= 0) killUnit(g, u, '借东风');
      }
    } else if (b.key === 't_summer') {
      const u = unitAt(g, target1);
      if (!u || u.owner === pid || !u.burn) return { ok: false, msg: '选择一名已灼烧的敌人' };
      const otherEnemy = ownUnits(g, other(pid)).map(k => unitAt(g, k)).find(x => x !== u);
      if (otherEnemy) {
        otherEnemy.burn = Math.max(otherEnemy.burn || 0, u.burn);
        log(g, pid, 'term', `妙计·火中取栗：灼烧复制给 ${otherEnemy.card.name}`);
      } else {
        u.hp -= 2; log(g, pid, 'term', `妙计·火中取栗：${u.card.name} -2 血`);
        if (u.hp <= 0) killUnit(g, u, '火中取栗');
      }
    } else if (b.key === 't_autumn') {
      const a = unitAt(g, target1), c = unitAt(g, target2);
      if (!a || !c || a === c) return { ok: false, msg: '选择两张不同的牌' };
      const as = a.slot, cs = c.slot;
      g.board[as] = { unit: c }; g.board[cs] = { unit: a };
      a.slot = cs; c.slot = as;
      log(g, pid, 'term', `妙计·移花接木：${a.card.name} 与 ${c.card.name} 交换卦位`);
    }
    st.trick = true;
    checkEnd(g);
    return { ok: true };
  }

  function checkEnd(g) {
    if (g.over) return;
    for (const p of g.players) {
      if (p.dead.length >= WIN_DEAD) {
        g.over = true; g.winner = other(p.id);
        log(g, -1, 'end', `${p.name} 的 8 张人物牌全部失去 · ${g.players[g.winner].name} 胜`);
        return;
      }
    }
  }

  /* ---------- 合法目标 ---------- */
  function validSlots(g, pid, cardId) {
    if (!g || g.turn !== pid || g.over || g.placedThisTurn) return [];
    const p = g.players[pid];
    if (p.cardState[cardId] !== 'hand' || ownUnits(g, pid).length >= BOARD_MAX) return [];
    return RING.filter(k => !g.board[k]);
  }
  function attackTargets(g, pid, fromKey) {
    const u = unitAt(g, fromKey);
    if (!u || u.owner !== pid || u.guard === 'firm' || !canUnitAct(g, pid, u)) return [];
    return RING.filter(k => { const t = unitAt(g, k); return t && t.owner !== pid && ringDist(fromKey, k) <= u.range; });
  }
  function moveTargets(g, pid, fromKey) {
    const u = unitAt(g, fromKey);
    if (!u || u.owner !== pid || u.guard === 'firm' || !canUnitAct(g, pid, u)) return [];
    return adjacent(fromKey).filter(k => !g.board[k]);
  }
  function equipTargets(g, pid) {
    return ownUnits(g, pid).filter(k => { const u = unitAt(g, k); return canUnitAct(g, pid, u) && !u.weapon && u.guard !== 'firm'; });
  }
  // 可发起防御的单位；mode: hasty=仓促，firm=坚守，cancel=解除坚守
  function defendTargets(g, pid, mode) {
    if (!g || g.over || g.turn !== pid) return [];
    return ownUnits(g, pid).filter(k => defendValid(g, pid, k, mode).ok);
  }
  function rangeEnemies(g, slotKey) {
    const u = unitAt(g, slotKey);
    if (!u) return [];
    return RING.filter(k => { const t = unitAt(g, k); return t && t.owner !== u.owner && ringDist(slotKey, k) <= u.range; });
  }
  function skillTargets(g, pid) {
    return ownUnits(g, pid).filter(k => { const u = unitAt(g, k); return u.skillBan <= 0; });
  }

  window.Engine = {
    HUMAN, FOE, HAND, BOARD_MAX, WIN_DEAD, RING, CARDS, WEAPONS, SKILLS, TERMS,
    newGame, startTurn, startRound, endTurn, place, attack, equip, move, useSkill, forecast,
    sign, divine, summon, useTrick, setBlessing,
    defend, defendValid, defendTargets, applyPoison,
    skillValid, skillMatches, placement, validSlots, attackTargets, moveTargets,
    equipTargets, skillTargets, rangeEnemies, ownUnits, unitAt, ringDist, adjacent, canUnitAct,
    viewOrder, viewIndex, seatSlot, farSlot, firstPlayer, other, remaining,
    checkEnd, killUnit, log, byId, applyWeapon, removeWeapon, applyField, applyBurn,
  };
})();
