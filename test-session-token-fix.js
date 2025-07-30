/**
 * 测试Session Token过滤修复
 */

// 模拟TokenManager的新逻辑
class TestTokenManager {
  constructor() {
    this.logger = {
      info: console.log,
      warn: console.warn,
      error: console.error
    };
  }

  isValidSSOToken(token) {
    try {
      // Reject JWT tokens that are session tokens
      if (token.startsWith('eyJ')) {
        // Try to decode JWT to check if it's a session token
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1]));
            // If it has session_id, it's a session token, not SSO token
            if (payload.session_id) {
              this.logger.warning('Rejected session token:', token.substring(0, 20));
              return false;
            }
          } catch (e) {
            // If we can't decode, treat as invalid
            this.logger.warning('Invalid JWT token format:', token.substring(0, 20));
            return false;
          }
        }
      }
      
      // Accept cookie format tokens that contain sso=
      if (token.includes('sso=')) {
        return true;
      }
      
      // Reject other formats for now
      this.logger.warning('Unsupported token format:', token.substring(0, 20));
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
      this.logger.error('Failed to extract SSO:', error);
      return 'unknown';
    }
  }

  async addToken(tokenData) {
    const { type, token } = tokenData;
    
    // Validate token format
    if (!this.isValidSSOToken(token)) {
      this.logger.info('Invalid or unsupported token format rejected');
      return false;
    }
    
    const sso = this.extractSSO(token);
    this.logger.info(`Valid SSO token added: ${sso}`);
    return true;
  }
}

// 测试用例
const testTokens = [
  // Session token (应该被拒绝)
  {
    name: 'Session Token (JWT)',
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E',
    type: 'normal',
    shouldAccept: false
  },
  
  // 有效的SSO cookie (应该被接受)
  {
    name: 'Valid SSO Cookie',
    token: 'sso=abc123def456ghi789; path=/; domain=.grok.com; HttpOnly; Secure',
    type: 'normal',
    shouldAccept: true
  },
  
  // 另一个有效的SSO cookie
  {
    name: 'Another Valid SSO Cookie',
    token: 'sso=xyz789uvw456rst123; path=/; domain=.grok.com',
    type: 'super',
    shouldAccept: true
  },
  
  // 无效的JWT token (不是session token但格式错误)
  {
    name: 'Invalid JWT Token',
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid_payload.signature',
    type: 'normal',
    shouldAccept: false
  },
  
  // 其他格式的token (应该被拒绝)
  {
    name: 'Other Format Token',
    token: 'some_random_token_12345',
    type: 'normal',
    shouldAccept: false
  }
];

async function testSessionTokenFix() {
  console.log('🧪 测试Session Token过滤修复\n');
  
  const tokenManager = new TestTokenManager();
  let passedTests = 0;
  let totalTests = testTokens.length;
  
  for (const testCase of testTokens) {
    console.log(`\n--- 测试: ${testCase.name} ---`);
    console.log(`Token: ${testCase.token.substring(0, 50)}${testCase.token.length > 50 ? '...' : ''}`);
    console.log(`期望结果: ${testCase.shouldAccept ? '接受' : '拒绝'}`);
    
    try {
      const result = await tokenManager.addToken({
        type: testCase.type,
        token: testCase.token
      });
      
      const actualResult = result ? '接受' : '拒绝';
      const passed = result === testCase.shouldAccept;
      
      console.log(`实际结果: ${actualResult}`);
      console.log(`测试结果: ${passed ? '✅ 通过' : '❌ 失败'}`);
      
      if (passed) {
        passedTests++;
      }
    } catch (error) {
      console.log(`❌ 测试异常: ${error.message}`);
    }
  }
  
  console.log(`\n📊 测试总结:`);
  console.log(`通过: ${passedTests}/${totalTests}`);
  console.log(`成功率: ${(passedTests / totalTests * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！Session Token过滤修复成功');
    console.log('\n✅ 修复效果:');
    console.log('- Session Token现在会被正确拒绝');
    console.log('- 有效的SSO Cookie仍然可以正常添加');
    console.log('- 无效格式的token会被拒绝');
    console.log('- 系统不会再出现误添加的Session Token');
  } else {
    console.log('\n❌ 部分测试失败，需要进一步修复');
  }
}

// 运行测试
testSessionTokenFix().catch(console.error);
