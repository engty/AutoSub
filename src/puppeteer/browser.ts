import puppeteer, { Browser, Page } from 'puppeteer-core';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError } from '../types/index.js';
import os from 'os';
import fs from 'fs-extra';
import path from 'path';

/**
 * Chrome 可执行文件路径检测
 */
function getChromePath(): string {
  const platform = os.platform();

  const possiblePaths: Record<string, string[]> = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ],
  };

  const paths = possiblePaths[platform] || [];

  for (const chromePath of paths) {
    if (fs.existsSync(chromePath)) {
      logger.debug(`找到 Chrome: ${chromePath}`);
      return chromePath;
    }
  }

  throw new AutoSubError(
    ErrorCode.BROWSER_LAUNCH_FAILED,
    `未找到 Chrome 浏览器，请确保已安装 Google Chrome。\n` +
      `系统: ${platform}\n` +
      `已检查路径: ${paths.join(', ')}`
  );
}

/**
 * Puppeteer 浏览器管理器
 */
export class PuppeteerBrowser {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private userDataDir: string;

  constructor() {
    // 使用 ~/.autosub/chrome-profile 保存用户数据(Cookie等)
    this.userDataDir = path.join(os.homedir(), '.autosub', 'chrome-profile');
  }

  /**
   * 启动浏览器
   */
  async launch(options?: { headless?: boolean }): Promise<void> {
    try {
      const headless = options?.headless ?? false;
      logger.info(`正在启动 Chrome 浏览器（${headless ? '无头' : '有头'}模式）...`);

      const executablePath = getChromePath();

      // 确保用户数据目录存在
      await fs.ensureDir(this.userDataDir);

      this.browser = await puppeteer.launch({
        executablePath,
        headless, // 支持无头模式
        userDataDir: this.userDataDir, // 保存 Cookie
        defaultViewport: {
          width: 1280,
          height: 800,
        },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled', // 隐藏自动化特征
        ],
      });

      // 创建新页面
      const pages = await this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

      // 设置用户代理,移除 headless 标识
      await this.page.setUserAgent(
        (await this.page.evaluate(() => navigator.userAgent)).replace(
          'HeadlessChrome',
          'Chrome'
        )
      );

      logger.info('✓ Chrome 浏览器启动成功');
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.BROWSER_LAUNCH_FAILED,
        `浏览器启动失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 获取当前页面
   */
  getPage(): Page {
    if (!this.page) {
      throw new AutoSubError(ErrorCode.BROWSER_NOT_INITIALIZED, '浏览器未初始化');
    }
    return this.page;
  }

  /**
   * 导航到 URL
   */
  async goto(url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' = 'domcontentloaded'): Promise<void> {
    const page = this.getPage();
    try {
      logger.info(`导航到: ${url}`);
      await page.goto(url, { waitUntil, timeout: 30000 });
      logger.info('✓ 页面加载完成');
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_NAVIGATION_FAILED,
        `页面导航失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 等待导航(用于登录后的跳转)
   */
  async waitForNavigation(options?: { url?: RegExp; timeout?: number }): Promise<void> {
    const page = this.getPage();
    try {
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: options?.timeout || 60000,
        ...options,
      });
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_NAVIGATION_FAILED,
        `等待导航失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 等待选择器出现
   */
  async waitForSelector(selector: string, timeout: number = 30000): Promise<void> {
    const page = this.getPage();
    try {
      await page.waitForSelector(selector, { timeout });
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `等待元素失败: ${selector}`,
        error
      );
    }
  }

  /**
   * 执行脚本
   */
  async evaluate<T>(script: string | ((...args: any[]) => T), ...args: any[]): Promise<T> {
    const page = this.getPage();
    try {
      return await page.evaluate(script, ...args);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `脚本执行失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 清除 Cookie(用于测试或重新登录)
   */
  async clearCookies(): Promise<void> {
    const page = this.getPage();
    try {
      const client = await page.createCDPSession();
      await client.send('Network.clearBrowserCookies');
      logger.info('✓ Cookie 已清除');
    } catch (error) {
      logger.warn('清除 Cookie 失败', error);
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        logger.info('✓ 浏览器已关闭');
      }
    } catch (error) {
      logger.error('关闭浏览器失败', error);
    }
  }

  /**
   * 获取 Browser 实例
   */
  getBrowser(): Browser {
    if (!this.browser) {
      throw new AutoSubError(ErrorCode.BROWSER_NOT_INITIALIZED, '浏览器未初始化');
    }
    return this.browser;
  }
}
