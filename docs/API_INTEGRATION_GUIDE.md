# AutoSub 现有接口对接文档

## 📋 文档信息

| 项目名称 | Clash AutoSub |
|---------|---------------|
| 版本 | v1.4.5 |
| 技术栈 | Node.js 18+ / TypeScript / Puppeteer |
| 文档版本 | v1.0 |
| 更新日期 | 2025-01-04 |

---

## 🎯 文档目的

本文档旨在为**棕地项目开发**提供完整的现有代码结构说明，帮助开发者：
1. 快速理解AutoSub现有架构
2. 了解每个模块的职责和接口
3. 掌握如何集成新功能（如Clash配置生成器）
4. 避免破坏现有功能

---

## 📁 项目整体结构

```
AutoSub/
├── src/
│   ├── types/              # TypeScript类型定义
│   ├── config/             # 配置管理
│   ├── credentials/        # 凭证管理
│   ├── subscription/       # 订阅提取核心
│   ├── service/            # 业务服务层
│   │   ├── auto-update.ts      # 订阅更新服务
│   │   ├── site-test.ts        # 站点测试服务
│   │   ├── cookie-refresh.ts   # Cookie刷新服务
│   │   └── cookie-status.ts    # Cookie状态检查
│   ├── clash/              # Clash配置更新
│   ├── puppeteer/          # 浏览器自动化
│   ├── ai/                 # AI增强功能
│   ├── utils/              # 工具函数
│   └── cli/                # 命令行界面
│       ├── index.ts            # CLI入口
│       ├── commands/           # 命令处理
│       └── prompts/            # 交互式提示(支持ESC)
├── docs/                   # 文档
│   ├── API_INTEGRATION_GUIDE.md      # 本文档
│   └── CLASH_CONFIG_GENERATOR.md     # Clash配置生成器设计文档
├── dist/                   # 编译输出
└── bin/                    # 可执行文件
```

---

## 🏗️ 核心架构层次

```
┌──────────────────────────────────────────────────────┐
│                    CLI 命令行层                        │
│  src/cli/index.ts - 用户交互、菜单、命令解析           │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│                   服务业务层                           │
│  src/service/                                         │
│  - AutoUpdateService: 订阅更新协调                     │
│  - CookieRefreshService: Cookie刷新                   │
│  - SiteTestService: 站点测试                          │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│                  订阅提取层                            │
│  src/subscription/                                    │
│  - PuppeteerApiExtractor: 浏览器提取                   │
│  - HttpApiExtractor: HTTP API提取（静默模式）          │
│  - SubscriptionValidator: 订阅验证                    │
│  - ApiDetector: API自动检测                           │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│                   基础设施层                           │
│  - ConfigManager: 配置管理                             │
│  - CredentialsManager: 凭证管理                       │
│  - PuppeteerBrowser: 浏览器控制                       │
│  - ClashConfigUpdater: Clash配置更新                  │
│  - Logger: 日志系统                                   │
└──────────────────────────────────────────────────────┘
```

---

## 📦 核心模块详解

### 1. 类型定义模块 (`src/types/`)

#### 📄 `src/types/index.ts`

**作用**: 全局TypeScript类型定义，是整个项目的类型基石。

**核心类型**:

##### 1.1 配置相关类型

```typescript
/**
 * 站点配置 - 描述一个VPN订阅站点的完整信息
 */
export interface SiteConfig {
  id: string;                    // 唯一标识符
  name: string;                  // 站点名称
  url: string;                   // 站点URL

  credentials: {                 // 凭证信息（已废弃，改用credentialFile）
    cookies: string;
    localStorage: string;
    sessionStorage: string;
    tokens: string;
  };

  lastUpdate: string;            // 最后更新时间（ISO格式）
  subscriptionUrl: string;       // 订阅地址
  extractionMode: 'api' | 'dom' | 'clipboard'; // 提取模式
  enabled: boolean;              // 是否启用

  // 可选字段
  loginDetection?: LoginDetectionConfig;  // 登录检测配置
  selector?: SiteSelectors;               // 选择器配置
  credentialFile?: string;                // 凭证文件路径
  credentialsUpdatedAt?: string;          // 凭证更新时间
  cookieValid?: boolean;                  // Cookie有效性状态
  api?: HttpApiConfig;                    // HTTP API配置
}

/**
 * HTTP API配置 - 用于静默后台提取订阅地址
 */
export interface HttpApiConfig {
  url: string;                   // API端点URL
  method: 'GET' | 'POST';        // HTTP方法

  // 认证配置
  authSource: 'cookie' | 'localStorage' | 'both'; // 认证来源
  authField?: string;            // localStorage认证字段路径，如 "app-user.token"

  // 订阅地址提取方式（三种模式任选其一）
  subscriptionUrl?: SubscriptionUrlComponents; // 方式1: URL组件模式（推荐）
  tokenField?: string;           // 提取token字段，如 "data.token"
  subscribeUrlPattern?: string;  // 方式2: token拼接模式
  subscribeUrlField?: string;    // 方式3: 直接提取订阅地址

  // 可选配置
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: Record<string, any>;
}

/**
 * 完整配置文件结构
 */
export interface ClashAutoSubConfig {
  version: string;               // 配置版本
  sites: SiteConfig[];           // 站点列表
  clash: ClashConfig;            // Clash配置
  settings: {
    autoUpdate: boolean;         // 是否启用自动更新
    updateInterval: string;      // 更新间隔（cron表达式）
  };
  ai?: AIConfig;                 // AI配置（可选）
}
```

##### 1.2 凭证相关类型

