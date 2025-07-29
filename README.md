# 🤖 Grok API Workers

基于 Cloudflare Workers 的高性能 Grok API 代理服务，提供 OpenAI 兼容的 API 接口。

## ✨ 特性

- 🚀 **高性能**: 基于 Cloudflare Workers 全球边缘网络
- 🔄 **智能轮询**: 支持多 Token 智能轮询和单 Key 循环模式
- 🛡️ **安全可靠**: 完善的错误处理和重试机制
- 📊 **实时监控**: 详细的使用统计和 Token 状态监控
- 🎯 **OpenAI 兼容**: 完全兼容 OpenAI API 格式
- 🌐 **全球部署**: 利用 Cloudflare 全球 CDN 网络

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/grok-api-workers.git
cd grok-api-workers
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 KV 存储
npx wrangler kv:namespace create KV_STORE
npx wrangler kv:namespace create KV_STORE --preview
```

### 4. 更新配置

编辑 `wrangler.toml` 文件，填入 KV namespace ID 和其他配置。

### 5. 部署

```bash
npm run deploy
```

详细部署说明请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📖 API 使用

### 聊天完成

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-3",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "stream": false
  }'
```

### 流式响应

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "grok-3",
    "messages": [
      {"role": "user", "content": "Tell me a story"}
    ],
    "stream": true
  }'
```

### 支持的模型

- `grok-3` - 基础模型
- `grok-3-search` - 带搜索功能
- `grok-3-imageGen` - 图像生成
- `grok-3-deepsearch` - 深度搜索
- `grok-3-deepersearch` - 更深度搜索
- `grok-3-reasoning` - 推理模型
- `grok-4` - 新一代模型
- `grok-4-reasoning` - 新一代推理模型
- `grok-4-imageGen` - 新一代图像生成
- `grok-4-deepsearch` - 新一代深度搜索

## 🛠️ 管理界面

访问 `https://your-worker.your-subdomain.workers.dev/manager` 进入管理界面。

### 功能包括：

- 📊 **系统状态监控**: 实时查看 Token 状态和使用统计
- ➕ **Token 管理**: 添加、删除和管理 SSO Token
- ⚙️ **模式配置**: 切换轮询模式和单 Key 循环模式
- 📈 **使用统计**: 详细的请求统计和模型使用情况
- 📤 **数据导出**: 支持配置导出和导入

## 🔧 配置说明

### Token 调用模式

#### 轮询模式 (默认)
- 每个 Token 使用一次后立即切换到下一个
- 适合需要快速轮换的场景
- 最大化 Token 利用率

#### 单 Key 循环模式
- 单个 Token 使用指定次数后切换
- 可配置使用次数限制 (1-100)
- 适合需要保持会话连续性的场景

### Token 类型

- **普通 Token**: 标准请求频率限制
- **超级 Token**: 更高的请求频率限制

## 📁 项目结构

```
grok-api-workers/
├── src/
│   ├── index.js              # 主入口文件
│   ├── handlers/
│   │   ├── grok-api.js       # Grok API 处理器
│   │   └── manager.js        # 管理界面处理器
│   └── utils/
│       ├── config.js         # 配置管理
│       ├── http-client.js    # HTTP 客户端
│       ├── logger.js         # 日志工具
│       └── token-manager.js  # Token 管理器
├── public/                   # 静态文件
│   ├── index.html           # 首页
│   ├── manager.html         # 管理页面
│   ├── login.html           # 登录页面
│   └── static/              # CSS/JS 资源
├── wrangler.toml            # Cloudflare Workers 配置
├── package.json             # 项目配置
├── DEPLOYMENT.md            # 部署指南
└── README.md               # 项目说明
```

## 🔒 安全特性

- 🔐 **管理员认证**: 基于密码的管理界面访问控制
- 🛡️ **Token 验证**: 完整的 SSO Token 格式验证
- 🔄 **自动重试**: 智能的请求重试机制
- 📝 **详细日志**: 完整的操作日志记录
- ⚡ **错误处理**: 优雅的错误处理和用户反馈

## 🌟 高级功能

### 图像生成支持
- 支持 Grok 图像生成模型
- 可配置外部图床 (PicGo, Tumy)
- 自动 Base64 编码回退

### 搜索功能
- 集成 Web 搜索结果
- 可配置搜索结果显示
- 支持深度搜索模式

### 推理模式
- 支持思考过程显示
- 可配置思考内容可见性
- 优化的推理响应处理

## 📊 监控和统计

- 实时 Token 状态监控
- 详细的请求统计
- 模型使用情况分析
- 错误率和性能指标
- 自动数据持久化

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 基于原始 Python Flask 项目改造
- 感谢 Cloudflare Workers 平台
- 感谢开源社区的贡献

## 📞 支持

如果您觉得这个项目有用，请给它一个 ⭐️！

如有问题或建议，请提交 [Issue](https://github.com/your-username/grok-api-workers/issues)。
