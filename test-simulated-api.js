/**
 * 模拟API测试文件
 * 用于测试各种API响应情况，包括HTML响应、JSON响应等
 */

// 模拟的HTML响应（登录页面）
const mockHtmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <title>Login</title>
</head>
<body>
    <h1>Please log in</h1>
    <form>
        <input type="text" name="username" placeholder="Username">
        <input type="password" name="password" placeholder="Password">
        <button type="submit">Login</button>
    </form>
</body>
</html>
`;

// 模拟的JSON响应（正常响应）
const mockJsonResponse = {
  result: {
    response: {
      token: "Hello, this is a test response from the API."
    }
  }
};

// 模拟的错误响应
const mockErrorResponse = {
  error: {
    message: "Something went wrong"
  }
};

// 模拟的搜索结果响应
const mockSearchResponse = {
  result: {
    response: {
      webSearchResults: {
        results: [
          {
            title: "Test Result 1",
            url: "https://example.com/1",
            preview: "This is a test search result"
          },
          {
            title: "Test Result 2",
            url: "https://example.com/2",
            preview: "This is another test search result"
          }
        ]
      }
    }
  }
};

// 模拟的流式响应
const mockStreamResponses = [
  'data: {"result": {"response": {"token": "Hello"}}}',
  'data: {"result": {"response": {"token": ", this is a"}}}',
  'data: {"result": {"response": {"token": " stream response"}}}',
  'data: [DONE]'
];

console.log('🧪 开始模拟API测试');

// 测试HTML响应处理
console.log('\n1. 测试HTML响应处理:');
console.log('HTML内容预览:', mockHtmlResponse.substring(0, 100) + '...');

// 检查是否包含HTML标签
if (mockHtmlResponse.toLowerCase().includes('<html') || mockHtmlResponse.toLowerCase().includes('<!doctype')) {
  console.log('✅ 检测到HTML响应');
  console.log('❌ 应该返回token无效错误');
}

// 测试JSON响应处理
console.log('\n2. 测试JSON响应处理:');
console.log('JSON响应:', JSON.stringify(mockJsonResponse, null, 2));

// 测试错误响应处理
console.log('\n3. 测试错误响应处理:');
console.log('错误响应:', JSON.stringify(mockErrorResponse, null, 2));

// 测试搜索结果响应处理
console.log('\n4. 测试搜索结果响应处理:');
console.log('搜索结果响应:', JSON.stringify(mockSearchResponse, null, 2));

// 测试流式响应处理
console.log('\n5. 测试流式响应处理:');
console.log('流式响应数据:');
mockStreamResponses.forEach((response, index) => {
  console.log(`  ${index + 1}. ${response}`);
});

console.log('\n✅ 模拟测试完成');

// 额外的测试：验证token格式
console.log('\n6. 测试token格式验证:');

const testTokens = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // 有效的JWT
  'sso=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // 带sso=前缀的JWT
  'invalid_token_format', // 无效格式
  'sso=invalid_token', // 带sso=前缀的无效格式
];

testTokens.forEach((token, index) => {
  console.log(`\n  Token ${index + 1}: ${token.substring(0, 30)}${token.length > 30 ? '...' : ''}`);
  
  // 检查是否是有效的JWT格式
  if (token.startsWith('eyJ') || (token.startsWith('sso=') && token.substring(4).startsWith('eyJ'))) {
    console.log('  ✅ 可能是有效的JWT格式');
  } else if (token.includes('sso=')) {
    console.log('  ✅ 可能是有效的SSO cookie格式');
  } else {
    console.log('  ❌ 可能是无效的token格式');
  }
});

console.log('\n🎉 所有模拟测试完成');