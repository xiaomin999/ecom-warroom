/* 一站式作战流水线：把选品简报一键跑通全部下游模块，汇成一套作战方案 */
(function () {
  // 调用顺序：先做图（离线可用）打头，再依次是各 AI 文本模块
  const ORDER = [
    { id: 'image', label: '图像生成 Prompt', btn: '#i_build', out: '#i_out', offline: true },
    { id: 'title', label: '标题生成', btn: '#t_gen', out: '#t_out' },
    { id: 'copy', label: '卖点文案', btn: '#c_gen', out: '#c_out' },
    { id: 'detail', label: '详情页', btn: '#d_gen', out: '#d_out' },
    { id: 'campaign', label: '活动策略', btn: '#cp_gen', out: '#cp_out' },
    { id: 'ads', label: '广告策略', btn: '#ad_gen', out: '#ad_out' }
  ];

  // 轮询等待模块结果写入 result 卡片的 dataset.raw
  function waitRaw(res, timeout) {
    return new Promise(resolve => {
      const start = Date.now();
      (function poll() {
        if (res && res.dataset && res.dataset.raw && res.dataset.raw.trim()) return resolve(res.dataset.raw);
        if (Date.now() - start > timeout) return resolve((res && res.dataset && res.dataset.raw) || '');
        setTimeout(poll, 300);
      })();
    });
  }

  // 在临时容器里渲染某模块（自动预填简报），点击其生成按钮并取回结果
  async function runModule(id, btnSel, outSel, offline) {
    const m = ECOM.modules.find(x => x.id === id);
    if (!m) return '（找不到模块）';
    const temp = document.createElement('div');
    document.body.appendChild(temp);
    try {
      m.render(temp);
      const btn = temp.querySelector(btnSel);
      if (!btn) return '（该模块无生成按钮）';
      btn.click();
      const res = temp.querySelector(outSel + ' .result');
      const raw = await waitRaw(res, offline ? 3000 : 25000);
      return raw && raw.trim() ? raw : '（生成失败或超时，请到对应模块重试）';
    } catch (e) {
      return '（生成出错：' + (e && e.message ? e.message : e) + '）';
    } finally {
      temp.remove();
    }
  }

  function assemble(brief, parts) {
    const L = [];
    L.push('# 选品作战方案全套');
    L.push('');
    const tag = [brief.name || '未命名', brief.platform, brief.tier].filter(Boolean).join(' · ');
    L.push('> 由选品简报一键生成：' + tag);
    L.push('');
    L.push('## 选品简报');
    L.push('- 方向：' + (brief.name || '-'));
    if (brief.price) L.push('- 客单价：¥' + brief.price);
    if (brief.platform) L.push('- 平台：' + brief.platform);
    if (brief.audience) L.push('- 目标人群：' + brief.audience);
    if (brief.feats) { const f = Array.isArray(brief.feats) ? brief.feats.join('、') : brief.feats; L.push('- 核心卖点：' + f); }
    if (brief.capital) L.push('- 可投资金：¥' + brief.capital);
    L.push('');
    parts.forEach(p => {
      L.push('## ' + p.label);
      L.push((p.text && p.text.trim()) ? p.text : '（无内容）');
      L.push('');
    });
    return L.join('\n');
  }

  ECOM.register({
    id: 'pipeline',
    name: '作战流水线',
    icon: '🚀',
    group: '一站式',
    desc: '把已保存的选品简报一键跑通 标题/文案/详情页/活动/广告/做图，汇成一套可复制的作战方案。',
    render(root) {
      function briefLine() {
        const b = ECOM.getBrief();
        if (!b || !b.name) return '<span class="hint">尚未保存选品简报。请先到「选品分析 → 💰 资金选品」填写并点"测算备货与运营建议"存为简报。</span>';
        const aud = b.audience ? (' · ' + b.audience) : '';
        return '<b>📌 当前简报：</b>' + b.name + (b.platform ? (' · ' + b.platform) : '') + aud + (b.tier ? (' · ' + b.tier) : '');
      }
      root.innerHTML = `
        <div class="card">
          <p id="pl_brief" style="margin-top:0">${briefLine()}</p>
          <p class="hint" style="margin:0 0 12px">一键调用下方全部模块（已自动带入简报）。图像 Prompt 离线可用；标题/文案/详情页/活动/广告 需先在「⚙️ 设置」配置模型 API。</p>
          <button class="primary-btn" id="pl_run" style="font-size:15px;padding:12px 18px">🚀 一键生成全套作战方案</button>
          <div id="pl_links" class="btn-row" style="margin-top:14px;flex-wrap:wrap"></div>
          <div id="pl_out"></div>
        </div>`;
      const links = root.querySelector('#pl_links');
      [['selection', '选品分析'], ['title', '标题'], ['copy', '文案'], ['detail', '详情页'], ['campaign', '活动'], ['ads', '广告'], ['image', '做图']].forEach(([id, name]) => {
        const b = document.createElement('button');
        b.className = 'secondary-btn'; b.style.padding = '6px 12px'; b.style.fontSize = '12px';
        b.textContent = '去' + name + '精修';
        b.addEventListener('click', () => { const n = document.querySelector('.nav-item[data-id="' + id + '"]'); if (n) n.click(); });
        links.appendChild(b);
      });
      const out = root.querySelector('#pl_out');
      const card = ECOM.ui.resultCard('选品作战方案全套');
      out.appendChild(card);

      root.querySelector('#pl_run').addEventListener('click', async (e) => {
        const b = ECOM.getBrief();
        if (!b || !b.name) { ECOM.ui.toast('请先保存选品简报（选品分析 → 资金选品 → 测算）'); return; }
        root.querySelector('#pl_brief').innerHTML = briefLine();
        const hasKey = ECOM.hasLLM();
        await ECOM.ui.run(e.target, async () => {
          const parts = [];
          for (const o of ORDER) {
            if (o.offline) {
              parts.push({ label: o.label, text: await runModule(o.id, o.btn, o.out, true) });
            } else if (hasKey) {
              parts.push({ label: o.label, text: await runModule(o.id, o.btn, o.out, false) });
            } else {
              parts.push({ label: o.label, text: '> ⚠️ 未配置模型 API，请到「⚙️ 设置」填写后重跑，或点上方"去' + o.label + '精修"到对应模块手动生成。' });
            }
          }
          card.set(assemble(b, parts), '选品作战方案全套.md');
        });
      });
    }
  });
})();
