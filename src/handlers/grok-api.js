/**
 * Grok API Handler for Cloudflare Workers
 * Handles OpenAI-compatible API requests and proxies them to Grok
 */
export class GrokApiHandler {
  constructor(env, logger, tokenManager, config, httpClient) {
    this.env = env;
    this.logger = logger;
    this.tokenManager = tokenManager;
    this.config = config;
    this.httpClient = httpClient;

    this.baseUrl = 'https://grok.com';
    this.modelMapping = config.supportedModels;
  }

  async handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/v1/chat/completions') {
      return await this.handleChatCompletions(request);
    } else if (path === '/v1/models') {
      return await this.handleModels(request);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }

  async handleModels(request) {
    const models = Object.keys(this.modelMapping).map(id => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'grok'
    }));

    return new Response(JSON.stringify({
      object: 'list',
      data: models
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleChatCompletions(request) {
    try {
      const body = await request.json();
      const { model, messages, stream = false } = body;

      // Validate model
      if (!this.modelMapping[model]) {
        return new Response(JSON.stringify({
          error: { message: `Model ${model} not supported`, type: 'invalid_request_error' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Get token for this model
      const token = await this.tokenManager.getNextTokenForModel(model);
      if (!token) {
        return new Response(JSON.stringify({
          error: { message: 'No available tokens for this model', type: 'insufficient_quota' }
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      // Prepare Grok request
      const grokRequest = await this.prepareGrokRequest(body, token);
      
      // Make request to Grok
      const response = await this.makeGrokRequest(grokRequest, token);
      
      if (stream) {
        return this.handleStreamResponse(response, model);
      } else {
        return this.handleNonStreamResponse(response, model);
      }
    } catch (error) {
      this.logger.error('Chat completions error:', error);
      return new Response(JSON.stringify({
        error: { message: error.message, type: 'internal_error' }
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  async prepareGrokRequest(request, token) {
    const { model, messages } = request;
    const normalizedModel = this.modelMapping[model];
    
    // Process messages
    let processedMessages = '';
    let lastRole = null;
    let lastContent = '';
    
    for (const message of messages) {
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const content = this.processMessageContent(message.content);
      
      if (role === lastRole && content) {
        lastContent += '\n' + content;
        processedMessages = processedMessages.substring(0, processedMessages.lastIndexOf(`${role.toUpperCase()}: `)) + 
                           `${role.toUpperCase()}: ${lastContent}\n`;
      } else {
        processedMessages += `${role.toUpperCase()}: ${content || '[图片]'}\n`;
        lastContent = content;
        lastRole = role;
      }
    }

    // Determine tool settings based on model
    const isImageGen = model.includes('imageGen');
    const isSearch = model.includes('search') || model.includes('deepsearch');
    const isReasoning = model.includes('reasoning');
    
    let deepsearchPreset = '';
    if (model === 'grok-3-deepsearch') {
      deepsearchPreset = 'default';
    } else if (model === 'grok-3-deepersearch') {
      deepsearchPreset = 'deeper';
    }

    return {
      temporary: this.config.isTempConversation,
      modelName: normalizedModel,
      message: processedMessages.trim(),
      fileAttachments: [],
      imageAttachments: [],
      disableSearch: false,
      enableImageGeneration: true,
      returnImageBytes: false,
      returnRawGrokInXaiRequest: false,
      enableImageStreaming: false,
      imageGenerationCount: 1,
      forceConcise: false,
      toolOverrides: {
        imageGen: isImageGen,
        webSearch: isSearch,
        xSearch: isSearch,
        xMediaSearch: isSearch,
        trendsSearch: isSearch,
        xPostAnalyze: isSearch
      },
      enableSideBySide: true,
      sendFinalMetadata: true,
      customPersonality: '',
      deepsearchPreset,
      isReasoning,
      disableTextFollowUps: true
    };
  }

  processMessageContent(content) {
    if (typeof content === 'string') {
      // Remove <think> tags and base64 images
      return content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/!\[image\]\(data:.*?base64,.*?\)/g, '[图片]')
        .trim();
    } else if (Array.isArray(content)) {
      let textContent = '';
      for (const item of content) {
        if (item.type === 'text') {
          textContent += (textContent ? '\n' : '') + item.text;
        } else if (item.type === 'image_url') {
          textContent += (textContent ? '\n' : '') + '[图片]';
        }
      }
      return textContent;
    }
    return '';
  }

  async makeGrokRequest(requestData, token) {
    const headers = {
      ...this.config.defaultHeaders,
      'Cookie': `${token};${this.config.cfClearance || ''}`
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async handleNonStreamResponse(response, model) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            const result = this.processGrokResponse(data, model);
            if (result.token) {
              fullResponse += result.token;
            }
            if (result.imageUrl) {
              fullResponse += await this.handleImageResponse(result.imageUrl);
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }

      return new Response(JSON.stringify({
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: fullResponse
          },
          finish_reason: 'stop'
        }],
        usage: null
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.logger.error('Non-stream response error:', error);
      throw error;
    }
  }

  async handleStreamResponse(response, model) {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const data = JSON.parse(line);
                const result = this.processGrokResponse(data, model);
                
                if (result.token) {
                  const sseData = {
                    id: `chatcmpl-${crypto.randomUUID()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{
                      index: 0,
                      delta: { content: result.token }
                    }]
                  };
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));
                }
                
                if (result.imageUrl) {
                  const imageContent = await this.handleImageResponse(result.imageUrl);
                  const sseData = {
                    id: `chatcmpl-${crypto.randomUUID()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{
                      index: 0,
                      delta: { content: imageContent }
                    }]
                  };
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }

  processGrokResponse(data, model) {
    const result = { token: null, imageUrl: null };
    
    if (data.error) {
      this.logger.error('Grok API error:', data.error);
      return result;
    }
    
    const response = data.result?.response;
    if (!response) return result;
    
    // Handle different model types
    if (model === 'grok-3') {
      result.token = response.token;
    } else if (model.includes('search')) {
      if (response.webSearchResults && this.config.showSearchResults) {
        result.token = `\r\n<think>${this.organizeSearchResults(response.webSearchResults)}</think>\r\n`;
      } else {
        result.token = response.token;
      }
    } else if (model.includes('reasoning')) {
      if (response.isThinking && !this.config.showThinking) {
        return result;
      }
      result.token = response.token;
    } else if (model.includes('imageGen')) {
      if (response.cachedImageGenerationResponse) {
        result.imageUrl = response.cachedImageGenerationResponse.imageUrl;
      } else {
        result.token = response.token;
      }
    } else {
      result.token = response.token;
    }
    
    return result;
  }

  organizeSearchResults(searchResults) {
    if (!searchResults || !searchResults.results) return '';
    
    const results = searchResults.results;
    const formattedResults = [];
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const title = result.title || '未知标题';
      const url = result.url || '#';
      const preview = result.preview || '无预览内容';
      
      formattedResults.push(
        `\r\n<details><summary>资料[${i}]: ${title}</summary>\r\n${preview}\r\n\n[Link](${url})\r\n</details>`
      );
    }
    
    return formattedResults.join('\n\n');
  }

  async handleImageResponse(imageUrl) {
    try {
      const response = await fetch(`https://assets.grok.com/${imageUrl}`);
      if (!response.ok) {
        return '生图失败，无法获取图片';
      }
      
      const imageBuffer = await response.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      return `![image](data:${contentType};base64,${base64Image})`;
    } catch (error) {
      this.logger.error('Image handling error:', error);
      return '生图失败，处理图片时出错';
    }
  }
}