```typescript
/**
 * 存储的凭证信息
 */
export interface StoredCredentials {
  cookies: Array<Record<string, any>>;      // Cookie数组
  localStorage: Record<string, string>;     // localStorage键值对
  sessionStorage: Record<string, string>;   // sessionStorage键值对
  updatedAt: string;                        // 更新时间
}
```

##### 1.3 订阅验证类型

```typescript
/**
 * 订阅验证结果
 */
export interface ValidationResult {
  valid: boolean;                // 是否有效
  nodeCount?: number;            // 节点数量
  httpStatus?: number;           // HTTP状态码
  warning?: string;              // 警告信息（如CloudFlare拦截）
  error?: string;                // 错误信息
  config?: any;                  // 解析后的配置
}
```

##### 1.4 更新结果类型

```typescript
/**
 * 站点更新结果
 */
export interface UpdateResult {
  siteName: string;              // 站点名称
  success: boolean;              // 是否成功
  duration: number;              // 耗时（毫秒）
  message: string;               // 消息
  subscriptionUrl?: string;      // 订阅地址
  error?: Error;                 // 错误对象
  warning?: string;              // 警告信息
}
```

##### 1.5 错误代码枚举

```typescript
/**
 * 错误代码 - 统一的错误标识
 */
export enum ErrorCode {
  // Puppeteer相关
  BROWSER_LAUNCH_FAILED = 'BROWSER_LAUNCH_FAILED',
  PAGE_NAVIGATION_FAILED = 'PAGE_NAVIGATION_FAILED',

  // 订阅相关
  SUBSCRIPTION_EXTRACTION_FAILED = 'SUBSCRIPTION_EXTRACTION_FAILED',
  SUBSCRIPTION_VALIDATION_FAILED = 'SUBSCRIPTION_VALIDATION_FAILED',

  // Clash配置相关
  CLASH_CONFIG_UPDATE_FAILED = 'CLASH_CONFIG_UPDATE_FAILED',

  // 通用错误
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  // ... 更多错误码
}

/**
 * 自定义错误类
 */
export class AutoSubError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = 'AutoSubError';
  }
}
```

**使用场景**:
- 所有模块导入类型定义
- 确保类型安全
- IDE智能提示

---

### 2. 配置管理模块 (`src/config/`)

#### 📄 `src/config/manager.ts`

**作用**: 负责加载、保存、管理项目配置文件（`~/.autosub/config.yaml`）。

**核心类**: `ConfigManager`

##### 2.1 主要属性

```typescript
class ConfigManager {
  private config: ClashAutoSubConfig;    // 当前配置对象
  private configPath: string;            // 配置文件路径
}
```

##### 2.2 核心方法

| 方法名 | 参数 | 返回值 | 作用 | 使用示例 |
|--------|------|-------|------|---------|
| `load()` | - | `ClashAutoSubConfig` | 从文件加载配置 | `configManager.load()` |
| `save()` | - | `void` | 保存配置到文件 | `configManager.save()` |
| `getConfig()` | - | `ClashAutoSubConfig` | 获取当前配置 | `const config = configManager.getConfig()` |
| `setConfig(config)` | `ClashAutoSubConfig` | `void` | 设置配置对象 | `configManager.setConfig(newConfig)` |
| `getSites()` | - | `SiteConfig[]` | 获取所有站点 | `const sites = configManager.getSites()` |
| `getSiteById(id)` | `string` | `SiteConfig \| undefined` | 根据ID获取站点 | `const site = configManager.getSiteById('红杏云')` |
| `getSiteByName(name)` | `string` | `SiteConfig \| undefined` | 根据名称获取站点 | `const site = configManager.getSiteByName('红杏云')` |
| `addSite(site)` | `SiteConfig` | `void` | 添加新站点 | `configManager.addSite(newSite); configManager.save()` |
| `updateSite(site)` | `SiteConfig` | `void` | 更新站点配置 | `configManager.updateSite(updatedSite); configManager.save()` |
| `deleteSite(id)` | `string` | `void` | 删除站点 | `configManager.deleteSite('红杏云'); configManager.save()` |
| `getClashConfigPath()` | - | `string` | 获取Clash配置路径 | `const path = configManager.getClashConfigPath()` |
| `setClashConfigPath(path)` | `string` | `void` | 设置Clash配置路径 | `configManager.setClashConfigPath('/path/to/clash.yaml')` |
| `getAIConfig()` | - | `AIConfig \| undefined` | 获取AI配置 | `const aiConfig = configManager.getAIConfig()` |
| `setAIConfig(config)` | `AIConfig` | `void` | 设置AI配置 | `configManager.setAIConfig(aiConfig)` |

##### 2.3 单例模式

```typescript
import { getConfigManager } from './config/manager.js';

// 获取全局唯一实例
const configManager = getConfigManager();

// 使用示例
const sites = configManager.getSites();
const hongxingyun = configManager.getSiteById('红杏云');
```

**重要提示**:
- ⚠️ 修改配置后**必须调用 `save()`** 才会持久化到文件
- ✅ 推荐在修改后立即保存：`configManager.updateSite(site); configManager.save();`

---

### 3. 凭证管理模块 (`src/credentials/`)

#### 📄 `src/credentials/manager.ts`

**作用**: 管理站点登录凭证（Cookies、localStorage等），存储在独立的JSON文件中。

##### 3.1 核心函数

| 函数名 | 参数 | 返回值 | 作用 | 使用示例 |
|--------|------|-------|------|---------|
| `ensureCredentialDir()` | - | `void` | 确保凭证目录存在 | `ensureCredentialDir()` |
| `getCredentialFilePath(siteId)` | `string` | `string` | 获取凭证文件路径 | `const path = getCredentialFilePath('红杏云')` |
| `writeCredentials(siteId, credentials)` | `string, StoredCredentials` | `Promise<string>` | 写入凭证到文件 | `await writeCredentials('红杏云', creds)` |
| `readCredentials(siteId)` | `string` | `Promise<StoredCredentials>` | 读取凭证文件 | `const creds = await readCredentials('红杏云')` |
| `deleteCredentials(siteId)` | `string` | `Promise<void>` | 删除凭证文件 | `await deleteCredentials('红杏云')` |

