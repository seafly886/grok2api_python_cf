/**
 * Token Manager for Cloudflare Workers
 * Manages SSO tokens, request counting, and token rotation
 */
export class TokenManager {
  constructor(kvStore, logger) {
    this.kv = kvStore;
    this.logger = logger;
    
    // Model configurations
    this.modelSuperConfig = {
      "grok-3": { RequestFrequency: 100, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-3-deepsearch": { RequestFrequency: 30, ExpirationTime: 24 * 60 * 60 * 1000 },
      "grok-3-deepersearch": { RequestFrequency: 10, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-3-reasoning": { RequestFrequency: 30, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-4": { RequestFrequency: 20, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-4-reasoning": { RequestFrequency: 8, ExpirationTime: 24 * 60 * 60 * 1000 }
    };
    
    this.modelNormalConfig = {
      "grok-3": { RequestFrequency: 20, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-3-deepsearch": { RequestFrequency: 10, ExpirationTime: 24 * 60 * 60 * 1000 },
      "grok-3-deepersearch": { RequestFrequency: 3, ExpirationTime: 24 * 60 * 60 * 1000 },
      "grok-3-reasoning": { RequestFrequency: 8, ExpirationTime: 24 * 60 * 60 * 1000 },
      "grok-4": { RequestFrequency: 20, ExpirationTime: 3 * 60 * 60 * 1000 },
      "grok-4-reasoning": { RequestFrequency: 8, ExpirationTime: 24 * 60 * 60 * 1000 }
    };
  }

  /**
   * Get configuration for the current environment
   */
  async getConfig() {
    try {
      const config = await this.kv.get('config', 'json');
      return config || {
        keyMode: 'polling',
        usageLimit: 20
      };
    } catch (error) {
      this.logger.error('Failed to get config:', error);
      return { keyMode: 'polling', usageLimit: 20 };
    }
  }

  /**
   * Set configuration
   */
  async setConfig(config) {
    try {
      await this.kv.put('config', JSON.stringify(config));
      this.logger.info('Config updated:', config);
      return true;
    } catch (error) {
      this.logger.error('Failed to set config:', error);
      return false;
    }
  }

  /**
   * Get token pools for all models
   */
  async getTokenPools() {
    try {
      const pools = await this.kv.get('token_pools', 'json');
      return pools || {};
    } catch (error) {
      this.logger.error('Failed to get token pools:', error);
      return {};
    }
  }

  /**
   * Save token pools
   */
  async saveTokenPools(pools) {
    try {
      await this.kv.put('token_pools', JSON.stringify(pools));
      return true;
    } catch (error) {
      this.logger.error('Failed to save token pools:', error);
      return false;
    }
  }

  /**
   * Get token status map
   */
  async getTokenStatus() {
    try {
      const status = await this.kv.get('token_status', 'json');
      return status || {};
    } catch (error) {
      this.logger.error('Failed to get token status:', error);
      return {};
    }
  }

  /**
   * Save token status
   */
  async saveTokenStatus(status) {
    try {
      await this.kv.put('token_status', JSON.stringify(status));
      return true;
    } catch (error) {
      this.logger.error('Failed to save token status:', error);
      return false;
    }
  }

  /**
   * Normalize model name
   */
  normalizeModelName(model) {
    if (model.startsWith('grok-') && !['deepsearch', 'deepersearch', 'reasoning'].some(keyword => model.includes(keyword))) {
      return model.split('-').slice(0, 2).join('-');
    }
    return model;
  }

  /**
   * Add token to the system
   */
  async addToken(tokenData) {
    try {
      const { type, token } = tokenData;
      const modelConfig = type === 'super' ? this.modelSuperConfig : this.modelNormalConfig;

      const sso = token.split('sso=')[1].split(';')[0];
      const pools = await this.getTokenPools();
      const status = await this.getTokenStatus();

      // 检查 token 是否已经存在于任何模型中
      let tokenExists = false;
      for (const model of Object.keys(modelConfig)) {
        if (pools[model] && pools[model].find(entry => entry.token === token)) {
          tokenExists = true;
          break;
        }
      }

      if (tokenExists) {
        this.logger.info(`Token already exists: ${sso}`);
        return false; // 返回 false 表示 token 已存在
      }

      // Initialize pools and status for all models
      for (const model of Object.keys(modelConfig)) {
        if (!pools[model]) pools[model] = [];
        if (!status[sso]) status[sso] = {};

        // 为每个模型添加 token（但每个 token 只添加一次）
        pools[model].push({
          token,
          MaxRequestCount: modelConfig[model].RequestFrequency,
          RequestCount: 0,
          AddedTime: Date.now(),
          StartCallTime: null,
          type
        });

        if (!status[sso][model]) {
          status[sso][model] = {
            isValid: true,
            invalidatedTime: null,
            totalRequestCount: 0,
            isSuper: type === 'super'
          };
        }
      }

      await this.saveTokenPools(pools);
      await this.saveTokenStatus(status);

      this.logger.info(`Token added successfully: ${sso}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to add token:', error);
      return false;
    }
  }

  /**
   * Get next token for a model
   */
  async getNextTokenForModel(modelId, isReturn = false) {
    try {
      const normalizedModel = this.normalizeModelName(modelId);
      const pools = await this.getTokenPools();
      const config = await this.getConfig();
      
      if (!pools[normalizedModel] || pools[normalizedModel].length === 0) {
        return null;
      }
      
      if (isReturn) {
        return pools[normalizedModel][0]?.token || null;
      }
      
      if (config.keyMode === 'single') {
        return await this._getNextTokenSingleMode(normalizedModel, pools, config);
      } else {
        return await this._getNextTokenPollingMode(normalizedModel, pools);
      }
    } catch (error) {
      this.logger.error('Failed to get next token:', error);
      return null;
    }
  }

  /**
   * Polling mode token selection (use each token once then rotate)
   */
  async _getNextTokenPollingMode(normalizedModel, pools) {
    const modelTokens = pools[normalizedModel];
    if (!modelTokens || modelTokens.length === 0) return null;
    
    const tokenEntry = modelTokens[0];
    const token = tokenEntry.token;
    const sso = token.split('sso=')[1].split(';')[0];
    
    // Set start time if first use
    if (!tokenEntry.StartCallTime) {
      tokenEntry.StartCallTime = Date.now();
    }
    
    // Increment request count
    tokenEntry.RequestCount += 1;
    
    // Update token status
    const status = await this.getTokenStatus();
    if (status[sso] && status[sso][normalizedModel]) {
      status[sso][normalizedModel].totalRequestCount += 1;
    }
    
    // Check if token reached limit
    if (tokenEntry.RequestCount >= tokenEntry.MaxRequestCount) {
      // Remove token and mark as invalid
      modelTokens.shift();
      if (status[sso] && status[sso][normalizedModel]) {
        status[sso][normalizedModel].isValid = false;
        status[sso][normalizedModel].invalidatedTime = Date.now();
      }
      this.logger.info(`Token ${sso} reached limit and marked invalid`);
    } else {
      // Rotate token to end of queue
      modelTokens.push(modelTokens.shift());
      this.logger.info(`Token ${sso} used and rotated, count: ${tokenEntry.RequestCount}/${tokenEntry.MaxRequestCount}`);
    }
    
    await this.saveTokenPools(pools);
    await this.saveTokenStatus(status);
    
    return token;
  }

  /**
   * Single key mode token selection
   */
  async _getNextTokenSingleMode(normalizedModel, pools, config) {
    const modelTokens = pools[normalizedModel];
    if (!modelTokens || modelTokens.length === 0) return null;
    
    // Get current usage from KV
    const usageKey = `single_mode_usage_${normalizedModel}`;
    const currentUsage = await this.kv.get(usageKey, 'json') || { tokenIndex: 0, count: 0 };
    
    // Check if need to switch token
    if (currentUsage.count >= config.usageLimit) {
      currentUsage.tokenIndex = (currentUsage.tokenIndex + 1) % modelTokens.length;
      currentUsage.count = 0;
      this.logger.info(`Single mode: switched to token index ${currentUsage.tokenIndex}`);
    }
    
    const tokenEntry = modelTokens[currentUsage.tokenIndex];
    const token = tokenEntry.token;
    
    // Increment usage
    currentUsage.count += 1;
    tokenEntry.RequestCount += 1;
    
    // Set start time if first use
    if (!tokenEntry.StartCallTime) {
      tokenEntry.StartCallTime = Date.now();
    }
    
    // Update status
    const sso = token.split('sso=')[1].split(';')[0];
    const status = await this.getTokenStatus();
    if (status[sso] && status[sso][normalizedModel]) {
      status[sso][normalizedModel].totalRequestCount += 1;
    }
    
    // Save state
    await this.kv.put(usageKey, JSON.stringify(currentUsage));
    await this.saveTokenPools(pools);
    await this.saveTokenStatus(status);
    
    this.logger.info(`Single mode: using token ${sso}, usage: ${currentUsage.count}/${config.usageLimit}`);
    
    return token;
  }

  /**
   * Delete a token
   */
  async deleteToken(token) {
    try {
      const sso = token.split('sso=')[1].split(';')[0];
      const pools = await this.getTokenPools();
      const status = await this.getTokenStatus();
      
      // Remove from all model pools
      for (const model of Object.keys(pools)) {
        pools[model] = pools[model].filter(entry => entry.token !== token);
      }
      
      // Remove from status
      if (status[sso]) {
        delete status[sso];
      }
      
      await this.saveTokenPools(pools);
      await this.saveTokenStatus(status);
      
      this.logger.info(`Token deleted successfully: ${sso}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete token:', error);
      return false;
    }
  }

  /**
   * Get all tokens
   */
  async getAllTokens() {
    try {
      const pools = await this.getTokenPools();
      const allTokens = new Set();

      for (const modelTokens of Object.values(pools)) {
        for (const entry of modelTokens) {
          allTokens.add(entry.token);
        }
      }

      return Array.from(allTokens);
    } catch (error) {
      this.logger.error('Failed to get all tokens:', error);
      return [];
    }
  }

  /**
   * 清理重复的 token
   */
  async cleanupDuplicateTokens() {
    try {
      const pools = await this.getTokenPools();
      let cleaned = false;

      for (const model of Object.keys(pools)) {
        if (!pools[model]) continue;

        const uniqueTokens = new Map();
        const cleanedTokens = [];

        for (const entry of pools[model]) {
          if (!uniqueTokens.has(entry.token)) {
            uniqueTokens.set(entry.token, true);
            cleanedTokens.push(entry);
          } else {
            this.logger.info(`Removing duplicate token for model ${model}: ${entry.token.substring(0, 20)}...`);
            cleaned = true;
          }
        }

        pools[model] = cleanedTokens;
      }

      if (cleaned) {
        await this.saveTokenPools(pools);
        this.logger.info('Duplicate tokens cleaned up successfully');
      }

      return cleaned;
    } catch (error) {
      this.logger.error('Failed to cleanup duplicate tokens:', error);
      return false;
    }
  }
}
