/**
 * 调试当前KV存储中的实际数据
 * 通过API调用获取当前token状态
 */

async function debugCurrentKV() {
  console.log('🔍 调试当前KV存储数据\n');
  
  try {
    // 获取当前token列表
    console.log('📡 获取当前token列表...');
    const tokensResponse = await fetch('http://127.0.0.1:8787/manager/api/tokens', {
      headers: {
        'Cookie': 'session=b556089b-e299-4b5a-a05c-638bbaff1450' // 从日志中获取的当前session
      }
    });
    
    if (!tokensResponse.ok) {
      console.log('❌ 获取token列表失败:', tokensResponse.status);
      return;
    }
    
    const tokensData = await tokensResponse.json();
    console.log('📦 Token列表数据:');
    console.log(JSON.stringify(tokensData, null, 2));
    
    // 获取token状态
    console.log('\n📡 获取token状态...');
    const statusResponse = await fetch('http://127.0.0.1:8787/manager/api/status', {
      headers: {
        'Cookie': 'session=b556089b-e299-4b5a-a05c-638bbaff1450'
      }
    });
    
    if (!statusResponse.ok) {
      console.log('❌ 获取token状态失败:', statusResponse.status);
      return;
    }
    
    const statusData = await statusResponse.json();
    console.log('📊 Token状态数据:');
    console.log(JSON.stringify(statusData, null, 2));
    
    // 分析数据
    console.log('\n🔬 数据分析:');
    
    if (tokensData.pools && tokensData.pools.default_pool) {
      const tokens = tokensData.pools.default_pool;
      console.log(`发现 ${tokens.length} 个token:`);
      
      tokens.forEach((tokenEntry, index) => {
        const token = tokenEntry.token;
        console.log(`\n--- Token ${index + 1} ---`);
        console.log(`Token: ${token.substring(0, 50)}...`);
        console.log(`类型: ${tokenEntry.type}`);
        console.log(`添加时间: ${new Date(tokenEntry.AddedTime).toLocaleString()}`);
        console.log(`请求次数: ${tokenEntry.RequestCount}`);
        
        // 检查是否是JWT token
        if (token.startsWith('eyJ')) {
          console.log('🚨 这是一个JWT token!');
          
          try {
            // 尝试解码JWT
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              console.log('JWT Payload:', JSON.stringify(payload, null, 2));
              
              if (payload.session_id) {
                console.log('⚠️  这是一个SESSION TOKEN，不应该在token池中！');
                console.log(`Session ID: ${payload.session_id}`);
              }
            }
          } catch (e) {
            console.log('❌ JWT解码失败:', e.message);
          }
        } else if (token.includes('sso=')) {
          console.log('✅ 这是一个正常的SSO cookie token');
        } else {
          console.log('❓ 未知的token格式');
        }
      });
    } else {
      console.log('📭 没有发现token池数据');
    }
    
    // 检查状态数据
    if (statusData.status) {
      console.log('\n📊 状态数据分析:');
      const statusKeys = Object.keys(statusData.status);
      console.log(`发现 ${statusKeys.length} 个状态记录:`);
      
      statusKeys.forEach(sso => {
        console.log(`\n--- 状态记录: ${sso} ---`);
        const models = Object.keys(statusData.status[sso]);
        console.log(`支持的模型: ${models.join(', ')}`);
        
        models.forEach(model => {
          const modelStatus = statusData.status[sso][model];
          console.log(`${model}: 有效=${modelStatus.isValid}, 请求数=${modelStatus.totalRequestCount}`);
        });
      });
    }
    
    console.log('\n🎯 问题诊断:');
    
    // 检查是否有session token在token池中
    let hasSessionToken = false;
    if (tokensData.pools && tokensData.pools.default_pool) {
      for (const tokenEntry of tokensData.pools.default_pool) {
        if (tokenEntry.token.startsWith('eyJ')) {
          try {
            const parts = tokenEntry.token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              if (payload.session_id) {
                hasSessionToken = true;
                break;
              }
            }
          } catch (e) {
            // 忽略解码错误
          }
        }
      }
    }
    
    if (hasSessionToken) {
      console.log('🚨 确认问题: 发现session token在SSO token池中');
      console.log('💡 解决方案:');
      console.log('1. 使用清理功能删除无效的session token');
      console.log('2. 确保修复代码已部署，防止新的session token被误添加');
      console.log('3. 检查是否有代码bug导致session token被当作SSO token处理');
    } else {
      console.log('✅ 未发现session token在token池中');
      console.log('💭 可能的原因:');
      console.log('1. 问题已经被修复');
      console.log('2. token可能是其他类型的无效token');
      console.log('3. 需要进一步调查token的来源');
    }
    
  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error);
  }
}

// 运行调试
debugCurrentKV().catch(console.error);
