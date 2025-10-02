import { MCPClient } from './client.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, MCPNetworkRequest } from '../types/index.js';

/**
 * 网络请求过滤器配置
 */
export interface RequestFilter {
  /** URL 模式（支持通配符） */
  urlPattern?: string;
  /** HTTP 方法 */
  method?: string;
  /** 资源类型 */
  resourceType?: string;
}

/**
 * 网络监听器
 * 负责监听和拦截页面的网络请求
 */
export class NetworkListener {
  private mcpClient: MCPClient;
  private capturedRequests: MCPNetworkRequest[] = [];

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * 列出所有网络请求
   */
  async listRequests(
    pageIdx?: number,
    pageSize?: number,
    resourceTypes?: string[]
  ): Promise<MCPNetworkRequest[]> {
    try {
      const params: any = {};

      if (pageIdx !== undefined) params.pageIdx = pageIdx;
      if (pageSize !== undefined) params.pageSize = pageSize;
      if (resourceTypes && resourceTypes.length > 0) {
        params.resourceTypes = resourceTypes;
      }

      const result = await this.mcpClient.callTool(
        'list_network_requests',
        params
      );

      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find((item: any) => item.type === 'text');
        if (textContent) {
          try {
            const parsed = JSON.parse(textContent.text);
            const requests = parsed.requests || [];

            // 缓存请求
            this.capturedRequests = requests;

            logger.debug(`捕获到 ${requests.length} 个网络请求`);
            return requests;
          } catch (error) {
            logger.error('解析网络请求响应失败', error);
            return [];
          }
        }
      }

      return [];
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.NETWORK_CAPTURE_FAILED,
        `列出网络请求失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 根据 URL 获取特定请求
   */
  async getRequest(url: string): Promise<MCPNetworkRequest | null> {
    try {
      const result = await this.mcpClient.callTool(
        'get_network_request',
        { url }
      );

      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find((item: any) => item.type === 'text');
        if (textContent) {
          try {
            const parsed = JSON.parse(textContent.text);
            return parsed.request || null;
          } catch {
            return null;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`获取请求失败: ${url}`, error);
      return null;
    }
  }

  /**
   * 过滤请求
   */
  filterRequests(filter: RequestFilter): MCPNetworkRequest[] {
    let filtered = [...this.capturedRequests];

    if (filter.urlPattern) {
      const pattern = this.convertWildcardToRegex(filter.urlPattern);
      filtered = filtered.filter((req) => pattern.test(req.url));
    }

    if (filter.method) {
      filtered = filtered.filter(
        (req) => req.method.toUpperCase() === filter.method!.toUpperCase()
      );
    }

    if (filter.resourceType) {
      filtered = filtered.filter((req) => req.resourceType === filter.resourceType);
    }

    return filtered;
  }

  /**
   * 查找包含指定关键词的请求
   */
  findRequestsByKeyword(keyword: string, searchIn: 'url' | 'headers' | 'body' = 'url'): MCPNetworkRequest[] {
    return this.capturedRequests.filter((req) => {
      switch (searchIn) {
        case 'url':
          return req.url.includes(keyword);

        case 'headers':
          if (req.requestHeaders) {
            return Object.values(req.requestHeaders).some((v) =>
              String(v).includes(keyword)
            );
          }
          return false;

        case 'body':
          if (req.responseBody) {
            const bodyStr = typeof req.responseBody === 'string'
              ? req.responseBody
              : JSON.stringify(req.responseBody);
            return bodyStr.includes(keyword);
          }
          return false;

        default:
          return false;
      }
    });
  }

  /**
   * 查找 API 请求（JSON 响应）
   */
  findApiRequests(): MCPNetworkRequest[] {
    return this.capturedRequests.filter((req) => {
      // 检查 Content-Type
      if (req.responseHeaders) {
        const contentType = req.responseHeaders['content-type'] || req.responseHeaders['Content-Type'];
        if (contentType && contentType.includes('application/json')) {
          return true;
        }
      }

      // 检查 URL 特征
      const apiPatterns = ['/api/', '/v1/', '/v2/', '/graphql', '.json'];
      return apiPatterns.some((pattern) => req.url.includes(pattern));
    });
  }

  /**
   * 获取所有捕获的请求
   */
  getCapturedRequests(): MCPNetworkRequest[] {
    return this.capturedRequests;
  }

  /**
   * 清空捕获的请求
   */
  clearCapturedRequests(): void {
    this.capturedRequests = [];
    logger.debug('已清空捕获的网络请求');
  }

  /**
   * 将通配符模式转换为正则表达式
   */
  private convertWildcardToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
      .replace(/\*/g, '.*') // * -> .*
      .replace(/\?/g, '.'); // ? -> .

    return new RegExp(`^${escaped}$`, 'i');
  }
}
