// ==================== 餐饮库存管理 - Supabase 版 ====================
let currentItems = [];
let currentItem = null;
let currentType = 'in';
let currentMode = 'stock';
let currentStatusFilter = null;

// DOM
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const el = {
  stats: { total: $('#statTotal'), normal: $('#statNormal'), low: $('#statLow'), empty: $('#statEmpty') },
  searchInput: $('#searchInput'), categorySelect: $('#categorySelect'),
  inventoryList: $('#inventoryList'), logsList: $('#logsList'),
  modalOverlay: $('#modalOverlay'), modalTitle: $('#modalTitle'), modalItemInfo: $('#modalItemInfo'),
  modalClose: $('#modalClose'), modeTabs: $('#modeTabs'), panelStock: $('#panelStock'), panelEdit: $('#panelEdit'),
  quantityInput: $('#quantityInput'), unitLabel: $('#unitLabel'), operatorInput: $('#operatorInput'), noteInput: $('#noteInput'),
  btnSubmit: $('#btnSubmit'), modalError: $('#modalError'),
  editName: $('#editName'), editCategory: $('#editCategory'), editUnit: $('#editUnit'), editThreshold: $('#editThreshold'),
  categoryList: $('#categoryList'), btnDelete: $('#btnDelete'),
  confirmOverlay: $('#confirmOverlay'), confirmText: $('#confirmText'),
  confirmClose: $('#confirmClose'), btnCancel: $('#btnCancel'), btnConfirmDelete: $('#btnConfirmDelete'),
  toast: $('#toast'), fabAdd: $('#fabAdd'),
};

