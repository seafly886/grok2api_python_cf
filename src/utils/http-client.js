/**
 * HTTP Client utilities for Cloudflare Workers
 */
export class HttpClient {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Make HTTP request with retry logic
   */
  async request(url, options = {}, retries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.logger.debug(`Making request to ${url}, attempt ${attempt + 1}`);
        
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.config.defaultHeaders,
            ...options.headers
          }
        });

        if (response.ok) {
          return response;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        lastError = error;
        this.logger.warning(`Request attempt ${attempt + 1} failed: ${error.message}`);
        
        if (attempt < retries) {
          const delay = this.config.retryConfig.retryTime * (attempt + 1);
          this.logger.debug(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Make POST request with JSON body
   */
  async postJson(url, data, headers = {}) {
    return this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    });
  }

  /**
   * Make GET request
   */
  async get(url, headers = {}) {
    return this.request(url, {
      method: 'GET',
      headers
    });
  }

  /**
   * Upload file to Grok
   */
  async uploadFile(fileData, token) {
    const url = 'https://grok.com/rest/app-chat/upload-file';
    
    return this.request(url, {
      method: 'POST',
      headers: {
        'Cookie': `${token};${this.config.cfClearance}`
      },
      body: JSON.stringify(fileData)
    });
  }

  /**
   * Download image from Grok assets
   */
  async downloadImage(imageUrl, token) {
    const url = `https://assets.grok.com/${imageUrl}`;
    
    return this.request(url, {
      method: 'GET',
      headers: {
        'Cookie': `${token};${this.config.cfClearance}`
      }
    });
  }

  /**
   * Upload image to external image hosting service
   */
  async uploadToImageHost(imageBuffer, contentType = 'image/jpeg') {
    if (this.config.picgoKey) {
      return this.uploadToPicgo(imageBuffer, contentType);
    } else if (this.config.tumyKey) {
      return this.uploadToTumy(imageBuffer, contentType);
    } else {
      // Return base64 data URL
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      return `data:${contentType};base64,${base64}`;
    }
  }

  /**
   * Upload to Picgo image hosting
   */
  async uploadToPicgo(imageBuffer, contentType) {
    try {
      const formData = new FormData();
      formData.append('source', new Blob([imageBuffer], { type: contentType }), 'image.jpg');

      const response = await fetch('https://www.picgo.net/api/1/upload', {
        method: 'POST',
        headers: {
          'X-API-Key': this.config.picgoKey
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Picgo upload failed: ${response.status}`);
      }

      const result = await response.json();
      return `![image](${result.image.url})`;
    } catch (error) {
      this.logger.error('Picgo upload error:', error);
      return '生图失败，请查看PICGO图床密钥是否设置正确';
    }
  }

  /**
   * Upload to Tumy image hosting
   */
  async uploadToTumy(imageBuffer, contentType) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([imageBuffer], { type: contentType }), 'image.jpg');

      const response = await fetch('https://tu.my/api/v1/upload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.config.tumyKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Tumy upload failed: ${response.status}`);
      }

      const result = await response.json();
      return `![image](${result.data.links.url})`;
    } catch (error) {
      this.logger.error('Tumy upload error:', error);
      return '生图失败，请查看TUMY图床密钥是否设置正确';
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse SSE stream
   */
  async *parseSSEStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);
            yield data;
          } catch (e) {
            // Skip invalid JSON lines
            this.logger.debug(`Skipping invalid JSON line: ${trimmed}`);
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          yield data;
        } catch (e) {
          this.logger.debug(`Skipping invalid JSON in buffer: ${buffer}`);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create SSE response stream
   */
  createSSEStream(generator) {
    const encoder = new TextEncoder();
    
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const data of generator) {
            const sseData = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Validate and extract SSO token
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
        const ssoMatch = token.match(/sso=([^;]+)/);
        if (!ssoMatch) {
          throw new Error('No SSO token found in cookie string');
        }
        return ssoMatch[1];
      }

      // Fallback: use first 20 characters as identifier
      return token.substring(0, 20);
    } catch (error) {
      throw new Error(`Invalid token format: ${error.message}`);
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format error response
   */
  formatErrorResponse(error, status = 500) {
    return new Response(JSON.stringify({
      error: {
        message: error.message,
        type: 'internal_error',
        code: status
      }
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Format success response
   */
  formatSuccessResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
