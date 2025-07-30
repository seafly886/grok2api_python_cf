/**
 * Logger utility for Cloudflare Workers
 */
export class Logger {
  constructor(level = 'INFO') {
    this.level = level;
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARNING: 2,
      ERROR: 3
    };
  }

  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  _formatMessage(level, ...args) {
    const timestamp = new Date().toISOString();
    const source = 'GrokAPI';

    // 处理多个参数，将对象序列化为 JSON
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return '[Object]';
        }
      }
      return String(arg);
    }).join(' ');

    return `${timestamp} | ${level.padEnd(8)} | [${source}] ${formattedArgs}`;
  }

  debug(...args) {
    if (this._shouldLog('DEBUG')) {
      console.log(this._formatMessage('DEBUG', ...args));
    }
  }

  info(...args) {
    if (this._shouldLog('INFO')) {
      console.log(this._formatMessage('INFO', ...args));
    }
  }

  warning(...args) {
    if (this._shouldLog('WARNING')) {
      console.warn(this._formatMessage('WARNING', ...args));
    }
  }

  error(...args) {
    if (this._shouldLog('ERROR')) {
      // 特殊处理 Error 对象
      const processedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.message}\nStack: ${arg.stack}`;
        }
        return arg;
      });
      console.error(this._formatMessage('ERROR', ...processedArgs));
    }
  }
  
  // 为了兼容性添加warn方法，指向warning方法
  warn(...args) {
    return this.warning(...args);
  }
}
