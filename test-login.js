/**
 * 测试登录功能的简单脚本
 */

// 模拟环境变量
const mockEnv = {
  ADMINPASSWORD: 'ts-123456',
  API_KEY: '123456',
  IS_TEMP_CONVERSATION: 'true',
  IS_CUSTOM_SSO: 'false',
  SHOW_THINKING: 'false',
  ISSHOW_SEARCH_RESULTS: 'true',
  IS_SUPER_GROK: 'false',
  MANAGER_SWITCH: 'true'
};

// 模拟 Config 类
class TestConfig {
  constructor(env) {
    this.env = env;
  }

  get(key, defaultValue = null) {
    return this.env[key] || defaultValue;
  }

  get adminPassword() {
    return this.get('ADMINPASSWORD', 'ts-123456');
  }
}

// 测试配置
function testConfig() {
  console.log('🔧 测试配置...');
  const config = new TestConfig(mockEnv);
  
  console.log('管理员密码:', config.adminPassword);
  console.log('API 密钥:', config.get('API_KEY'));
  
  // 测试密码验证逻辑
  const testPassword = 'ts-123456';
  const isValid = testPassword === config.adminPassword;
  console.log(`密码验证 (${testPassword}):`, isValid ? '✅ 通过' : '❌ 失败');
  
  return isValid;
}

// 模拟登录请求
function simulateLoginRequest(password) {
  console.log('\n🔐 模拟登录请求...');
  console.log('输入密码:', password);
  
  const config = new TestConfig(mockEnv);
  const adminPassword = config.adminPassword;
  
  console.log('配置中的管理员密码:', adminPassword);
  console.log('密码匹配:', password === adminPassword);
  
  if (password === adminPassword) {
    const sessionToken = 'mock-session-' + Date.now();
    console.log('✅ 登录成功，会话令牌:', sessionToken);
    return { success: true, sessionToken };
  } else {
    console.log('❌ 登录失败：密码不匹配');
    return { success: false, error: 'Invalid password' };
  }
}

// 运行测试
console.log('🚀 开始登录功能测试\n');

// 测试1: 配置验证
const configTest = testConfig();

// 测试2: 正确密码登录
console.log('\n--- 测试正确密码 ---');
simulateLoginRequest('ts-123456');

// 测试3: 错误密码登录
console.log('\n--- 测试错误密码 ---');
simulateLoginRequest('wrong-password');

// 测试4: 空密码
console.log('\n--- 测试空密码 ---');
simulateLoginRequest('');

console.log('\n📊 测试完成');

if (configTest) {
  console.log('\n✅ 配置测试通过');
  console.log('💡 建议检查：');
  console.log('1. 确保在登录页面输入的密码是: ts-123456');
  console.log('2. 检查浏览器开发者工具的网络请求');
  console.log('3. 查看 Cloudflare Workers 的实时日志');
} else {
  console.log('\n❌ 配置测试失败');
  console.log('请检查 wrangler.toml 中的 ADMINPASSWORD 配置');
}
