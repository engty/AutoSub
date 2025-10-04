import { PuppeteerBrowser } from '../puppeteer/index.js';
import { PuppeteerNetworkListener } from '../puppeteer/network.js';
import { ApiDetector } from '../subscription/api-detector.js';
import { SubscriptionValidator } from '../subscription/validator.js';
import { logger } from '../utils/logger.js';
import { TestReport, TestStep } from '../types/test-report.js';
import { Credentials, AutoSubError, ErrorCode } from '../types/index.js';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * 站点兼容性测试服务
 * 复用添加站点的流程，但不保存任何数据
 */
export class SiteTestService {
  private browser!: PuppeteerBrowser;
  private networkListener!: PuppeteerNetworkListener;
  private validator!: SubscriptionValidator;
  private testReport: TestReport;
  private steps: TestStep[] = [];

  constructor(private url: string) {
    this.testReport = this.initializeReport();
  }

  private initializeReport(): TestReport {
    return {
      url: this.url,
      testTime: new Date().toISOString(),
      loginDetected: false,
      credentials: {
        cookies: { found: false, count: 0, hasExpiry: false },
        localStorage: { found: false, count: 0, keys: [] },
        sessionStorage: { found: false, count: 0, keys: [] }
      },
      apiDetected: false,
      subscriptionExtracted: false,
      errors: [],
      warnings: [],
      compatibility: {
        level: 'none',
        score: 0,
        canUseHttpApi: false,
        canUseBrowserMode: false
      },
      steps: []
    };
  }

