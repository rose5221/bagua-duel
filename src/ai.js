/* 八卦对决 · AI v2（简单 / 普通 / 困难） */
(function () {
  'use strict';
  const E = window.Engine;
  const D = window.DATA;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function unitValue(u) { return u.atk * 2 + u.hp + (u.weapon ? 4 : 0); }
  function placeScore(g, pid, card, slot) {
    const b = E.placement(card, D.TRIGRAMS[slot]);
    let s = b.atk * 2 + b.hp;
    if (card.roleElement === D.TRIGRAMS[slot].element) s += 4;
    if (card.element === D.TRIGRAMS[slot].element) s += 3;
    for (const k of E.adjacent(slot)) {
      const u = E.unitAt(g, k);
      if (u && u.owner !== pid) s += 3;
    }
    return s;
  }

  function placeOptions(g, pid) {
    if (g.placedThisTurn || E.ownUnits(g, pid).length >= E.BOARD_MAX) return [];
    const p = g.players[pid], out = [];
    for (const cid of p.hand) {
      if (p.cardState[cid] !== 'hand') continue;
      const card = D.CARDS[cid];
      for (const slot of E.RING) {
        if (g.board[slot]) continue;
        out.push({ cid, slot, score: placeScore(g, pid, card, slot) });
      }
    }
    return out;
  }

  function attackOptions(g, pid) {
    const out = [];
    for (const from of E.ownUnits(g, pid)) {
      const u = E.unitAt(g, from);
      if (!E.canUnitAct(g, pid, u)) continue;
      for (const to of E.attackTargets(g, pid, from)) {
        const t = E.unitAt(g, to);
        const dmg = Math.max(0, u.atk + u.fieldDmg + (D.ELEMENTS[u.card.element].over === t.card.element ? 1 : 0)) * (u.mult || 1);
        const after = Math.max(0, dmg - t.shield - t.fieldArmor + t.fieldVuln);
        const lethal = after >= t.hp;
        out.push({ from, to, lethal, score: (lethal ? 200 : 0) + (t.atk * 2 + t.hp * .3) + after * .5 });
      }
    }
    return out;
  }

  function equipOptions(g, pid) {
    const p = g.players[pid], out = [];
    if (!p.weapons.length) return out;
    for (const slot of E.equipTargets(g, pid)) {
      const u = E.unitAt(g, slot);
      for (const wk of p.weapons) {
        const w = D.WEAPON_BY_KEY[wk];
        let s = w.atk * 2 + w.hp + w.shield * 2 + (w.range > 1 ? 5 : 0);
        if (w.atk < 0) s -= 2;
        out.push({ slot, wk, score: s + (u.atk > 5 ? 2 : 0) });
      }
    }
    return out;
  }

  function moveOptions(g, pid) {
    const out = [];
    const enemies = E.RING.filter(k => { const u = E.unitAt(g, k); return u && u.owner !== pid; });
    for (const from of E.ownUnits(g, pid)) {
      const u = E.unitAt(g, from);
      if (!E.canUnitAct(g, pid, u)) continue;
      const cur = enemies.length ? Math.min(...enemies.map(k => E.ringDist(from, k))) : 9;
      for (const to of E.moveTargets(g, pid, from)) {
        const nxt = enemies.length ? Math.min(...enemies.map(k => E.ringDist(to, k))) : 9;
        let s = (cur - nxt) * 8 + 1;
        if (u.range > 1 && cur > u.range && nxt <= u.range) s += 5;
        out.push({ from, to, score: s });
      }
    }
    return out;
  }

  function skillOptions(g, pid) {
    const p = g.players[pid], out = [];
    if (g.skillsLeft <= 0 || Object.keys(g.skillsUsedThisTurn).length >= 2) return out;
    for (const slot of E.skillTargets(g, pid)) {
      const u = E.unitAt(g, slot);
      for (const sk of D.SKILLS) {
        if ((p.skillUses[sk.key] || 0) >= 2 || g.skillsUsedThisTurn[sk.key]) continue;
        const m = E.skillMatches(u, sk);
        let extra = null, s = 0;
        if (sk.key === 'zhi') {
          const targets = E.attackTargets(g, pid, slot);
          if (!targets.length) continue;
          const e = targets.map(k => E.unitAt(g, k)).sort((a, b) => b.atk - a.atk)[0];
          extra = e.slot; s = 8 + e.atk;
        } else if (sk.key === 'dong' && m === 2) {
          const ally = E.adjacent(slot).map(k => E.unitAt(g, k)).find(a => a && a.owner === pid);
          if (!ally) continue;
          extra = ally.slot; s = 8 + m;
        } else if (sk.key === 'chengzai') {
          if (!u.weapon || !p.weapons.length) continue;
          extra = p.weapons[0]; s = 4 + m;
        } else if (sk.key === 'gangjian') s = 7 + m * 2 + u.atk * .2;
        else if (sk.key === 'koushe') s = 6 + m * 2;
        else if (sk.key === 'guangming') s = (u.maxHp - u.hp) * .6 + m * 2;
        else if (sk.key === 'dong') s = 6 + m;
        else if (sk.key === 'ru') s = 5 + u.atk * .5 + m;
        else if (sk.key === 'xian') s = u.hp > u.maxHp * .55 ? 5 + m : 1;
        if (s > 0) out.push({ key: sk.key, slot, extra, score: s });
      }
    }
    return out;
  }

  function chooseSkill(g, pid, diff) {
    const opts = skillOptions(g, pid);
    if (!opts.length) return null;
    if (diff === 'easy') return Math.random() < .25 ? pick(opts) : null;
    opts.sort((a, b) => b.score - a.score);
    return diff === 'hard' ? opts[0] : (Math.random() < .75 ? opts[0] : null);
  }

  function chooseUnitAction(g, pid, diff) {
    const atk = attackOptions(g, pid), eq = equipOptions(g, pid), mv = moveOptions(g, pid);
    if (diff === 'easy') {
      const all = [];
      for (const a of atk) all.push({ type: 'attack', ...a });
      for (const e of eq) all.push({ type: 'equip', ...e });
      for (const m of mv) all.push({ type: 'move', ...m });
      return all.length ? pick(all) : null;
    }
    const bestAtk = atk.sort((a, b) => b.score - a.score)[0];
    if (bestAtk) return { type: 'attack', ...bestAtk };
    const bestEq = eq.sort((a, b) => b.score - a.score)[0];
    if (bestEq) return { type: 'equip', ...bestEq };
    const bestMv = mv.sort((a, b) => b.score - a.score)[0];
    if (bestMv) return { type: 'move', ...bestMv };
    return null;
  }

  function step(g, pid) {
    if (!g || g.over || g.turn !== pid) return { done: true };
    const diff = g.difficulty || 'normal';
    // 技能
    if (g.skillsLeft > 0) {
      const sk = chooseSkill(g, pid, diff);
      if (sk) {
        const r = E.useSkill(g, pid, sk.key, sk.slot, sk.extra);
        if (r.ok) return { done: false, acted: 'skill', key: sk.key };
      }
    }
    // 落子
    const places = placeOptions(g, pid);
    if (places.length) {
      places.sort((a, b) => b.score - a.score);
      const pl = diff === 'easy' ? pick(places) : places[0];
      const r = E.place(g, pid, pl.cid, pl.slot);
      if (r.ok) return { done: false, acted: 'place' };
    }
    // 单牌行动
    const act = chooseUnitAction(g, pid, diff);
    if (act) {
      let r;
      if (act.type === 'attack') r = E.attack(g, pid, act.from, act.to);
      else if (act.type === 'equip') r = E.equip(g, pid, act.wk, act.slot);
      else r = E.move(g, pid, act.from, act.to);
      if (r && r.ok) return { done: false, acted: act.type };
    }
    E.endTurn(g);
    return { done: true, ended: true };
  }

  window.AI = { step };
})();
