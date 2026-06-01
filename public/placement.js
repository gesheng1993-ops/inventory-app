// ==================== 货品摆放规范 ====================
let items = [];
let currentItem = null;
let selectedFile = null;

const $ = (s) => document.querySelector(s);
const el = {
  grid: $('#placementGrid'), areaSelect: $('#areaSelect'), fabAdd: $('#fabAdd'), toast: $('#toast'),
  modalOverlay: $('#modalOverlay'), modalTitle: $('#modalTitle'), modalClose: $('#modalClose'),
  pTitle: $('#pTitle'), pArea: $('#pArea'), pDesc: $('#pDesc'), areaList: $('#areaList'),
  uploadArea: $('#uploadArea'), fileInput: $('#fileInput'), uploadPlaceholder: $('#uploadPlaceholder'),
  uploadPreview: $('#uploadPreview'), btnSave: $('#btnSave'), btnDelete: $('#btnDelete'), modalError: $('#modalError'),
  previewOverlay: $('#previewOverlay'), previewImg: $('#previewImg'), previewClose: $('#previewClose'),
  confirmOverlay: $('#confirmOverlay'), confirmText: $('#confirmText'),
  confirmClose: $('#confirmClose'), btnCancel: $('#btnCancel'), btnConfirmDelete: $('#btnConfirmDelete'),
};

function showToast(msg, type) {
  const t = el.toast; t.textContent = msg; t.className = 'toast ' + (type || '') + ' show';
  clearTimeout(t._timer); t._timer = setTimeout(() => { t.className = 'toast'; }, 2000);
}
function escHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

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
async function fetchData() {
  try {
    items = await api('/placement_standards?select=*&order=sort_order.asc,created_at.desc');
  } catch (e) {
    items = [];
    console.error('fetch:', e);
  }
  renderGrid();
  updateAreas();
}

function updateAreas() {
  const areas = [...new Set(items.map(i => i.area).filter(Boolean))].sort();
  el.areaSelect.innerHTML = '<option value="">全部区域</option>' + areas.map(a => '<option value="' + escHtml(a) + '">' + escHtml(a) + '</option>').join('');
  el.areaList.innerHTML = areas.map(a => '<option value="' + escHtml(a) + '">').join('');
}

// ==================== 渲染 ====================
function renderGrid() {
  const area = el.areaSelect.value;
  const filtered = area ? items.filter(i => i.area === area) : items;

  if (!filtered.length) {
    el.grid.innerHTML = '<div class="empty-state">暂无摆放规范，点击右下角 + 添加</div>'; return;
  }

  el.grid.innerHTML = filtered.map(item => {
    const imgUrl = SUPABASE_URL + '/storage/v1/object/public/placement-images/' + item.image_path;
    return '<div class="placement-card">' +
      '<div class="placement-img-wrap"><img class="placement-img" src="' + imgUrl + '" alt="' + escHtml(item.title) + '" data-action="preview" data-src="' + imgUrl + '"></div>' +
      '<div class="placement-info">' +
        '<div class="placement-title-row"><span class="placement-title">' + escHtml(item.title) + '</span>' +
        '<div class="placement-actions">' +
          '<button class="btn-icon" data-action="edit" data-id="' + item.id + '" title="编辑">✏️</button>' +
          '<button class="btn-icon danger" data-action="delete" data-id="' + item.id + '" title="删除">🗑️</button>' +
        '</div></div>' +
        (item.area ? '<div class="placement-area">📍 ' + escHtml(item.area) + '</div>' : '') +
        (item.description ? '<div class="placement-desc">' + escHtml(item.description) + '</div>' : '') +
      '</div></div>';
  }).join('');
}

// ==================== 事件委托 ====================
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'preview') {
    el.previewImg.src = target.dataset.src;
    el.previewOverlay.classList.add('active');
  } else if (action === 'edit') {
    const item = items.find(i => i.id === parseInt(target.dataset.id));
    if (item) openModal(item);
  } else if (action === 'delete') {
    const item = items.find(i => i.id === parseInt(target.dataset.id));
    if (item) { currentItem = item; el.confirmText.textContent = '确定要删除「' + item.title + '」吗？'; el.confirmOverlay.classList.add('active'); }
  }
});

// ==================== 上传区域 ====================
el.uploadArea.addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', () => {
  const file = el.fileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('请选择图片文件', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('图片不能超过 10MB', 'error'); return; }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    el.uploadPreview.src = e.target.result;
    el.uploadPreview.style.display = 'block';
    el.uploadPlaceholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

