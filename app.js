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

  function go(id) {
    const m = ECOM.modules.find(x => x.id === id);
    if (!m) return;
    activeId = id;
    head.innerHTML = `<h1>${m.icon} ${m.name}</h1><p>${m.desc || ''}</p>`;
    body.innerHTML = '';
    try { m.render(body); } catch (e) { body.innerHTML = '<div class="card">模块加载失败：' + (e.message || e) + '</div>'; console.error(e); }
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
  renderNav();
  refreshConn();
  detectProxy();
  go(ECOM.modules[0].id);
})();
