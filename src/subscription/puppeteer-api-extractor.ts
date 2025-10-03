import { PuppeteerBrowser } from '../puppeteer/browser.js';
import { PuppeteerNetworkListener } from '../puppeteer/network.js';
import { LoginDetector } from '../puppeteer/login-detector.js';
import { DeepSeekVisionClient } from '../ai/deepseek-vision.js';
import { AIConfigManager } from '../ai/ai-config.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, SiteConfig, APIPattern, AIConfig } from '../types/index.js';

/**
 * Puppeteer 版本的 API 模式订阅抓取器
 */
export class PuppeteerApiExtractor {
  private browser: PuppeteerBrowser;
  private networkListener: PuppeteerNetworkListener;
  private loginDetector: LoginDetector;
  private aiClient?: DeepSeekVisionClient;

  constructor(browser: PuppeteerBrowser, aiConfig?: AIConfig) {
    this.browser = browser;
    this.networkListener = new PuppeteerNetworkListener();
    this.loginDetector = new LoginDetector();

    // 如果提供了 AI 配置,初始化 AI 客户端
    if (aiConfig && aiConfig.enabled) {
      const apiUrl = AIConfigManager.buildApiUrl(aiConfig);
      const model = AIConfigManager.getModel(aiConfig);

      this.aiClient = new DeepSeekVisionClient({
        apiUrl,
        apiKey: aiConfig.apiKey,
        model,
      });
      logger.info(`✓ AI 智能识别已启用: ${aiConfig.provider} / ${model}`);
    }
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

      // 尝试点击"复制链接"按钮来触发订阅地址获取
      await this.clickCopyLinkButton(page);

      // 策略1: 尝试从剪贴板读取订阅地址
      const clipboardUrl = await this.readClipboard(page);
      if (clipboardUrl && this.isValidSubscriptionUrl(clipboardUrl)) {
        logger.info(`✓ 从剪贴板获取到订阅地址: ${clipboardUrl}`);
        this.networkListener.stopListening(page);
        return clipboardUrl;
      }

      // 策略2: 等待订阅相关请求出现(最多等待5秒)
      await this.waitForSubscriptionRequests(5000);

      // 停止监听
      this.networkListener.stopListening(page);

      // 策略3: 从网络请求中提取订阅地址
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
      const patterns = Array.isArray(siteConfig.selector.api)
        ? siteConfig.selector.api
        : [siteConfig.selector.api];

      for (const pattern of patterns) {
        const url = this.extractByPattern(pattern);
        if (url) {
          logger.debug(`通过配置的 API 模式找到: ${url}`);
          return url;
        }
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

        const targetField = apiPattern.field ?? apiPattern.responseKey;

        if (!targetField) {
          continue;
        }

        const url = this.extractFieldFromObject(body, targetField);

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

  /**
   * 点击"复制链接"按钮来触发订阅地址获取
   */
  private async clickCopyLinkButton(page: any): Promise<void> {
    try {
      logger.info('寻找并点击"复制链接"按钮...');

      // 策略1: 如果启用了 AI,优先使用 AI 识别
      if (this.aiClient) {
        const aiSuccess = await this.clickButtonWithAI(page);
        if (aiSuccess) {
          return;
        }
        logger.warn('AI 识别失败,回退到传统方法');
      }

      // 策略2: 传统按钮文本匹配
      await this.clickButtonWithTextMatching(page);
    } catch (error) {
      logger.warn('点击"复制链接"按钮失败，将尝试从现有请求中提取:', error);
    }
  }

  /**
   * 使用 AI 识别并点击按钮
   */
  private async clickButtonWithAI(page: any): Promise<boolean> {
    try {
      logger.info('🤖 使用 AI DOM 结构分析识别按钮...');

      // 1. 收集页面中所有可见的可点击元素(扩大范围,让AI判断)
      const visibleButtons = await page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll(
            'button, a, [role="button"], ' +
            'div[class*="copy"], div[class*="Copy"], ' +
            'div[class*="action"], div[class*="Action"], ' +
            'div.cursor-pointer, ' +
            'div[onclick], div[class*="btn"], div[class*="button"]'
          )
        );
        const results: Array<{ text: string; selector: string }> = [];

        elements.forEach((el, idx) => {
          const htmlEl = el as HTMLElement;

          // 只收集可见元素
          if (htmlEl.offsetParent === null ||
              window.getComputedStyle(htmlEl).display === 'none' ||
              window.getComputedStyle(htmlEl).visibility === 'hidden') {
            return;
          }

          // 获取文本(包括子元素的文本)
          const text = htmlEl.innerText?.trim() || htmlEl.textContent?.trim() || '';
          if (!text) return; // 跳过没有文本的元素

          // 过滤掉文本过长的元素(可能是容器而不是按钮)
          if (text.length > 100) return;

          // 生成唯一选择器
          const tagName = htmlEl.tagName.toLowerCase();
          const classes = Array.from(htmlEl.classList);
          const id = htmlEl.id;

          let selector = tagName;
          if (id) {
            selector = `#${id}`;
          } else if (classes.length > 0) {
            // 过滤掉包含特殊字符的class,避免CSS选择器错误
            const safeClasses = classes
              .filter(c => !/[#\[\]:\/]/.test(c))  // 过滤包含特殊字符的class
              .slice(0, 3);  // 最多保留3个class

            if (safeClasses.length > 0) {
              selector = `${tagName}.${safeClasses.join('.')}`;
            } else {
              // 如果所有class都不安全,使用data属性或nth-child
              const dataAttrs = Array.from(htmlEl.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => `[${attr.name}]`);

              if (dataAttrs.length > 0) {
                selector = `${tagName}${dataAttrs[0]}`;
              } else {
                // 最后手段:使用父元素+nth-child
                const parent = htmlEl.parentElement;
                if (parent) {
                  const childIndex = Array.from(parent.children).indexOf(htmlEl) + 1;
                  selector = `${tagName}:nth-child(${childIndex})`;
                } else {
                  selector = `${tagName}:nth-of-type(${idx + 1})`;
                }
              }
            }
          } else {
            // 使用更精确的选择器
            const parent = htmlEl.parentElement;
            if (parent) {
              const childIndex = Array.from(parent.children).indexOf(htmlEl) + 1;
              selector = `${tagName}:nth-child(${childIndex})`;
            } else {
              selector = `${tagName}:nth-of-type(${idx + 1})`;
            }
          }

          results.push({ text, selector });
        });

        return results;
      });

      if (visibleButtons.length === 0) {
        logger.warn('页面中没有找到可见的按钮');
        return false;
      }

      logger.info(`找到 ${visibleButtons.length} 个可见按钮`);

      // 调试输出 (待删除)
      if (process.env.DEBUG_AI) {
        console.log('\n========== 收集到的按钮 ==========');
        console.log(JSON.stringify(visibleButtons, null, 2));
        console.log('===================================\n');
      }

      // 2. 获取页面 HTML 片段(供 AI 参考)
      const pageHTML = await page.content();

      // 3. 使用 AI 分析 DOM 结构,识别正确的按钮
      const result = await this.aiClient!.identifySubscriptionCopyButton(pageHTML, visibleButtons);

      if (!result.found || !result.selector || result.confidence < 0.7) {
        logger.warn(`AI 识别置信度过低或未找到: ${result.confidence}`);
        return false;
      }

      logger.info(`✓ AI 识别成功: ${result.description}`);
      logger.info(`  选择器: ${result.selector}`);
      logger.info(`  置信度: ${result.confidence}`);

      // 4. 点击 AI 识别出的按钮
      await page.click(result.selector);
      logger.info('✓ 已点击 AI 识别的按钮');

      // 等待更长时间确保复制操作完成
      logger.debug('等待复制操作完成...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;
    } catch (error) {
      logger.error('AI 识别点击失败:', error);
      return false;
    }
  }

  /**
   * 使用传统文本匹配方式点击按钮
   */
  private async clickButtonWithTextMatching(page: any): Promise<void> {
    // 获取所有可能的按钮、链接和可点击的div元素
    const buttons = await page.$$(
      'button, a, ' +
      'div[class*="copy"], div[class*="Copy"], ' +
      'div[class*="action"], div[class*="Action"], ' +
      'div.cursor-pointer, ' +
      'div[onclick], div[class*="btn"], div[class*="button"]'
    );

    for (const button of buttons) {
      try {
        const text = await button.evaluate((el: HTMLElement) => el.innerText?.trim() || '');
        const title = await button.evaluate((el: HTMLElement) => el.getAttribute('title') || '');
        const ariaLabel = await button.evaluate((el: HTMLElement) => el.getAttribute('aria-label') || '');

        // 检查是否包含"复制链接"、"复制订阅"等文本，但排除"Clash"和"导入"相关的
        const combinedText = `${text} ${title} ${ariaLabel}`;

        if (
          (text.includes('复制链接') ||
           text.includes('复制订阅') ||
           text.includes('订阅地址') ||
           text.includes('复制地址') ||
           text.includes('一键订阅') ||
           (text === '复制' && (title.includes('链接') || title.includes('订阅') || title.includes('地址') || ariaLabel.includes('链接')))) &&
          !combinedText.includes('Clash') &&
          !combinedText.includes('导入') &&
          !combinedText.includes('打开')
        ) {
          logger.info(`✓ 找到"复制链接"按钮: "${text}" (title: "${title}")`);

          // 点击按钮
          await button.click();
          logger.info('✓ 已点击"复制链接"按钮');

          // 等待更长时间让复制操作完成
          logger.debug('等待复制操作完成...');
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return;
        }
      } catch (error) {
        // 忽略单个按钮的错误
        continue;
      }
    }

    logger.warn('未找到"复制链接"按钮，将尝试从现有请求中提取');
  }

  /**
   * 读取浏览器剪贴板内容(带重试机制)
   */
  private async readClipboard(page: any): Promise<string | null> {
    try {
      logger.info('尝试从剪贴板读取订阅地址...');

      // 授予剪贴板读取权限
      const context = page.browserContext();
      await context.overridePermissions(page.url(), ['clipboard-read', 'clipboard-write']);

      // 多次尝试读取剪贴板(因为复制操作可能需要时间)
      const maxRetries = 5;
      for (let i = 0; i < maxRetries; i++) {
        // 每次重试前等待更长时间
        await new Promise((resolve) => setTimeout(resolve, (i + 1) * 500));

        // 读取剪贴板内容
        const clipboardText = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch (error) {
            return null;
          }
        });

        if (clipboardText && clipboardText.trim()) {
          logger.info(`✓ 第 ${i + 1} 次尝试成功读取剪贴板`);
          logger.debug(`剪贴板内容: ${clipboardText}`);

          const url = this.extractUrlFromText(clipboardText.trim());
          if (url) {
            return url;
          }

          logger.debug('剪贴板内容未提取出 URL，继续重试');
        }

        logger.debug(`第 ${i + 1}/${maxRetries} 次尝试: 剪贴板为空,继续重试...`);
      }

      logger.warn('多次尝试后剪贴板仍为空');
      return null;
    } catch (error) {
      logger.warn('读取剪贴板失败:', error);
      return null;
    }
  }

  private extractUrlFromText(text: string): string | null {
    const match = text.match(/https?:\/{2}[^\s'"<>]+/i);
    if (!match) {
      return null;
    }

    const cleaned = match[0].replace(/[)\]\.,;]+$/g, '');
    try {
      const parsed = new URL(cleaned);
      return parsed.toString();
    } catch {
      return null;
    }
  }
}
