/* 内容生成：标题 / 卖点文案 / 详情页（共享 LLM 引擎） */
(function () {
  const PLATFORMS = ['淘宝/天猫', '京东', '抖音电商', '拼多多', '小红书', '视频号', '快手电商'];

  /* ===== 标题生成 ===== */
  ECOM.register({
    id: 'title',
    name: '标题生成',
    icon: '🏷️',
    group: '内容',
    desc: '按平台风格批量生成高点击电商标题，支持埋词。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="row">
            <div class="field"><label>商品名 / 核心词</label>
              <input type="text" id="t_name" placeholder="例如：无线手持真空封口机"></div>
            <div class="field"><label>目标平台</label>
              <select id="t_plat">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>核心卖点 / 属性<span class="hint">每行一条</span></label>
            <textarea id="t_feat" placeholder="例如：&#10;干湿两用&#10;便携充电&#10;食品保鲜30天&#10;适用真空袋/罐/瓶"></textarea></div>
          <div class="row">
            <div class="field"><label>必埋关键词<span class="hint">选填，逗号分隔</span></label>
              <input type="text" id="t_kw" placeholder="vacuum sealer, food saver"></div>
            <div class="field"><label>生成条数</label>
              <select id="t_num"><option>10</option><option>5</option><option>15</option><option>20</option></select></div>
          </div>
          <div class="btn-row"><button class="primary-btn" id="t_gen">生成标题</button>
            <span class="hint">需配置模型 API</span></div>
          <div id="t_out"></div>
        </div>`;
      const out = root.querySelector('#t_out');
      const card = ECOM.ui.resultCard('标题方案');
      out.appendChild(card);
      root.querySelector('#t_gen').addEventListener('click', async (e) => {
        const name = v('#t_name'), plat = v('#t_plat'), feat = v('#t_feat'),
              kw = v('#t_kw'), num = v('#t_num');
        if (!name.trim()) { ECOM.ui.toast('请填写商品名/核心词'); return; }
        const prompt = `你是资深国内电商文案，请为「${name}」在【${plat}】平台生成 ${num} 条高点击率商品标题。
商品卖点：
${feat || '（未提供，请合理推断）'}
${kw ? '必须埋入的关键词：' + kw : ''}

要求：
- 符合 ${plat} 的标题风格与字数/字符上限（如淘宝/天猫 ≤30字、京东 ≤40字、抖音 ≤25字）。
- 突出核心卖点与搜索词，避免堆砌与违规词。
- 用 Markdown 有序列表输出 ${num} 条，每条后括号标注「埋词：xxx」与「适用场景」。
- 最后给一条「最优主推标题」并说明原因。`;
        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([ECOM.msg('system', '你是电商标题优化专家，擅长不同平台的关键词布局。'), ECOM.msg('user', prompt)], { temperature: 0.8 });
          card.set(text, '标题方案.md');
        });
      });
      function v(s){ return root.querySelector(s).value.trim(); }
      ECOM.applyBrief(root);
    }
  });

  /* ===== 卖点文案 / 五点描述 ===== */
  ECOM.register({
    id: 'copy',
    name: '卖点文案',
    icon: '✍️',
    group: '内容',
    desc: '生成详情页卖点文案 / 商品卖点提炼，可选调性。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="row">
            <div class="field"><label>商品名</label>
              <input type="text" id="c_name" placeholder="例如：便携无线真空封口机"></div>
            <div class="field"><label>目标平台</label>
              <select id="c_plat">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>核心卖点<span class="hint">每行一条</span></label>
            <textarea id="c_feat" placeholder="例如：&#10;干湿两用不漏液&#10;Type-C 充电便携&#10;静音≤60dB&#10;配套30只真空袋"></textarea></div>
          <div class="row">
            <div class="field"><label>文案调性</label>
              <select id="c_tone"><option>专业可信</option><option>亲切种草</option><option>促销紧迫</option><option>极简高级</option></select></div>
            <div class="field"><label>目标人群</label>
              <input type="text" id="c_aud" placeholder="例如：注重食材保鲜的家庭"></div>
          </div>
          <div class="btn-row"><button class="primary-btn" id="c_gen">生成文案</button>
            <span class="hint">需配置模型 API</span></div>
          <div id="c_out"></div>
        </div>`;
      const out = root.querySelector('#c_out');
      const card = ECOM.ui.resultCard('卖点文案');
      out.appendChild(card);
      root.querySelector('#c_gen').addEventListener('click', async (e) => {
        const name = v('#c_name'), plat = v('#c_plat'), feat = v('#c_feat'),
              tone = v('#c_tone'), aud = v('#c_aud');
        if (!name.trim()) { ECOM.ui.toast('请填写商品名'); return; }
        const prompt = `为「${name}」在【${plat}】写转化向文案，调性：${tone}；目标人群：${aud || '通用'}。
核心卖点：
${feat || '（请合理推断）'}

用中文 Markdown 输出：
## 一、核心卖点提炼（5 条）
每条以「**核心词**：」开头，突出利益点+证据，符合平台合规（不写绝对化违禁词）。

## 二、首屏主文案（约60字）
一句话抓住注意力。

## 三、场景化卖点段落
2–3 段，分别对应使用场景与痛点解决。

## 四、FAQ 预判
列出买家最可能问的 3 个问题并作答。`;
        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([ECOM.msg('system', '你是电商转化文案专家，擅长卖点提炼与合规表达。'), ECOM.msg('user', prompt)], { temperature: 0.7 });
          card.set(text, '卖点文案.md');
        });
      });
      function v(s){ return root.querySelector(s).value.trim(); }
      ECOM.applyBrief(root);
    }
  });

  /* ===== 详情页 ===== */
  ECOM.register({
    id: 'detail',
    name: '详情页',
    icon: '🖥️',
    group: '内容',
    desc: '生成详情页模块结构 + 每屏文案与配图建议。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="row">
            <div class="field"><label>商品名</label>
              <input type="text" id="d_name" placeholder="例如：便携无线真空封口机"></div>
            <div class="field"><label>目标平台/人群</label>
              <input type="text" id="d_aud" placeholder="例如：淘宝/天猫 / 注重食材保鲜的家庭"></div>
          </div>
          <div class="field"><label>核心卖点<span class="hint">每行一条</span></label>
            <textarea id="d_feat" placeholder="例如：&#10;干湿两用&#10;便携充电&#10;食品保鲜30天&#10;低噪静音"></textarea></div>
          <div class="field"><label>特殊要求<span class="hint">选填，如促销节点/品牌色/合规</span></label>
            <input type="text" id="d_req" placeholder="例如：黑五节奏、主色科技蓝、避免医疗宣称"></div>
          <div class="btn-row"><button class="primary-btn" id="d_gen">生成详情页方案</button>
            <span class="hint">需配置模型 API</span></div>
          <div id="d_out"></div>
        </div>`;
      const out = root.querySelector('#d_out');
      const card = ECOM.ui.resultCard('详情页方案');
      out.appendChild(card);
      root.querySelector('#d_gen').addEventListener('click', async (e) => {
        const name = v('#d_name'), aud = v('#d_aud'), feat = v('#d_feat'), req = v('#d_req');
        if (!name.trim()) { ECOM.ui.toast('请填写商品名'); return; }
        const prompt = `为「${name}」设计一套电商详情页方案。
目标人群/平台：${aud || '通用'}
核心卖点：
${feat || '（请合理推断）'}
特殊要求：${req || '无'}

用中文 Markdown 输出：
## 一、页面模块顺序（从上到下）
给出 8–12 个模块，如：首屏主图卖点→痛点场景→核心功能→参数对比→使用步骤→场景图→背书/评价→促销→FAQ→保障。

## 二、逐模块文案
每个模块给：标题文案 + 正文要点 + 配图/版式建议（标注“主图/场景图/信息图”）。

## 三、转化钩子
首屏 3 秒抓眼文案与底部催单话术。

注意：文案合规，避免绝对化与虚假承诺。`;
        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([ECOM.msg('system', '你是电商详情页策划，擅长转化路径与视觉叙事。'), ECOM.msg('user', prompt)], { temperature: 0.6 });
          card.set(text, '详情页方案.md');
        });
      });
      function v(s){ return root.querySelector(s).value.trim(); }
      ECOM.applyBrief(root);
    }
  });
})();
