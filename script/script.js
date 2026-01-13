// ===== 配置区 =====
const supabaseUrl = 'https://ubsdjmcnonsormczvtuq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVic2RqbWNub25zb3JtY3p2dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDA0ODQsImV4cCI6MjA3ODQxNjQ4NH0.ZGD7FkjFdKitHThi22ieZcRipPVgysdTkvowP-UNjAI';
const DELETE_PASSWORD = 'jOjsDp0BDAYlGW2r';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

let isEditMode = false;
let editModeTimeout;
let currentEditId = null;

// 分页相关变量
let currentPage = 1;
let pageSize = 10; // 默认每页10条
let filteredData = []; // 缓存查询结果用于分页
let totalPageCount = 1;
let currentGroup = ''; // 当前筛选分组

// 格式化日期
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

// 显示模态框
function showEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.style.display = 'flex';
    // 延迟添加show类，触发CSS过渡动画
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
  }
}

// 关闭模态框
function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.classList.remove('show');
    // 等待过渡动画完成后再隐藏元素
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
    currentEditId = null;
  }
}

// 加载笔记（带分组和分页）
async function loadNotes(group = '', page = 1) {
  currentGroup = group;
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'block';

  let query = supabaseClient.from('notes').select('*');
  if (group) query = query.eq('group_name', group);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('加载失败:', error);
    alert('加载失败，请检查网络或权限设置');
    if (loading) loading.style.display = 'none';
    return;
  }

  // 缓存数据用于分页
  filteredData = data || [];
  pageSize = parseInt(document.getElementById('pageSizeSelect')?.value || 10, 10);
  totalPageCount = Math.ceil(filteredData.length / pageSize);
  currentPage = Math.min(Math.max(page, 1), totalPageCount) || 1;

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const paginatedData = filteredData.slice(start, end);

  // 显示笔记
  const container = document.getElementById('notesContainer');
  container.innerHTML = '';

  paginatedData.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-content">${note.content}</div>
      ${note.remark ? `<div style="margin:8px 0;">备注：${note.remark}</div>` : ''}
      <div class="note-footer">
        <span>保存时间：${formatDate(new Date(note.created_at))}</span>
        <span class="delete-btn" data-id="${note.id}">删除</span>
        <span class="edit-btn" 
              data-id="${note.id}" 
              data-content='${JSON.stringify(note.content)}'
              data-remark='${JSON.stringify(note.remark || "")}'
              data-group='${JSON.stringify(note.group_name || "默认")}'>修改</span>
      </div>
    `;
    container.appendChild(card);
  });

  updateEditButtons();
  renderPagination(); // 渲染分页控件
  if (loading) loading.style.display = 'none';
}

// 渲染分页 UI
function renderPagination() {
  const statusEl = document.getElementById('pageStatus');
  const pageNumsEl = document.getElementById('pageNumbers');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (!statusEl || !pageNumsEl || !prevBtn || !nextBtn) return;

  // 更新状态文本
  statusEl.textContent = `第 ${currentPage} 页，共 ${totalPageCount || 1} 页`;

  // 上一页按钮
  prevBtn.disabled = currentPage <= 1;
  prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
  prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';

  // 下一页按钮
  nextBtn.disabled = currentPage >= totalPageCount;
  nextBtn.style.opacity = currentPage >= totalPageCount ? '0.5' : '1';
  nextBtn.style.cursor = currentPage >= totalPageCount ? 'not-allowed' : 'pointer';

  // 页码按钮（最多显示5个）
  pageNumsEl.innerHTML = '';
  const maxVisible = 5;
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPageCount, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.style.margin = '0 4px';
    if (i === currentPage) {
      btn.style.background = '#48BB78';
      btn.style.color = 'white';
      btn.style.fontWeight = 'bold';
    } else {
      btn.style.background = '#f1f5f9';
      btn.style.color = '#333';
    }
    btn.onclick = () => loadNotes(currentGroup, i);
    pageNumsEl.appendChild(btn);
  }
}

// 页面加载完成
document.addEventListener('DOMContentLoaded', async () => {
  const noteForm = document.getElementById('noteForm');
  const enterEditModeBtn = document.getElementById('enterEditModeBtn');
  const groupFilter = document.getElementById('groupFilter');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editNoteForm = document.getElementById('editNoteForm');

  // 分页控件
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');
  const gotoPageBtn = document.getElementById('gotoPageBtn');
  const gotoPageInput = document.getElementById('gotoPageInput');

  // 检查必要元素是否存在
  if (!noteForm || !enterEditModeBtn || !groupFilter || !cancelEditBtn || !editNoteForm) {
    alert('页面组件加载失败，请刷新重试');
    console.error('缺失关键DOM元素');
    return;
  }

  // 初始化样式状态
  document.body.classList.add('edit-mode-deactivated');

  // ========== 表单提交：保存新笔记 ==========
  noteForm.addEventListener('submit', async e => {
    e.preventDefault();
    const content = document.getElementById('mainText').value.trim();
    const remark = document.getElementById('noteText').value.trim();
    const group = document.getElementById('groupSelect').value;

    if (!content) {
      alert('请输入要保存的文本内容！');
      return;
    }

    const { error } = await supabaseClient.from('notes').insert([{ content, remark, group_name: group }]);
    if (error) {
      console.error('保存失败:', error);
      alert('保存失败，请稍后再试');
    } else {
      document.getElementById('mainText').value = '';
      document.getElementById('noteText').value = '';
      await loadNotes(currentGroup, 1); // 刷新并回到第一页
    }
  });

  // ========== 进入修改模式 ==========
  enterEditModeBtn.addEventListener('click', () => {
    const pwd = prompt('请输入修改模式密码：');
    if (pwd === null) return;
    if (pwd !== DELETE_PASSWORD) {
      alert('密码错误');
      return;
    }

    isEditMode = true;
    clearTimeout(editModeTimeout);
    editModeTimeout = setTimeout(() => {
      isEditMode = false;
      document.getElementById('editModeIndicator').style.display = 'none';
      updateEditButtons();
      closeEditModal();
      alert('修改模式已超时退出');
    }, 10 * 60 * 1000);

    document.getElementById('editModeIndicator').style.display = 'inline-block';
    updateEditButtons();
  });

  // ========== 分组筛选 ==========
  groupFilter.addEventListener('change', () => loadNotes(groupFilter.value, 1));

  // ========== 每页数量切换 ==========
  pageSizeSelect?.addEventListener('change', () => loadNotes(currentGroup, 1));

  // ========== 分页按钮 ==========
  prevPage?.addEventListener('click', () => {
    if (currentPage > 1) loadNotes(currentGroup, currentPage - 1);
  });

  nextPage?.addEventListener('click', () => {
    if (currentPage < totalPageCount) loadNotes(currentGroup, currentPage + 1);
  });

  gotoPageBtn?.addEventListener('click', () => {
    const page = parseInt(gotoPageInput.value, 10);
    if (page >= 1 && page <= totalPageCount) {
      loadNotes(currentGroup, page);
      gotoPageInput.value = '';
    } else {
      alert(`请输入 1 到 ${totalPageCount} 之间的页码`);
    }
  });

  // ========== 取消修改 ==========
  cancelEditBtn.addEventListener('click', closeEditModal);

  window.addEventListener('click', e => {
    if (e.target === document.getElementById('editModal')) {
      closeEditModal();
    }
  });

  // ========== 提交修改 ==========
  editNoteForm.addEventListener('submit', async e => {
    e.preventDefault();
    const content = document.getElementById('editContent').value.trim();
    const remark = document.getElementById('editRemark').value.trim();
    const group = document.getElementById('editGroup').value;

    if (!content) {
      alert('文本内容不能为空！');
      return;
    }

    const { error } = await supabaseClient
      .from('notes')
      .update({ content, remark, group_name: group })
      .eq('id', currentEditId);

    if (error) {
      console.error('修改失败:', error);
      alert('修改失败');
    } else {
      closeEditModal();
      await loadNotes(currentGroup, currentPage);
    }
  });

  // ========== 事件委托：删除 & 修改 ==========
  document.getElementById('notesContainer').addEventListener('click', async e => {
    const target = e.target;

    if (target.classList.contains('delete-btn')) {
      if (!isEditMode) return alert('请先进入修改模式');
      if (!confirm('确定删除？')) return;
      const id = target.getAttribute('data-id');
      const { error } = await supabaseClient.from('notes').delete().eq('id', id);
      if (!error) await loadNotes(currentGroup, currentPage);
    }

    if (target.classList.contains('edit-btn')) {
      if (!isEditMode) return alert('请先进入修改模式');
      currentEditId = target.getAttribute('data-id');
      document.getElementById('editContent').value = JSON.parse(target.getAttribute('data-content'));
      document.getElementById('editRemark').value = JSON.parse(target.getAttribute('data-remark'));
      document.getElementById('editGroup').value = JSON.parse(target.getAttribute('data-group'));
      showEditModal();
    }
  });

  // ========== 初始加载 ==========
  await loadNotes('', 1);
});

// 更新按钮可点击状态
function updateEditButtons() {
  const editBtns = document.querySelectorAll('.edit-btn');
  const deleteBtns = document.querySelectorAll('.delete-btn');
  const opacity = isEditMode ? '1' : '0.5';
  const pointer = isEditMode ? 'auto' : 'none';
  editBtns.forEach(btn => { btn.style.opacity = opacity; btn.style.pointerEvents = pointer; });
  deleteBtns.forEach(btn => { btn.style.opacity = opacity; btn.style.pointerEvents = pointer; });
}
