/* 八卦弈魂 · 本地存档（角色解锁 / 关卡进度 / 关卡内三魂七魄临时状态）
   三魂七魄每关重置；人物、关卡进度、仙丹跨关保留。只写 localStorage，不发服务器。 */
(function () {
  'use strict';
  const D = window.DATA;
  const PREFIX = 'bagua.meta.v2.';
  const HUN_KEYS = (D.HUNS || []).map(x => x.key);
  const PO_KEYS = (D.POS || []).map(x => x.key);

  function accountName() {
    try { return localStorage.getItem('bagua.session.v1') || 'guest'; } catch { return 'guest'; }
  }
  function storageKey() { return PREFIX + accountName(); }

  function freshSouls() {
    const out = {};
    for (const k of HUN_KEYS) out[k] = { lost: false, pseudo: false, left: 0, delay: 0, justLost: false };
    return out;
  }
  function freshPos() {
    const out = {};
    for (const k of PO_KEYS) out[k] = { lost: false, pseudo: false, left: 0, delay: 0, justLost: false };
    return out;
  }
  function freshRun() {
    return {
      active: true, round: 1, locked: false, character: 'daotong',
      souls: freshSouls(), pos: freshPos(),
      sacrifices: 0, sacrificeCredits: 0, usedSacrificeAttrs: [], lastAttrs: [],
      cooldowns: {}, usedThisMatch: [],
      levelProgress: null,
      lastResult: null,
    };
  }
  function defaults() {
    return {
      version: 2,
      character: 'daotong',
      unlocked: { daotong: true, qingfeng: true, pangmen: true, chier: false },
      oldYinStreak: 0,
      campaign: { unlocked: 1, cleared: [] },
      run: freshRun(),
    };
  }
  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = Object.assign({}, base, saved);
    out.unlocked = Object.assign({}, base.unlocked, saved.unlocked || {});
    out.campaign = Object.assign({}, base.campaign, saved.campaign || {});
    out.run = Object.assign({}, base.run, saved.run || {});
    out.run.souls = Object.assign({}, base.run.souls, (saved.run && saved.run.souls) || {});
    out.run.pos = Object.assign({}, base.run.pos, (saved.run && saved.run.pos) || {});
    return out;
  }
  function read() {
    try {
      const raw = localStorage.getItem(storageKey());
      return merge(defaults(), raw ? JSON.parse(raw) : null);
    } catch { return defaults(); }
  }
  function write(m) {
    try { localStorage.setItem(storageKey(), JSON.stringify(m)); return true; } catch { return false; }
  }

  let cache = read();

  function get() { return cache; }
  function save() { write(cache); return cache; }
  function reload() { cache = read(); return cache; }

  function unlocked(key) {
    return key === 'daotong' ? true : !!cache.unlocked[key];
  }
  function characterOpen(key) {
    const def = (D.CHARACTERS || []).find(c => c.key === key);
    if (!def) return false;
    if (key === 'chier') return unlocked('chier');
    return def.open !== false;
  }
  function characterTag(key) {
    if (key === 'chier' && !unlocked('chier')) return '未解锁';
    if (key === 'daotong') return '默认';
    return '可选';
  }
  function selectCharacter(key) {
    if (!characterOpen(key)) return false;
    if (cache.run.locked && cache.run.character && key !== cache.run.character) return false;
    cache.character = key;
    save();
    return true;
  }
  function lockCharacter(key) {
    if (!characterOpen(key)) return false;
    if (cache.run.locked && cache.run.character && key !== cache.run.character) return false;
    cache.run.locked = true;
    cache.run.character = key;
    cache.character = key;
    save();
    return true;
  }
  // 一关打完后开放换人；下一关开始时再锁回当前角色
  function unlockCharacter() {
    cache.run.locked = false;
    save();
    return true;
  }
  function recordDivine(type) {
    if (cache.character !== 'daotong') return { ok: true, unlocked: false, streak: cache.oldYinStreak };
    if (type === '老阴') {
      cache.oldYinStreak++;
      if (cache.oldYinStreak >= 3 && !cache.unlocked.chier) {
        cache.unlocked.chier = true;
        cache.oldYinStreak = 0;
        save();
        return { ok: true, unlocked: true, streak: 0 };
      }
    } else {
      cache.oldYinStreak = 0;
    }
    save();
    return { ok: true, unlocked: false, streak: cache.oldYinStreak };
  }
  function aliveHuns() {
    return HUN_KEYS.filter(k => !cache.run.souls[k].lost);
  }
  function alivePos() {
    return PO_KEYS.filter(k => !cache.run.pos[k].lost);
  }
  function loseHun(key) {
    const s = cache.run.souls[key];
    if (!s || s.lost) return false;
    s.lost = true; s.pseudo = false; s.left = cache.character === 'chier' ? 3 : 2; s.delay = cache.character === 'chier' ? 1 : 0; s.justLost = true;
    save();
    return true;
  }
  function losePos(key) {
    const p = cache.run.pos[key];
    if (!p || p.lost) return false;
    p.lost = true; p.pseudo = false; p.left = cache.character === 'chier' ? 4 : 3; p.delay = cache.character === 'chier' ? 1 : 0; p.justLost = true;
    save();
    return true;
  }
  function gainPseudoPos(key) {
    const p = cache.run.pos[key];
    if (!p || !p.lost || p.pseudo) return false;
    p.pseudo = true; p.left = 0; p.delay = 0; p.justLost = false;
    save();
    return true;
  }
  function markPseudoPos(key) {
    const p = cache.run.pos[key];
    if (!p || p.pseudo) return false;
    p.lost = true; p.pseudo = true; p.left = 0; p.delay = 0; p.justLost = false;
    save();
    return true;
  }
  function sacrifice(attr) {
    if (!attr || !canSacrifice(attr).ok) return false;
    cache.run.usedSacrificeAttrs.push(attr);
    cache.run.sacrifices++;
    cache.run.sacrificeCredits = (cache.run.sacrificeCredits || 0) + 1;
    save();
    return true;
  }
  function makePseudoSoul(key) {
    const s = cache.run.souls[key];
    if (!s || !s.lost || s.pseudo || (cache.run.sacrificeCredits || 0) < 2) return false;
    cache.run.sacrificeCredits -= 2;
    s.pseudo = true; s.left = 0; s.delay = 0; s.justLost = false;
    save();
    return true;
  }
  function makePseudoPos(key) {
    const p = cache.run.pos[key];
    if (!p || !p.lost || p.pseudo || (cache.run.sacrificeCredits || 0) < 1) return false;
    cache.run.sacrificeCredits -= 1;
    p.pseudo = true; p.left = 0; p.delay = 0; p.justLost = false;
    save();
    return true;
  }
  // 把已失魂/魄转成对局修正；left>0 为缓冲期增益，left<=0 为减益
  function gameMods() {
    const mods = {
      entranceAtkPct: 0, entranceHpPct: 0, entranceAtk: 0, entranceHp: 0,
      extraAttackChance: 0, missChance: 0, damageDealt: 0, damageTaken: 0,
      shieldBonus: 0, regen: 0, firstImmune: false, poisonOnHit: false,
      poisonEvery2: false, forcedSeat: '',
    };
    const s = cache.run.souls;
    const phase = st => st.left > 0 ? 'good' : (st.delay > 0 ? 'delay' : 'bad');
    if (s.tian && s.tian.lost && !s.tian.pseudo) {
      const ph = phase(s.tian);
      if (ph === 'good') mods.entranceAtkPct += .5;
      else if (ph === 'bad') mods.entranceAtkPct -= .5;
    }
    if (s.di && s.di.lost && !s.di.pseudo) {
      const ph = phase(s.di);
      if (ph === 'good') mods.extraAttackChance += .3;
      else if (ph === 'bad') mods.missChance += .2;
    }
    if (s.ren && s.ren.lost && !s.ren.pseudo) {
      const ph = phase(s.ren);
      if (ph === 'good') mods.entranceHpPct += .3;
      else if (ph === 'bad') mods.entranceHpPct -= .3;
    }
    const p = cache.run.pos;
    if (p.shigou && p.shigou.lost && !p.shigou.pseudo) {
      const ph = phase(p.shigou);
      if (ph === 'good') mods.shieldBonus += 1;
      else if (ph === 'bad') mods.shieldBonus -= 1;
    }
    if (p.fushi && p.fushi.lost && !p.fushi.pseudo) {
      const ph = phase(p.fushi);
      if (ph === 'good') mods.regen += 1;
      else if (ph === 'bad') mods.regen -= 1;
    }
    if (p.queyin && p.queyin.lost && !p.queyin.pseudo) {
      const ph = phase(p.queyin);
      if (ph === 'good') mods.forcedSeat = 'N';
      else if (ph === 'bad') mods.forcedSeat = 'S';
    }
    if (p.tunzei && p.tunzei.lost && !p.tunzei.pseudo && phase(p.tunzei) === 'good') mods.firstImmune = true;
    if (p.feidu && p.feidu.lost && !p.feidu.pseudo) {
      const ph = phase(p.feidu);
      if (ph === 'good') mods.poisonOnHit = true;
      else if (ph === 'bad') mods.poisonEvery2 = true;
    }
    if (p.chuhui && p.chuhui.lost && !p.chuhui.pseudo) {
      const ph = phase(p.chuhui);
      if (ph === 'good') mods.damageDealt += 1;
      else if (ph === 'bad') mods.damageDealt -= 1;
    }
    if (p.choufei && p.choufei.lost && !p.choufei.pseudo) {
      const ph = phase(p.choufei);
      if (ph === 'good') { mods.entranceAtk += 2; mods.entranceHp += 2; }
      else if (ph === 'bad') { mods.entranceAtk -= 2; mods.entranceHp -= 2; }
    }
    if (cache.run.sacrifices >= 6) {
      mods.entranceAtkPct -= .2; mods.entranceHpPct -= .2;
    } else if (cache.run.sacrifices >= 4) {
      mods.entranceAtkPct -= .1; mods.entranceHpPct -= .1;
    }
    return mods;
  }
  function campaign() { return cache.campaign || (cache.campaign = { unlocked: 1, cleared: [] }); }
  function levelUnlocked(i) { return i < campaign().unlocked; }
  function clearLevel(i) {
    const c = campaign();
    if (!c.cleared.includes(i)) c.cleared.push(i);
    c.unlocked = Math.max(c.unlocked, Math.min(9, i + 2));
    save();
  }
  function cooldown(key) { return cache.run.cooldowns && cache.run.cooldowns[key] || 0; }
  function settleMatch(used) {
    const u = Array.isArray(used) ? used : [];
    const all = HUN_KEYS.concat(PO_KEYS);
    cache.run.cooldowns = cache.run.cooldowns || {};
    for (const key of all) {
      if (u.includes(key)) cache.run.cooldowns[key] = 1;
      else if (cache.run.cooldowns[key] > 0) cache.run.cooldowns[key]--;
    }
    cache.run.usedThisMatch = [];
    save();
  }
  function failRun() {
    cache.run.active = false;
    save();
  }
  // 每一关内部重新点亮 3 魂 7 魄；人物、关卡进度、仙丹不在此重置
  function resetLevelSouls() {
    cache.run.souls = freshSouls();
    cache.run.pos = freshPos();
    cache.run.sacrifices = 0;
    cache.run.sacrificeCredits = 0;
    cache.run.usedSacrificeAttrs = [];
    cache.run.lastAttrs = [];
    cache.run.cooldowns = {};
    cache.run.usedThisMatch = [];
    cache.run.round = 1;
    save();
    return cache.run;
  }
  function clearJustLost() {
    for (const k of HUN_KEYS) { const st = cache.run.souls[k]; if (st) st.justLost = false; }
    for (const k of PO_KEYS) { const st = cache.run.pos[k]; if (st) st.justLost = false; }
    save();
  }

  const MAX_SACRIFICES = 6; // 6 × 4 = 24 张
  function sacrificeNeed() {
    const lostH = HUN_KEYS.filter(k => cache.run.souls[k].lost && !cache.run.souls[k].pseudo).length;
    const lostP = PO_KEYS.filter(k => cache.run.pos[k].lost && !cache.run.pos[k].pseudo).length;
    return lostH * 2 + lostP;
  }
  function canSacrifice(attr) {
    if (cache.run.sacrifices >= MAX_SACRIFICES) return { ok: false, reason: 'max' };
    if ((cache.run.sacrificeCredits || 0) >= sacrificeNeed()) return { ok: false, reason: 'enough' };
    if (attr) {
      const used = cache.run.usedSacrificeAttrs.filter(a => a === attr).length;
      if (used >= 2) return { ok: false, reason: 'attr' };
    }
    return { ok: true };
  }
  function levelProgress() { return cache.run.levelProgress || null; }
  function saveLevelProgress(data) {
    if (!data) return null;
    cache.run.levelProgress = {
      active: true,
      level: Number(data.level) || 0,
      character: data.character || cache.character,
      match: Math.max(1, Number(data.match) || 1),
      foe: {
        h: Array.isArray(data.foe && data.foe.h) ? data.foe.h.slice() : HUN_KEYS.slice(),
        p: Array.isArray(data.foe && data.foe.p) ? data.foe.p.slice() : PO_KEYS.slice(),
      },
      savedAt: Date.now(),
    };
    save();
    return cache.run.levelProgress;
  }
  function clearLevelProgress() {
    cache.run.levelProgress = null;
    save();
  }
  function startNextRound() {
    cache.run.round++;
    const tick = st => {
      if (!st.lost || st.pseudo) return;
      if (st.justLost) { st.justLost = false; return; }
      if (st.left > 0) st.left--;
      else if (st.delay > 0) st.delay--;
    };
    for (const k of HUN_KEYS) tick(cache.run.souls[k]);
    for (const k of PO_KEYS) tick(cache.run.pos[k]);
    save();
    return cache.run.round;
  }
  function resetRun() {
    cache.run = freshRun();
    save();
    return cache.run;
  }

  window.Meta = {
    HUN_KEYS, PO_KEYS,
    get, save, reload, unlocked, characterOpen, characterTag,
    selectCharacter, recordDivine, lockCharacter, unlockCharacter,
    campaign, levelUnlocked, clearLevel, cooldown, settleMatch, aliveHuns, alivePos, loseHun, losePos, gainPseudoPos, markPseudoPos, sacrifice, makePseudoSoul, makePseudoPos,
    gameMods, failRun, startNextRound, resetLevelSouls, levelProgress, saveLevelProgress, clearLevelProgress, clearJustLost, MAX_SACRIFICES, sacrificeNeed, canSacrifice, resetRun,
    accountName, storageKey,
  };

  document.addEventListener('bagua:account', () => { cache = read(); });
})();
