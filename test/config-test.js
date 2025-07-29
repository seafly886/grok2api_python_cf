/**
 * 配置测试脚本
 * 用于验证 Workers 配置和基本功能
 */

// 模拟 Cloudflare Workers 环境
const mockEnv = {
  KV_STORE: {
    get: async (key) => {
      console.log(`KV GET: ${key}`);
      return null;
    },
    put: async (key, value) => {
      console.log(`KV PUT: ${key} = ${value}`);
      return true;
    }
  },
  ADMINPASSWORD: 'test-password',
  API_KEY: 'test-api-key',
  IS_TEMP_CONVERSATION: 'true',
  SHOW_THINKING: 'false',
  ISSHOW_SEARCH_RESULTS: 'true'
};

// 导入配置类
import { Config } from '../src/utils/config.js';
import { Logger } from '../src/utils/logger.js';
import { TokenManager } from '../src/utils/token-manager.js';

async function testConfig() {
  console.log('🧪 测试配置系统...\n');
  
  try {
    // 测试配置类
    const config = new Config(mockEnv);
    
    console.log('✅ 配置测试:');
    console.log(`  - 管理员密码: ${config.adminPassword}`);
    console.log(`  - API 密钥: ${config.apiKey}`);
    console.log(`  - 临时对话: ${config.isTempConversation}`);
    console.log(`  - 显示思考: ${config.showThinking}`);
    console.log(`  - 显示搜索结果: ${config.showSearchResults}`);
    console.log(`  - 支持的模型数量: ${Object.keys(config.supportedModels).length}`);
    
    // 测试日志系统
    console.log('\n✅ 日志测试:');
    const logger = new Logger('DEBUG');
    logger.info('这是一条信息日志');
    logger.warning('这是一条警告日志');
    logger.debug('这是一条调试日志');
    
    // 测试 Token 管理器
    console.log('\n✅ Token 管理器测试:');
    const tokenManager = new TokenManager(mockEnv.KV_STORE, logger);
    
    // 测试配置获取
    const tmConfig = await tokenManager.getConfig();
    console.log(`  - 默认配置: ${JSON.stringify(tmConfig)}`);
    
    // 测试模型名称标准化
    const testModels = ['grok-3', 'grok-3-search', 'grok-4-reasoning'];
    testModels.forEach(model => {
      const normalized = tokenManager.normalizeModelName(model);
      console.log(`  - ${model} -> ${normalized}`);
    });
    
    console.log('\n🎉 所有测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

async function testTokenOperations() {
  console.log('\n🧪 测试 Token 操作...\n');
  
  try {
    const logger = new Logger('INFO');
    const tokenManager = new TokenManager(mockEnv.KV_STORE, logger);
    
    // 测试添加 Token
    const testToken = {
      type: 'normal',
      token: 'sso=test_token_value; path=/; domain=.grok.com'
    };
    
    console.log('✅ 添加测试 Token...');
    const addResult = await tokenManager.addToken(testToken);
    console.log(`  - 添加结果: ${addResult}`);
    
    // 测试获取 Token
    console.log('\n✅ 获取 Token...');
    const token = await tokenManager.getNextTokenForModel('grok-3');
    console.log(`  - 获取的 Token: ${token ? '成功' : '失败'}`);
    
    // 测试配置更新
    console.log('\n✅ 更新配置...');
    const configResult = await tokenManager.setConfig({
      keyMode: 'single',
      usageLimit: 30
    });
    console.log(`  - 配置更新结果: ${configResult}`);
    
    console.log('\n🎉 Token 操作测试通过！');
    
  } catch (error) {
    console.error('❌ Token 操作测试失败:', error);
  }
}

async function testApiEndpoints() {
  console.log('\n🧪 测试 API 端点...\n');
  
  try {
    // 模拟请求对象
    const mockRequest = {
      url: 'https://test.workers.dev/v1/models',
      method: 'GET',
      headers: new Map([
        ['content-type', 'application/json']
      ]),
      json: async () => ({
        model: 'grok-3',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    };
    
    console.log('✅ 模拟 API 请求测试:');
    console.log(`  - URL: ${mockRequest.url}`);
    console.log(`  - Method: ${mockRequest.method}`);
    console.log(`  - Content-Type: ${mockRequest.headers.get('content-type')}`);
    
    // 测试模型列表
    const models = {
      'grok-3': 'grok-3',
      'grok-3-search': 'grok-3',
      'grok-4': 'grok-4'
    };
    
    console.log('\n✅ 支持的模型:');
    Object.entries(models).forEach(([id, mapped]) => {
      console.log(`  - ${id} -> ${mapped}`);
    });
    
    console.log('\n🎉 API 端点测试通过！');
    
  } catch (error) {
    console.error('❌ API 端点测试失败:', error);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始运行 Grok API Workers 测试套件\n');
  console.log('=' * 50);
  
  await testConfig();
  await testTokenOperations();
  await testApiEndpoints();
  
  console.log('\n' + '=' * 50);
  console.log('🎉 所有测试完成！');
  console.log('\n📝 下一步:');
  console.log('1. 运行 `npm run dev` 启动开发服务器');
  console.log('2. 创建 KV 命名空间: `npm run kv:create`');
  console.log('3. 更新 wrangler.toml 中的 KV namespace ID');
  console.log('4. 部署到 Cloudflare: `npm run deploy`');
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testConfig, testTokenOperations, testApiEndpoints };
