import { PuppeteerBrowser } from '../puppeteer/index.js';
import { PuppeteerApiExtractor } from '../subscription/puppeteer-api-extractor.js';
import { HttpApiExtractor } from '../subscription/http-api-extractor.js';
import { SubscriptionValidator } from '../subscription/validator.js';
import { ClashConfigUpdater, ClashUrlReplacer } from '../clash/index.js';
import { getConfigManager, ConfigManager } from '../config/manager.js';
import { CookieRefreshService } from './cookie-refresh.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, SiteConfig } from '../types/index.js';
import { parseSubscriptionUrl, isValidUrlComponents } from '../utils/subscription-url-parser.js';

/**
 * 更新结果
 */
export interface UpdateResult {
  success: boolean;
  siteId: string;
  siteName: string;
  subscriptionUrl?: string;
  nodeCount?: number;
  error?: string;
  credentialsCaptured: boolean;
  warning?: string; // CloudFlare拦截等警告信息
}

/**
 * 自动更新服务
 * 核心业务流程编排 (使用 Puppeteer)
 */
export class AutoUpdateService {
  private browser!: PuppeteerBrowser;
  private apiExtractor!: PuppeteerApiExtractor;
  private httpApiExtractor!: HttpApiExtractor;
  private validator!: SubscriptionValidator;
  private configManager: ConfigManager;
  private clashUpdater!: ClashConfigUpdater;
  private silentMode: boolean = false;

  constructor() {
    this.configManager = getConfigManager();
  }

