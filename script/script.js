// 替换为你的 Supabase 项目 URL 和 Anon Key
const supabaseUrl = 'https://ubsdjmcnonsormczvtuq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVic2RqbWNub25zb3JtY3p2dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDA0ODQsImV4cCI6MjA3ODQxNjQ4NH0.ZGD7FkjFdKitHThi22ieZcRipPVgysdTkvowP-UNjAI';

// 初始化 Supabase 客户端
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// 删除密码（可自定义）
const DELETE_PASSWORD = 'jOjsDp0BDAYlGW2r';

// 修改模式状态
let isEditMode = false;
let editModeTimeout;
let currentEditId = null;
let currentEditContent = '';
let currentEditRemark = '';
let currentEditGroup = '默认';

// 格式化日期
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

// 加载所有笔记（支持分组过滤）
async function loadNotes(group = '') {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'block'; // 显示加载动画

  let query = supabaseClient.from('notes').select('*');

  if (group) {
    query = query.eq('group_name', group);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (loading) loading.style.display = 'none'; // 隐藏加载动画

  if (error) {
    console.error('加载笔记失败:', error);
    alert('加载失败，请检查网络或权限设置');
    return;
  }

  const container = document.getElementById('notesContainer');
  container.innerHTML = '';

  data.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';

    card.innerHTML = `
      <div class="note-content">${note.content}</div>
      ${note.remark ? `<div style="margin:8px 0;">备注：${note.remark}</div>` : ''}
      <div class="note-footer">
        <span>保存时间：${formatDate(new Date(note.created_at))}</span>
        <span class="delete-btn" onclick="deleteNote('${note.id}')">删除</span>
        <span class="edit-btn" onclick="editNote('${note.id}', '${note.content}', '${note.remark || ''}', '${note.group_name || '默认'}')">修改</span>
      </div>
    `;

    container.appendChild(card);
  });

  // 更新按钮状态
  updateEditButtons();
}

// 进入修改模式
document.getElementById('enterEditModeBtn').addEventListener('click', () => {
  const inputPassword = prompt('请输入修改模式密码：');
  if (inputPassword === null) return;
  if (inputPassword.trim() !== DELETE_PASSWORD) {
    alert('密码错误，修改模式已取消。');
    return;
  }

  // 激活修改模式
  isEditMode = true;
  document.body.classList.add('edit-mode-activated');
  document.body.classList.remove('edit-mode-deactivated');
  document.getElementById('editModeIndicator').style.display = 'inline-block';

  // 更新按钮状态
  updateEditButtons();

  // 10分钟后自动退出修改模式
  clearTimeout(editModeTimeout);
  editModeTimeout = setTimeout(() => {
    isEditMode = false;
    document.body.classList.remove('edit-mode-activated');
    document.body.classList.add('edit-mode-deactivated');
    document.getElementById('editModeIndicator').style.display = 'none';
    alert('修改模式已超时退出');
    updateEditButtons();
  }, 10 * 60 * 1000); // 10分钟
});

// 更新按钮状态
function updateEditButtons() {
  const editBtns = document.querySelectorAll('.edit-btn');
  const deleteBtns = document.querySelectorAll('.delete-btn');

  if (isEditMode) {
    editBtns.forEach(btn => {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    });
    deleteBtns.forEach(btn => {
      btn.style.opacity = '1';
      btn.style.pointer-events = 'auto';
    });
  } else {
    editBtns.forEach(btn => {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    });
    deleteBtns.forEach(btn => {
      btn.style.opacity = '0.5';
      btn.style.pointer-events = 'none';
    });
  }
}

// 删除笔记
async function deleteNote(id) {
  if (!isEditMode) {
    alert('请先进入修改模式');
    return;
  }

  const confirmDelete = confirm('确定要删除这条笔记吗？');
  if (!confirmDelete) return;

  const { error } = await supabaseClient.from('notes').delete().eq('id', id);
  if (error) {
    console.error('删除失败:', error);
    alert('删除失败，请稍后再试');
  } else {
    const selectedGroup = document.getElementById('groupFilter').value;
    await loadNotes(selectedGroup);
  }
}

// 删除笔记
async function deleteNote(id) {
  if (!isEditMode) {
    alert('请先进入修改模式');
    return;
  }

  const confirmDelete = confirm('确定要删除这条笔记吗？');
  if (!confirmDelete) return;

  const { error } = await supabaseClient.from('notes').delete().eq('id', id);
  if (error) {
    console.error('删除失败:', error);
    alert('删除失败，请稍后再试');
  } else {
    const selectedGroup = document.getElementById('groupFilter').value;
    await loadNotes(selectedGroup);
  }
}

  // 显示密码验证模态框
  document.getElementById('passwordModal').style.display = 'block';
}

// 验证密码
document.getElementById('submitPasswordBtn').addEventListener('click', () => {
  const inputPassword = document.getElementById('editPasswordInput').value.trim();
  if (inputPassword !== DELETE_PASSWORD) {
    alert('密码错误');
    return;
  }

  // 隐藏密码框，显示编辑框
  document.getElementById('passwordModal').style.display = 'none';
  document.getElementById('editNoteModal').style.display = 'block';

  // 填入当前内容
  document.getElementById('editContentInput').value = currentEditContent;
  document.getElementById('editRemarkInput').value = currentEditRemark;
  document.getElementById('editGroupSelect').value = currentEditGroup; // 填入当前分组
});

// 保存修改
document.getElementById('saveEditBtn').addEventListener('click', async () => {
  const newContent = document.getElementById('editContentInput').value.trim();
  const newRemark = document.getElementById('editRemarkInput').value.trim();
  const newGroup = document.getElementById('editGroupSelect').value;

  if (!newContent) {
    alert('文本内容不能为空');
    return;
  }

  const { error } = await supabaseClient
    .from('notes')
    .update({ 
      content: newContent, 
      remark: newRemark,
      group_name: newGroup
    })
    .eq('id', currentEditId);

  if (error) {
    console.error('修改失败:', error);
    alert('修改失败，请稍后再试');
  } else {
    closeAllModals();
    const selectedGroup = document.getElementById('groupFilter').value;
    await loadNotes(selectedGroup);
  }
});

// 关闭所有模态框
function closeAllModals() {
  document.getElementById('passwordModal').style.display = 'none';
  document.getElementById('editNoteModal').style.display = 'none';
  document.getElementById('editPasswordInput').value = '';
  document.getElementById('editContentInput').value = '';
  document.getElementById('editRemarkInput').value = '';
}

// 保存笔记
document.getElementById('noteForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const content = document.getElementById('mainText').value.trim();
  const remark = document.getElementById('noteText').value.trim();
  const group = document.getElementById('groupSelect').value;

  if (!content) {
    alert('请输入要保存的文本内容！');
    return;
  }

  const { data, error } = await supabaseClient.from('notes').insert([
    { content, remark, group_name: group }
  ]);

  if (error) {
    console.error('保存失败:', error);
    alert('保存失败，请稍后再试');
  } else {
    const selectedGroup = document.getElementById('groupFilter').value;
    await loadNotes(selectedGroup);
    this.reset();
  }
});

// 页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
  // 初始为修改模式禁用状态
  document.body.classList.add('edit-mode-deactivated');

  // 绑定分组筛选事件
  document.getElementById('groupFilter').addEventListener('change', function () {
    const selectedGroup = this.value;
    loadNotes(selectedGroup);
  });

  // 初始加载所有笔记
  loadNotes();
});
