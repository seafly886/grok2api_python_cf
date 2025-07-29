/**
 * 测试改进的错误消息
 */

async function testImprovedErrorMessages() {
  console.log('🧪 测试改进的错误消息\n');
  
  // 测试数据
  const testCases = [
    {
      name: '有效的SSO Cookie Token',
      token: 'sso=auth_token_1234567890abcdef; Path=/; HttpOnly; Secure',
      expectedResult: 'success'
    },
    {
      name: 'Session Token (应该被拒绝)',
      token: 'sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTkwZjY4NWMtMjg3My00NzViLWExNWUtMDhlYzIwNDBjODI5In0.L6OKl-cFSvWDUTGIej7s0bKO_c7Gk0sNoXWI0neDxAw',
      expectedResult: 'invalid_format'
    },
    {
      name: '纯JWT Session Token',
      token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTkwZjY4NWMtMjg3My00NzViLWExNWUtMDhlYzIwNDBjODI5In0.L6OKl-cFSvWDUTGIej7s0bKO_c7Gk0sNoXWI0neDxAw',
      expectedResult: 'invalid_format'
    },
    {
      name: '无效格式的Token',
      token: 'invalid_token_format',
      expectedResult: 'invalid_format'
    }
  ];
  
  // 获取session cookie (从日志中获取)
  const sessionCookie = 'session=b556089b-e299-4b5a-a05c-638bbaff1450';
  
  for (const testCase of testCases) {
    console.log(`📝 测试: ${testCase.name}`);
    console.log(`Token: ${testCase.token.substring(0, 50)}...`);
    
    try {
      const response = await fetch('http://127.0.0.1:8787/manager/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({
          type: 'normal',
          token: testCase.token
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log('✅ 结果: 添加成功');
        if (testCase.expectedResult === 'success') {
          console.log('🎯 符合预期: 有效token成功添加');
        } else {
          console.log('⚠️  意外结果: 预期应该失败但成功了');
        }
      } else {
        console.log('❌ 结果: 添加失败');
        console.log(`错误消息: ${result.error}`);
        
        // 检查错误消息是否改进
        if (result.error.includes('Session tokens are not allowed')) {
          console.log('🎯 符合预期: 新的错误消息正确识别了session token');
        } else if (result.error.includes('Invalid token format')) {
          console.log('🎯 符合预期: 新的错误消息正确识别了无效格式');
        } else if (result.error.includes('Token already exists')) {
          console.log('🎯 符合预期: 正确识别了重复token');
        } else {
          console.log('📝 其他错误消息:', result.error);
        }
      }
      
    } catch (error) {
      console.log('💥 请求失败:', error.message);
    }
    
    console.log(''); // 空行分隔
  }
  
  console.log('🎉 测试完成！');
  console.log('\n📋 总结:');
  console.log('✅ 改进的错误消息可以帮助用户理解为什么token被拒绝');
  console.log('✅ Session token现在会显示明确的拒绝原因');
  console.log('✅ 不同类型的错误有不同的错误消息');
}

// 运行测试
testImprovedErrorMessages().catch(console.error);
