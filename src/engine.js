/* 八卦对决 · 引擎
   共享八席；每人 4 属性 × 8 家庭成员 = 32 张人物牌；武器/技能/节气。 */
(function () {
  'use strict';
  const D = window.DATA;
  const { ELEMENTS, RING, TRIGRAMS, ATTRS, ROLES, CARDS, WEAPONS, WEAPON_BY_KEY, SKILLS, SKILL_BY_KEY, TERMS } = D;
  const TOTAL = 32;
  const HUMAN = 0, FOE = 1;

  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function byId(g, id) { return g.players[id]; }
  function slotOf(g, key) { return g.board[key] || null; }
  function unitAt(g, key) { const s = g.board[key]; return s ? s.unit : null; }
  function ringIndex(key) { return RING.indexOf(key); }
  function ringDist(a, b) {
    const i = ringIndex(a), j = ringIndex(b);
    if (i < 0 || j < 0) return 99;
    const d = Math.abs(i - j);
    return Math.min(d, 8 - d);
  }
  function adjacent(key) {
    const i = ringIndex(key);
    if (i < 0) return [];
    return [RING[(i + 7) % 8], RING[(i + 1) % 8]];
  }
  function viewOrder(humanSeat) {
    const order = RING.slice();
    if (humanSeat === 'S') return order.slice(4).concat(order.slice(0, 4));
    return order;
  }
  function viewIndex(humanSeat, key) { return viewOrder(humanSeat).indexOf(key); }
  function seatSlot(humanSeat) { return viewOrder(humanSeat)[4]; }       // 玩家自己（画面下方）
  function farSlot(humanSeat) { return viewOrder(humanSeat)[0]; }        // 对面（画面上方）
  function firstPlayer(humanSeat) { return humanSeat === 'N' ? HUMAN : FOE; }
  function other(id) { return id === 0 ? 1 : 0; }
  function remaining(p) { return TOTAL - p.dead.length; }
  function monthElement(g) { return TERMS[(g.month - 1) % 12].element; }

  function log(g, actor, kind, text) {
    g.log.push({ turn: g.turnNo, actor, kind, text });
    if (g.log.length > 300) g.log.shift();
  }

  function makePlayer(id, name, attrs) {
    const roster = [];
    for (const a of attrs) for (const r of ROLES) roster.push(a + '-' + r.key);
    const state = {};
    for (const c of roster) state[c] = 'hand';
    return {
      id, name, attrs, roster, cardState: state, dead: [], weapons: [],
      skillUsed: {}, skillLeft: 1, actionsLeft: 1,
    };
  }

  function drawWeapon(g, p) {
    if (p.weapons.length >= 5 || !g.weaponDeck.length) return null;
    const w = g.weaponDeck.shift();
    p.weapons.push(w);
    return w;
  }

  function newGame(opts) {
    opts = opts || {};
    const humanSeat = opts.humanSeat || (Math.random() < 0.5 ? 'N' : 'S');
    const first = firstPlayer(humanSeat);
    const attrs = shuffle(ATTRS.map(a => a.key));
    const a0 = attrs.slice(0, 4), a1 = attrs.slice(4);
    const g = {
      humanSeat, first, turn: first, turnNo: 0, month: 1, year: 1, round: 1,
      termIdx: 0, term: TERMS[0], over: false, winner: null,
      board: {}, players: [makePlayer(0, '你', a0), makePlayer(1, '庄家', a1)],
      actionsLeft: 1, skillLeft: 1, log: [], weaponDeck: [],
    };
    for (const k of RING) g.board[k] = null;
    const deck = shuffle(WEAPONS.map(w => w.key));
    g.weaponDeck = deck.slice(6);
    g.players[0].weapons = deck.slice(0, 3);
    g.players[1].weapons = deck.slice(3, 6);
    g.actionsLeft = 1; g.skillLeft = 1;
    log(g, -1, 'month', `第 1 年 · ${g.term.name}/${g.term.zhong} · ${D.SEATS[humanSeat].text} · ${first === HUMAN ? '你先手' : '庄家先手'}`);
    log(g, -1, 'weather', `天时：${g.term.desc}`);
    applyTerm(g, true);
    startTurn(g, true);
    return g;
  }

  function startTurn(g) {
    const p = g.players[g.turn];
    g.turnNo++;
    g.actionsLeft = 1;
    g.skillLeft = 1;
    g.aiSkillTried = false;
    p.skillUsed = {};
    p.actionsLeft = 1;
    p.skillLeft = 1;
    // 护盾刷新；控制回合递减
    for (const k of RING) {
      const u = unitAt(g, k);
      if (!u) continue;
      if (u.owner === p.id) {
        if (u.shieldMax) u.shield = u.shieldMax;
        if (u.banTurns > 0) {
          u.banTurns--;
          if (u.banTurns <= 0) { u.attackBan = 0; u.skillBan = 0; }
        }
      }
    }
    const w = drawWeapon(g, p);
    log(g, p.id, 'turn', `第 ${g.month} 月 · ${p.name} · 行动 1 + 技能 1${w ? ' · 摸装备「' + WEAPON_BY_KEY[w].name + '」' : ''}`);
  }

  function applyTerm(g, silent) {
    const t = g.term;
    const el = t.element;
    const units = RING.map(k => unitAt(g, k)).filter(Boolean);
    const dead = [];
    const dmg = (u, n) => { if (!u) return; u.hp -= n; if (u.hp <= 0) dead.push(u); };
    if (!silent) log(g, -1, 'term', `节气 ${t.name}：${t.desc}`);
    for (const u of units) {
      const ue = u.element;
      if (t.fx === 'healAll') u.hp = Math.min(u.maxHp, u.hp + 1);
      else if (t.fx === 'damageAll') dmg(u, 1);
      else if (t.fx === 'shieldAll') u.shield += 1;
      else if (t.fx === 'buff' && ue === el) u.atk += 1;
      else if (t.fx === 'fireTerm') { if (ue === 'fire') u.atk += 1; else dmg(u, 1); }
      else if (t.fx === 'debuffAll') u.atk = Math.max(0, u.atk - 1);
      else if (t.fx === 'metalTerm' && ue === 'metal') { u.atk += 1; u.armor += 1; }
      else if (t.fx === 'waterTerm' && ue === 'water') u.shield += 1;
      else if (t.fx === 'freezeAll') u.attackBan = Math.max(u.attackBan, 1);
    }
    if (t.fx === 'healLow') {
      let low = null;
      for (const u of units) if (!low || u.hp < low.hp) low = u;
      if (low) low.hp = Math.min(low.maxHp, low.hp + 2);
    }
    for (const u of dead) killUnit(g, u, '节气');
    checkEnd(g);
  }

  function killUnit(g, u, cause) {
    if (!u || u.dead) return;
    u.dead = true;
    const p = g.players[u.owner];
    if (g.board[u.slot] && g.board[u.slot].unit === u) g.board[u.slot] = null;
    if (p.cardState[u.cardId] === 'placed') {
      p.cardState[u.cardId] = 'dead';
      p.dead.push(u.cardId);
    }
    log(g, u.owner, 'death', `${p.name} 的「${CARDS[u.cardId].name}」阵亡（${cause}）· 余 ${remaining(p)}/${TOTAL}`);
  }

  function placement(card, slot, monthEle) {
    let atk = card.atk, hp = card.hp;
    const se = slot.element, ce = card.element;
    if (se === ce) { atk += 1; hp += 1; }
    if (ELEMENTS[se].gen === ce) hp += 1;
    if (ELEMENTS[se].over === ce) atk -= 1;
    if (card.roleElement === se) { atk += 2; hp += 2; }
    if (monthEle === ce) atk += 1;
    return { atk: Math.max(0, atk), hp: Math.max(1, hp) };
  }

  function canAct(g, pid) { return g && !g.over && g.turn === pid; }

  function place(g, pid, cardId, slotKey) {
    if (!canAct(g, pid)) return { ok: false, msg: '不是你的回合' };
    if (g.actionsLeft <= 0) return { ok: false, msg: '本手行动已用完' };
    if (!RING.includes(slotKey)) return { ok: false, msg: '没有这个卦位' };
    if (g.board[slotKey]) return { ok: false, msg: '该卦位已有牌' };
    const p = g.players[pid];
    if (p.cardState[cardId] !== 'hand') return { ok: false, msg: '这张人物牌不在手上' };
    const card = CARDS[cardId];
    const slot = TRIGRAMS[slotKey];
    const b = placement(card, slot, monthElement(g));
    const u = {
      cardId, owner: pid, slot: slotKey, element: card.element, roleElement: card.roleElement,
      atk: b.atk, maxHp: b.hp, hp: b.hp, shield: 0, shieldMax: 0, equip: null,
      range: 1, armor: 0, extra: 0, mult: 1, multUses: 0, attackBan: 0, skillBan: 0, banTurns: 0,
      dead: false, card,
    };
    g.board[slotKey] = { unit: u };
    p.cardState[cardId] = 'placed';
    g.actionsLeft--;
    log(g, pid, 'place', `${p.name} 在「${slot.name}·${slot.dir}」落「${card.name}」（${b.atk}/${b.hp}）· ${slot.element === card.element ? '属性同宫 +1/+1 · ' : ''}${card.roleElement === slot.element ? '物象同宫 +2/+2' : ''}`.replace(/ · $/, ''));
    return { ok: true, unit: u };
  }

  function attack(g, pid, fromKey, toKey) {
    if (!canAct(g, pid)) return { ok: false, msg: '不是你的回合' };
    if (g.actionsLeft <= 0) return { ok: false, msg: '本手行动已用完' };
    const a = unitAt(g, fromKey);
    if (!a || a.owner !== pid) return { ok: false, msg: '不是你的单位' };
    const t = unitAt(g, toKey);
    if (!t || t.owner === pid) return { ok: false, msg: '目标不是敌方单位' };
    const dist = ringDist(fromKey, toKey);
    if (dist > a.range) return { ok: false, msg: '超出攻击距离' };
    const p = g.players[pid];
    g.actionsLeft--;
    if (a.attackBan > 0) {
      a.attackBan = 0; a.banTurns = 0;
      log(g, pid, 'attack', `${p.name} 的「${a.card.name}」攻击被「止」化去`);
      return { ok: true, nullified: true };
    }
    let dmg = a.atk * (a.mult || 1);
    const mult = a.mult || 1;
    if (a.multUses > 0) { a.multUses--; if (a.multUses === 0) a.mult = 1; }
    const shieldBefore = t.shield;
    const absorbed = Math.min(t.shield, dmg);
    t.shield -= absorbed; dmg -= absorbed;
    const afterArmor = Math.max(0, dmg - (t.armor || 0));
    t.hp -= afterArmor;
    log(g, pid, 'attack', `${p.name} 的「${a.card.name}」→ 庄家「${t.card.name}」：${a.atk}${mult > 1 ? '×' + mult : ''} 攻，盾挡 ${absorbed}，护甲 ${t.armor || 0}，实伤 ${afterArmor}（${Math.max(0, t.hp)}/${t.maxHp}）`);
    if (t.hp <= 0) killUnit(g, t, '战斗');
    else if (shieldBefore > 0) { /* noop */ }
    checkEnd(g);
    return { ok: true, damage: afterArmor, killed: t.hp <= 0 };
  }

  function equip(g, pid, weaponKey, slotKey) {
    if (!canAct(g, pid)) return { ok: false, msg: '不是你的回合' };
    if (g.actionsLeft <= 0) return { ok: false, msg: '本手行动已用完' };
    const p = g.players[pid];
    const wi = p.weapons.indexOf(weaponKey);
    if (wi < 0) return { ok: false, msg: '没有这件装备' };
    const u = unitAt(g, slotKey);
    if (!u || u.owner !== pid) return { ok: false, msg: '不是你的单位' };
    if (u.equip) return { ok: false, msg: '已有装备，只有「承载」能换' };
    applyEquip(g, u, WEAPON_BY_KEY[weaponKey]);
    p.weapons.splice(wi, 1);
    g.actionsLeft--;
    log(g, pid, 'equip', `${p.name} 给「${u.card.name}」装备「${WEAPON_BY_KEY[weaponKey].name}」`);
    if (u.hp <= 0) killUnit(g, u, '装备反噬');
    checkEnd(g);
    return { ok: true };
  }

  function applyEquip(g, u, w) {
    u.equip = w;
    u.atk += w.atk;
    u.maxHp = Math.max(1, u.maxHp + w.hp);
    u.hp = Math.min(u.maxHp, u.hp + w.hp);
    u.armor += w.armor;
    u.range = Math.max(u.range, w.range);
    if (w.shield) {
      u.shieldMax += w.shield;
      u.shield += w.shield;
    }
  }
  function removeEquipStats(u, w) {
    if (!w) return;
    u.atk -= w.atk;
    u.maxHp = Math.max(1, u.maxHp - w.hp);
    u.hp = Math.min(u.hp, u.maxHp);
    u.armor -= w.armor;
    u.range = 1;
    if (w.shield) { u.shieldMax = Math.max(0, u.shieldMax - w.shield); u.shield = Math.min(u.shield, u.shieldMax); }
    u.equip = null;
  }

  function skillMatches(u, sk) {
    let m = 0;
    if (u.card.attr === sk.attr) m++;
    if (u.card.role === sk.role) m++;
    return m;
  }

  function skillValid(g, pid, key, slotKey, extraKey) {
    const p = g.players[pid];
    if (!canAct(g, pid)) return { ok: false, msg: '不是你的回合' };
    if (g.skillLeft <= 0) return { ok: false, msg: '本手技能已用完' };
    if (p.skillUsed[key]) return { ok: false, msg: '这张技能本手已用过' };
    const sk = SKILL_BY_KEY[key];
    if (!sk) return { ok: false, msg: '没有这个技能' };
    const u = unitAt(g, slotKey);
    if (!u || u.owner !== pid) return { ok: false, msg: '技能要放在自己的单位上' };
    if (u.skillBan > 0) return { ok: false, msg: '该单位技能被封' };
    if (key === 'zhi') {
      const e = unitAt(g, extraKey);
      if (!e || e.owner === pid) return { ok: false, msg: '再选一个范围内的敌人' };
      if (ringDist(slotKey, extraKey) > u.range) return { ok: false, msg: '目标不在该单位攻击范围' };
    }
    if (key === 'chengzai') {
      if (!p.weapons.includes(extraKey)) return { ok: false, msg: '需要手上一件装备' };
    }
    return { ok: true, sk, u };
  }

  function useSkill(g, pid, key, slotKey, extraKey) {
    const v = skillValid(g, pid, key, slotKey, extraKey);
    if (!v.ok) return v;
    const { sk, u } = v;
    const p = g.players[pid];
    const m = skillMatches(u, sk);
    let note = '';
    if (key === 'gangjian') {
      const add = 4 + 2 * m;
      u.atk += add; u.maxHp += add; u.hp += add;
      note = `+${add}/+${add}`;
    } else if (key === 'koushe') {
      const add = 4 + 2 * m;
      u.atk += add;
      note = `+${add} 攻`;
    } else if (key === 'guangming') {
      const heal = (x) => { x.hp = Math.min(x.maxHp, x.hp + 2); };
      heal(u);
      for (const k of adjacent(slotKey)) { const a = unitAt(g, k); if (a && a.owner === pid) heal(a); }
      if (m >= 1) u.hp = Math.min(u.maxHp, u.hp + 2);
      if (m === 2) {
        u.hp = Math.min(u.maxHp, u.hp + 2);
        for (const k of adjacent(slotKey)) { const a = unitAt(g, k); if (a && a.owner === pid) a.hp = Math.min(a.maxHp, a.hp + 2); }
      }
      note = m === 2 ? '目标与邻位 +6 血' : m === 1 ? '目标 +4 血、邻位 +2 血' : '目标与邻位 +2 血';
    } else if (key === 'dong') {
      g.actionsLeft += 1 + (m >= 1 ? 1 : 0) + (m === 2 ? 1 : 0);
      note = `额外行动 +${1 + (m >= 1 ? 1 : 0) + (m === 2 ? 1 : 0)}`;
    } else if (key === 'ru') {
      u.mult = m === 2 ? 3 : 2;
      u.multUses = m >= 1 ? 2 : 1;
      note = `接下来 ${u.multUses} 次 ×${u.mult}`;
    } else if (key === 'xian') {
      if (m === 2) { u.atk *= 2; u.maxHp *= 2; u.hp *= 2; note = '攻/血翻倍'; }
      else if (m === 1) { u.atk *= 2; note = '攻翻倍，免生命减半'; }
      else { u.atk *= 2; u.maxHp = Math.max(1, Math.ceil(u.maxHp / 2)); u.hp = Math.min(u.hp, u.maxHp); note = '攻翻倍，血减半'; }
    } else if (key === 'zhi') {
      const e = unitAt(g, extraKey);
      const turns = m === 2 ? 5 : 3;
      e.attackBan = turns; e.banTurns = turns;
      if (m >= 1) e.skillBan = turns;
      note = `敌「${e.card.name}」${turns} 回合内下次攻击失效${m >= 1 ? '、技能失效' : ''}`;
    } else if (key === 'chengzai') {
      const old = u.equip;
      const nw = WEAPON_BY_KEY[extraKey];
      const keepAtk = m >= 1 && old ? old.atk : 0;
      const keepHp = m >= 1 && old ? old.hp : 0;
      removeEquipStats(u, old);
      applyEquip(g, u, nw);
      if (keepAtk) u.atk += keepAtk;
      if (keepHp) { u.maxHp += keepHp; u.hp += keepHp; }
      if (m === 2 && nw.hp < 0) { u.maxHp -= nw.hp; u.hp -= nw.hp; }
      const wi = p.weapons.indexOf(extraKey);
      if (wi >= 0) p.weapons.splice(wi, 1);
      if (old) p.weapons.push(old.key);
      note = `换装「${nw.name}」${m >= 1 ? '（保留旧装备攻/血）' : ''}${m === 2 ? '（去掉减益）' : ''}`;
    }
    p.skillUsed[key] = true;
    g.skillLeft--;
    log(g, pid, 'skill', `${p.name} 对「${u.card.name}」施「${sk.name}」（匹配 ${m}/2）：${note}`);
    if (u.hp <= 0) killUnit(g, u, '技能');
    checkEnd(g);
    return { ok: true, m };
  }

  function endTurn(g) {
    if (g.over) return { ok: false };
    const p = g.players[g.turn];
    log(g, p.id, 'end', `${p.name} 结束本手`);
    g.turn = other(g.turn);
    if (g.turn === g.first) {
      if (g.month >= 12) { endYear(g); return { ok: true }; }
      g.round++;
      g.month++;
      g.termIdx = (g.month - 1) % 12;
      g.term = TERMS[g.termIdx];
      log(g, -1, 'month', `第 ${g.year} 年 · ${g.month} 月 · ${g.term.name}/${g.term.zhong} · ${D.SEATS[g.humanSeat].text}`);
      log(g, -1, 'weather', `天时：${g.term.desc}`);
      applyTerm(g);
      if (g.over) return { ok: true };
    }
    startTurn(g);
    return { ok: true };
  }

  function endYear(g) {
    if (g.over) return;
    const r0 = remaining(g.players[0]), r1 = remaining(g.players[1]);
    const b0 = ownUnits(g, 0).length, b1 = ownUnits(g, 1).length;
    const hp0 = ownUnits(g, 0).reduce((a, k) => a + unitAt(g, k).hp, 0);
    const hp1 = ownUnits(g, 1).reduce((a, k) => a + unitAt(g, k).hp, 0);
    let winner = null;
    if (r0 !== r1) winner = r0 > r1 ? 0 : 1;
    else if (b0 !== b1) winner = b0 > b1 ? 0 : 1;
    else if (hp0 !== hp1) winner = hp0 > hp1 ? 0 : 1;
    else winner = g.first;
    g.over = true; g.winner = winner;
    log(g, -1, 'end', `一年十二建终 · 余牌 ${r0} : ${r1} · ${g.players[winner].name} 胜`);
  }

  function checkEnd(g) {
    if (g.over) return;
    for (const p of g.players) {
      if (p.dead.length >= TOTAL) {
        g.over = true;
        g.winner = other(p.id);
        log(g, -1, 'end', `${p.name} 的 32 张人物牌全部失去 · ${g.players[g.winner].name} 胜`);
        return;
      }
    }
  }

  function validSlots(g, pid, cardId) {
    const out = [];
    for (const k of RING) if (!g.board[k] && g.players[pid].cardState[cardId] === 'hand') out.push(k);
    return out;
  }
  function attackTargets(g, pid, fromKey) {
    const u = unitAt(g, fromKey);
    if (!u || u.owner !== pid) return [];
    return RING.filter(k => {
      const t = unitAt(g, k);
      return t && t.owner !== pid && ringDist(fromKey, k) <= u.range;
    });
  }
  function ownUnits(g, pid) { return RING.filter(k => { const u = unitAt(g, k); return u && u.owner === pid; }); }

  window.Engine = {
    HUMAN, FOE, TOTAL, RING, TRIGRAMS, CARDS, WEAPONS, SKILLS, TERMS,
    newGame, startTurn, endTurn, endYear, place, attack, equip, useSkill, skillValid, skillMatches,
    placement, validSlots, attackTargets, ownUnits, unitAt, slotOf, ringDist, adjacent,
    viewOrder, viewIndex, seatSlot, farSlot, firstPlayer, other, remaining,
    monthElement, checkEnd, killUnit, log, byId, applyTerm,
  };
})();
