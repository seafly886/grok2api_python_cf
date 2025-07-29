// Grok API 管理面板 JavaScript

// 全局变量
let keyMode = 'polling';
let usageLimit = 20;
let confirmCallback = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// 初始化页面
async function initializePage() {
    try {
        // 检查认证状态
        await checkAuth();
        
        // 加载数据
        await Promise.all([
            loadStatus(),
            loadKeyMode(),
            loadTokens()
        ]);
        
        // 设置事件监听器
        setupEventListeners();
        
        // 设置自动刷新
        setInterval(refreshData, 30000); // 30秒刷新一次
        
        showNotification('页面加载完成', 'success');
    } catch (error) {
        console.error('页面初始化失败:', error);
        showNotification('页面初始化失败: ' + error.message, 'error');
    }
}

// 检查认证状态
async function checkAuth() {
    try {
        const response = await fetch('/manager/api/status');
        if (response.status === 401) {
            window.location.href = '/manager/login';
            return;
        }
        if (!response.ok) {
            throw new Error('认证检查失败');
        }
    } catch (error) {
        console.error('认证检查错误:', error);
        // 如果是网络错误，可能是未登录，重定向到登录页
        window.location.href = '/manager/login';
    }
}

// 设置事件监听器
function setupEventListeners() {
    // Key模式切换
    const keyModeSwitch = document.getElementById('keyModeSwitch');
    if (keyModeSwitch) {
        keyModeSwitch.addEventListener('change', function() {
            keyMode = this.checked ? 'single' : 'polling';
            updateKeyModeUI();
        });
    }
    
    // 使用次数限制输入
    const usageLimitInput = document.getElementById('usageLimit');
    if (usageLimitInput) {
        usageLimitInput.addEventListener('change', function() {
            usageLimit = parseInt(this.value) || 20;
        });
    }
    
    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'r':
                    e.preventDefault();
                    refreshData();
                    break;
                case 's':
                    e.preventDefault();
                    updateKeyMode();
                    break;
            }
        }
    });
}

// 加载系统状态
async function loadStatus() {
    try {
        const response = await fetch('/manager/api/status');
        if (!response.ok) throw new Error('获取状态失败');
        
        const data = await response.json();
        updateStatsDisplay(data.stats);
        updateModelStats(data.stats.modelStats);
        
        return data;
    } catch (error) {
        console.error('加载状态失败:', error);
        showNotification('加载状态失败: ' + error.message, 'error');
        throw error;
    }
}

// 更新统计显示
function updateStatsDisplay(stats) {
    const statsContainer = document.getElementById('stats');
    if (!statsContainer) return;
    
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalTokens || 0}</div>
            <div>总 Token 数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.validTokens || 0}</div>
            <div>有效 Token</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalRequests || 0}</div>
            <div>总请求数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${keyMode === 'polling' ? '轮询' : '单Key'}</div>
            <div>当前模式</div>
        </div>
    `;
    
    statsContainer.innerHTML = statsHtml;
}

// 更新模型统计
function updateModelStats(modelStats) {
    const container = document.getElementById('modelStats');
    if (!container || !modelStats) return;
    
    let html = '';
    for (const [model, stats] of Object.entries(modelStats)) {
        html += `
            <div class="model-stat">
                <h4>${model}</h4>
                <div class="model-stat-grid">
                    <div>
                        <div class="token-detail-value">${stats.tokenCount || 0}</div>
                        <div class="token-detail-label">Token 数量</div>
                    </div>
                    <div>
                        <div class="token-detail-value">${stats.totalRequests || 0}</div>
                        <div class="token-detail-label">总请求数</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html || '<p>暂无数据</p>';
}

// 加载Key模式配置
async function loadKeyMode() {
    try {
        const response = await fetch('/manager/api/key_mode');
        if (!response.ok) throw new Error('获取Key模式失败');
        
        const config = await response.json();
        keyMode = config.keyMode || 'polling';
        usageLimit = config.usageLimit || 20;
        
        updateKeyModeUI();
        
        return config;
    } catch (error) {
        console.error('加载Key模式失败:', error);
        showNotification('加载Key模式失败: ' + error.message, 'error');
        throw error;
    }
}

