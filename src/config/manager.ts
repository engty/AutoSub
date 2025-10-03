import yaml from 'js-yaml';
import { ClashAutoSubConfig, SiteConfig, ErrorCode, AutoSubError, AIConfig } from '../types/index.js';
import { FileUtil, CONFIG_FILE } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG, validateConfig } from './schema.js';
import { AIConfigManager } from '../ai/ai-config.js';

/**
 * 配置管理器类
 */
export class ConfigManager {
  private config: ClashAutoSubConfig = DEFAULT_CONFIG;
  private configPath: string = CONFIG_FILE;

  constructor(configPath?: string) {
    if (configPath) {
      this.configPath = configPath;
    }
  }

  /**
   * 加载配置文件
   */
  load(): ClashAutoSubConfig {
    try {
      if (!FileUtil.exists(this.configPath)) {
        logger.info('配置文件不存在，使用默认配置');
        return this.config;
      }

      const content = FileUtil.readFile(this.configPath);
      const parsed = yaml.load(content) as any;

      if (!validateConfig(parsed)) {
        throw new AutoSubError(
          ErrorCode.CONFIG_LOAD_FAILED,
          '配置文件格式无效'
        );
      }

      this.config = parsed;
      logger.debug(`配置文件加载成功: ${this.configPath}`);
      return this.config;
    } catch (error) {
      if (error instanceof AutoSubError) {
        throw error;
      }
      throw new AutoSubError(
        ErrorCode.CONFIG_LOAD_FAILED,
        `加载配置文件失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 保存配置文件
   */
  save(): void {
    try {
      const yamlContent = yaml.dump(this.config, {
        indent: 2,
        lineWidth: -1,
      });

      FileUtil.writeFile(this.configPath, yamlContent);
      logger.debug(`配置文件保存成功: ${this.configPath}`);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.CONFIG_SAVE_FAILED,
        `保存配置文件失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): ClashAutoSubConfig {
    return this.config;
  }

  /**
   * 设置配置
   */
  setConfig(config: ClashAutoSubConfig): void {
    if (!validateConfig(config)) {
      throw new AutoSubError(
        ErrorCode.CONFIG_SAVE_FAILED,
        '配置格式无效'
      );
    }
    this.config = config;
  }

  /**
   * 获取所有站点配置
   */
  getSites(): SiteConfig[] {
    return this.config.sites;
  }

  /**
   * 根据 ID 获取站点配置
   */
  getSiteById(id: string): SiteConfig | undefined {
    return this.config.sites.find((s) => s.id === id);
  }

  /**
   * 根据名称获取站点配置
   */
  getSiteByName(name: string): SiteConfig | undefined {
    return this.config.sites.find((s) => s.name === name);
  }

  /**
   * 添加站点配置
   */
  addSite(site: SiteConfig): void {
    // 检查 ID 是否已存在
    if (this.getSiteById(site.id)) {
      throw new AutoSubError(
        ErrorCode.CONFIG_SAVE_FAILED,
        `站点 ID 已存在: ${site.id}`
      );
    }

    this.config.sites.push(site);
    logger.info(`添加站点配置: ${site.name}`);
  }

  /**
   * 更新站点配置
   */
  updateSite(id: string, updates: Partial<SiteConfig>): void {
    const index = this.config.sites.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new AutoSubError(
        ErrorCode.CONFIG_SAVE_FAILED,
        `站点不存在: ${id}`
      );
    }

    this.config.sites[index] = {
      ...this.config.sites[index],
      ...updates,
    };

    logger.info(`更新站点配置: ${this.config.sites[index].name}`);
  }

  /**
   * 删除站点配置
   */
  deleteSite(id: string): void {
    const index = this.config.sites.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new AutoSubError(
        ErrorCode.CONFIG_SAVE_FAILED,
        `站点不存在: ${id}`
      );
    }

    const site = this.config.sites[index];
    this.config.sites.splice(index, 1);

    logger.info(`删除站点配置: ${site.name}`);
  }

  /**
   * 设置 Clash 配置路径
   */
  setClashConfigPath(path: string): void {
    this.config.clash.configPath = path;
    logger.info(`设置 Clash 配置路径: ${path}`);
  }

  /**
   * 获取 Clash 配置路径
   */
  getClashConfigPath(): string {
    return this.config.clash.configPath;
  }

  /**
   * 启用/禁用自动更新
   */
  setAutoUpdate(enabled: boolean, interval?: string): void {
    this.config.settings.autoUpdate = enabled;
    if (interval) {
      this.config.settings.updateInterval = interval;
    }
    logger.info(`自动更新: ${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 获取 AI 配置
   */
  getAIConfig(): AIConfig | undefined {
    return this.config.ai;
  }

  /**
   * 设置 AI 配置
   */
  setAIConfig(aiConfig: AIConfig): void {
    // 验证配置
    const validation = AIConfigManager.validateConfig(aiConfig);
    if (!validation.valid) {
      throw new AutoSubError(
        ErrorCode.CONFIG_SAVE_FAILED,
        `AI 配置无效: ${validation.error}`
      );
    }

    this.config.ai = aiConfig;
    logger.info(`AI 配置已更新: 提供商=${aiConfig.provider}, 启用=${aiConfig.enabled}`);
  }

  /**
   * 更新 AI 配置(部分更新)
   */
  updateAIConfig(updates: Partial<AIConfig>): void {
    const currentConfig = this.config.ai || AIConfigManager.createDefaultConfig();
    const newConfig = { ...currentConfig, ...updates };
    this.setAIConfig(newConfig);
  }

  /**
   * 启用/禁用 AI
   */
  toggleAI(enabled: boolean): void {
    if (!this.config.ai) {
      this.config.ai = AIConfigManager.createDefaultConfig();
    }
    this.config.ai.enabled = enabled;
    logger.info(`AI 智能识别: ${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 初始化配置（首次使用）
   */
  static initialize(clashConfigPath?: string): ConfigManager {
    FileUtil.ensureConfigDir();

    const manager = new ConfigManager();

    // 检测 Clash 配置路径
    if (clashConfigPath) {
      manager.setClashConfigPath(clashConfigPath);
    } else {
      const detected = FileUtil.detectClashConfigPath();
      if (detected) {
        manager.setClashConfigPath(detected);
        logger.info(`自动检测到 Clash 配置: ${detected}`);
      }
    }

    manager.save();
    return manager;
  }
}

/**
 * 导出单例实例
 */
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }

  try {
    configManagerInstance.load();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`配置加载失败，重新初始化默认配置: ${message}`);
    configManagerInstance = new ConfigManager();
    configManagerInstance.save();
  }

  return configManagerInstance;
}
