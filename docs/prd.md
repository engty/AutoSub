# Clash AutoSub 产品需求文档 (PRD)

**版本：** 1.0
**创建日期：** 2025-10-02
**最后更新：** 2025-10-02
**项目状态：** 开发阶段

---

## 目录

- [1. 项目分析与上下文](#1-项目分析与上下文)
- [2. 需求定义](#2-需求定义)
- [3. 技术架构](#3-技术架构)
- [4. 用户界面设计](#4-用户界面设计)
- [5. Epic 和 Story 结构](#5-epic-和-story-结构)

---

## 1. 项目分析与上下文

### 1.1 项目概述

#### 分析来源
- ✅ 项目简报文档 (`docs/project-brief.md`)
- ✅ 基础 PRD 文档 (`docs/basic_prd.md`)
- ✅ Clash 配置示例 (`yaml/test_config.yaml`)
- ✅ ZCF 项目技术栈分析（参考优秀开源项目）
- ✅ Puppeteer 浏览器自动化技术评估

#### 当前项目状态

**项目类型：** 全新 Node.js/TypeScript CLI 自动化工具（从零开始）

**核心目标：**

Clash AutoSub 是一个基于 **Node.js + Puppeteer** 的命令行自动化工具，解决动态 VPN 订阅地址（5分钟更新）导致的手动维护负担。通过控制系统 Chrome 浏览器引导用户登录、捕获凭证（Cookie + Storage），并自动更新 Clash 配置文件。

**关键特性：**

- 🌐 **Puppeteer 浏览器自动化**：直接驱动系统 Chrome 浏览器进行自动化操作
- 🔐 **统一登录策略**：用户手动登录 + Puppeteer 自动捕获所有凭证
- 🛡️ **智能部分更新**：成功的更新，失败的保留原配置
- 📡 **订阅地址验证**：HTTP状态码 + YAML格式 + 节点数量检查
- 🔧 **向导式配置**：交互式 CLI（借鉴 ZCF 设计），自动检测 Clash 路径
- 🔄 **远程维护**：GitHub 托管选择器配置，快速适配网站变化
- 🔒 **本地化安全**：凭证加密存储，零云端上传
- 🤖 **AI 辅助验证**：使用 AI 分析订阅响应内容，智能判断有效性

### 1.2 技术栈

| 类别 | 技术选型 | 版本要求 | 说明 |
|------|----------|----------|------|
| **语言** | TypeScript | 5.0+ | 类型安全，开发体验好 |
| **运行时** | Node.js | 18+ | 现代 JS 特性支持 |
| **CLI 框架** | CAC | 6.7+ | 轻量级命令行框架（借鉴 ZCF） |
| **交互提示** | Inquirer.js | 9.0+ | 交互式问答系统（借鉴 ZCF） |
| **进度显示** | Ora | 8.0+ | 优雅加载动画（借鉴 ZCF） |
| **颜色输出** | Chalk | 5.0+ | 终端颜色美化（借鉴 ZCF） |
| **表格显示** | cli-table3 | 0.6+ | 状态信息表格 |
| **浏览器控制** | Puppeteer-core | 24.x | 直接驱动系统 Chrome |
| **HTTP 客户端** | Axios | 1.6+ | 订阅地址验证 |
| **配置解析** | js-yaml | 4.1+ | Clash YAML 解析 |
| **加密** | crypto-js | 4.2+ | 凭证加密存储 |
| **文件系统** | fs-extra | 11.0+ | 文件操作增强 |
| **打包工具** | tsup | 8.0+ | 快速 TypeScript 打包 |

### 1.3 项目目录结构

```
clash-autosub/
├── bin/
│   └── clash-autosub.js        # CLI 入口
├── src/
│   ├── cli/
│   │   ├── index.ts            # CLI 主程序
│   │   └── prompts/            # Inquirer 提示配置
│   ├── puppeteer/
│   │   ├── browser.ts          # Puppeteer 浏览器管理
│   │   └── login-detector.ts   # 登录状态检测
│   ├── subscription/
│   │   ├── puppeteer-api-extractor.ts  # Puppeteer 订阅提取
│   │   └── validator.ts        # 订阅验证（含 AI）
│   ├── service/
│   │   ├── auto-update.ts      # 自动更新服务
│   │   ├── cookie-refresh.ts   # Cookie 刷新服务
│   │   └── cookie-status.ts    # Cookie 状态检查
│   ├── credentials/
│   │   ├── manager.ts          # 凭证管理（加密存储）
│   │   └── cookie-expiry.ts    # Cookie 过期检测
│   ├── ai/
│   │   ├── index.ts            # AI 服务抽象
│   │   └── deepseek-vision.ts  # DeepSeek 视觉分析
│   ├── clash/
│   │   ├── config-updater.ts   # Clash 配置更新
│   │   └── url-replacer.ts     # URL 替换工具
│   ├── config/
│   │   ├── manager.ts          # 配置管理
│   │   └── schema.ts           # 配置结构定义
│   ├── utils/
│   │   ├── logger.ts           # 日志系统
│   │   └── file.ts             # 文件操作工具
│   └── types/
│       └── index.ts            # TypeScript 类型定义
├── selectors/                  # 选择器配置（GitHub 远程）
│   └── sites/
│       ├── candytally.json     # 糖果云
│       └── hongxingyun.json    # 红杏云
├── templates/                  # 配置模板
├── tests/                      # 测试用例
├── docs/                       # 文档
├── package.json
├── tsconfig.json
└── README.md
```

### 1.4 增强范围定义

#### 增强类型
- ☑️ **新功能添加**（全新 CLI 工具）
- ☑️ **集成新系统**（Puppeteer 浏览器自动化 + Clash 配置）

#### 增强描述

创建一个 **Node.js/TypeScript CLI 自动化工具**，通过 **Puppeteer 驱动系统 Chrome** 控制浏览器，实现：
1. 用户在可视化浏览器中手动或自动（凭证注入）登录 VPN 网站
2. 自动监听网络请求和剪贴板，提取订阅地址
3. 捕获 Cookie、LocalStorage、SessionStorage 并落盘到 `~/.autosub/credentials`
4. 启动时校验凭证有效性并在菜单中展示
5. 验证订阅地址有效性
6. 更新 Clash 配置文件

采用 **ZCF 风格的交互式菜单**，支持多站点智能管理。

#### 影响评估
- ☑️ **最小影响**（独立工具，不修改用户系统文件，除必要依赖外所有文件在 `~/.autosub/`）

### 1.5 目标与背景

#### 目标

1. ✅ 消除 VPN 订阅地址手动更新的重复劳动，实现一键或定时自动化更新
2. ✅ 确保订阅地址验证机制可靠，避免更新后立即失败的情况
3. ✅ 支持多 VPN 站点智能管理，实现部分更新机制（成功的更新，失败的保留）
4. ✅ 提供向导式配置流程（借鉴 ZCF），降低用户首次配置的技术门槛
5. ✅ 实现本地化数据存储，确保用户凭证和配置文件的隐私安全
6. ✅ 通过 GitHub 远程脚本维护，快速适配 VPN 网站页面结构变化

#### 背景上下文

部分 VPN 代理服务商（糖果云、红杏云等）采用动态订阅地址机制（5分钟失效），导致用户需频繁手动登录、复制订阅地址并更新配置文件，严重干扰工作流程。

Clash AutoSub 通过 **Puppeteer 自动化引擎 + 凭证持久化机制** 解决此痛点，并采用 **ZCF 风格的交互式 CLI**，提供优雅的用户体验。

---

## 2. 需求定义

### 2.1 功能需求

#### 核心业务功能

**FR1: 订阅站点配置向导**
- 系统应提供交互式配置向导（`autosub` 或 `autosub setup`）
- 引导用户完成订阅站点配置，包括：
  - 站点 URL 输入（支持预定义站点和自定义站点）
  - 通过 Puppeteer 启动系统 Chrome 浏览器
  - 在无有效 Cookie 时提示用户手动登录（处理验证码/2FA）
  - 自动捕获登录凭证（Cookie + LocalStorage + SessionStorage）并落盘
- 配置保存到 `~/.autosub/config.yaml`，凭证保存到 `~/.autosub/credentials/{siteId}.json`

**FR2: Puppeteer 浏览器自动化流程（核心）**
- 系统通过 Puppeteer 控制系统 Chrome，实现：
  1. 启动系统 Chrome 浏览器（非 headless 模式）
  2. 打开站点登录页面
  3. 自动检测登录状态（使用 AI 视觉分析或 DOM 检测）
  4. 等待用户手动登录完成
  5. 捕获所有凭证（Cookie + localStorage + sessionStorage）
  6. 加密保存凭证到本地文件
  7. 自动导航到订阅页面并提取订阅地址
  8. 关闭浏览器
  - 注入历史凭证自动登录；若无凭证或失效则引导手动登录
  - 登录完成后再次询问用户确认，防止误判
  - 捕获网络请求（订阅 API）、剪贴板和 DOM，以提取订阅地址
  - 捕获最新 Cookie/Storage 并写回凭证文件
  - 监听浏览器关闭行为，将其视为用户主动取消

**FR3: 订阅地址获取策略（多重策略）**
- **策略 A：API 模式提取（优先）**
  - 监听包含 `api`、`token`、`subscription` 的网络请求
  - 从响应体中提取订阅地址或 Token
  - 支持 GET/POST 请求解析

- **策略 B：DOM 元素提取（备用）**
  - 使用 `take_snapshot` 获取页面文本
  - 使用 `evaluate_script` 查找包含订阅地址的 DOM 元素
  - 支持多重选择器策略（优先级数组）

- **策略 C：剪贴板监听（辅助）**
  - 检测用户点击"复制订阅地址"按钮
  - 通过 `evaluate_script` 读取 `navigator.clipboard`

**FR4: 订阅地址验证**
- 系统应验证订阅地址有效性，通过 HTTP 请求检查：
  - 状态码 200
  - 内容格式包含 Clash YAML 关键字（`proxies`/`proxy-groups`）
  - 节点数量 > 0
- **验证失败不允许强制更新**（避免配置损坏）

**FR5: 凭证持久化与启动校验**
- 系统应将每个站点的 Cookie、localStorage、sessionStorage 写入 `~/.autosub/credentials/{siteId}.json`
- 启动 CLI 时批量校验各站点 Cookie 是否有效，将结果写回配置（`cookieValid`）并在菜单展示
- 凭证失效时提示用户重新登录，并在删除站点时清理对应凭证文件

**FR6: 智能部分更新机制**
- 系统应实现智能部分更新机制：
  - 成功获取的订阅地址更新到 Clash 配置文件
  - 失败的账户保留原配置不变
  - 更新前自动备份原文件（`config.yaml.backup.{timestamp}`）

**FR7: 快捷手动更新命令**
- 系统应支持快捷手动更新命令（`autosub update`）
- 一键执行所有配置账户的订阅地址更新
- 显示实时进度和结果摘要（使用 Ora + cli-table3）

**FR8: 定时更新功能**
- 系统应支持在交互式配置向导中设置定时更新功能
- 自动配置系统 Cron 任务
- 支持自定义更新频率（默认每天 1 次，早 8:00）
- 提供日志查看和任务移除功能

**FR9: Clash 配置文件路径设置**
- 系统应支持在交互式配置向导中设置 Clash 配置文件路径
- 自动检测常见路径（macOS/Linux/Windows+WSL）
- 支持手动指定路径
- 验证文件存在性和写权限

**FR9: 多重选择器策略**
- 系统在获取订阅地址时应使用多重选择器策略（优先级数组）
- 单个选择器失败时自动尝试下一个备选选择器
- 支持文本匹配、CSS 类、元素 ID、数据属性等多种定位方式

**FR10: 广告弹窗自动处理**
- 系统应自动检测并处理登录后的广告弹窗
- 通过 `handle_dialog` 或 `click` 点击"关闭"、"知道了"、"下一步"等按钮
- 支持多种弹窗模式（Modal、Alert、Toast）

#### 用户体验功能

**FR11: Cookie 刷新命令**
- 系统应支持在交互式配置向导中提供 Cookie 刷新命令
- 打开浏览器让用户手动登录
- 自动捕获并保存 Cookie
- 显示 Cookie 有效期预估

**FR12: 状态查看命令**
- 系统应支持在交互式配置向导中提供状态查看命令
- 显示所有配置账户的当前状态：
  - 最后更新时间
  - 订阅地址有效性
  - Cookie 过期提醒

**FR13: 自动升级命令**
- 系统应支持在交互式配置向导中提供自动升级命令
- 检查 GitHub Releases 最新版本
- 下载并替换本地脚本
- 保留用户配置文件不变

#### 安全与隐私

**FR14: 凭证加密存储**
- 系统应将用户凭证加密存储在本地（`~/.autosub/config.yaml`）
- 使用 crypto-js 进行对称加密
- Cookie 文件权限设置为 600（仅所有者可读写）

**FR15: 本地化数据存储**
- 系统不应上传任何用户数据到云端
- 所有配置文件、Cookie、日志仅保存在用户本地
- 尽可能不修改用户系统文件
- 除必要依赖外，其余创建的文件一律放在默认目录内（`~/.autosub/`）

### 2.2 非功能需求

**NFR1: 性能要求**
- 单个账户订阅地址更新操作应在 30 秒内完成（正常网络条件下）
- Puppeteer 浏览器启动时间 < 3 秒

**NFR2: 平台支持**
- 系统应支持 macOS 10.15+、Linux（Ubuntu 20.04+）、Windows 10/11（通过 WSL 2）
- Chrome 浏览器版本要求：stable/canary/beta/dev

**NFR3: 依赖控制**
- 系统依赖应控制在最小范围
- 核心依赖总安装体积 < 50 MB（移除 Playwright 后）
- 非必要依赖应在用户触发使用场景时提示安装

**NFR4: 数据可靠性**
- 配置文件损坏率应为零
- 通过自动备份和原子写入保证
- 支持一键回滚到备份版本

**NFR5: 日志系统**
- 系统应提供详细的错误日志（`~/.autosub/logs/autosub.log`）
- 包括时间戳、错误类型、堆栈跟踪
- 日志文件自动轮转（保留最近 7 天）

**NFR6: 错误提示**
- 选择器失效时应显示友好错误信息
- 包括：失败原因、建议解决方案、Issue 提交链接

**NFR7: Headless 模式支持**
- 系统应支持 Headless 模式运行（服务器环境）
- 使用 Puppeteer 的 headless 模式启动浏览器

**NFR8: 代码质量**
- 代码应遵循 TypeScript 最佳实践
- 模块化设计，核心逻辑单元测试覆盖率 > 60%
- 使用 ESLint + Prettier 保证代码风格一致

**NFR9: 按需依赖安装**
- 核心依赖安装时间应 < 10 秒
- 其它非必要依赖，应在用户触发需使用场景时提示安装

**NFR10: 安装提示**
- 按需依赖安装前必须显示清晰提示（功能名称、体积、耗时）
- 征得用户同意后再安装

---

## 3. 技术架构

### 3.1 架构设计

#### 系统架构图

```
┌─────────────────────────────────────────────────────┐
│                 Clash AutoSub CLI (Node.js)                │
│  ┌─────────────────────────────────────────────┐   │
│  │         CLI Layer (CAC + Inquirer)          │   │
│  └─────────────────────────────────────────────┘   │
│                        ↓                             │
│  ┌─────────────────────────────────────────────┐   │
│  │         Core Business Logic                  │   │
│  │  • 配置管理  • 订阅验证  • Clash 更新        │   │
│  └─────────────────────────────────────────────┘   │
│                        ↓                             │
│  ┌─────────────────────────────────────────────┐   │
│  │   MCP Client (@modelcontextprotocol/sdk)    │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       ↓ MCP Protocol (stdio)
┌─────────────────────────────────────────────────────┐
│          Chrome DevTools MCP Server                  │
│           (npx chrome-devtools-mcp@latest)           │
└──────────────────────┬──────────────────────────────┘
                       ↓ Chrome DevTools Protocol
┌─────────────────────────────────────────────────────┐
│              Chrome Browser Instance                 │
│         (用户手动登录 VPN 网站获取订阅)              │
└─────────────────────────────────────────────────────┘
```

### 3.2 核心模块设计

#### 3.2.1 MCP 客户端模块

```typescript
// src/core/mcp/client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class ChromeMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async connect(options?: {
    headless?: boolean;
    isolated?: boolean;
  }) {
    const args = [
      '-y',
      'chrome-devtools-mcp@latest',
      `--headless=${options?.headless ?? false}`,
      `--isolated=${options?.isolated ?? true}`
    ];

    this.transport = new StdioClientTransport({
      command: 'npx',
      args
    });

    this.client = new Client({
      name: 'autosub-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
  }

  async callTool(name: string, args: any) {
    if (!this.client) throw new Error('MCP Client 未连接');
    return await this.client.callTool(name, args);
  }

  async close() {
    if (this.client) await this.client.close();
    if (this.transport) this.transport.close();
  }
}
```

#### 3.2.2 凭证捕获模块

```typescript
// src/core/auth/cookie-capture.ts
export async function captureCookieLogin(siteUrl: string) {
  const mcp = new ChromeMCPClient();
  await mcp.connect({ isolated: true, headless: false });

  // 1. 打开登录页
  await mcp.callTool('navigate_page', { url: siteUrl });

  // 2. 监听网络请求（捕获 Token）
  const capturedTokens: any[] = [];
  const networkMonitor = setInterval(async () => {
    const requests = await mcp.callTool('list_network_requests', {
      resourceTypes: ['xhr', 'fetch']
    });

    for (const req of requests.content) {
      if (req.url.includes('api') || req.url.includes('token')) {
        const detail = await mcp.callTool('get_network_request', {
          url: req.url
        });
        if (detail.responseBody?.includes('token')) {
          capturedTokens.push(detail.responseBody);
        }
      }
    }
  }, 1000);

  // 3. 等待登录成功
  await mcp.callTool('wait_for', { text: 'dashboard' });
  clearInterval(networkMonitor);

  // 4. 提取所有凭证
  const cookies = await mcp.callTool('evaluate_script', {
    function: '() => document.cookie'
  });

  const localStorage = await mcp.callTool('evaluate_script', {
    function: `() => {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        storage[key] = localStorage.getItem(key);
      }
      return JSON.stringify(storage);
    }`
  });

  await mcp.close();

  return {
    cookies: cookies.content,
    localStorage: JSON.parse(localStorage.content),
    tokens: capturedTokens
  };
}
```

### 3.3 数据流设计

#### 配置向导流程

```
用户启动 CLI (npx autosub)
    ↓
交互式菜单（选择"配置订阅站点"）
    ↓
输入站点信息（URL、站点名称）
    ↓
MCP 打开浏览器 → 用户手动登录
    ↓
MCP 监听网络请求 + 提取 Cookie/Storage
    ↓
保存加密凭证到 ~/.autosub/config.yaml
    ↓
返回主菜单
```

#### 订阅更新流程

```
用户选择"手动更新订阅"
    ↓
读取配置文件（所有站点）
    ↓
对每个站点：
  ├── 使用保存的凭证（Cookie/Token）
  ├── 通过 MCP 访问订阅页面
  ├── 提取订阅地址（API/DOM/Clipboard）
  ├── 验证订阅地址（HTTP + YAML + 节点数）
  ├── 成功 → 更新 Clash 配置
  └── 失败 → 保留原配置 + 记录错误
    ↓
显示更新摘要表格（成功/失败统计）
    ↓
自动备份配置文件
```

### 3.4 安全设计

#### 凭证加密

```typescript
// src/utils/crypto.ts
import CryptoJS from 'crypto-js';

const SECRET_KEY = 'user-machine-id'; // 基于机器 ID 生成

export function encrypt(data: string): string {
  return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
}

export function decrypt(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

#### 配置文件结构

```yaml
# ~/.autosub/config.yaml
version: "1.0"
sites:
  - name: "糖果云"
    url: "https://candytally.xyz"
    credentials:
      cookies: "encrypted:xxxxx"
      localStorage: "encrypted:xxxxx"
      tokens: "encrypted:xxxxx"
    last_update: "2025-10-02T10:00:00Z"
    subscription_url: "encrypted:xxxxx"

clash:
  config_path: "/Users/xxx/.config/clash/config.yaml"
  backup_enabled: true
  backup_count: 5

settings:
  auto_update: true
  update_interval: "0 8 * * *"  # Cron 表达式
```

---

## 4. 用户界面设计

### 4.1 CLI 命令设计（借鉴 ZCF）

#### 主命令

```bash
# 默认：打开交互式菜单
npx autosub

# 快捷命令
npx autosub setup      # 配置向导
npx autosub update     # 手动更新
npx autosub cron       # 定时任务
npx autosub status     # 查看状态
```

#### 命令参数

```bash
# 静默模式（适用于 Cron）
autosub update --silent

# 调试模式
autosub setup --debug

# 指定配置文件
autosub update --config /path/to/config.yaml
```

### 4.2 交互式菜单（核心 UX）

#### 主菜单

```
🚀 Clash AutoSub - VPN 订阅自动化工具

? 请选择操作:
  1️⃣  配置订阅站点
  2️⃣  手动更新订阅
  3️⃣  配置定时任务
  4️⃣  查看状态
  5️⃣  刷新 Cookie
  6️⃣  设置 Clash 路径
  7️⃣  升级 Clash AutoSub
  ─────────────────
  ❌  退出
```

#### 配置向导流程

```
📋 订阅站点配置向导

步骤 1/4: 选择订阅站点
? 请选择要配置的订阅站点:
  ❯ 糖果云 (candytally.xyz)
    红杏云 (hongxingyun.xyz)
    自定义站点

步骤 2/4: 输入站点信息
? 站点名称: 糖果云
? 登录页 URL: https://candytally.xyz/web/#/login

步骤 3/4: 浏览器登录
🌐 正在启动浏览器...
✅ 浏览器已打开，请手动登录

[等待用户登录...]

✅ 登录成功检测到！
🔍 正在提取凭证...

步骤 4/4: 保存配置
✅ Cookie 已保存
✅ Token 已提取
✅ 配置已保存到 ~/.autosub/config.yaml

✨ 配置完成！
```

#### 更新操作界面

```
🔄 正在更新订阅地址...

┌─────────────────────────────────────────────┐
│ 账户          状态      耗时    结果        │
├─────────────────────────────────────────────┤
│ 糖果云        ✅ 成功   12s     已更新      │
│ 红杏云        ❌ 失败   8s      保留原配置  │
└─────────────────────────────────────────────┘

📊 更新摘要：
  - 成功: 1/2
  - 失败: 1/2 (保留原配置)
  - Clash 配置已更新: /Users/xxx/.config/clash/config.yaml
  - 备份文件: config.yaml.backup.20251002_100030

💡 提示: 红杏云更新失败，可能是 Cookie 过期
      运行 autosub → 选择 5 刷新 Cookie
```

### 4.3 视觉设计

#### 颜色方案（使用 Chalk）

- **主色调**：青色（Cyan）用于品牌标识
- **功能色**：
  - 绿色 ✅：成功、完成
  - 红色 ❌：错误、失败
  - 黄色 ⚠️：警告、注意
  - 蓝色 ℹ️：信息、提示

#### 图标使用（Emoji）

- 🚀 启动、开始
- 🔄 更新、刷新
- ✅ 成功
- ❌ 失败
- 💡 提示
- 📋 配置
- 🔍 搜索、检测
- 🌐 浏览器
- 🔐 安全、加密
- 📊 统计、报表

---

## 5. Epic 和 Story 结构

### Epic 1: 核心自动化引擎

**Epic 目标：** 实现基于 Chrome DevTools MCP 的自动化核心引擎

#### Story 1.1: MCP 客户端集成
- **作为** Clash AutoSub 用户
- **我想要** 系统能够连接和控制 Chrome DevTools MCP
- **以便** 实现浏览器自动化操作

**验收标准：**
1. ✅ 成功连接 Chrome DevTools MCP Server
2. ✅ 能够调用 MCP 工具（navigate_page, evaluate_script 等）
3. ✅ 支持 isolated 模式和 headless 模式
4. ✅ 正确处理 MCP 连接失败和超时

#### Story 1.2: 凭证捕获功能
- **作为** Clash AutoSub 用户
- **我想要** 系统能够自动捕获我登录后的 Cookie 和 Token
- **以便** 后续自动获取订阅地址

**验收标准：**
1. ✅ 打开浏览器并导航到登录页
2. ✅ 监听网络请求，捕获包含 Token 的 API 响应
3. ✅ 使用 evaluate_script 提取 Cookie 和 Storage
4. ✅ 检测登录成功（URL 变化或特定元素出现）
5. ✅ 保存所有凭证到配置文件（加密存储）

#### Story 1.3: 订阅地址提取
- **作为** Clash AutoSub 用户
- **我想要** 系统能够自动提取订阅地址
- **以便** 更新 Clash 配置

**验收标准：**
1. ✅ 支持 API 模式提取（监听网络请求）
2. ✅ 支持 DOM 模式提取（查找页面元素）
3. ✅ 支持剪贴板模式（读取复制内容）
4. ✅ 多重选择器策略（优先级数组）
5. ✅ 自动处理广告弹窗

#### Story 1.4: 订阅地址验证
- **作为** Clash AutoSub 用户
- **我想要** 系统验证订阅地址有效性
- **以便** 避免更新无效地址导致配置损坏

**验收标准：**
1. ✅ HTTP 状态码检查（200）
2. ✅ YAML 格式验证（包含 proxies 关键字）
3. ✅ 节点数量检查（> 0）
4. ✅ 验证失败时不允许更新
5. ✅ 提供详细的失败原因

---

### Epic 2: CLI 交互系统

**Epic 目标：** 实现 ZCF 风格的交互式 CLI 界面

#### Story 2.1: 交互式菜单
- **作为** Clash AutoSub 用户
- **我想要** 一个清晰的交互式菜单
- **以便** 快速选择操作

**验收标准：**
1. ✅ 使用 Inquirer.js 实现菜单
2. ✅ 支持箭头键选择、回车确认
3. ✅ 显示清晰的图标和颜色标识
4. ✅ 支持返回上一级菜单

#### Story 2.2: 配置向导
- **作为** Clash AutoSub 新用户
- **我想要** 一个分步骤的配置向导
- **以便** 快速完成首次配置

**验收标准：**
1. ✅ 步骤 1：选择/输入站点信息
2. ✅ 步骤 2：浏览器登录和凭证捕获
3. ✅ 步骤 3：设置 Clash 配置路径
4. ✅ 步骤 4：保存配置
5. ✅ 每步显示进度提示（如：步骤 2/4）

#### Story 2.3: 进度和状态显示
- **作为** Clash AutoSub 用户
- **我想要** 看到操作的实时进度
- **以便** 了解当前状态

**验收标准：**
1. ✅ 使用 Ora 显示加载动画
2. ✅ 使用 cli-table3 显示结果表格
3. ✅ 使用 Chalk 颜色标识成功/失败
4. ✅ 显示详细的错误信息和建议

---

### Epic 3: Clash 配置管理

**Epic 目标：** 实现 Clash 配置文件的智能更新和备份

#### Story 3.1: 配置文件解析和更新
- **作为** Clash AutoSub 用户
- **我想要** 系统能够准确更新 Clash 配置
- **以便** 使用最新的订阅地址

**验收标准：**
1. ✅ 解析 YAML 格式的 Clash 配置
2. ✅ 定位 proxy-providers 部分
3. ✅ 更新对应站点的 url 字段
4. ✅ 保留其他配置不变
5. ✅ 支持多站点配置（参考 test_config.yaml）

#### Story 3.2: 智能部分更新
- **作为** Clash AutoSub 用户
- **我想要** 只更新成功的站点
- **以便** 避免部分失败导致全部回滚

**验收标准：**
1. ✅ 成功的站点：更新订阅地址
2. ✅ 失败的站点：保留原配置
3. ✅ 显示详细的成功/失败统计
4. ✅ 提供失败原因和修复建议

#### Story 3.3: 自动备份和回滚
- **作为** Clash AutoSub 用户
- **我想要** 系统自动备份配置
- **以便** 出错时能够快速恢复

**验收标准：**
1. ✅ 更新前自动备份（带时间戳）
2. ✅ 保留最近 5 个备份文件
3. ✅ 提供一键回滚命令
4. ✅ 显示备份文件路径

---

### Epic 4: 定时任务和维护

**Epic 目标：** 实现定时自动更新和工具维护功能

#### Story 4.1: Cron 定时任务
- **作为** Clash AutoSub 用户
- **我想要** 设置定时自动更新
- **以便** 无需手动操作

**验收标准：**
1. ✅ 自动配置系统 Cron 任务
2. ✅ 支持自定义更新频率
3. ✅ 默认配置：每天 8:00
4. ✅ 提供日志查看功能
5. ✅ 支持删除定时任务

#### Story 4.2: 状态查看
- **作为** Clash AutoSub 用户
- **我想要** 查看所有站点的状态
- **以便** 了解订阅情况

**验收标准：**
1. ✅ 显示所有站点列表
2. ✅ 显示最后更新时间
3. ✅ 显示订阅地址有效性
4. ✅ 显示 Cookie 过期提醒
5. ✅ 显示定时任务状态

#### Story 4.3: 自动升级
- **作为** Clash AutoSub 用户
- **我想要** 系统能够自动升级
- **以便** 获取最新功能

**验收标准：**
1. ✅ 检查 GitHub Releases 最新版本
2. ✅ 下载并替换本地脚本
3. ✅ 保留用户配置文件
4. ✅ 显示升级日志

---

## 附录

### A. 技术选型对比

| 对比项 | Playwright 方案 | Chrome DevTools MCP 方案 ✅ |
|-------|----------------|---------------------------|
| **安装体积** | ~250MB | ~50MB |
| **启动速度** | 较慢 | 快速 |
| **稳定性** | 成熟 | Google 官方 |
| **调试能力** | 强 | 更强（DevTools）|
| **网络监听** | 需要额外配置 | 内置 |
| **MCP 生态** | 无 | 原生支持 |

### B. 配置文件示例

完整配置示例请参考：`yaml/test_config.yaml`

### C. 命令速查表

| 命令 | 功能 |
|------|------|
| `npx autosub` | 打开交互式菜单 |
| `autosub setup` | 配置订阅站点 |
| `autosub update` | 手动更新订阅 |
| `autosub cron` | 配置定时任务 |
| `autosub status` | 查看状态 |

---

## 技术架构更新说明

**重要变更（2025-10-03）：** 项目已从 Chrome DevTools MCP 方案迁移到 Puppeteer 方案，实现完全自动化。

### 迁移原因
1. **更好的控制力**：Puppeteer 提供更直接的浏览器控制能力
2. **简化部署**：无需额外的 MCP Server 进程
3. **更好的稳定性**：减少中间层，降低故障点
4. **AI 增强**：集成 AI 视觉分析和响应验证

### 主要变更
- **浏览器控制**：从 MCP Client → Puppeteer-core
- **登录检测**：增加 AI 视觉分析能力（DeepSeek Vision）
- **订阅验证**：增加 AI 响应内容分析
- **凭证管理**：增强 Cookie 过期检测和自动刷新
- **状态检测**：支持 localStorage/sessionStorage 作为有效登录凭证

---

**文档版本历史：**
- v1.1 (2025-10-03): 更新架构说明，反映 Puppeteer 迁移
- v1.0 (2025-10-02): 初始版本，采用 Chrome DevTools MCP 方案
