import { Page } from 'puppeteer-core';
import { logger } from '../utils/logger.js';
import { SiteConfig } from '../types/index.js';

/**
 * 登录检测策略
 */
export interface LoginDetectionStrategy {
  /** URL 变化模式(登录后跳转) */
  urlPattern?: RegExp;
  /** 页面元素出现(如用户名、头像) */
  selector?: string;
  /** 特定网络请求出现 */
  networkRequest?: RegExp;
  /** Cookie 包含特定值 */
  cookieName?: string;
}

/**
 * 登录检测器
 * 智能检测用户是否完成登录
 */
export class LoginDetector {
  /**
   * 等待用户登录完成
   */
  async waitForLogin(
    page: Page,
    siteConfig: SiteConfig,
    timeout: number = 120000
  ): Promise<void> {
    try {
      logger.info('等待用户登录...');
      console.log('\n⏳ 请在浏览器中完成登录操作...');
      console.log('   系统将自动检测登录完成状态\n');

      const startTime = Date.now();
      const strategies = this.buildStrategies(siteConfig);

      // 创建多个检测策略的 Promise
      const detectionPromises: Promise<string>[] = [];

      // 策略1: URL 变化检测
      if (strategies.urlPattern) {
        detectionPromises.push(
          this.detectByUrlChange(page, strategies.urlPattern).then(() => 'URL变化')
        );
      }

      // 策略2: 元素出现检测
      if (strategies.selector) {
        detectionPromises.push(
          this.detectBySelector(page, strategies.selector, timeout).then(
            () => '用户元素出现'
          )
        );
      }

      // 策略3: 网络请求检测
      if (strategies.networkRequest) {
        detectionPromises.push(
          this.detectByNetworkRequest(page, strategies.networkRequest, timeout).then(
            () => '用户API请求'
          )
        );
      }

      // 策略4: Cookie 检测
      if (strategies.cookieName) {
        detectionPromises.push(
          this.detectByCookie(page, strategies.cookieName, timeout).then(() => 'Cookie设置')
        );
      }

      // 通用策略: 检测常见登录后特征
      detectionPromises.push(
        this.detectByCommonPatterns(page, timeout).then((method) => `通用检测(${method})`)
      );

      // 超时控制
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(new Error('登录检测超时,请重试'));
        }, timeout);
      });

      // 竞速:任何一个策略成功即认为登录完成
      const method = await Promise.race([...detectionPromises, timeoutPromise]);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`✓ 检测到登录完成(${method}) - 用时 ${elapsed}秒`);
      console.log(`\n✅ 登录成功! (检测方式: ${method})\n`);

      // 等待一小段时间确保数据加载完成
      await page.waitForTimeout(2000);
    } catch (error) {
      logger.error('登录检测失败', error);
      throw error;
    }
  }

  /**
   * 构建检测策略
   */
  private buildStrategies(siteConfig: SiteConfig): LoginDetectionStrategy {
    const url = new URL(siteConfig.url);
    const strategy: LoginDetectionStrategy = {};

    // 根据站点配置构建策略
    if (siteConfig.loginDetection) {
      strategy.urlPattern = siteConfig.loginDetection.urlPattern
        ? new RegExp(siteConfig.loginDetection.urlPattern)
        : undefined;
      strategy.selector = siteConfig.loginDetection.selector;
      strategy.networkRequest = siteConfig.loginDetection.networkRequest
        ? new RegExp(siteConfig.loginDetection.networkRequest)
        : undefined;
      strategy.cookieName = siteConfig.loginDetection.cookieName;
    }

    // 默认策略:检测从 /login 跳转
    if (!strategy.urlPattern && url.pathname.includes('login')) {
      strategy.urlPattern = new RegExp(`^(?!.*login).*${url.hostname}`, 'i');
    }

    return strategy;
  }

  /**
   * 通过 URL 变化检测
   */
  private async detectByUrlChange(page: Page, urlPattern: RegExp): Promise<void> {
    const currentUrl = page.url();

    // 如果当前 URL 已经匹配,直接返回
    if (urlPattern.test(currentUrl)) {
      return;
    }

    // 等待 URL 变化
    await page.waitForFunction(
      (pattern: string) => {
        return new RegExp(pattern).test(window.location.href);
      },
      { timeout: 120000 },
      urlPattern.source
    );
  }

  /**
   * 通过选择器检测
   */
  private async detectBySelector(
    page: Page,
    selector: string,
    timeout: number
  ): Promise<void> {
    await page.waitForSelector(selector, { timeout, visible: true });
  }

  /**
   * 通过网络请求检测
   */
  private async detectByNetworkRequest(
    page: Page,
    pattern: RegExp,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        page.removeListener('response', handler);
        reject(new Error('网络请求检测超时'));
      }, timeout);

      const handler = (response: any) => {
        if (pattern.test(response.url())) {
          clearTimeout(timer);
          page.removeListener('response', handler);
          resolve();
        }
      };

      page.on('response', handler);
    });
  }

  /**
   * 通过 Cookie 检测
   */
  private async detectByCookie(
    page: Page,
    cookieName: string,
    timeout: number
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const cookies = await page.cookies();
      if (cookies.some((c) => c.name === cookieName)) {
        return;
      }
      await page.waitForTimeout(500);
    }

    throw new Error('Cookie检测超时');
  }

  /**
   * 通用模式检测
   */
  private async detectByCommonPatterns(page: Page, timeout: number): Promise<string> {
    const commonSelectors = [
      { selector: '[class*="user"]', desc: '用户信息' },
      { selector: '[class*="avatar"]', desc: '用户头像' },
      { selector: '[class*="profile"]', desc: '个人资料' },
      { selector: '[class*="dashboard"]', desc: '控制台' },
      { selector: '[href*="logout"]', desc: '退出按钮' },
      { selector: '[href*="signout"]', desc: '退出按钮' },
    ];

    const promises = commonSelectors.map(({ selector, desc }) =>
      page
        .waitForSelector(selector, { timeout, visible: true })
        .then(() => desc)
        .catch(() => null)
    );

    const results = await Promise.race([
      ...promises,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout)),
    ]);

    if (results) {
      return results;
    }

    throw new Error('未检测到登录完成');
  }
}
