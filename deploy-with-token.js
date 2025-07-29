/**
 * 使用 API Token 部署脚本
 * 如果 OAuth 登录有问题，可以使用此脚本通过 API Token 部署
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始部署 Grok API Workers...\n');

// 检查配置
function checkConfig() {
  console.log('📋 检查配置...');
  
  // 检查 wrangler.toml
  const wranglerPath = path.join(__dirname, 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    console.error('❌ wrangler.toml 文件不存在');
    return false;
  }
  
  const content = fs.readFileSync(wranglerPath, 'utf8');
  
  // 检查 KV namespace ID
  if (content.includes('your-kv-namespace-id')) {
    console.error('❌ KV namespace ID 未配置');
    return false;
  }
  
  console.log('✅ 配置检查通过');
  return true;
}

// 部署函数
function deploy() {
  return new Promise((resolve, reject) => {
    console.log('📦 开始部署...');
    
    const deployProcess = spawn('npx', ['wrangler', 'deploy'], {
      stdio: 'inherit',
      shell: true
    });
    
    deployProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ 部署成功！');
        resolve();
      } else {
        console.error('\n❌ 部署失败，退出码:', code);
        reject(new Error(`Deploy failed with code ${code}`));
      }
    });
    
    deployProcess.on('error', (error) => {
      console.error('❌ 部署过程中发生错误:', error);
      reject(error);
    });
  });
}

// 主函数
async function main() {
  try {
    // 检查配置
    if (!checkConfig()) {
      process.exit(1);
    }
    
    // 检查是否已登录
    console.log('\n🔐 检查登录状态...');
    
    const whoamiProcess = spawn('npx', ['wrangler', 'whoami'], {
      stdio: 'pipe',
      shell: true
    });
    
    let output = '';
    whoamiProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    whoamiProcess.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    whoamiProcess.on('close', async (code) => {
      if (output.includes('You are not authenticated')) {
        console.log('⚠️  未登录到 Cloudflare');
        console.log('\n请选择以下方式之一：');
        console.log('1. 运行 "npx wrangler login" 进行 OAuth 登录');
        console.log('2. 设置 CLOUDFLARE_API_TOKEN 环境变量');
        console.log('3. 在 Cloudflare Dashboard 创建 API Token');
        console.log('\nAPI Token 创建步骤：');
        console.log('- 访问 https://dash.cloudflare.com/profile/api-tokens');
        console.log('- 点击 "Create Token"');
        console.log('- 选择 "Edit Cloudflare Workers" 模板');
        console.log('- 复制生成的 token');
        console.log('- 设置环境变量: set CLOUDFLARE_API_TOKEN=your_token');
        
        process.exit(1);
      } else {
        console.log('✅ 已登录到 Cloudflare');
        
        try {
          await deploy();
          
          console.log('\n🎉 部署完成！');
          console.log('\n📍 访问您的应用：');
          console.log('- 管理界面: https://grok-api-workers.18571569668.workers.dev/manager');
          console.log('- 登录页面: https://grok-api-workers.18571569668.workers.dev/manager/login');
          console.log('- 默认密码: ts-123456');
          
          console.log('\n🔧 如果登录仍有问题，请：');
          console.log('1. 检查浏览器开发者工具的控制台');
          console.log('2. 查看网络请求是否正常');
          console.log('3. 运行 "npx wrangler tail" 查看实时日志');
          
        } catch (error) {
          console.error('部署失败:', error.message);
          process.exit(1);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    process.exit(1);
  }
}

// 运行脚本
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