##### 3.2 凭证文件存储位置

```
~/.autosub/credentials/
├── 红杏云.json
├── 糖果云.json
└── 牛逼机场.json
```

##### 3.3 凭证文件格式

```json
{
  "cookies": [
    {
      "name": "session",
      "value": "xxx...",
      "domain": ".example.com",
      "path": "/",
      "expires": 1735344000
    }
  ],
  "localStorage": {
    "app-user": "{\"token\":\"xxx...\"}"
  },
  "sessionStorage": {},
  "updatedAt": "2025-01-04T10:50:00.000Z"
}
```

##### 3.4 使用示例

```typescript
import { readCredentials, writeCredentials } from './credentials/manager.js';

// 读取凭证
const credentials = await readCredentials('红杏云');
console.log(credentials.cookies.length); // 输出Cookie数量

// 写入凭证
await writeCredentials('红杏云', {
  cookies: [...],
  localStorage: {...},
  sessionStorage: {},
  updatedAt: new Date().toISOString()
});
```

---

### 4. 订阅提取模块 (`src/subscription/`)

这是AutoSub的**核心模块**，负责从VPN站点提取订阅地址。

#### 📄 `src/subscription/http-api-extractor.ts`

**作用**: 使用HTTP请求（静默模式）提取订阅地址，无需启动浏览器。

**核心类**: `HttpApiExtractor`

##### 4.1 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `extractFromSite(siteConfig)` | `SiteConfig` | `Promise<string>` | 从站点提取订阅地址（入口方法） |
| `extract(apiConfig, credentials)` | `HttpApiConfig, StoredCredentials` | `Promise<string>` | 执行HTTP API提取 |
| `buildRequestConfig(apiConfig, cookies, localStorage)` | `HttpApiConfig, any[], Record<string, string>?` | `AxiosRequestConfig` | 构建HTTP请求配置 |
| `extractAuthToken(localStorage, authField)` | `Record<string, string>?, string?` | `string \| null` | 从localStorage提取认证Token |
| `extractFieldFromResponse(data, fieldPath)` | `any, string` | `string \| null` | 从API响应中提取字段值 |
| `tryFixSubscriptionUrl(apiUrl, apiConfig)` | `string, HttpApiConfig` | `string` | 修复订阅地址格式（处理/sub/{token}等） |

##### 4.2 工作流程

```
1. 读取站点配置（SiteConfig）
   ↓
2. 检查是否配置了API模式
   ↓
3. 读取存储的凭证（Cookies/localStorage）
   ↓
4. 验证凭证有效性
   ↓
5. 构建HTTP请求（添加Cookie、Token等）
   ↓
6. 发送请求到API端点
   ↓
7. 从响应中提取订阅地址
   ↓
8. 修复URL格式（如需要）
   ↓
9. 返回订阅地址
```

##### 4.3 使用示例

```typescript
import { HttpApiExtractor } from './subscription/http-api-extractor.js';

const extractor = new HttpApiExtractor();
const siteConfig = configManager.getSiteById('红杏云');

try {
  const subscriptionUrl = await extractor.extractFromSite(siteConfig);
  console.log('订阅地址:', subscriptionUrl);
} catch (error) {
  console.error('提取失败:', error.message);
}
```

---

#### 📄 `src/subscription/puppeteer-api-extractor.ts`

**作用**: 使用Puppeteer浏览器自动化提取订阅地址（首次登录或API模式失败时）。

**核心类**: `PuppeteerApiExtractor`

##### 4.4 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `extract(siteConfig, silentMode)` | `SiteConfig, boolean` | `Promise<string>` | 提取订阅地址（主入口） |
| `extractSubscriptionUrl(page)` | `Page` | `Promise<string \| null>` | 从页面提取订阅地址 |
| `waitForSubscriptionRequests(page)` | `Page` | `Promise<string \| null>` | 等待订阅API请求 |
| `clickCopyLinkButton(page)` | `Page` | `Promise<void>` | 点击"复制链接"按钮 |
| `clickButtonWithAI(page)` | `Page` | `Promise<boolean>` | 使用AI识别并点击按钮 |
| `clickButtonWithTextMatching(page)` | `Page` | `Promise<boolean>` | 通过文本匹配点击按钮 |
| `readClipboard(page)` | `Page` | `Promise<string \| null>` | 读取剪贴板内容 |
| `extractUrlFromModal(page)` | `Page` | `Promise<string \| null>` | 从模态框提取URL |
| `captureAndPersistCredentials(page, siteConfig)` | `Page, SiteConfig` | `Promise<void>` | 捕获并保存凭证 |
| `detectAndSaveApiConfig(page, siteConfig)` | `Page, SiteConfig` | `Promise<void>` | 自动检测API配置 |
| `injectStoredCredentials(page, siteConfig)` | `Page, SiteConfig` | `Promise<boolean>` | 注入存储的凭证 |

##### 4.5 提取策略（优先级从高到低）

```
策略1: 从模态框提取
  ↓ (失败)
策略2: 等待订阅API请求
  ↓ (失败)
策略3: 点击复制按钮 + 读取剪贴板
  ↓ (失败)
策略4: 扫描页面所有链接
```

##### 4.6 使用示例

