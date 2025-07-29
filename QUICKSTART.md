# 🚀 快速开始指南

这是一个 5 分钟快速部署 Grok API Workers 的指南。

## 📋 前置要求

- Node.js 18+
- npm 或 yarn
- Cloudflare 账户

## 🎯 快速部署 (5 步骤)

### 1️⃣ 克隆并安装

```bash
git clone https://github.com/your-username/grok-api-workers.git
cd grok-api-workers
npm install
```

### 2️⃣ 登录 Cloudflare

```bash
npx wrangler login
```

### 3️⃣ 创建 KV 存储

```bash
# 创建生产环境 KV
npx wrangler kv:namespace create KV_STORE

# 创建预览环境 KV  
npx wrangler kv:namespace create KV_STORE --preview
```

**重要**: 复制输出的 namespace ID 到 `wrangler.toml` 文件中：

```toml
[[kv_namespaces]]
binding = "KV_STORE"
id = "你的生产环境ID"
preview_id = "你的预览环境ID"
```

### 4️⃣ 配置环境变量

编辑 `wrangler.toml` 文件，修改管理员密码：

```toml
[vars]
ADMINPASSWORD = "你的安全密码"  # 请修改这个密码！
API_KEY = "你的API密钥"
```

### 5️⃣ 部署

```bash
# 运行部署前检查
npm run check

# 部署到 Cloudflare Workers
npm run deploy
```

## 🎉 完成！

部署成功后，你将获得一个 Workers URL，例如：
`https://grok-api-workers.your-subdomain.workers.dev`

### 访问管理界面

1. 打开 `https://your-worker-url/manager`
2. 使用你设置的管理员密码登录
3. 添加你的 Grok SSO Token

### 测试 API

```bash
curl -X POST https://your-worker-url/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-3",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

## 🔧 常见问题

### Q: KV 存储创建失败？
A: 确保你已经登录 Cloudflare 并且有足够的权限。

### Q: 部署时提示配置错误？
A: 运行 `npm run check` 检查配置问题。

### Q: 如何获取 Grok SSO Token？
A: 
1. 登录 grok.com
2. 打开浏览器开发者工具
3. 在 Network 标签页找到请求
4. 复制 Cookie 中的完整字符串

### Q: Token 添加后显示无效？
A: 检查 Token 格式是否正确，确保包含完整的 `sso=` 部分。

## 📚 更多信息

- 详细部署指南: [DEPLOYMENT.md](./DEPLOYMENT.md)
- 完整文档: [README.md](./README.md)
- 问题反馈: [GitHub Issues](https://github.com/your-username/grok-api-workers/issues)

## 🛠️ 开发模式

如果你想在本地开发：

```bash
# 启动开发服务器
npm run dev

# 在另一个终端查看日志
npm run tail
```

## 🔒 安全提醒

1. **修改默认密码**: 务必修改 `ADMINPASSWORD`
2. **保护 Token**: 不要在公共场所暴露你的 SSO Token
3. **定期更新**: 定期更新和轮换你的 Token

---

🎉 **恭喜！你的 Grok API Workers 已经成功部署！**
