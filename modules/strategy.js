/* 策略模块：活动策略 + 广告策略 */
(function () {
  const PLATFORMS = ['Amazon 北美', 'Walmart', 'TikTok Shop', 'TEMU', '淘宝/天猫', '京东', '抖音电商', '独立站 Shopify'];

  /* ===== 活动策略 ===== */
  ECOM.register({
    id: 'campaign',
    name: '活动策略',
    icon: '🎉',
    group: '策略',
    desc: '大促/节日/清仓节奏、优惠梯度与玩法设计。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="row">
            <div class="field"><label>活动类型</label>
              <select id="cp_type"><option>大促（黑五/双11/Prime Day）</option><option>节日营销</option><option>新品首发</option><option>清仓/换季</option><option>会员日/复购</option></select></div>
            <div class="field"><label>平台</label>
              <select id="cp_plat">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>商品 / 品类</label>
            <input type="text" id="cp_prod" placeholder="例如：真空封口机及配套真空袋"></div>
          <div class="row">
            <div class="field"><label>核心目标</label>
              <select id="cp_goal"><option>GMV 最大化</option><option>拉新获客</option><option>清库存</option><option>推爆款/冲排名</option></select></div>
            <div class="field"><label>周期 / 预算</label>
              <input type="text" id="cp_budget" placeholder="例如：14天 / 总预算 ¥5万"></div>
          </div>
          <div class="field"><label>特殊要求<span class="hint">选填</span></label>
            <input type="text" id="cp_req" placeholder="例如：毛利底线8折、需配合站外红人"></div>
          <div class="btn-row"><button class="primary-btn" id="cp_gen">生成活动策略</button>
            <span class="hint">需配置模型 API</span></div>
          <div id="cp_out"></div>
        </div>`;
      const out = root.querySelector('#cp_out');
      const card = ECOM.ui.resultCard('活动策略');
      out.appendChild(card);
      root.querySelector('#cp_gen').addEventListener('click', async (e) => {
        const type = v('#cp_type'), plat = v('#cp_plat'), prod = v('#cp_prod'),
              goal = v('#cp_goal'), budget = v('#cp_budget'), req = v('#cp_req');
        if (!prod.trim()) { ECOM.ui.toast('请填写商品/品类'); return; }
        const prompt = `你是电商活动策划专家。请为以下活动制定可落地的策略：
【活动类型】${type}
【平台】${plat}
【商品/品类】${prod}
【核心目标】${goal}
【周期/预算】${budget || '自定'}
【特殊要求】${req || '无'}

用中文 Markdown 输出：
## 一、活动节奏（时间轴）
分 预热期 / 爆发期 / 返场期（或按你判断的阶段），每阶段目标、动作、关键指标。

## 二、优惠梯度设计
用表格：门槛→优惠（满减/折扣/赠品/捆绑）→适用商品→毛利测算说明。

## 三、玩法组合
平台内（coupon/秒杀/会员）与站外（红人/社媒/EDM）配合。

## 四、甘特式执行清单
按天列出负责人动作（可标注角色）。

## 五、风险与兜底
库存、毛利、差评预案。`;
        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([ECOM.msg('system', '你是电商大促活动策划，擅长节奏设计与优惠机制。'), ECOM.msg('user', prompt)], { temperature: 0.6 });
          card.set(text, '活动策略.md');
        });
      });
      function v(s){ return root.querySelector(s).value.trim(); }
      ECOM.applyBrief(root);
    }
  });

  /* ===== 广告策略 ===== */
  ECOM.register({
    id: 'ads',
    name: '广告策略',
    icon: '📣',
    group: '策略',
    desc: '投放结构、关键词词包、出价与预算分配、优化建议。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="row">
            <div class="field"><label>广告渠道</label>
              <select id="ad_chan"><option>Amazon Sponsored（SP/SB/SD）</option><option>TikTok Ads</option><option>Google Ads</option><option>Meta（FB/IG）</option><option>淘宝/京东 直通车</option></select></div>
            <div class="field"><label>商品 / 落地页</label>
              <input type="text" id="ad_prod" placeholder="例如：无线真空封口机 listing"></div>
          </div>
          <div class="row">
            <div class="field"><label>投放目标</label>
              <select id="ad_goal"><option>转化/出单</option><option>曝光/品牌</option><option>点击/引流</option><option>ROI 最优</option></select></div>
            <div class="field"><label>日预算</label>
              <input type="text" id="ad_budget" placeholder="例如：$50/天 或 ¥300/天"></div>
          </div>
          <div class="field"><label>核心卖点 / 关键词方向<span class="hint">每行一条</span></label>
            <textarea id="ad_kw" placeholder="例如：&#10;vacuum sealer&#10;food saver machine&#10;便携保鲜&#10;送礼"></textarea></div>
          <div class="btn-row"><button class="primary-btn" id="ad_gen">生成广告策略</button>
            <span class="hint">需配置模型 API</span></div>
          <div id="ad_out"></div>
        </div>`;
      const out = root.querySelector('#ad_out');
      const card = ECOM.ui.resultCard('广告策略');
      out.appendChild(card);
      root.querySelector('#ad_gen').addEventListener('click', async (e) => {
        const chan = v('#ad_chan'), prod = v('#ad_prod'), goal = v('#ad_goal'),
              budget = v('#ad_budget'), kw = v('#ad_kw');
        if (!prod.trim()) { ECOM.ui.toast('请填写商品/落地页'); return; }
        const prompt = `你是电商广告投放专家（精通 ${chan}）。为以下制定投放策略：
【渠道】${chan}
【推广对象】${prod}
【目标】${goal}
【日预算】${budget || '自定'}
【关键词/卖点方向】
${kw || '（请合理推断）'}

用中文 Markdown 输出：
## 一、账户/投放结构
 Campaign → Ad Group 划分逻辑（按词根/受众/匹配类型）。

## 二、关键词词包
用表格：关键词 | 匹配类型(广泛/短语/精准) | 建议出价 | 阶段(拓词/收割)。给 15–25 个。

## 三、人群与定向
受众、兴趣、再营销、排除项。

## 四、素材方向
主图/视频/文案 3–5 条创意角度。

## 五、预算分配与节奏
冷启动→放量→收敛 的预算与出价策略。

## 六、核心指标与优化
盯哪些指标、何时加价/否词/暂停。`;
        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([ECOM.msg('system', '你是电商广告投放优化师，数据驱动、结构清晰。'), ECOM.msg('user', prompt)], { temperature: 0.6 });
          card.set(text, '广告策略.md');
        });
      });
      function v(s){ return root.querySelector(s).value.trim(); }
      ECOM.applyBrief(root);
    }
  });
})();
