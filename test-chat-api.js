/**
 * 测试聊天 API 的流式和非流式响应
 */

const API_BASE = 'https://dwuxflxd.ap-northeast-1.clawcloudrun.com';
const API_KEY = 'sk-0epa5Jxb0igRwtEgED9zQtUJemktSRoy2DOdRYIbVFzUysOs'; // 从配置中获取

// 测试用例
const testCases = [
  {
    name: '非流式响应测试',
    stream: false,
    model: 'grok-3',
    messages: [
      { role: 'user', content: '你好，请简单介绍一下自己' }
    ]
  },
  {
    name: '流式响应测试',
    stream: true,
    model: 'grok-3',
    messages: [
      { role: 'user', content: '请写一首关于春天的短诗' }
    ]
  }
];

// 测试非流式响应
async function testNonStreamResponse(testCase) {
  console.log(`\n🧪 ${testCase.name}`);
  console.log('=' * 50);
  
  try {
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: testCase.model,
        messages: testCase.messages,
        stream: testCase.stream
      })
    });

    console.log('响应状态:', response.status, response.statusText);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 请求失败:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ 响应成功');
    console.log('响应数据结构:', {
      id: data.id,
      object: data.object,
      model: data.model,
      hasChoices: !!data.choices,
      choicesCount: data.choices?.length || 0,
      firstChoiceContent: data.choices?.[0]?.message?.content?.substring(0, 100) + '...'
    });

    if (data.choices && data.choices[0] && data.choices[0].message) {
      console.log('📝 响应内容:');
      console.log(data.choices[0].message.content);
    } else {
      console.log('⚠️  没有找到响应内容');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 测试流式响应
async function testStreamResponse(testCase) {
  console.log(`\n🧪 ${testCase.name}`);
  console.log('=' * 50);
  
  try {
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: testCase.model,
        messages: testCase.messages,
        stream: testCase.stream
      })
    });

    console.log('响应状态:', response.status, response.statusText);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 请求失败:', errorText);
      return;
    }

    console.log('✅ 开始接收流式响应...');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          
          if (data === '[DONE]') {
            console.log('🏁 流式响应结束');
            break;
          }

          try {
            const parsed = JSON.parse(data);
            chunkCount++;
            
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
              const content = parsed.choices[0].delta.content;
              if (content) {
                fullContent += content;
                process.stdout.write(content); // 实时显示内容
              }
            }
          } catch (e) {
            console.log('\n⚠️  解析 JSON 失败:', data.substring(0, 100));
          }
        }
      }
    }

    console.log(`\n\n📊 流式响应统计:`);
    console.log(`- 接收到的数据块数量: ${chunkCount}`);
    console.log(`- 总内容长度: ${fullContent.length}`);
    console.log(`- 内容预览: ${fullContent.substring(0, 200)}...`);

  } catch (error) {
    console.error('❌ 流式测试失败:', error);
  }
}

// 测试 API 状态
async function testApiStatus() {
  console.log('\n🔍 测试 API 状态');
  console.log('=' * 50);
  
  try {
    // 测试模型列表
    const modelsResponse = await fetch(`${API_BASE}/v1/models`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      console.log('✅ 模型列表获取成功:', models.data.map(m => m.id));
    } else {
      console.log('❌ 模型列表获取失败');
    }

    // 测试调试端点
    const testResponse = await fetch(`${API_BASE}/v1/test`);
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('✅ 调试端点正常:', testData.message);
      console.log('📋 配置信息:', testData.config);
    } else {
      console.log('❌ 调试端点失败');
    }

  } catch (error) {
    console.error('❌ API 状态测试失败:', error);
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试 Grok API 聊天接口');
  console.log(`📍 API 地址: ${API_BASE}`);
  console.log(`🔑 API 密钥: ${API_KEY}`);
  
  // 测试 API 状态
  await testApiStatus();
  
  // 测试各个用例
  for (const testCase of testCases) {
    if (testCase.stream) {
      await testStreamResponse(testCase);
    } else {
      await testNonStreamResponse(testCase);
    }
    
    // 等待一下再进行下一个测试
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 所有测试完成');
}

// 运行测试
runTests().catch(console.error);
