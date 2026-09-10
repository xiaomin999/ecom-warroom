/* 电商作战室 · 启动器：导航 / 路由 / 设置弹窗 / 移动端 */
(function () {
  const ECOM = window.ECOM;
  const nav = document.getElementById('nav');
  const bottomNav = document.getElementById('bottomNav');
  const head = document.getElementById('moduleHead');
  const body = document.getElementById('moduleBody');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');

  let activeId = null;

  /* ---------- 导航渲染 ---------- */
  // 按国内电商工作流排序：先看情报 → 再选品 → 再做内容 → 再上策略 → 最后全流程
  const GROUP_ORDER = ['市场情报', '选品', '内容', '策略', '一站式'];
  function renderNav() {
    const groups = [];
    const map = {};
    ECOM.modules.forEach(m => {
      const g = m.group || '其它';
      if (!map[g]) { map[g] = []; groups.push(g); }
      map[g].push(m);
    });
    groups.sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    nav.innerHTML = groups.map(g =>
      `<div class="nav-group">${g}</div>` +
      map[g].map(m => `<button class="nav-item" data-id="${m.id}"><span class="ni-icon">${m.icon}</span>${m.name}</button>`).join('')
    ).join('');

    // 底部：全部模块（横向滚动）
    bottomNav.innerHTML = ECOM.modules.map(m =>
      `<button class="bn-item" data-id="${m.id}"><span class="bn-icon">${m.icon}</span>${m.name}</button>`
    ).join('');

    nav.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => go(b.dataset.id)));
    bottomNav.querySelectorAll('.bn-item').forEach(b => b.addEventListener('click', () => go(b.dataset.id)));
  }

  /* ---------- 板块状态保留 ----------
     切换板块时不再销毁重建 DOM，而是把当前板块的节点整体移入缓存容器，
     切回时再移回来 —— 表单输入、生成结果、动态行、tab 状态、事件绑定全部保留。
     数据驱动型模块（选品库 / 作战流水线）每次进入需重渲染以显示最新数据，故排除。 */
  const viewCache = {};
  const REFRESH_ON_ENTER = new Set(['library', 'pipeline']);

  /* ---------- 草稿持久化：刷新页面后表单仍在 ----------
     表单型模块边输入边把字段值写入 localStorage；刷新后首次进入该模块时自动回填。
     数据驱动型模块（选品库 / 作战流水线）无表单草稿，排除。 */
  const DRAFT_KEY = id => 'ecom_draft_' + id;
  function collectFields(container) {
    const out = {};
    container.querySelectorAll('input, textarea, select').forEach(el => {
      if (!el.id) return;
      out[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    return out;
  }
  function saveDraft(id, container) {
    try { localStorage.setItem(DRAFT_KEY(id), JSON.stringify(collectFields(container))); } catch (e) {}
  }
  function restoreDraft(id, container) {
    let raw; try { raw = localStorage.getItem(DRAFT_KEY(id)); } catch (e) { return; }
    if (!raw) return;
    let data; try { data = JSON.parse(raw); } catch (e) { return; }
    Object.keys(data).forEach(fid => {
      const el = container.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(fid) : fid));
      if (!el) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!data[fid];
      else el.value = data[fid];
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  // 实时保存：边打字边存草稿（防止刷新丢失）
  let _draftTimer = null;
  function _autoSaveDraft() {
    if (!activeId || REFRESH_ON_ENTER.has(activeId)) return;
    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(() => saveDraft(activeId, body), 400);
  }
  body.addEventListener('input', _autoSaveDraft);
  body.addEventListener('change', _autoSaveDraft);
  // 刷新/关闭瞬间立即落盘，防止最后 400ms 内的输入丢失
  window.addEventListener('pagehide', () => { if (activeId && !REFRESH_ON_ENTER.has(activeId)) saveDraft(activeId, body); });

  function go(id) {
    const m = ECOM.modules.find(x => x.id === id);
    if (!m) return;
    // 离开当前板块前：先把表单草稿写入 localStorage（刷新后还能找回）
    if (activeId && !REFRESH_ON_ENTER.has(activeId)) saveDraft(activeId, body);
    // 收起当前板块：把 body 内的节点移入其缓存容器（保留 DOM、输入与事件）
    if (activeId) {
      const holder = viewCache[activeId] || (viewCache[activeId] = document.createElement('div'));
      while (body.firstChild) holder.appendChild(body.firstChild);
    }
    activeId = id;
    head.innerHTML = `<h1>${m.icon} ${m.name}</h1><p>${m.desc || ''}</p>`;
    if (viewCache[id] && !REFRESH_ON_ENTER.has(id)) {
      // 恢复已缓存的板块（不重建，原样保留一切）
      while (viewCache[id].firstChild) body.appendChild(viewCache[id].firstChild);
    } else {
      body.innerHTML = '';
      try { m.render(body); } catch (e) { body.innerHTML = '<div class="card">模块加载失败：' + (e.message || e) + '</div>'; console.error(e); }
      // 刷新后首次进入：回填上次保存的草稿
      if (!REFRESH_ON_ENTER.has(id)) restoreDraft(id, body);
    }
    nav.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    bottomNav.querySelectorAll('.bn-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    window.scrollTo(0, 0);
    closeSidebar();
  }

  /* ---------- 设置弹窗 ---------- */
  const modal = document.getElementById('settingsModal');
  const settingsBody = document.getElementById('settingsBody');
  function openSettings() {
    const s = ECOM.store.get();
    settingsBody.innerHTML = `
      <div class="field"><label>API Base URL<span class="hint">OpenAI 兼容，含 /v1</span></label>
        <input type="text" id="f_base" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" value="${s.baseUrl || ''}">
        <div class="hint" style="margin-top:4px">国内常用：通义 https://dashscope.aliyuncs.com/compatible-mode/v1 ｜ DeepSeek https://api.deepseek.com/v1 ｜ 智谱 https://open.bigmodel.cn/api/paas/v4</div></div>
      <div class="field"><label>API Key</label>
        <input type="password" id="f_key" placeholder="sk-..." value="${s.apiKey || ''}"></div>
      <div class="field"><label>模型名</label>
        <input type="text" id="f_model" placeholder="qwen-turbo / deepseek-chat" value="${s.model || 'qwen-turbo'}"></div>
      <div class="field"><label class="hint" style="font-weight:600">↓ 服务端代理（解决 CORS / 隐藏 Key，部署为 Node 应用时用）</label>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="f_proxy" ${s.useProxy ? 'checked' : ''} style="width:auto"> 启用代理（请求发往 /api/llm，Key 由服务端环境变量保管）</label>
        <div class="hint" style="margin-top:4px">勾选后，浏览器不再携带你的 Key，由服务端 /api/llm 转发（需 server 环境变量 LLM_BASE_URL / LLM_API_KEY）。此时上方 Base/Key 可留空。</div></div>
      <div class="btn-row" style="margin:4px 0 14px">
        <button class="secondary-btn" id="f_test" style="padding:8px 14px">🔌 测试连接</button>
        <span class="hint" style="margin:0">填好或勾选代理后点此，会真实发起一次最小调用验证。</span>
      </div>
      <hr style="border:none;border-top:1px solid var(--line);margin:6px 0 14px">
      <div class="field"><label>图像 API Base URL<span class="hint">可选，用于「做图」出图</span></label>
        <input type="text" id="f_ibase" placeholder="https://api.openai.com/v1" value="${s.imageBaseUrl || ''}"></div>
      <div class="field"><label>图像 API Key<span class="hint">可选</span></label>
        <input type="password" id="f_ikey" placeholder="sk-..." value="${s.imageApiKey || ''}"></div>
      <div class="field"><label>图像模型</label>
        <input type="text" id="f_imodel" placeholder="dall-e-3" value="${s.imageModel || 'dall-e-3'}"></div>`;
    document.getElementById('f_test').addEventListener('click', testConn);
    modal.hidden = false;
  }
  function closeSettings() { modal.hidden = true; }
  function saveSettings() {
    ECOM.store.set({
      baseUrl: document.getElementById('f_base').value.trim(),
      apiKey: document.getElementById('f_key').value.trim(),
      model: document.getElementById('f_model').value.trim() || 'qwen-turbo',
      useProxy: document.getElementById('f_proxy').checked,
      imageBaseUrl: document.getElementById('f_ibase').value.trim(),
      imageApiKey: document.getElementById('f_ikey').value.trim(),
      imageModel: document.getElementById('f_imodel').value.trim() || 'dall-e-3'
    });
    closeSettings();
    refreshConn();
    ECOM.ui.toast('设置已保存');
  }
  async function testConn() {
    const base = document.getElementById('f_base').value.trim();
    const key = document.getElementById('f_key').value.trim();
    const model = document.getElementById('f_model').value.trim() || 'qwen-turbo';
    const proxy = document.getElementById('f_proxy').checked;
    const btn = document.getElementById('f_test');
    if (!proxy && (!base || !key)) { ECOM.ui.toast('请先填写 API Base / Key，或勾选代理'); return; }
    await ECOM.ui.run(btn, async () => {
      if (proxy) {
        const r = await fetch('/api/health');
        const d = await r.json().catch(() => ({}));
        if (!(d && d.ok)) throw new Error('代理服务不可达（server.js 是否启动 / 已部署？）');
        if (!d.llmConfigured) throw new Error('代理已连，但服务端未配置 LLM 密钥（检查 server 环境变量 LLM_BASE_URL / LLM_API_KEY）');
      }
      const txt = await ECOM.llm([ECOM.msg('user', '只回复两个字：ok')], {
        useProxy: proxy, direct: false,
        baseUrl: proxy ? '' : base, apiKey: proxy ? '' : key, model
      });
      if (!txt || !txt.trim()) throw new Error('模型返回为空');
      ECOM.ui.toast('✓ 连接成功：' + txt.slice(0, 24));
    });
  }

  document.getElementById('openSettings').addEventListener('click', openSettings);
  document.getElementById('openSettings2').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  modal.addEventListener('click', e => { if (e.target === modal) closeSettings(); });

  /* ---------- 连接状态 ---------- */
  function refreshConn() {
    const pill = document.getElementById('connPill');
    const mode = ECOM.llmMode();
    if (mode === 'proxy') {
      pill.textContent = '检测中…'; pill.className = 'conn-pill';
      fetch('/api/health').then(r => r.json()).then(d => {
        if (d && d.ok && d.llmConfigured) { pill.textContent = '代理已就绪'; pill.className = 'conn-pill ok'; }
        else { pill.textContent = '代理未配置'; pill.className = 'conn-pill warn'; }
      }).catch(() => { pill.textContent = '代理不可达'; pill.className = 'conn-pill warn'; });
      return;
    }
    if (mode === 'direct') { pill.textContent = '已配置'; pill.className = 'conn-pill ok'; }
    else { pill.textContent = '未配置'; pill.className = 'conn-pill'; }
  }

  /* ---------- 代理自动探测：部署为 Node 应用时默认走服务端代理（Key 在服务端） ---------- */
  async function detectProxy() {
    const s = ECOM.store.get();
    if (s.useProxy != null) return; // 用户已显式选择，不覆盖
    try {
      const r = await fetch('/api/health', { method: 'GET' });
      const d = await r.json().catch(() => null);
      if (d && d.ok) { ECOM.store.set({ useProxy: true }); refreshConn(); }
    } catch (e) { /* 无代理服务（如静态托管），保持直连默认 */ }
  }

  /* ---------- 移动端侧栏 ---------- */
  function openSidebar() { sidebar.classList.add('open'); scrim.classList.add('show'); }
  function closeSidebar() { sidebar.classList.remove('open'); scrim.classList.remove('show'); }
  document.getElementById('menuToggle').addEventListener('click', openSidebar);
  scrim.addEventListener('click', closeSidebar);

  /* ---------- 启动 ---------- */
  // 从设置中恢复可投资金（跨模块共享：选品分析/品类灵感/货源参谋）
  try {
    const s = ECOM.store.get();
    if (s && s.capital) ECOM._capital = Number(s.capital) || 0;
  } catch (e) {}
  renderNav();
  refreshConn();
  detectProxy();
  ECOM.go = go;
  go(ECOM.modules[0].id);

  /* ---------- PWA：注册 Service Worker（仅 https，支持「安装到桌面」与离线） ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})();
