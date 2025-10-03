import { ClashAutoSubConfig, SiteConfig, ClashConfig } from '../types/index.js';

/**
 * 默认 Clash 配置
 */
export const DEFAULT_CLASH_CONFIG: ClashConfig = {
  configPath: '',
  backupEnabled: true,
  backupCount: 5,
};

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: ClashAutoSubConfig = {
  version: '1.0.0',
  sites: [],
  clash: DEFAULT_CLASH_CONFIG,
  settings: {
    autoUpdate: false,
    updateInterval: '*/30 * * * *', // 每 30 分钟
  },
};

/**
 * 验证站点配置
 */
export function validateSiteConfig(site: any): site is SiteConfig {
  if (!site || typeof site !== 'object') {
    return false;
  }

  const required = ['id', 'name', 'url', 'credentials'];
  for (const key of required) {
    if (!(key in site)) {
      return false;
    }
  }

  // 验证 credentials 结构
  const { credentials } = site;
  if (!credentials || typeof credentials !== 'object') {
    return false;
  }

  const credKeys = ['cookies', 'localStorage', 'sessionStorage', 'tokens'];
  for (const key of credKeys) {
    if (!(key in credentials)) {
      return false;
    }
  }

  if ('credentialFile' in site && typeof site.credentialFile !== 'string') {
    return false;
  }

  if ('credentialsUpdatedAt' in site && typeof site.credentialsUpdatedAt !== 'string') {
    return false;
  }

  if ('cookieValid' in site && typeof site.cookieValid !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * 验证完整配置
 */
export function validateConfig(config: any): config is ClashAutoSubConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // 检查必要字段
  if (!('version' in config) || !('sites' in config) || !('clash' in config)) {
    return false;
  }

  // 验证 sites 数组
  if (!Array.isArray(config.sites)) {
    return false;
  }

  for (const site of config.sites) {
    if (!validateSiteConfig(site)) {
      return false;
    }
  }

  // 验证 clash 配置
  const { clash } = config;
  if (!clash || typeof clash !== 'object') {
    return false;
  }

  if (!('configPath' in clash)) {
    return false;
  }

  return true;
}

/**
 * 创建空站点配置
 */
export function createEmptySiteConfig(
  id: string,
  name: string,
  url: string
): SiteConfig {
  return {
    id,
    name,
    url,
    credentials: {
      cookies: '',
      localStorage: '',
      sessionStorage: '',
      tokens: '',
    },
    lastUpdate: new Date().toISOString(),
    subscriptionUrl: '',
    extractionMode: 'api',
    enabled: true,
    credentialFile: '',
    credentialsUpdatedAt: '',
    cookieValid: false,
  };
}
