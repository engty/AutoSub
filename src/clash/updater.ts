import yaml from 'js-yaml';
import { FileUtil } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, ClashFullConfig } from '../types/index.js';

/**
 * Clash 配置更新器
 * 负责更新 Clash 配置文件
 */
export class ClashConfigUpdater {
  private configPath: string;
  private backupEnabled: boolean;
  private backupCount: number;

  constructor(
    configPath: string,
    backupEnabled: boolean = true,
    backupCount: number = 5
  ) {
    this.configPath = configPath;
    this.backupEnabled = backupEnabled;
    this.backupCount = backupCount;
  }

  /**
   * 更新 Clash 配置（完整替换）
   */
  async updateFull(newConfig: ClashFullConfig): Promise<void> {
    try {
      logger.info(`开始更新 Clash 配置: ${this.configPath}`);

      // 1. 验证配置文件存在
      if (!FileUtil.exists(this.configPath)) {
        throw new AutoSubError(
          ErrorCode.CLASH_CONFIG_UPDATE_FAILED,
          `Clash 配置文件不存在: ${this.configPath}`
        );
      }

      // 2. 创建备份
      if (this.backupEnabled) {
        const backupPath = FileUtil.createBackup(
          this.configPath,
          '自动更新前备份'
        );
        logger.info(`✓ 配置已备份: ${backupPath}`);

        // 清理旧备份
        FileUtil.cleanOldBackups('config.yaml', this.backupCount);
      }

      // 3. 写入新配置
      const yamlContent = yaml.dump(newConfig, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      FileUtil.writeFile(this.configPath, yamlContent);

      logger.info('✓ Clash 配置更新成功');
    } catch (error) {
      if (error instanceof AutoSubError) {
        throw error;
      }
      throw new AutoSubError(
        ErrorCode.CLASH_CONFIG_UPDATE_FAILED,
        `更新 Clash 配置失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 部分更新 Clash 配置（仅更新代理和代理组）
   */
  async updateProxies(
    newProxies: any[],
    newProxyGroups?: any[]
  ): Promise<void> {
    try {
      logger.info('开始部分更新 Clash 配置（代理节点）');

      // 1. 读取现有配置
      const currentConfig = this.loadConfig();

      // 2. 创建备份
      if (this.backupEnabled) {
        const backupPath = FileUtil.createBackup(
          this.configPath,
          '部分更新前备份'
        );
        logger.info(`✓ 配置已备份: ${backupPath}`);
      }

      // 3. 更新代理
      currentConfig.proxies = newProxies;

      // 4. 更新代理组（如果提供）
      if (newProxyGroups) {
        currentConfig['proxy-groups'] = newProxyGroups;
      }

      // 5. 写入配置
      const yamlContent = yaml.dump(currentConfig, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      FileUtil.writeFile(this.configPath, yamlContent);

      logger.info(`✓ 成功更新 ${newProxies.length} 个代理节点`);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.CLASH_CONFIG_UPDATE_FAILED,
        `部分更新失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 从备份恢复配置
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      logger.info(`开始从备份恢复配置: ${backupPath}`);

      if (!FileUtil.exists(backupPath)) {
        throw new AutoSubError(
          ErrorCode.CONFIG_LOAD_FAILED,
          `备份文件不存在: ${backupPath}`
        );
      }

      // 读取备份内容
      const backupContent = FileUtil.readFile(backupPath);

      // 写入到配置文件
      FileUtil.writeFile(this.configPath, backupContent);

      logger.info('✓ 配置恢复成功');
    } catch (error) {
      if (error instanceof AutoSubError) {
        throw error;
      }
      throw new AutoSubError(
        ErrorCode.CLASH_CONFIG_UPDATE_FAILED,
        `恢复配置失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 加载当前配置
   */
  loadConfig(): ClashFullConfig {
    try {
      // 如果配置文件不存在，返回默认配置
      if (!FileUtil.exists(this.configPath)) {
        logger.info(`配置文件不存在，使用默认配置: ${this.configPath}`);
        return this.createDefaultConfig();
      }

      const content = FileUtil.readFile(this.configPath);
      const config = yaml.load(content) as ClashFullConfig;

      if (!config || typeof config !== 'object') {
        throw new Error('配置格式无效');
      }

      return config;
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.CONFIG_LOAD_FAILED,
        `加载 Clash 配置失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): ClashFullConfig {
    return {
      port: 7890,
      'socks-port': 7891,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      'external-controller': '127.0.0.1:9090',
      proxies: [],
      'proxy-groups': [
        {
          name: '🚀 节点选择',
          type: 'select',
          proxies: ['DIRECT'],
        },
        {
          name: '♻️ 自动选择',
          type: 'url-test',
          proxies: [],
          url: 'http://www.gstatic.com/generate_204',
          interval: 300,
        },
      ],
      rules: [
        'DOMAIN-SUFFIX,cn,DIRECT',
        'GEOIP,CN,DIRECT',
        'MATCH,🚀 节点选择',
      ],
    };
  }

  /**
   * 验证配置格式
   */
  validateConfig(config: ClashFullConfig): boolean {
    // 基本字段检查
    if (!config.proxies || !Array.isArray(config.proxies)) {
      logger.error('配置缺少 proxies 字段或格式错误');
      return false;
    }

    if (!config['proxy-groups'] || !Array.isArray(config['proxy-groups'])) {
      logger.error('配置缺少 proxy-groups 字段或格式错误');
      return false;
    }

    if (!config.rules || !Array.isArray(config.rules)) {
      logger.error('配置缺少 rules 字段或格式错误');
      return false;
    }

    return true;
  }

  /**
   * 合并配置（保留本地规则和设置，更新代理）
   */
  async mergeConfig(subscriptionConfig: any): Promise<void> {
    try {
      logger.info('开始合并配置');

      // 1. 确保目录存在
      const path = await import('path');
      const fs = await import('fs-extra');
      const dir = path.dirname(this.configPath);
      await fs.ensureDir(dir);

      // 2. 读取本地配置（如果不存在会返回默认配置）
      const localConfig = this.loadConfig();

      // 3. 创建备份（仅当文件存在时）
      if (this.backupEnabled && FileUtil.exists(this.configPath)) {
        FileUtil.createBackup(this.configPath, '合并前备份');
      }

      // 4. 合并：使用订阅的代理，保留本地的规则和设置
      const mergedConfig: ClashFullConfig = {
        ...localConfig, // 保留本地设置
        proxies: subscriptionConfig.proxies || [], // 使用订阅代理
        'proxy-groups': this.mergeProxyGroups(
          localConfig['proxy-groups'] || [],
          subscriptionConfig.proxies || []
        ),
      };

      // 5. 写入配置
      const yamlContent = yaml.dump(mergedConfig, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      FileUtil.writeFile(this.configPath, yamlContent);

      logger.info(`✓ 配置合并成功，已写入: ${this.configPath}`);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.CLASH_CONFIG_UPDATE_FAILED,
        `合并配置失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 合并代理组（更新节点列表）
   */
  private mergeProxyGroups(
    localGroups: any[],
    newProxies: any[]
  ): any[] {
    const proxyNames = newProxies.map((p) => p.name);

    return localGroups.map((group) => {
      if (group.type === 'select' || group.type === 'url-test') {
        // 保留策略组自身，更新代理列表
        const updatedProxies = [
          ...(group.proxies || []).filter((p: string) =>
            ['DIRECT', 'REJECT', 'PASS'].includes(p) ||
            p.includes('♻️') ||
            p.includes('🔰')
          ),
          ...proxyNames,
        ];

        return {
          ...group,
          proxies: updatedProxies,
        };
      }

      return group;
    });
  }
}