```typescript
import { PuppeteerApiExtractor } from './subscription/puppeteer-api-extractor.js';
import { PuppeteerBrowser } from './puppeteer/browser.js';

const browser = new PuppeteerBrowser();
await browser.launch();

const extractor = new PuppeteerApiExtractor(browser);
const siteConfig = configManager.getSiteById('红杏云');

try {
  const subscriptionUrl = await extractor.extract(siteConfig, false);
  console.log('订阅地址:', subscriptionUrl);
} catch (error) {
  console.error('提取失败:', error.message);
} finally {
  await browser.close();
}
```

---

#### 📄 `src/subscription/validator.ts`

**作用**: 验证订阅地址有效性，解析订阅内容，统计节点数量。

**核心类**: `SubscriptionValidator`

##### 4.7 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `validate(subscriptionUrl)` | `string` | `Promise<ValidationResult>` | 验证订阅地址 |
| `quickValidate(subscriptionUrl)` | `string` | `Promise<boolean>` | 快速验证（仅检查可达性） |
| `fetchSubscription(url)` | `string` | `Promise<AxiosResponse<string>>` | 下载订阅内容 |
| `parseSubscriptionContent(content)` | `any` | `any` | 解析订阅内容（YAML/Base64） |
| `countNodes(config)` | `any` | `number` | 统计节点数量 |
| `analyzeResponseWithAI(responseData, statusCode)` | `string, number` | `Promise<{valid: boolean, reason?: string}>` | AI分析响应有效性 |
| `compareSubscriptions(oldConfig, newConfig)` | `any, any` | `{added: string[], removed: string[], unchanged: string[]}` | 比较订阅差异 |

##### 4.8 验证流程

```
1. 下载订阅内容（HTTP GET）
   ↓
2. AI分析响应是否有效
   ↓
3. 解析订阅格式（Clash YAML / Base64）
   ↓
4. 统计节点数量
   ↓
5. 返回验证结果
```

##### 4.9 使用示例

```typescript
import { SubscriptionValidator } from './subscription/validator.js';

const validator = new SubscriptionValidator();

const result = await validator.validate(
  'https://example.com/sub?token=xxx'
);

if (result.valid) {
  console.log(`✓ 订阅有效，包含 ${result.nodeCount} 个节点`);
} else {
  console.log(`✗ 订阅无效: ${result.error}`);
}
```

---

#### 📄 `src/subscription/api-detector.ts`

**作用**: 自动检测站点的API模式（通过分析网络请求）。

**核心类**: `ApiDetector`

##### 4.10 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `detect(requests, localStorage)` | `NetworkRequest[], Record<string, string>?` | `DetectionResult` | 检测订阅API配置 |
| `filterSubscriptionRequests(requests)` | `NetworkRequest[]` | `NetworkRequest[]` | 过滤订阅相关请求 |
| `analyzeRequest(request, localStorage)` | `NetworkRequest, Record<string, string>?` | `DetectionResult` | 分析单个请求 |
| `detectAuthSource(request, localStorage)` | `NetworkRequest, Record<string, string>?` | `'cookie' \| 'localStorage' \| 'both'` | 检测认证来源 |

##### 4.11 使用示例

```typescript
import { ApiDetector } from './subscription/api-detector.js';

const detector = new ApiDetector();

// 网络请求列表（由PuppeteerApiExtractor收集）
const requests = [
  {
    url: 'https://example.com/api/user/getSubscribe',
    method: 'GET',
    status: 200,
    responseBody: '{"data": {"subscribe_url": "https://..."}}'
  }
];

const result = detector.detect(requests, localStorage);

if (result.detected && result.config) {
  console.log('检测到API配置:', result.config);
  // 保存到站点配置
  siteConfig.api = result.config;
}
```

---

### 5. 服务业务层 (`src/service/`)

#### 📄 `src/service/auto-update.ts`

**作用**: 协调订阅更新流程，是更新功能的**总控制器**。

**核心类**: `AutoUpdateService`

##### 5.1 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `initialize()` | - | `Promise<void>` | 初始化服务（启动浏览器） |
| `updateSite(siteId)` | `string` | `Promise<UpdateResult>` | 更新单个站点 |
| `updateAll()` | - | `Promise<UpdateResult[]>` | 更新所有站点 |
| `updateValidSites()` | - | `Promise<UpdateResult[]>` | 更新所有启用且有效凭证的站点 |
| `processSiteUpdate(site)` | `SiteConfig` | `Promise<UpdateResult>` | 处理站点更新（内部方法） |
| `extractSubscription(site)` | `SiteConfig` | `Promise<string>` | 提取订阅地址（优先API模式） |
| `updateSiteConfig(site, subscriptionUrl)` | `SiteConfig, string` | `Promise<void>` | 更新站点配置并保存 |
| `cleanup()` | - | `Promise<void>` | 清理资源（关闭浏览器） |

##### 5.2 更新流程

```
1. 读取站点配置
   ↓
2. 判断提取模式（API优先）
   ↓
3a. API模式: 使用HttpApiExtractor
3b. Puppeteer模式: 使用PuppeteerApiExtractor
   ↓
4. 验证订阅地址
   ↓
5. 保存订阅地址到配置
   ↓
6. 更新Clash配置（如果启用）
   ↓
7. 返回更新结果
```

##### 5.3 使用示例

```typescript
import { AutoUpdateService } from './service/auto-update.js';

const service = new AutoUpdateService();

// 初始化
await service.initialize();

try {
  // 更新单个站点
  const result = await service.updateSite('红杏云');
  console.log(result.success ? '✓ 成功' : '✗ 失败');

  // 更新所有站点
  const results = await service.updateAll();
  console.log(`完成 ${results.length} 个站点更新`);

} finally {
  // 清理资源
  await service.cleanup();
}
```

**重要提示**:
- ⚠️ 使用前必须调用 `initialize()`
- ⚠️ 使用完毕必须调用 `cleanup()` 释放浏览器资源
- ✅ 建议使用 try-finally 确保资源释放

