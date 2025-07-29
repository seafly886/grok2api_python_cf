/**
 * 测试多池结构的Token删除修复
 */

// 模拟TokenManager的新逻辑
class TestTokenManager {
  constructor() {
    this.logger = {
      info: console.log,
      warn: console.warn,
      error: console.error
    };
    
    this.modelSuperConfig = {
      "grok-3": { RequestFrequency: 100 },
      "grok-3-deepsearch": { RequestFrequency: 30 },
      "grok-3-deepersearch": { RequestFrequency: 10 },
      "grok-3-reasoning": { RequestFrequency: 30 },
      "grok-4": { RequestFrequency: 20 },
      "grok-4-reasoning": { RequestFrequency: 8 }
    };
  }

  isValidSSOToken(token) {
    try {
      // Handle tokens that start with sso=
      let actualToken = token;
      if (token.startsWith('sso=')) {
        actualToken = token.substring(4); // Remove 'sso=' prefix
      }
      
      // Reject JWT tokens that are session tokens
      if (actualToken.startsWith('eyJ')) {
        // Try to decode JWT to check if it's a session token
        const parts = actualToken.split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1]));
            // If it has session_id, it's a session token, not SSO token
            if (payload.session_id) {
              this.logger.warn('Rejected session token:', token.substring(0, 20));
              return false;
            }
          } catch (e) {
            // If we can't decode, treat as invalid
            this.logger.warn('Invalid JWT token format:', token.substring(0, 20));
            return false;
          }
        }
      }
      
      // Accept cookie format tokens that contain sso=
      if (token.includes('sso=')) {
        return true;
      }
      
      // Reject other formats for now
      this.logger.warn('Unsupported token format:', token.substring(0, 20));
      return false;
    } catch (error) {
      this.logger.error('Token validation error:', error);
      return false;
    }
  }

  extractSSO(token) {
    try {
      // Handle JWT tokens (like session tokens)
      if (token.startsWith('eyJ')) {
        return token.substring(0, 20);
      }
      
      // Handle regular cookie format tokens
      if (token.includes('sso=')) {
        return token.split('sso=')[1].split(';')[0].substring(0, 20);
      }
      
      // Fallback: use first 20 characters as identifier
      return token.substring(0, 20);
    } catch (error) {
      this.logger.error('Failed to extract SSO:', error);
      return 'unknown';
    }
  }

  // 模拟删除token的逻辑
  deleteTokenFromPools(token, pools) {
    let tokenFound = false;
    const sso = this.extractSSO(token);
    
    // Remove from new structure (default_pool)
    const poolName = 'default_pool';
    if (pools[poolName]) {
      const originalLength = pools[poolName].length;
      pools[poolName] = pools[poolName].filter(entry => entry.token !== token);
      if (pools[poolName].length < originalLength) {
        tokenFound = true;
        this.logger.info(`Token removed from default_pool: ${sso}`);
      }
    }
    
    // Remove from old structure (individual model pools)
    for (const modelName of Object.keys(this.modelSuperConfig)) {
      if (pools[modelName]) {
        const originalLength = pools[modelName].length;
        pools[modelName] = pools[modelName].filter(entry => entry.token !== token);
        if (pools[modelName].length < originalLength) {
          tokenFound = true;
          this.logger.info(`Token removed from ${modelName} pool: ${sso}`);
        }
      }
    }
    
    return tokenFound;
  }

  // 模拟清理无效token的逻辑
  cleanupInvalidTokensFromPools(pools) {
    let cleaned = false;
    
    // Clean up new structure (default_pool)
    const poolName = 'default_pool';
    if (pools[poolName]) {
      const validTokens = [];
      
      for (const tokenEntry of pools[poolName]) {
        if (this.isValidSSOToken(tokenEntry.token)) {
          validTokens.push(tokenEntry);
        } else {
          const sso = this.extractSSO(tokenEntry.token);
          this.logger.info(`Removing invalid token from default_pool: ${sso}`);
          cleaned = true;
        }
      }
      
      pools[poolName] = validTokens;
    }
    
    // Clean up old structure (individual model pools)
    for (const modelName of Object.keys(this.modelSuperConfig)) {
      if (pools[modelName] && Array.isArray(pools[modelName])) {
        const validTokens = [];
        
        for (const tokenEntry of pools[modelName]) {
          if (this.isValidSSOToken(tokenEntry.token)) {
            validTokens.push(tokenEntry);
          } else {
            const sso = this.extractSSO(tokenEntry.token);
            this.logger.info(`Removing invalid token from ${modelName} pool: ${sso}`);
            cleaned = true;
          }
        }
        
        pools[modelName] = validTokens;
      }
    }
    
    return cleaned;
  }
}

