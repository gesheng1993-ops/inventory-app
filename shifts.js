// ==================== 班次职责 - Supabase 版 ====================
let shiftsData = [];
let currentShiftId = null;
let currentDuty = null;
let deleteTarget = null;

const $ = (s) => document.querySelector(s);
const el = {
  shiftsList: $('#shiftsList'), fabAdd: $('#fabAdd'), toast: $('#toast'),
  shiftModal: $('#shiftModal'), shiftModalTitle: $('#shiftModalTitle'), shiftModalClose: $('#shiftModalClose'),
  shiftName: $('#shiftName'), shiftTime: $('#shiftTime'), btnSaveShift: $('#btnSaveShift'), shiftModalError: $('#shiftModalError'),
  dutyModal: $('#dutyModal'), dutyModalTitle: $('#dutyModalTitle'), dutyModalClose: $('#dutyModalClose'),
  dutyRole: $('#dutyRole'), dutyText: $('#dutyText'), btnSaveDuty: $('#btnSaveDuty'), btnDeleteDuty: $('#btnDeleteDuty'), dutyModalError: $('#dutyModalError'),
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
async function fetchShifts() {
  const data = await api('/shifts?select=*,shift_duties(*)&order=sort_order');
  shiftsData = (data || []).map(s => ({ ...s, duties: (s.shift_duties || []).sort((a, b) => a.sort_order - b.sort_order) }));
  renderShifts();
}

// ==================== 渲染 ====================
function renderShifts() {
  if (!shiftsData.length) {
    el.shiftsList.innerHTML = '<div class="empty-state">暂无班次，点击右下角 + 添加</div>'; return;
  }
  el.shiftsList.innerHTML = shiftsData.map(shift => {
    const duties = shift.duties || [];
    const dutiesHtml = duties.length === 0
      ? '<div class="duty-empty">暂无职责，点击下方按钮添加</div>'
      : duties.map(d => `
          <div class="duty-card">
            <div class="duty-role">
              <span>${escHtml(d.role)}</span>
              <div class="duty-actions">
                <button class="btn-icon" data-action="edit-duty" data-duty-id="${d.id}" data-shift-id="${shift.id}" title="编辑">✏️</button>
                <button class="btn-icon danger" data-action="delete-duty" data-duty-id="${d.id}" data-shift-id="${shift.id}" title="删除">🗑️</button>
              </div>
            </div>
            <div class="duty-text">${escHtml(d.duties)}</div>
          </div>`).join('');
    return `<div class="shift-card open" id="shift-${shift.id}">
      <div class="shift-card-header" data-action="toggle-shift" data-shift-id="${shift.id}">
        <div>
          <span class="shift-card-title">${escHtml(shift.name)}</span>
          <span class="shift-card-time">${escHtml(shift.time_range)}</span>
        </div>
        <div class="shift-card-meta">
          <span>${duties.length}个岗位</span>
          <button class="btn-icon" data-action="edit-shift" data-shift-id="${shift.id}" title="编辑">✏️</button>
          <button class="btn-icon danger" data-action="delete-shift" data-shift-id="${shift.id}" title="删除">🗑️</button>
          <span class="shift-card-arrow">▼</span>
        </div>
      </div>
      <div class="shift-duties">
        ${dutiesHtml}
        <button class="shift-add-duty" data-action="add-duty" data-shift-id="${shift.id}">+ 添加职责</button>
      </div>
    </div>`;
  }).join('');
}

// ==================== 事件委托 ====================
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'toggle-shift') {
    document.getElementById('shift-' + target.dataset.shiftId)?.classList.toggle('open');
  } else if (action === 'edit-shift') {
    const s = shiftsData.find(s => s.id === parseInt(target.dataset.shiftId));
    if (s) openShiftModal(s);
  } else if (action === 'delete-shift') {
    const s = shiftsData.find(s => s.id === parseInt(target.dataset.shiftId));
    if (s) { deleteTarget = { type: 'shift', id: s.id }; el.confirmText.textContent = `确定要删除「${s.name}」吗？`; el.confirmOverlay.classList.add('active'); }
  } else if (action === 'add-duty') {
    currentShiftId = parseInt(target.dataset.shiftId); currentDuty = null; openDutyModal();
  } else if (action === 'edit-duty') {
    currentShiftId = parseInt(target.dataset.shiftId);
    const shift = shiftsData.find(s => s.id === currentShiftId);
    if (shift) { currentDuty = shift.duties.find(d => d.id === parseInt(target.dataset.dutyId)); if (currentDuty) openDutyModal(currentDuty); }
  } else if (action === 'delete-duty') {
    currentShiftId = parseInt(target.dataset.shiftId);
    const shift = shiftsData.find(s => s.id === currentShiftId);
    if (shift) {
      const duty = shift.duties.find(d => d.id === parseInt(target.dataset.dutyId));
      if (duty) { deleteTarget = { type: 'duty', id: duty.id }; el.confirmText.textContent = `确定要删除「${duty.role}」吗？`; el.confirmOverlay.classList.add('active'); }
    }
  }
});