  /**
   * 执行兼容性测试
   */
  async runTest(): Promise<TestReport> {
    try {
      console.log('⏳ 正在启动浏览器...\n');
      logger.info(`开始测试站点: ${this.url}`);

      // 步骤1: 启动浏览器
      await this.startBrowser();

      // 步骤2: 打开站点并等待登录
      await this.waitForLogin();

      // 步骤3: 捕获凭证
      await this.captureCredentials();

      // 步骤4: 提取正确的订阅地址（从剪贴板）
      await this.extractSubscriptionFromClipboard();

      // 步骤5: 检测API
      await this.detectApi();

      // 计算兼容性评分
      this.calculateCompatibility();

      this.testReport.steps = this.steps;
      logger.info('测试完成');

      return this.testReport;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.testReport.errors.push(errorMsg);
      this.addStep('测试执行', 'failed', errorMsg);
      logger.error('测试失败:', error);
      return this.testReport;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 步骤1: 启动浏览器
   */
  private async startBrowser(): Promise<void> {
    const startTime = Date.now();
    try {
      this.browser = new PuppeteerBrowser();
      await this.browser.launch();
      this.networkListener = new PuppeteerNetworkListener();
      this.validator = new SubscriptionValidator();

      const duration = Date.now() - startTime;
      this.addStep('启动浏览器', 'success', `浏览器启动成功`, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `浏览器启动失败: ${error instanceof Error ? error.message : String(error)}`;
      this.addStep('启动浏览器', 'failed', errorMsg, duration);
      this.testReport.errors.push(errorMsg);
      throw error;
    }
  }

  /**
   * 步骤2: 打开站点并等待登录
   */
  private async waitForLogin(): Promise<void> {
    const startTime = Date.now();
    try {
      const page = await this.browser.getPage();

      // 开始监听网络请求
      this.networkListener.startListening(page);

      // 打开站点
      await page.goto(this.url, { waitUntil: 'networkidle0', timeout: 30000 });
      logger.info(`已打开站点: ${this.url}`);

      // 等待用户手动确认登录完成（复用交互逻辑）
      await this.waitForUserToComplete();

      const duration = Date.now() - startTime;
      this.testReport.loginDetected = true;
      this.testReport.loginMethod = '用户确认';
      this.testReport.loginDuration = duration;

      this.addStep(
        '登录检测',
        'success',
        `用户确认登录完成`,
        duration
      );
      logger.info(`✓ 用户确认登录完成`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `登录过程出错: ${error instanceof Error ? error.message : String(error)}`;
      this.addStep('登录检测', 'failed', errorMsg, duration);
      this.testReport.errors.push(errorMsg);
      throw error;
    }
  }

  /**
   * 等待用户完成登录（复用 PuppeteerApiExtractor 的交互逻辑）
   */
  private async waitForUserToComplete(): Promise<void> {
    const rl = readline.createInterface({ input, output });
    try {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📌 浏览器已打开测试站点');
      console.log('📌 请在浏览器中完成登录操作');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const answer = await rl.question('✅ 完成登录后，输入 y 开始兼容性测试；输入 n 取消: ');
      const value = answer.trim().toLowerCase();

      if (value !== 'y' && value !== 'yes' && value !== '') {
        throw new AutoSubError(
          ErrorCode.USER_CANCELLED,
          '用户取消测试'
        );
      }

      console.log('\n🚀 开始兼容性测试...\n');
      logger.info('用户确认开始测试');
    } finally {
      await rl.close();
    }
  }

  /**
   * 步骤3: 捕获凭证
   */
  private async captureCredentials(): Promise<void> {
    const startTime = Date.now();
    try {
      const page = await this.browser.getPage();

      // 获取 cookies
      const cookies = await page.cookies();
      this.testReport.credentials.cookies.found = cookies.length > 0;
      this.testReport.credentials.cookies.count = cookies.length;
      this.testReport.credentials.cookies.hasExpiry = cookies.some(c => c.expires && c.expires > 0);

      // 获取 localStorage
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      this.testReport.credentials.localStorage.found = Object.keys(localStorage).length > 0;
      this.testReport.credentials.localStorage.count = Object.keys(localStorage).length;
      this.testReport.credentials.localStorage.keys = Object.keys(localStorage);

      // 获取 sessionStorage
      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return data;
      });

      this.testReport.credentials.sessionStorage.found = Object.keys(sessionStorage).length > 0;
      this.testReport.credentials.sessionStorage.count = Object.keys(sessionStorage).length;
      this.testReport.credentials.sessionStorage.keys = Object.keys(sessionStorage);

      const duration = Date.now() - startTime;
      const details = {
        cookies: cookies.length,
        localStorage: Object.keys(localStorage).length,
        sessionStorage: Object.keys(sessionStorage).length
      };

      this.addStep(
        '凭证捕获',
        'success',
        `成功捕获凭证（Cookie: ${cookies.length}, localStorage: ${Object.keys(localStorage).length}, sessionStorage: ${Object.keys(sessionStorage).length}）`,
        duration,
        details
      );

      logger.info(`✓ 凭证捕获完成: ${JSON.stringify(details)}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `凭证捕获失败: ${error instanceof Error ? error.message : String(error)}`;
      this.addStep('凭证捕获', 'failed', errorMsg, duration);
      this.testReport.warnings.push(errorMsg);
      logger.warn(errorMsg);
    }
  }

  /**
   * 步骤4: 提取正确的订阅地址（从剪贴板）
   */
  private async extractSubscriptionFromClipboard(): Promise<void> {
    const startTime = Date.now();
    try {
      const page = await this.browser.getPage();

      logger.info('开始从剪贴板提取订阅地址...');

      // 1. 清空剪贴板
      await this.clearClipboard(page);

      // 2. 点击"复制订阅"按钮
      logger.info('寻找并点击"复制订阅"按钮...');
      const clickSuccess = await this.clickCopyLinkButton(page);

      if (!clickSuccess) {
        const duration = Date.now() - startTime;
        this.addStep(
          '剪贴板订阅提取',
          'skipped',
          '未找到"复制订阅"按钮',
          duration
        );
        logger.warn('未找到"复制订阅"按钮，跳过剪贴板提取');
        return;
      }

      // 3. 读取剪贴板
      const clipboardUrl = await this.readClipboard(page);

      if (clipboardUrl && this.isValidSubscriptionUrl(clipboardUrl)) {
        this.testReport.clipboardSubscriptionUrl = clipboardUrl;
        this.testReport.subscriptionExtracted = true;
        this.testReport.extractionMethod = 'clipboard';

        const duration = Date.now() - startTime;
        this.addStep(
          '剪贴板订阅提取',
          'success',
          `成功从剪贴板提取订阅地址`,
          duration,
          { url: clipboardUrl }
        );

        logger.info(`✓ 从剪贴板提取订阅地址: ${clipboardUrl}`);
      } else {
        const duration = Date.now() - startTime;
        this.addStep(
          '剪贴板订阅提取',
          'failed',
          '剪贴板内容为空或格式无效',
          duration
        );
        this.testReport.warnings.push('剪贴板订阅提取失败');
        logger.warn('剪贴板内容无效');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `剪贴板订阅提取失败: ${error instanceof Error ? error.message : String(error)}`;
      this.addStep('剪贴板订阅提取', 'failed', errorMsg, duration);
      this.testReport.warnings.push(errorMsg);
      logger.warn(errorMsg);
    }
  }

  /**
   * 步骤5: 检测API
   */
  private async detectApi(): Promise<void> {
    const startTime = Date.now();
    try {
      const page = await this.browser.getPage();

      logger.info('开始检测订阅API...');

      // 1. 获取网络请求
      const requests = this.networkListener.getRequests().map(req => ({
        url: req.url,
        method: req.method,
        status: req.status,
        resourceType: req.resourceType,
        responseBody: req.responseBody,
        requestHeaders: req.headers,
      }));

      if (requests.length === 0) {
        const duration = Date.now() - startTime;
        this.addStep(
          'API检测',
          'failed',
          '未捕获到网络请求',
          duration
        );
        this.testReport.warnings.push('未捕获到网络请求，无法检测API');
        logger.warn('未捕获到网络请求，跳过API检测');
        return;
      }

      logger.info(`捕获到 ${requests.length} 个网络请求`);

      // 2. 获取 localStorage 数据
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      // 3. 创建API检测器并检测
      const apiDetector = new ApiDetector();
      const result = apiDetector.detect(requests, localStorage);

      if (result.detected && result.config) {
        this.testReport.apiDetected = true;
        this.testReport.apiConfig = {
          url: result.config.url,
          method: result.config.method || 'GET',
          authSource: result.config.authSource || 'cookie',
          authField: result.config.authField,
          tokenField: result.config.tokenField,
          subscribeUrlField: result.config.subscribeUrlField,
          subscriptionUrl: result.config.subscriptionUrl
        };

        // 4. 尝试从响应中提取订阅地址
        const subscriptionUrl = this.extractSubscriptionUrl(requests, result.config);
        if (subscriptionUrl) {
          this.testReport.subscriptionUrl = subscriptionUrl;
          this.testReport.subscriptionExtracted = true;
          this.testReport.extractionMethod = 'api';
          logger.info(`✓ 成功提取订阅地址: ${subscriptionUrl}`);
        }

        const duration = Date.now() - startTime;
        this.addStep(
          'API检测',
          'success',
          `检测到订阅API（认证方式: ${result.config.authSource}，置信度: ${result.confidence.toFixed(2)}）`,
          duration,
          {
            ...result.config,
            subscriptionUrl
          }
        );

        logger.info(`✓ API检测成功: ${result.config.url} (置信度: ${result.confidence.toFixed(2)})`);

        // 5. 如果同时有剪贴板URL和API URL，计算转换规则
        if (this.testReport.clipboardSubscriptionUrl && subscriptionUrl) {
          this.calculateUrlTransformation(
            this.testReport.clipboardSubscriptionUrl,
            subscriptionUrl
          );
        }
      } else {
        const duration = Date.now() - startTime;
        const reason = result.reason || '未找到符合条件的API请求';
        this.addStep(
          'API检测',
          'failed',
          reason,
          duration
        );
        this.testReport.warnings.push(`API检测失败: ${reason}`);
        logger.warn(`未检测到订阅API: ${reason}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `API检测失败: ${error instanceof Error ? error.message : String(error)}`;
      this.addStep('API检测', 'failed', errorMsg, duration);
      this.testReport.warnings.push(errorMsg);
      logger.warn(errorMsg);
    }
  }

  /**
   * 从API响应中提取订阅地址
   */
  private extractSubscriptionUrl(
    requests: Array<{
      url: string;
      method: string;
      status?: number;
      resourceType?: string;
      responseBody?: any;
      requestHeaders?: Record<string, string>;
    }>,
    config: {
      url: string;
      subscribeUrlField?: string;
      tokenField?: string;
      subscribeUrlPattern?: string;
    }
  ): string | null {
    // 找到对应的API请求
    const apiRequest = requests.find(req => req.url === config.url);
    if (!apiRequest || !apiRequest.responseBody) {
      return null;
    }

    try {
      const data = typeof apiRequest.responseBody === 'string'
        ? JSON.parse(apiRequest.responseBody)
        : apiRequest.responseBody;

      // 1. 如果有 subscribeUrlField，直接提取
      if (config.subscribeUrlField) {
        const url = this.getValueByPath(data, config.subscribeUrlField);
        if (url && typeof url === 'string') {
          return url;
        }
      }

      // 2. 如果有 tokenField，尝试通过模式重建
      if (config.tokenField && config.subscribeUrlPattern) {
        const token = this.getValueByPath(data, config.tokenField);
        if (token && typeof token === 'string') {
          return config.subscribeUrlPattern.replace('{token}', token);
        }
      }

      return null;
    } catch (error) {
      logger.warn('提取订阅地址失败:', error);
      return null;
    }
  }

  /**
   * 通过路径获取对象值
   */
  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * 步骤5: 验证订阅地址
   */
  private async validateSubscription(): Promise<void> {
    if (!this.testReport.subscriptionUrl) {
      return;
    }

    const startTime = Date.now();
    try {
      const validation = await this.validator.validate(this.testReport.subscriptionUrl);

      this.testReport.subscriptionValid = validation.valid;
      this.testReport.subscriptionValidation = {
        statusCode: validation.statusCode,
        contentType: validation.contentType,
        isYaml: validation.isYaml,
        nodeCount: validation.nodeCount,
        errorMessage: validation.error
      };

      const duration = Date.now() - startTime;

      if (validation.valid) {
        this.addStep(
          '订阅验证',
          'success',
          `订阅地址有效（节点数: ${validation.nodeCount}）`,
          duration,
          validation
        );
        logger.info(`✓ 订阅验证成功: 节点数 ${validation.nodeCount}`);
      } else {
        this.addStep(
          '订阅验证',
          'failed',
          `订阅验证失败: ${validation.error}`,
          duration
        );
        this.testReport.errors.push(`订阅验证失败: ${validation.error}`);
        logger.error(`订阅验证失败: ${validation.error}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `订阅验证出错: ${error instanceof Error ? error.message : String(error)}`;
      this.addStep('订阅验证', 'failed', errorMsg, duration);
      this.testReport.errors.push(errorMsg);
      logger.error(errorMsg);
    }
  }

  /**
   * 计算兼容性评分
   */
  private calculateCompatibility(): void {
    let score = 0;
    const factors = [];

    // 登录检测 (30分)
    if (this.testReport.loginDetected) {
      score += 30;
      factors.push('登录检测成功');
    }

    // 凭证捕获 (20分)
    if (this.testReport.credentials.cookies.found || this.testReport.credentials.localStorage.found) {
      score += 20;
      factors.push('凭证捕获成功');
    }

    // API检测 (30分)
    if (this.testReport.apiDetected) {
      score += 30;
      factors.push('API检测成功');
      this.testReport.compatibility.canUseHttpApi = true;
    }

    // 订阅提取 (20分)
    if (this.testReport.subscriptionExtracted) {
      score += 20;
      factors.push('订阅提取成功');
    }

    // 浏览器模式兼容性
    this.testReport.compatibility.canUseBrowserMode =
      this.testReport.loginDetected &&
      (this.testReport.credentials.cookies.found || this.testReport.credentials.localStorage.found);

    // 设置兼容性等级
    this.testReport.compatibility.score = score;
    if (score >= 80) {
      this.testReport.compatibility.level = 'full';
    } else if (score >= 50) {
      this.testReport.compatibility.level = 'partial';
    } else {
      this.testReport.compatibility.level = 'none';
    }

    logger.info(`兼容性评分: ${score}/100 (${this.testReport.compatibility.level})`);
  }

  /**
   * 添加测试步骤记录
   */
  private addStep(
    name: string,
    status: 'success' | 'failed' | 'skipped',
    message?: string,
    duration?: number,
    details?: any
  ): void {
    this.steps.push({
      name,
      status,
      duration,
      message,
      details
    });
  }

  /**
   * 清空剪贴板
   */
  private async clearClipboard(page: any): Promise<void> {
    try {
      const context = page.browserContext();
      await context.overridePermissions(page.url(), ['clipboard-read', 'clipboard-write']);

      await page.evaluate(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch (error) {
          console.error('清空剪贴板失败:', error);
        }
      });
    } catch (error) {
      logger.debug('清空剪贴板失败（忽略）:', error);
    }
  }

  /**
   * 点击"复制订阅"按钮
   */
  private async clickCopyLinkButton(page: any): Promise<boolean> {
    try {
      logger.info('寻找并点击"复制订阅"按钮...');

      // 按 ESC 关闭可能的广告弹窗
      await page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 500));

      // 获取初始剪贴板内容
      const initialClipboard = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return '';
        }
      });

      // 查找所有可能的按钮元素
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
            logger.info(`✓ 找到"复制订阅"按钮: "${text}" (title: "${title}")`);

            // 尝试点击按钮（多策略）
            let clickSuccess = false;
            try {
              await button.click({ delay: 100 });
              logger.info('✓ 已点击按钮（ElementHandle.click）');
              clickSuccess = true;
            } catch (clickError) {
              logger.debug(`ElementHandle.click 失败，尝试 evaluate 方式: ${clickError}`);
              try {
                await button.evaluate((el: HTMLElement) => el.click());
                logger.info('✓ 已点击按钮（evaluate.click）');
                clickSuccess = true;
              } catch (evalError) {
                logger.error('所有点击方式均失败');
              }
            }

            if (clickSuccess) {
              // 等待剪贴板内容变化
              logger.info('⏳ 等待剪贴板内容更新...');
              const newContent = await this.waitForClipboardChange(page, initialClipboard, 10000);
              if (newContent) {
                logger.info('✓ 剪贴板内容已成功更新');
                return true;
              } else {
                logger.warn('⚠ 剪贴板内容未变化，可能复制失败');
              }
            }

            // 找到按钮并点击了，但剪贴板未变化，也返回 true
            // 让后续的 readClipboard() 再次尝试读取
            return true;
          }
        } catch (error) {
          // 忽略单个按钮的错误
          continue;
        }
      }

      logger.warn('未找到"复制订阅"按钮');
      return false;
    } catch (error) {
      logger.warn('点击"复制订阅"按钮失败:', error);
      return false;
    }
  }

  /**
   * 等待剪贴板内容变化
   */
  private async waitForClipboardChange(
    page: any,
    initialContent: string,
    timeout: number = 10000
  ): Promise<string | null> {
    try {
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 200));

        const newContent = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch {
            return null;
          }
        });

        if (newContent && newContent !== initialContent) {
          logger.info(`✓ 剪贴板内容已变化: "${newContent.substring(0, 100)}"`);
          return newContent;
        }
      }

      return null;
    } catch (error) {
      logger.debug(`等待剪贴板变化超时或失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 读取浏览器剪贴板内容
   */
  private async readClipboard(page: any): Promise<string | null> {
    try {
      logger.info('尝试从剪贴板读取订阅地址...');

      const context = page.browserContext();
      await context.overridePermissions(page.url(), ['clipboard-read', 'clipboard-write']);

      // 多次尝试读取剪贴板
      const maxRetries = 5;
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 500));

        const clipboardText = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch (error) {
            return null;
          }
        });

        if (clipboardText && clipboardText.trim()) {
          logger.info(`✓ 第 ${i + 1} 次尝试成功读取剪贴板`);
          logger.info(`📋 剪贴板原始内容: ${clipboardText.substring(0, 200)}`);

          const url = this.extractUrlFromText(clipboardText.trim());
          if (url) {
            logger.info(`✓ 成功提取 URL: ${url}`);
            return url;
          }

          // 如果提取失败，直接返回剪贴板内容（可能本身就是 URL）
          const trimmed = clipboardText.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            logger.info(`✓ 剪贴板内容本身就是 URL: ${trimmed}`);
            return trimmed;
          }
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

  /**
   * 从文本中提取URL
   */
  private extractUrlFromText(text: string): string | null {
    const match = text.match(/https?:\/\/[^\s'"<>]+/i);
    if (!match) {
      return null;
    }

    const cleaned = match[0].replace(/[)\].,;]+$/g, '');
    try {
      const parsed = new URL(cleaned);
      return parsed.toString();
    } catch {
      return null;
    }
  }

  /**
   * 验证是否是有效的订阅URL
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
        'vip',
        'user',
        'api',
        'token',
      ];

      const urlLower = url.toLowerCase();
      return subscriptionKeywords.some(keyword => urlLower.includes(keyword));
    } catch {
      return false;
    }
  }

  /**
   * 计算URL转换规则
   * 比较正确的订阅URL（剪贴板）与API返回的URL，找出转换模式
   */
  private calculateUrlTransformation(
    correctUrl: string,
    apiUrl: string
  ): void {
    try {
      logger.info('开始计算URL转换规则...');
      logger.info(`  正确URL (剪贴板): ${correctUrl}`);
      logger.info(`  API返回URL: ${apiUrl}`);

      const correct = new URL(correctUrl);
      const api = new URL(apiUrl);

      const differences: string[] = [];

      // 比较协议
      if (correct.protocol !== api.protocol) {
        differences.push(`协议: ${api.protocol.replace(':', '')} → ${correct.protocol.replace(':', '')}`);
      }

      // 比较主机名
      if (correct.hostname !== api.hostname) {
        differences.push(`主机: ${api.hostname} → ${correct.hostname}`);
      }

      // 比较端口
      if (correct.port !== api.port) {
        const apiPort = api.port || (api.protocol === 'https:' ? '443' : '80');
        const correctPort = correct.port || (correct.protocol === 'https:' ? '443' : '80');
        if (apiPort !== correctPort) {
          differences.push(`端口: ${apiPort} → ${correctPort}`);
        }
      }

      // 比较路径
      if (correct.pathname !== api.pathname) {
        differences.push(`路径: ${api.pathname} → ${correct.pathname}`);
      }

      // 比较查询参数
      if (correct.search !== api.search) {
        if (api.search && !correct.search) {
          differences.push(`移除查询参数: ${api.search}`);
        } else if (!api.search && correct.search) {
          differences.push(`添加查询参数: ${correct.search}`);
        } else {
          differences.push(`查询参数: ${api.search} → ${correct.search}`);
        }
      }

      if (differences.length > 0) {
        const transformRule = `需要转换：${differences.join('；')}`;

        this.testReport.urlTransformPattern = {
          apiFormat: apiUrl,
          correctFormat: correctUrl,
          transformRule
        };

        logger.info(`✓ URL转换规则: ${transformRule}`);
      } else {
        logger.info('✓ API返回的URL格式正确，无需转换');
        this.testReport.urlTransformPattern = {
          apiFormat: apiUrl,
          correctFormat: correctUrl,
          transformRule: '无需转换，格式完全一致'
        };
      }
    } catch (error) {
      logger.warn('计算URL转换规则失败:', error);
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      // 停止网络监听
      if (this.networkListener && this.browser) {
        const page = await this.browser.getPage();
        this.networkListener.stopListening(page);
      }

      if (this.browser) {
        await this.browser.close();
        logger.info('浏览器已关闭');
      }
    } catch (error) {
      logger.warn('清理资源时出错:', error);
    }
  }
}
