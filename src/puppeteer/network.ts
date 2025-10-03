import { Page, HTTPResponse } from 'puppeteer-core';
import { logger } from '../utils/logger.js';

/**
 * 捕获的网络请求
 */
export interface CapturedRequest {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  responseBody?: any;
  timestamp: number;
}

/**
 * 请求过滤器
 */
export interface RequestFilter {
  urlPattern?: string | RegExp;
  method?: string;
  resourceType?: string;
}

/**
 * Puppeteer 网络请求监听器
 */
export class PuppeteerNetworkListener {
  private requests: CapturedRequest[] = [];
  private isListening: boolean = false;

  /**
   * 开始监听网络请求
   */
  startListening(page: Page): void {
    if (this.isListening) return;

    logger.debug('开始监听网络请求');

    // 监听所有响应
    page.on('response', async (response: HTTPResponse) => {
      try {
        const request = response.request();
        const url = response.url();
        const method = request.method();
        const resourceType = request.resourceType();
        const status = response.status();

        // 只捕获可能包含订阅信息的请求
        if (this.shouldCapture(url, method, resourceType)) {
          let responseBody = null;

          // 尝试获取响应体
          try {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json')) {
              responseBody = await response.json();
            } else if (contentType.includes('text/')) {
              responseBody = await response.text();
            }
          } catch (error) {
            // 某些请求无法获取响应体,忽略
          }

          const capturedRequest: CapturedRequest = {
            url,
            method,
            resourceType,
            status,
            responseBody,
            timestamp: Date.now(),
          };

          this.requests.push(capturedRequest);
          logger.debug(`捕获请求: ${method} ${url} [${status}]`);
        }
      } catch (error) {
        logger.debug('处理响应时出错', error);
      }
    });

    this.isListening = true;
  }

  /**
   * 判断是否应该捕获此请求
   */
  private shouldCapture(url: string, _method: string, resourceType: string): boolean {
    // 只捕获 XHR 和 Fetch 请求
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      return false;
    }

    // 排除一些不相关的请求
    const excludePatterns = [
      /google-analytics/i,
      /googletagmanager/i,
      /facebook/i,
      /doubleclick/i,
      /stats/i,
      /analytics/i,
      /tracking/i,
      /\.png$/i,
      /\.jpg$/i,
      /\.gif$/i,
      /\.css$/i,
      /\.js$/i,
    ];

    if (excludePatterns.some((pattern) => pattern.test(url))) {
      return false;
    }

    return true;
  }

  /**
   * 停止监听
   */
  stopListening(page: Page): void {
    if (!this.isListening) return;

    page.removeAllListeners('response');
    this.isListening = false;
    logger.debug('停止监听网络请求');
  }

  /**
   * 获取所有捕获的请求
   */
  getRequests(): CapturedRequest[] {
    return [...this.requests];
  }

  /**
   * 过滤请求
   */
  filterRequests(filter: RequestFilter): CapturedRequest[] {
    return this.requests.filter((req) => {
      // URL 模式匹配
      if (filter.urlPattern) {
        if (typeof filter.urlPattern === 'string') {
          // 支持通配符 * 转换为正则
          const pattern = filter.urlPattern.replace(/\*/g, '.*');
          const regex = new RegExp(pattern, 'i');
          if (!regex.test(req.url)) return false;
        } else {
          if (!filter.urlPattern.test(req.url)) return false;
        }
      }

      // HTTP 方法匹配
      if (filter.method && req.method.toLowerCase() !== filter.method.toLowerCase()) {
        return false;
      }

      // 资源类型匹配
      if (
        filter.resourceType &&
        req.resourceType.toLowerCase() !== filter.resourceType.toLowerCase()
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * 查找订阅相关的请求
   */
  findSubscriptionRequests(): CapturedRequest[] {
    const subscriptionPatterns = [
      /subscription/i,
      /\/sub[\/\?]/i,
      /clash/i,
      /v2ray/i,
      /vmess/i,
      /\/link/i,
      /\/api\/user/i,
    ];

    return this.requests.filter((req) => {
      return subscriptionPatterns.some((pattern) => pattern.test(req.url));
    });
  }

  /**
   * 清除已捕获的请求
   */
  clear(): void {
    this.requests = [];
    logger.debug('清除捕获的请求');
  }

  /**
   * 获取请求统计
   */
  getStats(): { total: number; byType: Record<string, number>; byStatus: Record<number, number> } {
    const byType: Record<string, number> = {};
    const byStatus: Record<number, number> = {};

    this.requests.forEach((req) => {
      byType[req.resourceType] = (byType[req.resourceType] || 0) + 1;
      if (req.status) {
        byStatus[req.status] = (byStatus[req.status] || 0) + 1;
      }
    });

    return {
      total: this.requests.length,
      byType,
      byStatus,
    };
  }
}
