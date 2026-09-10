/* 做图：图像生成 Prompt 构建（本地，免联网）+ AI 润色 + 可选图像 API 调用 */
(function () {
  const STYLES = {
    '白底主图': 'pure white background product hero shot, studio lighting, e-commerce main image, centered, no text',
    '场景图': 'real-life usage scene, natural lifestyle photography, soft natural light, authentic environment',
    '生活方式': 'lifestyle editorial photography, aspirational home setting, warm tones, bokeh background',
    '信息图': 'clean infographic style, flat illustration, labeled features, minimal color palette, no photo',
    '3D渲染': 'high-end 3D product render, cinematic lighting, reflective floor, octane render, premium look'
  };
  const SIZES = {
    '淘宝/天猫 800x800': '1024x1024',
    '京东 800x800': '1024x1024',
    '抖音/小红书 1080x1080': '1024x1024',
    '拼多多 800x800': '1024x1024',
    '详情页长图 750x1200': '1024x1792',
    '横幅 1200x628': '1792x1024',
    '自由（不限定）': '1024x1024'
  };

  ECOM.register({
    id: 'image',
    name: '做图',
    icon: '🎨',
    group: '内容',
    desc: '本地构建图像生成 Prompt，可 AI 润色，可选接图像 API 出图。',
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="row">
            <div class="field"><label>商品 / 主题</label>
              <input type="text" id="i_name" placeholder="例如：无线手持真空封口机"></div>
            <div class="field"><label>图片风格</label>
              <select id="i_style">${Object.keys(STYLES).map(k => `<option>${k}</option>`).join('')}</select></div>
          </div>
          <div class="row">
            <div class="field"><label>平台尺寸</label>
              <select id="i_size">${Object.keys(SIZES).map(k => `<option>${k}</option>`).join('')}</select></div>
            <div class="field"><label>调性 / 背景</label>
              <input type="text" id="i_tone" placeholder="例如：科技蓝、高级灰、木质台面"></div>
          </div>
          <div class="field"><label>要突出的卖点 / 元素<span class="hint">每行一条</span></label>
            <textarea id="i_feat" placeholder="例如：&#10;手持便携&#10;干湿两用&#10;配套真空袋&#10;数字显示屏"></textarea></div>
          <div class="btn-row">
            <button class="primary-btn" id="i_build">① 生成本地 Prompt</button>
            <button class="secondary-btn" id="i_ai">② AI 润色</button>
            <button class="secondary-btn" id="i_gen">③ 调用图像 API 出图</button>
          </div>
          <span class="hint">① 免联网；② 需模型 API；③ 需在「设置」配置图像 API（可选）</span>
          <div id="i_out"></div>
        </div>`;
      const out = root.querySelector('#i_out');
      const card = ECOM.ui.resultCard('图像生成方案');
      out.appendChild(card);
      let lastPrompt = '';

      function buildLocal() {
        const name = v('#i_name') || 'product';
        const style = STYLES[v('#i_style')] || '';
        const tone = v('#i_tone');
        const feats = v('#i_feat');
        const featLine = feats ? 'Featuring: ' + feats.split('\n').map(s => s.trim()).filter(Boolean).join(', ') + '.' : '';
        const toneLine = tone ? 'Visual tone: ' + tone + '.' : '';
        const en = `Professional e-commerce product image of ${name}. ${style}. ${featLine} ${toneLine} High resolution, sharp focus, commercial photography, 8k, detailed.`;
        const zh = `（中文意图）为「${name}」生成${v('#i_style')}风格图${tone ? '，调性：' + tone : ''}${feats ? '，突出：' + featLine.replace('Featuring: ', '').replace('.', '') : ''}。`;
        return `# 图像生成 Prompt\n\n## 英文 Prompt（直接喂给 通义万相 / DALL·E / Stable Diffusion）\n${en}\n\n## 中文说明\n${zh}\n\n## 推荐参数\n- 尺寸：${SIZES[v('#i_size')] || '1024x1024'}\n- 步数：30–50（SD 类）\n- 负向词：text, watermark, low quality, deformed, extra limbs`;
      }

      root.querySelector('#i_build').addEventListener('click', () => {
        lastPrompt = buildLocal();
        card.set(lastPrompt, 'image_prompt.md');
      });

      root.querySelector('#i_ai').addEventListener('click', async (e) => {
        if (!lastPrompt) lastPrompt = buildLocal();
        const base = lastPrompt.split('## 英文 Prompt')[1] ? lastPrompt.split('## 英文 Prompt')[1].split('\n')[1] : lastPrompt;
        const prompt = `把下面的电商图像生成需求，改写成一段更专业、更有画面感、带构图与光线描述的英文 image prompt（只输出最终英文 prompt，不要解释）：
${base}`;
        await ECOM.ui.run(e.target, async () => {
          const text = await ECOM.llm([ECOM.msg('system', '你是电商视觉与 AI 绘画提示词专家。'), ECOM.msg('user', prompt)], { temperature: 0.7 });
          const merged = `# 图像生成 Prompt（AI 润色）\n\n## 英文 Prompt\n${text.trim()}\n\n## 推荐参数\n- 尺寸：${SIZES[v('#i_size')] || '1024x1024'}\n- 负向词：text, watermark, low quality, deformed`;
          card.set(merged, 'image_prompt.md');
          lastPrompt = merged;
        });
      });

      root.querySelector('#i_gen').addEventListener('click', async (e) => {
        if (!lastPrompt) lastPrompt = buildLocal();
        const enMatch = lastPrompt.match(/## 英文 Prompt[^\n]*\n([\s\S]*?)\n\n## /);
        const en = (enMatch ? enMatch[1] : lastPrompt).trim();
        const s = ECOM.store.get();
        const ib = (s.imageBaseUrl || '').replace(/\/+$/, '');
        const ik = s.imageApiKey || '';
        const im = s.imageModel || 'dall-e-3';
        const size = SIZES[v('#i_size')] || '1024x1024';
        if (!ib || !ik) { ECOM.ui.toast('请先在「设置」填写图像 API（可选）'); return; }
        await ECOM.ui.run(e.target, async () => {
          const res = await fetch(ib + '/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ik },
            body: JSON.stringify({ model: im, prompt: en, n: 1, size })
          });
          if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error('图像 API 错误 ' + res.status + '：' + t.slice(0,200)); }
          const data = await res.json();
          const url = data.data && data.data[0] && (data.data[0].url || data.data[0].b64_json);
          if (!url) throw new Error('图像 API 未返回图片');
          const isB64 = !url.startsWith('http');
          const src = isB64 ? ('data:image/png;base64,' + url) : url;
          // 把图片塞进结果区，同时保留 prompt 文本供复制/下载
          const resultEl = out.querySelector('.result');
          resultEl.classList.remove('empty-state');
          resultEl.innerHTML = '<img src="' + src + '" style="max-width:100%;border-radius:12px"/>' +
            '<div style="margin-top:10px;color:#cbd5e1;font-size:13px">Prompt：' + en.replace(/</g, '&lt;') + '</div>';
          resultEl.dataset.raw = lastPrompt;
          resultEl.dataset.file = 'image_prompt.md';
        });
      });

      function v(s){ return root.querySelector(s).value.trim(); }
      ECOM.applyBrief(root);
    }
  });
})();
