import { NetworkListener } from '../mcp/network.js';
import { TokenExtractor } from '../mcp/token.js';
import { PageManager } from '../mcp/page.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, SiteConfig, APIPattern } from '../types/index.js';

/**
 * API 模式订阅抓取器
 * 通过监听 API 请求来获取订阅地址
 */
export class ApiSubscriptionExtractor {
  private networkListener: NetworkListener;
  private tokenExtractor: TokenExtractor;
  private pageManager: PageManager;

  constructor(
    networkListener: NetworkListener,
    tokenExtractor: TokenExtractor,
    pageManager: PageManager
  ) {
    this.networkListener = networkListener;
    this.tokenExtractor = tokenExtractor;
    this.pageManager = pageManager;
  }

  /**
   * 通过 API 模式提取订阅地址
   */
  async extract(siteConfig: SiteConfig): Promise<string> {
    try {
      logger.info(`[API 模式] 开始提取订阅地址: ${siteConfig.name}`);

      // 导航到站点页面
      await this.pageManager.navigateTo(siteConfig.url);

      // 等待页面加载
      await this.delay(2000);

      // 列出所有网络请求
      await this.networkListener.listRequests();

      // 1. 通过配置的 API 模式匹配
      if (siteConfig.selector?.api) {
        const url = await this.extractByPattern(siteConfig.selector.api);
        if (url) {
          logger.info(`✓ 通过 API 模式找到订阅地址: ${url}`);
          return url;
        }
      }

      // 2. 通过常见的订阅 API 特征查找
      const url = await this.extractByCommonPatterns();
      if (url) {
        logger.info(`✓ 通过常见模式找到订阅地址: ${url}`);
        return url;
      }

      throw new AutoSubError(
        ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
        '未能通过 API 模式找到订阅地址'
      );
    } catch (error) {
      if (error instanceof AutoSubError) {
        throw error;
      }
      throw new AutoSubError(
        ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
        `API 模式提取失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 通过配置的 API 模式提取
   */
  private async extractByPattern(apiPattern: APIPattern): Promise<string | null> {
    try {
      // 查找匹配的请求
      const requests = this.networkListener.filterRequests({
        urlPattern: apiPattern.urlPattern,
        method: apiPattern.method,
      });

      if (requests.length === 0) {
        logger.debug(`API 模式未匹配到请求: ${apiPattern.urlPattern}`);
        return null;
      }

      logger.debug(`API 模式匹配到 ${requests.length} 个请求`);

      // 从响应中提取订阅地址
      for (const request of requests) {
        if (!request.responseBody) continue;

        try {
          const body =
            typeof request.responseBody === 'string'
              ? JSON.parse(request.responseBody)
              : request.responseBody;

          // 根据字段路径提取
          const url = this.extractFieldFromObject(body, apiPattern.field);

          if (url && this.isValidSubscriptionUrl(url)) {
            return url;
          }
        } catch (error) {
          logger.debug('解析响应失败', error);
        }
      }

      return null;
    } catch (error) {
      logger.error('通过 API 模式提取失败', error);
      return null;
    }
  }

  /**
   * 通过常见模式提取订阅地址
   */
  private async extractByCommonPatterns(): Promise<string | null> {
    // 常见的订阅 API URL 模式
    const patterns = [
      '**/subscription**',
      '**/sub**',
      '**/clash/**',
      '**/link**',
      '**/api/user/**',
      '**/api/v*/user/**',
    ];

    for (const pattern of patterns) {
      const requests = this.networkListener.filterRequests({
        urlPattern: pattern,
      });

      for (const request of requests) {
        if (!request.responseBody) continue;

        try {
          const body =
            typeof request.responseBody === 'string'
              ? JSON.parse(request.responseBody)
              : request.responseBody;

          // 常见的订阅字段名
          const fields = [
            'subscription_url',
            'subscriptionUrl',
            'sub_url',
            'subUrl',
            'clash_url',
            'clashUrl',
            'link',
            'url',
          ];

          for (const field of fields) {
            const url = this.extractFieldFromObject(body, field);
            if (url && this.isValidSubscriptionUrl(url)) {
              return url;
            }
          }
        } catch (error) {
          // 忽略非 JSON 响应
        }
      }
    }

    return null;
  }

  /**
   * 从对象中提取字段值（支持嵌套路径）
   */
  private extractFieldFromObject(obj: any, fieldPath: string): string | null {
    const parts = fieldPath.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * 验证是否是有效的订阅 URL
   */
  private isValidSubscriptionUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      // 必须是 HTTP(S) 协议
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }

      // 常见的订阅 URL 特征
      const subscriptionKeywords = [
        'clash',
        'sub',
        'subscription',
        'v2ray',
        'vmess',
        'trojan',
        'shadowsocks',
        'ss',
        'ssr',
      ];

      const urlLower = url.toLowerCase();
      return subscriptionKeywords.some((keyword) => urlLower.includes(keyword));
    } catch {
      return false;
    }
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
