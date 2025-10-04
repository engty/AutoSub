import { PuppeteerBrowser } from '../puppeteer/index.js';
import { LoginDetector } from '../puppeteer/login-detector.js';
import { ApiDetector } from '../subscription/api-detector.js';
import { SubscriptionValidator } from '../subscription/validator.js';
import { getConfigManager } from '../config/manager.js';
import { logger } from '../utils/logger.js';
import { TestReport, TestStep } from '../types/test-report.js';
import { Credentials } from '../types/index.js';

/**
 * 站点兼容性测试服务
 * 复用添加站点的流程，但不保存任何数据
 */
export class SiteTestService {
  private browser!: PuppeteerBrowser;
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
      logger.info(`开始测试站点: ${this.url}`);

      // 步骤1: 启动浏览器
      await this.startBrowser();

      // 步骤2: 打开站点并等待登录
      await this.waitForLogin();

      // 步骤3: 捕获凭证
      await this.captureCredentials();

      // 步骤4: 检测API
      await this.detectApi();

      // 步骤5: 验证订阅地址（如果获取到）
      if (this.testReport.subscriptionUrl) {
        await this.validateSubscription();
      }

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

      // 打开站点
      await page.goto(this.url, { waitUntil: 'networkidle0', timeout: 30000 });
      logger.info(`已打开站点: ${this.url}`);
      logger.info('等待用户登录...');

      // 获取AI配置
      const configManager = getConfigManager();
      const aiConfig = configManager.getAIConfig();

      // 创建登录检测器
      const loginDetector = new LoginDetector(page, aiConfig);

      // 等待登录（120秒超时）
      const loginResult = await loginDetector.waitForLogin(this.url, 120000);

      if (loginResult.success) {
        const duration = Date.now() - startTime;
        this.testReport.loginDetected = true;
        this.testReport.loginMethod = loginResult.method;
        this.testReport.loginDuration = duration;

        this.addStep(
          '登录检测',
          'success',
          `登录成功（检测方式: ${loginResult.method}）`,
          duration
        );
        logger.info(`✓ 登录成功（检测方式: ${loginResult.method}）`);
      } else {
        const duration = Date.now() - startTime;
        const errorMsg = `登录检测失败: ${loginResult.error || '未知错误'}`;
        this.addStep('登录检测', 'failed', errorMsg, duration);
        this.testReport.errors.push(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `登录过程出错: ${error instanceof Error ? error.message : String(error)}`;
      this.addStep('登录检测', 'failed', errorMsg, duration);
      this.testReport.errors.push(errorMsg);
      throw error;
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
   * 步骤4: 检测API
   */
  private async detectApi(): Promise<void> {
    const startTime = Date.now();
    try {
      const page = await this.browser.getPage();

      // 准备凭证数据
      const cookies = await page.cookies();
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

      const credentials: Credentials = {
        cookies,
        localStorage,
        sessionStorage: {}
      };

      // 创建API检测器
      const apiDetector = new ApiDetector(page, this.url);

      // 开始检测
      const result = await apiDetector.detect(credentials);

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

        if (result.subscriptionUrl) {
          this.testReport.subscriptionUrl = result.subscriptionUrl;
          this.testReport.subscriptionExtracted = true;
          this.testReport.extractionMethod = 'api';
        }

        const duration = Date.now() - startTime;
        this.addStep(
          'API检测',
          'success',
          `检测到订阅API（认证方式: ${result.config.authSource}）`,
          duration,
          result.config
        );

        logger.info(`✓ API检测成功: ${result.config.url}`);
      } else {
        const duration = Date.now() - startTime;
        this.addStep(
          'API检测',
          'failed',
          '未检测到订阅API',
          duration
        );
        this.testReport.warnings.push('未检测到订阅API，可能需要手动配置');
        logger.warn('未检测到订阅API');
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

    // 订阅提取和验证 (20分)
    if (this.testReport.subscriptionExtracted && this.testReport.subscriptionValid) {
      score += 20;
      factors.push('订阅验证成功');
    } else if (this.testReport.subscriptionExtracted) {
      score += 10;
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
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('浏览器已关闭');
      }
    } catch (error) {
      logger.warn('清理资源时出错:', error);
    }
  }
}
