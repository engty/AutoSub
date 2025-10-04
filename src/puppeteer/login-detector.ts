import { Page } from 'puppeteer-core';
import { logger } from '../utils/logger.js';
import { AutoSubError, ErrorCode, SiteConfig } from '../types/index.js';

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
  ): Promise<string> {
    const cleanupCallbacks: Array<() => void> = [];

    try {
      const effectiveTimeout = timeout;

      logger.info('等待用户登录...(用户可随时关闭浏览器取消)');
      console.log('\n⏳ 请在浏览器中完成登录操作...');
      console.log('   系统将自动检测登录完成状态，您也可以直接关闭浏览器以取消本次操作\n');

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
          this.detectBySelector(page, strategies.selector, effectiveTimeout).then(
            () => '用户元素出现'
          )
        );
      }

      // 策略3: 网络请求检测
      if (strategies.networkRequest) {
        detectionPromises.push(
          this.detectByNetworkRequest(page, strategies.networkRequest, effectiveTimeout).then(
            () => '用户API请求'
          )
        );
      }

      // 策略4: Cookie 检测
      if (strategies.cookieName) {
        detectionPromises.push(
          this.detectByCookie(page, strategies.cookieName, effectiveTimeout).then(
            () => 'Cookie设置'
          )
        );
      }

      // 通用策略: 检测常见登录后特征
      detectionPromises.push(
        this.detectByCommonPatterns(page, effectiveTimeout).then((method) => `通用检测(${method})`)
      );

      // 浏览器关闭检测
      const pageClosedPromise = new Promise<string>((_, reject) => {
        const handleClose = () => {
          reject(
            new AutoSubError(
              ErrorCode.USER_CANCELLED,
              '用户关闭浏览器窗口，已取消本次登录流程'
            )
          );
        };
        page.once('close', handleClose);
        cleanupCallbacks.push(() => page.off('close', handleClose));
      });

      // 竞速:任何一个策略成功即认为登录完成
      const method = await Promise.race([...detectionPromises, pageClosedPromise]);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`✓ 检测到登录完成(${method}) - 用时 ${elapsed}秒`);
      console.log(`\n✅ 登录成功! (检测方式: ${method})\n`);

      // 等待一小段时间确保数据加载完成
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 尝试关闭可能的广告弹窗
      await this.closeAnyModals(page);
      return method;
    } catch (error) {
      if (error instanceof AutoSubError && error.code === ErrorCode.USER_CANCELLED) {
        logger.warn('检测到用户主动关闭浏览器，已取消本次更新');
        throw error;
      }
      logger.error('登录检测失败', error);
      throw error;
    } finally {
      cleanupCallbacks.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
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
        page.off('response', handler);
        reject(new Error('网络请求检测超时'));
      }, timeout);

      const handler = (response: any) => {
        if (pattern.test(response.url())) {
          clearTimeout(timer);
          page.off('response', handler);
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
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error('Cookie检测超时');
  }

  /**
   * 通用模式检测
   */
  private async detectByCommonPatterns(page: Page, timeout: number): Promise<string> {
    const commonSelectors = [
      // 用户相关
      { selector: '[class*="user"]', desc: '用户信息' },
      { selector: '[class*="avatar"]', desc: '用户头像' },
      { selector: '[class*="profile"]', desc: '个人资料' },
      { selector: '[id*="user"]', desc: '用户ID元素' },
      // 控制台/仪表盘
      { selector: '[class*="dashboard"]', desc: '控制台' },
      { selector: '[class*="panel"]', desc: '面板' },
      { selector: '[class*="console"]', desc: '控制台' },
      // 退出/登出按钮
      { selector: '[href*="logout"]', desc: '退出按钮' },
      { selector: '[href*="signout"]', desc: '登出按钮' },
      { selector: 'a[href*="sign-out"]', desc: '退出链接' },
      // 订阅/节点相关(VPN 特有)
      { selector: '[class*="subscription"]', desc: '订阅信息' },
      { selector: '[class*="node"]', desc: '节点列表' },
      { selector: '[class*="traffic"]', desc: '流量信息' },
    ];

    logger.debug('开始通用模式检测...');

    const promises = commonSelectors.map(({ selector, desc }) =>
      page
        .waitForSelector(selector, { timeout, visible: true })
        .then(() => {
          logger.debug(`✓ 检测成功: ${desc}`);
          return desc;
        })
        .catch(() => {
          logger.debug(`✗ 检测失败: ${desc}`);
          return null;
        })
    );

    // 额外添加 URL hash 变化检测(适用于 SPA)
    const hashChangePromise = this.detectHashChange(page, timeout)
      .then(() => 'URL Hash变化')
      .catch(() => null);

    // 过滤掉 null 结果，只保留成功的检测
    // null 结果会被转换为永远 pending 的 Promise，不会影响 race
    const validPromises = [...promises, hashChangePromise].map(p =>
      p.then(result => {
        if (result) {
          return result; // 成功的检测
        } else {
          // null 结果转换为永远 pending 的 Promise，不会让 race 提前结束
          return new Promise<string>(() => {});
        }
      })
    );

    const results = await Promise.race([
      ...validPromises,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout)),
    ]);

    if (results) {
      logger.info(`✓ 通用检测成功: ${results}`);
      return results;
    }

    // 最后尝试:获取页面信息用于调试
    const currentUrl = page.url();
    const pageTitle = await page.title();
    logger.error(`登录检测失败 - URL: ${currentUrl}, 标题: ${pageTitle}`);

    // 尝试获取页面中所有可见的文本,看看是否包含登录成功的迹象
    const bodyText = await page.evaluate(() => document.body.innerText);
    logger.debug(`页面文本(前200字符): ${bodyText.substring(0, 200)}`);

    throw new Error('未检测到登录完成');
  }

  /**
   * 检测 Hash 变化(适用于 SPA 应用)
   */
  private async detectHashChange(page: Page, timeout: number): Promise<void> {
    const initialHash = await page.evaluate(() => window.location.hash);
    logger.debug(`初始 Hash: ${initialHash}`);

    // 如果初始 hash 包含 login,等待它变化
    if (initialHash.includes('login')) {
      logger.debug('等待 Hash 从 login 变化...');
      await page.waitForFunction(
        (oldHash: string) => {
          const currentHash = window.location.hash;
          const changed = currentHash !== oldHash && !currentHash.includes('login');
          if (changed) {
            console.log(`Hash 已变化: ${oldHash} -> ${currentHash}`);
          }
          return changed;
        },
        { timeout },
        initialHash
      );
      const newHash = await page.evaluate(() => window.location.hash);
      logger.debug(`✓ Hash 已变化: ${initialHash} -> ${newHash}`);
    } else {
      logger.debug(`Hash 不包含 login (当前: ${initialHash}),跳过此检测`);
      throw new Error('Hash 不包含 login,跳过此检测');
    }
  }

  /**
   * 关闭可能的广告/弹窗
   */
  private async closeAnyModals(page: Page): Promise<void> {
    try {
      logger.debug('尝试关闭广告弹窗...');

      // 方法1: 按 ESC 键关闭弹窗
      await page.keyboard.press('Escape');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 方法2: 尝试查找并点击常见的关闭按钮
      const closeSelectors = [
        'button[class*="close"]',
        '[class*="modal"] [class*="close"]',
        '[class*="dialog"] [class*="close"]',
        '.modal-close',
        '.close-btn',
        '[aria-label="Close"]',
        '[aria-label="关闭"]',
      ];

      for (const selector of closeSelectors) {
        try {
          const closeButton = await page.$(selector);
          if (closeButton) {
            await closeButton.click();
            logger.debug(`✓ 点击关闭按钮: ${selector}`);
            await new Promise((resolve) => setTimeout(resolve, 500));
            break;
          }
        } catch {
          // 忽略错误,继续尝试下一个
        }
      }

      logger.debug('✓ 广告弹窗处理完成');
    } catch (error) {
      logger.debug('处理广告弹窗时出错(忽略):', error);
    }
  }
}
