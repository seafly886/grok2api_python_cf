/**
 * Manager Handler for Cloudflare Workers
 * Handles management interface and API endpoints
 */
export class ManagerHandler {
  constructor(env, logger, tokenManager, config, httpClient) {
    this.env = env;
    this.logger = logger;
    this.tokenManager = tokenManager;
    this.config = config;
    this.httpClient = httpClient;
  }

  async handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Check authentication for management endpoints
    if (path.startsWith('/manager/api/') && !await this.checkAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Route handling
    if (path === '/manager' || path === '/manager/') {
      return await this.serveManagerPage(request);
    } else if (path === '/manager/login') {
      return await this.serveLoginPage();
    } else if (path === '/manager/api/login' && method === 'POST') {
      return await this.handleLogin(request);
    } else if (path === '/manager/api/tokens' && method === 'GET') {
      return await this.getTokens();
    } else if (path === '/manager/api/tokens' && method === 'POST') {
      return await this.addToken(request);
    } else if (path === '/manager/api/tokens' && method === 'DELETE') {
      return await this.deleteToken(request);
    } else if (path === '/manager/api/key_mode' && method === 'GET') {
      return await this.getKeyMode();
    } else if (path === '/manager/api/key_mode' && method === 'POST') {
      return await this.setKeyMode(request);
    } else if (path === '/manager/api/status') {
      return await this.getStatus();
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }

  async checkAuth(request) {
    // Simple session-based auth
    const sessionCookie = this.getCookie(request, 'session');
    if (!sessionCookie) return false;
    
    try {
      // In a real implementation, you'd verify the session token
      // For now, just check if it exists and matches expected format
      return sessionCookie.length > 10;
    } catch {
      return false;
    }
  }

  getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      const [key, value] = cookie.split('=');
      if (key === name) return value;
    }
    return null;
  }

  async handleLogin(request) {
    try {
      const { password } = await request.json();
      const adminPassword = this.config.adminPassword;
      //暂时去掉登录
      return new Response(JSON.stringify({ success: true });
      // if (password === adminPassword) {
      //   const sessionToken = crypto.randomUUID();
        
      //   return new Response(JSON.stringify({ success: true }), {
      //     headers: {
      //       'Content-Type': 'application/json',
      //       'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
      //     }
      //   });
      // } else {
      //   return new Response(JSON.stringify({ error: 'Invalid password' }), {
      //     status: 401,
      //     headers: { 'Content-Type': 'application/json' }
      //   });
      // }
    } catch (error) {
      this.logger.error('Login error:', error);
      return new Response(JSON.stringify({ error: 'Login failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async getTokens() {
    try {
      const pools = await this.tokenManager.getTokenPools();
      const status = await this.tokenManager.getTokenStatus();
      
      return new Response(JSON.stringify({
        pools,
        status
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.logger.error('Get tokens error:', error);
      return new Response(JSON.stringify({ error: 'Failed to get tokens' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async addToken(request) {
    try {
      const tokenData = await request.json();
      const success = await this.tokenManager.addToken(tokenData);
      
      if (success) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to add token' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      this.logger.error('Add token error:', error);
      return new Response(JSON.stringify({ error: 'Failed to add token' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async deleteToken(request) {
    try {
      const { token } = await request.json();
      const success = await this.tokenManager.deleteToken(token);
      
      if (success) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to delete token' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      this.logger.error('Delete token error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete token' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async getKeyMode() {
    try {
      const config = await this.tokenManager.getConfig();
      return new Response(JSON.stringify(config), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.logger.error('Get key mode error:', error);
      return new Response(JSON.stringify({ error: 'Failed to get key mode' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async setKeyMode(request) {
    try {
      const config = await request.json();
      const success = await this.tokenManager.setConfig(config);
      
      if (success) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to set key mode' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      this.logger.error('Set key mode error:', error);
      return new Response(JSON.stringify({ error: 'Failed to set key mode' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async getStatus() {
    try {
      const pools = await this.tokenManager.getTokenPools();
      const status = await this.tokenManager.getTokenStatus();
      const config = await this.tokenManager.getConfig();
      
      // Calculate statistics
      const stats = {
        totalTokens: 0,
        validTokens: 0,
        totalRequests: 0,
        modelStats: {}
      };
      
      for (const [model, tokens] of Object.entries(pools)) {
        stats.modelStats[model] = {
          tokenCount: tokens.length,
          totalRequests: tokens.reduce((sum, token) => sum + token.RequestCount, 0)
        };
        stats.totalTokens += tokens.length;
      }
      
      for (const ssoStatus of Object.values(status)) {
        for (const modelStatus of Object.values(ssoStatus)) {
          if (modelStatus.isValid) stats.validTokens++;
          stats.totalRequests += modelStatus.totalRequestCount;
        }
      }
      
      return new Response(JSON.stringify({
        stats,
        config,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.logger.error('Get status error:', error);
      return new Response(JSON.stringify({ error: 'Failed to get status' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async serveLoginPage() {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员登录</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 50px; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; color: #555; }
        input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #005a87; }
        .error { color: red; margin-top: 10px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>管理员登录</h1>
        <form id="loginForm">
            <div class="form-group">
                <label for="password">管理员密码:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">登录</button>
            <div id="error" class="error"></div>
        </form>
    </div>
    
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            
            try {
                const response = await fetch('/manager/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    window.location.href = '/manager';
                } else {
                    errorDiv.textContent = result.error || '登录失败';
                }
            } catch (error) {
                errorDiv.textContent = '网络错误，请重试';
            }
        });
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  async serveManagerPage(request) {
    // Check if authenticated
    const sessionCookie = this.getCookie(request, 'session');
    if (!sessionCookie) {
      return Response.redirect(new URL('/manager/login', request.url).toString(), 302);
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grok API 管理面板</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1, h2 { color: #333; margin-top: 0; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #555; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; }
        button:hover { background: #005a87; }
        button.danger { background: #dc3545; }
        button.danger:hover { background: #c82333; }
        .token-list { margin-top: 20px; }
        .token-item { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 10px; border-left: 4px solid #007cba; }
        .token-item.invalid { border-left-color: #dc3545; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 4px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #007cba; }
        .switch { position: relative; display: inline-block; width: 60px; height: 34px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #007cba; }
        input:checked + .slider:before { transform: translateX(26px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Grok API 管理面板</h1>
            <p>管理 SSO Token 和系统配置</p>
        </div>
        
        <div class="section">
            <h2>系统状态</h2>
            <div class="stats" id="stats">
                <!-- Stats will be loaded here -->
            </div>
        </div>
        
        <div class="section">
            <h2>Key 调用模式</h2>
            <div class="form-group">
                <label>
                    <span>调用模式:</span>
                    <label class="switch">
                        <input type="checkbox" id="keyModeSwitch">
                        <span class="slider"></span>
                    </label>
                    <span id="keyModeLabel">轮询模式</span>
                </label>
            </div>
            <div class="form-group" id="usageLimitGroup" style="display: none;">
                <label for="usageLimit">使用次数限制 (1-100):</label>
                <input type="number" id="usageLimit" min="1" max="100" value="20">
            </div>
            <button onclick="updateKeyMode()">保存配置</button>
        </div>
        
        <div class="section">
            <h2>添加 Token</h2>
            <div class="form-group">
                <label for="tokenType">Token 类型:</label>
                <select id="tokenType">
                    <option value="normal">普通</option>
                    <option value="super">超级</option>
                </select>
            </div>
            <div class="form-group">
                <label for="tokenValue">SSO Token:</label>
                <textarea id="tokenValue" rows="3" placeholder="请输入完整的 Cookie 字符串，包含 sso= 部分"></textarea>
            </div>
            <button onclick="addToken()">添加 Token</button>
        </div>
        
        <div class="section">
            <h2>Token 列表</h2>
            <div id="tokenList" class="token-list">
                <!-- Tokens will be loaded here -->
            </div>
        </div>
    </div>
    
    <script>
        let keyMode = 'polling';
        let usageLimit = 20;
        
        // Load initial data
        loadStatus();
        loadKeyMode();
        loadTokens();
        
        // Auto refresh every 30 seconds
        setInterval(() => {
            loadStatus();
            loadTokens();
        }, 30000);
        
        async function loadStatus() {
            try {
                const response = await fetch('/manager/api/status');
                const data = await response.json();
                
                const statsHtml = \`
                    <div class="stat-card">
                        <div class="stat-number">\${data.stats.totalTokens}</div>
                        <div>总 Token 数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.stats.validTokens}</div>
                        <div>有效 Token</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.stats.totalRequests}</div>
                        <div>总请求数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.config.keyMode}</div>
                        <div>当前模式</div>
                    </div>
                \`;
                
                document.getElementById('stats').innerHTML = statsHtml;
            } catch (error) {
                console.error('Failed to load status:', error);
            }
        }
        
        async function loadKeyMode() {
            try {
                const response = await fetch('/manager/api/key_mode');
                const config = await response.json();
                
                keyMode = config.keyMode;
                usageLimit = config.usageLimit;
                
                updateKeyModeUI();
            } catch (error) {
                console.error('Failed to load key mode:', error);
            }
        }
        
        function updateKeyModeUI() {
            const switchElement = document.getElementById('keyModeSwitch');
            const labelElement = document.getElementById('keyModeLabel');
            const usageLimitGroup = document.getElementById('usageLimitGroup');
            const usageLimitInput = document.getElementById('usageLimit');
            
            switchElement.checked = keyMode === 'single';
            labelElement.textContent = keyMode === 'single' ? '单Key循环模式' : '轮询模式';
            usageLimitGroup.style.display = keyMode === 'single' ? 'block' : 'none';
            usageLimitInput.value = usageLimit;
        }
        
        document.getElementById('keyModeSwitch').addEventListener('change', function() {
            keyMode = this.checked ? 'single' : 'polling';
            updateKeyModeUI();
        });
        
        async function updateKeyMode() {
            try {
                const config = {
                    keyMode,
                    usageLimit: parseInt(document.getElementById('usageLimit').value)
                };
                
                const response = await fetch('/manager/api/key_mode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('配置已保存');
                    loadStatus();
                } else {
                    alert('保存失败: ' + result.error);
                }
            } catch (error) {
                alert('保存失败: ' + error.message);
            }
        }
        
        async function addToken() {
            const type = document.getElementById('tokenType').value;
            const token = document.getElementById('tokenValue').value.trim();
            
            if (!token) {
                alert('请输入 Token');
                return;
            }
            
            try {
                const response = await fetch('/manager/api/tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, token })
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('Token 添加成功');
                    document.getElementById('tokenValue').value = '';
                    loadTokens();
                    loadStatus();
                } else {
                    alert('添加失败: ' + result.error);
                }
            } catch (error) {
                alert('添加失败: ' + error.message);
            }
        }
        
        async function deleteToken(token) {
            if (!confirm('确定要删除这个 Token 吗？')) return;
            
            try {
                const response = await fetch('/manager/api/tokens', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('Token 删除成功');
                    loadTokens();
                    loadStatus();
                } else {
                    alert('删除失败: ' + result.error);
                }
            } catch (error) {
                alert('删除失败: ' + error.message);
            }
        }
        
        async function loadTokens() {
            try {
                const response = await fetch('/manager/api/tokens');
                const data = await response.json();
                
                let html = '';
                const allTokens = new Set();
                
                // Collect all unique tokens
                for (const tokens of Object.values(data.pools)) {
                    for (const tokenEntry of tokens) {
                        allTokens.add(tokenEntry.token);
                    }
                }
                
                for (const token of allTokens) {
                    const sso = token.split('sso=')[1]?.split(';')[0] || 'unknown';
                    const isValid = Object.values(data.status[sso] || {}).some(s => s.isValid);
                    const totalRequests = Object.values(data.status[sso] || {}).reduce((sum, s) => sum + s.totalRequestCount, 0);
                    
                    html += \`
                        <div class="token-item \${isValid ? '' : 'invalid'}">
                            <strong>SSO: \${sso}</strong>
                            <br>状态: \${isValid ? '有效' : '无效'}
                            <br>总请求数: \${totalRequests}
                            <br><button class="danger" onclick="deleteToken('\${token}')">删除</button>
                        </div>
                    \`;
                }
                
                document.getElementById('tokenList').innerHTML = html || '<p>暂无 Token</p>';
            } catch (error) {
                console.error('Failed to load tokens:', error);
                document.getElementById('tokenList').innerHTML = '<p>加载失败</p>';
            }
        }
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}
