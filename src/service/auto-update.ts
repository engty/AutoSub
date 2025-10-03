import { PuppeteerBrowser } from '../puppeteer/index.js';
import { PuppeteerApiExtractor } from '../subscription/puppeteer-api-extractor.js';
import { SubscriptionValidator } from '../subscription/validator.js';
import { ClashConfigUpdater } from '../clash/updater.js';
import { getConfigManager, ConfigManager } from '../config/manager.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, SiteConfig } from '../types/index.js';

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
}

/**
 * 自动更新服务
 * 核心业务流程编排 (使用 Puppeteer)
 */
export class AutoUpdateService {
  private browser!: PuppeteerBrowser;
  private apiExtractor!: PuppeteerApiExtractor;
  private validator!: SubscriptionValidator;
  private configManager: ConfigManager;
  private clashUpdater!: ClashConfigUpdater;

  constructor() {
    this.configManager = getConfigManager();
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      logger.info('初始化自动更新服务...');

      // 1. 启动 Puppeteer 浏览器
      this.browser = new PuppeteerBrowser();
      await this.browser.launch();

      // 2. 获取 AI 配置
      const aiConfig = this.configManager.getAIConfig();

      // 3. 初始化各模块(传递 AI 配置)
      this.apiExtractor = new PuppeteerApiExtractor(this.browser, aiConfig);
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
      const validation = await this.validator.validate(subscriptionUrl);

      if (!validation.valid) {
        throw new AutoSubError(
          ErrorCode.SUBSCRIPTION_VALIDATION_FAILED,
          `订阅验证失败: ${validation.error}`
        );
      }

      // 3. 更新配置
      await this.updateSiteConfig(site, subscriptionUrl);

      // 4. 更新 Clash（若验证返回可用配置）
      if (validation.config) {
        await this.clashUpdater.mergeConfig(validation.config);
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
      };
    } catch (error) {
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
      // 优先使用已保存的订阅地址
      if (site.subscriptionUrl) {
        const isValid = await this.validator.quickValidate(site.subscriptionUrl);
        if (isValid) {
          logger.info('使用已保存的订阅地址');
          return site.subscriptionUrl;
        }
      }

      // 使用 Puppeteer API 提取器
      return await this.apiExtractor.extract(site);
    } catch (error) {
      logger.error('提取订阅地址失败', error);
      throw error;
    }
  }

  /**
   * 更新站点配置
   */
  private async updateSiteConfig(
    site: SiteConfig,
    subscriptionUrl: string
  ): Promise<void> {
    this.configManager.updateSite(site.id, {
      subscriptionUrl,
      lastUpdate: new Date().toISOString(),
    });

    this.configManager.save();
    logger.info('✓ 站点配置已更新');
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
