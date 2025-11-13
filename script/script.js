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

    // 使用 data-* 存储数据，避免 onclick 字符串拼接
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

// 进入修改模式
document.getElementById('enterEditModeBtn').addEventListener('click', () => {
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
    alert('修改模式已超时退出');
    updateEditButtons();
  }, 10 * 60 * 1000);

  updateEditButtons();
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

// 修改笔记
async function editNote(id, currentContent, currentRemark, currentGroup) {
  if (!isEditMode) {
    alert('请先进入修改模式');
    return;
  }

  const newContent = prompt('请输入新的文本内容：', currentContent);
  if (newContent === null) return;

  const newRemark = prompt('请输入新的备注（可选）：', currentRemark);
  if (newRemark === null) return;

  const newGroup = prompt(`请输入新的分组（当前：${currentGroup}）：
默认 / 工作 / 生活 / 学习`, currentGroup);
  if (newGroup === null) return;

  const { error } = await supabaseClient
    .from('notes')
    .update({ content: newContent, remark: newRemark, group_name: newGroup })
    .eq('id', id);

  if (error) {
    console.error('修改失败:', error);
    alert('修改失败，请稍后再试');
  } else {
    const selectedGroup = document.getElementById('groupFilter').value;
    await loadNotes(selectedGroup);
  }
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

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('edit-mode-deactivated');

  document.getElementById('groupFilter').addEventListener('change', function () {
    loadNotes(this.value);
  });

  loadNotes();

  // ✅ 关键：使用事件委托绑定动态按钮
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
});