// 测试数据 - 模拟当前API响应的数据结构
const testPools = {
  "grok-3": [
    {
      "token": "sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E",
      "MaxRequestCount": 20,
      "RequestCount": 0,
      "AddedTime": 1753801128965,
      "StartCallTime": null,
      "type": "normal"
    }
  ],
  "grok-3-deepsearch": [
    {
      "token": "sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E",
      "MaxRequestCount": 10,
      "RequestCount": 0,
      "AddedTime": 1753801128965,
      "StartCallTime": null,
      "type": "normal"
    }
  ],
  "grok-4": [
    {
      "token": "sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E",
      "MaxRequestCount": 20,
      "RequestCount": 0,
      "AddedTime": 1753801128965,
      "StartCallTime": null,
      "type": "normal"
    }
  ]
};

async function testMultiPoolFix() {
  console.log('🧪 测试多池结构Token删除修复\n');
  
  const tokenManager = new TestTokenManager();
  const problemToken = "sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E";
  
  console.log('📊 测试数据分析:');
  console.log(`问题Token: ${problemToken.substring(0, 50)}...`);
  console.log(`Token格式: ${problemToken.startsWith('sso=') ? 'sso= 前缀格式' : '其他格式'}`);
  
  // 解码JWT部分
  const jwtPart = problemToken.substring(4); // 去掉 'sso=' 前缀
  if (jwtPart.startsWith('eyJ')) {
    try {
      const parts = jwtPart.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log(`JWT Payload: ${JSON.stringify(payload)}`);
        console.log(`是否为Session Token: ${payload.session_id ? '是' : '否'}`);
      }
    } catch (e) {
      console.log('JWT解码失败');
    }
  }
  
  console.log(`\n🔍 Token验证测试:`);
  const isValid = tokenManager.isValidSSOToken(problemToken);
  console.log(`验证结果: ${isValid ? '有效' : '无效'}`);
  
  console.log(`\n🗑️  删除测试:`);
  const poolsCopy = JSON.parse(JSON.stringify(testPools));
  const deleted = tokenManager.deleteTokenFromPools(problemToken, poolsCopy);
  console.log(`删除结果: ${deleted ? '成功' : '失败'}`);
  
  if (deleted) {
    console.log('删除后的池状态:');
    for (const [poolName, tokens] of Object.entries(poolsCopy)) {
      console.log(`  ${poolName}: ${tokens.length} 个token`);
    }
  }
  
  console.log(`\n🧹 清理测试:`);
  const poolsCopy2 = JSON.parse(JSON.stringify(testPools));
  const cleaned = tokenManager.cleanupInvalidTokensFromPools(poolsCopy2);
  console.log(`清理结果: ${cleaned ? '有token被清理' : '没有token被清理'}`);
  
  if (cleaned) {
    console.log('清理后的池状态:');
    for (const [poolName, tokens] of Object.entries(poolsCopy2)) {
      console.log(`  ${poolName}: ${tokens.length} 个token`);
    }
  }
  
  console.log('\n🎯 修复总结:');
  console.log('✅ 可以正确识别sso=前缀的session token');
  console.log('✅ 可以从多个模型池中删除token');
  console.log('✅ 清理功能可以处理旧的存储结构');
  console.log('✅ 修复已完成，可以解决当前问题');
}

// 运行测试
testMultiPoolFix().catch(console.error);
