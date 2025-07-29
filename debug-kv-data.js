/**
 * 调试KV存储数据脚本
 * 检查token_pools和token_status中的数据
 */

// 模拟KV存储
class MockKV {
  constructor() {
    this.data = new Map();
  }
  
  async get(key, type = 'text') {
    const value = this.data.get(key);
    if (!value) return null;
    
    if (type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }
  
  async put(key, value) {
    this.data.set(key, value);
  }
  
  // 模拟一些测试数据
  async initTestData() {
    // 模拟token_pools数据
    const pools = {
      default_pool: [
        {
          token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E',
          type: 'normal',
          AddedTime: Date.now() - 86400000, // 1天前
          RequestCount: 0,
          StartCallTime: null
        }
      ]
    };
    
    // 模拟token_status数据
    const status = {
      'eyJ0eXAiOiJKV1QiLCJh': {
        'grok-3': {
          isValid: false,
          invalidatedTime: Date.now() - 3600000, // 1小时前
          totalRequestCount: 0,
          isSuper: false
        }
      }
    };
    
    await this.put('token_pools', JSON.stringify(pools));
    await this.put('token_status', JSON.stringify(status));
  }
}

// 模拟TokenManager的extractSSO方法
function extractSSO(token) {
  try {
    // Handle JWT tokens (like session tokens)
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
    console.error('Failed to extract SSO:', error);
    return 'unknown';
  }
}

// JWT解码函数
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // 解码header
    const header = JSON.parse(atob(parts[0]));
    
    // 解码payload
    const payload = JSON.parse(atob(parts[1]));
    
    return { header, payload };
  } catch (error) {
    console.error('JWT解码失败:', error);
    return null;
  }
}

async function debugKVData() {
  console.log('🔍 调试KV存储数据\n');
  
  const kv = new MockKV();
  await kv.initTestData();
  
  // 获取token pools
  const pools = await kv.get('token_pools', 'json');
  console.log('📦 Token Pools:');
  console.log(JSON.stringify(pools, null, 2));
  
  // 获取token status
  const status = await kv.get('token_status', 'json');
  console.log('\n📊 Token Status:');
  console.log(JSON.stringify(status, null, 2));
  
  // 分析每个token
  console.log('\n🔬 Token 分析:');
  
  if (pools && pools.default_pool) {
    for (const tokenEntry of pools.default_pool) {
      const token = tokenEntry.token;
      const sso = extractSSO(token);
      
      console.log(`\n--- Token 分析 ---`);
      console.log(`Token: ${token.substring(0, 50)}...`);
      console.log(`SSO标识: ${sso}`);
      console.log(`类型: ${tokenEntry.type}`);
      console.log(`添加时间: ${new Date(tokenEntry.AddedTime).toLocaleString()}`);
      
      // 如果是JWT token，尝试解码
      if (token.startsWith('eyJ')) {
        const decoded = decodeJWT(token);
        if (decoded) {
          console.log(`JWT Header: ${JSON.stringify(decoded.header)}`);
          console.log(`JWT Payload: ${JSON.stringify(decoded.payload)}`);
          
          // 检查是否是session token
          if (decoded.payload.session_id) {
            console.log(`⚠️  这是一个SESSION TOKEN，不应该在SSO token池中！`);
            console.log(`Session ID: ${decoded.payload.session_id}`);
          }
        }
      }
      
      // 检查状态
      if (status[sso]) {
        console.log(`状态信息: ${JSON.stringify(status[sso], null, 2)}`);
      } else {
        console.log(`❌ 未找到状态信息`);
      }
    }
  }
  
  console.log('\n🎯 问题分析:');
  console.log('1. JWT token是session token，不是SSO token');
  console.log('2. Session token不应该被添加到token池中');
  console.log('3. 需要检查是什么原因导致session token被误添加');
  
  console.log('\n💡 建议解决方案:');
  console.log('1. 在addToken方法中添加token类型验证');
  console.log('2. 过滤掉session token');
  console.log('3. 清理已存在的错误数据');
}

// 运行调试
debugKVData().catch(console.error);