// 更新Key模式UI
function updateKeyModeUI() {
    const switchElement = document.getElementById('keyModeSwitch');
    const labelElement = document.getElementById('keyModeLabel');
    const usageLimitGroup = document.getElementById('usageLimitGroup');
    const usageLimitInput = document.getElementById('usageLimit');
    const modeDescription = document.getElementById('modeDescription');
    
    if (switchElement) {
        switchElement.checked = keyMode === 'single';
    }
    
    if (labelElement) {
        labelElement.textContent = keyMode === 'single' ? '单Key循环模式' : '轮询模式';
    }
    
    if (usageLimitGroup) {
        usageLimitGroup.style.display = keyMode === 'single' ? 'block' : 'none';
    }
    
    if (usageLimitInput) {
        usageLimitInput.value = usageLimit;
    }
    
    if (modeDescription) {
        const descriptions = {
            'polling': '<p><strong>轮询模式：</strong>每个token使用一次后立即切换到下一个token进行循环</p>',
            'single': '<p><strong>单Key循环模式：</strong>使用单个token直到达到配置的使用次数限制后切换到下一个token</p>'
        };
        modeDescription.innerHTML = descriptions[keyMode];
    }
}

// 更新Key模式
async function updateKeyMode() {
    try {
        const config = {
            keyMode,
            usageLimit: parseInt(document.getElementById('usageLimit').value) || 20
        };
        
        const response = await fetch('/manager/api/key_mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) throw new Error('保存配置失败');
        
        const result = await response.json();
        if (result.success) {
            showNotification('配置已保存', 'success');
            await loadStatus(); // 刷新状态
        } else {
            throw new Error(result.error || '保存失败');
        }
    } catch (error) {
        console.error('保存配置失败:', error);
        showNotification('保存配置失败: ' + error.message, 'error');
    }
}

// 添加Token
async function addToken() {
    const typeElement = document.getElementById('tokenType');
    const valueElement = document.getElementById('tokenValue');
    
    if (!typeElement || !valueElement) return;
    
    const type = typeElement.value;
    const token = valueElement.value.trim();
    
    if (!token) {
        showNotification('请输入 Token', 'warning');
        return;
    }
    
    // 验证token格式
    if (!token.includes('sso=')) {
        showNotification('Token格式不正确，请确保包含 sso= 部分', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/manager/api/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, token })
        });
        
        if (!response.ok) throw new Error('添加Token失败');
        
        const result = await response.json();
        if (result.success) {
            showNotification('Token 添加成功', 'success');
            valueElement.value = '';
            await Promise.all([loadTokens(), loadStatus()]);
        } else {
            throw new Error(result.error || '添加失败');
        }
    } catch (error) {
        console.error('添加Token失败:', error);
        showNotification('添加Token失败: ' + error.message, 'error');
    }
}

