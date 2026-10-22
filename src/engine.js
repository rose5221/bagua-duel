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

  function makePlayer(id, name, attrs) {
    const hand = [], cardState = {};
    for (const ak of attrs) {
      for (const r of shuffle(ROLES).slice(0, 4)) {
        const cid = ak + '-' + r.key;
        hand.push(cid); cardState[cid] = 'hand';
      }
    }
    return { id, name, attrs, hand, cardState, weapons: [], skillUses: {}, dead: [] };
  }

  function newGame(opts) {
    opts = opts || {};
    const humanSeat = opts.humanSeat || (Math.random() < .5 ? 'N' : 'S');
    const difficulty = opts.difficulty || 'normal';
    const first = firstPlayer(humanSeat);
    const attrs = shuffle(ATTRS.map(a => a.key));
    const p0 = makePlayer(0, '你', attrs.slice(0, 2));
    const p1 = makePlayer(1, '庄家', attrs.slice(2, 4));
    const weapons = shuffle(WEAPONS.map(w => w.key));
    p0.weapons = weapons.slice(0, 4);
    p1.weapons = weapons.slice(4, 8);
    const g = {
      humanSeat, difficulty, first, turn: first, turnNo: 0, round: 0, month: 1,
      term: TERMS[0], over: false, winner: null, board: {}, players: [p0, p1],
      placedThisTurn: false, skillsLeft: 2, skillsUsedThisTurn: {}, log: [],
    };
    for (const k of RING) g.board[k] = null;
    log(g, -1, 'month', `${D.SEATS[humanSeat].text} · ${first === HUMAN ? '你先手' : '庄家先手'} · 难度 ${D.DIFFICULTY.find(d => d.key === difficulty).name}`);
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
    if (g.turn === g.first) startRound(g);
    if (g.over) return;
    for (const k of RING) {
      const u = unitAt(g, k);
      if (!u || u.owner !== p.id) continue;
      u.acted = false;
      u.justPlayed = false;
      u.extraActions = 0;
      u.shield = u.shieldMax + u.tempShield;
    }
    log(g, p.id, 'turn', `第 ${g.turnNo} 手 · ${p.name} · 场上 ${ownUnits(g, p.id).length}/${BOARD_MAX} · 手牌 ${p.hand.length} · 余 ${remaining(p)}/8`);
  }

  function startRound(g) {
    g.round++;
    g.month = ((g.round - 1) % 12) + 1;
    g.term = TERMS[(g.month - 1) % 12];
    log(g, -1, 'month', `第 ${g.month} 月 · ${g.term.name}/${g.term.zhong} · 场地效果刷新`);
    for (const k of RING) {
      const u = unitAt(g, k);
      if (!u) continue;
      u.tempShield = 0;
      u.shield = u.shieldMax;
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
    const u = {
      cardId, owner: pid, slot: slotKey, card, atk: b.atk, maxHp: b.hp, hp: b.hp,
      weapon: null, weaponHp: 0, shield: 0, shieldMax: 0, tempShield: 0, range: 1,
      acted: false, justPlayed: true, extraActions: 0, mult: 1, multUses: 0,
      burn: 0, attackBan: 0, skillBan: 0, banTurns: 0,
      fieldDmg: 0, fieldArmor: 0, fieldVuln: 0, fieldBurnOnHit: false, dead: false,
    };
    g.board[slotKey] = { unit: u };
    p.cardState[cardId] = 'board';
    g.placedThisTurn = true;
    log(g, pid, 'place', `${p.name} 在「${slot.name}」落「${card.name}」（${u.atk}/${u.hp}）${card.element === slot.element ? ' · 同宫 +2/+4' : ''}${card.roleElement === slot.element ? ' · 物象同宫 +2/+4' : ''}${ELEMENTS[slot.element].gen === card.element ? ' · 席生牌 +4 血' : ''}${ELEMENTS[slot.element].over === card.element ? ' · 席克牌 -2 攻' : ''}`);
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
    if (!adjacent(fromKey).includes(toKey)) return { ok: false, msg: '只能移动到邻位' };
    if (g.board[toKey]) return { ok: false, msg: '目标卦位已有牌' };
    spendUnitAction(u);
    g.board[fromKey] = null;
    g.board[toKey] = { unit: u };
    u.slot = toKey;
    log(g, pid, 'move', `${g.players[pid].name} 的「${u.card.name}」移动到「${TRIGRAMS[toKey].name}」`);
    return { ok: true };
  }

  function attack(g, pid, fromKey, toKey) {
    if (!g || g.over || g.turn !== pid) return { ok: false, msg: '不是你的回合' };
    const a = unitAt(g, fromKey), t = unitAt(g, toKey);
    if (!a || a.owner !== pid) return { ok: false, msg: '不是你的单位' };
    if (!t || t.owner === pid) return { ok: false, msg: '目标不是敌方单位' };
    if (a.justPlayed) return { ok: false, msg: '刚落下的牌本回合不能攻击' };
    if (!canUnitAct(g, pid, a)) return { ok: false, msg: '这张牌本回合已行动' };
    if (ringDist(fromKey, toKey) > a.range) return { ok: false, msg: '超出攻击距离' };
    spendUnitAction(a);
    if (a.attackBan > 0) {
      a.attackBan = 0; a.banTurns = 0;
      log(g, pid, 'attack', `${g.players[pid].name} 的「${a.card.name}」攻击被「止」化去`);
      return { ok: true, nullified: true };
    }
    const over = ELEMENTS[a.card.element].over === t.card.element;
    let dmg = Math.max(0, a.atk + (a.fieldDmg || 0) + (over ? 1 : 0));
    const mult = a.mult || 1;
    dmg *= mult;
    if (a.multUses > 0) { a.multUses--; if (a.multUses === 0) a.mult = 1; }
    const absorbed = Math.min(t.shield, dmg);
    t.shield -= absorbed;
    dmg -= absorbed;
    dmg = Math.max(0, dmg - (t.fieldArmor || 0) + (t.fieldVuln || 0));
    t.hp -= dmg;
    log(g, pid, 'attack', `${g.players[pid].name} 的「${a.card.name}」→「${t.card.name}」：${a.atk}${a.fieldDmg ? (a.fieldDmg > 0 ? '+1' : '-1') : ''}${over ? '+克1' : ''}${mult > 1 ? '×' + mult : ''}，盾挡 ${absorbed}，实伤 ${dmg}（${Math.max(0, t.hp)}/${t.maxHp}）`);
    if (a.fieldBurnOnHit) { applyBurn(t); log(g, pid, 'term', `「${t.card.name}」被点燃（灼烧 2 回合）`); }
    if (a.weapon && a.weapon.spear) {
      const w = a.weapon; removeWeapon(a, w);
      log(g, pid, 'equip', `「${a.card.name}」的长枪在攻击后销毁`);
    }
    if (t.hp <= 0) killUnit(g, t, '战斗');
    checkEnd(g);
    return { ok: true, damage: dmg };
  }

  function killUnit(g, u, cause) {
    if (!u || u.dead) return;
    u.dead = true;
    const p = g.players[u.owner];
    if (g.board[u.slot] && g.board[u.slot].unit === u) g.board[u.slot] = null;
    if (p.cardState[u.cardId] === 'board') { p.cardState[u.cardId] = 'dead'; p.dead.push(u.cardId); }
    if (u.weapon) { u.weapon = null; u.weaponHp = 0; }
    log(g, u.owner, 'death', `${p.name} 的「${u.card.name}」阵亡（${cause}）· 余 ${remaining(p)}/8`);
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
    if (u.justPlayed) return { ok: false, msg: '刚落下的牌本回合不能使用技能' };
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
      const heal = x => { x.hp = Math.min(x.maxHp, x.hp + 4); };
      heal(u);
      for (const k of adjacent(slotKey)) { const a = unitAt(g, k); if (a && a.owner === pid) heal(a); }
      if (m >= 1) heal(u);
      if (m === 2) { heal(u); for (const k of adjacent(slotKey)) { const a = unitAt(g, k); if (a && a.owner === pid) heal(a); } }
      note = m === 2 ? '自身与邻位 +12 血' : m === 1 ? '自身 +8、邻位 +4 血' : '自身与邻位 +4 血';
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
    p.skillUses[key] = (p.skillUses[key] || 0) + 1;
    g.skillsUsedThisTurn[key] = true;
    g.skillsLeft--;
    log(g, pid, 'skill', `${p.name} 对「${u.card.name}」施「${sk.name}」（匹配 ${m}/2）：${note}`);
    if (u.hp <= 0) killUnit(g, u, '技能');
    checkEnd(g);
    return { ok: true, m };
  }

  function endTurn(g) {
    if (!g || g.over) return { ok: false };
    const p = g.players[g.turn];
    log(g, p.id, 'end', `${p.name} 结束本手`);
    g.turn = other(g.turn);
    startTurn(g);
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
    if (!u || u.owner !== pid || !canUnitAct(g, pid, u)) return [];
    return RING.filter(k => { const t = unitAt(g, k); return t && t.owner !== pid && ringDist(fromKey, k) <= u.range; });
  }
  function moveTargets(g, pid, fromKey) {
    const u = unitAt(g, fromKey);
    if (!u || u.owner !== pid || !canUnitAct(g, pid, u)) return [];
    return adjacent(fromKey).filter(k => !g.board[k]);
  }
  function equipTargets(g, pid) {
    return ownUnits(g, pid).filter(k => { const u = unitAt(g, k); return canUnitAct(g, pid, u) && !u.weapon; });
  }
  function rangeEnemies(g, slotKey) {
    const u = unitAt(g, slotKey);
    if (!u) return [];
    return RING.filter(k => { const t = unitAt(g, k); return t && t.owner !== u.owner && ringDist(slotKey, k) <= u.range; });
  }
  function skillTargets(g, pid) {
    return ownUnits(g, pid).filter(k => { const u = unitAt(g, k); return !u.justPlayed && u.skillBan <= 0; });
  }

  window.Engine = {
    HUMAN, FOE, HAND, BOARD_MAX, WIN_DEAD, RING, CARDS, WEAPONS, SKILLS, TERMS,
    newGame, startTurn, startRound, endTurn, place, attack, equip, move, useSkill,
    skillValid, skillMatches, placement, validSlots, attackTargets, moveTargets,
    equipTargets, skillTargets, rangeEnemies, ownUnits, unitAt, ringDist, adjacent, canUnitAct,
    viewOrder, viewIndex, seatSlot, farSlot, firstPlayer, other, remaining,
    checkEnd, killUnit, log, byId, applyWeapon, removeWeapon, applyField, applyBurn,
  };
})();
