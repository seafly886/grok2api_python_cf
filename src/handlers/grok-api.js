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
      return await this.handleModels();
    } else if (path === '/v1/test') {
      return await this.handleTest();
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }

  async handleTest() {
    // 测试端点，用于调试
    const testResponse = {
      message: 'Grok API Handler Test',
      timestamp: new Date().toISOString(),
      config: {
        baseUrl: this.baseUrl,
        supportedModels: Object.keys(this.modelMapping),
        isTempConversation: this.config.isTempConversation,
        showThinking: this.config.showThinking,
        showSearchResults: this.config.showSearchResults
      }
    };

    return new Response(JSON.stringify(testResponse, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleModels() {
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
      this.logger.info('=== Chat Completions Request Started ===');

      const body = await request.json();
      const { model, messages, stream = false } = body;

      this.logger.info('Request details:', {
        model,
        messagesCount: messages?.length || 0,
        stream,
        firstMessage: messages?.[0]?.content?.substring(0, 100) || 'N/A'
      });

      // Validate model
      if (!this.modelMapping[model]) {
        this.logger.error('Unsupported model:', model);
        return new Response(JSON.stringify({
          error: { message: `Model ${model} not supported`, type: 'invalid_request_error' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Get token for this model
      this.logger.info('Getting token for model:', model);
      const token = await this.tokenManager.getNextTokenForModel(model);

      console.log('=== Token Check ===');
      console.log('Model:', model);
      console.log('Token found:', !!token);
      console.log('Token length:', token ? token.length : 0);
      console.log('Token preview:', token ? token.substring(0, 100) + '...' : 'N/A');

      if (!token) {
        console.error('❌ No available tokens for model:', model);
        this.logger.error('No available tokens for model:', model);
        return new Response(JSON.stringify({
          error: { message: 'No available tokens for this model', type: 'insufficient_quota' }
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      this.logger.info('Token obtained, preparing Grok request');

      // Prepare Grok request
      const grokRequest = await this.prepareGrokRequest(body, token);

      this.logger.info('Grok request prepared:', {
        modelName: grokRequest.modelName,
        messageLength: grokRequest.message?.length || 0,
        temporary: grokRequest.temporary
      });

      // Make request to Grok
      const response = await this.makeGrokRequest(grokRequest, token);

      this.logger.info('Grok response received, processing...');

      if (stream) {
        this.logger.info('Handling as stream response');
        return this.handleStreamResponse(response, model);
      } else {
        this.logger.info('Handling as non-stream response');
        return this.handleNonStreamResponse(response, model);
      }
    } catch (error) {
      this.logger.error('Chat completions error:', error);
      this.logger.error('Error stack:', error.stack);
      return new Response(JSON.stringify({
        error: { message: error.message, type: 'internal_error' }
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  async prepareGrokRequest(request) {
    const { model, messages } = request;
    const normalizedModel = this.modelMapping[model];

    this.logger.info('Preparing Grok request:', {
      originalModel: model,
      normalizedModel,
      messagesCount: messages?.length || 0
    });

    // Process messages
    let processedMessages = '';
    let lastRole = null;
    let lastContent = '';

    for (const message of messages) {
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const content = this.processMessageContent(message.content);

      this.logger.info(`Processing message:`, {
        role: message.role,
        normalizedRole: role,
        contentLength: content?.length || 0
      });

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

    // 记录详细的请求信息
    console.log('=== Making Grok Request ===');
    console.log('URL:', `${this.baseUrl}/api/chat`);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Request Data:', JSON.stringify(requestData, null, 2));
    console.log('Token (first 50 chars):', token.substring(0, 50) + '...');

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      });

      console.log('=== Grok Response Received ===');
      console.log('Status:', response.status, response.statusText);
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

      // 检查是否返回了 HTML（表示被重定向）
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        console.error('❌ Received HTML response instead of JSON - likely redirected to login page');
        const htmlContent = await response.text();
        console.log('HTML content (first 500 chars):', htmlContent.substring(0, 500));
        throw new Error('Received HTML response instead of JSON - token may be invalid or expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Grok API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 1000)
        });
        throw new Error(`Grok API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log('✅ Grok request successful');
      return response;
    } catch (error) {
      console.error('❌ Grok request failed:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  async handleNonStreamResponse(response, model) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      this.logger.info('Starting non-stream response processing');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 处理缓冲区中的完整行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

        for (const line of lines) {
          if (!line.trim()) continue;

          this.logger.info('Non-stream processing line:', line.substring(0, 200) + (line.length > 200 ? '...' : ''));

          try {
            // 尝试解析 JSON
            let data;
            if (line.startsWith('data: ')) {
              // 处理 SSE 格式
              const jsonStr = line.substring(6);
              if (jsonStr === '[DONE]') {
                this.logger.info('Non-stream received [DONE] marker');
                continue;
              }
              this.logger.info('Non-stream parsing SSE data:', jsonStr.substring(0, 100) + '...');
              data = JSON.parse(jsonStr);
            } else if (line.startsWith('{') || line.startsWith('[')) {
              // 直接 JSON 格式
              this.logger.info('Non-stream parsing direct JSON:', line.substring(0, 100) + '...');
              data = JSON.parse(line);
            } else {
              // 可能是纯文本响应
              this.logger.info('Non-stream treating as plain text:', line.substring(0, 100) + '...');
              data = { result: { response: { token: line } } };
            }

            this.logger.info('Non-stream parsed data structure:', {
              hasResult: !!data.result,
              hasError: !!data.error,
              hasResponse: !!data.result?.response,
              hasToken: !!data.result?.response?.token,
              dataKeys: Object.keys(data || {})
            });

            const result = this.processGrokResponse(data, model);
            if (result.token) {
              this.logger.info('Non-stream extracted token:', result.token.substring(0, 50) + '...');
              fullResponse += result.token;
            }
            if (result.imageUrl) {
              this.logger.info('Non-stream processing image URL:', result.imageUrl);
              fullResponse += await this.handleImageResponse(result.imageUrl);
            }
          } catch (e) {
            // 使用 console.error 直接输出，避免 Logger 序列化问题
            console.error('Non-stream error parsing line:', line.substring(0, 200), 'Error:', e.message);

            // 如果是 JSON 解析错误，尝试作为纯文本处理
            if (e.name === 'SyntaxError' && line.trim()) {
              try {
                this.logger.info('Non-stream treating failed JSON as plain text token');
                const textData = { result: { response: { token: line.trim() } } };
                const result = this.processGrokResponse(textData, model);

                if (result.token) {
                  this.logger.info('Non-stream extracted text token:', result.token.substring(0, 50) + '...');
                  fullResponse += result.token;
                }
              } catch (textError) {
                console.error('Non-stream failed to process as text:', textError.message);
              }
            }
          }
        }
      }

      this.logger.info('Non-stream response completed:', { responseLength: fullResponse.length });

      return new Response(JSON.stringify({
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: fullResponse || '抱歉，没有收到有效的响应内容。'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: fullResponse.length,
          total_tokens: fullResponse.length
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    } catch (error) {
      this.logger.error('Non-stream response error:', error);
      throw error;
    }
  }

  async handleStreamResponse(response, model) {
    const encoder = new TextEncoder();
    const self = this; // 保存 this 上下文

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = ''; // 添加缓冲区处理不完整的 JSON

          // 发送初始的流式响应头
          const initialData = {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              delta: { role: 'assistant' }
            }]
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // 记录原始响应数据
            console.log('Raw Grok chunk:', chunk.substring(0, 500) + (chunk.length > 500 ? '...' : ''));

            // 处理缓冲区中的完整行
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

            for (const line of lines) {
              if (!line.trim()) continue;

              self.logger.info('Processing line:', line.substring(0, 200) + (line.length > 200 ? '...' : ''));

              try {
                // 尝试解析 JSON
                let data;
                if (line.startsWith('data: ')) {
                  // 处理 SSE 格式
                  const jsonStr = line.substring(6);
                  if (jsonStr === '[DONE]') {
                    self.logger.info('Received [DONE] marker');
                    continue;
                  }
                  self.logger.info('Parsing SSE data:', jsonStr.substring(0, 100) + '...');
                  data = JSON.parse(jsonStr);
                } else if (line.startsWith('{') || line.startsWith('[')) {
                  // 直接 JSON 格式
                  self.logger.info('Parsing direct JSON:', line.substring(0, 100) + '...');
                  data = JSON.parse(line);
                } else {
                  // 可能是纯文本响应
                  self.logger.info('Treating as plain text:', line.substring(0, 100) + '...');
                  data = { result: { response: { token: line } } };
                }

                self.logger.info('Parsed data structure:', {
                  hasResult: !!data.result,
                  hasError: !!data.error,
                  hasResponse: !!data.result?.response,
                  hasToken: !!data.result?.response?.token,
                  dataKeys: Object.keys(data || {})
                });

                const result = self.processGrokResponse(data, model);

                if (result.token) {
                  self.logger.info('Extracted token:', result.token.substring(0, 50) + '...');
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
                  self.logger.info('Processing image URL:', result.imageUrl);
                  const imageContent = await self.handleImageResponse(result.imageUrl);
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
                // 使用 console.error 直接输出，避免 Logger 序列化问题
                console.error('Error parsing line:', line.substring(0, 200), 'Error:', e.message);

                // 如果是 JSON 解析错误，尝试作为纯文本处理
                if (e.name === 'SyntaxError' && line.trim()) {
                  try {
                    self.logger.info('Treating failed JSON as plain text token');
                    const textData = { result: { response: { token: line.trim() } } };
                    const result = self.processGrokResponse(textData, model);

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
                  } catch (textError) {
                    console.error('Failed to process as text:', textError.message);
                  }
                }
              }
            }
          }

          // 发送结束标记
          const finalData = {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          self.logger.error('Stream response error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  processGrokResponse(data, model) {
    const result = { token: null, imageUrl: null };

    // 详细日志记录
    this.logger.info('Processing Grok response:', {
      model,
      hasError: !!data.error,
      hasResult: !!data.result,
      dataKeys: Object.keys(data || {})
    });

    if (data.error) {
      this.logger.error('Grok API error:', data.error);
      result.token = `错误: ${data.error.message || JSON.stringify(data.error)}`;
      return result;
    }

    // 尝试多种可能的响应结构
    let response = data.result?.response || data.response || data;

    if (!response) {
      this.logger.warn('No response found in data:', data);
      return result;
    }

    this.logger.info('Response structure:', {
      hasToken: !!response.token,
      hasWebSearchResults: !!response.webSearchResults,
      hasImageGeneration: !!response.cachedImageGenerationResponse,
      isThinking: !!response.isThinking,
      responseKeys: Object.keys(response || {})
    });

    // Handle different model types with fallback
    try {
      if (model === 'grok-3' || model === 'grok-4') {
        result.token = response.token || response.text || response.content;
      } else if (model.includes('search')) {
        if (response.webSearchResults && this.config.showSearchResults) {
          result.token = `\r\n<think>${this.organizeSearchResults(response.webSearchResults)}</think>\r\n`;
        } else {
          result.token = response.token || response.text || response.content;
        }
      } else if (model.includes('reasoning')) {
        if (response.isThinking && !this.config.showThinking) {
          return result; // 跳过思考过程
        }
        result.token = response.token || response.text || response.content;
      } else if (model.includes('imageGen')) {
        if (response.cachedImageGenerationResponse) {
          result.imageUrl = response.cachedImageGenerationResponse.imageUrl;
        } else {
          result.token = response.token || response.text || response.content;
        }
      } else {
        // 通用处理
        result.token = response.token || response.text || response.content || response.message;
      }

      // 如果仍然没有内容，尝试直接使用数据
      if (!result.token && !result.imageUrl) {
        if (typeof data === 'string') {
          result.token = data;
        } else if (data.choices && data.choices[0]) {
          result.token = data.choices[0].delta?.content || data.choices[0].message?.content;
        }
      }

    } catch (error) {
      this.logger.error('Error processing response:', error);
      result.token = `处理响应时出错: ${error.message}`;
    }

    if (result.token || result.imageUrl) {
      this.logger.info('Successfully extracted content:', {
        hasToken: !!result.token,
        tokenLength: result.token?.length || 0,
        hasImageUrl: !!result.imageUrl
      });
    } else {
      this.logger.warn('No content extracted from response');
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
