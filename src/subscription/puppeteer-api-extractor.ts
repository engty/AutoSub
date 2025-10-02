import { PuppeteerBrowser } from '../puppeteer/browser.js';
import { PuppeteerNetworkListener, CapturedRequest } from '../puppeteer/network.js';
import { LoginDetector } from '../puppeteer/login-detector.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, SiteConfig, APIPattern } from '../types/index.js';

/**
 * Puppeteer 版本的 API 模式订阅抓取器
 */
export class PuppeteerApiExtractor {
  private browser: PuppeteerBrowser;
  private networkListener: PuppeteerNetworkListener;
  private loginDetector: LoginDetector;

  constructor(browser: PuppeteerBrowser) {
    this.browser = browser;
    this.networkListener = new PuppeteerNetworkListener();
    this.loginDetector = new LoginDetector();
  }

  /**
   * 提取订阅地址
   */
  async extract(siteConfig: SiteConfig): Promise<string> {
    try {
      logger.info(`[API 模式] 开始提取订阅地址: ${siteConfig.name}`);

      const page = this.browser.getPage();

      // 开始监听网络请求
      this.networkListener.startListening(page);

      // 导航到登录页
      await this.browser.goto(siteConfig.url);

      // 智能等待用户登录
      await this.loginDetector.waitForLogin(page, siteConfig);

      // 等待订阅相关请求出现(最多等待10秒)
      await this.waitForSubscriptionRequests(10000);

      // 停止监听
      this.networkListener.stopListening(page);

      // 提取订阅地址
      const subscriptionUrl = await this.extractSubscriptionUrl(siteConfig);

      if (!subscriptionUrl) {
        // 输出捕获的请求统计,帮助调试
        const stats = this.networkListener.getStats();
        logger.debug(`捕获的请求统计:`, stats);
        logger.debug(`订阅相关请求:`, this.networkListener.findSubscriptionRequests());

        throw new AutoSubError(
          ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
          '未能找到订阅地址,请检查站点配置或网络请求'
        );
      }

      logger.info(`✓ 成功提取订阅地址: ${subscriptionUrl}`);
      return subscriptionUrl;
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
   * 等待订阅相关请求出现
   */
  private async waitForSubscriptionRequests(timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const requests = this.networkListener.findSubscriptionRequests();
      if (requests.length > 0) {
        logger.debug(`找到 ${requests.length} 个订阅相关请求`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.warn('等待订阅请求超时,尝试从现有请求中提取');
  }

  /**
   * 从捕获的请求中提取订阅地址
   */
  private async extractSubscriptionUrl(siteConfig: SiteConfig): Promise<string | null> {
    // 1. 如果配置了 API 模式,优先使用
    if (siteConfig.selector?.api) {
      const url = this.extractByPattern(siteConfig.selector.api);
      if (url) {
        logger.debug(`通过配置的 API 模式找到: ${url}`);
        return url;
      }
    }

    // 2. 通过订阅特征查找
    const url = this.extractByCommonPatterns();
    if (url) {
      logger.debug(`通过常见模式找到: ${url}`);
      return url;
    }

    return null;
  }

  /**
   * 通过配置的 API 模式提取
   */
  private extractByPattern(apiPattern: APIPattern): string | null {
    const requests = this.networkListener.filterRequests({
      urlPattern: apiPattern.urlPattern,
      method: apiPattern.method,
    });

    for (const request of requests) {
      if (!request.responseBody) continue;

      try {
        const body =
          typeof request.responseBody === 'string'
            ? JSON.parse(request.responseBody)
            : request.responseBody;

        const url = this.extractFieldFromObject(body, apiPattern.field);

        if (url && this.isValidSubscriptionUrl(url)) {
          return url;
        }
      } catch (error) {
        logger.debug('解析响应失败', error);
      }
    }

    return null;
  }

  /**
   * 通过常见模式提取
   */
  private extractByCommonPatterns(): string | null {
    // 先找订阅相关的请求
    const subscriptionRequests = this.networkListener.findSubscriptionRequests();

    for (const request of subscriptionRequests) {
      // 1. 检查 URL 本身是否就是订阅地址
      if (this.isValidSubscriptionUrl(request.url)) {
        logger.debug(`URL 本身是订阅地址: ${request.url}`);
        return request.url;
      }

      // 2. 检查响应体
      if (request.responseBody) {
        try {
          const body =
            typeof request.responseBody === 'string'
              ? JSON.parse(request.responseBody)
              : request.responseBody;

          // 常见的订阅字段
          const fields = [
            'subscription_url',
            'subscriptionUrl',
            'sub_url',
            'subUrl',
            'clash_url',
            'clashUrl',
            'link',
            'url',
            'data.subscription_url',
            'data.sub_url',
            'data.url',
          ];

          for (const field of fields) {
            const url = this.extractFieldFromObject(body, field);
            if (url && this.isValidSubscriptionUrl(url)) {
              logger.debug(`从字段 ${field} 提取到: ${url}`);
              return url;
            }
          }

          // 3. 深度搜索响应体中的所有 URL
          const urls = this.extractAllUrls(body);
          for (const url of urls) {
            if (this.isValidSubscriptionUrl(url)) {
              logger.debug(`从响应体深度搜索找到: ${url}`);
              return url;
            }
          }
        } catch (error) {
          // 非 JSON 响应,忽略
        }
      }
    }

    return null;
  }

  /**
   * 从对象中提取字段(支持嵌套)
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
   * 提取对象中所有的 URL
   */
  private extractAllUrls(obj: any): string[] {
    const urls: string[] = [];

    const traverse = (value: any) => {
      if (typeof value === 'string' && value.startsWith('http')) {
        urls.push(value);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(traverse);
      }
    };

    traverse(obj);
    return urls;
  }

  /**
   * 验证是否是有效的订阅 URL
   */
  private isValidSubscriptionUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }

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
}
