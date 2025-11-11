// 替换为你的 Supabase 项目 URL 和 Anon Key
const supabaseUrl = 'https://ubsdjmcnonsormczvtuq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVic2RqbWNub25zb3JtY3p2dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDA0ODQsImV4cCI6MjA3ODQxNjQ4NH0.ZGD7FkjFdKitHThi22ieZcRipPVgysdTkvowP-UNjAI'
// 初始化 Supabase 客户端
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// 删除密码（可自定义）
const DELETE_PASSWORD = 'jOjsDp0BDAYlGW2r';

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
  let query = supabaseClient.from('notes').select('*');

  if (group) {
    query = query.eq('group_name', group);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('加载笔记失败:', error);
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
      </div>
    `;

    container.appendChild(card);
  });
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

// 删除笔记（带密码验证）
async function deleteNote(id) {
  const inputPassword = prompt('请输入删除密码：');

  if (inputPassword === null) return;

  if (inputPassword.trim() !== DELETE_PASSWORD) {
    alert('密码错误，删除已取消。');
    return;
  }

  const { error } = await supabaseClient.from('notes').delete().eq('id', id);

  if (error) {
    console.error('删除失败:', error);
    alert('删除失败，请稍后再试');
  } else {
    const selectedGroup = document.getElementById('groupFilter').value;
    await loadNotes(selectedGroup);
  }
}

// 页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
  // 绑定分组筛选事件
  document.getElementById('groupFilter').addEventListener('change', function () {
    const selectedGroup = this.value;
    loadNotes(selectedGroup);
  });

  // 初始加载所有笔记
  loadNotes();
});