---

### 6. Clash配置更新模块 (`src/clash/`)

#### 📄 `src/clash/updater.ts`

**作用**: 更新Clash配置文件中的订阅节点。

**核心类**: `ClashConfigUpdater`

##### 6.1 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `updateProxies(newProxies)` | `any[]` | `Promise<void>` | 更新代理节点列表 |
| `updateFull(newConfig)` | `any` | `Promise<void>` | 完全替换配置 |
| `loadConfig()` | - | `any` | 加载Clash配置 |
| `validateConfig(config)` | `any` | `boolean` | 验证配置有效性 |
| `restoreFromBackup(backupIndex)` | `number?` | `Promise<void>` | 从备份恢复 |
| `mergeConfig(existingConfig, newConfig)` | `any, any` | `any` | 合并配置 |

##### 6.2 使用示例

```typescript
import { ClashConfigUpdater } from './clash/updater.js';

const updater = new ClashConfigUpdater(
  '/path/to/clash.yaml',
  true,  // 启用备份
  5      // 保留5个备份
);

// 更新节点列表
await updater.updateProxies(newProxies);

// 从备份恢复
await updater.restoreFromBackup(0); // 恢复最新备份
```

---

### 7. Puppeteer浏览器模块 (`src/puppeteer/`)

#### 📄 `src/puppeteer/browser.ts`

**作用**: 封装Puppeteer浏览器操作，提供统一接口。

**核心类**: `PuppeteerBrowser`

##### 7.1 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `launch()` | - | `Promise<void>` | 启动浏览器 |
| `close()` | - | `Promise<void>` | 关闭浏览器 |
| `getPage()` | - | `Page` | 获取当前页面对象 |
| `getBrowser()` | - | `Browser \| null` | 获取浏览器实例 |
| `goto(url)` | `string` | `Promise<void>` | 导航到URL |
| `waitForNavigation(options)` | `any?` | `Promise<void>` | 等待页面导航 |
| `waitForSelector(selector, options)` | `string, any?` | `Promise<void>` | 等待元素出现 |
| `evaluate(fn)` | `Function` | `Promise<any>` | 在页面执行JavaScript |
| `clearCookies()` | - | `Promise<void>` | 清除所有Cookies |

##### 7.2 使用示例

```typescript
import { PuppeteerBrowser } from './puppeteer/browser.js';

const browser = new PuppeteerBrowser();

try {
  // 启动浏览器
  await browser.launch();

  // 导航
  await browser.goto('https://example.com');

  // 等待元素
  await browser.waitForSelector('#login-button');

  // 执行JavaScript
  const title = await browser.evaluate(() => document.title);

} finally {
  // 关闭浏览器
  await browser.close();
}
```

**重要提示**:
- ⚠️ 必须先调用 `launch()` 再使用其他方法
- ⚠️ 使用完毕必须调用 `close()`
- ✅ 建议使用 try-finally 确保浏览器关闭

---

#### 📄 `src/service/site-test.ts`

**作用**: 站点兼容性测试服务,用于测试新站点是否支持AutoSub自动化提取。

**核心类**: `SiteTestService`

##### 5.4 核心方法

| 方法名 | 参数 | 返回值 | 作用 |
|--------|------|-------|------|
| `runTest()` | - | `Promise<TestReport>` | 执行完整的兼容性测试 |
| `startBrowser()` | - | `Promise<void>` | 启动浏览器 |
| `waitForLogin()` | - | `Promise<void>` | 等待用户手动登录 |
| `captureCredentials()` | - | `Promise<void>` | 捕获登录凭证 |
| `extractSubscriptionFromClipboard()` | - | `Promise<void>` | 从剪贴板提取订阅地址 |
| `detectApi()` | - | `Promise<void>` | 检测订阅API |
| `calculateCompatibility()` | - | `void` | 计算兼容性评分 |
| `cleanup()` | - | `Promise<void>` | 清理资源 |

##### 5.5 测试流程

```
1. 启动浏览器
   ↓
2. 打开站点,等待用户登录
   ↓
3. 捕获凭证(Cookies/localStorage)
   ↓
4. 点击复制订阅按钮,从剪贴板提取
   ↓
5. 检测API配置
   ↓
6. 计算兼容性评分
   ↓
7. 生成测试报告
```

##### 5.6 测试报告结构

```typescript
interface TestReport {
  url: string;                      // 测试的站点URL
  testTime: string;                 // 测试时间

  // 登录检测
  loginDetected: boolean;           // 是否检测到登录
  loginMethod?: string;             // 登录方式
  loginDuration?: number;           // 登录耗时

  // 凭证捕获
  credentials: {
    cookies: { found: boolean; count: number; hasExpiry: boolean; };
    localStorage: { found: boolean; count: number; keys: string[]; };
    sessionStorage: { found: boolean; count: number; keys: string[]; };
  };

  // 订阅提取
  subscriptionExtracted: boolean;   // 是否成功提取
  extractionMethod?: 'clipboard' | 'api';
  clipboardSubscriptionUrl?: string;
  subscriptionUrl?: string;

  // API检测
  apiDetected: boolean;
  apiConfig?: HttpApiConfig;

  // URL转换规则(如果剪贴板URL与API URL不一致)
  urlTransformPattern?: {
    apiFormat: string;
    correctFormat: string;
    transformRule: string;
  };

  // 兼容性评估
  compatibility: {
    level: 'full' | 'partial' | 'none';
    score: number;                  // 0-100分
    canUseHttpApi: boolean;         // 支持静默API模式
    canUseBrowserMode: boolean;     // 支持浏览器模式
  };

  errors: string[];
  warnings: string[];
  steps: TestStep[];
}
```

