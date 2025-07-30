/**
 * Token管理测试文件
 * 用于测试token管理功能，包括token验证、标记无效等
 */

// 模拟Logger
class MockLogger {
  info(...args) { console.log('INFO:', ...args); }
  error(...args) { console.log('ERROR:', ...args); }
  warn(...args) { console.log('WARN:', ...args); }
}

// 模拟KV存储
class MockKVStore {
  constructor() {
    this.data = {};
  }
  
  async get(key, type = 'text') {
    const value = this.data[key];
    if (type === 'json' && value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    }
    return value;
  }
  
  async put(key, value) {
    if (typeof value === 'object') {
      this.data[key] = JSON.stringify(value);
    } else {
      this.data[key] = value;
    }
    return true;
  }
}

// 模拟TokenManager
class MockTokenManager {
  constructor() {
    this.kv = new MockKVStore();
    this.logger = new MockLogger();
    
    // Model configurations
    this.modelSuperConfig = {
      "grok-3": { RequestFrequency: 100, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-4": { RequestFrequency: 20, ExpirationTime: 3 * 60 * 60 * 1000 }
    };
    
    this.modelNormalConfig = {
      "grok-3": { RequestFrequency: 20, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-4": { RequestFrequency: 20, ExpirationTime: 3 * 60 * 60 * 1000 }
    };
  }
  
  async getTokenPools() {
    try {
      const pools = await this.kv.get('token_pools', 'json');
      return pools || {};
    } catch (error) {
      this.logger.error('Failed to get token pools:', error);
      return {};
    }
  }
  
  async saveTokenPools(pools) {
    try {
      await this.kv.put('token_pools', JSON.stringify(pools));
      return true;
    } catch (error) {
      this.logger.error('Failed to save token pools:', error);
      return false;
    }
  }
  
  async getTokenStatus() {
    try {
      const status = await this.kv.get('token_status', 'json');
      return status || {};
    } catch (error) {
      this.logger.error('Failed to get token status:', error);
      return {};
    }
  }
  
  async saveTokenStatus(status) {
    try {
      await this.kv.put('token_status', JSON.stringify(status));
      return true;
    } catch (error) {
      this.logger.error('Failed to save token status:', error);
      return false;
    }
  }
  
  isValidSSOToken(token) {
    try {
      // Handle tokens that start with sso=
      let actualToken = token;
      if (token.startsWith('sso=')) {
        actualToken = token.substring(4); // Remove 'sso=' prefix
      }

      // Accept JWT tokens
      if (actualToken.startsWith('eyJ')) {
        // Try to decode JWT to validate format
        const parts = actualToken.split('.');
        if (parts.length === 3) {
          try {
            JSON.parse(atob(parts[1])); // Validate JWT format
            return true;
          } catch (e) {
            return false;
          }
        } else {
          return false;
        }
      }

      // Accept cookie format tokens that contain sso=
      if (token.includes('sso=')) {
        return true;
      }

      // Accept direct JWT tokens without sso= prefix
      if (token.startsWith('eyJ')) {
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            JSON.parse(atob(parts[1])); // Validate JWT format
            return true;
          } catch (e) {
            return false;
          }
        }
      }

      // Reject other formats
      return false;
    } catch (error) {
      return false;
    }
  }
  
  extractSSO(token) {
    try {
      // Handle JWT tokens
      if (token.startsWith('eyJ')) {
        // For JWT tokens, use the token itself as identifier (first 20 chars)
        return token.substring(0, 20);
      }

      // Handle regular cookie format tokens
      if (token.includes('sso=')) {
        return token.split('sso=')[1].split(';')[0];
      }

      // Fallback: use first 20 characters as identifier
      return token.substring(0, 20);
    } catch (error) {
      return 'unknown';
    }
  }
  