// ==================== 班次弹窗 ====================
function openShiftModal(shift) {
  currentShiftId = shift ? shift.id : null;
  el.shiftModalTitle.textContent = shift ? '编辑班次' : '新增班次';
  el.shiftName.value = shift ? shift.name : '';
  el.shiftTime.value = shift ? shift.time_range : '';
  el.shiftModalError.textContent = '';
  el.shiftModal.classList.add('active');
  setTimeout(() => el.shiftName.focus(), 300);
}
function closeShiftModal() { el.shiftModal.classList.remove('active'); }
el.shiftModalClose.addEventListener('click', closeShiftModal);
el.shiftModal.addEventListener('click', e => { if (e.target === el.shiftModal) closeShiftModal(); });
el.fabAdd.addEventListener('click', () => openShiftModal(null));

el.btnSaveShift.addEventListener('click', async () => {
  const name = el.shiftName.value.trim();
  if (!name) { el.shiftModalError.textContent = '请输入班次名称'; return; }
  el.btnSaveShift.disabled = true; el.btnSaveShift.textContent = '保存中...';
  try {
    if (currentShiftId) {
      await api('/shifts?id=eq.' + currentShiftId, { method: 'PATCH', body: { name, time_range: el.shiftTime.value.trim() } });
    } else {
      const maxOrder = Math.max(0, ...shiftsData.map(s => s.sort_order)) + 1;
      await api('/shifts', { method: 'POST', body: { name, time_range: el.shiftTime.value.trim(), sort_order: maxOrder }, headers: { 'Prefer': 'return=minimal' } });
    }
    showToast(currentShiftId ? '班次已更新' : '班次已添加', 'success');
    closeShiftModal(); fetchShifts();
  } catch (err) {
    el.shiftModalError.textContent = err.message;
  } finally {
    el.btnSaveShift.disabled = false; el.btnSaveShift.textContent = '保存';
  }
});

// ==================== 职责弹窗 ====================
function openDutyModal(duty) {
  el.dutyModalTitle.textContent = duty ? '编辑职责' : '新增职责';
  el.dutyRole.value = duty ? duty.role : '';
  el.dutyText.value = duty ? duty.duties : '';
  el.dutyModalError.textContent = '';
  el.btnDeleteDuty.style.display = duty ? 'block' : 'none';
  el.dutyModal.classList.add('active');
  setTimeout(() => el.dutyRole.focus(), 300);
}
function closeDutyModal() { el.dutyModal.classList.remove('active'); }
el.dutyModalClose.addEventListener('click', closeDutyModal);
el.dutyModal.addEventListener('click', e => { if (e.target === el.dutyModal) closeDutyModal(); });

el.btnSaveDuty.addEventListener('click', async () => {
  const role = el.dutyRole.value.trim();
  const duties = el.dutyText.value.trim();
  if (!role) { el.dutyModalError.textContent = '请输入岗位名称'; return; }
  if (!duties) { el.dutyModalError.textContent = '请输入具体职责'; return; }
  el.btnSaveDuty.disabled = true; el.btnSaveDuty.textContent = '保存中...';
  try {
    if (currentDuty) {
      await api('/shift_duties?id=eq.' + currentDuty.id, { method: 'PATCH', body: { role, duties } });
    } else {
      const maxOrder = Math.max(0, ...((shiftsData.find(s => s.id === currentShiftId)?.duties || []).map(d => d.sort_order))) + 1;
      await api('/shift_duties', { method: 'POST', body: { shift_id: currentShiftId, role, duties, sort_order: maxOrder }, headers: { 'Prefer': 'return=minimal' } });
    }
    showToast(currentDuty ? '职责已更新' : '职责已添加', 'success');
    closeDutyModal(); fetchShifts();
  } catch (err) {
    el.dutyModalError.textContent = err.message;
  } finally {
    el.btnSaveDuty.disabled = false; el.btnSaveDuty.textContent = '保存';
  }
});

el.btnDeleteDuty.addEventListener('click', () => {
  if (!currentDuty) return;
  deleteTarget = { type: 'duty', id: currentDuty.id };
  el.confirmText.textContent = `确定要删除「${currentDuty.role}」吗？`;
  el.confirmOverlay.classList.add('active');
  closeDutyModal();
});

// ==================== 确认弹窗 ====================
function closeConfirm() { el.confirmOverlay.classList.remove('active'); }
el.confirmClose.addEventListener('click', closeConfirm);
el.confirmOverlay.addEventListener('click', e => { if (e.target === el.confirmOverlay) closeConfirm(); });
el.btnCancel.addEventListener('click', closeConfirm);

el.btnConfirmDelete.addEventListener('click', async () => {
  if (!deleteTarget) return;
  el.btnConfirmDelete.disabled = true; el.btnConfirmDelete.textContent = '删除中...';
  try {
    if (deleteTarget.type === 'shift') {
      await api('/shifts?id=eq.' + deleteTarget.id, { method: 'DELETE' });
    } else {
      await api('/shift_duties?id=eq.' + deleteTarget.id, { method: 'DELETE' });
    }
    showToast('已删除', 'success'); closeConfirm(); fetchShifts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    el.btnConfirmDelete.disabled = false; el.btnConfirmDelete.textContent = '确认删除';
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (el.confirmOverlay.classList.contains('active')) { closeConfirm(); return; }
    if (el.dutyModal.classList.contains('active')) { closeDutyModal(); return; }
    if (el.shiftModal.classList.contains('active')) { closeShiftModal(); return; }
  }
});

fetchShifts();
