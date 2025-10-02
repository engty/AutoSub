import { getMCPClient, MCPClient, PageManager, NetworkListener, CredentialCapture, TokenExtractor } from '../mcp/index.js';
import { ApiSubscriptionExtractor } from '../subscription/api-extractor.js';
import { DomSubscriptionExtractor } from '../subscription/dom-extractor.js';
import { SubscriptionValidator } from '../subscription/validator.js';
import { ClashConfigUpdater } from '../clash/updater.js';
import { getConfigManager, ConfigManager } from '../config/manager.js';
import { encryptCredentials } from '../utils/crypto.js';
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
 * 核心业务流程编排
 */
export class AutoUpdateService {
  private mcpClient!: MCPClient;
  private pageManager!: PageManager;
  private networkListener!: NetworkListener;
  private credentialCapture!: CredentialCapture;
  private tokenExtractor!: TokenExtractor;
  private apiExtractor!: ApiSubscriptionExtractor;
  private domExtractor!: DomSubscriptionExtractor;
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

      // 1. 连接 MCP
      this.mcpClient = getMCPClient();
      await this.mcpClient.connect();

      // 2. 初始化各模块
      this.pageManager = new PageManager(this.mcpClient);
      this.networkListener = new NetworkListener(this.mcpClient);
      this.credentialCapture = new CredentialCapture(this.pageManager);
      this.tokenExtractor = new TokenExtractor(this.networkListener);
      this.apiExtractor = new ApiSubscriptionExtractor(
        this.networkListener,
        this.tokenExtractor,
        this.pageManager
      );
      this.domExtractor = new DomSubscriptionExtractor(
        this.pageManager,
        this.mcpClient
      );
      this.validator = new SubscriptionValidator();

      // 3. 初始化 Clash 更新器
      const clashConfig = this.configManager.getConfig().clash;
      this.clashUpdater = new ClashConfigUpdater(
        clashConfig.configPath,
        clashConfig.backupEnabled,
        clashConfig.backupCount
      );

      logger.info('✓ 服务初始化完成');
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.MCP_CONNECTION_FAILED,
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

    if (!site.enabled) {
      logger.info(`站点已禁用，跳过: ${site.name}`);
      return {
        success: false,
        siteId: site.id,
        siteName: site.name,
        error: '站点已禁用',
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
   * 处理站点更新（核心流程）
   */
  private async processSiteUpdate(site: SiteConfig): Promise<UpdateResult> {
    try {
      logger.info(`\n━━━━ 开始处理站点: ${site.name} ━━━━`);

      // 1. 捕获凭证
      const credentialsCaptured = await this.captureCredentials(site);

      // 2. 提取订阅地址
      const subscriptionUrl = await this.extractSubscription(site);

      if (!subscriptionUrl) {
        throw new AutoSubError(
          ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
          '未能提取到订阅地址'
        );
      }

      // 3. 验证订阅
      const validation = await this.validator.validate(subscriptionUrl);

      if (!validation.valid) {
        throw new AutoSubError(
          ErrorCode.SUBSCRIPTION_VALIDATION_FAILED,
          `订阅验证失败: ${validation.error}`
        );
      }

      // 4. 更新配置
      await this.updateSiteConfig(site, subscriptionUrl);

      // 5. 更新 Clash
      await this.clashUpdater.mergeConfig(validation.config);

      logger.info(`✓ 站点更新成功: ${site.name}`);

      return {
        success: true,
        siteId: site.id,
        siteName: site.name,
        subscriptionUrl,
        nodeCount: validation.nodeCount,
        credentialsCaptured,
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
   * 捕获凭证
   */
  private async captureCredentials(site: SiteConfig): Promise<boolean> {
    try {
      const credentials = await this.credentialCapture.captureAll();

      // 加密并保存
      const encrypted = encryptCredentials(credentials);

      this.configManager.updateSite(site.id, {
        credentials: {
          ...encrypted,
          tokens: site.credentials.tokens, // 保留现有 tokens
        },
        lastUpdate: new Date().toISOString(),
      });

      this.configManager.save();

      logger.info('✓ 凭证捕获成功');
      return true;
    } catch (error) {
      logger.error('凭证捕获失败', error);
      return false;
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

      // 根据配置的提取模式选择策略
      if (site.extractionMode === 'api') {
        return await this.apiExtractor.extract(site);
      } else if (site.extractionMode === 'dom') {
        return await this.domExtractor.extract(site);
      }

      // 默认：先尝试 API，再尝试 DOM
      try {
        return await this.apiExtractor.extract(site);
      } catch {
        return await this.domExtractor.extract(site);
      }
    } catch (error) {
      logger.error('提取订阅地址失败', error);
      return null;
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
      if (this.mcpClient) {
        await this.mcpClient.disconnect();
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
