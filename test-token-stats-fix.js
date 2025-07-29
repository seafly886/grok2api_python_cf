/**
 * 测试Token统计修复
 */

// 模拟token状态数据
const mockStatus = {
  "eyJ0eXAiOiJKV1QiLCJh": {  // SSO 1
    "grok-3": { isValid: true, totalRequestCount: 5 },
    "grok-3-deepsearch": { isValid: true, totalRequestCount: 3 },
    "grok-3-deepersearch": { isValid: false, totalRequestCount: 2 },
    "grok-3-reasoning": { isValid: true, totalRequestCount: 1 },
    "grok-4": { isValid: true, totalRequestCount: 4 },
    "grok-4-reasoning": { isValid: false, totalRequestCount: 0 }
  },
  "abc123def456ghi789": {  // SSO 2
    "grok-3": { isValid: true, totalRequestCount: 10 },
    "grok-3-deepsearch": { isValid: false, totalRequestCount: 5 },
    "grok-3-deepersearch": { isValid: false, totalRequestCount: 0 },
    "grok-3-reasoning": { isValid: true, totalRequestCount: 8 },
    "grok-4": { isValid: false, totalRequestCount: 2 },
    "grok-4-reasoning": { isValid: false, totalRequestCount: 0 }
  },
  "xyz789uvw456rst123": {  // SSO 3 - 完全无效
    "grok-3": { isValid: false, totalRequestCount: 0 },
    "grok-3-deepsearch": { isValid: false, totalRequestCount: 0 },
    "grok-3-deepersearch": { isValid: false, totalRequestCount: 0 },
    "grok-3-reasoning": { isValid: false, totalRequestCount: 0 },
    "grok-4": { isValid: false, totalRequestCount: 0 },
    "grok-4-reasoning": { isValid: false, totalRequestCount: 0 }
  }
};

// 旧的统计逻辑（有问题的）
function calculateStatsOld(status) {
  const stats = {
    validTokens: 0,
    totalRequests: 0
  };
  
  for (const ssoStatus of Object.values(status)) {
    for (const modelStatus of Object.values(ssoStatus)) {
      if (modelStatus.isValid) stats.validTokens++;
      stats.totalRequests += modelStatus.totalRequestCount;
    }
  }
  
  return stats;
}

// 新的统计逻辑（修复后的）
function calculateStatsNew(status) {
  const stats = {
    validTokens: 0,
    totalRequests: 0
  };
  
  // Calculate valid tokens and total requests correctly
  for (const ssoStatus of Object.values(status)) {
    // Check if this SSO token has any valid model status
    const hasValidModel = Object.values(ssoStatus).some(modelStatus => modelStatus.isValid);
    if (hasValidModel) {
      stats.validTokens++;
    }
    
    // Sum up total requests for this SSO token (avoid double counting)
    const ssoTotalRequests = Object.values(ssoStatus).reduce((sum, modelStatus) => 
      sum + (modelStatus.totalRequestCount || 0), 0
    );
    stats.totalRequests += ssoTotalRequests;
  }
  
  return stats;
}

// 详细分析函数
function analyzeTokenStatus(status) {
  console.log('📊 详细Token状态分析:\n');
  
  for (const [sso, ssoStatus] of Object.entries(status)) {
    console.log(`🔑 SSO Token: ${sso}`);
    
    const validModels = [];
    const invalidModels = [];
    let totalRequests = 0;
    
    for (const [model, modelStatus] of Object.entries(ssoStatus)) {
      totalRequests += modelStatus.totalRequestCount || 0;
      
      if (modelStatus.isValid) {
        validModels.push(`${model}(${modelStatus.totalRequestCount})`);
      } else {
        invalidModels.push(`${model}(${modelStatus.totalRequestCount})`);
      }
    }
    
    const hasValidModel = validModels.length > 0;
    
    console.log(`   状态: ${hasValidModel ? '✅ 有效' : '❌ 无效'}`);
    console.log(`   总请求数: ${totalRequests}`);
    console.log(`   有效模型 (${validModels.length}): ${validModels.join(', ') || '无'}`);
    console.log(`   无效模型 (${invalidModels.length}): ${invalidModels.join(', ') || '无'}`);
    console.log('');
  }
}

function testTokenStatsfix() {
  console.log('🧪 测试Token统计修复\n');
  
  // 分析当前状态
  analyzeTokenStatus(mockStatus);
  
  // 计算统计数据
  const oldStats = calculateStatsOld(mockStatus);
  const newStats = calculateStatsNew(mockStatus);
  
  console.log('📈 统计结果对比:\n');
  
  console.log('🔴 旧逻辑结果 (有问题):');
  console.log(`   有效Token数: ${oldStats.validTokens}`);
  console.log(`   总请求数: ${oldStats.totalRequests}`);
  console.log('   问题: 每个模型的有效状态都被计算一次，导致重复计数');
  
  console.log('\n🟢 新逻辑结果 (修复后):');
  console.log(`   有效Token数: ${newStats.validTokens}`);
  console.log(`   总请求数: ${newStats.totalRequests}`);
  console.log('   修复: 每个SSO token只计算一次，基于是否有任何有效模型');
  
  console.log('\n🎯 预期结果:');
  console.log('   有效Token数: 2 (SSO1和SSO2有有效模型，SSO3完全无效)');
  console.log('   总请求数: 40 (SSO1: 15, SSO2: 25, SSO3: 0)');
  
  console.log('\n📊 修复验证:');
  const expectedValidTokens = 2;
  const expectedTotalRequests = 40;
  
  if (newStats.validTokens === expectedValidTokens) {
    console.log('✅ 有效Token统计修复成功');
  } else {
    console.log(`❌ 有效Token统计仍有问题: 期望${expectedValidTokens}, 实际${newStats.validTokens}`);
  }
  
  if (newStats.totalRequests === expectedTotalRequests) {
    console.log('✅ 总请求数统计正确');
  } else {
    console.log(`❌ 总请求数统计有问题: 期望${expectedTotalRequests}, 实际${newStats.totalRequests}`);
  }
  
  console.log('\n🎉 修复总结:');
  console.log('- 修复了有效token重复计数的问题');
  console.log('- 每个SSO token现在只计算一次');
  console.log('- 基于该token是否在任何模型中有效来判断');
  console.log('- 总请求数避免了重复计算');
}

// 运行测试
testTokenStatsfix();
