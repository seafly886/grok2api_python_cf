/**
 * 调试测试 - 查看详细日志
 */

const API_BASE = 'https://grok-api-workers.18571569668.workers.dev';
const API_KEY = '123456';

async function testDebugRequest() {
  console.log('🔍 发送调试请求...');
  
  try {
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'user', content: 'Hi' }
        ],
        stream: false
      })
    });

    console.log('📊 响应状态:', response.status);
    console.log('📋 响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 请求失败:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ 响应成功');
    console.log('📄 响应数据:', JSON.stringify(data, null, 2));

    // 检查响应内容
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const content = data.choices[0].message.content;
      console.log('💬 提取的内容:', content);
      console.log('📏 内容长度:', content.length);
    } else {
      console.log('⚠️  响应结构异常');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 测试流式请求
async function testDebugStream() {
  console.log('\n🔍 发送流式调试请求...');
  
  try {
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        stream: true
      })
    });

    console.log('📊 流式响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 流式请求失败:', errorText);
      return;
    }

    console.log('✅ 开始接收流式响应...');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('🏁 流式响应结束');
        break;
      }

      const chunk = decoder.decode(value);
      chunkCount++;
      
      console.log(`📦 数据块 ${chunkCount}:`, chunk);
      
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          
          if (data === '[DONE]') {
            console.log('🏁 收到结束标记');
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            console.log('📋 解析的数据:', JSON.stringify(parsed, null, 2));
            
            if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              console.log('💬 增量内容:', content);
            }
          } catch (e) {
            console.log('⚠️  JSON 解析失败:', data);
          }
        }
      }
    }

    console.log('\n📝 完整内容:', fullContent);
    console.log('📏 总长度:', fullContent.length);
    console.log('📦 总数据块数:', chunkCount);

  } catch (error) {
    console.error('❌ 流式测试失败:', error);
  }
}

// 运行测试
async function runDebugTests() {
  console.log('🚀 开始调试测试');
  console.log('📍 API 地址:', API_BASE);
  console.log('🔑 API 密钥:', API_KEY);
  console.log('⏰ 时间:', new Date().toISOString());
  
  await testDebugRequest();
  
  console.log('\n⏳ 等待 3 秒...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await testDebugStream();
  
  console.log('\n🎉 调试测试完成');
}

runDebugTests().catch(console.error);
