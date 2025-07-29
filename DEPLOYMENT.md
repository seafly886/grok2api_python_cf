# Grok API Workers 部署指南

本项目是基于 Cloudflare Workers 的 Grok API 代理服务，支持 OpenAI API 格式的请求。

## 🚀 快速部署

### 1. 环境准备

确保您已安装：
- Node.js 18+ 
- npm 或 yarn
- Cloudflare 账户

### 2. 安装依赖

```bash
npm install
# 或
yarn install
```

### 3. 登录 Cloudflare

```bash
npx wrangler login
```

### 4. 创建 KV 存储

```bash
# 创建生产环境 KV 存储
npx wrangler kv:namespace create KV_STORE

# 创建预览环境 KV 存储
npx wrangler kv:namespace create KV_STORE --preview
```

命令执行后会返回 namespace ID，请将其复制到 `wrangler.toml` 文件中：

```toml
[[kv_namespaces]]
binding = "KV_STORE"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

### 5. 配置环境变量

编辑 `wrangler.toml` 文件，设置必要的环境变量：

```toml
[vars]
# 管理员密码 (建议修改)
ADMINPASSWORD = "your-secure-password"

# API 密钥 (可选，用于 API 认证)
API_KEY = "your-api-key"

# 其他配置...
```

### 6. 部署到 Cloudflare Workers

```bash
# 部署到生产环境
npm run deploy

# 或部署到预览环境
npm run dev
```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `ADMINPASSWORD` | 管理员密码 | `ts-123456` | 是 |
| `API_KEY` | API 认证密钥 | `123456` | 否 |
| `IS_TEMP_CONVERSATION` | 是否使用临时对话 | `true` | 否 |
| `SHOW_THINKING` | 是否显示思考过程 | `false` | 否 |
| `ISSHOW_SEARCH_RESULTS` | 是否显示搜索结果 | `true` | 否 |
| `PICGO_KEY` | PicGo 图床密钥 | - | 否 |
| `TUMY_KEY` | Tumy 图床密钥 | - | 否 |
| `CF_CLEARANCE` | Cloudflare clearance | - | 否 |
| `PROXY` | 代理设置 | - | 否 |

### KV 存储结构

系统使用 Cloudflare KV 存储以下数据：

- `config`: 系统配置 (key模式、使用限制等)
- `token_pools`: Token 池数据
- `token_status`: Token 状态信息
- `single_mode_usage_*`: 单Key模式使用计数

## 📝 使用说明

### 1. 访问管理界面

部署完成后，访问 `https://your-worker.your-subdomain.workers.dev/manager` 进入管理界面。

使用配置的管理员密码登录。

### 2. 添加 SSO Token

在管理界面中：
1. 选择 Token 类型（普通/超级）
2. 输入完整的 Cookie 字符串（包含 `sso=` 部分）
3. 点击添加

### 3. 配置调用模式

支持两种模式：
- **轮询模式**: 每个token使用一次后立即切换
- **单Key循环模式**: 单个token使用指定次数后切换

### 4. API 调用

使用 OpenAI 兼容的 API 格式：

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-3",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

### 支持的模型

- `grok-3`, `grok-3-search`, `grok-3-imageGen`
- `grok-3-deepsearch`, `grok-3-deepersearch`, `grok-3-reasoning`
- `grok-4`, `grok-4-reasoning`, `grok-4-imageGen`, `grok-4-deepsearch`

## 🛠️ 开发

### 本地开发

```bash
# 启动开发服务器
npm run dev
```

### 查看日志

```bash
# 实时查看 Worker 日志
npm run tail
```

### KV 操作

```bash
# 列出所有 keys
npm run kv:list

# 获取值
npx wrangler kv:key get "config" --binding KV_STORE

# 设置值
npx wrangler kv:key put "config" '{"keyMode":"polling"}' --binding KV_STORE

# 删除值
npx wrangler kv:key delete "config" --binding KV_STORE
```

## 🔒 安全建议

1. **修改默认密码**: 部署前请修改 `ADMINPASSWORD`
2. **使用强密码**: 建议使用复杂的管理员密码
3. **定期更新**: 定期更新 SSO Token
4. **监控使用**: 定期检查使用统计和异常情况
5. **访问控制**: 考虑添加 IP 白名单等访问控制

## 🐛 故障排除

### 常见问题

1. **KV 存储错误**
   - 确保 KV namespace ID 配置正确
   - 检查 KV 绑定名称是否为 `KV_STORE`

2. **Token 无效**
   - 检查 SSO Token 格式是否正确
   - 确认 Token 未过期
   - 验证 CF_CLEARANCE 设置

3. **部署失败**
   - 检查 wrangler.toml 配置
   - 确认 Cloudflare 账户权限
   - 查看部署日志

### 日志查看

```bash
# 查看实时日志
npx wrangler tail

# 查看特定时间段的日志
npx wrangler tail --since 1h
```

## 📊 监控

### 性能监控

- 访问 Cloudflare Dashboard 查看 Worker 性能指标
- 监控请求量、错误率、响应时间
- 设置告警规则

### 使用统计

- 管理界面提供详细的使用统计
- 包括 Token 状态、请求计数、模型使用情况
- 支持数据导出功能

## 🔄 更新

### 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新部署
npm run deploy
```

### 数据迁移

如需迁移数据，可以：
1. 导出现有配置
2. 部署新版本
3. 导入配置数据

## 📞 支持

如遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查 GitHub Issues
3. 提交新的 Issue 描述问题

## 📄 许可证

本项目基于 MIT 许可证开源。
