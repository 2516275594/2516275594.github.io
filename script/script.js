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
let currentEditId = null; // 存储当前要修改的笔记 ID

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
  if (loading) loading.style.display = 'block';

  let query = supabaseClient.from('notes').select('*');
  if (group) {
    query = query.eq('group_name', group);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (loading) loading.style.display = 'none';

  if (error) {
    console.error('加载失败:', error);
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
}

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
      btn.style.pointerEvents = 'auto';
    });
  } else {
    editBtns.forEach(btn => {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    });
    deleteBtns.forEach(btn => {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
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

// 打开修改模态框
async function editNote(id, content, remark, group) {
  if (!isEditMode) {
    alert('请先进入修改模式');
    return;
  }

  currentEditId = id;
  document.getElementById('editContent').value = content;
  document.getElementById('editRemark').value = remark || '';
  document.getElementById('editGroup').value = group || '默认';

  document.getElementById('editModal').style.display = 'flex';
}

// 关闭模态框
function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  currentEditId = null;
}

// 页面加载完成后初始化（关键！所有 DOM 操作必须放在这里）
document.addEventListener('DOMContentLoaded', async () => {
  // ✅ 确保 DOM 已加载，再获取元素

  const noteForm = document.getElementById('noteForm');
  const enterEditModeBtn = document.getElementById('enterEditModeBtn');
  const groupFilter = document.getElementById('groupFilter');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editNoteForm = document.getElementById('editNoteForm');

  // 检查是否找到所有关键元素
  if (!noteForm || !enterEditModeBtn || !groupFilter || !cancelEditBtn || !editNoteForm) {
    console.error('页面元素未找到，请检查 HTML 是否正确加载');
    alert('系统错误：页面组件缺失，请刷新重试');
    return;
  }

  // 添加类名表示初始状态
  document.body.classList.add('edit-mode-deactivated');

  // 绑定表单提交：保存新笔记
  noteForm.addEventListener('submit', async function (e) {
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
      const selectedGroup = groupFilter.value;
      await loadNotes(selectedGroup);
      this.reset();
    }
  });

  // 进入修改模式按钮
  enterEditModeBtn.addEventListener('click', () => {
    const inputPassword = prompt('请输入修改模式密码：');
    if (inputPassword === null) return;
    if (inputPassword.trim() !== DELETE_PASSWORD) {
      alert('密码错误，修改模式已取消。');
      return;
    }

    isEditMode = true;
    document.body.classList.add('edit-mode-activated');
    document.body.classList.remove('edit-mode-deactivated');
    document.getElementById('editModeIndicator').style.display = 'inline-block';

    clearTimeout(editModeTimeout);
    editModeTimeout = setTimeout(() => {
      isEditMode = false;
      document.body.classList.remove('edit-mode-activated');
      document.body.classList.add('edit-mode-deactivated');
      document.getElementById('editModeIndicator').style.display = 'none';
      closeEditModal();
      updateEditButtons();
      alert('修改模式已超时退出');
    }, 10 * 60 * 1000); // 10分钟

    updateEditButtons();
  });

  // 分组筛选
  groupFilter.addEventListener('change', function () {
    loadNotes(this.value);
  });

  // 取消修改按钮
  cancelEditBtn.addEventListener('click', closeEditModal);

  // 提交修改表单
  editNoteForm.addEventListener('submit', async (e) => {
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
      alert('修改失败，请稍后再试');
    } else {
      closeEditModal();
      const selectedGroup = groupFilter.value;
      await loadNotes(selectedGroup);
    }
  });

  // 点击遮罩层关闭模态框
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('editModal');
    if (e.target === modal) {
      closeEditModal();
    }
  });

  // 事件委托：处理动态按钮点击（删除和修改）
  document.getElementById('notesContainer').addEventListener('click', async (e) => {
    const target = e.target;

    if (target.classList.contains('delete-btn')) {
      const id = target.getAttribute('data-id');
      await deleteNote(id);
    }

    if (target.classList.contains('edit-btn')) {
      const id = target.getAttribute('data-id');
      const content = JSON.parse(target.getAttribute('data-content'));
      const remark = JSON.parse(target.getAttribute('data-remark'));
      const group = JSON.parse(target.getAttribute('data-group'));
      await editNote(id, content, remark, group);
    }
  });

  // 初始加载数据
  await loadNotes();
});