##### 5.7 兼容性评分规则

| 项目 | 分数 | 说明 |
|------|------|------|
| 登录检测 | 30分 | 成功检测到登录状态 |
| 凭证捕获 | 20分 | 成功捕获Cookies或localStorage |
| API检测 | 30分 | 检测到订阅API |
| 订阅提取 | 20分 | 成功提取订阅地址 |

**兼容性等级**:
- `full` (80-100分): 完全支持,可使用API模式
- `partial` (50-79分): 部分支持,可使用浏览器模式
- `none` (<50分): 不支持或需要手动配置

##### 5.8 使用示例

```typescript
import { SiteTestService } from './service/site-test.js';

const testService = new SiteTestService('https://example.com');

try {
  const report = await testService.runTest();

  console.log(`兼容性等级: ${report.compatibility.level}`);
  console.log(`评分: ${report.compatibility.score}/100`);

  if (report.compatibility.canUseHttpApi) {
    console.log('✓ 支持HTTP API模式');
    console.log('API配置:', report.apiConfig);
  }

  if (report.compatibility.canUseBrowserMode) {
    console.log('✓ 支持浏览器模式');
  }

  if (report.urlTransformPattern) {
    console.log('URL转换规则:', report.urlTransformPattern.transformRule);
  }

} catch (error) {
  console.error('测试失败:', error);
}
```

**重要提示**:
- ⚠️ 测试过程需要用户手动登录
- ⚠️ 测试不会保存任何数据到配置文件
- ✅ 测试完成后会自动关闭浏览器
- ✅ 测试报告可用于指导站点配置

---

### 8. 工具函数模块 (`src/utils/`)

#### 📄 `src/utils/logger.ts`

**作用**: 统一的日志系统。

##### 8.1 使用方法

```typescript
import { logger } from './utils/logger.js';

logger.info('普通信息');
logger.warn('警告信息');
logger.error('错误信息');
logger.debug('调试信息');
```

##### 8.2 日志级别

| 级别 | 方法 | 使用场景 |
|------|------|---------|
| INFO | `logger.info()` | 正常流程信息 |
| WARN | `logger.warn()` | 警告（不影响功能） |
| ERROR | `logger.error()` | 错误（功能失败） |
| DEBUG | `logger.debug()` | 调试信息（默认不显示） |

---

#### 📄 `src/utils/file.ts`

**作用**: 文件操作工具。

##### 8.3 核心常量和函数

```typescript
// 配置文件路径
export const CONFIG_FILE: string;      // ~/.autosub/config.yaml
export const CREDENTIAL_DIR: string;   // ~/.autosub/credentials/

// 文件操作
export class FileUtil {
  static exists(path: string): boolean;
  static readFile(path: string): string;
  static writeFile(path: string, content: string): void;
  static ensureDir(path: string): void;
  static deleteFile(path: string): void;
}
```

---

### 9. CLI命令行模块 (`src/cli/`)

#### 📄 `src/cli/index.ts`

**作用**: 命令行界面入口,提供用户交互和命令解析。

##### 9.1 核心功能函数

| 函数名 | 作用 | 说明 |
|--------|------|------|
| `showBanner()` | 显示欢迎横幅 | 启动时展示项目Logo |
| `showMainMenu()` | 显示主菜单 | 交互式菜单导航 |
| `handleUpdate()` | 处理订阅更新 | 更新站点订阅地址 |
| `handleRefresh()` | 处理Cookie刷新 | 刷新站点凭证 |
| `handleStatus()` | 显示站点状态 | 查看所有站点状态 |
| `handleSiteManagement()` | 站点管理 | 添加/编辑/删除站点 |
| `handleSiteTest()` | 站点测试 | 测试站点兼容性 |
| `handleClashConfig()` | Clash配置 | 配置Clash路径 |
| `handleAIConfig()` | AI配置 | 配置DeepSeek API |
| `handleUninstall()` | 卸载程序 | 删除配置和数据 |

##### 9.2 可用命令

**交互式命令**:
```bash
# 启动交互式菜单
autosub
```

**直接命令**:
```bash
# 更新订阅
autosub update [站点名称]           # 更新指定站点
autosub update --all               # 更新所有站点
autosub update --valid             # 更新所有有效凭证的站点

# 刷新Cookie
autosub refresh [站点名称]          # 刷新指定站点
autosub refresh --all              # 刷新所有站点

# 查看状态
autosub status                     # 显示所有站点状态

# 站点管理
autosub site add                   # 添加新站点
autosub site edit <站点名>         # 编辑站点
autosub site delete <站点名>       # 删除站点

# 站点测试
autosub test <站点URL>             # 测试站点兼容性

# 配置管理
autosub config view                # 查看配置
autosub config clash               # 配置Clash路径
autosub config ai                  # 配置AI

# 其他
autosub version                    # 显示版本
autosub uninstall                  # 卸载程序
```

##### 9.3 菜单结构

```
┌────────────────────────────────────┐
│         Clash AutoSub              │
│      订阅自动更新工具 v1.4.5        │
└────────────────────────────────────┘

主菜单:
  1. 🔄 更新订阅
     └─ 选择站点 / 更新所有

  2. 🍪 刷新Cookie
     └─ 选择站点 / 刷新所有

  3. 📊 查看状态
     └─ 显示所有站点状态和Cookie有效性

  4. ⚙️ 站点管理
     ├─ 添加新站点
     ├─ 编辑站点
     └─ 删除站点

  5. 🧪 测试站点
     └─ 测试新站点兼容性

  6. 🔧 配置
     ├─ 配置Clash路径
     └─ 配置AI

  7. ❌ 卸载程序

  0. 退出
```

##### 9.4 特殊交互提示

