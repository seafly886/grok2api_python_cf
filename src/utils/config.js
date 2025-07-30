/**
 * Configuration utilities for Cloudflare Workers
 */
export class Config {
  constructor(env) {
    this.env = env;
  }

  get(key, defaultValue = null) {
    return this.env[key] || defaultValue;
  }

  getBoolean(key, defaultValue = false) {
    const value = this.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  getInt(key, defaultValue = 0) {
    const value = this.env[key];
    if (value === undefined) return defaultValue;
    return parseInt(value, 10) || defaultValue;
  }

  // Application-specific configuration getters
  get apiKey() {
    return this.get('API_KEY', '123456');
  }

  get adminPassword() {
    return this.get('ADMINPASSWORD', 'ts-123456');
  }

  get isTempConversation() {
    return this.getBoolean('IS_TEMP_CONVERSATION', true);
  }

  get isCustomSSO() {
    return this.getBoolean('IS_CUSTOM_SSO', false);
  }

  get showThinking() {
    return this.getBoolean('SHOW_THINKING', false);
  }

  get showSearchResults() {
    return this.getBoolean('ISSHOW_SEARCH_RESULTS', true);
  }

  get isSuperGrok() {
    return this.getBoolean('IS_SUPER_GROK', false);
  }

  get managerSwitch() {
    return this.getBoolean('MANAGER_SWITCH', true);
  }

  get cfClearance() {
    return this.get('CF_CLEARANCE', '');
  }

  get picgoKey() {
    return this.get('PICGO_KEY');
  }

  get tumyKey() {
    return this.get('TUMY_KEY');
  }

  get proxy() {
    return this.get('PROXY');
  }

  // Model configurations
  get supportedModels() {
    return {
      'grok-3': 'grok-3',
      'grok-3-search': 'grok-3',
      'grok-3-imageGen': 'grok-3',
      'grok-3-deepsearch': 'grok-3',
      'grok-3-deepersearch': 'grok-3',
      'grok-3-reasoning': 'grok-3',
      'grok-4': 'grok-4',
      'grok-4-reasoning': 'grok-4',
      'grok-4-imageGen': 'grok-4',
      'grok-4-deepsearch': 'grok-4'
    };
  }

  // Default headers for Grok API
  get defaultHeaders() {
    return {
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
      'Origin': 'https://grok.com',
      'Priority': 'u=1, i',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'Sec-Ch-Ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Baggage': 'sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c',
      'x-statsig-id': 'ZTpUeXBlRXJyb3I6IENhbm5vdCByZWFkIHByb3BlcnRpZXMgb2YgdW5kZWZpbmVkIChyZWFkaW5nICdjaGlsZE5vZGVzJyk='
    };
  }

  // Retry configuration
  get retryConfig() {
    return {
      maxAttempts: 2,
      retryTime: 1000
    };
  }
}
