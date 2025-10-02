// 配置管理器
export { ConfigManager, getConfigManager } from './manager.js';

// 配置结构和验证
export {
  DEFAULT_CONFIG,
  DEFAULT_CLASH_CONFIG,
  validateConfig,
  validateSiteConfig,
  createEmptySiteConfig,
} from './schema.js';
