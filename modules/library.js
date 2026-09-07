/* 我的选品库：把评估过的方向存成组合，随时切换/对比/一键生成 */
(function () {
  function fmt(d) {
    try { return new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  const DIMS = [
    ['方向', b => b.name || '未命名'],
    ['平台', b => b.platform || '-'],
    ['资金档', b => b.tier || '-'],
    ['可投资金', b => b.capital ? '¥' + Number(b.capital).toLocaleString() : '-'],
    ['客单价', b => b.price ? '¥' + b.price : '-'],
    ['单件成本', b => (b.cost != null && b.cost !== '') ? '¥' + b.cost : '-'],
    ['单件毛利', b => (b.cost != null && b.cost !== '' && b.price) ? '¥' + (b.price - b.cost).toFixed(1) : '-'],
    ['毛利率', b => (b.cost != null && b.cost !== '' && b.price) ? ((b.price - b.cost) / b.price * 100).toFixed(0) + '%' : '-'],
    ['目标人群', b => b.audience || '-'],
    ['核心卖点', b => Array.isArray(b.feats) ? b.feats.join('、') : (b.feats || '-')],
    ['入库时间', b => fmt(b.createdAt)]
  ];

  ECOM.register({
    id: 'library',
    name: '我的选品库',
    icon: '🗂️',
    group: '选品',
    desc: '管理你评估过的多个方向：保存、切换为当前简报、勾选对比、一键进流水线生成。',
    render(root) {
      function goPipeline() { const n = document.querySelector('.nav-item[data-id="pipeline"]'); if (n) n.click(); }
      const selected = new Set();

      function renderList() {
        const list = ECOM.briefLib.list();
        const active = ECOM.getBrief();
        if (!list.length) {
          box.innerHTML = '<p class="hint" style="margin:0">选品库还是空的。在「选品分析 → 💰 资金选品」测算并保存简报后，方向会自动进到这里；也可点上方「保存当前简报」手动入库。</p>';
          updateCmpBtn();
          return;
        }
        box.innerHTML = list.map(b => {
          const isActive = active && active.id === b.id;
          const feats = Array.isArray(b.feats) ? b.feats.join('、') : (b.feats || '');
          return `<div class="lib-card${isActive ? ' active' : ''}">
            <div class="lib-main">
              <div class="lib-title">${b.name || '未命名'}${isActive ? ' <span class="lib-flag">当前</span>' : ''}</div>
              <div class="lib-meta">${b.platform || '平台未填'} · ${b.tier || ''} · ${b.capital ? ('¥' + Number(b.capital).toLocaleString()) : '资金未填'}</div>
              <div class="lib-sub">客单价 ${b.price ? '¥' + b.price : '-'} · 人群 ${b.audience || '-'}${feats ? ' · 卖点 ' + feats : ''}</div>
              <div class="lib-time">入库 ${fmt(b.createdAt)}</div>
            </div>
            <div class="lib-actions">
              <label class="lib-cmp-wrap"><input type="checkbox" class="lib-cmp" data-id="${b.id}" ${selected.has(b.id) ? 'checked' : ''}> 对比</label>
              <button class="secondary-btn lib-set" data-id="${b.id}">${isActive ? '已激活' : '设为当前'}</button>
              <button class="secondary-btn lib-run" data-id="${b.id}">去生成</button>
              <button class="lib-del" data-id="${b.id}" title="删除">✕</button>
            </div>
          </div>`;
        }).join('');
        box.querySelectorAll('.lib-set').forEach(btn => btn.addEventListener('click', () => {
          ECOM.loadBrief(btn.dataset.id);
          ECOM.ui.toast('已设为当前简报');
          renderList();
          syncHeader();
        }));
        box.querySelectorAll('.lib-run').forEach(btn => {
          btn.addEventListener('click', () => { ECOM.loadBrief(btn.dataset.id); goPipeline(); });
        });
        box.querySelectorAll('.lib-del').forEach(btn => btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const cur = ECOM.getBrief();
          selected.delete(id);
          ECOM.briefLib.remove(id);
          if (cur && cur.id === id) ECOM.clearBrief(); // 删除的正是当前简报 → 清除激活态
          ECOM.ui.toast('已从选品库删除');
          renderList();
          syncHeader();
        }));
        box.querySelectorAll('.lib-cmp').forEach(cb => cb.addEventListener('change', () => {
          if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
          updateCmpBtn();
        }));
        updateCmpBtn();
      }

      function updateCmpBtn() {
        const btn = root.querySelector('#lib_cmp');
        if (!btn) return;
        btn.textContent = '📊 对比选中 (' + selected.size + ')';
        btn.disabled = selected.size < 2;
      }

      function openCompare() {
        const prods = ECOM.briefLib.list().filter(b => selected.has(b.id));
        if (prods.length < 2) return;
        const table = '<table class="cmp-table"><thead><tr><th>维度</th>' +
          prods.map(p => '<th>' + (p.name || '未命名') + '</th>').join('') + '</tr></thead><tbody>' +
          DIMS.map(d => '<tr><td class="cmp-dim">' + d[0] + '</td>' + prods.map(p => '<td>' + d[1](p) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table>';
        const m = document.createElement('div');
        m.className = 'modal';
        m.innerHTML = '<div class="modal-card"><div class="modal-head"><h3>选品对比（' + prods.length + ' 个方向）</h3>' +
          '<button class="modal-x" id="cmpClose">✕</button></div>' +
          '<div class="modal-body"><p class="hint" style="margin:0 0 10px">优先看「毛利率」与「可投资金」是否匹配你的资金实力；成本缺失的方向建议回「资金选品」补算。</p>' + table + '</div></div>';
        document.body.appendChild(m);
        m.hidden = false;
        const close = () => m.remove();
        m.querySelector('#cmpClose').addEventListener('click', close);
        m.addEventListener('click', e => { if (e.target === m) close(); });
      }

      root.innerHTML = `
        <div class="card">
          <div class="btn-row" style="align-items:center;margin-bottom:12px;flex-wrap:wrap">
            <button class="primary-btn" id="lib_save">＋ 保存当前简报入库</button>
            <button class="secondary-btn" id="lib_cmp" disabled>📊 对比选中 (0)</button>
            <span class="hint" id="lib_cur" style="margin:0"></span>
          </div>
          <div id="lib_box"></div>
        </div>`;
      const box = root.querySelector('#lib_box');

      function syncHeader() {
        const cur = ECOM.getBrief();
        const curEl = root.querySelector('#lib_cur');
        if (curEl) curEl.textContent = cur && cur.name ? ('当前：' + cur.name) : '当前无简报（请先到资金选品测算保存）';
        const saveBtn = root.querySelector('#lib_save');
        if (saveBtn) saveBtn.disabled = !(cur && cur.name);
      }

      root.querySelector('#lib_save').addEventListener('click', () => {
        const b = ECOM.getBrief();
        if (!b || !b.name) { ECOM.ui.toast('请先保存选品简报'); return; }
        b.createdAt = Date.now();
        ECOM.briefLib.upsert(b);
        ECOM.ui.toast('已存入选品库');
        renderList();
      });

      root.querySelector('#lib_cmp').addEventListener('click', openCompare);

      renderList();
      syncHeader();
    }
  });
})();
