import axios from 'axios';
import { getConfigManager } from '../config/manager.js';
import { logger } from '../utils/logger.js';

/**
 * AI 服务接口
 */
export interface AIService {
  chat(prompt: string): Promise<string>;
}

/**
 * DeepSeek AI 服务实现
 */
class DeepSeekService implements AIService {
  constructor(
    private apiUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  async chat(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      );

      return response.data.choices?.[0]?.message?.content || '';
    } catch (error) {
      logger.error('AI 调用失败:', error);
      throw error;
    }
  }
}

/**
 * OpenRouter AI 服务实现
 */
class OpenRouterService implements AIService {
  constructor(
    private apiUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  async chat(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      );

      return response.data.choices?.[0]?.message?.content || '';
    } catch (error) {
      logger.error('AI 调用失败:', error);
      throw error;
    }
  }
}

/**
 * 获取 AI 服务实例
 * 如果 AI 未配置或未启用，返回 null
 */
export function getAIService(): AIService | null {
  try {
    const configManager = getConfigManager();
    const aiConfig = configManager.getAIConfig();

    if (!aiConfig || !aiConfig.enabled) {
      return null;
    }

    if (!aiConfig.apiKey) {
      logger.warn('AI 配置缺少 API Key');
      return null;
    }

    const apiUrl =
      aiConfig.provider === 'custom' && aiConfig.customApiUrl
        ? aiConfig.customApiUrl
        : aiConfig.provider === 'deepseek'
          ? 'https://api.deepseek.com'
          : 'https://openrouter.ai/api/v1';

    const model = aiConfig.model || (aiConfig.provider === 'deepseek' ? 'deepseek-chat' : 'anthropic/claude-3.5-sonnet');

    if (aiConfig.provider === 'deepseek' || aiConfig.provider === 'custom') {
      return new DeepSeekService(apiUrl, aiConfig.apiKey, model);
    } else if (aiConfig.provider === 'openrouter') {
      return new OpenRouterService(apiUrl, aiConfig.apiKey, model);
    }

    return null;
  } catch (error) {
    logger.debug('获取 AI 服务失败:', error);
    return null;
  }
}

export * from './ai-config.js';
export * from './deepseek-vision.js';
