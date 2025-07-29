/**
 * 本地测试服务器 - 用于测试登录功能
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 模拟环境变量
const mockEnv = {
  ADMINPASSWORD: 'ts-123456',
  API_KEY: '123456',
  IS_TEMP_CONVERSATION: 'true',
  IS_CUSTOM_SSO: 'false',
  SHOW_THINKING: 'false',
  ISSHOW_SEARCH_RESULTS: 'true',
  IS_SUPER_GROK: 'false',
  MANAGER_SWITCH: 'true'
};

// 模拟 Config 类
class TestConfig {
  constructor(env) {
    this.env = env;
  }

  get(key, defaultValue = null) {
    return this.env[key] || defaultValue;
  }

  get adminPassword() {
    return this.get('ADMINPASSWORD', 'ts-123456');
  }
}

// 模拟 Logger 类
class TestLogger {
  info(...args) {
    console.log('[INFO]', ...args);
  }
  
  error(...args) {
    console.error('[ERROR]', ...args);
  }
}

// 简化的登录处理器
class TestLoginHandler {
  constructor() {
    this.config = new TestConfig(mockEnv);
    this.logger = new TestLogger();
  }

  async handleLogin(body) {
    try {
      this.logger.info('Login attempt started');
      
      const { password } = JSON.parse(body);
      const adminPassword = this.config.adminPassword;
      
      this.logger.info('Password received length:', password ? password.length : 0);
      this.logger.info('Admin password configured length:', adminPassword ? adminPassword.length : 0);
      this.logger.info('Password match:', password === adminPassword);
      
      if (password === adminPassword) {
        const sessionToken = 'test-session-' + Date.now();
        this.logger.info('Login successful, session token generated');
        
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `session=${sessionToken}; HttpOnly; Max-Age=86400`
          },
          body: JSON.stringify({ success: true })
        };
      } else {
        this.logger.info('Login failed: password mismatch');
        return {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid password' })
        };
      }
    } catch (error) {
      this.logger.error('Login error:', error);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Login failed' })
      };
    }
  }

  getLoginPage() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员登录 - 测试</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 50px; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; color: #555; }
        input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #005a87; }
        .error { color: #d32f2f; margin-top: 10px; padding: 10px; background: #ffebee; border-radius: 4px; display: none; }
        .info { background: #e3f2fd; color: #1976d2; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 管理员登录 (测试)</h1>
        
        <div class="info">
            <strong>测试信息:</strong><br>
            默认密码: ts-123456<br>
            这是本地测试服务器
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="password">管理员密码:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">🚀 登录</button>
        </form>
        
        <div id="error" class="error"></div>
    </div>
    
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            
            console.log('Login form submitted');
            console.log('Password length:', password ? password.length : 0);
            
            try {
                console.log('Sending login request to /api/login');
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                
                console.log('Response status:', response.status);
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (result.success) {
                    console.log('Login successful!');
                    errorDiv.style.display = 'none';
                    alert('登录成功！在实际应用中会跳转到管理页面。');
                } else {
                    console.log('Login failed:', result.error);
                    errorDiv.textContent = result.error || '登录失败';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Login request failed:', error);
                errorDiv.textContent = '网络错误，请重试';
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>`;
  }
}

// 创建 HTTP 服务器
const loginHandler = new TestLoginHandler();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (path === '/' || path === '/login') {
    // 返回登录页面
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(loginHandler.getLoginPage());
  } else if (path === '/api/login' && method === 'POST') {
    // 处理登录请求
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      const result = await loginHandler.handleLogin(body);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    });
  } else {
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 本地测试服务器启动成功！`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`🔐 测试密码: ts-123456`);
  console.log(`\n请在浏览器中打开上述地址进行登录测试`);
});
