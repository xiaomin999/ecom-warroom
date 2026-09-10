/* 电商作战室 · 核心库：设置存储 / LLM 客户端 / UI 辅助 / 轻量 Markdown 渲染 */
(function () {
  const ECOM = (window.ECOM = window.ECOM || {});
  ECOM.modules = ECOM.modules || [];
  ECOM.register = function (m) { ECOM.modules.push(m); };

  /* ---------- 设置（localStorage） ---------- */
  const KEY = 'ecom_settings_v1';
  ECOM.store = {
    get() {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
      catch (e) { return {}; }
    },
    set(obj) {
      const cur = this.get();
      const next = Object.assign({}, cur, obj);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    }
  };

  /* ---------- 选品简报（跨模块共享上下文，实现一站式流转） ---------- */
  ECOM.brief = null;
  ECOM.getBrief = function () {
    if (ECOM.brief) return ECOM.brief;
    try { ECOM.brief = JSON.parse(localStorage.getItem('ecom_brief_v1')) || null; } catch (e) { ECOM.brief = null; }
    return ECOM.brief;
  };
  ECOM.setBrief = function (obj) {
    const prev = ECOM.getBrief();
    // 名称相同且已有 id → 视为更新同一条目；否则作为新条目生成新 id
    const keepId = (!obj.id && prev && prev.id && prev.name === obj.name) ? prev.id : (obj.id || null);
    ECOM.brief = Object.assign({}, prev, obj);
    if (keepId) ECOM.brief.id = keepId; else delete ECOM.brief.id;
    if (!ECOM.brief.id) ECOM.brief.id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try { localStorage.setItem('ecom_brief_v1', JSON.stringify(ECOM.brief)); } catch (e) {}
    ECOM.briefLib.upsert(ECOM.brief);
    return ECOM.brief;
  };
  ECOM.clearBrief = function () {
    ECOM.brief = null;
    try { localStorage.removeItem('ecom_brief_v1'); } catch (e) {}
  };
  // 把某个已存条目设为「当前简报」（激活到下游模块）
  ECOM.loadBrief = function (id) {
    const b = ECOM.briefLib.get(id);
    if (b) { ECOM.brief = b; try { localStorage.setItem('ecom_brief_v1', JSON.stringify(b)); } catch (e) {} }
    return b;
  };

  /* ---------- 选品库（多个已评估方向的集合，离线持久化） ---------- */
  ECOM.briefLib = {
    _key: 'ecom_briefs_v1',
    _read() { try { return JSON.parse(localStorage.getItem(this._key)) || []; } catch (e) { return []; } },
    _write(a) { try { localStorage.setItem(this._key, JSON.stringify(a)); } catch (e) {} },
    list() { return this._read(); },
    upsert(b) {
      const a = this._read();
      if (!b.id) b.id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const i = a.findIndex(x => x.id === b.id);
      if (i >= 0) a[i] = b; else a.unshift(b);
      this._write(a);
      return b;
    },
    get(id) { return this._read().find(x => x.id === id) || null; },
    remove(id) { const a = this._read().filter(x => x.id !== id); this._write(a); }
  };
  // 把当前简报带入下游模块：预填输入框 + 顶部简报条。返回是否应用了简报。
  ECOM.applyBrief = function (root) {
    const b = ECOM.getBrief();
    if (!b) return false;
    const setVal = (sel, val) => { const el = root.querySelector(sel); if (el && val != null && val !== '') el.value = val; };
    const setSel = (sel, val) => { const el = root.querySelector(sel); if (!el || !val) return; if ([...el.options].some(o => o.value === val)) el.value = val; };
    const name = b.name || '';
    const feats = Array.isArray(b.feats) ? b.feats.join('\n') : (b.feats || '');
    const audience = b.audience || '';
    ['#t_name', '#c_name', '#d_name', '#i_name', '#cp_prod', '#ad_prod'].forEach(s => setVal(s, name));
    ['#t_plat', '#c_plat', '#cp_plat'].forEach(s => setSel(s, b.platform));
    ['#t_feat', '#c_feat', '#d_feat', '#i_feat', '#ad_kw'].forEach(s => setVal(s, feats));
    ['#c_aud', '#d_aud'].forEach(s => setVal(s, audience));
    const bar = document.createElement('div');
    bar.className = 'brief-bar';
    const priceTxt = b.price ? ` · ¥${b.price}` : '';
    const tierTxt = b.tier ? ` · ${b.tier}` : '';
    const audTxt = audience ? ` · ${audience}` : '';
    bar.innerHTML = `<span>📌 当前选品简报：<b>${name || '未命名'}</b>${priceTxt}${b.platform ? (' · ' + b.platform) : ''}${audTxt}${tierTxt}</span><button class="brief-clear" id="briefClear">清除</button>`;
    root.insertBefore(bar, root.firstChild);
    bar.querySelector('#briefClear').addEventListener('click', () => {
      ECOM.clearBrief();
      bar.remove();
      ['#t_name', '#c_name', '#d_name', '#i_name', '#cp_prod', '#ad_prod'].forEach(s => { const e = root.querySelector(s); if (e) e.value = ''; });
      ECOM.ui.toast('已清除选品简报');
    });
    return true;
  };

  /* ---------- 模型可用性判定（兼容「直连」与「代理」两种模式） ---------- */
  ECOM.llmMode = function () {
    const s = ECOM.store.get();
    if (s.useProxy) return 'proxy';
    if (s.baseUrl && s.apiKey) return 'direct';
    return 'none';
  };
  // 是否已具备调用模型的条件：代理模式（Key 在服务端）或直连模式（客户端已填 Key）
  ECOM.hasLLM = function () {
    return ECOM.llmMode() !== 'none';
  };

  /* ---------- LLM 客户端（OpenAI 兼容 /chat/completions） ---------- */
  ECOM.llm = async function (messages, opts = {}) {
    const s = ECOM.store.get();
    const base = (opts.baseUrl || s.baseUrl || '').replace(/\/+$/, '');
    const apiKey = opts.apiKey || s.apiKey || '';
    const model = opts.model || s.model || 'qwen-turbo';
    const useProxy = (opts.useProxy != null ? opts.useProxy : s.useProxy) && !opts.direct;
    if (!useProxy && (!base || !apiKey)) {
      throw new Error('请先在「⚙️ 模型设置」中填写 API Base URL 与 API Key');
    }
    const url = useProxy ? '/api/llm' : (base + '/chat/completions');
    const body = {
      model,
      messages,
      temperature: opts.temperature != null ? opts.temperature : 0.7,
      stream: false
    };
    // 联网搜索开关：通义 DashScope 在 OpenAI 兼容 /chat/completions 下，
    // 顶层加 enable_search=true 即可联网（其它兼容模型会忽略未知字段）。
    if (opts.search) {
      body.enable_search = true;
      body.search_options = { search_strategy: 'turbo' };
    }
    const headers = { 'Content-Type': 'application/json' };
    if (!useProxy) headers['Authorization'] = 'Bearer ' + apiKey;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error?.message || ''; } catch (e) {}
      if (!detail) detail = await res.text().catch(() => '');
      throw new Error('API 错误 ' + res.status + (detail ? '：' + detail.slice(0, 240) : ''));
    }
    const data = await res.json();
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  };

  /* ---------- UI 辅助 ---------- */
  ECOM.ui = {
    toast(msg) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg; t.hidden = false;
      clearTimeout(ECOM._toastT);
      ECOM._toastT = setTimeout(() => { t.hidden = true; }, 2200);
    },
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        ECOM.ui.toast('已复制到剪贴板');
      } catch (e) {
        // 降级
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ECOM.ui.toast('已复制'); }
        catch (e2) { ECOM.ui.toast('复制失败，请手动选择'); }
        document.body.removeChild(ta);
      }
    },
    download(filename, text) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
    },
    exportPDF(filename, title, md) {
      const body = ECOM.mdToHtml(md || '');
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title || filename || '导出')}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.7;color:#1f2937;max-width:780px;margin:40px auto;padding:20px;background:#fff}
h1,h2,h3{color:#111827;margin:20px 0 10px}
h1{font-size:24px;border-bottom:2px solid #e5e7eb;padding-bottom:8px}
h2{font-size:19px}h3{font-size:16px}
table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left}
th{background:#f3f4f6}
ul,ol{padding-left:24px;margin:8px 0}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px}
@media print{body{margin:0;max-width:none}.no-print{display:none}}
</style>
</head>
<body>
<h1>${escapeHtml(title || '生成结果')}</h1>
${body}
</body>
</html>`;
      const w = window.open('', '_blank');
      if (!w) { ECOM.ui.toast('弹窗被拦截，请允许弹窗后重试'); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
    },
    exportWord(filename, title, md) {
      const body = ECOM.mdToHtml(md || '');
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title || filename || '导出')}</title>
<style>
body{font-family:"Microsoft YaHei",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.7;color:#1f2937}
h1,h2,h3{color:#111827}
h1{font-size:22px;border-bottom:1px solid #e5e7eb;padding-bottom:8px}
table{border-collapse:collapse;width:100%;margin:12px 0}
td,th{border:1px solid #d1d5db;padding:8px}
th{background:#f3f4f6}
ul,ol{padding-left:24px}
</style>
</head>
<body>
<h1>${escapeHtml(title || '生成结果')}</h1>
${body}
</body>
</html>`;
      const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (filename || 'result').replace(/\.[^.]*$/, '') + '.doc';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
      ECOM.ui.toast('Word 文档已下载');
    },
    // 生成按钮统一行为：调用 fn，loading 态，错误提示
    async run(btn, fn) {
      const old = btn.textContent;
      btn.disabled = true; btn.textContent = '生成中…';
      try {
        await fn();
      } catch (e) {
        ECOM.ui.toast((e && e.message) || String(e));
        console.error(e);
      } finally {
        btn.disabled = false; btn.textContent = old;
      }
    }
  };

  /* ---------- 轻量 Markdown → HTML（仅渲染安全子集） ---------- */
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  ECOM.mdToHtml = function (md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    let html = '', i = 0, inUl = false, inOl = false;
    const closeLists = () => { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } };
    const inline = (t) => escapeHtml(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+?)`/g, '<code>$1</code>');
    while (i < lines.length) {
      let line = lines[i];
      // 表格
      if (/^\|/.test(line) && lines[i + 1] && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
        closeLists();
        const head = line.split('|').slice(1, -1).map(c => c.trim());
        i += 2;
        let rows = '';
        while (i < lines.length && /^\|/.test(lines[i])) {
          const cells = lines[i].split('|').slice(1, -1).map(c => c.trim());
          rows += '<tr>' + cells.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>';
          i++;
        }
        html += '<table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeLists(); html += '<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'; i++; continue; }
      if (/^>\s?/.test(line)) { closeLists(); html += '<p class="md-ok">' + inline(line.replace(/^>\s?/, '')) + '</p>'; i++; continue; }
      const ul = line.match(/^[-*]\s+(.*)$/);
      const ol = line.match(/^\d+\.\s+(.*)$/);
      if (ul) { if (!inUl) { closeLists(); html += '<ul>'; inUl = true; } html += '<li>' + inline(ul[1]) + '</li>'; i++; continue; }
      if (ol) { if (!inOl) { closeLists(); html += '<ol>'; inOl = true; } html += '<li>' + inline(ol[1]) + '</li>'; i++; continue; }
      if (line.trim() === '') { closeLists(); i++; continue; }
      closeLists();
      html += '<p>' + inline(line) + '</p>';
      i++;
    }
    closeLists();
    return html;
  };

  // 创建一个结果卡片（标题 + 渲染区 + 操作按钮）
  ECOM.ui.resultCard = function (title) {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML =
      '<div class="btn-row" style="justify-content:space-between;margin-bottom:10px">' +
        '<h3 style="margin:0">' + (title || '生成结果') + '</h3>' +
        '<div class="btn-row">' +
          '<button class="secondary-btn copy-btn" style="padding:7px 12px;font-size:13px">复制</button>' +
          '<div class="dl-menu">' +
            '<button class="secondary-btn dl-toggle" style="padding:7px 12px;font-size:13px">导出 ▾</button>' +
            '<div class="dl-items">' +
              '<a class="dl-txt">📄 下载 Markdown (.txt)</a>' +
              '<a class="dl-pdf">📑 导出 PDF</a>' +
              '<a class="dl-doc">📝 导出 Word (.doc)</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="result empty-state">点击上方按钮生成内容…</div>';
    const resultEl = wrap.querySelector('.result');
    const set = (md, filename) => {
      resultEl.classList.remove('empty-state');
      resultEl.innerHTML = ECOM.mdToHtml(md);
      resultEl.dataset.raw = md || '';
      resultEl.dataset.file = filename || 'result.txt';
    };
    wrap.querySelector('.copy-btn').addEventListener('click', () => ECOM.ui.copy(resultEl.dataset.raw || ''));
    const dlMenu = wrap.querySelector('.dl-menu');
    const dlToggle = wrap.querySelector('.dl-toggle');
    dlToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dlMenu.classList.contains('open');
      document.querySelectorAll('.dl-menu.open').forEach(m => m.classList.remove('open'));
      if (!wasOpen) dlMenu.classList.add('open');
    });
    if (!ECOM._dlDocListener) {
      ECOM._dlDocListener = true;
      document.addEventListener('click', () => document.querySelectorAll('.dl-menu.open').forEach(m => m.classList.remove('open')));
    }
    wrap.querySelector('.dl-txt').addEventListener('click', () => ECOM.ui.download(resultEl.dataset.file || 'result.txt', resultEl.dataset.raw || ''));
    wrap.querySelector('.dl-pdf').addEventListener('click', () => ECOM.ui.exportPDF(resultEl.dataset.file || 'result.pdf', title, resultEl.dataset.raw || ''));
    wrap.querySelector('.dl-doc').addEventListener('click', () => ECOM.ui.exportWord(resultEl.dataset.file || 'result.doc', title, resultEl.dataset.raw || ''));
    wrap.set = set;
    wrap.raw = () => resultEl.dataset.raw || '';
    return wrap;
  };

  // 便捷：构建一条消息
  ECOM.msg = (role, content) => ({ role, content });
})();