// ==================== 弹窗 ====================
function openModal(item) {
  currentItem = item || null;
  selectedFile = null;
  el.fileInput.value = '';
  el.modalTitle.textContent = item ? '编辑规范' : '新增规范';
  el.pTitle.value = item ? item.title : '';
  el.pArea.value = item ? item.area : '';
  el.pDesc.value = item ? item.description : '';
  el.modalError.textContent = '';
  el.btnDelete.style.display = item ? 'block' : 'none';

  if (item && item.image_path) {
    el.uploadPreview.src = SUPABASE_URL + '/storage/v1/object/public/placement-images/' + item.image_path;
    el.uploadPreview.style.display = 'block';
    el.uploadPlaceholder.style.display = 'none';
  } else {
    el.uploadPreview.style.display = 'none';
    el.uploadPlaceholder.style.display = 'flex';
  }

  el.modalOverlay.classList.add('active');
  setTimeout(() => el.pTitle.focus(), 300);
}

function closeModal() { el.modalOverlay.classList.remove('active'); currentItem = null; }
el.modalClose.addEventListener('click', closeModal);
el.modalOverlay.addEventListener('click', e => { if (e.target === el.modalOverlay) closeModal(); });
el.fabAdd.addEventListener('click', () => openModal(null));

// ==================== 保存 ====================
el.btnSave.addEventListener('click', async () => {
  const title = el.pTitle.value.trim();
  if (!title) { el.modalError.textContent = '请输入标题'; return; }
  if (!currentItem && !selectedFile) { el.modalError.textContent = '请选择图片'; return; }

  el.btnSave.disabled = true; el.btnSave.textContent = '保存中...';
  try {
    let imagePath = currentItem ? currentItem.image_path : '';

    if (selectedFile) {
      const uploadResult = await uploadImage(selectedFile);
      imagePath = uploadResult.path;
    }

    const body = { title, area: el.pArea.value.trim(), description: el.pDesc.value.trim(), image_path: imagePath };

    if (currentItem) {
      await api('/placement_standards?id=eq.' + currentItem.id, { method: 'PATCH', body });
      showToast('规范已更新', 'success');
    } else {
      const maxOrder = Math.max(0, ...items.map(i => i.sort_order)) + 1;
      body.sort_order = maxOrder;
      await api('/placement_standards', { method: 'POST', body, headers: { 'Prefer': 'return=minimal' } });
      showToast('规范已添加', 'success');
    }
    closeModal(); fetchData();
  } catch (err) {
    el.modalError.textContent = err.message;
  } finally {
    el.btnSave.disabled = false; el.btnSave.textContent = '保存';
  }
});

// ==================== 删除 ====================
el.btnDelete.addEventListener('click', () => {
  if (!currentItem) return;
  el.confirmText.textContent = '确定要删除「' + currentItem.title + '」吗？';
  el.confirmOverlay.classList.add('active');
  closeModal();
});

function closeConfirm() { el.confirmOverlay.classList.remove('active'); }
el.confirmClose.addEventListener('click', closeConfirm);
el.confirmOverlay.addEventListener('click', e => { if (e.target === el.confirmOverlay) closeConfirm(); });
el.btnCancel.addEventListener('click', closeConfirm);

el.btnConfirmDelete.addEventListener('click', async () => {
  if (!currentItem) return;
  el.btnConfirmDelete.disabled = true; el.btnConfirmDelete.textContent = '删除中...';
  try {
    await api('/placement_standards?id=eq.' + currentItem.id, { method: 'DELETE' });
    showToast('已删除', 'success'); closeConfirm(); currentItem = null; fetchData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    el.btnConfirmDelete.disabled = false; el.btnConfirmDelete.textContent = '确认删除';
  }
});

// ==================== 图片预览 ====================
el.previewClose.addEventListener('click', () => el.previewOverlay.classList.remove('active'));
el.previewOverlay.addEventListener('click', e => { if (e.target === el.previewOverlay) el.previewOverlay.classList.remove('active'); });

// 筛选
el.areaSelect.addEventListener('change', renderGrid);

// 键盘
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (el.confirmOverlay.classList.contains('active')) { closeConfirm(); return; }
    if (el.previewOverlay.classList.contains('active')) { el.previewOverlay.classList.remove('active'); return; }
    if (el.modalOverlay.classList.contains('active')) { closeModal(); return; }
  }
});

fetchData();
