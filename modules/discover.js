/* 品类灵感：联网检索整理的 2026 国内电商品类，按资金档灵活推荐，一键带入资金选品。 */
(function () {
  const DATA = window.CATEGORY_INSIGHTS || { items: [], modes: {}, note: '', updated: '' };
  const TIER_LABEL = { A: 'A·轻启动', B: 'B·标准', C: 'C·进阶', D: 'D·规模化' };

  function tierKey(cap) { return cap >= 200000 ? 'D' : cap >= 50000 ? 'C' : cap >= 10000 ? 'B' : cap > 0 ? 'A' : ''; }
  function tierName(cap) { const k = tierKey(cap); return TIER_LABEL[k] || '未填'; }
  function modeText(cap) {
    const m = DATA.modes || {};
    const k = tierKey(cap);
    return k ? (m[k] || '') : '在「选品分析」顶部填写可投资金，我会给出更贴合的启动模式与品类。';
  }
  function allPlats() {
    const s = new Set();
    (DATA.items || []).forEach(it => (it.platforms || []).forEach(p => s.add(p)));
    return [...s];
  }

  ECOM.register({
    id: 'discover',
    name: '品类灵感',
    icon: '💡',
    group: '市场情报',
    desc: '联网搜罗 2026 年国内电商可操作品类，按你的资金档灵活推荐，一键带入资金选品测算。',
    render(root) {
      const cap = ECOM._capital || 0;
      root.innerHTML = `
        <div class="card">
          <p style="margin-top:0"><b>2026 国内电商品类灵感</b> · 数据更新于 ${DATA.updated}。我已联网检索行业报告与平台公开数据（天猫 618、博晓通、各平台趋势）整理出下列可操作方向，按资金档分组，你不必自己搜。</p>
          <p class="hint" style="margin:0">${DATA.note || ''}</p>
        </div>
        <div class="card">
          <div class="row" style="align-items:flex-start">
            <div class="field" style="flex:1;margin:0">
              <label>我的资金档：<b id="dk_tier">${tierName(cap)}</b>（在「选品分析」顶部填可投资金会更准）</label>
              <div id="dk_modes" class="hint" style="margin-top:6px">${modeText(cap)}</div>
            </div>
            <div class="row" style="gap:8px;margin:0">
              <button class="secondary-btn" id="dk_filter">仅看适配我的资金档</button>
              <button class="primary-btn" id="dk_refresh">📡 联网刷新最新爆款</button>
            </div>
          </div>
          <div class="row" style="margin-top:12px">
            <div class="field" style="margin:0"><label>资金档筛选</label><div id="dk_tiers" class="chips"></div></div>
            <div class="field" style="margin:0"><label>平台筛选</label>
              <select id="dk_plat"><option value="">全部平台</option>${allPlats().map(p => `<option>${p}</option>`).join('')}</select></div>
          </div>
          <p class="hint" id="dk_live_ts" style="margin:10px 0 0;color:#0a7d3b"></p>
        </div>
        <div id="dk_grid" class="cat-grid"></div>
        <div id="dk_live"></div>`;

      const tiers = [['', '全部'], ['A', 'A·轻启动 (<1万)'], ['B', 'B·标准 (1-5万)'], ['C', 'C·进阶 (5-20万)'], ['D', 'D·规模化 (>20万)']];
      let activeTier = '';
      let activePlat = '';
      const chipsBox = root.querySelector('#dk_tiers');
      tiers.forEach(([k, lab], i) => {
        const c = document.createElement('button');
        c.className = 'chip' + (i === 0 ? ' active' : '');
        c.textContent = lab; c.dataset.t = k;
        c.addEventListener('click', () => { activeTier = k; chipsBox.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c)); render(); });
        chipsBox.appendChild(c);
      });
      root.querySelector('#dk_plat').addEventListener('change', e => { activePlat = e.target.value; render(); });
      root.querySelector('#dk_filter').addEventListener('click', () => {
        const k = tierKey(cap);
        if (!k) { ECOM.ui.toast('请先在「选品分析」顶部填可投资金'); return; }
        activeTier = k;
        chipsBox.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x.dataset.t === k));
        render();
      });

      // 联网刷新最新爆款：复用用户已配置的模型（⚙️ 模型设置），开启 enable_search
      const refreshBtn = root.querySelector('#dk_refresh');
      const liveBox = root.querySelector('#dk_live');
      const liveTs = root.querySelector('#dk_live_ts');
      async function refreshLive() {
        if (!ECOM.hasLLM()) {
          ECOM.ui.toast('请先在「⚙️ 模型设置」填写模型 API');
          if (ECOM.openSettings) ECOM.openSettings();
          return;
        }
        refreshBtn.disabled = true;
        const oldTxt = refreshBtn.textContent;
        refreshBtn.textContent = '📡 联网搜索中…';
        liveTs.textContent = '正在调用你配置的模型联网搜索最新爆款…';
        liveBox.innerHTML = '';
        try {
          const sys = '你是国内电商选品分析师，必须联网搜索最新数据后回答。只输出 JSON，不要解释。';
          const usr = `请联网搜索 2026 年国内电商（淘宝/天猫、京东、抖音电商、拼多多、小红书、视频号）当前最新爆款品类与增长趋势。
请基于真实搜索结果，挑出 8–12 个最适合中小卖家、可操作的方向，按资金档分组。

严格只输出如下 JSON 数组（不要任何多余文字、不要 Markdown 围栏）：
[
  {
    "name": "品类名",
    "tiers": ["A","B"],            // 资金档：A 轻启动(<1万) / B 标准(1-5万) / C 进阶(5-20万) / D 规模化(>20万)，可多选
    "platforms": ["抖音电商","小红书"],
    "margin": "约 40-55%",         // 毛利区间
    "cap": "0.5-2 万",             // 启动资金文字描述
    "capNum": 8000,                // 建议最低可投资金（数字，便于带入测算）
    "why": "为什么火（一句话）",
    "trend": "最新趋势数据（来自联网搜索，含平台与时间）",
    "supply": "货源/供应链思路",
    "risk": "风险提示",
    "feat": "核心卖点（带入资金选品用）",
    "aud": "目标人群（带入资金选品用）",
    "plat": "主推平台（带入资金选品用）"
  }
]

要求：趋势数据必须来自联网搜索的实时结果，标注平台与时间；避免编造；覆盖不同资金档。`;
          const text = await ECOM.llm([{ role: 'system', content: sys }, { role: 'user', content: usr }], { search: true, temperature: 0.3 });
          const items = parseLiveJson(text);
          if (!items.length) throw new Error('模型未返回可解析的品类 JSON');
          const html = items.map(it => cardHtml(it, items)).join('');
          liveBox.innerHTML = `<h3 style="margin:18px 0 8px;font-size:16px">📡 联网最新爆款（实时搜索）</h3><div class="cat-grid">${html}</div>`;
          liveBox.querySelectorAll('.cat-bring').forEach(b => b.addEventListener('click', () => bringToCapital(items[+b.dataset.i])));
          const now = new Date();
          liveTs.textContent = '📡 联网刷新成功 · ' + now.toLocaleString('zh-CN', { hour12: false }) + '（数据来自你配置的模型实时联网搜索）';
          ECOM.store.set({ discoverLiveAt: now.getTime() });
        } catch (e) {
          liveTs.style.color = '#c0392b';
          liveTs.textContent = '联网刷新失败：' + (e.message || e);
          if (/enable_search|不支持|unsupported|does not|invalid/i.test(e.message || '')) {
            liveTs.textContent += '（提示：你的模型可能不支持联网搜索，请在「⚙️ 模型设置」把模型改为 qwen-plus 或 qwen-max 再试）';
          }
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = oldTxt;
        }
      }
      refreshBtn.addEventListener('click', refreshLive);

      const grid = root.querySelector('#dk_grid');
      function render() {
        const list = (DATA.items || []).filter(it =>
          (!activeTier || it.tiers.includes(activeTier)) &&
          (!activePlat || it.platforms.includes(activePlat))
        );
        if (!list.length) { grid.innerHTML = '<p class="hint">该筛选下暂无方向，换个资金档或平台看看。</p>'; return; }
        grid.innerHTML = list.map(it => cardHtml(it, DATA.items)).join('');
        grid.querySelectorAll('.cat-bring').forEach(b => b.addEventListener('click', () => bringToCapital(DATA.items[+b.dataset.i])));
      }
      render();

      // 进入时若超过 24 小时未联网刷新过，自动拉一次最新爆款（仅当你已配置模型）
      const last = ECOM.store.get().discoverLiveAt || 0;
      if (ECOM.hasLLM() && Date.now() - last > 24 * 3600 * 1000) {
        ECOM.ui.toast('距上次联网刷新已超 24 小时，正在获取最新爆款…');
        refreshLive();
      }
    }
  });

  function parseLiveJson(text) {
    if (!text) return [];
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const s = t.indexOf('['), e = t.lastIndexOf(']');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    try { const arr = JSON.parse(t); return Array.isArray(arr) ? arr.filter(x => x && x.name) : []; }
    catch (err) { return []; }
  }

  function cardHtml(it, items) {
    const idx = (items || DATA.items).indexOf(it);
    const tierTags = (it.tiers || []).map(t => `<span class="tier-tag t-${t}">${t}</span>`).join('');
    const plats = (it.platforms || []).map(p => `<span class="plat">${p}</span>`).join('');
    return `<div class="cat-card">
      <div class="cat-head"><b>${it.name}</b>${tierTags}</div>
      <div class="cat-plats">${plats}</div>
      <div class="cat-line"><span>毛利</span><b>${it.margin || '—'}</b></div>
      <div class="cat-line"><span>启动资金</span><b>${it.cap || '—'}</b></div>
      <div class="cat-block"><b>为什么火</b><p>${it.why || ''}</p></div>
      ${it.trend ? `<div class="cat-block"><b>趋势数据</b><p>${it.trend}</p></div>` : ''}
      <div class="cat-block"><b>货源思路</b><p>${it.supply || ''}</p></div>
      <div class="cat-block risk"><b>风险提示</b><p>${it.risk || ''}</p></div>
      <button class="primary-btn cat-bring" data-i="${idx}">＋ 带入资金选品</button>
    </div>`;
  }

  function bringToCapital(d) {
    if (!ECOM._capital || ECOM._capital <= 0) { ECOM._capital = d.capNum || 0; ECOM.store.set({ capital: ECOM._capital }); }
    if (ECOM.go) ECOM.go('selection');
    else { const b = document.querySelector('.nav-item[data-id="selection"]'); if (b) b.click(); }
    const t = document.querySelector('#selTabs .tab[data-t="capital"]');
    if (t) t.click();
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set('c_name', d.name);
    if (d.feat) set('cap_feat', d.feat);
    if (d.aud) set('cap_aud', d.aud);
    if (d.plat) { const p = document.getElementById('c_plat'); if (p) p.value = d.plat; }
    if (d.capNum && ECOM._capital === d.capNum) set('c_cap', d.capNum);
    ECOM.ui.toast('已带入「资金选品」：填成本/客单价即可测算备货');
  }
})();
