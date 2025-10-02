/**
 * 订阅站点配置
 */
export interface SiteConfig {
  name: string;
  url: string;
  credentials: {
    cookies: string;
    localStorage: string;
    tokens: string;
  };
  lastUpdate: string;
  subscriptionUrl: string;
}

/**
 * Clash 配置
 */
export interface ClashConfig {
  configPath: string;
  backupEnabled: boolean;
  backupCount: number;
}

/**
 * Clash AutoSub 配置
 */
export interface ClashAutoSubConfig {
  version: string;
  sites: SiteConfig[];
  clash: ClashConfig;
  settings: {
    autoUpdate: boolean;
    updateInterval: string;
  };
}

/**
 * MCP 客户端选项
 */
export interface MCPClientOptions {
  headless?: boolean;
  isolated?: boolean;
}

/**
 * 凭证捕获结果
 */
export interface CapturedCredentials {
  cookies: string;
  localStorage: Record<string, string>;
  tokens: any[];
}

/**
 * 订阅验证结果
 */
export interface ValidationResult {
  valid: boolean;
  httpStatus?: number;
  isYaml?: boolean;
  nodeCount?: number;
  error?: string;
}

/**
 * 更新结果
 */
export interface UpdateResult {
  siteName: string;
  success: boolean;
  duration: number;
  message: string;
  subscriptionUrl?: string;
}
