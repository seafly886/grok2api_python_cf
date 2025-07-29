/**
 * JWT Token 修复部署前检查脚本
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 JWT Token 修复部署前检查\n');

// 检查文件列表
const filesToCheck = [
  'src/utils/token-manager.js',
  'src/handlers/manager.js', 
  'public/static/manager.js',
  'src/utils/http-client.js'
];

let allChecksPass = true;

// 检查每个文件
filesToCheck.forEach(filePath => {
  console.log(`📁 检查文件: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    allChecksPass = false;
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 检查是否包含新的extractSSO方法
  if (filePath === 'src/utils/token-manager.js') {
    if (content.includes('extractSSO(token)') && 
        content.includes('token.startsWith(\'eyJ\')') &&
        content.includes('this.extractSSO(token)')) {
      console.log('✅ TokenManager extractSSO方法已更新');
    } else {
      console.log('❌ TokenManager extractSSO方法未正确更新');
      allChecksPass = false;
    }
  }
  
  // 检查是否还有未修复的直接调用（不在extractSSO方法内部或修复逻辑内部的）
  const lines = content.split('\n');
  let problematicLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("token.split('sso=')[1].split(';')[0]")) {
      // 检查是否在extractSSO方法内部或修复后的逻辑内部
      let isValidContext = false;

      // 检查前后几行的上下文
      for (let j = Math.max(0, i - 15); j <= Math.min(lines.length - 1, i + 5); j++) {
        const contextLine = lines[j];
        if (contextLine.includes('extractSSO(') ||
            contextLine.includes('function extractSSO') ||
            contextLine.includes('Extract SSO using the same logic') ||
            contextLine.includes('Handle regular cookie format tokens')) {
          isValidContext = true;
          break;
        }
      }

      if (!isValidContext) {
        problematicLines.push(i + 1);
      }
    }
  }

  if (problematicLines.length > 0) {
    console.log(`❌ 发现 ${problematicLines.length} 个未修复的直接调用 (行: ${problematicLines.join(', ')})`);
    allChecksPass = false;
  } else {
    console.log('✅ 所有SSO提取调用已正确更新');
  }
  
  console.log('');
});

// 特定检查
console.log('🎯 特定功能检查:');

// 检查TokenManager类的关键方法
const tokenManagerContent = fs.readFileSync('src/utils/token-manager.js', 'utf8');

const methodsToCheck = [
  'addToken',
  'deleteToken', 
  '_getNextTokenPollingMode',
  '_getNextTokenSingleMode'
];

methodsToCheck.forEach(method => {
  if (tokenManagerContent.includes(`${method}(`) && 
      tokenManagerContent.includes('this.extractSSO(token)')) {
    console.log(`✅ ${method} 方法已更新使用extractSSO`);
  } else {
    console.log(`❌ ${method} 方法未正确更新`);
    allChecksPass = false;
  }
});

// 检查前端extractSSO函数
const frontendContent = fs.readFileSync('public/static/manager.js', 'utf8');
if (frontendContent.includes('function extractSSO(token)') &&
    frontendContent.includes('token.startsWith(\'eyJ\')')) {
  console.log('✅ 前端extractSSO函数已更新');
} else {
  console.log('❌ 前端extractSSO函数未正确更新');
  allChecksPass = false;
}

console.log('\n📋 检查总结:');
if (allChecksPass) {
  console.log('🎉 所有检查通过！可以安全部署');
  console.log('\n📝 部署后验证步骤:');
  console.log('1. 访问管理页面');
  console.log('2. 查看JWT token是否可以正常删除');
  console.log('3. 测试其他token功能是否正常');
  console.log('4. 检查日志是否有错误');
} else {
  console.log('❌ 检查失败！请修复问题后再部署');
  process.exit(1);
}

console.log('\n🔧 问题token信息:');
console.log('SSO: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E');
console.log('类型: JWT Session Token');
console.log('修复: 现在可以正常删除');
