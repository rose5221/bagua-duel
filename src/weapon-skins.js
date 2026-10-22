/* 武器皮肤：8 把武器 × 3 套皮肤；本机保存，纯外观 */
(function () {
  const KEY = 'bagua.weaponSkins.v1';
  const DEFS = {
    dao: { name: '刀', skins: ['墨', '赤', '青'] },
    jian: { name: '剑', skins: ['墨', '赤', '青'] },
    fu: { name: '斧', skins: ['墨', '赤', '青'] },
    qiang: { name: '长枪', skins: ['墨', '赤', '青'] },
    tiedun: { name: '铁盾', skins: ['墨', '赤', '青'] },
    gangdun: { name: '钢盾', skins: ['墨', '赤', '青'] },
    gong: { name: '弓', skins: ['墨', '赤', '青'] },
    nu: { name: '弩', skins: ['墨', '赤', '青'] },
  };
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
  }
  function get(key) {
    const v = read()[key];
    return Number.isInteger(v) ? Math.max(0, Math.min(2, v)) : 0;
  }
  function icon(key) { return `assets/pixel/weapons/${key}_${get(key)}.png`; }
  function set(key, index) {
    const now = read();
    now[key] = Math.max(0, Math.min(2, index | 0));
    write(now);
    document.dispatchEvent(new CustomEvent('bagua:skins', { detail: { key, index: now[key] } }));
  }
  window.WEAPON_SKINS = DEFS;
  window.WeaponSkinStore = { get, icon, set, defs: DEFS };
})();
