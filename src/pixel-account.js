/* 本地账号 + 仙丹图鉴 + 胜 AI 奖励（localStorage；真正 PvP 需要服务器） */
(function () {
  const DB_KEY = 'bagua.accounts.v1';
  const SESSION_KEY = 'bagua.session.v1';
  const PENDING_KEY = 'bagua.pending.v1';
  const ELIXIRS = window.ELIXIRS || [];
  const byId = new Map(ELIXIRS.map(e => [e.id, e]));
  const btn = document.getElementById('btnAccount');
  let accountModal = null, accountPanel = null, rewardModal = null, rewardPanel = null;
  let loginMode = 'login';
  let lastAward = 0;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  function db() { return readJson(DB_KEY, {}); }
  function saveDb(v) { writeJson(DB_KEY, v); }
  function sessionName() { try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } }
  function setSession(name) {
    try { if (name) localStorage.setItem(SESSION_KEY, name); else localStorage.removeItem(SESSION_KEY); } catch {}
  }
  function account() {
    const name = sessionName();
    if (!name) return null;
    const a = db()[name];
    return a ? Object.assign({ name }, a) : null;
  }
  function persistAccount(a) {
    const all = db();
    all[a.name] = { hash: a.hash, elixirs: a.elixirs || {}, wins: a.wins || 0, created: a.created || Date.now() };
    saveDb(all);
  }
  async function hashPass(s) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'fnv' + (h >>> 0).toString(16);
  }

  function updateButton() {
    if (!btn) return;
    const a = account();
    btn.textContent = a ? a.name.slice(0, 4) : '账号';
    btn.title = a ? ('道号：' + a.name) : '登录后胜 AI 可得仙丹';
  }

  function build() {
    accountModal = document.createElement('div');
    accountModal.className = 'px-modal';
    accountModal.innerHTML = '<div class="px-panel" id="pxAccountPanel"></div>';
    document.getElementById('app').appendChild(accountModal);
    accountPanel = document.getElementById('pxAccountPanel');

    rewardModal = document.createElement('div');
    rewardModal.className = 'px-modal';
    rewardModal.innerHTML = '<div class="px-panel px-reward" id="pxRewardPanel"></div>';
    document.getElementById('app').appendChild(rewardModal);
    rewardPanel = document.getElementById('pxRewardPanel');

    accountModal.addEventListener('click', e => { if (e.target === accountModal) closeAccount(); });
    rewardModal.addEventListener('click', e => { if (e.target === rewardModal) closeReward(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeAccount(); closeReward(); } });
    if (btn) btn.addEventListener('click', () => account() ? openAccount() : openLogin());
    updateButton();
  }

  function openLogin() {
    loginMode = 'login';
    accountModal.classList.add('show');
    renderLogin();
  }
  function openAccount() {
    accountModal.classList.add('show');
    if (account()) renderProfile(); else renderLogin();
  }
  function closeAccount() { if (accountModal) accountModal.classList.remove('show'); }
  function closeReward() { if (rewardModal) rewardModal.classList.remove('show'); }

  function renderLogin() {
    if (!accountPanel) return;
    const login = loginMode === 'login';
    accountPanel.innerHTML = `
      <h2>道号 · 账号</h2>
      <p>本地账号，只保存在这台设备；换设备不同步。真正 PvP 需要服务器账号。</p>
      <div class="px-tabs">
        <button data-mode="login" class="${login ? 'sel' : ''}">登录</button>
        <button data-mode="reg" class="${login ? '' : 'sel'}">注册</button>
      </div>
      <div class="px-field"><label>道号</label><input id="pxName" maxlength="12" autocomplete="off" placeholder="1-12 个字"></div>
      <div class="px-field"><label>口令</label><input id="pxPass" type="password" maxlength="32" autocomplete="off" placeholder="至少 4 位"></div>
      <div class="px-msg" id="pxMsg"></div>
      <div style="display:flex;gap:6px">
        <button class="px-btn primary" id="pxGo">${login ? '进入' : '创建账号'}</button>
        <button class="px-btn" id="pxCloseLogin">关闭</button>
      </div>
      <p>胜 AI 后随机获得 1 枚像素仙丹；重复样式会累计数量。</p>`;
    accountPanel.querySelectorAll('.px-tabs button').forEach(b => b.addEventListener('click', () => {
      loginMode = b.dataset.mode;
      renderLogin();
    }));
    document.getElementById('pxCloseLogin').addEventListener('click', closeAccount);
    document.getElementById('pxGo').addEventListener('click', async () => {
      const name = (document.getElementById('pxName').value || '').trim();
      const pass = document.getElementById('pxPass').value || '';
      const msg = document.getElementById('pxMsg');
      if (name.length < 1 || name.length > 12) { msg.textContent = '道号要 1-12 个字'; return; }
      if (pass.length < 4) { msg.textContent = '口令至少 4 位'; return; }
      const all = db();
      if (loginMode === 'reg' && all[name]) { msg.textContent = '这个道号已存在'; return; }
      if (loginMode === 'login' && !all[name]) { msg.textContent = '道号不存在，先注册'; return; }
      const h = await hashPass(pass);
      if (loginMode === 'reg') {
        all[name] = { hash: h, elixirs: {}, wins: 0, created: Date.now() };
        saveDb(all);
      } else if (all[name].hash !== h) {
        msg.textContent = '口令不对'; return;
      }
      setSession(name);
      updateButton();
      document.dispatchEvent(new CustomEvent('bagua:account'));
      renderProfile();
      claimPending();
    });
    document.getElementById('pxPass').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pxGo').click();
    });
  }

  function exportSave() {
    const metas = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('bagua.meta.')) metas[k] = JSON.parse(localStorage.getItem(k) || 'null');
      }
    } catch {}
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      accounts: db(),
      session: sessionName(),
      weaponSkins: readJson('bagua.weaponSkins.v1', {}),
      metas,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bagua-save-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderWeaponSkins() {
    const defs = window.WEAPON_SKINS;
    const store = window.WeaponSkinStore;
    if (!defs || !store) return '';
    return `<h3 style="margin:14px 0 4px;font-size:13px;color:var(--px-gold)">武器皮肤</h3>
      <p style="margin:0 0 6px">纯外观，不改变攻防。当前选择会应用到对局里的武器卡。</p>
      <div class="px-skins">
        ${Object.entries(defs).map(([key, def]) => {
          const cur = store.get(key);
          return `<div class="px-skinrow">
            <b>${def.name}</b>
            ${def.skins.map((label, i) => `<button class="px-skinopt ${i === cur ? 'sel' : ''}" data-wk="${key}" data-skin="${i}" title="${def.name} · ${label}">
              <img src="assets/pixel/weapons/${key}_${i}.png" alt="${label}" loading="lazy" decoding="async">
              <span>${label}</span>
            </button>`).join('')}
          </div>`;
        }).join('')}
      </div>`;
  }

  function renderProfile() {
    const a = account();
    if (!a) { renderLogin(); return; }
    const total = Object.values(a.elixirs || {}).reduce((x, y) => x + y, 0);
    const owned = Object.keys(a.elixirs || {}).length;
    accountPanel.innerHTML = `
      <h2>丹房 · ${a.name}</h2>
      <div class="px-profile">
        <div><b>${a.name}</b><br><span>胜 AI ${a.wins || 0} 次 · 仙丹 ${total} 枚 · 图鉴 ${owned}/${ELIXIRS.length}</span></div>
        <button class="px-btn" id="pxLogout">登出</button>
      </div>
      <p>重复获得同款仙丹会累计数量；仙丹只做收藏，不影响对局数值。</p>
      <div class="px-grid">
        ${ELIXIRS.map(e => {
          const n = (a.elixirs && a.elixirs[e.id]) || 0;
          return `<div class="px-elixir ${n ? 'owned' : 'none'}" title="${e.name} · ${e.rarity}品 · ${n ? n + ' 枚' : '未获得'}">
            <img src="${e.file}" alt="${e.name}" loading="lazy" decoding="async">
            ${n ? `<em>${n > 1 ? n : ''}</em>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${renderWeaponSkins()}
      <div class="px-savebtns">
        <button class="px-btn" id="pxExport">导出存档</button>
        <button class="px-btn" id="pxImport">导入存档</button>
        <input type="file" id="pxImportFile" accept=".json,application/json" hidden>
      </div>
      <p class="px-savehint">存档在浏览器 localStorage：刷新、更新代码不会清空；换设备/换域名请先导出。</p>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="px-btn" id="pxCloseProfile">关闭</button>
      </div>`;
    accountPanel.querySelectorAll('.px-skinopt').forEach(b => b.addEventListener('click', () => {
      if (window.WeaponSkinStore) window.WeaponSkinStore.set(b.dataset.wk, +b.dataset.skin);
      renderProfile();
    }));
    document.getElementById('pxExport').addEventListener('click', exportSave);
    const importBtn = document.getElementById('pxImport');
    const importFile = document.getElementById('pxImportFile');
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
      const f = importFile.files && importFile.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data.accounts !== 'object') throw new Error('缺少 accounts');
          if (!confirm('导入会覆盖本机现有账号与仙丹存档，确定继续？')) return;
          writeJson(DB_KEY, data.accounts);
          if (data.session) setSession(data.session); else setSession('');
          if (data.weaponSkins) writeJson('bagua.weaponSkins.v1', data.weaponSkins);
          if (data.metas && typeof data.metas === 'object') {
            Object.entries(data.metas).forEach(([k, v]) => {
              if (k.startsWith('bagua.meta.') && v) writeJson(k, v);
            });
          }
          location.reload();
        } catch (err) {
          alert('存档文件无法识别：' + err.message);
        }
      };
      reader.readAsText(f);
    });
    document.getElementById('pxLogout').addEventListener('click', () => {
      setSession('');
      updateButton();
      document.dispatchEvent(new CustomEvent('bagua:account'));
      loginMode = 'login';
      renderLogin();
    });
    document.getElementById('pxCloseProfile').addEventListener('click', closeAccount);
  }

  function pickElixir() {
    if (!ELIXIRS.length) return null;
    return ELIXIRS[Math.floor(Math.random() * ELIXIRS.length)];
  }

  function addElixir(a, e) {
    const all = db();
    const rec = all[a.name];
    if (!rec) return 0;
    rec.elixirs = rec.elixirs || {};
    rec.elixirs[e.id] = (rec.elixirs[e.id] || 0) + 1;
    rec.wins = (rec.wins || 0) + 1;
    saveDb(all);
    updateButton();
    return rec.elixirs[e.id];
  }

  function claimPending() {
    const a = account();
    const pending = readJson(PENDING_KEY, null);
    if (!a || !pending) return;
    const e = byId.get(pending.id);
    if (!e) { writeJson(PENDING_KEY, null); return; }
    writeJson(PENDING_KEY, null);
    addElixir(a, e);
    showReward(e, false);
  }

  function showReward(e, guest) {
    if (!e || !rewardPanel) return;
    const a = account();
    const n = a && a.elixirs ? (a.elixirs[e.id] || 0) : 0;
    rewardPanel.innerHTML = `
      <div class="px-reward">
        <div class="kick" style="color:var(--px-gold);font-size:9px;letter-spacing:.16em">${guest ? '战利品 · 待领取' : '战利品 · 已入丹房'}</div>
        <h2>${guest ? '仙丹已备好' : '获得仙丹'}</h2>
        <img src="${e.file}" alt="${e.name}">
        <div class="rname">${e.name}</div>
        <div class="rrar">${e.rarity}品${a ? ` · 第 ${n} 枚` : ''}</div>
        <p>${guest ? '登录道号后，这枚仙丹会进入你的丹房；不登录也能继续玩。' : '已收入丹房。重复样式会累计数量。'}</p>
        <div class="px-btns">
          ${guest ? '<button class="px-btn primary" id="pxGoLogin">登录领取</button>' : ''}
          <button class="px-btn" id="pxRewardClose">${guest ? '稍后' : '收下'}</button>
          ${a ? '<button class="px-btn" id="pxOpenCollection">看图鉴</button>' : ''}
        </div>
      </div>`;
    rewardModal.classList.add('show');
    if (window.PixelSFX) PixelSFX.play('reward');
    const close = document.getElementById('pxRewardClose');
    if (close) close.addEventListener('click', closeReward);
    const go = document.getElementById('pxGoLogin');
    if (go) go.addEventListener('click', () => { closeReward(); openLogin(); });
    const coll = document.getElementById('pxOpenCollection');
    if (coll) coll.addEventListener('click', () => { closeReward(); openAccount(); });
  }

  function onWin() {
    if (!ELIXIRS.length) return;
    if (Date.now() - lastAward < 800) return;
    lastAward = Date.now();
    const e = pickElixir();
    const a = account();
    if (!a) {
      writeJson(PENDING_KEY, { id: e.id });
      showReward(e, true);
      return;
    }
    addElixir(a, e);
    showReward(e, false);
  }

  document.addEventListener('bagua:result', e => {
    if (e.detail && e.detail.win) onWin();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
