/* 市场情报模块：需求洞察 + 竞品分析
 * 两者均基于已接入的 LLM（通义千问等）生成报告，纯前端、不依赖爬虫。
 * - 需求洞察：输入「场景词」让模型推断机会；或「粘贴真实笔记/评论」做素材增强分析。
 * - 竞品分析：粘贴商品链接/标题/笔记/截图描述，模型拆解卖点、定价、人群、货源与风险。
 */
(function () {
  const PLATFORMS = ['淘宝/天猫', '京东', '抖音电商', '拼多多', '小红书', '视频号', '快手电商', '1688'];
  const TIERS = ['A（<1万）', 'B（1-5万）', 'C（5-20万）', 'D（>20万）'];

  /* ===================== 需求洞察 ===================== */
  ECOM.register({
    id: 'insight',
    name: '需求洞察',
    icon: '🧭',
    group: '市场情报',
    desc: '输入一个场景词或粘贴真实笔记/评论，AI 输出商业机会报告（需求、机会、赚钱切入点、风险）。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="intel-tabs">
            <button class="intel-tab active" data-mode="word">场景词模式</button>
            <button class="intel-tab" data-mode="raw">真实素材模式</button>
          </div>

          <div id="ins_word" class="intel-pane">
            <div class="field"><label>场景词 / 品类 / 需求词</label>
              <input type="text" id="iw_word" placeholder="例如：带父母旅游好物 / 便携榨汁杯 / 办公室久坐神器"></div>
            <div class="row">
              <div class="field"><label>目标平台</label>
                <select id="iw_plat">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
              <div class="field"><label>可投资金档</label>
                <select id="iw_tier">${TIERS.map(t => `<option>${t}</option>`).join('')}</select></div>
            </div>
          </div>

          <div id="ins_raw" class="intel-pane" hidden>
            <div class="field"><label>粘贴真实笔记标题 / 评论 / 用户原话<span class="hint">每行一条，越多越准</span></label>
              <textarea id="iw_raw" style="min-height:130px" placeholder="例如：&#10;出差住酒店总担心枕头不干净，自己带又占地方&#10;给爸妈买了个便携按摩仪，他们天天用&#10;露营想喝冰的但保温杯不够冷…"></textarea></div>
            <div class="row">
              <div class="field"><label>目标平台</label>
                <select id="iw_plat2">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
              <div class="field"><label>可投资金档</label>
                <select id="iw_tier2">${TIERS.map(t => `<option>${t}</option>`).join('')}</select></div>
            </div>
          </div>

          <div class="field"><label>方向名称<span class="hint">用于存入选品库，便于后续对比</span></label>
            <input type="text" id="iw_name" placeholder="例如：便携旅游好物 / 便携榨汁杯"></div>

          <div class="btn-row"><button class="primary-btn" id="iw_gen">生成需求洞察</button>
            <span class="hint">需配置模型 API（⚙️ 模型设置）</span></div>
          <div id="iw_out"></div>
        </div>`;

      // tab 切换
      const tabs = root.querySelectorAll('.intel-tab');
      tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const mode = t.dataset.mode;
        root.querySelector('#ins_word').hidden = mode !== 'word';
        root.querySelector('#ins_raw').hidden = mode !== 'raw';
      }));

      const out = root.querySelector('#iw_out');
      const card = ECOM.ui.resultCard('需求洞察报告');
      out.appendChild(card);

      // 存入选品库
      const saveBtn = document.createElement('button');
      saveBtn.className = 'secondary-btn';
      saveBtn.style.cssText = 'padding:7px 12px;font-size:13px;margin-left:8px';
      saveBtn.textContent = '📥 存入选品库';
      saveBtn.addEventListener('click', () => {
        const name = root.querySelector('#iw_name').value.trim();
        if (!name) { ECOM.ui.toast('请先填写「方向名称」'); root.querySelector('#iw_name').focus(); return; }
        const mode = root.querySelector('.intel-tab.active').dataset.mode;
        const plat = mode === 'word'
          ? root.querySelector('#iw_plat').value
          : root.querySelector('#iw_plat2').value;
        const tier = mode === 'word'
          ? root.querySelector('#iw_tier').value
          : root.querySelector('#iw_tier2').value;
        ECOM.setBrief({ name, platform: plat, tier, feats: ['需求洞察报告已生成'], kind: 'insight' });
        ECOM.ui.toast('已存入选品库：' + name);
      });
      card.querySelector('.btn-row').appendChild(saveBtn);

      root.querySelector('#iw_gen').addEventListener('click', async (e) => {
        const mode = root.querySelector('.intel-tab.active').dataset.mode;
        let word = '', raw = '', plat, tier;
        if (mode === 'word') {
          word = root.querySelector('#iw_word').value.trim();
          plat = root.querySelector('#iw_plat').value;
          tier = root.querySelector('#iw_tier').value;
          if (!word) { ECOM.ui.toast('请填写场景词'); return; }
        } else {
          raw = root.querySelector('#iw_raw').value.trim();
          plat = root.querySelector('#iw_plat2').value;
          tier = root.querySelector('#iw_tier2').value;
          if (!raw) { ECOM.ui.toast('请粘贴真实素材'); return; }
        }
        const name = root.querySelector('#iw_name').value.trim();

        const prompt = mode === 'word'
          ? `你是电商选品与需求洞察专家。请基于"场景词"推断真实消费机会，输出一份需求洞察报告。
【场景词 / 品类】${word}
【目标平台】${plat}
【可投资金档】${tier}

用中文 Markdown 输出，严格包含以下章节：
## 一、一页结论
3-5 句话总览：这个方向值不值得做、核心机会在哪。
## 二、最值得关注的真实需求
列出 3-5 个用户真实痛点/需求，每条：需求描述 + 为什么成立 + 对应人群。
## 三、最值得验证的商业机会
列出 2-4 个可落地的产品/内容机会，每条：机会点 + 切入方式 + 预期客群。
## 四、最容易获得第一笔收入
给出 1-2 个最小可行切入点（低门槛、快验证、能先赚到钱），含大致启动方式与成本区间。
## 五、长期规模化潜力
这个方向能否从单品扩展到品类/品牌，扩张路径与瓶颈。
## 六、最大判断风险
最可能看错的地方、数据偏差、竞争/供应/合规风险。
## 七、结合资金档的建议
针对【${tier}】的资金实力，给出匹配度与起步策略。`
          : `你是电商选品与需求洞察专家。以下是我从平台复制的【真实笔记标题/评论/用户原话】，请基于这些真实素材做需求洞察。
【真实素材】
${raw}
【目标平台】${plat}
【可投资金档】${tier}

用中文 Markdown 输出，严格包含以下章节：
## 一、一页结论
基于素材得出的核心判断。
## 二、最值得关注的真实需求
从素材中归纳 3-5 个真实痛点/需求，引用素材原话佐证。
## 三、最值得验证的商业机会
2-4 个可落地机会。
## 四、最容易获得第一笔收入
1-2 个最小可行切入点。
## 五、长期规模化潜力
## 六、最大判断风险
## 七、数据质量诊断
评估素材是否足够、是否有水军/极端样本偏差、还需补充什么。
## 八、结合资金档的建议
针对【${tier}】给出匹配度与起步策略。`;

        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([
            ECOM.msg('system', '你是资深电商选品与消费者洞察专家，擅长从需求与素材中提炼可落地的商业机会。'),
            ECOM.msg('user', prompt)
          ], { temperature: 0.7 });
          card.set(text, (name ? name + ' - ' : '') + '需求洞察.md');
        });
      });
      ECOM.applyBrief(root);
    }
  });

  /* ===================== 竞品分析 ===================== */
  ECOM.register({
    id: 'compete',
    name: '竞品分析',
    icon: '🔍',
    group: '市场情报',
    desc: '粘贴商品链接/标题/笔记/截图描述，AI 拆解卖点、定价、人群、货源与跟卖风险。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="field"><label>竞品信息<span class="hint">粘贴商品链接、标题、笔记原文，或描述截图内容</span></label>
            <textarea id="cc_input" style="min-height:130px" placeholder="例如：&#10;淘宝搜「便携榨汁杯」看到一款销量 3万+ 的，标题写 USB 充电/无线/一键自动清洗，到手价 49 元，评论区很多人说榨不碎冰、漏汁……"></textarea></div>
          <div class="row">
            <div class="field"><label>目标平台</label>
              <select id="cc_plat">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
            <div class="field"><label>可投资金档</label>
              <select id="cc_tier">${TIERS.map(t => `<option>${t}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>方向名称<span class="hint">用于存入选品库</span></label>
            <input type="text" id="cc_name" placeholder="例如：便携榨汁杯"></div>
          <div class="btn-row"><button class="primary-btn" id="cc_gen">生成竞品分析</button>
            <span class="hint">需配置模型 API（⚙️ 模型设置）</span></div>
          <div id="cc_out"></div>
        </div>`;

      const out = root.querySelector('#cc_out');
      const card = ECOM.ui.resultCard('竞品分析报告');
      out.appendChild(card);

      const saveBtn = document.createElement('button');
      saveBtn.className = 'secondary-btn';
      saveBtn.style.cssText = 'padding:7px 12px;font-size:13px;margin-left:8px';
      saveBtn.textContent = '📥 存入选品库';
      saveBtn.addEventListener('click', () => {
        const name = root.querySelector('#cc_name').value.trim();
        if (!name) { ECOM.ui.toast('请先填写「方向名称」'); root.querySelector('#cc_name').focus(); return; }
        ECOM.setBrief({
          name,
          platform: root.querySelector('#cc_plat').value,
          tier: root.querySelector('#cc_tier').value,
          feats: ['竞品分析报告已生成'],
          kind: 'compete'
        });
        ECOM.ui.toast('已存入选品库：' + name);
      });
      card.querySelector('.btn-row').appendChild(saveBtn);

      root.querySelector('#cc_gen').addEventListener('click', async (e) => {
        const input = root.querySelector('#cc_input').value.trim();
        const plat = root.querySelector('#cc_plat').value;
        const tier = root.querySelector('#cc_tier').value;
        const name = root.querySelector('#cc_name').value.trim();
        if (!input) { ECOM.ui.toast('请填写竞品信息'); return; }
        const prompt = `你是电商竞品分析专家。基于以下竞品信息，输出竞品拆解报告。
【竞品信息】
${input}
【目标平台】${plat}
【可投资金档】${tier}

用中文 Markdown 输出，严格包含以下章节：
## 一、产品定位与卖点
核心卖点、差异化、目标人群、使用场景。
## 二、定价与毛利空间
估算客单价区间、成本结构、毛利空间（信息不足请注明假设）。
## 三、评论区机会点
从已知信息推断用户好评点与痛点，哪些可被后来者放大/规避。
## 四、货源与供应链
建议货源方向（1688/产业带/工厂），大致成本与起订量提示。
## 五、跟卖 / 进入风险
竞争激烈度、壁垒、是否值得跟、差异化切入点。
## 六、结合资金档的进入策略
针对【${tier}】给出是否适合、起步 SKU 与节奏建议。`;
        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([
            ECOM.msg('system', '你是电商竞品分析师，擅长从有限信息中拆解定位、定价、人群、供应链与进入策略。'),
            ECOM.msg('user', prompt)
          ], { temperature: 0.6 });
          card.set(text, (name ? name + ' - ' : '') + '竞品分析.md');
        });
      });
      ECOM.applyBrief(root);
    }
  });
})();