  async addToken(tokenData) {
    try {
      const { type, token } = tokenData;

      // Validate token format
      if (!this.isValidSSOToken(token)) {
        this.logger.info('Invalid or unsupported token format rejected');
        return { success: false, error: 'INVALID_TOKEN_FORMAT' };
      }

      const sso = this.extractSSO(token);
      const pools = await this.getTokenPools();
      const status = await this.getTokenStatus();

      // Use a single pool for all tokens
      const poolName = 'default_pool';
      if (!pools[poolName]) {
        pools[poolName] = [];
      }

      // Check if token already exists
      if (pools[poolName].find(entry => entry.token === token)) {
        this.logger.info(`Token already exists: ${sso}`);
        return { success: false, error: 'TOKEN_ALREADY_EXISTS' };
      }

      pools[poolName].push({
        token,
        type,
        AddedTime: Date.now(),
        RequestCount: 0,
        StartCallTime: null,
      });

      // Initialize status for all models
      const modelConfig = type === 'super' ? this.modelSuperConfig : this.modelNormalConfig;
      if (!status[sso]) {
        status[sso] = {};
      }
      for (const model of Object.keys(modelConfig)) {
        if (!status[sso][model]) {
          status[sso][model] = {
            isValid: true,
            invalidatedTime: null,
            totalRequestCount: 0,
            isSuper: type === 'super'
          };
        }
      }

      await this.saveTokenPools(pools);
      await this.saveTokenStatus(status);

      this.logger.info(`Token added successfully: ${sso}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to add token:', error);
      return { success: false, error: 'INTERNAL_ERROR', details: error.message };
    }
  }
  
  async getNextTokenForModel(modelId) {
    try {
      const pools = await this.getTokenPools();
      const poolName = 'default_pool';

      if (!pools[poolName] || pools[poolName].length === 0) {
        return null;
      }
      
      // Return the first valid token
      const tokenEntry = pools[poolName][0];
      return tokenEntry ? tokenEntry.token : null;
    } catch (error) {
      this.logger.error('Failed to get next token:', error);
      return null;
    }
  }
  
  async markTokenAsInvalid(token) {
    try {
      const sso = this.extractSSO(token);
      const status = await this.getTokenStatus();
      
      // Mark all models for this token as invalid
      if (status[sso]) {
        for (const model in status[sso]) {
          status[sso][model].isValid = false;
          status[sso][model].invalidatedTime = Date.now();
        }
        await this.saveTokenStatus(status);
        this.logger.info(`Token marked as invalid: ${sso}`);
        return true;
      }
      
      this.logger.info(`Token not found in status: ${sso}`);
      return false;
    } catch (error) {
      this.logger.error('Failed to mark token as invalid:', error);
      return false;
    }
  }
}

// 测试函数
async function runTokenManagementTests() {
  console.log('🧪 开始Token管理测试');
  
  const tokenManager = new MockTokenManager();
  
  // 测试1: 添加有效token
  console.log('\n1. 测试添加有效token:');
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const addResult = await tokenManager.addToken({ type: 'super', token: validToken });
  console.log('添加结果:', addResult);
  
  // 测试2: 添加无效token
  console.log('\n2. 测试添加无效token:');
  const invalidToken = 'invalid_token_format';
  const addResult2 = await tokenManager.addToken({ type: 'super', token: invalidToken });
  console.log('添加结果:', addResult2);
  
  // 测试3: 获取token
  console.log('\n3. 测试获取token:');
  const token = await tokenManager.getNextTokenForModel('grok-3');
  console.log('获取到的token:', token ? token.substring(0, 30) + '...' : 'null');
  
  // 测试4: 标记token为无效
  console.log('\n4. 测试标记token为无效:');
  if (token) {
    const markResult = await tokenManager.markTokenAsInvalid(token);
    console.log('标记结果:', markResult);
  }
  
  // 测试5: 再次获取token（应该仍然可以获取，因为我们没有删除它，只是标记为无效）
  console.log('\n5. 测试再次获取token:');
  const token2 = await tokenManager.getNextTokenForModel('grok-3');
  console.log('再次获取到的token:', token2 ? token2.substring(0, 30) + '...' : 'null');
  
  // 测试6: Token格式验证
  console.log('\n6. 测试Token格式验证:');
  const testTokens = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // 有效的JWT
    'sso=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // 带sso=前缀的JWT
    'invalid_token_format', // 无效格式
    'sso=invalid_token', // 带sso=前缀的无效格式
  ];
  
  testTokens.forEach((token, index) => {
    const isValid = tokenManager.isValidSSOToken(token);
    console.log(`  Token ${index + 1}: ${isValid ? '✅ 有效' : '❌ 无效'}`);
  });
  
  console.log('\n🎉 Token管理测试完成');
}

// 运行测试
runTokenManagementTests().catch(console.error);