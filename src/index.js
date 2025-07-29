import { GrokApiHandler } from './handlers/grok-api';
import { ManagerHandler } from './handlers/manager';
import { TokenManager } from './utils/token-manager';
import { Logger } from './utils/logger';
import { Config } from './utils/config';
import { HttpClient } from './utils/http-client';

// 主 Worker 处理器
export default {
  async fetch(request, env, ctx) {
    const logger = new Logger();
    const config = new Config(env);

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 初始化组件
      const httpClient = new HttpClient(logger, config);
      const tokenManager = new TokenManager(env.KV_STORE, logger);

      // 路由处理
      if (path.startsWith('/v1/')) {
        // OpenAI API 兼容接口
        const apiHandler = new GrokApiHandler(env, logger, tokenManager, config, httpClient);
        return await apiHandler.handle(request);
      } else if (path.startsWith('/manager')) {
        // 管理界面接口
        const managerHandler = new ManagerHandler(env, logger, tokenManager, config, httpClient);
        return await managerHandler.handle(request);
      } else if (path === '/' || path === '/index.html') {
        // 重定向到管理界面
        return Response.redirect(new URL('/manager', request.url).toString(), 302);
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      logger.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(event, env, ctx) {
    const logger = new Logger();
    const tokenManager = new TokenManager(env.KV_STORE, logger);
    logger.info('Running scheduled task to reset token usage...');
    await tokenManager.resetTokenUsage();
    logger.info('Token usage reset complete.');
  }
};
