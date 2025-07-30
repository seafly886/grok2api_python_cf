/**
 * 简单的 API 测试请求
 */

const API_BASE = 'https://grok-api-workers.18571569668.workers.dev';
const API_KEY = '123456';

async function testSimpleRequest() {
  console.log('🧪 测试简单的聊天请求');
  
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
          { role: 'user', content: '你好' }
        ],
        stream: false
      })
    });

    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 请求失败:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ 响应成功');
    console.log('响应数据:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

async function testStreamRequest() {
  console.log('\n🧪 测试流式聊天请求');
  
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
          { role: 'user', content: '请说一句话' }
        ],
        stream: true
      })
    });

    console.log('流式响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 流式请求失败:', errorText);
      return;
    }

    console.log('✅ 开始接收流式响应...');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      console.log('收到数据块:', chunk);
      
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
            console.log('🏁 流式响应结束');
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              content += parsed.choices[0].delta.content;
              process.stdout.write(parsed.choices[0].delta.content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    console.log('\n📝 完整内容:', content);

  } catch (error) {
    console.error('❌ 流式测试失败:', error);
  }
}

// 运行测试
async function runTests() {
  await testSimpleRequest();
  await new Promise(resolve => setTimeout(resolve, 2000));
  await testStreamRequest();
}

runTests().catch(console.error);
