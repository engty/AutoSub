import { PuppeteerBrowser } from '../puppeteer/index.js';
import { getConfigManager, ConfigManager } from '../config/manager.js';
import { readCredentials, writeCredentials } from '../credentials/manager.js';
import { getCookieExpiryInfo, compareCookieExpiry, formatExpiryInfo } from '../credentials/cookie-expiry.js';
import { logger } from '../utils/logger.js';
import { SiteConfig, ErrorCode, AutoSubError } from '../types/index.js';

/**
 * Cookie刷新结果
 */
export interface CookieRefreshResult {
  success: boolean;
  siteId: string;
  siteName: string;
  refreshed: boolean; // Cookie是否被服务器刷新
  oldExpiryDays?: number;
  newExpiryDays?: number;
  error?: string;
}

/**
 * Cookie刷新服务
 * 专门用于轻量级Cookie刷新，保持登录状态
 */
export class CookieRefreshService {
  private browser!: PuppeteerBrowser;
  private configManager: ConfigManager;

  constructor() {
    this.configManager = getConfigManager();
  }

  /**
   * 初始化服务
   */
  async initialize(headless: boolean = false): Promise<void> {
    try {
      logger.info(`初始化Cookie刷新服务（${headless ? '无头' : '有头'}模式）...`);

      this.browser = new PuppeteerBrowser();
      await this.browser.launch({ headless });

      logger.info('✓ Cookie刷新服务初始化完成');
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.BROWSER_LAUNCH_FAILED,
        `Cookie刷新服务初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 刷新单个站点的Cookie
   */
  async refreshSite(siteId: string): Promise<CookieRefreshResult> {
    const site = this.configManager.getSiteById(siteId);

    if (!site) {
      return {
        success: false,
        siteId,
        siteName: 'Unknown',
        refreshed: false,
        error: '站点不存在',
      };
    }

    return await this.processSiteRefresh(site);
  }

  /**
   * 刷新所有需要刷新的站点
   */
  async refreshAll(forceAll: boolean = false): Promise<CookieRefreshResult[]> {
    const sites = this.configManager.getSites().filter((s) => s.credentialFile);

    if (sites.length === 0) {
      logger.warn('没有保存凭证的站点');
      return [];
    }

    logger.info(`开始检查 ${sites.length} 个站点的Cookie状态...`);

    const results: CookieRefreshResult[] = [];

    for (const site of sites) {
      // 检查是否需要刷新
      if (!forceAll) {
        const expiryInfo = await getCookieExpiryInfo(site.id);

        if (!expiryInfo.needsRefresh && !expiryInfo.hasExpired) {
          logger.info(`跳过 ${site.name}: Cookie ${formatExpiryInfo(expiryInfo)}`);
          results.push({
            success: true,
            siteId: site.id,
            siteName: site.name,
            refreshed: false,
            oldExpiryDays: expiryInfo.daysLeft,
            newExpiryDays: expiryInfo.daysLeft,
          });
          continue;
        }
      }

      const result = await this.processSiteRefresh(site);
      results.push(result);

      // 站点间延迟，避免请求过快
      await this.delay(3000);
    }

    return results;
  }

  /**
   * 处理站点Cookie刷新（核心流程）
   */
  private async processSiteRefresh(site: SiteConfig): Promise<CookieRefreshResult> {
    try {
      logger.info(`\n━━━━ 开始刷新Cookie: ${site.name} ━━━━`);

      // 1. 读取现有Cookie
      const oldCredentials = await readCredentials(site.id);

      if (!oldCredentials || !Array.isArray(oldCredentials.cookies) || oldCredentials.cookies.length === 0) {
        logger.warn(`站点无保存凭证: ${site.name}`);
        return {
          success: false,
          siteId: site.id,
          siteName: site.name,
          refreshed: false,
          error: '无保存凭证',
        };
      }

      // 获取旧的过期信息
      const oldExpiryInfo = await getCookieExpiryInfo(site.id);
      logger.info(`当前Cookie状态: ${formatExpiryInfo(oldExpiryInfo)}`);

      // 2. 注入Cookie并访问站点
      const page = this.browser.getPage();

      // 注入Cookie
      const origin = (() => {
        try {
          const url = new URL(site.url);
          return `${url.protocol}//${url.hostname}`;
        } catch {
          return undefined;
        }
      })();

      const cookieParams = oldCredentials.cookies.map((cookie: any) => {
        const param: any = {
          name: cookie.name,
          value: cookie.value,
        };

        if (cookie.domain) param.domain = cookie.domain;
        if (cookie.path) param.path = cookie.path;
        if (typeof cookie.expires === 'number') param.expires = cookie.expires;
        if (typeof cookie.secure === 'boolean') param.secure = cookie.secure;
        if (typeof cookie.httpOnly === 'boolean') param.httpOnly = cookie.httpOnly;
        if (cookie.sameSite) param.sameSite = cookie.sameSite;
        if (!param.domain && origin) {
          param.url = origin;
        }
        return param;
      });

      await page.setCookie(...cookieParams);
      logger.info('✓ 已注入历史Cookie');

      // 访问站点（触发服务器刷新Cookie）
      logger.info(`访问站点: ${site.url}`);
      await this.browser.goto(site.url);
      await this.delay(3000); // 等待页面加载

      // 3. 捕获新Cookie
      const newCookies = await page.cookies();
      logger.info(`✓ 捕获到 ${newCookies.length} 个Cookie`);

      // 4. 对比Cookie是否被刷新
      const hasRefreshed = compareCookieExpiry(oldCredentials.cookies, newCookies);

      // 5. 保存新Cookie
      const newCredentials = {
        cookies: newCookies,
        localStorage: oldCredentials.localStorage || {},
        sessionStorage: oldCredentials.sessionStorage || {},
        updatedAt: new Date().toISOString(),
      };

      writeCredentials(site.id, newCredentials);

      // 6. 获取新的过期信息
      const newExpiryInfo = await getCookieExpiryInfo(site.id);

      if (hasRefreshed) {
        logger.info(`✓ ${site.name}: Cookie已刷新！`);
        logger.info(`  旧: ${formatExpiryInfo(oldExpiryInfo)}`);
        logger.info(`  新: ${formatExpiryInfo(newExpiryInfo)}`);
      } else {
        logger.info(`○ ${site.name}: Cookie未变化（该站点可能不支持自动续期）`);
      }

      // 7. 更新站点配置
      this.configManager.updateSite(site.id, {
        credentialsUpdatedAt: new Date().toISOString(),
      });
      this.configManager.save();

      return {
        success: true,
        siteId: site.id,
        siteName: site.name,
        refreshed: hasRefreshed,
        oldExpiryDays: oldExpiryInfo.daysLeft,
        newExpiryDays: newExpiryInfo.daysLeft,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Cookie刷新失败: ${site.name}`, error);

      return {
        success: false,
        siteId: site.id,
        siteName: site.name,
        refreshed: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }
      logger.info('✓ Cookie刷新服务资源清理完成');
    } catch (error) {
      logger.error('Cookie刷新服务资源清理失败', error);
    }
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
