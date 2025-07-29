#!/usr/bin/env node

/**
 * 部署前检查脚本
 * 验证配置文件和必要的设置
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(projectRoot, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    log(`✅ ${description}: ${filePath}`, 'green');
    return true;
  } else {
    log(`❌ ${description}: ${filePath} (文件不存在)`, 'red');
    return false;
  }
}

function checkWranglerConfig() {
  log('\n📋 检查 Wrangler 配置...', 'blue');
  
  const wranglerPath = path.join(projectRoot, 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    log('❌ wrangler.toml 文件不存在', 'red');
    return false;
  }
  
  const content = fs.readFileSync(wranglerPath, 'utf8');
  const checks = [
    { pattern: /name\s*=\s*"[^"]+"/g, description: 'Worker 名称' },
    { pattern: /main\s*=\s*"src\/index\.js"/g, description: '入口文件' },
    { pattern: /compatibility_date\s*=\s*"[\d-]+"/g, description: '兼容性日期' },
    { pattern: /\[\[kv_namespaces\]\]/g, description: 'KV 命名空间配置' },
    { pattern: /binding\s*=\s*"KV_STORE"/g, description: 'KV 绑定名称' }
  ];
  
  let allPassed = true;
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      log(`✅ ${check.description}`, 'green');
    } else {
      log(`❌ ${check.description} (未配置或格式错误)`, 'red');
      allPassed = false;
    }
  });
  
  // 检查 KV namespace ID
  if (content.includes('your-kv-namespace-id')) {
    log('⚠️  请更新 KV namespace ID (当前为占位符)', 'yellow');
    log('   运行: npm run kv:create', 'cyan');
    allPassed = false;
  }
  
  return allPassed;
}

function checkPackageJson() {
  log('\n📦 检查 package.json...', 'blue');
  
  const packagePath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    log('❌ package.json 文件不存在', 'red');
    return false;
  }
  
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredScripts = ['dev', 'deploy', 'kv:create'];
    const requiredDevDeps = ['wrangler', '@cloudflare/workers-types'];
    
    let allPassed = true;
    
    // 检查脚本
    requiredScripts.forEach(script => {
      if (pkg.scripts && pkg.scripts[script]) {
        log(`✅ 脚本: ${script}`, 'green');
      } else {
        log(`❌ 缺少脚本: ${script}`, 'red');
        allPassed = false;
      }
    });
    
    // 检查依赖
    requiredDevDeps.forEach(dep => {
      if (pkg.devDependencies && pkg.devDependencies[dep]) {
        log(`✅ 依赖: ${dep}`, 'green');
      } else {
        log(`❌ 缺少依赖: ${dep}`, 'red');
        allPassed = false;
      }
    });
    
    return allPassed;
  } catch (error) {
    log(`❌ package.json 格式错误: ${error.message}`, 'red');
    return false;
  }
}

function checkSourceFiles() {
  log('\n📁 检查源文件...', 'blue');
  
  const requiredFiles = [
    { path: 'src/index.js', desc: '主入口文件' },
    { path: 'src/handlers/grok-api.js', desc: 'Grok API 处理器' },
    { path: 'src/handlers/manager.js', desc: '管理界面处理器' },
    { path: 'src/utils/config.js', desc: '配置工具' },
    { path: 'src/utils/logger.js', desc: '日志工具' },
    { path: 'src/utils/token-manager.js', desc: 'Token 管理器' },
    { path: 'src/utils/http-client.js', desc: 'HTTP 客户端' }
  ];
  
  let allPassed = true;
  requiredFiles.forEach(file => {
    if (!checkFileExists(file.path, file.desc)) {
      allPassed = false;
    }
  });
  
  return allPassed;
}

function checkPublicFiles() {
  log('\n🌐 检查公共文件...', 'blue');
  
  const publicFiles = [
    { path: 'public/index.html', desc: '首页' },
    { path: 'public/manager.html', desc: '管理页面' },
    { path: 'public/login.html', desc: '登录页面' },
    { path: 'public/static/manager.css', desc: '管理页面样式' },
    { path: 'public/static/manager.js', desc: '管理页面脚本' }
  ];
  
  let allPassed = true;
  publicFiles.forEach(file => {
    if (!checkFileExists(file.path, file.desc)) {
      allPassed = false;
    }
  });
  
  return allPassed;
}

function checkEnvironmentVariables() {
  log('\n🔧 检查环境变量配置...', 'blue');
  
  const wranglerPath = path.join(projectRoot, 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    log('❌ 无法检查环境变量 (wrangler.toml 不存在)', 'red');
    return false;
  }
  
  const content = fs.readFileSync(wranglerPath, 'utf8');
  
  const recommendedVars = [
    'ADMINPASSWORD',
    'API_KEY',
    'IS_TEMP_CONVERSATION',
    'SHOW_THINKING',
    'ISSHOW_SEARCH_RESULTS'
  ];
  
  let foundVars = 0;
  recommendedVars.forEach(varName => {
    if (content.includes(varName)) {
      log(`✅ 环境变量: ${varName}`, 'green');
      foundVars++;
    } else {
      log(`⚠️  建议配置环境变量: ${varName}`, 'yellow');
    }
  });
  
  if (foundVars >= 3) {
    log('✅ 基本环境变量配置充足', 'green');
    return true;
  } else {
    log('❌ 环境变量配置不足', 'red');
    return false;
  }
}

function generateDeploymentSummary(checks) {
  log('\n📊 部署检查总结', 'magenta');
  log('=' * 40, 'cyan');
  
  const passed = checks.filter(check => check.passed).length;
  const total = checks.length;
  
  checks.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    const color = check.passed ? 'green' : 'red';
    log(`${status} ${check.name}`, color);
  });
  
  log(`\n总计: ${passed}/${total} 项检查通过`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 所有检查通过！可以开始部署。', 'green');
    log('\n下一步:', 'blue');
    log('1. 运行 npm run kv:create 创建 KV 存储', 'cyan');
    log('2. 更新 wrangler.toml 中的 KV namespace ID', 'cyan');
    log('3. 运行 npm run deploy 部署到 Cloudflare', 'cyan');
  } else {
    log('\n⚠️  请修复上述问题后再进行部署。', 'yellow');
  }
  
  return passed === total;
}

async function main() {
  log('🚀 Grok API Workers 部署前检查', 'magenta');
  log('=' * 50, 'cyan');
  
  const checks = [
    { name: 'Wrangler 配置', passed: checkWranglerConfig() },
    { name: 'Package.json', passed: checkPackageJson() },
    { name: '源文件', passed: checkSourceFiles() },
    { name: '公共文件', passed: checkPublicFiles() },
    { name: '环境变量', passed: checkEnvironmentVariables() }
  ];
  
  const allPassed = generateDeploymentSummary(checks);
  
  process.exit(allPassed ? 0 : 1);
}

// 运行检查
main().catch(error => {
  log(`\n❌ 检查过程中发生错误: ${error.message}`, 'red');
  process.exit(1);
});
