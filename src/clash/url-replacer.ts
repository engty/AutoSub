import fs from 'fs-extra';
import * as YAML from 'js-yaml';
import { logger } from '../utils/logger.js';

/**
 * Clash 配置 URL 替换器
 * 负责智能查找并替换 Clash 配置文件中的订阅 URL
 */
export class ClashUrlReplacer {
  /**
   * 替换 Clash 配置中的订阅 URL
   * @param configPath Clash 配置文件路径
   * @param siteName 站点名称（用于匹配）
   * @param oldUrl 旧的订阅 URL（可选，用于精确匹配）
   * @param newUrl 新的订阅 URL
   */
  async replaceSubscriptionUrl(
    configPath: string,
    siteName: string,
    oldUrl: string | null,
    newUrl: string
  ): Promise<boolean> {
    try {
      logger.info(`开始替换 Clash 配置中的订阅 URL: ${siteName}`);

      // 1. 读取配置文件
      const content = await fs.readFile(configPath, 'utf-8');
      const config = YAML.load(content) as any;

      if (!config) {
        logger.warn('无法解析 Clash 配置文件');
        return false;
      }

      // 2. 查找并替换订阅 URL
      let replaced = false;

      // 策略1: 在 proxy-providers 中查找
      if (config['proxy-providers']) {
        replaced = this.replaceInProxyProviders(
          config['proxy-providers'],
          siteName,
          oldUrl,
          newUrl
        );
      }

      // 策略2: 在 proxy-groups 的订阅字段中查找
      if (!replaced && config['proxy-groups']) {
        replaced = this.replaceInProxyGroups(
          config['proxy-groups'],
          siteName,
          oldUrl,
          newUrl
        );
      }

      // 策略3: 在顶层 subscription-userinfo 或其他字段中查找
      if (!replaced) {
        replaced = this.replaceInTopLevel(config, siteName, oldUrl, newUrl);
      }

      if (!replaced) {
        logger.warn(`未找到匹配的订阅 URL: ${siteName}`);
        return false;
      }

      // 3. 备份原配置
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copyFile(configPath, backupPath);
      logger.info(`✓ 已备份原配置到: ${backupPath}`);

      // 4. 保存新配置
      const newContent = YAML.dump(config, {
        indent: 2,
        lineWidth: -1, // 不限制行宽
        noRefs: true,
      });
      await fs.writeFile(configPath, newContent, 'utf-8');
      logger.info(`✓ 成功替换订阅 URL: ${siteName} -> ${newUrl}`);

      return true;
    } catch (error) {
      logger.error('替换订阅 URL 失败:', error);
      return false;
    }
  }

  /**
   * 在 proxy-providers 中查找并替换
   */
  private replaceInProxyProviders(
    providers: any,
    siteName: string,
    oldUrl: string | null,
    newUrl: string
  ): boolean {
    for (const [providerName, providerConfig] of Object.entries(providers)) {
      if (typeof providerConfig !== 'object' || !providerConfig) continue;

      const config = providerConfig as any;

      // 检查 URL 字段
      if (config.url && typeof config.url === 'string') {
        // 匹配条件：
        // 1. provider 名称包含站点名称
        // 2. URL 与旧 URL 的域名匹配
        const nameMatch = this.fuzzyMatch(providerName, siteName);
        const urlMatch = oldUrl ? this.urlDomainMatch(config.url, oldUrl) : false;

        if (nameMatch || urlMatch) {
          logger.info(`✓ 在 proxy-providers.${providerName} 中找到匹配`);
          config.url = newUrl;
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 在 proxy-groups 中查找并替换
   */
  private replaceInProxyGroups(
    groups: any[],
    siteName: string,
    oldUrl: string | null,
    newUrl: string
  ): boolean {
    for (const group of groups) {
      if (typeof group !== 'object' || !group) continue;

      // 检查组名称
      if (group.name && this.fuzzyMatch(group.name, siteName)) {
        // 检查是否有 url 或 subscription 字段
        if (group.url && typeof group.url === 'string') {
          logger.info(`✓ 在 proxy-groups[${group.name}].url 中找到匹配`);
          group.url = newUrl;
          return true;
        }
        if (group.subscription && typeof group.subscription === 'string') {
          logger.info(`✓ 在 proxy-groups[${group.name}].subscription 中找到匹配`);
          group.subscription = newUrl;
          return true;
        }
      }

      // 检查 URL 匹配
      if (oldUrl && group.url && this.urlDomainMatch(group.url, oldUrl)) {
        logger.info(`✓ 通过 URL 域名匹配找到 proxy-groups[${group.name}]`);
        group.url = newUrl;
        return true;
      }
    }

    return false;
  }

  /**
   * 在顶层字段中查找并替换
   */
  private replaceInTopLevel(
    config: any,
    _siteName: string,
    oldUrl: string | null,
    newUrl: string
  ): boolean {
    const possibleFields = [
      'subscription-url',
      'subscription',
      'subscribe-url',
      'sub-url',
    ];

    for (const field of possibleFields) {
      if (config[field] && typeof config[field] === 'string') {
        const urlMatch = oldUrl ? this.urlDomainMatch(config[field], oldUrl) : true;
        if (urlMatch) {
          logger.info(`✓ 在顶层字段 ${field} 中找到匹配`);
          config[field] = newUrl;
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 模糊匹配字符串（忽略大小写，支持部分匹配）
   */
  private fuzzyMatch(text: string, keyword: string): boolean {
    const normalizedText = text.toLowerCase().replace(/[-_\s]/g, '');
    const normalizedKeyword = keyword.toLowerCase().replace(/[-_\s]/g, '');
    return normalizedText.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedText);
  }

  /**
   * URL 域名匹配
   */
  private urlDomainMatch(url1: string, url2: string): boolean {
    try {
      const domain1 = new URL(url1).hostname;
      const domain2 = new URL(url2).hostname;
      return domain1 === domain2;
    } catch {
      return false;
    }
  }
}