// 删除Token
async function deleteToken(token) {
    showConfirmDialog(
        '确定要删除这个 Token 吗？删除后无法恢复。',
        async () => {
            try {
                const response = await fetch('/manager/api/tokens', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                
                if (!response.ok) throw new Error('删除Token失败');
                
                const result = await response.json();
                if (result.success) {
                    showNotification('Token 删除成功', 'success');
                    await Promise.all([loadTokens(), loadStatus()]);
                } else {
                    throw new Error(result.error || '删除失败');
                }
            } catch (error) {
                console.error('删除Token失败:', error);
                showNotification('删除Token失败: ' + error.message, 'error');
            }
        }
    );
}

// 加载Token列表
async function loadTokens() {
    try {
        const response = await fetch('/manager/api/tokens');
        if (!response.ok) throw new Error('获取Token列表失败');
        
        const data = await response.json();
        updateTokenList(data);
        
        return data;
    } catch (error) {
        console.error('加载Token列表失败:', error);
        showNotification('加载Token列表失败: ' + error.message, 'error');
        
        // 显示错误状态
        const tokenList = document.getElementById('tokenList');
        if (tokenList) {
            tokenList.innerHTML = '<div class="loading-placeholder"><p>加载失败</p></div>';
        }
        
        throw error;
    }
}

// 更新Token列表显示
function updateTokenList(data) {
    const tokenList = document.getElementById('tokenList');
    if (!tokenList) return;
    
    // 收集所有唯一的token
    const allTokens = new Set();
    for (const tokens of Object.values(data.pools || {})) {
        for (const tokenEntry of tokens) {
            allTokens.add(tokenEntry.token);
        }
    }
    
    if (allTokens.size === 0) {
        tokenList.innerHTML = '<div class="loading-placeholder"><p>暂无 Token</p></div>';
        return;
    }
    
    let html = '';
    for (const token of allTokens) {
        const sso = extractSSO(token);
        const tokenStatus = data.status[sso] || {};
        
        // 计算总体状态
        const modelStatuses = Object.values(tokenStatus);
        const isValid = modelStatuses.some(s => s.isValid);
        const totalRequests = modelStatuses.reduce((sum, s) => sum + (s.totalRequestCount || 0), 0);
        const isSuper = modelStatuses.some(s => s.isSuper);
        
        // 计算各模型的请求数
        const modelDetails = Object.entries(tokenStatus).map(([model, status]) => ({
            model,
            requests: status.totalRequestCount || 0,
            valid: status.isValid
        }));
        
        html += `
            <div class="token-item ${isValid ? '' : 'invalid'}">
                <div class="token-header">
                    <div>
                        <div class="token-sso">SSO: ${sso}</div>
                        <small>${isSuper ? '超级Token' : '普通Token'}</small>
                    </div>
                    <div class="token-status ${isValid ? 'valid' : 'invalid'}">
                        ${isValid ? '有效' : '无效'}
                    </div>
                </div>
                <div class="token-details">
                    <div class="token-detail">
                        <div class="token-detail-value">${totalRequests}</div>
                        <div class="token-detail-label">总请求数</div>
                    </div>
                    <div class="token-detail">
                        <div class="token-detail-value">${modelDetails.filter(m => m.valid).length}</div>
                        <div class="token-detail-label">有效模型</div>
                    </div>
                    <div class="token-detail">
                        <div class="token-detail-value">${modelDetails.length}</div>
                        <div class="token-detail-label">总模型数</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <button class="btn btn-danger" onclick="deleteToken('${token.replace(/'/g, "\\'")}')">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        `;
    }
    
    tokenList.innerHTML = html;
}

// 提取SSO
function extractSSO(cookieString) {
    try {
        const match = cookieString.match(/sso=([^;]+)/);
        return match ? match[1].substring(0, 20) + '...' : 'unknown';
    } catch {
        return 'unknown';
    }
}

// 刷新所有数据
async function refreshData() {
    try {
        showNotification('正在刷新数据...', 'success');
        await Promise.all([
            loadStatus(),
            loadKeyMode(),
            loadTokens()
        ]);
        showNotification('数据刷新完成', 'success');
    } catch (error) {
        console.error('刷新数据失败:', error);
        showNotification('刷新数据失败: ' + error.message, 'error');
    }
}

// 导出配置
async function exportTokens() {
    try {
        const data = await loadTokens();
        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            tokens: data.pools,
            status: data.status
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `grok-tokens-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        showNotification('配置导出成功', 'success');
    } catch (error) {
        console.error('导出配置失败:', error);
        showNotification('导出配置失败: ' + error.message, 'error');
    }
}

// 导入配置
async function importTokens(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // 验证数据格式
        if (!data.tokens || typeof data.tokens !== 'object') {
            throw new Error('配置文件格式不正确');
        }
        
        showConfirmDialog(
            '导入配置将覆盖现有的Token设置，确定要继续吗？',
            async () => {
                try {
                    // 这里需要实现批量导入的API
                    showNotification('导入功能开发中...', 'warning');
                } catch (error) {
                    showNotification('导入配置失败: ' + error.message, 'error');
                }
            }
        );
    } catch (error) {
        console.error('导入配置失败:', error);
        showNotification('导入配置失败: ' + error.message, 'error');
    }
    
    // 清空文件输入
    event.target.value = '';
}

// 退出登录
async function logout() {
    showConfirmDialog(
        '确定要退出登录吗？',
        () => {
            // 清除cookie并重定向
            document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.href = '/manager/login';
        }
    );
}

// 显示通知
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// 显示确认对话框
function showConfirmDialog(message, callback) {
    const dialog = document.getElementById('confirmDialog');
    const messageElement = document.getElementById('confirmMessage');
    
    if (!dialog || !messageElement) return;
    
    messageElement.textContent = message;
    confirmCallback = callback;
    dialog.classList.add('show');
}

// 关闭确认对话框
function closeConfirmDialog() {
    const dialog = document.getElementById('confirmDialog');
    if (dialog) {
        dialog.classList.remove('show');
    }
    confirmCallback = null;
}

// 确认操作
function confirmAction() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmDialog();
}
