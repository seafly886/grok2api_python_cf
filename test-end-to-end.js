/**
 * 端到端测试文件
 * 用于测试整个API调用流程，包括请求处理、token管理、响应解析等
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
        return { success: false, error: 'INVALID_TOKEN_FORMAT' }
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

// 模拟GrokApiHandler
class MockGrokApiHandler {
  constructor() {
    this.logger = new MockLogger();
    this.tokenManager = new MockTokenManager();
    this.config = {
      supportedModels: {
        'grok-3': 'grok-3',
        'grok-4': 'grok-4'
      }
    };
  }
  
  processMessageContent(content) {
    if (typeof content === 'string') {
      // Remove <think> tags and base64 images
      return content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/!\[image\]\(data:.*?base64,.*?\)/g, '[图片]')
        .trim();
    } else if (Array.isArray(content)) {
      let textContent = '';
      for (const item of content) {
        if (item.type === 'text') {
          textContent += (textContent ? '\n' : '') + item.text;
        } else if (item.type === 'image_url') {
          textContent += (textContent ? '\n' : '') + '[图片]';
        }
      }
      return textContent;
    }
    return '';
  }
  
  processGrokResponse(data, model) {
    const result = { token: null, imageUrl: null };

    if (data.error) {
      result.token = `错误: ${data.error.message || JSON.stringify(data.error)}`;
      return result;
    }

    // 尝试多种可能的响应结构
    let response = data.result?.response || data.response || data;

    if (!response) {
      return result;
    }

    // Handle different model types with fallback
    try {
      if (model === 'grok-3' || model === 'grok-4') {
        result.token = response.token || response.text || response.content;
      } else {
        // 通用处理
        result.token = response.token || response.text || response.content || response.message;
      }

      // 如果仍然没有内容，尝试直接使用数据
      if (!result.token && !result.imageUrl) {
        if (typeof data === 'string') {
          result.token = data;
        } else if (data.choices && data.choices[0]) {
          result.token = data.choices[0].delta?.content || data.choices[0].message?.content;
        } else if (typeof data === 'object' && data !== null) {
          // 尝试将整个对象转换为字符串
          result.token = JSON.stringify(data);
        }
      }

      // 清理token内容，移除可能的HTML标签
      if (result.token && typeof result.token === 'string') {
        // 移除可能的HTML标签
        result.token = result.token.replace(/<[^>]*>/g, '');
        
        // 如果token看起来像HTML（包含常见的HTML标签），则返回空
        if (/<(html|head|body|div|span|p)[^>]*>/i.test(result.token)) {
          result.token = null;
        }
      }

    } catch (error) {
      result.token = `处理响应时出错: ${error.message}`;
    }

    return result;
  }
  
  async handleNonStreamResponse(mockResponse, model) {
    try {
      // 模拟处理响应
      const result = this.processGrokResponse(mockResponse, model);
      
      if (result.token) {
        return {
          id: `chatcmpl-${Math.random().toString(36).substring(2, 15)}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: result.token
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: result.token.length,
            total_tokens: result.token.length
          }
        };
      } else {
        throw new Error('No content extracted from response');
      }
    } catch (error) {
      throw error;
    }
  }
  
  async simulateApiCall(requestData) {
    try {
      this.logger.info('=== 模拟API调用开始 ===');

      const { model, messages } = requestData;

      this.logger.info('请求详情:', {
        model,
        messagesCount: messages?.length || 0
      });

      // Validate model
      if (!this.config.supportedModels[model]) {
        this.logger.error('不支持的模型:', model);
        throw new Error(`Model ${model} not supported`);
      }

      // Get token for this model
      this.logger.info('获取模型token:', model);
      const token = await this.tokenManager.getNextTokenForModel(model);

      if (!token) {
        this.logger.error('模型无可用token:', model);
        throw new Error('No available tokens for this model');
      }

      this.logger.info('Token获取成功');

      // 模拟API响应
      const mockResponses = {
        'html': `
<!DOCTYPE html>
<html>
<head>
    <title>Login</title>
</head>
<body>
    <h1>Please log in</h1>
    <p>Your token may be invalid or expired.</p>
</body>
</html>
        `,
        'json': {
          result: {
            response: {
              token: "Hello, this is a test response from the API."
            }
          }
        },
        'error': {
          error: {
            message: "Something went wrong"
          }
        }
      };

      // 模拟不同的响应类型
      const responseType = requestData.responseType || 'json';
      const mockResponse = mockResponses[responseType];

      this.logger.info('模拟响应类型:', responseType);

      if (responseType === 'html') {
        this.logger.error('❌ 收到HTML响应而不是JSON');
        // 标记token为无效
        await this.tokenManager.markTokenAsInvalid(token);
        throw new Error('Received HTML response instead of JSON - API token may be invalid or expired. Please check your API token and try again.');
      }

      // 处理响应
      const response = await this.handleNonStreamResponse(mockResponse, model);
      
      this.logger.info('=== 模拟API调用完成 ===');
      return response;
    } catch (error) {
      this.logger.error('API调用错误:', error.message);
      throw error;
    }
  }
}

// 测试函数
async function runEndToEndTests() {
  console.log('🧪 开始端到端测试');
  
  const apiHandler = new MockGrokApiHandler();
  
  // 首先添加一个token
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  await apiHandler.tokenManager.addToken({ type: 'super', token: validToken });
  
  // 测试1: 正常JSON响应
  console.log('\n1. 测试正常JSON响应:');
  try {
    const requestData = {
      model: 'grok-3',
      messages: [{ role: 'user', content: 'Hello' }],
      responseType: 'json'
    };
    
    const response = await apiHandler.simulateApiCall(requestData);
    console.log('响应结果:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }
  
  // 测试2: HTML响应（token无效）
  console.log('\n2. 测试HTML响应（token无效）:');
  try {
    const requestData = {
      model: 'grok-3',
      messages: [{ role: 'user', content: 'Hello' }],
      responseType: 'html'
    };
    
    const response = await apiHandler.simulateApiCall(requestData);
    console.log('响应结果:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }
  
  // 测试3: 错误响应
  console.log('\n3. 测试错误响应:');
  try {
    const requestData = {
      model: 'grok-3',
      messages: [{ role: 'user', content: 'Hello' }],
      responseType: 'error'
    };
    
    const response = await apiHandler.simulateApiCall(requestData);
    console.log('响应结果:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }
  
  // 测试4: 不支持的模型
  console.log('\n4. 测试不支持的模型:');
  try {
    const requestData = {
      model: 'unsupported-model',
      messages: [{ role: 'user', content: 'Hello' }],
      responseType: 'json'
    };
    
    const response = await apiHandler.simulateApiCall(requestData);
    console.log('响应结果:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }
  
  console.log('\n🎉 端到端测试完成');
}

// 运行测试
runEndToEndTests().catch(console.error);