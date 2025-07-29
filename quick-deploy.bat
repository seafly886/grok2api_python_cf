@echo off
echo 🚀 快速部署 Grok API Workers...
echo.

echo 📋 设置环境变量...
set CLOUDFLARE_API_TOKEN=K5M0yn5EU0yaTQ_-uaHCu__WVXxobcckYNecCjQB

echo 📦 开始部署...
npx wrangler deploy

echo.
echo ✅ 部署完成！
echo 📍 访问地址: https://grok-api-workers.18571569668.workers.dev/manager
echo 🔐 现在任何非空密码都可以登录
echo.
pause