AutoSub使用自定义的Inquirer提示,支持**ESC键取消**功能:

```typescript
import { inputWithEsc, listWithEsc } from './prompts/index.js';

// 输入框(支持ESC取消)
const answer = await inputWithEsc({
  message: '请输入站点名称:',
  validate: (input) => input.trim() !== '' || '站点名称不能为空'
});

// 选择列表(支持ESC取消)
const choice = await listWithEsc({
  message: '选择站点:',
  choices: sites.map(s => ({ name: s.name, value: s.id }))
});
```

**ESC键提示**:
```
💡 提示: 按 ESC 键可随时取消操作
```

##### 9.5 CLI使用示例

**示例1: 添加新站点**
```bash
$ autosub site add
? 请输入站点名称: 红杏云
? 请输入站点URL: https://example.com
✓ 已保存站点配置
⏳ 正在启动浏览器...
📌 请在浏览器中登录站点
✓ 登录成功，已捕获凭证
✓ 订阅地址已提取
✓ 站点添加成功
```

**示例2: 更新订阅**
```bash
$ autosub update --all
⏳ 正在更新订阅...

┌─────────────────────────────────────────────────┐
│ 站点名称: 红杏云                                  │
│ 更新状态: ✓ 成功                                 │
│ 订阅地址: https://example.com/sub?token=xxx      │
│ 节点数量: 42                                     │
│ 耗时: 1.2秒                                      │
└─────────────────────────────────────────────────┘

✓ 更新完成: 3/3 成功
```

**示例3: 站点兼容性测试**
```bash
$ autosub test https://newsite.com
⏳ 正在启动浏览器...
📌 请在浏览器中登录站点
✓ 登录检测成功
✓ 凭证捕获成功 (Cookies: 5, localStorage: 3)
✓ 订阅地址提取成功
✓ API检测成功

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         站点兼容性测试报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

站点URL: https://newsite.com
测试时间: 2025-01-04 10:30:00
兼容性等级: ✅ full (完全支持)
兼容性评分: 90/100

✓ 支持HTTP API模式 (静默更新)
✓ 支持浏览器模式 (手动登录)

API配置:
  URL: https://newsite.com/api/user/subscribe
  方法: GET
  认证: cookie + localStorage
  Token字段: data.subscribe_url

订阅地址: https://newsite.com/sub?token=xxx123

建议: 该站点完全支持AutoSub，推荐使用API模式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**重要提示**:
- ✅ 所有交互式提示都支持ESC键取消
- ✅ 命令支持简写(如 `autosub u` = `autosub update`)
- ⚠️ 部分命令需要sudo权限(如卸载)
- ⚠️ 交互式操作会自动刷新Cookie状态

---

## 🔄 典型业务流程

### 流程1: 首次添加站点

```typescript
// 1. 创建站点配置
const siteConfig: SiteConfig = {
  id: '新站点',
  name: '新站点',
  url: 'https://example.com',
  credentials: { cookies: '', localStorage: '', sessionStorage: '', tokens: '' },
  lastUpdate: new Date().toISOString(),
  subscriptionUrl: '',
  extractionMode: 'api',
  enabled: true
};

// 2. 添加到配置
configManager.addSite(siteConfig);
configManager.save();

// 3. 使用Puppeteer登录并提取
const browser = new PuppeteerBrowser();
await browser.launch();

const extractor = new PuppeteerApiExtractor(browser);
const subscriptionUrl = await extractor.extract(siteConfig, false);

// 4. 更新配置
siteConfig.subscriptionUrl = subscriptionUrl;
configManager.updateSite(siteConfig);
configManager.save();

await browser.close();
```

### 流程2: 使用HTTP API静默更新

```typescript
// 1. 获取站点配置
const site = configManager.getSiteById('红杏云');

// 2. 使用HTTP API提取
const httpExtractor = new HttpApiExtractor();
const subscriptionUrl = await httpExtractor.extractFromSite(site);

// 3. 验证订阅
const validator = new SubscriptionValidator();
const validation = await validator.validate(subscriptionUrl);

if (validation.valid) {
  // 4. 更新配置
  site.subscriptionUrl = subscriptionUrl;
  site.lastUpdate = new Date().toISOString();
  configManager.updateSite(site);
  configManager.save();

  // 5. 更新Clash配置
  const clashUpdater = new ClashConfigUpdater(
    configManager.getClashConfigPath()
  );
  await clashUpdater.updateProxies(validation.config.proxies);
}
```

### 流程3: 批量更新所有站点

```typescript
const updateService = new AutoUpdateService();

try {
  await updateService.initialize();

  const results = await updateService.updateAll();

  results.forEach(result => {
    if (result.success) {
      console.log(`✓ ${result.siteName}: ${result.subscriptionUrl}`);
    } else {
      console.log(`✗ ${result.siteName}: ${result.error?.message}`);
    }
  });

} finally {
  await updateService.cleanup();
}
```

---

## 🔌 新功能集成指南

### 场景: 集成Clash配置生成器

#### 步骤1: 定义新的类型

```typescript
// 在 src/types/index.ts 中添加
export interface ProxyNode {
  name: string;
  type: string;
  server: string;
  port: number;
  // ... 其他字段
}
```

#### 步骤2: 创建解析器

```typescript
// 创建 src/subscription/subscription-parser.ts
import { ValidationResult } from '../types/index.js';

export class SubscriptionParser {
  async parse(subscriptionContent: string): Promise<ProxyNode[]> {
    // 复用现有的 SubscriptionValidator.parseSubscriptionContent
    const validator = new SubscriptionValidator();
    const config = validator['parseSubscriptionContent'](subscriptionContent);

    return config.proxies || [];
  }
}
```

#### 步骤3: 复用现有模块

```typescript
// 创建 src/subscription/clash-config-generator.ts
import { ConfigManager } from '../config/manager.js';
import { SubscriptionValidator } from './validator.js';
import { SubscriptionParser } from './subscription-parser.js';

