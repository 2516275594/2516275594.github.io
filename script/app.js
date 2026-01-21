// 主应用逻辑
document.addEventListener('DOMContentLoaded', async () => {
    // 检查Supabase配置是否已正确设置
    if (!window.supabaseUrl || !window.supabaseAnonKey || 
        window.supabaseUrl.includes('your-supabase-url') || 
        window.supabaseAnonKey.includes('your-supabase-anon-key')) {
        
        showMessage('请先配置Supabase连接信息！检查script/script.js文件。', 'error');
        document.getElementById('connection-status').textContent = '配置未设置';
        document.getElementById('connection-status').style.color = '#e74c3c';
        return;
    }
    
    // 创建Supabase客户端
    let supabase;
    try {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
        console.error('创建Supabase客户端失败:', error);
        showMessage('Supabase客户端初始化失败: ' + error.message, 'error');
        document.getElementById('connection-status').textContent = '初始化失败';
        document.getElementById('connection-status').style.color = '#e74c3c';
        return;
    }
    
    // 全局变量
    let currentFileId = null;
    let files = [];
    let isConnected = false;
    
    // DOM元素
    const fileItemsContainer = document.getElementById('file-items');
    const newFileBtn = document.getElementById('new-file-btn');
    const deleteFileBtn = document.getElementById('delete-file-btn');
    const saveFileBtn = document.getElementById('save-file-btn');
    const filenameInput = document.getElementById('filename-input');
    const textContent = document.getElementById('text-content');
    const currentFilenameSpan = document.getElementById('current-filename');
    const connectionStatus = document.getElementById('connection-status');
    const messageEl = document.getElementById('message');
    
    // 初始化应用
    await initApp();
    
    // 初始化应用
    async function initApp() {
        // 检查Supabase连接
        await checkConnection();
        
        // 加载文件列表
        await loadFiles();
        
        // 设置事件监听器
        setupEventListeners();
    }
    
    // 检查数据库连接
    async function checkConnection() {
        try {
            // 尝试从Supabase获取数据
            const { data, error } = await supabase
                .from('text_files')
                .select('id')
                .limit(1);
            
            if (error) {
                throw error;
            }
            
            // 连接成功
            isConnected = true;
            connectionStatus.textContent = '已连接到数据库';
            connectionStatus.style.color = '#4CAF50';
            showMessage('数据库连接成功', 'success');
        } catch (error) {
            // 连接失败
            isConnected = false;
            connectionStatus.textContent = '数据库连接失败';
            connectionStatus.style.color = '#e74c3c';
            showMessage('数据库连接失败: ' + error.message, 'error');
            console.error('数据库连接错误:', error);
        }
    }
    
    // 从数据库加载文件列表
    async function loadFiles() {
        // 显示加载状态
        fileItemsContainer.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>正在加载文件列表...</p>
            </div>
        `;
        
        // 如果数据库连接失败，显示错误信息
        if (!isConnected) {
            fileItemsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>数据库连接失败</h3>
                    <p>无法从数据库加载文件，请检查连接设置。</p>
                    <p>错误详情请查看浏览器控制台。</p>
                </div>
            `;
            return;
        }
        
        try {
            // 从Supabase获取文件列表
            const { data, error } = await supabase
                .from('text_files')
                .select('*')
                .order('updated_at', { ascending: false });
            
            if (error) {
                throw error;
            }
            
            files = data || [];
            renderFileList();
            
            // 如果没有文件，显示空状态
            if (files.length === 0) {
                fileItemsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-alt"></i>
                        <h3>暂无文件</h3>
                        <p>点击"新建文件"按钮创建第一个文本文件。</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载文件列表错误:', error);
            fileItemsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>加载失败</h3>
                    <p>无法从数据库加载文件: ${error.message}</p>
                </div>
            `;
        }
    }
    
    // 渲染文件列表
    function renderFileList() {
        if (files.length === 0) return;
        
        fileItemsContainer.innerHTML = '';
        
        files.forEach(file => {
            const fileItem = document.createElement('li');
            fileItem.className = 'file-item';
            if (file.id === currentFileId) {
                fileItem.classList.add('active');
            }
            
            // 格式化日期
            const updatedAt = new Date(file.updated_at);
            const formattedDate = updatedAt.toLocaleDateString('zh-CN') + ' ' + updatedAt.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
            
            fileItem.innerHTML = `
                <div>
                    <div class="file-name">${file.filename}</div>
                    <div class="file-date">更新: ${formattedDate}</div>
                </div>
                <i class="fas fa-chevron-right"></i>
            `;
            
            fileItem.addEventListener('click', () => selectFile(file.id));
            fileItemsContainer.appendChild(fileItem);
        });
    }
    
    // 选择文件
    async function selectFile(fileId) {
        const file = files.find(f => f.id === fileId);
        if (!file) return;
        
        currentFileId = fileId;
        filenameInput.value = file.filename;
        textContent.value = file.content;
        currentFilenameSpan.textContent = file.filename;
        
        // 启用编辑器和保存按钮
        filenameInput.disabled = false;
        textContent.disabled = false;
        saveFileBtn.disabled = false;
        deleteFileBtn.disabled = false;
        
        // 更新文件列表高亮
        renderFileList();
    }
    
    // 创建新文件
    function createNewFile() {
        currentFileId = null;
        filenameInput.value = `新文件_${new Date().getTime()}.txt`;
        textContent.value = '';
        currentFilenameSpan.textContent = '新文件';
        
        // 启用编辑器和保存按钮
        filenameInput.disabled = false;
        textContent.disabled = false;
        saveFileBtn.disabled = false;
        deleteFileBtn.disabled = true;
        
        // 移除文件列表高亮
        renderFileList();
        
        // 聚焦到文件名输入框
        filenameInput.focus();
    }
    
    // 保存文件
    async function saveFile() {
        const filename = filenameInput.value.trim();
        const content = textContent.value;
        
        if (!filename) {
            showMessage('请输入文件名', 'error');
            filenameInput.focus();
            return;
        }
        
        // 检查数据库连接
        if (!isConnected) {
            showMessage('数据库连接失败，无法保存文件', 'error');
            return;
        }
        
        // 显示保存中状态
        saveFileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        saveFileBtn.disabled = true;
        
        try {
            let result;
            
            if (currentFileId) {
                // 更新现有文件
                const { data, error } = await supabase
                    .from('text_files')
                    .update({
                        filename: filename,
                        content: content,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentFileId)
                    .select();
                
                if (error) throw error;
                result = data && data[0];
            } else {
                // 创建新文件
                const { data, error } = await supabase
                    .from('text_files')
                    .insert({
                        filename: filename,
                        content: content,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select();
                
                if (error) throw error;
                result = data && data[0];
                
                // 更新当前文件ID
                if (result) {
                    currentFileId = result.id;
                }
            }
            
            if (result) {
                showMessage('文件保存成功', 'success');
                // 重新加载文件列表
                await loadFiles();
            } else {
                throw new Error('保存失败，未返回数据');
            }
        } catch (error) {
            console.error('保存文件错误:', error);
            showMessage('保存失败: ' + error.message, 'error');
        } finally {
            // 恢复保存按钮状态
            saveFileBtn.innerHTML = '<i class="fas fa-save"></i> 保存文件';
            saveFileBtn.disabled = false;
            deleteFileBtn.disabled = !currentFileId;
        }
    }
    
    // 删除文件
    async function deleteFile() {
        if (!currentFileId) return;
        
        if (!confirm('确定要删除此文件吗？此操作不可撤销。')) {
            return;
        }
        
        // 检查数据库连接
        if (!isConnected) {
            showMessage('数据库连接失败，无法删除文件', 'error');
            return;
        }
        
        try {
            const { error } = await supabase
                .from('text_files')
                .delete()
                .eq('id', currentFileId);
            
            if (error) throw error;
            
            showMessage('文件删除成功', 'success');
            
            // 重置编辑器
            currentFileId = null;
            filenameInput.value = '';
            textContent.value = '';
            currentFilenameSpan.textContent = '未选择文件';
            filenameInput.disabled = true;
            textContent.disabled = true;
            saveFileBtn.disabled = true;
            deleteFileBtn.disabled = true;
            
            // 重新加载文件列表
            await loadFiles();
        } catch (error) {
            console.error('删除文件错误:', error);
            showMessage('删除失败: ' + error.message, 'error');
        }
    }
    
    // 显示消息提示
    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `message ${type} show`;
        
        // 3秒后隐藏消息
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 3000);
    }
    
    // 设置事件监听器
    function setupEventListeners() {
        newFileBtn.addEventListener('click', createNewFile);
        saveFileBtn.addEventListener('click', saveFile);
        deleteFileBtn.addEventListener('click', deleteFile);
        
        // 自动保存文件名更改
        filenameInput.addEventListener('change', () => {
            if (filenameInput.value.trim() && currentFileId) {
                currentFilenameSpan.textContent = filenameInput.value;
            }
        });
        
        // 添加键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S 保存文件
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!saveFileBtn.disabled) {
                    saveFile();
                }
            }
            
            // Ctrl/Cmd + N 新建文件
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                createNewFile();
            }
            
            // Delete 键删除文件
            if (e.key === 'Delete' && !deleteFileBtn.disabled) {
                e.preventDefault();
                deleteFile();
            }
        });
    }
});
