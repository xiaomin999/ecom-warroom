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
            <button class="secondary-btn" id="dk_filter">仅看适配我的资金档</button>
          </div>
          <div class="row" style="margin-top:12px">
            <div class="field" style="margin:0"><label>资金档筛选</label><div id="dk_tiers" class="chips"></div></div>
            <div class="field" style="margin:0"><label>平台筛选</label>
              <select id="dk_plat"><option value="">全部平台</option>${allPlats().map(p => `<option>${p}</option>`).join('')}</select></div>
          </div>
        </div>
        <div id="dk_grid" class="cat-grid"></div>`;

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

      const grid = root.querySelector('#dk_grid');
      function render() {
        const list = (DATA.items || []).filter(it =>
          (!activeTier || it.tiers.includes(activeTier)) &&
          (!activePlat || it.platforms.includes(activePlat))
        );
        if (!list.length) { grid.innerHTML = '<p class="hint">该筛选下暂无方向，换个资金档或平台看看。</p>'; return; }
        grid.innerHTML = list.map(it => cardHtml(it)).join('');
        grid.querySelectorAll('.cat-bring').forEach(b => b.addEventListener('click', () => bringToCapital(DATA.items[+b.dataset.i])));
      }
      render();
    }
  });

  function cardHtml(it) {
    const idx = DATA.items.indexOf(it);
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
