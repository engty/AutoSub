import { PageManager } from '../mcp/page.js';
import { MCPClient } from '../mcp/client.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, SiteConfig, DOMSelector } from '../types/index.js';

/**
 * DOM 模式订阅抓取器
 * 通过页面快照和 DOM 元素查找订阅地址
 */
export class DomSubscriptionExtractor {
  private pageManager: PageManager;
  private mcpClient: MCPClient;

  constructor(pageManager: PageManager, mcpClient: MCPClient) {
    this.pageManager = pageManager;
    this.mcpClient = mcpClient;
  }

  /**
   * 通过 DOM 模式提取订阅地址
   */
  async extract(siteConfig: SiteConfig): Promise<string> {
    try {
      logger.info(`[DOM 模式] 开始提取订阅地址: ${siteConfig.name}`);

      // 导航到站点页面
      await this.pageManager.navigateTo(siteConfig.url);

      // 等待页面加载
      await this.delay(2000);

      // 1. 通过配置的 DOM 选择器提取
      if (siteConfig.selector?.dom) {
        const url = await this.extractBySelector(siteConfig.selector.dom);
        if (url) {
          logger.info(`✓ 通过 DOM 选择器找到订阅地址: ${url}`);
          return url;
        }
      }

      // 2. 通过常见模式自动查找
      const url = await this.extractByCommonPatterns();
      if (url) {
        logger.info(`✓ 通过常见模式找到订阅地址: ${url}`);
        return url;
      }

      throw new AutoSubError(
        ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
        '未能通过 DOM 模式找到订阅地址'
      );
    } catch (error) {
      if (error instanceof AutoSubError) {
        throw error;
      }
      throw new AutoSubError(
        ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
        `DOM 模式提取失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 通过配置的 DOM 选择器提取
   */
  private async extractBySelector(domSelector: DOMSelector): Promise<string | null> {
    try {
      // 获取页面快照
      const snapshot = await this.takeSnapshot();

      // 查找匹配的元素
      const element = this.findElementInSnapshot(snapshot, domSelector.selector);

      if (!element) {
        logger.debug(`DOM 选择器未找到元素: ${domSelector.selector}`);
        return null;
      }

      // 根据属性提取 URL
      let url: string | null = null;

      if (domSelector.attribute === 'text') {
        url = element.text || null;
      } else if (domSelector.attribute === 'href') {
        url = element.href || null;
      } else if (domSelector.attribute) {
        url = element.attributes?.[domSelector.attribute] || null;
      }

      if (url && this.isValidSubscriptionUrl(url)) {
        return url;
      }

      return null;
    } catch (error) {
      logger.error('通过 DOM 选择器提取失败', error);
      return null;
    }
  }

  /**
   * 通过常见模式提取订阅地址
   */
  private async extractByCommonPatterns(): Promise<string | null> {
    try {
      // 获取页面快照
      const snapshot = await this.takeSnapshot();

      // 常见的订阅按钮/链接文本
      const buttonTexts = [
        '订阅',
        '复制订阅',
        '复制链接',
        'Clash',
        'Clash 订阅',
        '一键订阅',
        '获取订阅',
        'subscription',
        'copy link',
      ];

      // 查找包含这些文本的元素
      for (const text of buttonTexts) {
        const elements = this.findElementsByText(snapshot, text);

        for (const element of elements) {
          // 尝试从各种属性中提取 URL
          const urls = [
            element.href,
            element.attributes?.['data-url'],
            element.attributes?.['data-link'],
            element.attributes?.['data-subscription'],
            element.attributes?.['data-clipboard-text'],
          ].filter(Boolean);

          for (const url of urls) {
            if (url && this.isValidSubscriptionUrl(url)) {
              return url;
            }
          }
        }
      }

      // 查找所有包含订阅 URL 的链接
      const allLinks = snapshot.elements?.filter((el: any) => el.tagName === 'a' && el.href);

      if (allLinks) {
        for (const link of allLinks) {
          if (this.isValidSubscriptionUrl(link.href)) {
            return link.href;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('通过常见模式提取失败', error);
      return null;
    }
  }

  /**
   * 获取页面快照
   */
  private async takeSnapshot(): Promise<any> {
    try {
      const result = await this.mcpClient.callTool('mcp__chrome-devtools__take_snapshot');

      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find((item: any) => item.type === 'text');
        if (textContent) {
          try {
            return JSON.parse(textContent.text);
          } catch {
            return { elements: [] };
          }
        }
      }

      return { elements: [] };
    } catch (error) {
      logger.error('获取页面快照失败', error);
      return { elements: [] };
    }
  }

  /**
   * 在快照中查找元素
   */
  private findElementInSnapshot(snapshot: any, selector: string): any | null {
    if (!snapshot.elements || !Array.isArray(snapshot.elements)) {
      return null;
    }

    // 简单的选择器匹配（支持 id、class、标签）
    for (const element of snapshot.elements) {
      // ID 选择器
      if (selector.startsWith('#')) {
        const id = selector.substring(1);
        if (element.id === id) return element;
      }

      // Class 选择器
      else if (selector.startsWith('.')) {
        const className = selector.substring(1);
        const classes = element.className?.split(' ') || [];
        if (classes.includes(className)) return element;
      }

      // 标签选择器
      else {
        if (element.tagName?.toLowerCase() === selector.toLowerCase()) {
          return element;
        }
      }
    }

    return null;
  }

  /**
   * 根据文本查找元素
   */
  private findElementsByText(snapshot: any, text: string): any[] {
    if (!snapshot.elements || !Array.isArray(snapshot.elements)) {
      return [];
    }

    const results: any[] = [];
    const lowerText = text.toLowerCase();

    for (const element of snapshot.elements) {
      const elementText = (element.text || '').toLowerCase();
      if (elementText.includes(lowerText)) {
        results.push(element);
      }
    }

    return results;
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
