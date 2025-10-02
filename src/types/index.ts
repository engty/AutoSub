// ==================== 基础配置类型 ====================

/**
 * 订阅站点配置
 */
export interface SiteConfig {
  id: string; // 唯一标识符
  name: string;
  url: string;
  credentials: {
    cookies: string;
    localStorage: string;
    sessionStorage: string;
    tokens: string;
  };
  lastUpdate: string;
  subscriptionUrl: string;
  extractionMode: 'api' | 'dom' | 'clipboard'; // 提取模式
  enabled: boolean; // 是否启用
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
  error?: Error;
}

// ==================== MCP 相关类型 ====================

/**
 * MCP 网络请求类型
 */
export interface MCPNetworkRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  status?: number;
  resourceType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
}

/**
 * MCP 页面快照元素
 */
export interface MCPSnapshotElement {
  uid: string;
  tag: string;
  text?: string;
  attributes?: Record<string, string>;
}

/**
 * MCP 脚本执行结果
 */
export interface MCPScriptResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
}

// ==================== 选择器配置类型 ====================

/**
 * DOM 选择器配置
 */
export interface DOMSelector {
  type: 'css' | 'xpath' | 'text';
  value: string;
  priority: number; // 优先级，数字越小优先级越高
}

/**
 * API 模式配置
 */
export interface APIPattern {
  urlPattern: string; // URL 匹配模式（正则）
  method?: 'GET' | 'POST';
  responseKey?: string; // 订阅地址在响应中的 key
  tokenKey?: string; // Token 在响应中的 key
}

/**
 * 站点选择器配置
 */
export interface SiteSelector {
  siteId: string;
  siteName: string;
  loginUrl: string;
  apiPatterns?: APIPattern[];
  domSelectors?: DOMSelector[];
  waitForSelector?: string; // 等待登录成功的选择器
  waitForUrl?: string; // 等待登录成功的 URL 模式
}

// ==================== 错误类型 ====================

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // MCP 相关错误
  MCP_CONNECTION_FAILED = 'MCP_CONNECTION_FAILED',
  MCP_NAVIGATION_FAILED = 'MCP_NAVIGATION_FAILED',
  MCP_SCRIPT_EXECUTION_FAILED = 'MCP_SCRIPT_EXECUTION_FAILED',

  // 凭证相关错误
  CREDENTIAL_CAPTURE_FAILED = 'CREDENTIAL_CAPTURE_FAILED',
  CREDENTIAL_DECRYPT_FAILED = 'CREDENTIAL_DECRYPT_FAILED',

  // 订阅相关错误
  SUBSCRIPTION_FETCH_FAILED = 'SUBSCRIPTION_FETCH_FAILED',
  SUBSCRIPTION_VALIDATION_FAILED = 'SUBSCRIPTION_VALIDATION_FAILED',
  SUBSCRIPTION_INVALID_FORMAT = 'SUBSCRIPTION_INVALID_FORMAT',

  // Clash 配置错误
  CLASH_CONFIG_NOT_FOUND = 'CLASH_CONFIG_NOT_FOUND',
  CLASH_CONFIG_PARSE_FAILED = 'CLASH_CONFIG_PARSE_FAILED',
  CLASH_CONFIG_UPDATE_FAILED = 'CLASH_CONFIG_UPDATE_FAILED',
  CLASH_CONFIG_BACKUP_FAILED = 'CLASH_CONFIG_BACKUP_FAILED',

  // 通用错误
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  CONFIG_SAVE_FAILED = 'CONFIG_SAVE_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

/**
 * 应用错误类
 */
export class AutoSubError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AutoSubError';
  }
}

// ==================== CLI 命令类型 ====================

/**
 * Setup 命令选项
 */
export interface SetupCommandOptions {
  site?: string; // 预定义站点名称
  url?: string; // 自定义站点 URL
}

/**
 * Update 命令选项
 */
export interface UpdateCommandOptions {
  site?: string; // 指定站点名称
  silent?: boolean; // 静默模式
  force?: boolean; // 强制更新（跳过验证）
}

/**
 * Cron 命令选项
 */
export interface CronCommandOptions {
  interval?: string; // 更新间隔（如 '*/5 * * * *'）
  remove?: boolean; // 删除定时任务
}

/**
 * Status 命令选项
 */
export interface StatusCommandOptions {
  site?: string; // 指定站点
  detailed?: boolean; // 详细模式
}

// ==================== 工具函数类型 ====================

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 日志选项
 */
export interface LogOptions {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  fileOutput?: boolean;
}

/**
 * 加密选项
 */
export interface EncryptOptions {
  algorithm?: string;
  keyDerivation?: 'pbkdf2' | 'scrypt';
}

// ==================== Clash 配置类型 ====================

/**
 * Clash 代理提供商配置
 */
export interface ClashProxyProvider {
  type: 'http' | 'file';
  url?: string;
  path?: string;
  interval?: number;
  'health-check'?: {
    enable: boolean;
    url?: string;
    interval?: number;
  };
}

/**
 * Clash 完整配置
 */
export interface ClashFullConfig {
  'proxy-providers'?: Record<string, ClashProxyProvider>;
  proxies?: any[];
  'proxy-groups'?: any[];
  rules?: string[];
  [key: string]: any;
}

/**
 * 备份元数据
 */
export interface BackupMetadata {
  timestamp: string;
  version: string;
  originalPath: string;
  backupPath: string;
  reason?: string;
}