export class ClashConfigGenerator {
  async generate(): Promise<string> {
    // 1. 获取所有站点
    const sites = getConfigManager().getSites();

    // 2. 下载订阅内容（复用 SubscriptionValidator）
    const validator = new SubscriptionValidator();
    const allNodes: ProxyNode[] = [];

    for (const site of sites) {
      if (!site.enabled || !site.subscriptionUrl) continue;

      try {
        const response = await validator['fetchSubscription'](site.subscriptionUrl);
        const parser = new SubscriptionParser();
        const nodes = await parser.parse(response.data);
        allNodes.push(...nodes);
      } catch (error) {
        logger.warn(`下载 ${site.name} 订阅失败:`, error);
      }
    }

    // 3. 生成配置
    return this.generateConfig(allNodes);
  }
}
```

#### 步骤4: 添加CLI命令

```typescript
// 在 src/cli/index.ts 中添加
cli
  .command('clash:generate', '生成Clash配置')
  .option('--output, -o <path>', '输出文件路径')
  .action(async (options) => {
    const generator = new ClashConfigGenerator();
    const config = await generator.generate();

    const outputPath = options.output || path.join(os.homedir(), '.autosub', 'clash.yaml');
    fs.writeFileSync(outputPath, config);

    console.log(chalk.green(`✓ Clash配置已生成: ${outputPath}`));
  });
```

---

## ⚠️ 重要注意事项

### 1. 配置修改规范

```typescript
// ❌ 错误：修改后未保存
const site = configManager.getSiteById('红杏云');
site.subscriptionUrl = 'https://new-url.com';
// 配置不会持久化！

// ✅ 正确：修改后立即保存
const site = configManager.getSiteById('红杏云');
site.subscriptionUrl = 'https://new-url.com';
configManager.updateSite(site);
configManager.save(); // 必须保存
```

### 2. 浏览器资源管理

```typescript
// ❌ 错误：未关闭浏览器
const browser = new PuppeteerBrowser();
await browser.launch();
// ... 使用浏览器
// 浏览器进程泄漏！

// ✅ 正确：使用 try-finally
const browser = new PuppeteerBrowser();
try {
  await browser.launch();
  // ... 使用浏览器
} finally {
  await browser.close(); // 确保关闭
}
```

### 3. 错误处理

```typescript
// ✅ 推荐：使用 AutoSubError
import { AutoSubError, ErrorCode } from './types/index.js';

throw new AutoSubError(
  ErrorCode.SUBSCRIPTION_EXTRACTION_FAILED,
  '无法提取订阅地址'
);

// ✅ 捕获并处理
try {
  await someOperation();
} catch (error) {
  if (error instanceof AutoSubError) {
    logger.error(`错误代码: ${error.code}, 消息: ${error.message}`);
  } else {
    logger.error('未知错误:', error);
  }
}
```

### 4. 异步操作

```typescript
// ❌ 错误：忘记 await
const result = service.updateSite('红杏云'); // 返回 Promise
console.log(result.success); // undefined!

// ✅ 正确：使用 await
const result = await service.updateSite('红杏云');
console.log(result.success); // true/false
```

---

## 📊 核心数据流

```
用户命令 (CLI)
    ↓
AutoUpdateService.updateSite()
    ↓
判断提取模式
    ↓
┌──────────────────┐         ┌─────────────────────┐
│ API模式           │         │ Puppeteer模式        │
│ HttpApiExtractor │         │ PuppeteerApiExtractor│
└──────────────────┘         └─────────────────────┘
    ↓                             ↓
读取 StoredCredentials       启动浏览器 + 注入凭证
    ↓                             ↓
发送HTTP请求                  自动化操作页面
    ↓                             ↓
提取订阅地址 ←───────────────┘
    ↓
SubscriptionValidator.validate()
    ↓
下载订阅内容 + 解析 + 统计节点
    ↓
AutoUpdateService.updateSiteConfig()
    ↓
保存到 config.yaml + 凭证文件
    ↓
ClashConfigUpdater.updateProxies()
    ↓
更新 Clash 配置文件
```

---

## 🔧 调试技巧

### 1. 查看详细日志

```typescript
// 临时启用 debug 日志
process.env.LOG_LEVEL = 'debug';

// 查看网络请求
logger.debug('API请求:', requestConfig);
logger.debug('API响应:', response.data);
```

### 2. 检查配置文件

```bash
# 查看配置
cat ~/.autosub/config.yaml

# 查看凭证
cat ~/.autosub/credentials/红杏云.json
```

### 3. 测试单个模块

```typescript
// 单独测试订阅验证
const validator = new SubscriptionValidator();
const result = await validator.validate('https://example.com/sub?token=xxx');
console.log(JSON.stringify(result, null, 2));
```

---

## 📚 相关文档

- [Clash配置生成器开发文档](./CLASH_CONFIG_GENERATOR.md)
- [项目README](../README.md)
- [TypeScript类型定义](../src/types/index.ts)

---

## ✅ 检查清单

新功能开发前，请确认：

- [ ] 已阅读本文档
- [ ] 已理解核心模块职责
- [ ] 已了解类型定义（`src/types/index.ts`）
- [ ] 已掌握 ConfigManager 使用方法
- [ ] 已理解订阅提取流程
- [ ] 已知道如何复用现有模块
- [ ] 已知道错误处理规范
- [ ] 已知道资源管理规范（浏览器、配置保存）

---

**文档维护者**: AutoSub Team
**最后更新**: 2025-01-04
**状态**: 🟢 Active
