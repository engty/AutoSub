// ==================== 基础配置类型 ====================

import { SubscriptionUrlComponents } from '../utils/subscription-url-parser';

/**
 * 登录检测配置
 */
export interface LoginDetectionConfig {
  urlPattern?: string; // URL 变化匹配模式
  selector?: string; // 登录后出现的元素选择器
  networkRequest?: string; // 登录后的网络请求模式
  cookieName?: string; // 登录后设置的 Cookie 名称
}

/**
 * 站点选择器配置(简化版)
 */
export interface SiteSelectors {
  api?: APIPattern | APIPattern[]; // API 模式配置
  dom?: DOMSelector | DOMSelector[]; // DOM 选择器配置
}

/**
 * 订阅站点配置
 */
/**
 * HTTP API 配置
 * 用于静默后台提取订阅地址
 */
export interface HttpApiConfig {
  url: string;           // API 端点 URL
  method: 'GET' | 'POST'; // HTTP 方法

  // 认证配置
  authSource: 'cookie' | 'localStorage' | 'both'; // 认证来源
  authField?: string;   // localStorage 中的认证字段路径，如 "app-user.token"

  // ========== 订阅地址提取方式（支持三种模式） ==========

  // 方式1: 新的URL组件模式（推荐）- 支持动态IP/端口更新
  subscriptionUrl?: SubscriptionUrlComponents; // URL组件配置
  tokenField?: string;        // 提取token字段，如 "data.token"
  urlField?: string;          // 提取完整URL字段（用于更新host/port），如 "data.subscribe_url"

  // 方式2: 传统token拼接模式（向后兼容）
  subscribeUrlPattern?: string; // token拼接模式，如 "https://example.com/sub?token={token}"
  // tokenField 与方式1共用

  // 方式3: 直接提取订阅地址（向后兼容）
  subscribeUrlField?: string; // 直接提取订阅地址字段，如 "data.subscribe_url"

  // 可选配置
  headers?: Record<string, string>; // 额外的请求头
  params?: Record<string, any>;     // URL 参数
  body?: Record<string, any>;       // POST 请求体
}

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
  loginDetection?: LoginDetectionConfig; // 登录检测配置
  selector?: SiteSelectors; // 选择器配置
  credentialFile?: string; // 凭证文件路径
  credentialsUpdatedAt?: string; // 凭证更新时间
  cookieValid?: boolean; // Cookie 状态
  api?: HttpApiConfig; // HTTP API 配置（自动检测并保存）
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
  ai?: AIConfig; // AI 配置(可选)
}

/**
 * AI 提供商类型
 */
export type AIProvider = 'deepseek' | 'openrouter' | 'custom';

/**
 * AI 提供商配置详情
 */
export interface AIProviderConfig {
  name: string; // 提供商名称
  apiUrl: string; // API 基础地址
  defaultModel: string; // 默认模型
  requiresApiKey: boolean; // 是否需要 API 密钥
}

/**
 * AI 配置
 */
export interface AIConfig {
  enabled: boolean; // 是否启用 AI 识别
  provider: AIProvider; // AI 提供商
  apiKey: string; // API 密钥
  model?: string; // 模型名称(可选,使用默认模型)
  customApiUrl?: string; // 自定义 API 地址(仅 provider='custom' 时使用)
}

/**
 * 凭证捕获结果
 */
export interface CapturedCredentials {
  cookies: string;
  localStorage: Record<string, string>;
  tokens: any[];
}

export interface StoredCredentials {
  cookies: Array<Record<string, any>>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  updatedAt: string;
}

/**
 * 订阅验证结果
 */
export interface ValidationResult {
  valid: boolean;
  nodeCount?: number;
  httpStatus?: number;
  warning?: string;
  error?: string;
  config?: any;
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
  warning?: string; // CloudFlare拦截等警告信息
}

// ==================== 选择器配置类型 ====================

/**
 * DOM 选择器配置
 */
export interface DOMSelector {
  selector?: string; // CSS 或 XPath 选择器
  attribute?: string; // 提取的属性名称，如 href、data-*、text 等
  description?: string; // 说明，便于调试
  type?: 'css' | 'xpath' | 'text'; // 兼容旧字段
  value?: string; // 兼容旧字段
  priority?: number; // 兼容旧字段
}

/**
 * API 模式配置
 */
export interface APIPattern {
  urlPattern: string; // URL 匹配模式（正则）
  method?: 'GET' | 'POST';
  field?: string; // 订阅地址所在的字段路径
  responseKey?: string; // 兼容旧字段
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
  // Puppeteer 相关错误
  BROWSER_LAUNCH_FAILED = 'BROWSER_LAUNCH_FAILED',
  BROWSER_NOT_INITIALIZED = 'BROWSER_NOT_INITIALIZED',
  PAGE_NAVIGATION_FAILED = 'PAGE_NAVIGATION_FAILED',
  PAGE_OPERATION_FAILED = 'PAGE_OPERATION_FAILED',
  LOGIN_DETECTION_FAILED = 'LOGIN_DETECTION_FAILED',

  // 凭证相关错误
  CREDENTIAL_CAPTURE_FAILED = 'CREDENTIAL_CAPTURE_FAILED',
  CREDENTIAL_DECRYPT_FAILED = 'CREDENTIAL_DECRYPT_FAILED',
  TOKEN_EXTRACTION_FAILED = 'TOKEN_EXTRACTION_FAILED',

  // 订阅相关错误
  SUBSCRIPTION_FETCH_FAILED = 'SUBSCRIPTION_FETCH_FAILED',
  SUBSCRIPTION_VALIDATION_FAILED = 'SUBSCRIPTION_VALIDATION_FAILED',
  SUBSCRIPTION_INVALID_FORMAT = 'SUBSCRIPTION_INVALID_FORMAT',
  SUBSCRIPTION_EXTRACTION_FAILED = 'SUBSCRIPTION_EXTRACTION_FAILED',
  NETWORK_CAPTURE_FAILED = 'NETWORK_CAPTURE_FAILED',

  // 用户交互取消
  USER_CANCELLED = 'USER_CANCELLED',

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
  SCRIPT_EXECUTION_FAILED = 'SCRIPT_EXECUTION_FAILED',
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