  /**
   * 初始化服务
   * @param silent 静默模式：仅使用HTTP API，不打开浏览器
   */
  async initialize(silent: boolean = false): Promise<void> {
    this.silentMode = silent;
    try {
      logger.info(`初始化自动更新服务（${silent ? '静默' : '标准'}模式）...`);

      // 静默模式下不启动浏览器
      if (!silent) {
        // 1. 启动 Puppeteer 浏览器
        this.browser = new PuppeteerBrowser();
        await this.browser.launch();

        // 2. 获取 AI 配置
        const aiConfig = this.configManager.getAIConfig();

        // 3. 初始化浏览器相关模块(传递 AI 配置)
        this.apiExtractor = new PuppeteerApiExtractor(this.browser, this.configManager, aiConfig);
      }

      // HTTP API提取器和验证器总是需要
      this.httpApiExtractor = new HttpApiExtractor();
      this.validator = new SubscriptionValidator();

      // 4. 初始化 Clash 更新器
      const clashConfig = this.configManager.getConfig().clash;

      // 如果用户未设置配置路径，使用默认路径
      let configPath = clashConfig.configPath;
      if (!configPath) {
        const os = await import('os');
        const path = await import('path');
        configPath = path.join(os.homedir(), '.autosub', 'default.yaml');
        logger.info(`未设置 Clash 配置路径，使用默认路径: ${configPath}`);
      }

      this.clashUpdater = new ClashConfigUpdater(
        configPath,
        clashConfig.backupEnabled,
        clashConfig.backupCount
      );

      logger.info('✓ 服务初始化完成');
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.BROWSER_LAUNCH_FAILED,
        `服务初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 更新单个站点
   */
  async updateSite(siteId: string): Promise<UpdateResult> {
    const site = this.configManager.getSiteById(siteId);

    if (!site) {
      return {
        success: false,
        siteId,
        siteName: 'Unknown',
        error: '站点不存在',
        credentialsCaptured: false,
      };
    }

    return await this.processSiteUpdate(site);
  }

  /**
   * 更新所有启用的站点
   */
  async updateAll(): Promise<UpdateResult[]> {
    const sites = this.configManager.getSites().filter((s) => s.enabled);
    logger.info(`开始更新 ${sites.length} 个站点`);

    const results: UpdateResult[] = [];

    for (const site of sites) {
      const result = await this.processSiteUpdate(site);
      results.push(result);

      // 站点间延迟，避免请求过快
      await this.delay(3000);
    }

    return results;
  }

  /**
   * 更新所有有效站点(已保存订阅地址的站点)
   */
  async updateValidSites(): Promise<UpdateResult[]> {
    const sites = this.configManager
      .getSites()
      .filter((s) => s.enabled && s.subscriptionUrl);

    logger.info(`开始更新 ${sites.length} 个有效站点`);

    const results: UpdateResult[] = [];

    for (const site of sites) {
      const result = await this.processSiteUpdate(site);
      results.push(result);

      // 站点间延迟，避免请求过快
      await this.delay(3000);
    }

    return results;
  }

  /**
   * 处理站点更新（核心流程）
   */
  private async processSiteUpdate(site: SiteConfig): Promise<UpdateResult> {
    try {
      logger.info(`\n━━━━ 开始处理站点: ${site.name} ━━━━`);

      // 1. 提取订阅地址 (Puppeteer 自动处理登录)
      const subscriptionUrl = await this.extractSubscription(site);

      if (!subscriptionUrl) {
        throw new AutoSubError(
          ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
          '未能提取到订阅地址'
        );
      }

      // 2. 验证订阅
      let validation;
      let cloudflareBlocked = false;

      try {
        validation = await this.validator.validate(subscriptionUrl);
      } catch (error: any) {
        // 检查是否是CloudFlare拦截（403）
        const errorMsg = error.message || '';
        const isCloudFlare = (errorMsg.includes('403') || errorMsg.includes('403')) &&
                            (errorMsg.includes('CloudFlare') || errorMsg.includes('cloudflare') ||
                             errorMsg.includes('禁止访问') || errorMsg.includes('错误页面'));

        if (isCloudFlare) {
          logger.warn('⚠️ 订阅地址被CloudFlare拦截，跳过验证步骤');
          logger.info(`✓ 订阅地址: ${subscriptionUrl}`);
          cloudflareBlocked = true;
          // 创建一个基本的验证结果
          validation = {
            valid: true, // 标记为有效以允许保存
            nodeCount: 0,
            error: '站点使用CloudFlare拦截，无法进行订阅验证'
          };
        } else {
          throw error;
        }
      }

      // 如果验证返回无效且是CloudFlare拦截,也标记为cloudflareBlocked
      if (validation && !validation.valid && validation.error) {
        const errorMsg = validation.error;
        const isCloudFlare = (errorMsg.includes('403') || errorMsg.includes('403')) &&
                            (errorMsg.includes('CloudFlare') || errorMsg.includes('cloudflare') ||
                             errorMsg.includes('禁止访问') || errorMsg.includes('错误页面'));

        if (isCloudFlare) {
          logger.warn('⚠️ 订阅地址被CloudFlare拦截，跳过验证步骤');
          logger.info(`✓ 订阅地址: ${subscriptionUrl}`);
          cloudflareBlocked = true;
          validation.valid = true; // 标记为有效以允许保存
          validation.error = '站点使用CloudFlare拦截，无法进行订阅验证';
        }
      }

      if (!cloudflareBlocked && !validation.valid) {
        throw new AutoSubError(
          ErrorCode.SUBSCRIPTION_VALIDATION_FAILED,
          `订阅验证失败: ${validation.error}`
        );
      }

      // 3. 更新配置
      await this.updateSiteConfig(site, subscriptionUrl);

      // 4. 更新 Clash（若验证返回可用配置且非CloudFlare拦截）
      if (!cloudflareBlocked && validation.config) {
        await this.clashUpdater.mergeConfig(validation.config);
      } else if (cloudflareBlocked) {
        logger.info('CloudFlare拦截，跳过Clash配置合并');
      } else {
        logger.info('订阅内容未提供 Clash 配置，跳过合并');
      }

      logger.info(`✓ 站点更新成功: ${site.name}`);

      return {
        success: true,
        siteId: site.id,
        siteName: site.name,
        subscriptionUrl,
        nodeCount: validation.nodeCount,
        credentialsCaptured: true, // Puppeteer 自动保存 Cookie
        warning: cloudflareBlocked ? '站点使用CloudFlare拦截，无法进行订阅验证' : undefined,
      };
    } catch (error) {
      if (error instanceof AutoSubError && error.code === ErrorCode.USER_CANCELLED) {
        logger.info(`用户取消了站点更新: ${site.name}`);
        throw error;
      }
      const errorMessage =
        error instanceof AutoSubError
          ? error.message
          : `未知错误: ${error instanceof Error ? error.message : String(error)}`;

      logger.error(`站点更新失败: ${site.name}`, error);

      return {
        success: false,
        siteId: site.id,
        siteName: site.name,
        error: errorMessage,
        credentialsCaptured: false,
      };
    }
  }

  /**
   * 提取订阅地址
   */
  private async extractSubscription(site: SiteConfig): Promise<string | null> {
    try {
      // 优先级1: 尝试使用HTTP API静默提取（如果已配置）
      if (site.api) {
        logger.info('检测到API配置，尝试静默HTTP提取...');
        try {
          const httpUrl = await this.httpApiExtractor.extractFromSite(site);
          if (httpUrl) {
            logger.info('✓ HTTP API静默提取成功');
            return httpUrl;
          }
        } catch (error: any) {
          // 检测是否为Cookie过期错误
          if (error.code === 'AUTH_EXPIRED') {
            logger.warn('检测到Cookie已过期，尝试自动刷新...');

            if (this.silentMode) {
              // 静默模式：自动使用headless模式刷新Cookie
              try {
                await this.autoRefreshCookieInSilentMode(site);

                // 刷新成功后重试API请求
                logger.info('Cookie刷新成功，重试HTTP API提取...');
                const httpUrl = await this.httpApiExtractor.extractFromSite(site);
                if (httpUrl) {
                  logger.info('✓ HTTP API静默提取成功（刷新后）');
                  return httpUrl;
                }
              } catch (refreshError) {
                logger.error('自动刷新Cookie失败', refreshError);
                throw new AutoSubError(
                  ErrorCode.CREDENTIAL_CAPTURE_FAILED,
                  `Cookie已过期且自动刷新失败: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`
                );
              }
            }
          }

          logger.warn('HTTP API提取失败', error);
          if (this.silentMode) {
            throw new AutoSubError(
              ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
              `HTTP API提取失败: ${error.message || '未知错误'}，静默模式下无法使用浏览器方式`
            );
          }
        }
      }

      // 优先级2: 检查已保存的订阅地址
      if (site.subscriptionUrl) {
        const isValid = await this.validator.quickValidate(site.subscriptionUrl);
        if (isValid) {
          // 检查凭证文件是否存在
          const credentialsExist = await this.checkCredentialsExist(site.id);

          if (credentialsExist) {
            logger.info('使用已保存的订阅地址');
            return site.subscriptionUrl;
          } else {
            logger.info('订阅地址有效但缺少凭证文件');
            if (this.silentMode) {
              throw new AutoSubError(
                ErrorCode.CREDENTIAL_CAPTURE_FAILED,
                '缺少凭证文件，静默模式下无法重新获取。请运行: autosub refresh-credentials --headless'
              );
            }
            logger.info('将重新提取以保存凭证');
          }
        } else if (this.silentMode) {
          throw new AutoSubError(
            ErrorCode.SUBSCRIPTION_VALIDATION_FAILED,
            '已保存的订阅地址无效，静默模式下无法使用浏览器重新获取。请运行: autosub add 重新配置站点'
          );
        }
      }

      // 优先级3: 使用 Puppeteer 浏览器提取
      if (this.silentMode) {
        throw new AutoSubError(
          ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
          '无法使用静默方式提取订阅，请运行: autosub add 配置站点或 autosub update（标准模式）'
        );
      }

      logger.info('使用浏览器方式提取订阅地址...');
      return await this.apiExtractor.extract(site);
    } catch (error) {
      logger.error('提取订阅地址失败', error);
      throw error;
    }
  }

  /**
   * 静默模式下自动刷新Cookie
   */
  private async autoRefreshCookieInSilentMode(site: SiteConfig): Promise<void> {
    logger.info(`正在为 ${site.name} 自动刷新Cookie（headless模式）...`);

    const refreshService = new CookieRefreshService();
    try {
      await refreshService.initialize(true); // headless模式
      const result = await refreshService.refreshSite(site.id);

      if (!result.success) {
        throw new Error(result.error || '刷新失败');
      }

      if (!result.refreshed) {
        logger.warn('Cookie未被服务器刷新，但仍可使用');
      } else {
        logger.info('✓ Cookie刷新成功');
      }

      // 等待服务器端session完全生效
      logger.info('等待Cookie生效...');
      await this.delay(2000);
    } finally {
      await refreshService.cleanup();
    }
  }

  /**
   * 检查凭证文件是否存在
   */
  private async checkCredentialsExist(siteId: string): Promise<boolean> {
    try {
      const { readCredentials } = await import('../credentials/manager.js');
      const credentials = await readCredentials(siteId);

      // 检查是否有有效的Cookie数据
      return !!(
        credentials &&
        credentials.cookies &&
        Array.isArray(credentials.cookies) &&
        credentials.cookies.length > 0
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * 更新站点配置
   */
  private async updateSiteConfig(
    site: SiteConfig,
    subscriptionUrl: string
  ): Promise<void> {
    // 验证subscriptionUrl不为空
    if (!subscriptionUrl || subscriptionUrl.trim() === '') {
      logger.error('❌ subscriptionUrl为空，无法保存配置');
      throw new AutoSubError(
        ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
        'subscriptionUrl为空，无法保存配置'
      );
    }

    logger.info(`准备保存订阅地址: ${subscriptionUrl.substring(0, 50)}...`);

    // 保存旧的订阅 URL（用于 Clash 配置匹配）
    const oldSubscriptionUrl = site.subscriptionUrl;

    // ========== 初始化URL组件配置（首次添加站点时）==========
    // 重新读取最新配置，确保获取到 detectAndSaveApiConfig 保存的 api 字段
    const latestSite = this.configManager.getSiteById(site.id);
    if (latestSite) {
      site = latestSite;
    }

    // 如果还没有 URL 组件配置，从首次获取的订阅地址解析并保存
    // 这对所有提取模式都适用，确保后续更新可以使用正确的 URL 格式
    if (!site.api?.subscriptionUrl || !isValidUrlComponents(site.api.subscriptionUrl)) {
      try {
        logger.info('首次获取订阅地址，解析并保存URL组件...');
        const components = parseSubscriptionUrl(subscriptionUrl);

        // 确保 api 对象存在
        if (!site.api) {
          site.api = {} as any;
        }

        // 保存解析后的组件到API配置
        site.api!.subscriptionUrl = {
          protocol: components.protocol,
          host: components.host,
          port: components.port,
          path: components.path,
          tokenParam: components.tokenParam
        };

        logger.info('✓ URL组件已保存到配置', {
          host: components.host,
          port: components.port,
          path: components.path
        });
      } catch (error) {
        logger.warn('解析订阅地址失败，将继续使用传统模式', error);
        // 解析失败不影响正常流程，继续使用传统的 subscribeUrlPattern
      }
    } else {
      logger.debug('URL组件配置已存在，跳过初始化');
    }

    // 更新站点配置
    logger.info(`正在更新站点配置: ${site.name}, subscriptionUrl: ${subscriptionUrl.substring(0, 50)}...`);
    this.configManager.updateSite(site.id, {
      subscriptionUrl,
      lastUpdate: new Date().toISOString(),
      cookieValid: true,
      ...(site.api && { api: site.api }) // 如果修改了api配置，也要保存
    });

    this.configManager.save();
    logger.info('✓ 站点配置已更新');

    // 验证保存是否成功
    const savedSite = this.configManager.getSiteById(site.id);
    if (savedSite && savedSite.subscriptionUrl === subscriptionUrl) {
      logger.info('✓ 订阅地址保存验证成功');
    } else {
      logger.error('❌ 订阅地址保存验证失败', {
        expected: subscriptionUrl,
        actual: savedSite?.subscriptionUrl || '(未找到)'
      });
    }

    // 更新 Clash 配置文件中的订阅 URL
    const clashConfigPath = this.configManager.getConfig().clash.configPath;
    if (clashConfigPath) {
      try {
        const urlReplacer = new ClashUrlReplacer();
        const replaced = await urlReplacer.replaceSubscriptionUrl(
          clashConfigPath,
          site.name,
          oldSubscriptionUrl || null,
          subscriptionUrl
        );

        if (replaced) {
          logger.info('✓ Clash 配置文件中的订阅 URL 已更新');
        } else {
          logger.warn('⚠ 未在 Clash 配置中找到匹配的订阅 URL，可能需要手动更新');
        }
      } catch (error) {
        logger.error('更新 Clash 配置失败:', error);
        logger.warn('⚠ 站点配置已更新，但 Clash 配置更新失败，请手动检查');
      }
    } else {
      logger.info('ℹ 未配置 Clash 路径，跳过 Clash 配置更新');
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
      logger.info('✓ 资源清理完成');
    } catch (error) {
      logger.error('资源清理失败', error);
    }
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
