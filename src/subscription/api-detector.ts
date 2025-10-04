/**
 * API 检测器
 *
 * 自动分析网络请求，识别订阅API模式
 */

import { HttpApiConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface NetworkRequest {
  url: string;
  method: string;
  status?: number;
  resourceType?: string;
  responseBody?: any;
  requestHeaders?: Record<string, string>;
}

export interface DetectionResult {
  detected: boolean;
  config?: HttpApiConfig;
  confidence: number; // 0-1，置信度
  reason?: string;
}

/**
 * API 检测器
 * 分析网络请求，自动识别订阅API的认证方式和数据结构
 */
export class ApiDetector {
  /**
   * 检测订阅API配置
   */
  detect(requests: NetworkRequest[], localStorage?: Record<string, string>): DetectionResult {
    logger.info('开始检测订阅API...');

    // 1. 过滤可能的订阅API请求
    const candidates = this.filterSubscriptionRequests(requests);

    if (candidates.length === 0) {
      return {
        detected: false,
        confidence: 0,
        reason: '未找到订阅相关的API请求'
      };
    }

    logger.info(`找到 ${candidates.length} 个候选API请求`);

    // 2. 分析每个候选请求
    for (const request of candidates) {
      const result = this.analyzeRequest(request, localStorage);
      if (result.detected && result.config) {
        logger.info(`✓ 成功检测到API配置: ${request.url}`);
        return result;
      }
    }

    return {
      detected: false,
      confidence: 0,
      reason: '未能从候选请求中提取有效配置'
    };
  }

  /**
   * 过滤订阅相关的请求
   */
  private filterSubscriptionRequests(requests: NetworkRequest[]): NetworkRequest[] {
    return requests.filter(req => {
      const url = req.url.toLowerCase();

      // 必须是 XHR/fetch 请求
      if (req.resourceType && !['xhr', 'fetch'].includes(req.resourceType)) {
        return false;
      }

      // 必须是 GET/POST
      if (!['GET', 'POST'].includes(req.method)) {
        return false;
      }

      // 必须成功
      if (req.status && req.status !== 200) {
        return false;
      }

      // URL包含订阅相关关键词
      const keywords = ['subscribe', 'sub', 'token', 'user/get'];
      return keywords.some(keyword => url.includes(keyword));
    });
  }

  /**
   * 分析单个请求
   */
  private analyzeRequest(request: NetworkRequest, localStorage?: Record<string, string>): DetectionResult {
    if (!request.responseBody) {
      return { detected: false, confidence: 0 };
    }

    try {
      const data = typeof request.responseBody === 'string'
        ? JSON.parse(request.responseBody)
        : request.responseBody;

      // 尝试找到订阅地址或token
      const subscribeUrlField = this.findSubscriptionUrlField(data);
      const tokenField = this.findTokenField(data);

      if (!subscribeUrlField && !tokenField) {
        return { detected: false, confidence: 0 };
      }

      // 检测认证方式
      const authSource = this.detectAuthSource(request, localStorage);
      const authField = authSource === 'localStorage' ? this.detectLocalStorageAuthField(localStorage) : undefined;

      const config: HttpApiConfig = {
        url: request.url,
        method: request.method as 'GET' | 'POST',
        authSource,
        authField,
      };

      // 设置订阅地址提取方式
      // 同时保存 subscribeUrlField 和 tokenField（如果都存在）
      // 这样可以支持 URL 组件模式重建订阅地址
      if (subscribeUrlField) {
        config.subscribeUrlField = subscribeUrlField;
      }

      if (tokenField) {
        config.tokenField = tokenField;
        // 尝试推断URL模式
        config.subscribeUrlPattern = this.inferUrlPattern(data, tokenField);
      }

      return {
        detected: true,
        config,
        confidence: this.calculateConfidence(config, data),
      };

    } catch (error) {
      logger.warn('分析请求失败', error);
      return { detected: false, confidence: 0 };
    }
  }

  /**
   * 查找订阅地址字段
   */
  private findSubscriptionUrlField(data: any, path = ''): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    for (const key in data) {
      const value = data[key];
      const currentPath = path ? `${path}.${key}` : key;

      // 检查是否是订阅URL
      if (typeof value === 'string') {
        if (this.isSubscriptionUrl(value)) {
          return currentPath;
        }
      } else if (typeof value === 'object') {
        const result = this.findSubscriptionUrlField(value, currentPath);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * 查找token字段
   */
  private findTokenField(data: any, path = ''): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    for (const key in data) {
      const value = data[key];
      const currentPath = path ? `${path}.${key}` : key;

      // token字段特征
      if (key.toLowerCase() === 'token' && typeof value === 'string' && value.length > 10) {
        return currentPath;
      }

      if (typeof value === 'object') {
        const result = this.findTokenField(value, currentPath);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * 判断是否是订阅URL
   */
  private isSubscriptionUrl(url: string): boolean {
    if (!url.startsWith('http')) return false;

    // 订阅URL特征
    const patterns = [
      /\/sub\//i,
      /\/subscribe/i,
      /token=/i,
      /\/(api|client)\/v\d+\//,
    ];

    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * 检测认证来源
   */
  private detectAuthSource(request: NetworkRequest, localStorage?: Record<string, string>): 'cookie' | 'localStorage' | 'both' {
    const hasCookie = request.requestHeaders?.['Cookie'] || request.requestHeaders?.['cookie'];

    // 优先检查 localStorage 中是否有认证字段
    // 不依赖 Authorization header 的存在，因为有些 API 不在 header 中传递 token
    const localStorageAuthField = this.detectLocalStorageAuthField(localStorage);

    // 如果 localStorage 中有认证 token，优先判定为 localStorage 认证
    if (localStorageAuthField) {
      // 如果同时有 Cookie，标记为 both（某些站点同时使用两者）
      return hasCookie ? 'both' : 'localStorage';
    }

    // 如果 localStorage 中没有 token，默认返回 cookie
    return 'cookie';
  }

  /**
   * 检测localStorage中的认证字段
   */
  private detectLocalStorageAuthField(localStorage?: Record<string, string>): string | null {
    if (!localStorage) return null;

    // 常见的认证字段（优先级从高到低）
    const candidates = ['app-user', 'user', 'auth', 'token', 'info', 'userInfo', 'user-info'];

    for (const key of candidates) {
      if (localStorage[key]) {
        try {
          const parsed = JSON.parse(localStorage[key]);
          // 检测多种常见的token字段名
          if (parsed.token || parsed.Token || parsed.auth_data || parsed.user?.token) {
            // 优先使用 Token（大写），如果不存在则使用 token（小写）
            const tokenField = parsed.Token ? 'Token' : 'token';
            return `${key}.${tokenField}`;
          }
        } catch {
          // 不是JSON，可能直接就是token字符串
          if (localStorage[key].length > 20) {
            return key;
          }
        }
      }
    }

    return null;
  }

  /**
   * 推断订阅URL模式
   */
  private inferUrlPattern(data: any, tokenField: string): string | undefined {
    // 尝试在响应中找到示例URL
    const exampleUrl = this.findExampleUrl(data);
    if (exampleUrl) {
      // 替换token部分为占位符
      const tokenValue = this.extractFieldValue(data, tokenField);
      if (tokenValue && exampleUrl.includes(tokenValue)) {
        return exampleUrl.replace(tokenValue, '{token}');
      }
    }

    return undefined;
  }

  /**
   * 查找示例URL
   */
  private findExampleUrl(data: any): string | null {
    if (!data || typeof data !== 'object') return null;

    for (const key in data) {
      const value = data[key];
      if (typeof value === 'string' && this.isSubscriptionUrl(value)) {
        return value;
      }
      if (typeof value === 'object') {
        const result = this.findExampleUrl(value);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * 提取字段值
   */
  private extractFieldValue(data: any, fieldPath: string): string | null {
    const keys = fieldPath.split('.');
    let value = data;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return typeof value === 'string' ? value : null;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(config: HttpApiConfig, data: any): number {
    let score = 0.5; // 基础分

    // 有明确的订阅地址字段
    if (config.subscribeUrlField) {
      score += 0.3;
    }

    // 有token和URL模式
    if (config.tokenField && config.subscribeUrlPattern) {
      score += 0.2;
    }

    // 识别到认证方式
    if (config.authSource) {
      score += 0.1;
    }

    // 识别到localStorage认证字段
    if (config.authField) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }
}
