import { PageManager } from './page.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError } from '../types/index.js';

/**
 * 凭证数据接口
 */
export interface CredentialData {
  cookies: string;
  localStorage: string;
  sessionStorage: string;
}

/**
 * 凭证捕获器
 * 负责捕获页面的 Cookie、localStorage 和 sessionStorage
 */
export class CredentialCapture {
  private pageManager: PageManager;

  constructor(pageManager: PageManager) {
    this.pageManager = pageManager;
  }

  /**
   * 捕获所有凭证数据
   */
  async captureAll(): Promise<CredentialData> {
    try {
      logger.info('开始捕获凭证数据...');

      const [cookies, localStorage, sessionStorage] = await Promise.all([
        this.captureCookies(),
        this.captureLocalStorage(),
        this.captureSessionStorage(),
      ]);

      logger.info('✓ 凭证数据捕获完成');

      return {
        cookies,
        localStorage,
        sessionStorage,
      };
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.CREDENTIAL_CAPTURE_FAILED,
        `捕获凭证失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 捕获 Cookies
   */
  async captureCookies(): Promise<string> {
    try {
      const script = `() => {
        return document.cookie;
      }`;

      const cookies = await this.pageManager.evaluateScript<string>(script);
      logger.debug(`捕获到 Cookie: ${cookies.substring(0, 100)}...`);

      return cookies || '';
    } catch (error) {
      logger.error('捕获 Cookie 失败', error);
      return '';
    }
  }

  /**
   * 捕获 localStorage
   */
  async captureLocalStorage(): Promise<string> {
    try {
      const script = `() => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            data[key] = localStorage.getItem(key);
          }
        }
        return JSON.stringify(data);
      }`;

      const data = await this.pageManager.evaluateScript<string>(script);
      logger.debug(`捕获到 localStorage: ${data.substring(0, 100)}...`);

      return data || '{}';
    } catch (error) {
      logger.error('捕获 localStorage 失败', error);
      return '{}';
    }
  }

  /**
   * 捕获 sessionStorage
   */
  async captureSessionStorage(): Promise<string> {
    try {
      const script = `() => {
        const data = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            data[key] = sessionStorage.getItem(key);
          }
        }
        return JSON.stringify(data);
      }`;

      const data = await this.pageManager.evaluateScript<string>(script);
      logger.debug(`捕获到 sessionStorage: ${data.substring(0, 100)}...`);

      return data || '{}';
    } catch (error) {
      logger.error('捕获 sessionStorage 失败', error);
      return '{}';
    }
  }

  /**
   * 注入凭证数据（用于恢复登录状态）
   */
  async injectCredentials(credentials: CredentialData): Promise<void> {
    try {
      logger.info('开始注入凭证数据...');

      await Promise.all([
        this.injectCookies(credentials.cookies),
        this.injectLocalStorage(credentials.localStorage),
        this.injectSessionStorage(credentials.sessionStorage),
      ]);

      logger.info('✓ 凭证数据注入完成');
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.CREDENTIAL_CAPTURE_FAILED,
        `注入凭证失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 注入 Cookies
   */
  private async injectCookies(cookies: string): Promise<void> {
    if (!cookies) return;

    try {
      const script = `() => {
        const cookies = ${JSON.stringify(cookies)};
        document.cookie = cookies;
      }`;

      await this.pageManager.evaluateScript(script);
      logger.debug('Cookie 注入成功');
    } catch (error) {
      logger.error('注入 Cookie 失败', error);
    }
  }

  /**
   * 注入 localStorage
   */
  private async injectLocalStorage(data: string): Promise<void> {
    if (!data || data === '{}') return;

    try {
      const script = `() => {
        const data = ${data};
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      }`;

      await this.pageManager.evaluateScript(script);
      logger.debug('localStorage 注入成功');
    } catch (error) {
      logger.error('注入 localStorage 失败', error);
    }
  }

  /**
   * 注入 sessionStorage
   */
  private async injectSessionStorage(data: string): Promise<void> {
    if (!data || data === '{}') return;

    try {
      const script = `() => {
        const data = ${data};
        Object.entries(data).forEach(([key, value]) => {
          sessionStorage.setItem(key, value);
        });
      }`;

      await this.pageManager.evaluateScript(script);
      logger.debug('sessionStorage 注入成功');
    } catch (error) {
      logger.error('注入 sessionStorage 失败', error);
    }
  }

  /**
   * 清空所有存储
   */
  async clearAll(): Promise<void> {
    try {
      const script = `() => {
        document.cookie.split(';').forEach(c => {
          document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
        });
        localStorage.clear();
        sessionStorage.clear();
      }`;

      await this.pageManager.evaluateScript(script);
      logger.info('✓ 已清空所有存储');
    } catch (error) {
      logger.error('清空存储失败', error);
    }
  }
}
