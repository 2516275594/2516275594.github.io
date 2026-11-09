// Supabase 配置：前端只使用 publishable/anon key，绝不放置 service_role/secret key。
const supabaseUrl = 'https://ubsdjmcnonsormczvtuq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVic2RqbWNub25zb3JtY3p2dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDA0ODQsImV4cCI6MjA3ODQxNjQ4NH0.ZGD7FkjFdKitHThi22ieZcRipPVgysdTkvowP-UNjAI';
const ADMIN_EMAIL = '2516275594@qq.com';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let isEditMode = false;
let currentEditId = null;
let currentPage = 1;
let pageSize = 10;
let filteredData = [];
let totalPageCount = 1;
let currentGroup = '';

function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function setAuthMessage(message, isError = true) {
  const el = document.getElementById('authMessage');
  if (el) { el.textContent = message; el.style.color = isError ? '#b45309' : '#15803d'; }
}
function showApp(user) {
  const allowed = user && (user.email || '').toLowerCase() === ADMIN_EMAIL;
  document.getElementById('authPanel').hidden = !!allowed;
  document.getElementById('appShell').hidden = !allowed;
  if (allowed) {
    document.getElementById('signedInAs').textContent = '已登录：' + user.email;
    loadNotes('', 1);
  } else if (user) {
    setAuthMessage('此账户没有访问权限。');
    supabaseClient.auth.signOut();
  }
}
function updateEditButtons() {
  document.querySelectorAll('.edit-btn,.delete-btn').forEach(btn => {
    btn.style.opacity = isEditMode ? '1' : '.5';
    btn.style.pointerEvents = isEditMode ? 'auto' : 'none';
  });
}
function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) { modal.classList.remove('show'); modal.style.display = 'none'; }
  currentEditId = null;
}
function showEditModal() {
  const modal = document.getElementById('editModal');
  modal.style.display = 'flex'; modal.classList.add('show');
}
function renderPagination() {
  const status = document.getElementById('pageStatus');
  const pageNums = document.getElementById('pageNumbers');
  const prev = document.getElementById('prevPage');
  const next = document.getElementById('nextPage');
  if (!status || !pageNums || !prev || !next) return;
  status.textContent = `第 ${currentPage} 页，共 ${totalPageCount || 1} 页`;
  prev.disabled = currentPage <= 1;
  next.disabled = currentPage >= totalPageCount;
  pageNums.replaceChildren();
  const start = Math.max(1, Math.min(currentPage - 2, totalPageCount - 4));
  for (let i = start; i <= Math.min(totalPageCount, start + 4); i++) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = String(i);
    btn.style.margin = '0 4px';
    if (i === currentPage) { btn.style.background = '#48BB78'; btn.style.color = '#fff'; }
    btn.addEventListener('click', () => loadNotes(currentGroup, i));
    pageNums.appendChild(btn);
  }
}
async function loadNotes(group = '', page = 1) {
  if (!supabaseClient.auth.getSession) return;
  currentGroup = group;
  const loading = document.getElementById('loading');
  loading.style.display = 'block';
  let query = supabaseClient.from('notes').select('*');
  if (group) query = query.eq('group_name', group);
  const { data, error } = await query.order('created_at', { ascending: false });
  loading.style.display = 'none';
  if (error) { console.error(error); alert('加载失败：' + error.message); return; }
  filteredData = data || [];
  pageSize = Number(document.getElementById('pageSizeSelect').value) || 10;
  totalPageCount = Math.ceil(filteredData.length / pageSize);
  currentPage = Math.min(Math.max(page, 1), totalPageCount || 1);
  const items = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const container = document.getElementById('notesContainer');
  container.replaceChildren();
  items.forEach(note => {
    const card = document.createElement('article'); card.className = 'note-card';
    const content = document.createElement('div'); content.className = 'note-content'; content.textContent = note.content || '';
    card.appendChild(content);
    if (note.remark) { const remark = document.createElement('div'); remark.style.margin = '8px 0'; remark.textContent = '备注：' + note.remark; card.appendChild(remark); }
    const footer = document.createElement('div'); footer.className = 'note-footer';
    const date = document.createElement('span'); date.textContent = '保存时间：' + formatDate(new Date(note.created_at));
    const del = document.createElement('span'); del.className = 'delete-btn'; del.dataset.id = note.id; del.textContent = '删除';
    const edit = document.createElement('span'); edit.className = 'edit-btn'; edit.dataset.id = note.id; edit.textContent = '修改';
    footer.append(date, del, edit); card.appendChild(footer); container.appendChild(card);
  });
  updateEditButtons(); renderPagination();
}
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) showApp(session.user);
  supabaseClient.auth.onAuthStateChange((_event, sessionNow) => {
    if (sessionNow) showApp(sessionNow.user);
    else {
      document.getElementById('appShell').hidden = true;
      document.getElementById('authPanel').hidden = false;
      document.getElementById('authPassword').value = '';
    }
  });

  document.getElementById('authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = ADMIN_EMAIL;
    const password = document.getElementById('authPassword').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { setAuthMessage('登录失败：' + error.message); return; }
    setAuthMessage('登录成功', false); showApp(data.user);
  });
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    isEditMode = false; closeEditModal();
    const { error } = await supabaseClient.auth.signOut();
    if (error) alert('退出失败：' + error.message);
  });

  const noteForm = document.getElementById('noteForm');
  noteForm.addEventListener('submit', async e => {
    e.preventDefault();
    const content = document.getElementById('mainText').value.trim();
    const remark = document.getElementById('noteText').value.trim();
    const group = document.getElementById('groupSelect').value;
    if (!content) return;
    const { error } = await supabaseClient.from('notes').insert([{ content, remark, group_name: group }]);
    if (error) alert('保存失败：' + error.message);
    else { document.getElementById('mainText').value = ''; document.getElementById('noteText').value = ''; await loadNotes(currentGroup, 1); }
  });
  document.getElementById('enterEditModeBtn').addEventListener('click', () => {
    isEditMode = !isEditMode;
    document.getElementById('editModeIndicator').style.display = isEditMode ? 'inline-block' : 'none';
    updateEditButtons();
  });
  document.getElementById('groupFilter').addEventListener('change', e => loadNotes(e.target.value, 1));
  document.getElementById('pageSizeSelect').addEventListener('change', () => loadNotes(currentGroup, 1));
  document.getElementById('prevPage').addEventListener('click', () => currentPage > 1 && loadNotes(currentGroup, currentPage - 1));
  document.getElementById('nextPage').addEventListener('click', () => currentPage < totalPageCount && loadNotes(currentGroup, currentPage + 1));
  document.getElementById('gotoPageBtn').addEventListener('click', () => {
    const p = Number(document.getElementById('gotoPageInput').value);
    if (p >= 1 && p <= totalPageCount) { loadNotes(currentGroup, p); document.getElementById('gotoPageInput').value = ''; }
    else alert(`请输入 1 到 ${totalPageCount} 之间的页码`);
  });
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
  window.addEventListener('click', e => { if (e.target === document.getElementById('editModal')) closeEditModal(); });
  document.getElementById('editNoteForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentEditId) return;
    const content = document.getElementById('editContent').value.trim();
    const remark = document.getElementById('editRemark').value.trim();
    const group = document.getElementById('editGroup').value;
    if (!content) return alert('文本内容不能为空！');
    const { error } = await supabaseClient.from('notes').update({ content, remark, group_name: group }).eq('id', currentEditId);
    if (error) alert('修改失败：' + error.message);
    else { closeEditModal(); await loadNotes(currentGroup, currentPage); }
  });
  document.getElementById('notesContainer').addEventListener('click', async e => {
    const target = e.target;
    if (target.classList.contains('delete-btn')) {
      if (!isEditMode) return alert('请先进入修改模式');
      if (!confirm('确定删除这条笔记？')) return;
      const { error } = await supabaseClient.from('notes').delete().eq('id', target.dataset.id);
      if (error) alert('删除失败：' + error.message); else await loadNotes(currentGroup, currentPage);
    }
    if (target.classList.contains('edit-btn')) {
      if (!isEditMode) return alert('请先进入修改模式');
      const note = filteredData.find(n => n.id === target.dataset.id);
      if (!note) return;
      currentEditId = note.id;
      document.getElementById('editContent').value = note.content || '';
      document.getElementById('editRemark').value = note.remark || '';
      document.getElementById('editGroup').value = note.group_name || '默认';
      showEditModal();
    }
  });
});