// 工具
function getStatus(item) {
  if (item.quantity <= 0) return 'empty';
  if (item.quantity <= item.min_threshold) return 'low';
  return 'normal';
}
function getStatusLabel(s) { return s === 'normal' ? '正常' : s === 'low' ? '偏低' : '缺货'; }
function formatTime(dt) {
  const d = new Date(dt);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function showToast(msg, type) {
  const t = el.toast; t.textContent = msg; t.className = 'toast ' + (type || '') + ' show';
  clearTimeout(t._timer); t._timer = setTimeout(() => { t.className = 'toast'; }, 2000);
}
function escHtml(str) {
  const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML;
}

// ==================== 登录 ====================
(function initLogin() {
  if (checkLogin()) {
    document.getElementById('loginOverlay').style.display = 'none';
    return;
  }
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('loginBtn').addEventListener('click', () => {
    const pwd = document.getElementById('loginPwd').value;
    if (doLogin(pwd)) {
      document.getElementById('loginOverlay').style.display = 'none';
    } else {
      document.getElementById('loginError').textContent = '密码错误';
    }
  });
  document.getElementById('loginPwd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
})();

// ==================== 数据获取 ====================
async function fetchStats() {
  try {
    const data = await api('/inventory_items?select=quantity,min_threshold');
    let normal = 0, low = 0, empty = 0;
    data.forEach(item => {
      if (item.quantity <= 0) empty++;
      else if (item.quantity <= item.min_threshold) low++;
      else normal++;
    });
    el.stats.total.textContent = data.length;
    el.stats.normal.textContent = normal;
    el.stats.low.textContent = low;
    el.stats.empty.textContent = empty;
  } catch (e) { console.error('stats:', e); }
}

async function fetchInventory() {
  try {
    let path = '/inventory_items?select=*&order=category.asc,name.asc';
    const search = el.searchInput.value.trim();
    const category = el.categorySelect.value;
    if (search) path += '&name=ilike.%25' + encodeURIComponent(search) + '%25';
    if (category) path += '&category=eq.' + encodeURIComponent(category);
    currentItems = await api(path);
    renderInventory();
  } catch (e) { console.error('inventory:', e); }
}

async function fetchCategories() {
  try {
    const data = await api('/inventory_items?select=category');
    const cats = [...new Set(data.map(d => d.category))].sort();
    el.categorySelect.innerHTML = '<option value="">全部分类</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    el.categoryList.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  } catch (e) { console.error('categories:', e); }
}

async function fetchLogs() {
  try {
    const data = await api('/stock_logs?select=*,inventory_items(name,unit)&order=created_at.desc&limit=50');
    renderLogs(data || []);
  } catch (e) { console.error('logs:', e); }
}

// ==================== 渲染 ====================
function renderInventory() {
  var items = currentItems;
  if (currentStatusFilter) {
    items = currentItems.filter(function(item) { return getStatus(item) === currentStatusFilter; });
  }
  if (!items.length) {
    var msg = currentStatusFilter ? '暂无' + getStatusLabel(currentStatusFilter) + '食材' : '暂无匹配的食材';
    el.inventoryList.innerHTML = '<div class="empty-state">' + msg + (currentStatusFilter ? '<br><button class="clear-filter-btn" id="clearFilterBtn">清除筛选</button>' : '') + '</div>';
    if (currentStatusFilter) {
      setTimeout(function() {
        var btn = document.getElementById('clearFilterBtn');
        if (btn) btn.addEventListener('click', function() { setStatusFilter(null); });
      }, 0);
    }
    return;
  }
  el.inventoryList.innerHTML = items.map(function(item) {
    const status = getStatus(item);
    const color = status === 'empty' ? '#ef4444' : status === 'low' ? '#f59e0b' : '#10b981';
    return '<div class="item-card" data-id="' + item.id + '">' +
      '<div class="status-dot status-' + status + '"></div>' +
      '<div class="item-info">' +
        '<div class="item-name">' + escHtml(item.name) + '</div>' +
        '<div class="item-meta">' + escHtml(item.category) + ' · 最低阈值 ' + item.min_threshold + ' ' + item.unit + '</div>' +
      '</div>' +
      '<div class="item-quantity">' +
        '<div class="quantity-val" style="color:' + color + '">' + item.quantity + '</div>' +
        '<div class="quantity-unit">' + item.unit + '</div>' +
        '<span class="status-badge badge-' + status + '">' + getStatusLabel(status) + '</span>' +
      '</div></div>';
  }).join('');
  el.inventoryList.querySelectorAll('.item-card').forEach(function(card) {
    card.addEventListener('click', function() { openModal(parseInt(card.dataset.id)); });
  });
}

function renderLogs(logs) {
  if (!logs.length) { el.logsList.innerHTML = '<div class="log-empty">暂无操作记录</div>'; return; }
  el.logsList.innerHTML = logs.map(log => {
    const cls = log.type === 'in' ? 'log-type-in' : 'log-type-out';
    const label = log.type === 'in' ? '入库' : '出库';
    const item = log.inventory_items;
    return `<div class="log-item">
      <span class="log-type ${cls}">${label}</span>
      <div class="log-info">
        <span class="log-name">${escHtml(item.name)}</span>
        <span class="log-detail">${log.type === 'in' ? '+' : '-'}${log.quantity} ${item.unit} · ${escHtml(log.operator || '员工')}${log.note ? ' · ' + escHtml(log.note) : ''}</span>
      </div>
      <span class="log-time">${formatTime(log.created_at)}</span>
    </div>`;
  }).join('');
}

// ==================== 弹窗 ====================
function openModal(itemIdOrNull) {
  if (itemIdOrNull) {
    currentItem = currentItems.find(i => i.id === itemIdOrNull);
    if (!currentItem) return;
    el.modeTabs.style.display = 'flex';
  } else {
    currentItem = null;
    el.modeTabs.style.display = 'none';
    currentMode = 'edit';
  }
  currentType = 'in'; el.modalError.textContent = '';
  refreshModalUI();
  el.modalOverlay.classList.add('active');
  setTimeout(() => { if (currentItem) el.quantityInput.focus(); else el.editName.focus(); }, 300);
}

function refreshModalUI() {
  if (!currentItem) {
    el.modalTitle.textContent = '新增食材';
  } else if (currentMode === 'edit') {
    el.modalTitle.textContent = '编辑 - ' + currentItem.name;
  } else {
    el.modalTitle.textContent = currentItem.name;
  }
  if (currentItem) {
    const status = getStatus(currentItem);
    el.modalItemInfo.style.display = 'block';
    el.modalItemInfo.innerHTML = `
      <div class="info-row"><span class="info-label">当前库存</span><span><strong>${currentItem.quantity} ${currentItem.unit}</strong></span></div>
      <div class="info-row"><span class="info-label">最低阈值</span><span>${currentItem.min_threshold} ${currentItem.unit}</span></div>
      <div class="info-row"><span class="info-label">状态</span><span class="status-badge badge-${status}">${getStatusLabel(status)}</span></div>`;
  } else {
    el.modalItemInfo.style.display = 'none';
  }
  $$('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === currentMode));
  el.panelStock.style.display = currentMode === 'stock' ? 'block' : 'none';
  el.panelEdit.style.display = currentMode === 'edit' ? 'block' : 'none';
  updateSubmitButton();
  if (currentMode === 'stock') {
    el.unitLabel.textContent = currentItem ? currentItem.unit : '';
    el.quantityInput.value = ''; el.noteInput.value = '';
    if (!el.operatorInput.value) el.operatorInput.value = localStorage.getItem('lastOperator') || '';
    switchTabUI('in');
  }
  if (currentMode === 'edit') {
    if (currentItem) {
      el.editName.value = currentItem.name; el.editCategory.value = currentItem.category;
      el.editUnit.value = currentItem.unit; el.editThreshold.value = currentItem.min_threshold;
      el.btnDelete.style.display = 'block';
    } else {
      el.editName.value = ''; el.editCategory.value = ''; el.editUnit.value = ''; el.editThreshold.value = '';
      el.btnDelete.style.display = 'none';
    }
  }
}

function updateSubmitButton() {
  if (currentMode === 'edit') {
    el.btnSubmit.textContent = currentItem ? '保存修改' : '新增食材';
    el.btnSubmit.className = 'btn-submit type-save';
  } else {
    el.btnSubmit.textContent = currentType === 'in' ? '确认入库' : '确认出库';
    el.btnSubmit.className = 'btn-submit type-' + currentType;
  }
}

function switchTabUI(type) {
  currentType = type;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === type));
  updateSubmitButton();
}

function closeModal() { el.modalOverlay.classList.remove('active'); currentItem = null; }

el.modalClose.addEventListener('click', closeModal);
el.modalOverlay.addEventListener('click', e => { if (e.target === el.modalOverlay) closeModal(); });
el.fabAdd.addEventListener('click', () => openModal(null));

el.modeTabs.addEventListener('click', e => {
  if (!e.target.classList.contains('mode-tab') || !currentItem) return;
  currentMode = e.target.dataset.mode;
  refreshModalUI();
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('tab-btn')) switchTabUI(e.target.dataset.tab);
  if (e.target.classList.contains('quick-btn')) { el.quantityInput.value = e.target.dataset.qty; el.quantityInput.focus(); }
});

// ==================== 操作 ====================
el.btnSubmit.addEventListener('click', async () => {
  if (currentMode === 'edit') await handleSaveItem();
  else await handleStock();
});

async function handleStock() {
  const quantity = parseFloat(el.quantityInput.value);
  const operator = el.operatorInput.value.trim();
  const note = el.noteInput.value.trim();
  if (!quantity || quantity <= 0) { el.modalError.textContent = '请输入有效的数量'; return; }
  if (!operator) { el.modalError.textContent = '请输入操作人姓名'; return; }
  localStorage.setItem('lastOperator', operator);
  el.btnSubmit.disabled = true; el.btnSubmit.textContent = '处理中...';
  try {
    const fn = currentType === 'in' ? 'stock_in' : 'stock_out';
    await api('/rpc/' + fn, { method: 'POST', body: { p_item_id: currentItem.id, p_quantity: quantity, p_operator: operator, p_note: note } });
    showToast(`${currentItem.name} ${currentType === 'in' ? '入库' : '出库'} ${quantity} ${currentItem.unit} 成功`, 'success');
    closeModal(); refreshAll();
  } catch (err) {
    el.modalError.textContent = err.message; showToast(err.message, 'error');
  } finally {
    el.btnSubmit.disabled = false; updateSubmitButton();
  }
}

async function handleSaveItem() {
  const name = el.editName.value.trim();
  const category = el.editCategory.value.trim();
  const unit = el.editUnit.value.trim();
  const threshold = parseFloat(el.editThreshold.value) || 0;
  if (!name) { el.modalError.textContent = '请输入食材名称'; return; }
  if (!category) { el.modalError.textContent = '请输入分类'; return; }
  if (!unit) { el.modalError.textContent = '请输入单位'; return; }
  el.btnSubmit.disabled = true; el.btnSubmit.textContent = '保存中...';
  try {
    if (currentItem) {
      await api('/inventory_items?id=eq.' + currentItem.id, { method: 'PATCH', body: { name, category, unit, min_threshold: threshold } });
      showToast(`${name} 已更新`, 'success');
    } else {
      await api('/inventory_items', { method: 'POST', body: { name, category, unit, min_threshold: threshold, quantity: 0 }, headers: { 'Prefer': 'return=minimal' } });
      showToast(`${name} 已添加`, 'success');
    }
    closeModal(); await fetchCategories(); refreshAll();
  } catch (err) {
    el.modalError.textContent = err.message; showToast(err.message, 'error');
  } finally {
    el.btnSubmit.disabled = false; updateSubmitButton();
  }
}

// ==================== 删除 ====================
el.btnDelete.addEventListener('click', () => {
  if (!currentItem) return;
  el.confirmText.textContent = `确定要删除「${currentItem.name}」吗？此操作不可撤销。`;
  el.confirmOverlay.classList.add('active');
});

function closeConfirm() { el.confirmOverlay.classList.remove('active'); }
el.confirmClose.addEventListener('click', closeConfirm);
el.confirmOverlay.addEventListener('click', e => { if (e.target === el.confirmOverlay) closeConfirm(); });
el.btnCancel.addEventListener('click', closeConfirm);

el.btnConfirmDelete.addEventListener('click', async () => {
  if (!currentItem) return;
  el.btnConfirmDelete.disabled = true; el.btnConfirmDelete.textContent = '删除中...';
  try {
    await api('/inventory_items?id=eq.' + currentItem.id, { method: 'DELETE' });
    showToast(`${currentItem.name} 已删除`, 'success');
    closeConfirm(); closeModal(); await fetchCategories(); refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    el.btnConfirmDelete.disabled = false; el.btnConfirmDelete.textContent = '确认删除';
  }
});

// 键盘
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (el.confirmOverlay.classList.contains('active')) { closeConfirm(); return; }
    if (el.modalOverlay.classList.contains('active')) { closeModal(); return; }
  }
  if (e.key === 'Enter' && el.modalOverlay.classList.contains('active') && !el.confirmOverlay.classList.contains('active')) {
    if (e.target.tagName !== 'BUTTON') { e.preventDefault(); el.btnSubmit.click(); }
  }
});

// 筛选
let searchTimer;
el.searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(fetchInventory, 300); });
el.categorySelect.addEventListener('change', fetchInventory);

// 状态筛选 - 点击统计卡片
function setStatusFilter(status) {
  if (currentStatusFilter === status) {
    currentStatusFilter = null;
  } else {
    currentStatusFilter = status;
  }
  document.querySelectorAll('.stat-card').forEach(function(card) { card.classList.remove('stat-active'); });
  if (currentStatusFilter) {
    var activeCard = document.querySelector('.stat-' + currentStatusFilter);
    if (activeCard) activeCard.classList.add('stat-active');
  }
  renderInventory();
}

function refreshAll() { fetchStats(); fetchInventory(); fetchLogs(); }

async function init() {
  // 统计卡片点击筛选
  el.stats.empty.addEventListener('click', function() { setStatusFilter('empty'); });
  el.stats.low.addEventListener('click', function() { setStatusFilter('low'); });
  el.stats.normal.addEventListener('click', function() { setStatusFilter('normal'); });
  el.stats.total.addEventListener('click', function() { setStatusFilter(null); });
  await fetchCategories();
  refreshAll();
  setInterval(refreshAll, 30000);
}
init();
