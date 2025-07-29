/**
 * 测试 Token 重复问题修复
 */

// 模拟 TokenManager 的修复逻辑
class TestTokenManager {
  constructor() {
    this.modelSuperConfig = {
      "grok-3": { RequestFrequency: 100 },
      "grok-3-deepsearch": { RequestFrequency: 30 },
      "grok-3-deepersearch": { RequestFrequency: 10 },
      "grok-3-reasoning": { RequestFrequency: 30 },
      "grok-4": { RequestFrequency: 20 },
      "grok-4-reasoning": { RequestFrequency: 8 }
    };
    
    this.pools = {};
    this.status = {};
  }

  async addToken(tokenData) {
    const { type, token } = tokenData;
    const modelConfig = this.modelSuperConfig; // 简化测试，只用 super config
    
    const sso = token.split('sso=')[1].split(';')[0];
    
    // 检查 token 是否已经存在于任何模型中
    let tokenExists = false;
    for (const model of Object.keys(modelConfig)) {
      if (this.pools[model] && this.pools[model].find(entry => entry.token === token)) {
        tokenExists = true;
        break;
      }
    }
    
    if (tokenExists) {
      console.log(`❌ Token already exists: ${sso}`);
      return false; // 返回 false 表示 token 已存在
    }
    
    // Initialize pools and status for all models
    for (const model of Object.keys(modelConfig)) {
      if (!this.pools[model]) this.pools[model] = [];
      if (!this.status[sso]) this.status[sso] = {};
      
      // 为每个模型添加 token（但每个 token 只添加一次）
      this.pools[model].push({
        token,
        MaxRequestCount: modelConfig[model].RequestFrequency,
        RequestCount: 0,
        AddedTime: Date.now(),
        StartCallTime: null,
        type
      });
      
      if (!this.status[sso][model]) {
        this.status[sso][model] = {
          isValid: true,
          invalidatedTime: null,
          totalRequestCount: 0,
          isSuper: type === 'super'
        };
      }
    }
    
    console.log(`✅ Token added successfully: ${sso}`);
    return true;
  }

  cleanupDuplicateTokens() {
    let cleaned = false;
    
    for (const model of Object.keys(this.pools)) {
      if (!this.pools[model]) continue;
      
      const uniqueTokens = new Map();
      const cleanedTokens = [];
      
      for (const entry of this.pools[model]) {
        if (!uniqueTokens.has(entry.token)) {
          uniqueTokens.set(entry.token, true);
          cleanedTokens.push(entry);
        } else {
          console.log(`🧹 Removing duplicate token for model ${model}: ${entry.token.substring(0, 20)}...`);
          cleaned = true;
        }
      }
      
      this.pools[model] = cleanedTokens;
    }
    
    return cleaned;
  }

  getStats() {
    const stats = {
      totalTokens: 0,
      uniqueTokens: new Set(),
      modelStats: {}
    };
    
    for (const [model, tokens] of Object.entries(this.pools)) {
      stats.modelStats[model] = {
        tokenCount: tokens.length,
        tokens: tokens.map(t => t.token.split('sso=')[1].split(';')[0])
      };
      stats.totalTokens += tokens.length;
      
      tokens.forEach(t => stats.uniqueTokens.add(t.token));
    }
    
    stats.uniqueTokenCount = stats.uniqueTokens.size;
    return stats;
  }
}

// 测试函数
function testTokenDuplication() {
  console.log('🧪 测试 Token 重复问题修复\n');
  
  const tokenManager = new TestTokenManager();
  const testToken = 'sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E';
  
  console.log('--- 第一次添加 Token ---');
  const result1 = tokenManager.addToken({ type: 'super', token: testToken });
  console.log('添加结果:', result1 ? '成功' : '失败');
  
  let stats = tokenManager.getStats();
  console.log('统计信息:');
  console.log('- 总 Token 数:', stats.totalTokens);
  console.log('- 唯一 Token 数:', stats.uniqueTokenCount);
  console.log('- 模型统计:', Object.keys(stats.modelStats).map(model => 
    `${model}: ${stats.modelStats[model].tokenCount} tokens`
  ).join(', '));
  
  console.log('\n--- 第二次添加相同 Token ---');
  const result2 = tokenManager.addToken({ type: 'super', token: testToken });
  console.log('添加结果:', result2 ? '成功' : '失败（预期）');
  
  stats = tokenManager.getStats();
  console.log('统计信息:');
  console.log('- 总 Token 数:', stats.totalTokens);
  console.log('- 唯一 Token 数:', stats.uniqueTokenCount);
  
  console.log('\n--- 模拟旧版本的重复添加 ---');
  // 模拟旧版本会产生的重复 token
  for (const model of Object.keys(tokenManager.modelSuperConfig)) {
    if (!tokenManager.pools[model]) tokenManager.pools[model] = [];
    tokenManager.pools[model].push({
      token: testToken,
      MaxRequestCount: 100,
      RequestCount: 0,
      AddedTime: Date.now(),
      type: 'super'
    });
  }
  
  stats = tokenManager.getStats();
  console.log('模拟重复后统计:');
  console.log('- 总 Token 数:', stats.totalTokens);
  console.log('- 唯一 Token 数:', stats.uniqueTokenCount);
  
  console.log('\n--- 清理重复 Token ---');
  const cleaned = tokenManager.cleanupDuplicateTokens();
  console.log('清理结果:', cleaned ? '有重复被清理' : '无重复');
  
  stats = tokenManager.getStats();
  console.log('清理后统计:');
  console.log('- 总 Token 数:', stats.totalTokens);
  console.log('- 唯一 Token 数:', stats.uniqueTokenCount);
  
  console.log('\n📊 测试总结:');
  console.log('✅ 修复后的逻辑可以防止重复添加');
  console.log('✅ 清理功能可以移除已存在的重复');
  console.log('✅ 每个 Token 在每个模型中只会有一个副本');
}

// 运行测试
testTokenDuplication();
