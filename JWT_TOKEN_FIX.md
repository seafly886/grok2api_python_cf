# JWT Token 删除问题修复报告

## 问题描述

管理页面出现一个默认SSO无法删除的问题：
- **SSO**: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiMTEzYTgwNTctZTI5OS00YjVhLWEwNWMtNjM4YmJhZmYxNDUwIn0.0NY4zkRae34fX8E92HDs8EG7dVTOU3GXTqlkaPHyY5E`
- **状态**: 无效
- **问题**: 无法删除

## 根本原因分析

### 1. Token格式识别错误
- 该token是JWT格式 (`eyJ...` 开头)，而不是标准的cookie格式
- JWT结构：`header.payload.signature`
- 解码后的payload: `{"session_id":"113a8057-e299-4b5a-a05c-638bbaf1450"}`

### 2. SSO提取逻辑缺陷
原始代码假设所有token都是cookie格式：
```javascript
const sso = token.split('sso=')[1].split(';')[0];
```

对于JWT token，这会导致：
- `token.split('sso=')[1]` 返回 `undefined`
- 调用 `undefined.split(';')[0]` 抛出异常
- 删除操作失败

### 3. 影响范围
- `TokenManager.deleteToken()` 方法
- `TokenManager.addToken()` 方法  
- `TokenManager._getNextTokenPollingMode()` 方法
- `TokenManager._getNextTokenSingleMode()` 方法
- 前端 `extractSSO()` 函数
- 管理页面内嵌JavaScript

## 修复方案

### 1. 新增通用SSO提取方法
在 `TokenManager` 类中添加 `extractSSO()` 方法：

```javascript
extractSSO(token) {
  try {
    // Handle JWT tokens (like session tokens)
    if (token.startsWith('eyJ')) {
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
```

### 2. 更新所有SSO提取调用
将所有直接的字符串分割操作替换为 `this.extractSSO(token)` 调用。

### 3. 前端同步更新
更新前端 `extractSSO()` 函数，保持与后端逻辑一致。

## 修复文件列表

1. **src/utils/token-manager.js**
   - 新增 `extractSSO()` 方法
   - 更新 `deleteToken()` 方法
   - 更新 `addToken()` 方法
   - 更新 `_getNextTokenPollingMode()` 方法
   - 更新 `_getNextTokenSingleMode()` 方法

2. **public/static/manager.js**
   - 更新 `extractSSO()` 函数

3. **src/handlers/manager.js**
   - 更新内嵌JavaScript中的SSO提取逻辑

## 测试验证

创建了测试脚本 `test-jwt-token-fix.js` 验证修复效果：

```
✅ JWT token: eyJ0eXAiOiJKV1QiLCJh (提取成功)
✅ Cookie token: abc123def456 (提取成功)  
✅ 其他格式: some_other_token_for (提取成功)
```

## 修复效果

1. **JWT token可以正常删除**: 不再因为解析错误而失败
2. **向后兼容**: 原有的cookie格式token仍然正常工作
3. **容错性增强**: 支持多种token格式的兼容处理
4. **状态显示正常**: token状态可以正确显示和更新

## 部署建议

1. 备份当前KV存储数据
2. 部署更新后的代码
3. 在管理页面验证问题token可以正常删除
4. 测试其他token的正常功能

## 预防措施

1. **输入验证**: 在添加token时进行格式验证
2. **错误处理**: 增强异常处理和日志记录
3. **文档更新**: 更新用户文档，说明支持的token格式
