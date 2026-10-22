/* 八卦弈魂 · 局外存档（角色解锁 / 三魂七魄 / 多局进度）
   存储按账号道号隔离；未登录用 guest。只写 localStorage，不发服务器。 */
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
    for (const k of HUN_KEYS) out[k] = { lost: false, pseudo: false, left: 0 };
    return out;
  }
  function freshPos() {
    const out = {};
    for (const k of PO_KEYS) out[k] = { lost: false, pseudo: false, left: 0 };
    return out;
  }
  function freshRun() {
    return {
      active: true, round: 1, locked: false, character: 'daotong',
      souls: freshSouls(), pos: freshPos(),
      sacrifices: 0, usedSacrificeAttrs: [], lastAttrs: [],
      lastResult: null,
    };
  }
  function defaults() {
    return {
      version: 2,
      character: 'daotong',
      unlocked: { daotong: true, qingfeng: true, pangmen: true, chier: false },
      oldYinStreak: 0,
      run: freshRun(),
    };
  }
  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = Object.assign({}, base, saved);
    out.unlocked = Object.assign({}, base.unlocked, saved.unlocked || {});
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
    s.lost = true; s.pseudo = false; s.left = cache.character === 'chier' ? 4 : 3;
    save();
    return true;
  }
  function losePos(key) {
    const p = cache.run.pos[key];
    if (!p || p.lost) return false;
    p.lost = true; p.pseudo = false; p.left = cache.character === 'chier' ? 3 : 2;
    save();
    return true;
  }
  function gainPseudoPos(key) {
    const p = cache.run.pos[key];
    if (!p || !p.lost || p.pseudo) return false;
    p.pseudo = true; p.left = 0;
    save();
    return true;
  }
  function markPseudoPos(key) {
    const p = cache.run.pos[key];
    if (!p || p.pseudo) return false;
    p.lost = true; p.pseudo = true; p.left = 0;
    save();
    return true;
  }
  function sacrifice(attr) {
    if (!attr) return false;
    const used = cache.run.usedSacrificeAttrs.filter(a => a === attr).length;
    if (used >= 2) return false;
    cache.run.usedSacrificeAttrs.push(attr);
    cache.run.sacrifices++;
    save();
    return true;
  }
  function makePseudoSoul(key) {
    const s = cache.run.souls[key];
    if (!s || !s.lost || s.pseudo || cache.run.sacrifices < 2) return false;
    s.pseudo = true; s.left = 0;
    save();
    return true;
  }
  function makePseudoPos(key) {
    const p = cache.run.pos[key];
    if (!p || !p.lost || p.pseudo || cache.run.sacrifices < 1) return false;
    p.pseudo = true; p.left = 0;
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
    if (s.tian && s.tian.lost && !s.tian.pseudo) mods.entranceAtkPct += s.tian.left > 0 ? .5 : -.5;
    if (s.di && s.di.lost && !s.di.pseudo) {
      if (s.di.left > 0) mods.extraAttackChance += .3;
      else mods.missChance += .2;
    }
    if (s.ren && s.ren.lost && !s.ren.pseudo) mods.entranceHpPct += s.ren.left > 0 ? .3 : -.3;
    const p = cache.run.pos;
    if (p.shigou && p.shigou.lost && !p.shigou.pseudo) mods.shieldBonus += p.shigou.left > 0 ? 1 : -1;
    if (p.fushi && p.fushi.lost && !p.fushi.pseudo) mods.regen += p.fushi.left > 0 ? 1 : -1;
    if (p.queyin && p.queyin.lost && !p.queyin.pseudo) mods.forcedSeat = p.queyin.left > 0 ? 'N' : 'S';
    if (p.tunzei && p.tunzei.lost && !p.tunzei.pseudo && p.tunzei.left > 0) mods.firstImmune = true;
    if (p.feidu && p.feidu.lost && !p.feidu.pseudo) {
      if (p.feidu.left > 0) mods.poisonOnHit = true;
      else mods.poisonEvery2 = true;
    }
    if (p.chuhui && p.chuhui.lost && !p.chuhui.pseudo) mods.damageDealt += p.chuhui.left > 0 ? 1 : -1;
    if (p.choufei && p.choufei.lost && !p.choufei.pseudo) {
      const n = p.choufei.left > 0 ? 2 : -2;
      mods.entranceAtk += n; mods.entranceHp += n;
    }
    if (cache.run.sacrifices >= 6) {
      mods.entranceAtkPct -= .2; mods.entranceHpPct -= .2;
    } else if (cache.run.sacrifices >= 4) {
      mods.entranceAtkPct -= .1; mods.entranceHpPct -= .1;
    }
    return mods;
  }
  function failRun() {
    cache.run.active = false;
    save();
  }
  function startNextRound() {
    cache.run.round++;
    for (const k of HUN_KEYS) {
      const s = cache.run.souls[k];
      if (s.lost && !s.pseudo && s.left > 0) s.left--;
    }
    for (const k of PO_KEYS) {
      const p = cache.run.pos[k];
      if (p.lost && !p.pseudo && p.left > 0) p.left--;
    }
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
    selectCharacter, recordDivine, lockCharacter,
    aliveHuns, alivePos, loseHun, losePos, gainPseudoPos, markPseudoPos, sacrifice, makePseudoSoul, makePseudoPos,
    gameMods, failRun, startNextRound, resetRun,
    accountName, storageKey,
  };

  document.addEventListener('bagua:account', () => { cache = read(); });
})();
