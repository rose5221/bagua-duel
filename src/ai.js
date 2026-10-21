/* 八卦对决 · 简单 AI：先技能，再击杀/落子/装备/攻击 */
(function () {
  'use strict';
  const E = window.Engine;
  const D = window.DATA;

  function scorePlacement(card, slot, monthEl) {
    const b = E.placement(card, slot, monthEl);
    let s = b.atk * 2 + b.hp;
    if (card.roleElement === slot.element) s += 3;
    if (card.element === slot.element) s += 2;
    return s;
  }

  function bestPlacement(g, pid) {
    const p = g.players[pid];
    const empties = E.RING.filter(k => !g.board[k]);
    if (!empties.length) return null;
    let best = null;
    for (const cid of p.roster) {
      if (p.cardState[cid] !== 'hand') continue;
      const c = D.CARDS[cid];
      for (const k of empties) {
        let s = scorePlacement(c, D.TRIGRAMS[k], E.monthElement(g));
        for (const nk of E.adjacent(k)) {
          const nu = E.unitAt(g, nk);
          if (nu && nu.owner !== pid) s += 3;
        }
        if (!best || s > best.s) best = { cid, slot: k, s };
      }
    }
    return best;
  }

  function bestAttack(g, pid) {
    let best = null;
    for (const from of E.ownUnits(g, pid)) {
      const u = E.unitAt(g, from);
      for (const to of E.attackTargets(g, pid, from)) {
        const t = E.unitAt(g, to);
        const leathal = t.hp <= u.atk * (u.mult || 1) + t.shield;
        const s = (leathal ? 100 : 0) + (t.atk * 2 + t.hp) - (u.hp * 0.1);
        if (!best || s > best.s) best = { from, to, s };
      }
    }
    return best;
  }

  function bestEquip(g, pid) {
    const p = g.players[pid];
    if (!p.weapons.length) return null;
    const units = E.ownUnits(g, pid).map(k => E.unitAt(g, k)).filter(u => !u.equip);
    if (!units.length) return null;
    let best = null;
    for (const u of units) {
      for (const wk of p.weapons) {
        const w = D.WEAPON_BY_KEY[wk];
        const s = w.atk * 2 + w.hp + w.shield * 1.5 + (u.atk > 4 ? 1 : 0);
        if (!best || s > best.s) best = { wk, slot: u.slot, s };
      }
    }
    return best;
  }

  function skillChoice(g, pid) {
    const p = g.players[pid];
    if (p.skillLeft <= 0) return null;
    const units = E.ownUnits(g, pid).map(k => E.unitAt(g, k));
    if (!units.length) return null;
    const options = [];
    for (const u of units) {
      for (const sk of D.SKILLS) {
        if (p.skillUsed[sk.key]) continue;
        if (sk.key === 'zhi') {
          const enemies = E.RING.filter(k => {
            const e = E.unitAt(g, k);
            return e && e.owner !== pid && E.ringDist(u.slot, k) <= u.range;
          });
          if (!enemies.length) continue;
          const target = enemies.map(k => E.unitAt(g, k)).sort((a, b) => b.atk - a.atk)[0];
          options.push({ key: sk.key, slot: u.slot, extra: target.slot, score: 6 + target.atk });
        } else if (sk.key === 'chengzai') {
          if (!u.equip || !p.weapons.length) continue;
          options.push({ key: sk.key, slot: u.slot, extra: p.weapons[0], score: 3 });
        } else {
          let s = 0;
          const m = E.skillMatches(u, sk);
          if (sk.key === 'gangjian') s = 5 + m * 2 + u.atk * 0.2;
          else if (sk.key === 'koushe') s = 4 + m * 2;
          else if (sk.key === 'guangming') s = (u.maxHp - u.hp) * 2 + m * 2;
          else if (sk.key === 'dong') s = 5 + m;
          else if (sk.key === 'ru') s = 4 + u.atk * 0.4 + m;
          else if (sk.key === 'xian') s = u.hp > u.maxHp * 0.6 ? 4 + m : 1;
          if (s > 0) options.push({ key: sk.key, slot: u.slot, score: s });
        }
      }
    }
    if (!options.length) return null;
    options.sort((a, b) => b.score - a.score);
    return options[0];
  }

  function step(g, pid) {
    if (!g || g.over || g.turn !== pid) return { done: true };
    const p = g.players[pid];

    // 每手先用一次技能（技能不占主行动）
    if (!g.aiSkillTried && p.skillLeft > 0) {
      g.aiSkillTried = true;
      const sk = skillChoice(g, pid);
      if (sk) {
        const r = E.useSkill(g, pid, sk.key, sk.slot, sk.extra);
        if (r.ok) return { done: false, acted: 'skill' };
      }
    }

    if (g.actionsLeft > 0) {
      // 1. 能击杀就攻击
      const atk = bestAttack(g, pid);
      if (atk && atk.s >= 100) {
        const r = E.attack(g, pid, atk.from, atk.to);
        if (r.ok) return { done: false, acted: 'attack' };
      }
      // 2. 有目标就先打
      if (atk) {
        const r = E.attack(g, pid, atk.from, atk.to);
        if (r.ok) return { done: false, acted: 'attack' };
      }
      // 3. 落子
      const pl = bestPlacement(g, pid);
      if (pl) {
        const r = E.place(g, pid, pl.cid, pl.slot);
        if (r.ok) return { done: false, acted: 'place' };
      }
      // 4. 装备
      const eq = bestEquip(g, pid);
      if (eq) {
        const r = E.equip(g, pid, eq.wk, eq.slot);
        if (r.ok) return { done: false, acted: 'equip' };
      }
      // 没有动作可做
      if (g.over) return { done: true };
    }

    E.endTurn(g);
    return { done: true, ended: true };
  }

  window.AI = { step };
})();
