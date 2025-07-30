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
   * Validate if token is a valid SSO token (including session tokens for web simulation)
   */
  isValidSSOToken(token) {
    try {
      // Handle tokens that start with sso=
      let actualToken = token;
      if (token.startsWith('sso=')) {
        actualToken = token.substring(4); // Remove 'sso=' prefix
      }

      // Accept JWT tokens (including session tokens for web simulation)
      if (actualToken.startsWith('eyJ')) {
        // Try to decode JWT to validate format
        const parts = actualToken.split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1]));
            // Accept both session tokens and other JWT tokens
            if (payload.session_id) {
              this.logger.info('Accepted session token for web simulation:', token.substring(0, 20));
              return true;
            }
            // Accept other JWT payloads as well
            this.logger.info('Accepted JWT token:', token.substring(0, 20));
            return true;
          } catch (e) {
            // If we can't decode, treat as invalid
            this.logger.info('Invalid JWT token format:', token.substring(0, 20));
            return false;
          }
        } else {
          this.logger.info('Invalid JWT structure:', token.substring(0, 20));
          return false;
        }
      }

      // Accept cookie format tokens that contain sso=
      if (token.includes('sso=')) {
        this.logger.info('Accepted SSO cookie token:', token.substring(0, 20));
        return true;
      }

      // Accept direct JWT tokens without sso= prefix
      if (token.startsWith('eyJ')) {
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            JSON.parse(atob(parts[1])); // Validate JWT format
            this.logger.info('Accepted direct JWT token:', token.substring(0, 20));
            return true;
          } catch (e) {
            this.logger.info('Invalid direct JWT format:', token.substring(0, 20));
            return false;
          }
        }
      }

      // Reject other formats
      this.logger.info('Unsupported token format:', token.substring(0, 20));
      return false;
    } catch (error) {
      this.logger.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Add token to the system
   */
  async addToken(tokenData) {
    try {
      const { type, token } = tokenData;

      // Validate token format
      if (!this.isValidSSOToken(token)) {
        this.logger.info('Invalid or unsupported token format rejected');
        return { success: false, error: 'INVALID_TOKEN_FORMAT' };
      }

      const sso = this.extractSSO(token);
      const pools = await this.getTokenPools();
      const status = await this.getTokenStatus();

      // Use a single pool for all tokens
      const poolName = 'default_pool';
      if (!pools[poolName]) {
        pools[poolName] = [];
      }

      // Check if token already exists
      if (pools[poolName].find(entry => entry.token === token)) {
        this.logger.info(`Token already exists: ${sso}`);
        return { success: false, error: 'TOKEN_ALREADY_EXISTS' };
      }

      pools[poolName].push({
        token,
        type,
        AddedTime: Date.now(),
        RequestCount: 0,
        StartCallTime: null,
      });

      // Initialize status for all models
      const modelConfig = type === 'super' ? this.modelSuperConfig : this.modelNormalConfig;
      if (!status[sso]) {
        status[sso] = {};
      }
      for (const model of Object.keys(modelConfig)) {
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
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to add token:', error);
      return { success: false, error: 'INTERNAL_ERROR', details: error.message };
    }
  }

  async addBatchTokens(type, tokens) {
    let added = 0;
    let skipped = 0;
    let invalidFormat = 0;

    for (const token of tokens) {
      if (token.trim() === '') continue;
      const result = await this.addToken({ type, token });
      if (result.success) {
        added++;
      } else {
        if (result.error === 'INVALID_TOKEN_FORMAT') {
          invalidFormat++;
        }
        skipped++;
      }
    }
    return { added, skipped, invalidFormat };
  }

  /**
   * Get next token for a model
   */
  async getNextTokenForModel(modelId, isReturn = false) {
    try {
      const normalizedModel = this.normalizeModelName(modelId);
      const pools = await this.getTokenPools();
      const config = await this.getConfig();
      const poolName = 'default_pool';

      if (!pools[poolName] || pools[poolName].length === 0) {
        return null;
      }
      
      if (isReturn) {
        return pools[poolName][0]?.token || null;
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
    const poolName = 'default_pool';
    const modelTokens = pools[poolName];
    if (!modelTokens || modelTokens.length === 0) return null;
    
    const tokenEntry = modelTokens[0];
    const token = tokenEntry.token;
    const sso = this.extractSSO(token);
    
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
    const poolName = 'default_pool';
    const modelTokens = pools[poolName];
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
    const sso = this.extractSSO(token);
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
   * Extract SSO value from token
   */
  extractSSO(token) {
    try {
      // Handle JWT tokens (like session tokens)
      if (token.startsWith('eyJ')) {
        // For JWT tokens, use the token itself as identifier (first 20 chars)
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

  /**
   * Delete a token
   */
  async deleteToken(token) {
    try {
      const sso = this.extractSSO(token);
      const pools = await this.getTokenPools();
      const status = await this.getTokenStatus();
      let tokenFound = false;

      // Remove from new structure (default_pool)
      const poolName = 'default_pool';
      if (pools[poolName]) {
        const originalLength = pools[poolName].length;
        pools[poolName] = pools[poolName].filter(entry => entry.token !== token);
        if (pools[poolName].length < originalLength) {
          tokenFound = true;
          this.logger.info(`Token removed from default_pool: ${sso}`);
        }
      }

      // Remove from old structure (individual model pools)
      for (const modelName of Object.keys(this.modelSuperConfig)) {
        if (pools[modelName]) {
          const originalLength = pools[modelName].length;
          pools[modelName] = pools[modelName].filter(entry => entry.token !== token);
          if (pools[modelName].length < originalLength) {
            tokenFound = true;
            this.logger.info(`Token removed from ${modelName} pool: ${sso}`);
          }
        }
      }

      // Also check for any other pools that might exist
      for (const poolKey of Object.keys(pools)) {
        if (poolKey !== 'default_pool' && !this.modelSuperConfig[poolKey]) {
          if (Array.isArray(pools[poolKey])) {
            const originalLength = pools[poolKey].length;
            pools[poolKey] = pools[poolKey].filter(entry => entry.token !== token);
            if (pools[poolKey].length < originalLength) {
              tokenFound = true;
              this.logger.info(`Token removed from ${poolKey} pool: ${sso}`);
            }
          }
        }
      }

      if (!tokenFound) {
        this.logger.info(`Token not found in any pool: ${sso}`);
        return false;
      }

      // Remove from status
      if (status[sso]) {
        delete status[sso];
        this.logger.info(`Token status removed: ${sso}`);
      }

      // Save changes
      const poolsSaved = await this.saveTokenPools(pools);
      const statusSaved = await this.saveTokenStatus(status);

      if (!poolsSaved || !statusSaved) {
        this.logger.error('Failed to save token pools or status');
        return false;
      }

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

  /**
   * Create a new session
   */
  async createSession(sessionToken) {
    try {
      // Sessions expire in 24 hours
      await this.kv.put(`session:${sessionToken}`, 'true', { expirationTtl: 86400 });
      this.logger.info('Session created:', sessionToken.substring(0, 8));
      return true;
    } catch (error) {
      this.logger.error('Failed to create session:', error);
      return false;
    }
  }

  /**
   * Check if a session is valid
   */
  async isValidSession(sessionToken) {
    try {
      const session = await this.kv.get(`session:${sessionToken}`);
      return session === 'true';
    } catch (error) {
      this.logger.error('Failed to validate session:', error);
      return false;
    }
  }
/**
   * Reset token usage counts
   */
  async resetTokenUsage() {
    try {
      const pools = await this.getTokenPools();
      const poolName = 'default_pool';
      if (pools[poolName]) {
        for (const token of pools[poolName]) {
          token.RequestCount = 0;
        }
        await this.saveTokenPools(pools);
        this.logger.info('Token usage reset successfully.');
      }
    } catch (error) {
      this.logger.error('Failed to reset token usage:', error);
    }
  }

  /**
   * Clean up invalid tokens (tokens with invalid format or structure)
   */
  async cleanupInvalidTokens() {
    try {
      const pools = await this.getTokenPools();
      const status = await this.getTokenStatus();
      let cleaned = false;

      // Clean up new structure (default_pool)
      const poolName = 'default_pool';
      if (pools[poolName]) {
        const validTokens = [];

        for (const tokenEntry of pools[poolName]) {
          if (this.isValidSSOToken(tokenEntry.token)) {
            validTokens.push(tokenEntry);
          } else {
            const sso = this.extractSSO(tokenEntry.token);
            this.logger.info(`Removing invalid token from default_pool: ${sso}`);

            // Remove from status as well
            if (status[sso]) {
              delete status[sso];
            }

            cleaned = true;
          }
        }

        pools[poolName] = validTokens;
      }

      // Clean up old structure (individual model pools)
      for (const modelName of Object.keys(this.modelSuperConfig)) {
        if (pools[modelName] && Array.isArray(pools[modelName])) {
          const validTokens = [];

          for (const tokenEntry of pools[modelName]) {
            if (this.isValidSSOToken(tokenEntry.token)) {
              validTokens.push(tokenEntry);
            } else {
              const sso = this.extractSSO(tokenEntry.token);
              this.logger.info(`Removing invalid token from ${modelName} pool: ${sso}`);

              // Remove from status as well
              if (status[sso]) {
                delete status[sso];
              }

              cleaned = true;
            }
          }

          pools[modelName] = validTokens;
        }
      }

      // Clean up any other pools that might exist
      for (const poolKey of Object.keys(pools)) {
        if (poolKey !== 'default_pool' && !this.modelSuperConfig[poolKey] && Array.isArray(pools[poolKey])) {
          const validTokens = [];

          for (const tokenEntry of pools[poolKey]) {
            if (this.isValidSSOToken(tokenEntry.token)) {
              validTokens.push(tokenEntry);
            } else {
              const sso = this.extractSSO(tokenEntry.token);
              this.logger.info(`Removing invalid token from ${poolKey} pool: ${sso}`);

              // Remove from status as well
              if (status[sso]) {
                delete status[sso];
              }

              cleaned = true;
            }
          }

          pools[poolKey] = validTokens;
        }
      }

      if (cleaned) {
        await this.saveTokenPools(pools);
        await this.saveTokenStatus(status);
        this.logger.info('Invalid tokens cleaned up successfully');
      }

      return cleaned;
    } catch (error) {
      this.logger.error('Failed to cleanup invalid tokens:', error);
      return false;
    }
  }
  
  /**
   * Mark a token as invalid
   */
  async markTokenAsInvalid(token) {
    try {
      const sso = this.extractSSO(token);
      const status = await this.getTokenStatus();
      
      // Mark all models for this token as invalid
      if (status[sso]) {
        for (const model in status[sso]) {
          status[sso][model].isValid = false;
          status[sso][model].invalidatedTime = Date.now();
        }
        await this.saveTokenStatus(status);
        this.logger.info(`Token marked as invalid: ${sso}`);
        return true;
      }
      
      this.logger.info(`Token not found in status: ${sso}`);
      return false;
    } catch (error) {
      this.logger.error('Failed to mark token as invalid:', error);
      return false;
    }
  }
}
