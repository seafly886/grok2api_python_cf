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

  _formatMessage(level, message, source = 'Worker') {
    const timestamp = new Date().toISOString();
    return `${timestamp} | ${level.padEnd(8)} | [${source}] ${message}`;
  }

  debug(message, source = 'Worker') {
    if (this._shouldLog('DEBUG')) {
      console.log(this._formatMessage('DEBUG', message, source));
    }
  }

  info(message, source = 'Worker') {
    if (this._shouldLog('INFO')) {
      console.log(this._formatMessage('INFO', message, source));
    }
  }

  warning(message, source = 'Worker') {
    if (this._shouldLog('WARNING')) {
      console.warn(this._formatMessage('WARNING', message, source));
    }
  }

  error(message, source = 'Worker') {
    if (this._shouldLog('ERROR')) {
      if (message instanceof Error) {
        console.error(this._formatMessage('ERROR', message.message, source));
        console.error(message.stack);
      } else {
        console.error(this._formatMessage('ERROR', message, source));
      }
    }
  }
}
