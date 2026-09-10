/* 货源参谋：找货导航 / 货源体检 / 代发决策 / 供应商对比，解决电商货源难题。 */
(function () {
  const PLATS = ['淘宝/天猫', '京东', '抖音电商', '拼多多', '小红书', '视频号', '快手电商', '1688'];

  function tierOf(cap) { return cap >= 200000 ? 'D' : cap >= 50000 ? 'C' : cap >= 10000 ? 'B' : cap > 0 ? 'A' : ''; }
  function tierName(t) { return { A: 'A·轻启动(<1万)', B: 'B·标准(1-5万)', C: 'C·进阶(5-20万)', D: 'D·规模化(>20万)' }[t] || '未定'; }

  function parseJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const sObj = t.indexOf('{'), eObj = t.lastIndexOf('}');
    if (sObj >= 0 && eObj > sObj) {
      try { const o = JSON.parse(t.slice(sObj, eObj + 1)); if (o && typeof o === 'object') return o; } catch (e) {}
    }
    const sArr = t.indexOf('['), eArr = t.lastIndexOf(']');
    if (sArr >= 0 && eArr > sArr) {
      try { const a = JSON.parse(t.slice(sArr, eArr + 1)); if (Array.isArray(a)) return a; } catch (e) {}
    }
    return null;
  }

  ECOM.register({
    id: 'sourcing',
    name: '货源参谋',
    icon: '📦',
    group: '货源',
    desc: '解决货源难题：找货导航、货源体检打分、代发 vs 囤货决策、多供应商对比导出，全在国内电商语境。',
    render(root) {
      const cap = ECOM._capital || (ECOM.store.get() || {}).capital || 0;
      root.innerHTML = `
        <div class="card">
          <p style="margin-top:0"><b>📦 货源参谋</b> · 货源是电商利润与风险的核心。这里帮你解决四件事：<b>去哪找、怎么辨、定什么价、怎么避坑</b>。所有工具都可离线用，联网部分复用你在「⚙️ 模型设置」填的模型。</p>
          ${cap > 0 ? `<p class="hint" style="margin:6px 0 0">检测到你的可投资金约 <b>¥${cap.toLocaleString()}</b>（资金档 ${tierName(tierOf(cap))}），代发决策会自动按此匹配。</p>` : ''}
        </div>
        <div class="tabs" id="srcTabs">
          <button class="tab active" data-t="guide">🔍 找货导航</button>
          <button class="tab" data-t="check">🩺 货源体检</button>
          <button class="tab" data-t="dropship">📦 代发决策</button>
          <button class="tab" data-t="compare">📊 供应商对比</button>
        </div>
        <div id="srcPanel"></div>`;

      const panel = root.querySelector('#srcPanel');
      const tabs = root.querySelector('#srcTabs');
      const holders = {};
      function ensureTab(t) {
        if (holders[t]) return holders[t];
        const h = document.createElement('div');
        h.style.display = 'none';
        panel.appendChild(h);
        holders[t] = h;
        ({ guide: renderGuide, check: renderCheck, dropship: renderDropship, compare: renderCompare }[t])(h);
        return h;
      }
      function showTab(t) {
        Object.values(holders).forEach(h => h.style.display = 'none');
        const h = ensureTab(t);
        h.style.display = '';
        tabs.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.t === t));
        try { ECOM.store.set({ sourcingTab: t }); } catch (e) {}
      }
      tabs.addEventListener('click', e => {
        const b = e.target.closest('.tab'); if (!b) return;
        showTab(b.dataset.t);
      });
      const lastTab = (ECOM.store.get().sourcingTab) || 'guide';
      showTab(['guide', 'check', 'dropship', 'compare'].includes(lastTab) ? lastTab : 'guide');

      /* ============ 子 tab 1：找货导航 ============ */
      function renderGuide(h) {
        const brief = ECOM.getBrief();
        const defName = (brief && brief.name) || '';
        h.innerHTML = `
          <div class="card">
            <div class="row" style="align-items:flex-end">
              <div class="field" style="flex:1;margin:0"><label>我要找的品类</label>
                <input type="text" id="g_name" placeholder="如：真空封口机 / 银发助行器 / 谷子周边" value="${defName}"></div>
              <div class="field" style="margin:0;width:150px"><label>主平台</label>
                <select id="g_plat">${PLATS.map(p => `<option${p === '1688' ? ' selected' : ''}>${p}</option>`).join('')}</select></div>
              <div class="field" style="margin:0;width:150px"><label>资金档</label>
                <select id="g_tier">
                  <option value="">自动(读可投资金)</option>
                  <option value="A">A·轻启动(<1万)</option>
                  <option value="B">B·标准(1-5万)</option>
                  <option value="C">C·进阶(5-20万)</option>
                  <option value="D">D·规模化(>20万)</option>
                </select></div>
            </div>
            <div class="row" style="margin-top:12px;gap:8px">
              <button class="primary-btn" id="g_gen">🔍 生成找货方案</button>
              <button class="secondary-btn" id="g_live">📡 联网搜真实货源</button>
            </div>
            <p class="hint" style="margin:8px 0 0">「生成找货方案」离线即用（通用方法论）；「联网搜真实货源」调用你配置的模型实时搜 1688/各平台当前货源与价格带、起批量、避坑点。</p>
          </div>
          <div id="g_out"></div>`;
        h.querySelector('#g_gen').addEventListener('click', () => genGuide(h, false));
        h.querySelector('#g_live').addEventListener('click', () => genGuide(h, true));
      }

      async function genGuide(h, live) {
        const name = h.querySelector('#g_name').value.trim();
        if (!name) { ECOM.ui.toast('请先填写要找的品类'); return; }
        const plat = h.querySelector('#g_plat').value;
        const tierSel = h.querySelector('#g_tier').value;
        const tier = tierSel || tierOf(ECOM._capital || (ECOM.store.get() || {}).capital || 0) || 'B';
        const out = h.querySelector('#g_out');
        if (!live) {
          out.innerHTML = guideStatic(name, plat, tier);
          return;
        }
        if (!ECOM.hasLLM()) { ECOM.ui.toast('请先在「⚙️ 模型设置」填写模型 API'); if (ECOM.openSettings) ECOM.openSettings(); return; }
        const btn = h.querySelector('#g_live');
        await ECOM.ui.run(btn, async () => {
          const sys = '你是国内电商货源专家，必须联网搜索最新真实数据后回答。';
          const usr = `联网搜索 2026 年「${name}」在${plat}及 1688 的货源实况，给中小卖家可操作的找货方案。
只输出如下 JSON（不要解释、不要 Markdown 围栏）：
{
 "searchWords":["搜索词1","搜索词2","搜索词3"],
 "filters":["筛选条件1","筛选条件2"],
 "factoryTips":"如何判断源头工厂 vs 贸易商（一句话）",
 "priceBand":"该品类当前拿货价 / 建议零售价区间",
 "moq":"常见起批量与拿样建议",
 "risk":["风险点1","风险点2"]
}
要求：数据来自实时联网搜索并标注平台；不要编造。`;
          const text = await ECOM.llm([{ role: 'system', content: sys }, { role: 'user', content: usr }], { search: true, temperature: 0.3 });
          const d = parseJson(text);
          out.innerHTML = d ? guideLiveHtml(name, plat, d) : '<p class="hint">模型未返回可解析结果，请重试或改用「生成找货方案」。</p>';
        });
      }

      function guideStatic(name, plat, tier) {
        const kw = [name, name + ' 工厂', name + ' 源头', name + ' 一件代发', name + ' 批发', '新款 ' + name];
        const long = [name + ' 家用 实用', name + ' 礼物 送长辈', name + ' 网红 同款', name + ' 平价 学生'];
        const facTips = plat === '1688'
          ? '看是否带「牛头标/实力商家/深度验厂」、成立年限≥3 年、响应快、详情用实拍而非精修图，多半是源头厂；只放代理图、起批量大但不接小单的常为贸易商。'
          : '在 ' + plat + ' 找货优先用「抖音供应链/拼多多代发/1688 一键铺货」，重点看商家是否支持「48h 发货、7 天无理由、提供实拍视频」。';
        const moq = { A: '先一件代发/拿样 3-5 件测品，不囤货', B: '首单小批量 20-50 件测款，爆了再加单', C: '可谈 100-300 件备货，谈账期', D: '直接找工厂贴牌/定制，MOQ 500+' }[tier];
        const tags = arr => arr.map(x => `<span class="src-tag">${escapeText(x)}</span>`).join('');
        return `<div class="card">
          <h3 style="margin-top:0">🔍 ${name} · 找货方案（${plat} · ${tierName(tier)}）</h3>
          <div class="src-section">
            <div class="src-section-title">① 搜索词组合</div>
            <div class="src-row"><span class="src-label">核心词</span><div class="src-tags">${tags(kw.slice(0, 3))}</div></div>
            <div class="src-row"><span class="src-label">长尾词</span><div class="src-tags">${tags(long)}</div></div>
            <p class="hint" style="margin:10px 0 0">技巧：先用核心词筛「实力商家/牛头标」，再换长尾词找细分机会。</p>
          </div>
          <div class="src-section">
            <div class="src-section-title">② 筛选条件（按优先级）</div>
            <ol class="src-list">
              <li><b>深度验厂 / 实力商家</b><span>有实地认证，踩雷概率低</span></li>
              <li><b>牛头标</b><span>1688 源头工厂标识，优先合作</span></li>
              <li><b>交易勋章 / 复购率</b><span>≥3 冠或复购率高更稳</span></li>
              <li><b>响应 & 发货</b><span>响应≤1h、48h 内发货</span></li>
              <li><b>退款率</b><span>低于行业均值</span></li>
            </ol>
          </div>
          <div class="src-section">
            <div class="src-section-title">③ 源头工厂 vs 贸易商判断</div>
            <p style="margin:0">${facTips}</p>
          </div>
          <div class="src-section">
            <div class="src-section-title">④ 起批量与拿样建议</div>
            <p style="margin:0"><span class="src-badge">${tierName(tier)}</span> ${moq}</p>
          </div>
          <div class="src-section risk">
            <div class="src-section-title">⑤ 新手避坑</div>
            <ul class="src-list">
              <li>先拿样再大货，确认质量/包装/发货速度</li>
              <li>问清退换货政策与运费谁出</li>
              <li>不要一次性大额定金，分批付</li>
              <li>警惕「爆款保证」「稳赚」话术</li>
            </ul>
          </div>
        </div>`;
      }

      function guideLiveHtml(name, plat, d) {
        const arr = a => Array.isArray(a) ? a.map(x => '<li>' + escapeText(x) + '</li>').join('') : '';
        const tags = a => Array.isArray(a) ? a.map(x => `<span class="src-tag">${escapeText(x)}</span>`).join('') : '';
        return `<div class="card">
          <h3 style="margin-top:0">📡 ${name} · 实时货源（${plat}）</h3>
          ${d.searchWords ? `<div class="src-section"><div class="src-section-title">搜索词组合</div><div class="src-tags">${tags(d.searchWords)}</div></div>` : ''}
          ${d.filters ? `<div class="src-section"><div class="src-section-title">筛选条件</div><ol class="src-list">${arr(d.filters)}</ol></div>` : ''}
          ${d.factoryTips ? `<div class="src-section"><div class="src-section-title">源头判断</div><p style="margin:0">${escapeText(d.factoryTips)}</p></div>` : ''}
          ${d.priceBand ? `<div class="src-section"><div class="src-section-title">价格带</div><p style="margin:0">${escapeText(d.priceBand)}</p></div>` : ''}
          ${d.moq ? `<div class="src-section"><div class="src-section-title">起批量 / 拿样</div><p style="margin:0">${escapeText(d.moq)}</p></div>` : ''}
          ${d.risk ? `<div class="src-section risk"><div class="src-section-title">风险点</div><ul class="src-list">${arr(d.risk)}</ul></div>` : ''}
          <p class="hint" style="margin:0">数据来自你配置的模型实时联网搜索，仅供参考，下单前务必自行拿样核实。</p>
        </div>`;
      }

      /* ============ 子 tab 2：货源体检 ============ */
      function renderCheck(h) {
        h.innerHTML = `
          <div class="card">
            <p style="margin-top:0"><b>🩺 货源体检打分卡</b> · 把供应商信息填进去，自动算靠谱度；也可贴店铺描述让 AI 体检。</p>
            <div class="row" style="flex-wrap:wrap;gap:14px">
              <div class="field" style="margin:0;width:150px"><label>店铺评分(1-5)</label><input type="number" id="c_score" min="1" max="5" step="0.1" value="4.5"></div>
              <div class="field" style="margin:0;width:130px"><label>经营年限(年)</label><input type="number" id="c_years" min="0" step="1" value="3"></div>
              <div class="field" style="margin:0;width:130px"><label>响应速度</label><select id="c_resp"><option>快(≤1h)</option><option selected>中(当天)</option><option>慢(>1天)</option></select></div>
              <div class="field" style="margin:0;width:130px"><label>退货/差评率(%)</label><input type="number" id="c_ret" min="0" max="100" step="0.5" value="3"></div>
            </div>
            <div class="row" style="flex-wrap:wrap;gap:14px;margin-top:12px">
              <label class="chk"><input type="checkbox" id="c_verify" checked> 深度验厂</label>
              <label class="chk"><input type="checkbox" id="c_cheng"> 诚企/实力商家</label>
              <label class="chk"><input type="checkbox" id="c_niu"> 牛头标(源头)</label>
              <label class="chk"><input type="checkbox" id="c_df" checked> 支持一件代发</label>
              <label class="chk"><input type="checkbox" id="c_qc"> 能提供质检/授权</label>
            </div>
            <div class="row" style="margin-top:14px;gap:8px">
              <button class="primary-btn" id="c_calc">🩺 计算靠谱度</button>
              <button class="secondary-btn" id="c_ai">🤖 AI 体检(贴描述)</button>
            </div>
          </div>
          <div id="c_out"></div>`;
        h.querySelector('#c_calc').addEventListener('click', () => calcCheck(h));
        h.querySelector('#c_ai').addEventListener('click', () => aiCheck(h));
      }

      function calcCheck(h) {
        const score = Math.max(0, Math.min(5, parseFloat(h.querySelector('#c_score').value) || 0));
        const years = parseFloat(h.querySelector('#c_years').value) || 0;
        const resp = h.querySelector('#c_resp').value;
        const ret = parseFloat(h.querySelector('#c_ret').value) || 0;
        const verify = h.querySelector('#c_verify').checked;
        const cheng = h.querySelector('#c_cheng').checked;
        const niu = h.querySelector('#c_niu').checked;
        const df = h.querySelector('#c_df').checked;
        const qc = h.querySelector('#c_qc').checked;
        // 加权：评分40 + 年限15 + 响应15 + 资质20 + 退货10(反向)
        let s = score / 5 * 40;
        s += Math.min(years, 5) / 5 * 15;
        s += (resp.indexOf('快') >= 0 ? 15 : resp.indexOf('中') >= 0 ? 10 : 4);
        s += (verify ? 8 : 0) + (cheng ? 6 : 0) + (niu ? 6 : 0) + (df ? 4 : 0) + (qc ? 4 : 0);
        s += Math.max(0, (8 - ret)) / 8 * 10;
        s = Math.round(Math.min(100, s));
        let grade, color, advice;
        if (s >= 85) { grade = '优质'; color = '#0a7d3b'; advice = '可重点合作，可谈小批量备货与账期。'; }
        else if (s >= 70) { grade = '可用'; color = '#1f6feb'; advice = '可先代发/小单测款，观察发货与售后稳定性。'; }
        else if (s >= 55) { grade = '谨慎'; color = '#b8860b'; advice = '仅适合一件代发，不预付大额定金，严格拿样。'; }
        else { grade = '高风险'; color = '#c0392b'; advice = '不建议合作，踩雷概率高，换源头厂。'; }
        const risks = [];
        if (ret > 5) risks.push('退货/差评率偏高（>' + ret + '%），需核查质量');
        if (!verify && !niu) risks.push('无深度验厂/牛头标，源头属性存疑，优先换带标商家');
        if (resp.indexOf('慢') >= 0) risks.push('响应慢，大促易掉链子，确认发货时效');
        if (years < 2) risks.push('经营年限短（' + years + '年），抗风险能力弱');
        if (!df) risks.push('不支持一件代发，新手资金占用大');
        const talk = [];
        talk.push('【拿样】“先拍 3 件样品看质量/包装/发货速度，没问题再下大单，样品费可抵货款吗？”');
        talk.push('【问产能】“日产能多少？大促能稳发吗？交期几天？”');
        talk.push('【压价】“首单 ' + (df ? '代发' : '50') + ' 件这个价，后续稳定返单能到多少？给个返单价。”');
        if (!qc) talk.push('【资质】“能提供质检报告/品牌授权吗？上架平台要审核。”');
        h.querySelector('#c_out').innerHTML = `<div class="card">
          <div class="score-badge" style="border-color:${color}">
            <span class="num" style="color:${color}">${s}</span><span class="lab">分 · ${grade}</span>
          </div>
          <p style="margin:10px 0 0">${advice}</p>
          ${risks.length ? `<div class="cat-block risk"><b>风险点</b><ul>${risks.map(r => '<li>' + r + '</li>').join('')}</ul></div>` : '<p class="hint">未发现明显风险点。</p>'}
          <div class="cat-block"><b>私聊话术</b><ul>${talk.map(t => '<li>' + t + '</li>').join('')}</ul></div>
        </div>`;
      }

      async function aiCheck(h) {
        if (!ECOM.hasLLM()) { ECOM.ui.toast('请先在「⚙️ 模型设置」填写模型 API'); if (ECOM.openSettings) ECOM.openSettings(); return; }
        const desc = prompt('粘贴供应商/店铺描述（名称、评分、年限、产品、起批量、发货等），AI 帮你体检：');
        if (!desc) return;
        const out = h.querySelector('#c_out');
        await ECOM.ui.run(h.querySelector('#c_ai'), async () => {
          const sys = '你是电商货源风控专家。';
          const usr = `根据下面供应商描述，判断靠谱度并给风险点与话术。只输出 JSON（不要解释、不要围栏）：
{
 "score": 0-100整数,
 "grade":"优质/可用/谨慎/高风险",
 "risk":["风险点1","风险点2"],
 "talk":["话术1","话术2"]
}
描述：${desc}`;
          const d = parseJson(await ECOM.llm([{ role: 'system', content: sys }, { role: 'user', content: usr }], { temperature: 0.3 }));
          if (!d) { out.innerHTML = '<p class="hint">AI 未返回可解析结果，请重试。</p>'; return; }
          const color = d.grade === '优质' ? '#0a7d3b' : d.grade === '可用' ? '#1f6feb' : d.grade === '谨慎' ? '#b8860b' : '#c0392b';
          out.innerHTML = `<div class="card">
            <div class="score-badge" style="border-color:${color}"><span class="num" style="color:${color}">${d.score || '-'}</span><span class="lab">分 · ${d.grade || ''}</span></div>
            ${d.risk ? `<div class="cat-block risk"><b>风险点</b><ul>${d.risk.map(r => '<li>' + escapeText(r) + '</li>').join('')}</ul></div>` : ''}
            ${d.talk ? `<div class="cat-block"><b>私聊话术</b><ul>${d.talk.map(t => '<li>' + escapeText(t) + '</li>').join('')}</ul></div>` : ''}
          </div>`;
        });
      }

      /* ============ 子 tab 3：代发决策 ============ */
      function renderDropship(h) {
        const cap = ECOM._capital || (ECOM.store.get() || {}).capital || 0;
        const tier = tierOf(cap) || 'B';
        const plans = {
          A: { mode: '纯一件代发', first: Math.round(cap * 0.3), buffer: Math.round(cap * 0.5), txt: '资金少，绝对不囤货。用 1688/拼多多代发或抖音供应链，出单后厂家直发，你只赚差价。首单测品预算控制在可投资金的 30%，留 50% 做安全垫与推广。' },
          B: { mode: '代发为主 + 爆款小批囤', first: Math.round(cap * 0.4), buffer: Math.round(cap * 0.3), txt: '主流款代发跑量，验证过的爆款小批量（20-50 件）自己囤以压低单价、控发货时效。首单测品 40%，安全垫 30%，剩余留作返单与投流。' },
          C: { mode: '代发 + 囤货并行', first: Math.round(cap * 0.5), buffer: Math.round(cap * 0.2), txt: '已验证品类可提前备货（100-300 件）谈更低拿货价，长尾款仍代发降低库存 risk。首单 50% 用于确定性爆款，20% 安全垫。' },
          D: { mode: '工厂直供 / 贴牌定制', first: Math.round(cap * 0.6), buffer: Math.round(cap * 0.15), txt: '可找工厂 OEM/贴牌，MOQ 500+ 拿最优价，建自有供给壁垒。首单 60% 备核心款，15% 安全垫，其余投品牌与渠道。' }
        };
        const p = plans[tier];
        h.innerHTML = `<div class="card">
          <h3 style="margin-top:0">📦 代发 vs 囤货决策（资金档 ${tierName(tier)}）</h3>
          <p><b>推荐模式：</b>${p.mode}</p>
          <div class="cat-line"><span>可投资金</span><b>¥${cap ? cap.toLocaleString() : '未填（去「选品分析」顶部填）'}</b></div>
          <div class="cat-line"><span>首单测品/备货预算</span><b>¥${p.first.toLocaleString()}</b></div>
          <div class="cat-line"><span>安全垫（推广/应急）</span><b>¥${p.buffer.toLocaleString()}</b></div>
          <div class="cat-block"><b>策略说明</b><p>${p.txt}</p></div>
          <div class="cat-block"><b>落地步骤</b>
            <ol>
              <li>选 1-2 个品类，用「找货导航」找 3-5 个候选货源</li>
              <li>全部先拿样，用「货源体检」打分，留分数≥70 的</li>
              <li>上架代发测款，盯 3-7 天转化率/退货率</li>
              <li>跑出爆款后按上面预算小批囤，压单价、控时效</li>
              <li>周转 2-3 轮稳定后再加单或谈账期</li>
            </ol>
          </div>
          <div class="cat-block risk"><b>资金红线</b><p>任何单一货源预付不超过可投资金 40%；不押"爆款保证"；库龄超 60 天未动销立即清仓换款。</p></div>
        </div>`;
      }

      /* ============ 子 tab 4：供应商对比 ============ */
      function renderCompare(h) {
        const rows = ECOM.store.get().srcCompare || [
          { name: '', link: '', price: '', moq: '', addr: '', score: '', dropship: '', sample: '', cycle: '', ship: '', note: '' },
          { name: '', link: '', price: '', moq: '', addr: '', score: '', dropship: '', sample: '', cycle: '', ship: '', note: '' }
        ];
        h.innerHTML = `
          <div class="card">
            <p style="margin-top:0"><b>📊 供应商对比</b> · 录入多家货源横向比价，自动高亮最低价/最高评分，可导出 PDF/Word 拿去谈。</p>
            <p class="hint" style="margin:0">建议记录：链接、拿货价、起批量、发货地、评分、是否一件代发、样品费、供货周期、运费、备注。</p>
            <div id="cmp_rows" style="overflow-x:auto;margin-top:10px"></div>
            <div class="row" style="margin-top:10px;gap:8px">
              <button class="secondary-btn" id="cmp_add">＋ 加一行</button>
              <button class="secondary-btn" id="cmp_clear">清空</button>
              <button class="primary-btn" id="cmp_pdf">📑 导出 PDF</button>
              <button class="primary-btn" id="cmp_doc">📝 导出 Word</button>
            </div>
          </div>`;
        const box = h.querySelector('#cmp_rows');
        const FIELDS = [
          ['name', '供应商'],
          ['link', '链接'],
          ['price', '拿货价¥'],
          ['moq', '起批量'],
          ['addr', '发货地'],
          ['score', '评分'],
          ['dropship', '代发'],
          ['sample', '样品费¥'],
          ['cycle', '周期'],
          ['ship', '运费¥'],
          ['note', '备注']
        ];
        const isUrl = s => /^https?:\/\//.test(String(s).trim());
        function cellHtml(r, i, k) {
          const v = r[k] || '';
          if (k === 'link') return `<a href="${isUrl(v) ? escapeAttr(v) : '#'}" target="_blank" rel="noopener" class="cmp-link${isUrl(v) ? '' : ' disabled'}">${isUrl(v) ? '打开' : '—'}</a><input data-r="${i}" data-k="link" value="${escapeAttr(v)}" placeholder="https://...">`;
          if (k === 'dropship') return `<select data-r="${i}" data-k="dropship"><option value="">请选择</option><option value="是" ${v === '是' ? 'selected' : ''}>是</option><option value="否" ${v === '否' ? 'selected' : ''}>否</option></select>`;
          return `<input data-r="${i}" data-k="${k}" value="${escapeAttr(v)}" placeholder="${k === 'cycle' ? '如 3-5天' : ''}">`;
        }
        function draw() {
          box.innerHTML = `<table class="cmp-table"><thead><tr>${FIELDS.map(f => '<th>' + f[1] + '</th>').join('')}<th></th></tr></thead><tbody>${rows.map((r, i) => '<tr>' + FIELDS.map(f => `<td>${cellHtml(r, i, f[0])}</td>`).join('') + `<td><button class="cmp-del" data-i="${i}">✕</button></td>`).join('')}</tbody></table>`;
          highlight();
          box.querySelectorAll('input,select').forEach(inp => inp.addEventListener('input', () => {
            rows[+inp.dataset.r][inp.dataset.k] = inp.value;
            ECOM.store.set({ srcCompare: rows });
            if (inp.dataset.k === 'price' || inp.dataset.k === 'score' || inp.dataset.k === 'dropship') highlight();
            if (inp.dataset.k === 'link') draw(); // 重新渲染让链接状态更新
          }));
          box.querySelectorAll('.cmp-del').forEach(b => b.addEventListener('click', () => {
            rows.splice(+b.dataset.i, 1); if (!rows.length) rows.push({ name: '', link: '', price: '', moq: '', addr: '', score: '', dropship: '', sample: '', cycle: '', ship: '', note: '' });
            ECOM.store.set({ srcCompare: rows }); draw();
          }));
        }
        function highlight() {
          const t = box.querySelector('table'); if (!t) return;
          const body = t.querySelector('tbody'); if (!body) return;
          body.querySelectorAll('td').forEach(td => td.classList.remove('best-price', 'best-score', 'has-dropship'));
          const priceIdx = FIELDS.findIndex(f => f[0] === 'price');
          const scoreIdx = FIELDS.findIndex(f => f[0] === 'score');
          const dsIdx = FIELDS.findIndex(f => f[0] === 'dropship');
          const nums = rows.map(r => parseFloat(String(r.price).replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n) && n > 0);
          const minPrice = nums.length ? Math.min(...nums) : null;
          const scores = rows.map(r => parseFloat(r.score)).filter(n => !isNaN(n) && n > 0);
          const maxScore = scores.length ? Math.max(...scores) : null;
          Array.from(body.rows).forEach((tr, i) => {
            const r = rows[i];
            if (minPrice != null) {
              const p = parseFloat(String(r.price).replace(/[^0-9.]/g, ''));
              if (!isNaN(p) && p === minPrice) tr.cells[priceIdx].classList.add('best-price');
            }
            if (maxScore != null) {
              const s = parseFloat(r.score);
              if (!isNaN(s) && s === maxScore) tr.cells[scoreIdx].classList.add('best-score');
            }
            if (r.dropship === '是' && dsIdx >= 0) tr.cells[dsIdx].classList.add('has-dropship');
          });
        }
        draw();
        h.querySelector('#cmp_add').addEventListener('click', () => { rows.push({ name: '', link: '', price: '', moq: '', addr: '', score: '', dropship: '', sample: '', cycle: '', ship: '', note: '' }); ECOM.store.set({ srcCompare: rows }); draw(); });
        h.querySelector('#cmp_clear').addEventListener('click', () => { rows.length = 0; rows.push({ name: '', link: '', price: '', moq: '', addr: '', score: '', dropship: '', sample: '', cycle: '', ship: '', note: '' }); ECOM.store.set({ srcCompare: rows }); draw(); });
        function toMd() {
          const head = '| ' + FIELDS.map(f => f[1]).join(' | ') + ' |';
          const sep = '| ' + FIELDS.map(() => '---').join(' | ') + ' |';
          const body = rows.filter(r => r.name).map(r => '| ' + FIELDS.map(f => {
            let v = r[f[0]] || '';
            if (f[0] === 'link' && isUrl(v)) v = `[链接](${v})`;
            return v;
          }).join(' | ') + ' |').join('\n');
          return '# 供应商对比\n\n' + head + '\n' + sep + '\n' + body + '\n';
        }
        h.querySelector('#cmp_pdf').addEventListener('click', () => ECOM.ui.exportPDF('供应商对比.pdf', '供应商对比', toMd()));
        h.querySelector('#cmp_doc').addEventListener('click', () => ECOM.ui.exportWord('供应商对比.doc', '供应商对比', toMd()));
      }
    }
  });

  function escapeText(s) { return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
})();
