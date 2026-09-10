/* 选品分析：AI 选品建议 + 离线选品打分卡 + 可投资金联动选品（三引擎） */
(function () {
  const PLATFORMS = ['淘宝/天猫', '京东', '抖音电商', '拼多多', '小红书', '视频号', '快手电商', '1688'];

  // 资金档位定义：决定选品偏好、推广强度、风险红线
  function tierOf(cap) {
    if (cap >= 200000) return { key: 'D', name: '规模化', color: '#f59e0b', profile: '全链路布局 · 多 SKU 矩阵 · 可规模化投放' };
    if (cap >= 50000) return { key: 'C', name: '进阶', color: '#8b5cf6', profile: '较高客单价 · 可品牌化 · 适度广告投入' };
    if (cap >= 10000) return { key: 'B', name: '标准', color: '#3b82f6', profile: '中等客单价 · 可适度备货 · 测款+小放量' };
    if (cap > 0) return { key: 'A', name: '轻启动', color: '#10b981', profile: '低客单价 · 轻小件 · 高周转 · 低 MOQ · 避免压货' };
    return { key: '-', name: '未填写', color: '#94a3b8', profile: '填写可投资金后，自动匹配选品打法' };
  }

  // 按资金档给出规则化运营建议（离线、即时）
  function adviceByTier(t, m) {
    const L = [];
    L.push(`### ${t.key}档（${t.name}）· 运营打法`);
    if (t.key === 'A') {
      L.push('- **选品偏好**：客单价 ¥20–80 的轻小件、消耗品、配件类；优先 1688 一件代发/低 MOQ，避免压货。');
      L.push('- **利润红线**：单件毛利必须 > 30%，否则不碰；用「小批量多测款」找爆款。');
      L.push('- **推广**：以自然流量 + 短视频/内容为主，付费广告占比 ≤ 20%，单 SKU 投入不超总资金 30%。');
      L.push('- **现金流**：首单只备 2–3 周销量，卖完再补；绝不借钱扩张。');
      L.push('- **风险红线**：任一 SKU 占用 > 总资金 30% 即预警；库存周转 > 45 天立即清仓。');
    } else if (t.key === 'B') {
      L.push('- **选品偏好**：客单价 ¥50–200，可适度非标/小家电；支持小批量定制与打样。');
      L.push('- **利润红线**：单件毛利 ≥ 25%，预留 10–15% 退货/损耗缓冲。');
      L.push('- **推广**：内容种草 + 付费广告并行，广告占销售额 20–30%；可养 1–2 个潜力 SKU 放量。');
      L.push('- **现金流**：首单备 3–5 周销量，跑通转化后阶梯补单；保留 ≥ 20% 资金做机动。');
      L.push('- **风险红线**：库存周转 > 60 天预警；单一渠道依赖 > 70% 需分散。');
    } else if (t.key === 'C') {
      L.push('- **选品偏好**：客单价 ¥150–600，可做品牌化、差异化外观、套装组合。');
      L.push('- **利润红线**：单件毛利 ≥ 30%，可承受更高获客成本换取复购。');
      L.push('- **推广**：站外达人/联盟 + 站内广告组合，广告占销售额 25–35%；可多 SKU 矩阵测试。');
      L.push('- **现金流**：可备 1–2 个月安全库存；用数据驱动补单，关注现金周转天数。');
      L.push('- **风险红线**：新品验证期 ≤ 30 天，ROI 不达标即砍；避免为冲量盲目铺货。');
    } else {
      L.push('- **选品偏好**：全价格带布局，主推款 + 利润款 + 引流款组合，可自建供应链/私模。');
      L.push('- **利润红线**：组合毛利率 ≥ 35%，用引流款带利润款。');
      L.push('- **推广**：规模化投放 + 品牌内容 + 达人矩阵；可建专属投放/运营团队。');
      L.push('- **现金流**：多仓备货、资金分渠道隔离；用周转与 ROI 双指标管控。');
      L.push('- **风险红线**：单 SKU 资金占比设上限；建立库存与现金流周报机制。');
    }
    if (m) {
      L.push('');
      L.push('### 基于本次测算的提示');
      if (m.profitPerUnit <= 0) L.push(`- ⚠️ 当前定价/成本下 **单件毛利为负（¥${m.profitPerUnit.toFixed(1)}）**，需提价、降本或换品，否则越卖越亏。`);
      else L.push(`- 单件毛利 ¥${m.profitPerUnit.toFixed(1)}，占客单价 ${(m.profitPerUnit / m.price * 100).toFixed(0)}%；首单约备 ${m.units} 件、占用资金 ¥${m.firstBatch.toFixed(0)}。`);
      if (m.units > 0 && m.gmvProfit > 0) L.push(`- 若首单 ${m.units} 件售罄，预计毛利 ¥${m.gmvProfit.toFixed(0)}，约为首单资金的 ${(m.gmvProfit / m.firstBatch * 100).toFixed(0)}%（未计复购）。`);
    }
    return L.join('\n');
  }

  // 选品方向推荐库（离线、按资金档适配）——直接回答"该卖什么"
  const PRODUCT_LIB = [
    // A 档：轻启动 <1万
    { name: '真空收纳袋（补充装/旅行装）', tiers: ['A'], price: '¥19–49', margin: '40–60%', moq: '50–100', why: '轻小件、高复购、物流友好，适合零经验试水' },
    { name: '厨房硅胶小工具（铲/勺/量杯套装）', tiers: ['A'], price: '¥15–45', margin: '45–60%', moq: '100', why: '轻、不易碎，组合装易出量' },
    { name: '数码配件（手机支架/理线/磁吸）', tiers: ['A', 'B'], price: '¥19–69', margin: '40–55%', moq: '100', why: '轻小、短视频好推，注意外观专利' },
    { name: '宠物小件（牵引扣/玩具/食盆）', tiers: ['A', 'B'], price: '¥15–59', margin: '45–60%', moq: '100', why: '高复购、情感溢价，注意材质安全' },
    { name: '桌面收纳分隔盒', tiers: ['A'], price: '¥12–39', margin: '45–60%', moq: '100', why: '刚需轻件，低价易卷需靠差异化' },
    // B 档：标准 1–5万
    { name: '桌面真空封口机（迷你款）', tiers: ['B', 'C'], price: '¥79–199', margin: '30–45%', moq: '200–500', why: '贴合你的真空机供应链优势，配真空袋绑售提复购' },
    { name: '便携榨汁杯/搅拌杯', tiers: ['B', 'C'], price: '¥59–159', margin: '30–45%', moq: '300', why: '刚需小电，注意电池/密封合规' },
    { name: '手持吸尘/除螨小电', tiers: ['B', 'C'], price: '¥99–259', margin: '30–42%', moq: '200', why: '内容带货好转化，注意电机与噪音' },
    { name: '个护小电（电动牙刷/美容仪）', tiers: ['B', 'C'], price: '¥69–299', margin: '35–50%', moq: '300', why: '高客单高毛利，美容仪合规较严' },
    { name: '旅行电热杯/电热水壶', tiers: ['B'], price: '¥59–149', margin: '30–42%', moq: '300', why: '差旅刚需，注意安规认证' },
    // C 档：进阶 5–20万
    { name: '真空机+真空袋组合装', tiers: ['C', 'D'], price: '¥149–399', margin: '35–50%', moq: '500', why: '组合提客单与复购，发挥供应链协同' },
    { name: '破壁机/空气炸锅', tiers: ['C', 'D'], price: '¥199–599', margin: '30–42%', moq: '300', why: '可品牌化，重货物流与售后压力大' },
    { name: '加湿/净化小电', tiers: ['C', 'D'], price: '¥129–499', margin: '32–45%', moq: '300', why: '滤芯带来持续复购' },
    { name: '户外/旅行小电（风扇/灯）', tiers: ['B', 'C'], price: '¥59–199', margin: '35–50%', moq: '300', why: '内容种草强，注意季节波动' },
    // D 档：规模化 >20万
    { name: '厨房小电全 SKU 矩阵', tiers: ['D'], price: '¥59–599', margin: '30–45%', moq: '1000+', why: '主推+利润+引流组合，规模化投放' },
    { name: '自有品牌线（私模+外观专利）', tiers: ['D'], price: '全带', margin: '35–55%', moq: '1000+', why: '建壁垒，需研发与专利投入' },
  ];

  function renderRecs(panel, cap) {
    const box = panel.querySelector('#c_recs');
    if (!box) return;
    const t = tierOf(cap);
    if (cap <= 0) {
      box.innerHTML = '<p class="hint" style="margin:0">填写可投资金后，这里会显示该资金档推荐切入的选品方向（离线，免联网）。</p>';
      return;
    }
    const matched = PRODUCT_LIB.filter(e => e.tiers.includes(t.key));
    if (!matched.length) {
      box.innerHTML = '<p class="hint" style="margin:0">该资金档暂无预置方向，建议用「🤖 AI 生成资金选品方案」获取定制建议。</p>';
      return;
    }
    const rows = matched.map((e, i) =>
      `<tr><td>${i + 1}</td><td><b>${e.name}</b></td><td>${e.price}</td><td>${e.margin}</td><td>${e.moq}</td><td>${e.why}</td><td><button class="rec-add" data-name="${e.name}">＋分配</button></td></tr>`
    ).join('');
    box.innerHTML =
      `<p class="hint" style="margin:0 0 8px">以下方向适配你的 <b style="color:${t.color}">${t.key}档 · ${t.name}</b>（离线推荐，可结合上方测算与 AI 方案）：</p>` +
      `<table><thead><tr><th>#</th><th>选品方向</th><th>客单价带</th><th>毛利</th><th>起订/MOQ</th><th>为什么适配</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>`;
    box.querySelectorAll('.rec-add').forEach(b => b.addEventListener('click', () => addToAlloc(b.dataset.name)));
  }

  // 从推荐方向一键带入资金分配模拟器
  function addToAlloc(name) {
    ECOM._pendingAlloc = ECOM._pendingAlloc || [];
    ECOM._pendingAlloc.push(name);
    const tab = document.querySelector('.tab[data-t="alloc"]');
    if (tab) tab.click();
  }

  ECOM.register({
    id: 'selection',
    name: '选品分析',
    icon: '🎯',
    group: '选品',
    desc: 'AI 选品建议 + 离线打分卡 + 可投资金联动选品，按平台/品类/供应链/资金输出结构化建议。',
    render(root) {
      root.innerHTML = `
        <div class="card" id="capBanner">
          <div class="cap-row">
            <div class="field" style="flex:1;margin:0">
              <label>可投资金（¥）— 联动全部选品建议</label>
              <input type="number" id="g_cap" placeholder="例如 30000" min="0" step="1000">
            </div>
            <div id="g_tier" class="tier-badge">未填写</div>
          </div>
          <input type="range" id="g_capRange" min="0" max="300000" step="1000" value="0" style="width:100%;margin-top:10px">
        </div>
        <div class="card">
          <div class="tabs" id="selTabs">
            <button class="tab active" data-t="ai">🤖 AI 选品建议</button>
            <button class="tab" data-t="score">📊 选品打分卡</button>
            <button class="tab" data-t="capital">💰 资金选品</button>
            <button class="tab" data-t="alloc">🧮 资金分配</button>
          </div>
          <div id="selPanel"></div>
        </div>`;

      const capInput = root.querySelector('#g_cap');
      const capRange = root.querySelector('#g_capRange');
      const tierEl = root.querySelector('#g_tier');
      function updateCap() {
        let v = Math.max(0, +capInput.value || 0);
        capRange.value = Math.min(v, 300000);
        ECOM._capital = v;
        ECOM.store.set({ capital: v });
        const t = tierOf(v);
        tierEl.innerHTML = v > 0
          ? `<b style="color:${t.color}">${t.key}档 · ${t.name}</b><br><span class="hint" style="color:#64748b">${t.profile}</span>`
          : '<span class="hint">填写后自动匹配选品打法</span>';
      }
      capInput.addEventListener('input', updateCap);
      capRange.addEventListener('input', () => { capInput.value = capRange.value; updateCap(); });
      const saved = ECOM.store.get().capital;
      if (saved) { capInput.value = saved; }
      updateCap();

      const panel = root.querySelector('#selPanel');
      const tabs = root.querySelector('#selTabs');
      tabs.addEventListener('click', e => {
        const b = e.target.closest('.tab'); if (!b) return;
        tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === b));
        const map = { ai: renderAI, score: renderScore, capital: renderCapital, alloc: renderAlloc };
        (map[b.dataset.t] || renderAI)(panel);
      });
      renderAI(panel);
    }
  });

  function renderAI(panel) {
    panel.innerHTML = `
      <div class="row">
        <div class="field"><label>目标平台</label>
          <select id="s_plat">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
        <div class="field"><label>主推品类<span class="hint">如 厨房小家电 / 宠物用品</span></label>
          <input type="text" id="s_cat" placeholder="例如：真空封口机 / 桌面收纳 / 厨房小工具"></div>
      </div>
      <div class="row">
        <div class="field"><label>客单价区间（¥）</label>
          <input type="text" id="s_price" placeholder="例如：¥29–¥99 / ¥99–¥299"></div>
        <div class="field"><label>建议数量</label>
          <select id="s_num"><option>5</option><option>3</option><option>8</option><option>10</option></select></div>
      </div>
      <div class="field"><label>自身供应链 / 优势<span class="hint">决定推荐偏向</span></label>
        <input type="text" id="s_supply" placeholder="例如：自有注塑厂、1688 一件代发渠道、可定制外观"></div>
      <div class="field"><label>目标人群</label>
        <input type="text" id="s_aud" placeholder="例如：一二线城市租房年轻人、注重收纳的家庭"></div>
      <div class="field"><label>已知市场数据 / 竞品观察<span class="hint">选填，粘贴销量、评论、链接等</span></label>
        <textarea id="s_data" placeholder="可选：竞品链接/标题、热搜词、差评痛点、利润测算…"></textarea></div>
      <div class="btn-row">
        <button class="primary-btn" id="s_gen">生成选品建议</button>
        <span class="hint">需配置模型 API</span>
      </div>
      <div id="s_out"></div>`;

    const out = panel.querySelector('#s_out');
    const card = ECOM.ui.resultCard('AI 选品建议');
    out.appendChild(card);

    panel.querySelector('#s_gen').addEventListener('click', async (e) => {
      const plat = val('#s_plat'), cat = val('#s_cat'), price = val('#s_price'),
            num = val('#s_num'), supply = val('#s_supply'), aud = val('#s_aud'), data = val('#s_data');
      if (!cat.trim()) { ECOM.ui.toast('请填写主推品类'); return; }
      const cap = ECOM._capital || 0;
      const capLine = cap > 0
        ? `【可投资金】¥${cap.toLocaleString()}（${tierOf(cap).name}档）——推荐方向须贴合该资金档的 MOQ、客单价与压货承受力。`
        : '【可投资金】未填写——可在顶部「可投资金」填写后重生成，以获得更贴合资金实力的选品建议。';
      const prompt = `你是一名资深的国内电商选品专家，擅长 ${plat} 平台。
请基于以下信息，推荐 ${num} 个值得切入的细分选品方向，用中文输出。

【目标平台】${plat}
【主推品类】${cat}
【客单价区间】${price || '不限'}
【自身供应链/优势】${supply || '暂未提供'}
【目标人群】${aud || '暂未提供'}
【已知市场数据/竞品观察】${data || '暂未提供'}
${capLine}

输出要求（Markdown）：
## 一、选品榜单（用表格）
| 排名 | 选品方向 | 推荐理由 | 预估客单价 | 竞争强度(高/中/低) | 切入难度 | 资金适配度 |
|------|---------|---------|-----------|----------------|---------|-----------|
（给出 ${num} 行，资金适配度说明该方向是否契合用户资金档）

## 二、Top3 深度拆解
对每个方向写：目标人群痛点、差异化卖点、供应链/成本要点、首单备货与风险提示。

## 三、落地节奏建议
给出 0–30 天 / 30–60 天 / 60–90 天的行动优先级。

注意：只基于给定信息做合理推演，不编造具体销量数字；如信息不足，明确标注"需进一步验证"。`;
      await ECOM.ui.run(e.target, async () => {
        const text = await ECOM.llm([
          ECOM.msg('system', '你是专业的国内电商选品顾问，输出结构化、可落地的选品建议，尤其关注资金与风险的匹配。'),
          ECOM.msg('user', prompt)
        ], { temperature: 0.6 });
        card.set(text, '选品建议.md');
      });
    });

    function val(sel){ return panel.querySelector(sel).value.trim(); }
  }

  function renderScore(panel) {
    const metrics = [
      { k: 'profit', name: '利润空间', w: 30, desc: '毛利率与溢价能力' },
      { k: 'comp', name: '竞争友好度', w: 20, desc: '竞争越低越好（此处填竞争度，自动反向）', invert: true },
      { k: 'rep', name: '复购率', w: 20, desc: '消耗品/配件类更高' },
      { k: 'logi', name: '物流友好', w: 15, desc: '体积小、不易碎、非危化' },
      { k: 'trend', name: '趋势热度', w: 15, desc: '平台增长与搜索趋势' },
    ];
    panel.innerHTML = `
      <p class="hint" style="margin-top:0">离线加权评分（0–100），无需联网即可用。填完即时出分。</p>
      <div id="scoreRows"></div>
      <div class="card" style="margin-top:16px;text-align:center">
        <div class="score-ring" id="ring"><span id="ringNum">0</span></div>
        <h3 id="scoreLabel" style="margin-top:12px">—</h3>
        <p class="hint" id="scoreAdv" style="margin:6px 0 0">填左侧指标看建议</p>
      </div>`;
    const rowsBox = panel.querySelector('#scoreRows');
    metrics.forEach(m => {
      const f = document.createElement('div');
      f.className = 'field';
      f.innerHTML = `
        <div class="metric-row"><span>${m.name} <span class="hint">(${m.desc})</span></span><b id="v_${m.k}">50</b></div>
        <input type="range" min="0" max="100" value="50" id="r_${m.k}" data-w="${m.w}" ${m.invert ? 'data-invert="1"' : ''}>`;
      rowsBox.appendChild(f);
    });
    const ring = panel.querySelector('#ring');
    const ringNum = panel.querySelector('#ringNum');
    const label = panel.querySelector('#scoreLabel');
    const adv = panel.querySelector('#scoreAdv');
    function recalc() {
      let total = 0;
      metrics.forEach(m => {
        const r = panel.querySelector('#r_' + m.k);
        let v = +r.value;
        if (m.invert) v = 100 - v; // 竞争度反向
        total += v * m.w;
        panel.querySelector('#v_' + m.k).textContent = r.value;
      });
      total = Math.round(total / 100);
      ringNum.textContent = total;
      ring.style.setProperty('--p', (total * 3.6) + 'deg');
      let lv, msg;
      if (total >= 80) { lv = '🔥 强烈建议切入'; msg = '综合得分优秀，优先排期打样与备货。'; }
      else if (total >= 65) { lv = '👍 可以切入'; msg = '基本面良好，补齐短板（供应链/合规）后即可启动。'; }
      else if (total >= 50) { lv = '🤔 谨慎小批量试水'; msg = '存在明显短板，建议先用小批量验证再放量。'; }
      else { lv = '⚠️ 暂不推荐'; msg = '得分偏低，建议换方向或重构卖点/供应链。'; }
      const cap = ECOM._capital || 0;
      if (cap > 0) {
        const t = tierOf(cap);
        msg += `（当前资金 ${t.key}档 · ${t.name}：建议首单单 SKU 占用 ≤ 总资金 ${t.key === 'A' ? '30' : '40'}%）`;
      }
      label.textContent = lv; adv.textContent = msg;
    }
    rowsBox.addEventListener('input', recalc);
    recalc();
  }

  function renderCapital(panel) {
    const cap0 = ECOM._capital || '';
    panel.innerHTML = `
      <p class="hint" style="margin-top:0">按你的「可投资金」联动测算备货量与运营打法。顶部已填的资金会自动带入，也可在此重填。</p>
      <div class="field"><label>方向名 / 商品名<span class="hint">填了会存为「选品简报」，一键带入标题/文案/详情页/做图</span></label><input type="text" id="c_name" placeholder="例如：桌面真空封口机"></div>
      <div class="field"><label>核心卖点<span class="hint">每行一条，带入下游标题/文案/详情页/做图</span></label><textarea id="cap_feat" placeholder="例如：&#10;干湿两用&#10;便携充电&#10;食品保鲜30天&#10;配套真空袋"></textarea></div>
      <div class="row"><div class="field"><label>目标人群</label><input type="text" id="cap_aud" placeholder="例如：注重食材保鲜的家庭"></div></div>
      <div class="row">
        <div class="field"><label>可投资金（¥）</label><input type="number" id="c_cap" value="${cap0}" min="0" step="500"></div>
        <div class="field"><label>单件采购成本（¥，参考 1688）</label><input type="number" id="c_cost" placeholder="如 18" min="0" step="0.5"></div>
      </div>
      <div class="row">
        <div class="field"><label>计划客单价（¥）</label><input type="number" id="c_price" placeholder="如 59" min="0" step="0.5"></div>
        <div class="field"><label>目标平台</label><select id="c_plat">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>物流占采购成本比（%）</label><input type="number" id="c_logi" value="15" min="0" step="1"></div>
        <div class="field"><label>平台费率（%）</label><input type="number" id="c_platfee" value="12" min="0" step="1"></div>
      </div>
      <div class="row">
        <div class="field"><label>广告占销售额比（%）</label><input type="number" id="c_ad" value="25" min="0" step="1"></div>
        <div class="field"><label>首单资金占用比（%）</label><input type="number" id="c_first" value="60" min="0" max="100" step="5"></div>
      </div>
      <div class="btn-row">
        <button class="primary-btn" id="c_calc">测算备货与运营建议</button>
        <button class="secondary-btn" id="c_ai">🤖 AI 生成资金选品方案</button>
      </div>
      <div id="c_recs" class="card" style="margin-top:14px"></div>
      <div id="c_out"></div>`;

    const out = panel.querySelector('#c_out');
    const card = ECOM.ui.resultCard('资金选品方案');
    out.appendChild(card);

    // 已存在的简报回填到表单，支持连续编辑
    const ex = ECOM.getBrief() || {};
    if (ex.name) panel.querySelector('#c_name').value = ex.name;
    if (ex.feats) panel.querySelector('#cap_feat').value = Array.isArray(ex.feats) ? ex.feats.join('\n') : ex.feats;
    if (ex.audience) panel.querySelector('#cap_aud').value = ex.audience;

    // 资金档离线推荐方向（随可投资金实时刷新）
    const capInputEl = panel.querySelector('#c_cap');
    const refreshRecs = () => renderRecs(panel, +capInputEl.value || 0);
    capInputEl.addEventListener('input', refreshRecs);
    refreshRecs();

    function compute() {
      const cap = +panel.querySelector('#c_cap').value || 0;
      const cost = +panel.querySelector('#c_cost').value || 0;
      const price = +panel.querySelector('#c_price').value || 0;
      const logi = (+panel.querySelector('#c_logi').value || 0) / 100;
      const platFee = (+panel.querySelector('#c_platfee').value || 0) / 100;
      const ad = (+panel.querySelector('#c_ad').value || 0) / 100;
      const firstPct = (+panel.querySelector('#c_first').value || 0) / 100;
      const t = tierOf(cap);
      const unitLanded = cost * (1 + logi); // 单件到手成本（采购+物流）
      const profitPerUnit = price - unitLanded - price * platFee - price * ad;
      const firstBatch = cap * firstPct;
      const units = unitLanded > 0 ? Math.floor(firstBatch / unitLanded) : 0;
      const adBudget = cap * ad;
      const gmv = units * price;
      const gmvProfit = units * profitPerUnit;
      return { cap, cost, price, logi, platFee, ad, firstPct, t, unitLanded, profitPerUnit, firstBatch, units, adBudget, gmv, gmvProfit };
    }

    function buildMd(m) {
      const L = [];
      L.push(`## 资金档位：${m.t.key}档 · ${m.t.name}`);
      L.push(`> ${m.t.profile}`);
      L.push('');
      L.push('## 一、备货量测算');
      L.push('| 指标 | 数值 |');
      L.push('|------|------|');
      L.push(`| 可投资金 | ¥${m.cap.toLocaleString()} |`);
      L.push(`| 单件采购成本 | ¥${m.cost.toFixed(2)} |`);
      L.push(`| 单件到手成本(含物流) | ¥${m.unitLanded.toFixed(2)} |`);
      L.push(`| 计划客单价 | ¥${m.price.toFixed(2)} |`);
      L.push(`| **单件毛利** | **¥${m.profitPerUnit.toFixed(2)}** |`);
      L.push(`| 首单可用资金(${(m.firstPct*100).toFixed(0)}%) | ¥${m.firstBatch.toFixed(0)} |`);
      L.push(`| **首单备货量** | **${m.units} 件** |`);
      L.push(`| 广告预留 | ¥${m.adBudget.toFixed(0)} |`);
      L.push(`| 预计首单 GMV | ¥${m.gmv.toFixed(0)} |`);
      L.push(`| 预计首单毛利 | ¥${m.gmvProfit.toFixed(0)} |`);
      L.push('');
      L.push('## 二、运营建议');
      L.push(adviceByTier(m.t, m));
      return L.join('\n');
    }

    panel.querySelector('#c_calc').addEventListener('click', (e) => {
      const m = compute();
      if (m.cap <= 0) { ECOM.ui.toast('请填写可投资金'); return; }
      if (m.cost <= 0 || m.price <= 0) { ECOM.ui.toast('请填写单件采购成本与客单价'); return; }
      card.set(buildMd(m), '资金选品方案.md');
      const name = (panel.querySelector('#c_name').value || '').trim();
      if (name) {
        const feats = (panel.querySelector('#cap_feat').value || '').trim();
        const audience = (panel.querySelector('#cap_aud').value || '').trim();
        ECOM.setBrief({
          name,
          cost: m.cost,
          price: m.price,
          platform: panel.querySelector('#c_plat').value,
          capital: m.cap,
          tier: m.t.key + '档·' + m.t.name,
          feats: feats ? feats.split('\n').map(s => s.trim()).filter(Boolean) : '',
          audience
        });
        ECOM.ui.toast('已存为选品简报，可前往标题/文案/详情页/做图');
      }
    });

    panel.querySelector('#c_ai').addEventListener('click', async (e) => {
      const m = compute();
      if (m.cap <= 0) { ECOM.ui.toast('请填写可投资金'); return; }
      if (m.cost <= 0 || m.price <= 0) { ECOM.ui.toast('请填写单件采购成本与客单价'); return; }
      const prompt = `你是一名懂资金盘的电商选品操盘手。请基于以下资金与成本数据，输出「资金选品方案」（中文 Markdown）。

【可投资金】¥${m.cap.toLocaleString()}（${m.t.name}档）
【目标平台】${panel.querySelector('#c_plat').value}
【单件采购成本】¥${m.cost.toFixed(2)}
【计划客单价】¥${m.price.toFixed(2)}
【物流占比】${(m.logi*100).toFixed(0)}% · 【平台费率】${(m.platFee*100).toFixed(0)}% · 【广告占销售额】${(m.ad*100).toFixed(0)}%
【测算】首单约备 ${m.units} 件；单件毛利 ¥${m.profitPerUnit.toFixed(2)}；首单 GMV 约 ¥${m.gmv.toFixed(0)}；首单毛利约 ¥${m.gmvProfit.toFixed(0)}。

输出要求：
## 一、适配该资金档的选品方向（3–5 个）
每个写：品类、客单价带、为什么适合该资金档、预估 MOQ/起订、单 SKU 建议占用资金。
## 二、备货与现金流节奏
首单/补单节奏、资金占用、回本周期预估、现金安全线。
## 三、推广预算分配
广告/内容/达人 的预算占比与节奏，结合该资金档承受能力。
## 四、风险与红线
该资金档最易踩的坑与规避动作，给出具体数量阈值。

注意：基于给定数据做合理推演，不编造销量；给出可执行的数值建议。`;
      await ECOM.ui.run(e.target, async () => {
        const text = await ECOM.llm([
          ECOM.msg('system', '你是懂资金盘的电商选品操盘手，擅长按可投资金给出可落地的选品与预算方案。'),
          ECOM.msg('user', prompt)
        ], { temperature: 0.5 });
        card.set(text, '资金选品方案.md');
      });
    });
  }

  function renderAlloc(panel) {
    panel.innerHTML = `
      <p class="hint" style="margin-top:0">把一笔可投资金拆给多个选品方向，测算组合占用、毛利与风险红线。先填可投资金，再逐行加方向（也可从「资金选品」的推荐方向点「＋分配」带入）。</p>
      <div class="row">
        <div class="field"><label>可投资金（¥）</label><input type="number" id="a_cap" value="${ECOM._capital || ''}" min="0" step="500"></div>
        <div class="field"><label>物流占采购成本比（%）</label><input type="number" id="a_logi" value="15" min="0" step="1"></div>
      </div>
      <p class="hint" style="margin:4px 0 8px">每行：方向名 · 单件成本 · 客单价 · 备货件数</p>
      <div id="a_rows"></div>
      <div class="btn-row">
        <button class="secondary-btn" id="a_add">＋ 加一个方向</button>
        <button class="primary-btn" id="a_calc">测算组合分配</button>
      </div>
      <div id="a_out"></div>`;

    const rowsBox = panel.querySelector('#a_rows');
    function addRow(preset) {
      const r = document.createElement('div');
      r.className = 'alloc-row';
      r.innerHTML = `
        <input class="ar-name" placeholder="方向名（如 真空封口机）" value="${preset || ''}">
        <input class="ar-cost" type="number" placeholder="单件成本" min="0" step="0.5">
        <input class="ar-price" type="number" placeholder="客单价" min="0" step="0.5">
        <input class="ar-qty" type="number" placeholder="备货件数" min="0" step="1">
        <button class="ar-del" title="删除">✕</button>`;
      r.querySelector('.ar-del').addEventListener('click', () => r.remove());
      rowsBox.appendChild(r);
    }
    (ECOM._pendingAlloc || []).forEach(n => addRow(n));
    ECOM._pendingAlloc = [];
    if (!rowsBox.children.length) { addRow(); addRow(); }

    panel.querySelector('#a_add').addEventListener('click', () => addRow());

    const out = panel.querySelector('#a_out');
    const card = ECOM.ui.resultCard('资金分配方案');
    out.appendChild(card);

    panel.querySelector('#a_calc').addEventListener('click', () => {
      const cap = +panel.querySelector('#a_cap').value || 0;
      const logi = (+panel.querySelector('#a_logi').value || 0) / 100;
      if (cap <= 0) { ECOM.ui.toast('请填写可投资金'); return; }
      const rows = [...rowsBox.children].map(r => ({
        name: r.querySelector('.ar-name').value.trim() || '未命名',
        cost: +r.querySelector('.ar-cost').value || 0,
        price: +r.querySelector('.ar-price').value || 0,
        qty: +r.querySelector('.ar-qty').value || 0
      })).filter(x => x.cost > 0 && x.price > 0 && x.qty > 0);
      if (!rows.length) { ECOM.ui.toast('请至少填一个完整方向（成本/客单价/件数）'); return; }

      const t = tierOf(cap);
      const redline = (t.key === 'A') ? 0.30 : 0.40; // 单 SKU 资金占用红线
      let totalFund = 0, totalGmv = 0, totalProfit = 0, totalUnits = 0;
      const detail = rows.map(x => {
        const land = x.cost * (1 + logi);
        const fund = land * x.qty;
        const profit = (x.price - land) * x.qty;
        const gmv = x.price * x.qty;
        totalFund += fund; totalGmv += gmv; totalProfit += profit; totalUnits += x.qty;
        return Object.assign({}, x, { land, fund, profit, gmv });
      });
      const occ = cap > 0 ? totalFund / cap : 0;
      const comboMargin = totalGmv > 0 ? totalProfit / totalGmv : 0;

      const L = [];
      L.push(`## 资金分配方案（${t.key}档 · ${t.name}）`);
      L.push(`> 可投资金 ¥${cap.toLocaleString()} · 物流占比 ${(logi * 100).toFixed(0)}%`);
      L.push('');
      L.push('## 一、组合总览');
      L.push('| 指标 | 数值 |');
      L.push('|------|------|');
      L.push(`| 方向数 | ${detail.length} 个 |`);
      L.push(`| 组合总占用资金 | ¥${totalFund.toFixed(0)} |`);
      L.push(`| **资金占用率** | **${(occ * 100).toFixed(0)}%** |`);
      L.push(`| 总备货件数 | ${totalUnits} 件 |`);
      L.push(`| 预计组合 GMV | ¥${totalGmv.toFixed(0)} |`);
      L.push(`| 预计组合毛利 | ¥${totalProfit.toFixed(0)} |`);
      L.push(`| **组合毛利率** | **${(comboMargin * 100).toFixed(0)}%** |`);
      L.push('');
      L.push('## 二、各方向分配');
      L.push('| 方向 | 单件到手成本 | 备货件数 | 占用资金 | 占总额 | GMV | 毛利 |');
      L.push('|------|------|------|------|------|------|------|');
      detail.forEach(x => {
        const pct = totalFund > 0 ? (x.fund / totalFund * 100).toFixed(0) : '0';
        L.push(`| ${x.name} | ¥${x.land.toFixed(2)} | ${x.qty} | ¥${x.fund.toFixed(0)} | ${pct}% | ¥${x.gmv.toFixed(0)} | ¥${x.profit.toFixed(0)} |`);
      });
      L.push('');
      L.push('## 三、风险与红线');
      const risks = [];
      if (occ > 1.0) risks.push(`- ⚠️ **资金超支**：组合占用 ${(occ * 100).toFixed(0)}% 已超过可投资金，需删减方向或降低件数。`);
      else if (occ > 0.9) risks.push(`- ⚠️ 资金偏紧：占用 ${(occ * 100).toFixed(0)}%，建议预留 ≥10% 作机动/退货缓冲。`);
      else risks.push(`- 资金占用健康（${(occ * 100).toFixed(0)}%），保留了缓冲空间。`);
      detail.forEach(x => {
        const p = totalFund > 0 ? x.fund / totalFund : 0;
        if (p > redline) risks.push(`- ⚠️ 「${x.name}」单项占用 ${(p * 100).toFixed(0)}%，超过本档红线 ${redline * 100}%，建议分散或减量。`);
      });
      if (comboMargin < 0.25) risks.push(`- ⚠️ 组合毛利率仅 ${(comboMargin * 100).toFixed(0)}%，低于 25% 健康线，需提价或降本。`);
      if (!risks.length) risks.push('- 各项指标均在安全区。');
      L.push(risks.join('\n'));
      card.set(L.join('\n'), '资金分配方案.md');
      if (detail.length) {
        const f = detail[0];
        ECOM.setBrief({ name: f.name, cost: f.cost, price: f.price, capital: cap, tier: t.key + '档·' + t.name });
        ECOM.ui.toast('已存为选品简报，可前往标题/文案/详情页/做图');
      }
    });
  }
})();
