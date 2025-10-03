import { AIProvider, AIProviderConfig, AIConfig } from '../types/index.js';

/**
 * 预定义的 AI 提供商配置
 */
export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  deepseek: {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
  },
  openrouter: {
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresApiKey: true,
  },
  custom: {
    name: '自定义提供商',
    apiUrl: '',
    defaultModel: '',
    requiresApiKey: true,
  },
};

/**
 * AI 配置管理器
 */
export class AIConfigManager {
  /**
   * 获取提供商配置
   */
  static getProviderConfig(provider: AIProvider): AIProviderConfig {
    return AI_PROVIDERS[provider];
  }

  /**
   * 获取所有可用的提供商
   */
  static getAvailableProviders(): Array<{ value: AIProvider; name: string }> {
    return Object.entries(AI_PROVIDERS).map(([value, config]) => ({
      value: value as AIProvider,
      name: config.name,
    }));
  }

  /**
   * 构建完整的 API URL
   */
  static buildApiUrl(config: AIConfig): string {
    if (config.provider === 'custom' && config.customApiUrl) {
      return config.customApiUrl;
    }

    const providerConfig = AI_PROVIDERS[config.provider];
    return providerConfig.apiUrl;
  }

  /**
   * 获取模型名称
   */
  static getModel(config: AIConfig): string {
    if (config.model) {
      return config.model;
    }

    const providerConfig = AI_PROVIDERS[config.provider];
    return providerConfig.defaultModel;
  }

  /**
   * 验证 AI 配置
   */
  static validateConfig(config: AIConfig): { valid: boolean; error?: string } {
    if (!config.enabled) {
      return { valid: true };
    }

    const providerConfig = AI_PROVIDERS[config.provider];

    // 验证 API 密钥
    if (providerConfig.requiresApiKey && !config.apiKey) {
      return { valid: false, error: 'API 密钥不能为空' };
    }

    // 验证自定义提供商的 API URL
    if (config.provider === 'custom' && !config.customApiUrl) {
      return { valid: false, error: '自定义提供商需要提供 API 地址' };
    }

    return { valid: true };
  }

  /**
   * 创建默认 AI 配置
   */
  static createDefaultConfig(provider: AIProvider = 'deepseek'): AIConfig {
    return {
      enabled: false,
      provider,
      apiKey: '',
      model: AI_PROVIDERS[provider].defaultModel,
    };
  }

  /**
   * 格式化配置用于显示
   */
  static formatConfigForDisplay(config: AIConfig): string {
    if (!config.enabled) {
      return '未启用';
    }

    const providerConfig = AI_PROVIDERS[config.provider];
    const model = this.getModel(config);
    const apiKey = config.apiKey ? `${config.apiKey.substring(0, 8)}...` : '未设置';

    return `
提供商: ${providerConfig.name}
模型: ${model}
API 密钥: ${apiKey}
状态: ${config.enabled ? '已启用' : '未启用'}
    `.trim();
  }
}
