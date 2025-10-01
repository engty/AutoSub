# AutoSub Product Requirements Document (PRD)

**版本：** 1.0
**创建日期：** 2025-01-15
**最后更新：** 2025-01-15
**产品经理：** John (PM)
**项目状态：** PRD 完成

---

## Goals and Background Context（目标与背景）

### Goals（目标）

- 消除 VPN 订阅地址手动更新的重复劳动，实现一键或定时自动化更新
- 确保订阅地址验证机制可靠，避免更新后立即失败的情况
- 支持多 VPN 账户智能管理，实现部分更新机制（成功的更新，失败的保留）
- 提供向导式配置流程，降低用户首次配置的技术门槛
- 实现本地化数据存储，确保用户凭证和配置文件的隐私安全
- 通过 GitHub 远程脚本维护，应对 VPN 网站页面结构变化

### Background Context（背景上下文）

部分 VPN 代理服务提供商（如糖果云、红杏云等机场）为了安全性和负载均衡，采用了动态订阅地址机制，订阅 URL 每 5 分钟自动更新一次。这导致使用 ClashX 等代理工具的用户需要频繁手动登录网站、复制订阅地址并更新配置文件，严重干扰工作流程。

现有解决方案存在明显不足：ClashX 内置更新不支持动态订阅和自动登录，手动脚本在页面变化时维护困难，第三方工具存在隐私泄露风险（用户凭证上传云端）。AutoSub 通过 Python + Playwright 自动化引擎，结合双登录策略（密码登录 + Cookie 会话）和智能部分更新机制，提供了一个安全、可靠、易维护的解决方案。

### Change Log（变更日志）

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-15 | 1.0 | PRD 初始版本 | John (PM) |

---

## Requirements（需求）

### Functional Requirements（功能需求）

**核心业务功能：**

1. **FR1**: 系统应提供交互式配置向导（`autosub setup`），引导用户完成 VPN 账户配置，包括：站点 URL、登录凭证（用户名/密码或 Cookie）、订阅地址定位验证
2. **FR2**: 系统应支持自动登录 VPN 网站并抓取订阅地址，支持两种登录策略：策略 A（用户名密码登录）和策略 B（Cookie 会话登录）
3. **FR3**: 系统应验证订阅地址有效性，通过 HTTP 请求检查：状态码 200、内容格式包含 Clash YAML 关键字（proxies/proxy-groups）、节点数量 > 0
4. **FR4**: 系统应实现智能部分更新机制：成功获取的订阅地址更新到 Clash 配置文件，失败的账户保留原配置不变，更新前自动备份原文件
5. **FR5**: 系统应支持手动更新命令（`autosub update`），一键执行所有配置账户的订阅地址更新，显示实时进度和结果摘要
6. **FR6**: 系统应支持定时更新功能（`autosub cron`），自动配置系统 Cron 任务，支持自定义更新频率（默认每天 1 次，早 8:00），提供日志查看和任务移除功能
7. **FR7**: 系统应支持 ClashX 配置文件路径设置（`autosub config`），自动检测常见路径（macOS/Linux/Windows+WSL），支持手动指定路径，验证文件存在性和写权限

**可维护性功能：**

8. **FR8**: 系统启动时应自动检查 GitHub 远程选择器配置文件（sites.json）版本，发现新版本时自动下载并应用，本地缓存有效期 24 小时
9. **FR9**: 系统应使用多重选择器策略（优先级数组），单个选择器失败时自动尝试下一个备选选择器，支持文本匹配、CSS 类、元素 ID、数据属性等多种定位方式
10. **FR10**: 系统应提供诊断模式（`autosub diagnose <site>`），打开可视化浏览器，暂停在关键步骤，扫描并显示所有可能的订阅按钮候选，辅助用户生成新选择器

**用户体验功能：**

11. **FR11**: 系统应提供 Cookie 刷新命令（`autosub refresh-cookie <账户名>`），打开浏览器让用户手动登录，自动捕获并保存 Cookie，显示 Cookie 有效期预估
12. **FR12**: 系统应提供状态查看命令（`autosub status`），显示所有配置账户的当前状态（最后更新时间、订阅地址有效性、Cookie 过期提醒）
13. **FR13**: 系统应提供自动升级命令（`autosub upgrade`），检查 GitHub Releases 最新版本，下载并替换本地脚本，保留用户配置文件不变

**安全与隐私：**

14. **FR14**: 系统应将用户凭证加密存储在本地（`~/.autosub/config.yaml`），密码使用 Fernet 对称加密，Cookie 文件权限设置为 600（仅所有者可读写）
15. **FR15**: 系统不应上传任何用户数据到云端，所有配置文件、Cookie、日志仅保存在用户本地

### Non-Functional Requirements（非功能需求）

16. **NFR1**: 单个账户订阅地址更新操作应在 30 秒内完成（正常网络条件下）
17. **NFR2**: 系统应支持 macOS 10.15+、Linux（Ubuntu 20.04+）、Windows 10/11（通过 WSL 2）
18. **NFR3**: 系统依赖应控制在最小范围：Python 3.9+、Playwright、PyYAML、httpx、cryptography，总安装体积 < 300 MB
19. **NFR4**: 配置文件损坏率应为零，通过自动备份和原子写入保证
20. **NFR5**: 系统应提供详细的错误日志（`~/.autosub/logs/autosub.log`），包括时间戳、错误类型、堆栈跟踪，日志文件自动轮转（保留最近 7 天）
21. **NFR6**: 选择器失效时应显示友好错误信息，包括：失败原因、建议解决方案（运行 diagnose 或等待远程配置更新）、Issue 提交链接
22. **NFR7**: 系统应支持 Headless 模式运行（服务器环境），Cookie 登录策略需要图形界面时自动切换到用户本地浏览器
23. **NFR8**: 代码应遵循 PEP 8 规范，模块化设计，核心逻辑单元测试覆盖率 > 50%
24. **NFR9**: 核心依赖安装时间应 < 20 秒，总体积 < 25MB
25. **NFR10**: 按需依赖安装前必须显示清晰提示（功能名称、体积、耗时）并征得用户同意

---

## User Interface Design Goals（用户界面设计目标）

### Overall UX Vision（整体用户体验愿景）

AutoSub 采用 **向导式 CLI 交互设计**，通过清晰的问答流程引导用户完成配置，避免手动编辑配置文件。核心设计理念：
- **进度可见性：** 每个操作都显示实时进度（进度条、步骤提示）
- **错误友好性：** 失败时提供明确的错误原因和修复建议，而非技术堆栈
- **智能默认值：** 自动检测常见配置（Clash 路径、系统环境），减少用户输入
- **颜色编码：** 成功（绿色）、警告（黄色）、错误（红色）、信息（蓝色）

### Key Interaction Paradigms（核心交互范式）

1. **向导式配置流程（Wizard）：**
   - 使用 `questionary` 库提供交互式选择菜单
   - 支持箭头键选择、回车确认
   - 每步显示当前进度（如：步骤 2/4）

2. **命令行参数与交互结合：**
   - 支持静默模式：`autosub update --silent`（适用于 Cron）
   - 支持快速模式：`autosub setup --site candytally --auth password`
   - 默认交互模式：显示详细提示和帮助信息

3. **实时反馈机制：**
   - 使用 `rich` 库提供进度条和表格输出
   - 异步操作显示 Spinner 动画
   - 操作完成后显示结果摘要表格

### Core Screens and Views（核心界面视图）

#### **1. 配置向导（Setup Wizard）**
```
🚀 AutoSub 配置向导

步骤 1/4: 选择 VPN 站点
? 请选择要配置的站点：
  ❯ 糖果云 (candytally.xyz)
    红杏云 (hongxingyun.com)
    自定义站点

步骤 2/4: 选择登录方式
? 该站点有验证码吗？
  ❯ 无验证码或简单验证码 → 使用用户名密码登录
    有复杂验证码 → 使用 Cookie 会话登录

[根据选择显示不同的输入表单...]
```

#### **2. 更新操作（Update Command）**
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
  - 备份文件: config.yaml.backup.20250115_143022

💡 提示: 红杏云更新失败，可能是 Cookie 过期，运行: autosub refresh-cookie 红杏云
```

#### **3. 状态查看（Status Command）**
```
📋 AutoSub 状态概览

┌────────────────────────────────────────────────────────────────┐
│ 账户    最后更新           订阅地址状态   Cookie 状态         │
├────────────────────────────────────────────────────────────────┤
│ 糖果云  2025-01-15 14:30   ✅ 有效        🔑 7 天后过期      │
│ 红杏云  2025-01-14 08:00   ⚠️  未验证     🔑 已过期          │
└────────────────────────────────────────────────────────────────┘

⏰ 定时任务: 已启用 (每天 8:00)
📁 Clash 配置: /Users/xxx/.config/clash/config.yaml
```

#### **4. 诊断模式（Diagnose Command）**
```
🔍 诊断模式: 糖果云

[打开浏览器窗口，显示可视化调试信息]

✋ 已暂停在订阅页面，正在扫描可能的按钮...

找到以下候选元素:
[1] <button class="btn-primary">一键订阅</button>
    建议选择器: button.btn-primary, button:has-text('一键订阅')

[2] <a href="/user/subscription">查看订阅</a>
    建议选择器: a[href*='subscription']

? 请在浏览器中点击正确的订阅按钮，或输入编号 [1-2]:
```

### Accessibility（无障碍性）
- **级别：** None（命令行工具，不涉及 WCAG 标准）
- **考虑因素：**
  - 使用纯文本输出，兼容屏幕阅读器
  - 颜色编码同时提供符号标识（✅ ❌ ⚠️）
  - 支持 `--no-color` 参数禁用颜色输出

### Branding（品牌风格）
- **视觉风格：** 极简技术风格，黑底彩色文本（终端默认）
- **色彩方案：**
  - 主色调：青色（Cyan）用于品牌标识
  - 功能色：绿（成功）、红（错误）、黄（警告）、蓝（信息）
- **图标使用：** Emoji 表情符号（🚀 🔄 ✅ ❌ 💡 等）提升可读性

### Target Device and Platforms（目标设备与平台）
- **平台类型：** 命令行终端（Terminal/Console）
- **支持环境：**
  - macOS Terminal、iTerm2
  - Linux GNOME Terminal、Konsole、Alacritty
  - Windows WSL 2 + Windows Terminal
  - 远程 SSH 终端（支持 Headless 模式）

---

## Technical Assumptions（技术假设）

### Repository Structure（仓库结构）
**决策：Monorepo（单仓库）**

**理由：**
- 个人项目，单一可执行脚本
- 所有代码、配置、文档集中管理
- 简化部署和版本发布

### Service Architecture（服务架构）
**决策：Monolith（单体应用）- CLI 可执行脚本**

**架构说明：**
```
autosub.py (主入口)
    ├── CLI 命令解析层 (click)
    ├── 核心业务逻辑层
    │   ├── 登录模块 (auth.py) - 密码/Cookie 双策略
    │   ├── 抓取模块 (scraper.py) - 订阅链接定位与提取 ⭐核心
    │   ├── 验证模块 (validator.py) - 订阅链接有效性验证
    │   └── 更新模块 (updater.py) - Clash 配置更新
    ├── 配置管理层 (config.py)
    └── 工具层 (utils.py)
```

**核心技术栈：**

**1. 自动化引擎（⭐ 核心组件）：**
- **Playwright (Python)** - 浏览器自动化
  - 版本：`playwright>=1.40.0`
  - 用途：自动登录、页面元素定位、订阅链接抓取
  - 关键特性：多重选择器、自动等待、Cookie 管理

**2. 配置管理：**
- **PyYAML** - Clash 配置文件读写
- **cryptography** - 用户凭证加密存储（Fernet 对称加密）

**3. HTTP 客户端：**
- **httpx** - 订阅链接有效性验证
  - 支持 HTTP/2
  - 异步请求（可选优化）

**4. CLI 框架：**
- **click** - 命令行参数解析
- **questionary** - 交互式问答界面
- **rich** - 终端美化（表格、进度条、颜色）

**5. 远程配置：**
- **requests** - GitHub API 调用和配置下载

**完整依赖清单（requirements.txt）：**
```txt
# 核心依赖（首次安装）
click>=8.1.0
PyYAML>=6.0
requests>=2.31.0

# 自动化引擎（首次 setup/update 时安装）
playwright>=1.40.0
httpx>=0.25.0

# 交互界面（首次 setup 时安装）
questionary>=2.0.0
rich>=13.0.0

# 安全加密（密码登录时安装）
cryptography>=41.0.0
```

### Testing Requirements（测试要求）

**测试策略：重点测试核心使命 - 订阅链接获取**

**测试覆盖范围：**
1. **核心逻辑单元测试（50% 覆盖率）：**
   - ⭐ **高优先级：**
     - 选择器匹配逻辑（fallback 机制）
     - 订阅链接验证逻辑（HTTP + 格式检查）
     - 多账户部分更新逻辑
   - **中优先级：**
     - 配置文件读写
     - 加密/解密功能
   - **低优先级（手动测试）：**
     - Playwright 登录流程（依赖真实网站）
     - Cookie 捕获流程

2. **集成测试（手动）：**
   - 真实 VPN 站点登录测试（糖果云、红杏云）
   - 端到端流程验证（setup → update → verify）

3. **测试工具：**
   - **pytest** - 单元测试框架
   - **pytest-mock** - Mock 外部依赖（HTTP 请求、文件 I/O）
   - **pytest-asyncio** - 异步测试（如需要）

**测试原则：**
- 专注测试"订阅链接获取"的可靠性
- Mock 外部依赖，避免依赖真实 VPN 网站
- 手动测试覆盖 Playwright 自动化流程

### Additional Technical Assumptions and Requests（其他技术假设）

#### **部署与分发：**
- **项目分发：** 仅分发源代码（~50KB），不包含依赖包
- **依赖安装：** 通过 `install.sh` 自动从 PyPI 下载并安装到用户本地
- **安装位置：**
  - 源代码：`~/.autosub/source/`
  - Python 虚拟环境：`~/.autosub/venv/`
  - 全局命令：`/usr/local/bin/autosub`（软链接）

**一键安装命令：**
```bash
curl -fsSL https://raw.githubusercontent.com/xxx/AutoSub/main/install.sh | bash
```

**一键卸载命令：**
```bash
curl -fsSL https://raw.githubusercontent.com/xxx/AutoSub/main/uninstall.sh | bash
```

**优势：**
- ✅ 项目仓库极轻量（~50KB），克隆速度快
- ✅ 依赖自动从 PyPI 官方源下载，确保最新版本
- ✅ 支持国内镜像源，提升下载速度
- ✅ 用户侧依赖隔离（虚拟环境），不污染系统 Python

#### **版本管理：**
- **Git 工作流：** GitHub Flow（main 分支 + feature 分支）
- **版本号规范：** 语义化版本（SemVer）- `v1.0.0`
- **发布流程：** GitHub Releases + 自动生成 Changelog

#### **远程配置更新机制：**
- **选择器配置仓库：** GitHub `AutoSub/selectors`
- **配置文件结构：**
  ```
  selectors/
  ├── version.json              # 版本信息
  └── sites.json                # 所有站点配置
  ```
- **更新策略：**
  - 本地缓存 24 小时
  - 启动时检查版本，自动下载新配置
  - 支持手动强制刷新：`autosub update-selectors`

#### **安全与隐私：**
- **凭证加密：** Fernet 对称加密，密钥存储在 `~/.autosub/.key`
- **Cookie 权限：** 文件权限 600（仅所有者可读写）
- **日志脱敏：** 密码、Cookie、订阅 URL 自动脱敏（显示前 4 位 + ***）
- **HTTPS 强制：** 所有 HTTP 请求强制使用 HTTPS

#### **错误处理与日志：**
- **日志级别：** DEBUG、INFO、WARNING、ERROR
- **日志文件：** `~/.autosub/logs/autosub.log`（按日期轮转，保留 7 天）
- **错误上报：** 提供 `autosub report-issue` 命令，自动生成 GitHub Issue 模板（包含脱敏日志）

#### **跨平台兼容性：**
- **路径处理：** 使用 `pathlib.Path`，自动适配不同操作系统
- **Cron 配置：**
  - macOS/Linux：直接写入 crontab
  - Windows（WSL）：写入 WSL 的 crontab
- **浏览器选择：** Playwright 默认使用 Chromium（跨平台一致性）

#### **性能优化：**
- **并发更新：** 多账户并行抓取（使用 `asyncio` + `playwright-async`）
- **超时控制：** 单个站点最大超时 60 秒
- **缓存机制：** 选择器配置本地缓存，减少网络请求

---

## Epic List（史诗列表）

### **Epic 1: 基础设施与核心抓取引擎**
**目标：** 建立项目基础架构，实现核心使命——可靠获取订阅链接的自动化引擎

### **Epic 2: 配置管理与用户体验**
**目标：** 提供向导式配置流程和 Clash 配置更新，让用户能够轻松使用自动化功能

### **Epic 3: 可维护性与远程更新机制**
**目标：** 实现 GitHub 远程选择器配置和诊断工具，应对 VPN 网站页面变化

### **Epic 4: 定时任务与自动升级**
**目标：** 完善自动化体验，实现定时更新和脚本自动升级功能

---

## Epic 1: 基础设施与核心抓取引擎

**Epic 目标：** 建立 AutoSub 的技术基础架构（项目结构、依赖管理、一键安装），并实现核心使命——通过 Playwright 自动登录 VPN 网站并准确抓取订阅链接。这是整个项目的基石，确保后续所有功能都建立在可靠的抓取能力之上。

---

### **Story 1.1: 项目初始化与一键安装脚本**

**As a** 开发者，
**I want** 建立项目基础结构和一键安装脚本，
**so that** 用户可以快速部署 AutoSub 环境，自动安装所有依赖到本地。

#### **Acceptance Criteria:**

1. 项目仓库包含标准目录结构：`autosub.py`（主入口）、`src/`（源代码）、`requirements.txt`（依赖清单）、`install.sh`（安装脚本）、`selectors/`（选择器配置）
2. `install.sh` 脚本自动检查 Python 3.9+ 环境，未安装时显示友好提示
3. 安装脚本自动创建 Python 虚拟环境（`~/.autosub/venv/`），隔离依赖
4. 分层依赖安装：仅安装核心依赖（click、PyYAML、requests），总体积 < 25MB
5. 快速初装：核心依赖安装时间 < 20 秒（正常网络）
6. 创建全局命令软链接 `/usr/local/bin/autosub`，用户可直接执行 `autosub` 命令
7. 初始化配置目录 `~/.autosub/{logs,cookies,backups}`，设置正确的文件权限
8. 安装成功后显示快速开始提示（`autosub --help`、`autosub setup`）
9. 支持国内镜像源参数：`bash install.sh --mirror tuna`（使用清华源）
10. 项目仓库总体积 < 100KB（不含依赖包）
11. 延迟安装提示：安装完成后显示提示："部分功能首次使用时会安装额外依赖"
12. 离线可用性：安装核心依赖后，`autosub --help`、`autosub --version` 等基础命令立即可用

---

### **Story 1.2: 双登录策略实现（密码 + Cookie）**

**As a** 用户，
**I want** 系统支持两种登录方式（用户名密码 / Cookie 会话），
**so that** 我可以根据 VPN 网站特性选择最合适的登录策略。

#### **Acceptance Criteria:**

1. **策略 A - 密码登录：** Playwright 自动填写用户名和密码表单，提交登录
2. **策略 A：** 支持自动等待登录成功（检测 URL 变化或特定元素出现）
3. **策略 A：** 密码使用 Fernet 对称加密存储在 `~/.autosub/config.yaml`，密钥存储在 `~/.autosub/.key`
4. **策略 B - Cookie 登录：** 调用系统默认浏览器打开 VPN 登录页面（非 headless 模式）
5. **策略 B：** 用户手动完成登录后，脚本自动检测登录成功（监听 URL 包含 'dashboard' 或 'user'）
6. **策略 B：** 自动提取浏览器 Cookie，保存到 `~/.autosub/cookies/{账户名}.json`
7. **策略 B：** Cookie 文件权限自动设置为 600（仅所有者可读写）
8. **策略 B：** 后续登录直接加载 Cookie，跳过登录表单
9. 登录失败时显示清晰错误信息（如：密码错误、Cookie 过期、网络超时）
10. 支持登录超时设置（默认 60 秒），超时后自动重试一次

---

### **Story 1.3: 订阅链接抓取与多重选择器**

**As a** 系统，
**I want** 使用多重选择器策略准确定位并提取订阅链接，
**so that** 即使页面元素 ID 或 CSS 类改变，仍能成功获取订阅地址。

#### **Acceptance Criteria:**

1. 从本地 `selectors/{站点名}.json` 加载选择器配置（优先级数组）
2. 按优先级顺序尝试每个选择器：文本匹配（`button:has-text('订阅')`）、CSS 类、元素 ID、数据属性
3. 单个选择器失败时自动尝试下一个备选选择器，无需人工干预
4. 支持 Playwright 的 `wait_for_selector` 自动等待元素出现（最多 10 秒）
5. 成功定位订阅按钮后，自动点击或提取 `href` 属性
6. 提取订阅 URL 后进行格式验证（必须以 `https://` 开头，包含 `token=` 或订阅特征）
7. 记录详细日志：尝试了哪些选择器、哪个选择器成功、提取到的 URL（脱敏显示前 20 字符）
8. 所有选择器失败时，抛出清晰错误并建议运行 `autosub diagnose`
9. 支持自定义选择器：用户可临时指定选择器 `autosub update --selector "button.custom-class"`
10. 单个账户抓取操作在 30 秒内完成（正常网络条件）

---

### **Story 1.4: 订阅地址验证机制**

**As a** 系统，
**I want** 验证抓取到的订阅地址真实有效，
**so that** 避免将无效地址更新到 Clash 配置导致连接失败。

#### **Acceptance Criteria:**

1. 使用 `httpx` 向订阅地址发送 GET 请求，设置超时 10 秒
2. 检查 HTTP 状态码必须为 200（成功）
3. 检查响应内容长度 > 100 字节（排除空响应）
4. 检查内容格式包含 Clash YAML 关键字：`proxies` 或 `proxy-groups`（大小写不敏感）
5. 可选检查：解析 YAML 统计节点数量，必须 > 0
6. 验证失败时记录详细原因（状态码、内容长度、缺失关键字）
7. 验证通过时在日志中记录：`✅ 订阅地址验证通过 - 检测到 X 个节点`
8. 支持跳过验证选项：`autosub update --no-verify`（高级用户）
9. 验证失败的订阅地址不会写入 Clash 配置
10. 多账户并行验证，提升性能

---

### **Story 1.5: 基础 CLI 命令框架**

**As a** 用户，
**I want** 通过命令行执行基本操作，
**so that** 我可以测试核心抓取功能是否正常工作。

#### **Acceptance Criteria:**

1. 使用 `click` 框架实现命令行接口，支持子命令结构
2. `autosub --version`：显示当前版本号（如 `v1.0.0`）
3. `autosub --help`：显示所有可用命令和简要说明
4. `autosub login <账户名>`：手动执行登录测试（输出登录状态）
5. `autosub fetch <账户名>`：手动抓取订阅链接并验证（输出订阅 URL）
6. 所有命令支持 `--verbose` 参数，显示详细调试日志
7. 所有命令支持 `--silent` 参数，仅输出结果不显示过程
8. 错误时返回非零退出码（便于脚本判断）
9. 使用 `rich` 库美化输出：表格、进度条、颜色编码
10. 命令执行日志自动写入 `~/.autosub/logs/autosub.log`

---

## Epic 2: 配置管理与用户体验

**Epic 目标：** 构建用户友好的配置向导（setup 命令），引导用户完成 VPN 账户配置和 Clash 路径设置。实现智能部分更新机制，将成功获取的订阅地址更新到 Clash 配置文件，失败的保留原配置。完成端到端的自动化流程。

---

### **Story 2.1: 向导式 VPN 账户配置**

**As a** 用户，
**I want** 通过交互式向导完成 VPN 账户配置，
**so that** 我无需手动编辑配置文件，降低使用门槛。

#### **Acceptance Criteria:**

1. `autosub setup` 启动配置向导，显示欢迎信息和步骤总览（共 4 步）
2. **步骤 1：** 选择 VPN 站点（提供预设列表：糖果云、红杏云、自定义站点）
3. **步骤 1：** 选择"自定义站点"时，提示输入站点 URL 和站点名称
4. **步骤 2：** 询问"该站点有验证码吗？"（选项：无验证码 → 密码登录 / 有复杂验证码 → Cookie 登录）
5. **步骤 3a（密码登录）：** 提示输入用户名和密码，密码输入时使用 `*` 遮罩显示
6. **步骤 3b（Cookie 登录）：** 显示提示"即将打开浏览器，请手动登录"，打开浏览器等待用户登录
7. **步骤 4：** 自动测试登录并抓取订阅链接，显示实时进度（"正在登录..." → "正在抓取..." → "正在验证..."）
8. **步骤 4：** 测试成功后显示订阅 URL（脱敏），询问"是否保存此配置？"
9. 配置保存到 `~/.autosub/config.yaml`，格式规范（YAML 标准格式）
10. 支持添加多个账户：配置完成后询问"是否继续添加其他账户？"
11. 向导支持 Ctrl+C 随时退出，退出前询问"是否保存已配置的账户？"
12. 使用 `questionary` 提供箭头键选择、回车确认的交互体验
13. **依赖检查机制：** `autosub setup` 启动前检查是否已安装 playwright、questionary、rich
14. **自动安装提示：** 缺失依赖时显示清晰提示（功能名称、体积、耗时、用途说明）
15. **用户确认：** 询问用户是否继续安装（默认 Y），支持 Ctrl+C 取消
16. **进度显示：** 使用进度条显示安装进度（如果 rich 已安装）或百分比文本（如果未安装）
17. **安装记录：** 依赖安装成功后在 `~/.autosub/installed.txt` 记录，避免重复检查
18. **跳过提示选项：** 支持 `autosub setup --auto-install` 跳过确认，自动安装所有依赖

---

### **Story 2.2: Clash 配置文件路径设置**

**As a** 用户，
**I want** 系统自动检测或让我指定 Clash 配置文件路径，
**so that** 订阅地址可以正确更新到我的 Clash 配置。

#### **Acceptance Criteria:**

1. `autosub config` 启动配置文件路径设置向导
2. 自动检测常见 Clash 配置路径：
   - macOS：`~/.config/clash/config.yaml`、`~/Library/Application Support/clash/config.yaml`
   - Linux：`~/.config/clash/config.yaml`、`/etc/clash/config.yaml`
   - Windows（WSL）：`/mnt/c/Users/{用户}/.config/clash/config.yaml`
3. 显示检测到的路径列表，让用户选择（选项包括："使用 {检测路径}" 或 "手动输入路径"）
4. 验证选择的路径：文件存在性、可读权限、可写权限
5. 验证文件格式：尝试解析为 YAML，检查是否包含 `proxy-providers` 节点
6. 验证失败时显示具体原因（文件不存在 / 权限不足 / 格式错误 / 缺少 proxy-providers）
7. 路径保存到 `~/.autosub/config.yaml` 的 `clash_config.file_path` 字段
8. 支持相对路径自动转换为绝对路径
9. 首次运行 `autosub update` 时，如果未配置路径，自动触发此向导
10. 提供 `autosub config --clash-path /path/to/config.yaml` 快捷命令直接设置

---

### **Story 2.3: 智能部分更新机制**

**As a** 系统，
**I want** 实现智能部分更新逻辑，
**so that** 成功获取的订阅地址更新到配置，失败的保留原配置，确保零损坏风险。

#### **Acceptance Criteria:**

1. `autosub update` 命令触发更新流程，显示所有配置账户列表
2. 自动备份当前 Clash 配置文件到 `~/.autosub/backups/config.yaml.backup.{时间戳}`
3. 并行处理多个账户（使用 asyncio），提升更新速度
4. 每个账户独立执行：登录 → 抓取 → 验证，记录结果（成功/失败 + 原因）
5. 读取当前 Clash 配置文件，解析 `proxy-providers` 节点
6. **仅更新成功的账户：** 将新订阅 URL 写入对应的 `proxy-providers[账户名].url` 字段
7. **保留失败的账户：** 该账户的 `url` 字段保持不变
8. 使用原子写入：先写入临时文件 → 验证 YAML 格式 → 重命名替换原文件
9. 更新完成后显示结果摘要表格：账户名 | 状态 | 耗时 | 结果
10. 结果摘要包含统计信息：成功 X/Y、失败 X/Y、配置已更新、备份文件路径
11. 失败账户显示友好提示（如：Cookie 过期 → 运行 `autosub refresh-cookie 账户名`）
12. 更新失败时可通过 `autosub rollback` 一键恢复备份

---

### **Story 2.4: 配置文件加密与安全**

**As a** 系统，
**I want** 加密存储用户凭证，
**so that** 保护用户隐私，避免密码明文泄露。

#### **Acceptance Criteria:**

1. 首次运行时自动生成 Fernet 加密密钥，保存到 `~/.autosub/.key`
2. 密钥文件权限自动设置为 600（仅所有者可读写）
3. 密码在保存前自动加密，格式：`encrypted:{密文}`
4. Cookie 文件（`~/.autosub/cookies/{账户名}.json`）权限自动设置为 600
5. 日志文件中密码、Cookie、订阅 URL 自动脱敏（显示前 4 位 + `***`）
6. 配置文件示例：
   ```yaml
   version: "1.0"
   clash_config:
     file_path: "/Users/xxx/.config/clash/config.yaml"
   vpn_accounts:
     - name: "糖果云"
       website: "https://candytally.xyz"
       auth_method: "password"
       username: "user@example.com"
       password: "encrypted:gAAAAABl..."  # 加密后的密码
   ```
7. 读取配置时自动解密密码
8. 密钥文件丢失时，提示重新配置所有账户（无法恢复加密内容）
9. 提供 `autosub encrypt-check` 命令验证加密功能正常
10. 不上传任何数据到网络，所有文件仅本地存储
11. **延迟加载加密库：** 用户选择"密码登录"策略时，检查 cryptography 是否已安装
12. **Cookie 登录无需加密：** 选择"Cookie 登录"策略时，不安装 cryptography（节省 ~2MB）
13. **安装提示：** 显示"正在安装密码加密组件..."，预计耗时 5-10 秒
14. **降级方案：** 如果 cryptography 安装失败，提示用户使用 Cookie 登录策略（不影响核心功能）

---

### **Story 2.5: 更新命令与结果展示**

**As a** 用户，
**I want** 执行 `autosub update` 一键更新所有订阅，并看到清晰的结果报告，
**so that** 我知道更新是否成功，哪些账户需要处理。

#### **Acceptance Criteria:**

1. `autosub update` 执行完整更新流程，显示实时进度
2. 使用 `rich` 库的进度条显示总体进度：`[▓▓▓░░░] 2/5 账户更新中...`
3. 每个账户显示独立状态：账户名 | 状态（进行中/成功/失败）| 耗时
4. 更新完成后显示结果摘要表格：
   ```
   ┌─────────────────────────────────────────────┐
   │ 账户      状态      耗时    结果            │
   ├─────────────────────────────────────────────┤
   │ 糖果云    ✅ 成功   12s     已更新          │
   │ 红杏云    ❌ 失败   8s      Cookie 过期     │
   └─────────────────────────────────────────────┘
   ```
5. 显示统计信息：成功 1/2、失败 1/2、Clash 配置已更新、备份文件路径
6. 失败账户显示具体错误原因和修复建议（如：`💡 提示: 运行 autosub refresh-cookie 红杏云`）
7. 支持 `--silent` 模式：仅输出结果，不显示进度（适用于 Cron 任务）
8. 支持 `--account <账户名>` 参数：仅更新指定账户
9. 支持 `--dry-run` 参数：模拟更新流程，不实际修改配置文件
10. 命令执行日志详细记录到 `~/.autosub/logs/autosub.log`，包含时间戳和每个步骤

---

### **Story 2.6: 配置查看与管理**

**As a** 用户，
**I want** 查看和管理已配置的账户，
**so that** 我可以删除、编辑或查看账户状态。

#### **Acceptance Criteria:**

1. `autosub list` 显示所有已配置账户列表：账户名 | 站点 | 登录方式（密码/Cookie）
2. `autosub show <账户名>` 显示账户详细信息（用户名、站点、最后更新时间、订阅 URL 脱敏）
3. `autosub remove <账户名>` 删除指定账户配置，删除前需要确认（`Are you sure? [y/N]`）
4. `autosub edit <账户名>` 重新运行配置向导，更新账户信息
5. 删除账户时同步删除对应的 Cookie 文件（`~/.autosub/cookies/{账户名}.json`）
6. `autosub list` 支持 `--format json` 输出 JSON 格式（便于脚本解析）
7. 提供 `autosub validate` 命令，验证所有账户配置有效性（登录测试 + 抓取测试）
8. 验证结果显示每个账户的健康状态：✅ 正常 / ⚠️ Cookie 即将过期 / ❌ 配置错误
9. 支持导出配置：`autosub export > backup.yaml`（密码保持加密状态）
10. 支持导入配置：`autosub import backup.yaml`（验证格式后导入）

---

## Epic 3: 可维护性与远程更新机制

**Epic 目标：** 实现 GitHub 远程选择器配置自动拉取机制，确保 VPN 网站页面变化时能快速修复。提供诊断模式（diagnose 命令），辅助用户和维护者快速定位问题并生成新选择器。专注 Playwright，零额外依赖，高可用度优先。

---

### **Story 3.1: GitHub 远程选择器配置系统**

**As a** 系统，
**I want** 启动时自动从 GitHub 拉取最新的选择器配置文件，
**so that** VPN 网站页面变化时，用户无需手动更新代码即可获得修复。

#### **Acceptance Criteria:**

1. GitHub 仓库存储选择器配置文件结构：
   ```
   selectors/
   ├── version.json              # {"version": "1.2.0", "updated": "2025-01-15"}
   └── sites.json                # 所有站点配置（单文件，简化管理）
   ```

2. `sites.json` 包含所有站点的多重选择器：
   ```json
   {
     "candytally": {
       "name": "糖果云",
       "url": "https://candytally.xyz",
       "selectors": {
         "login_username": ["#username", "input[name='username']"],
         "login_password": ["#password", "input[type='password']"],
         "login_button": ["button[type='submit']", ".login-btn"],
         "subscription_button": ["button:has-text('订阅')", ".sub-btn", "a[href*='subscription']"],
         "subscription_url": ["input[readonly][value*='https']", "code", "pre"]
       }
     }
   }
   ```

3. 启动时检查 GitHub Raw URL：`https://raw.githubusercontent.com/xxx/AutoSub/main/selectors/version.json`
4. 对比本地缓存版本（`~/.autosub/selectors-cache.json`），新版本时自动下载 `sites.json`
5. 本地缓存有效期 24 小时，过期后重新检查
6. 网络请求失败时使用本地缓存，记录警告：`⚠️ 无法连接 GitHub，使用本地缓存`
7. 首次安装时内置默认选择器（`src/selectors_default.json`），确保离线可用
8. 下载成功后覆盖缓存：`~/.autosub/selectors-cache.json`
9. 支持手动强制刷新：`autosub update-selectors`
10. 更新成功显示：`✅ 选择器已更新到 v1.2.0 (新增: 红杏云)`

---

### **Story 3.2: 多重选择器 Fallback 机制**

**As a** 系统，
**I want** 按优先级尝试多个选择器，单个失败时自动切换到下一个，
**so that** 页面元素 ID 或 CSS 类改变时仍能成功定位。

#### **Acceptance Criteria:**

1. 从配置文件加载选择器数组，如：`["button:has-text('订阅')", ".sub-btn", "#get-sub"]`
2. 使用 Playwright 的 `page.locator(selector).first` 按顺序尝试每个选择器
3. 每个选择器超时设置为 3 秒，失败后立即尝试下一个
4. 第一个选择器成功时立即返回，不再尝试后续
5. 实现代码示例：
   ```python
   def find_element(page, selector_array, timeout=3000):
       for i, selector in enumerate(selector_array):
           try:
               element = page.wait_for_selector(selector, timeout=timeout)
               logger.info(f"✅ 选择器成功 [{i+1}/{len(selector_array)}]: {selector}")
               return element
           except TimeoutError:
               logger.debug(f"⏭️ 选择器 [{i+1}/{len(selector_array)}] 超时: {selector}")
               continue
       raise Exception(f"❌ 所有选择器失败 ({len(selector_array)} 个)")
   ```

6. 所有选择器失败时抛出清晰错误，建议运行诊断模式
7. 日志记录每次尝试（DEBUG 级别），成功时记录使用的选择器（INFO 级别）
8. 支持 Playwright 原生选择器：CSS、文本匹配（`:has-text()`）、XPath
9. 不引入额外的选择器库，保持代码轻量
10. 选择器数组顺序即优先级，维护者手动优化顺序

---

### **Story 3.3: 诊断模式（可视化调试工具）**

**As a** 用户或维护者，
**I want** 使用诊断模式可视化定位订阅按钮，
**so that** 我可以快速生成新的选择器配置并提交修复。

#### **Acceptance Criteria:**

1. `autosub diagnose <站点名>` 启动诊断模式（例：`autosub diagnose candytally`）
2. 使用 Playwright 打开浏览器窗口（`headless=False`），显示登录页面
3. 提示用户：`请在浏览器中手动登录，完成后回到终端按回车继续...`
4. 等待用户按回车后，检测登录状态（URL 包含 'dashboard' 或 'user'）
5. 自动导航到订阅页面（如果需要）
6. 使用 Playwright 扫描页面所有可能的按钮元素：
   ```python
   candidates = page.query_selector_all('button, a, input[type="button"]')
   for idx, el in enumerate(candidates):
       text = el.inner_text()
       if '订阅' in text or 'subscription' in text.lower():
           print(f"[{idx}] {el.evaluate('el => el.outerHTML')}")
   ```

7. 在终端显示候选列表：
   ```
   🔍 找到以下候选元素:

   [1] <button class="btn-primary">一键订阅</button>
       CSS: button.btn-primary
       文本: button:has-text('一键订阅')

   [2] <a href="/user/subscription" class="link">订阅中心</a>
       CSS: a.link
       文本: a:has-text('订阅中心')

   请输入正确的编号 [1-2] 或在浏览器中点击按钮:
   ```

8. 用户输入编号后，自动生成选择器 JSON：
   ```json
   {
     "subscription_button": [
       "button.btn-primary",
       "button:has-text('一键订阅')"
     ]
   }
   ```

9. 将新选择器保存到 `~/.autosub/diagnose-output.json`
10. 提示用户：
    ```
    ✅ 新选择器已生成！

    📁 已保存到: ~/.autosub/diagnose-output.json

    📤 提交修复步骤:
    1. 访问 https://github.com/xxx/AutoSub/issues/new
    2. 选择 "选择器失效" 模板
    3. 粘贴 diagnose-output.json 内容
    4. 提交 Issue

    💡 或直接运行: autosub report-issue candytally
    ```

11. 诊断过程中保持浏览器窗口打开，便于用户验证
12. 支持 `--auto-close` 参数：完成后自动关闭浏览器

---

### **Story 3.4: 简化版 Issue 提交助手**

**As a** 用户，
**I want** 快速提交选择器失效报告，
**so that** 维护者能及时修复。

#### **Acceptance Criteria:**

1. `autosub report-issue <站点名>` 生成 Issue 内容，输出到终端（不自动提交）
2. Issue 内容模板：
   ```markdown
   ## 选择器失效报告

   **站点：** 糖果云 (candytally.xyz)
   **报告时间：** 2025-01-15 14:30
   **AutoSub 版本：** v1.0.0

   ### 当前选择器（失效）
   ```json
   {
     "subscription_button": ["button:has-text('订阅')"]
   }
   ```

   ### 诊断生成的新选择器
   ```json
   {
     "subscription_button": ["button.btn-primary"]
   }
   ```

   ### 错误日志（脱敏）
   ```
   [2025-01-15 14:30:00] ❌ 选择器超时: button:has-text('订阅')
   [2025-01-15 14:30:03] ❌ 所有选择器失败
   ```

   ### 系统信息
   - OS: macOS 14.0
   - Python: 3.11
   - Playwright: 1.40.0
   ```

3. 自动从诊断输出（`~/.autosub/diagnose-output.json`）读取新选择器
4. 自动从日志文件（`~/.autosub/logs/autosub.log`）提取最近的错误日志
5. 日志自动脱敏：隐藏密码、Cookie、完整订阅 URL
6. 输出到终端后提示：
   ```
   📋 Issue 内容已生成（上方文本）

   📤 请手动提交到:
   https://github.com/xxx/AutoSub/issues/new?template=selector-broken.md

   💡 提示: 复制上方内容，粘贴到 Issue 正文
   ```

7. 支持 `--copy` 参数：自动复制到系统剪贴板（需 `pyperclip` 包，可选依赖）
8. 不集成 GitHub API，避免额外依赖和认证复杂度
9. 提供 Issue 模板文件：`.github/ISSUE_TEMPLATE/selector-broken.md`
10. 保持功能简单：仅生成文本，不自动提交

---

### **Story 3.5: 本地选择器临时覆盖**

**As a** 用户，
**I want** 临时使用自定义选择器而不等待 GitHub 更新，
**so that** 我可以立即修复失效的抓取功能。

#### **Acceptance Criteria:**

1. 支持本地覆盖文件：`~/.autosub/selectors-override.json`
2. 本地覆盖优先级高于远程缓存和内置默认
3. 文件格式与远程 `sites.json` 一致：
   ```json
   {
     "candytally": {
       "selectors": {
         "subscription_button": ["button.new-class"]
       }
     }
   }
   ```

4. 加载顺序：本地覆盖 > 远程缓存 > 内置默认
5. 仅覆盖指定的选择器，其他选择器使用远程配置
6. `autosub config edit-selectors <站点名>` 打开编辑器编辑本地覆盖文件
7. 使用系统默认编辑器（`$EDITOR` 环境变量，默认 `vi`/`nano`）
8. 编辑后自动验证 JSON 格式，错误时显示具体行号
9. 使用本地覆盖时显示警告：
   ```
   ⚠️ 正在使用本地选择器覆盖
   站点: 糖果云
   覆盖项: subscription_button

   💡 建议: 运行 autosub report-issue candytally 提交修复
   ```

10. `autosub reset-selectors <站点名>` 删除本地覆盖，恢复远程配置
11. `autosub list-selectors` 显示所有站点的选择器来源（remote/override/default）
12. 本地覆盖在远程更新后保持有效，除非用户手动重置

---

### **Story 3.6: 选择器配置文档化**

**As a** 维护者或贡献者，
**I want** 清晰的选择器配置文档和示例，
**so that** 我可以快速添加新站点或修复现有站点。

#### **Acceptance Criteria:**

1. 创建 `docs/SELECTORS.md` 文档，包含：
   - 选择器配置格式说明
   - 多重选择器优先级规则
   - Playwright 选择器语法参考
   - 新站点添加步骤
   - 常见问题排查指南

2. 提供完整示例配置：
   ```json
   {
     "example-site": {
       "name": "示例站点",
       "url": "https://example.com",
       "selectors": {
         "login_username": [
           "#username",                    // 优先: ID 选择器
           "input[name='username']",       // 备选: 属性选择器
           "input[type='text']:first"      // 兜底: 类型选择器
         ],
         "subscription_button": [
           "button:has-text('订阅地址')",   // 优先: 文本匹配
           ".subscription-btn",            // 备选: CSS 类
           "a[href*='subscription']"       // 兜底: 部分匹配
         ]
       }
     }
   }
   ```

3. 选择器编写最佳实践：
   - 优先使用文本匹配（`:has-text()`），最稳定
   - 避免依赖动态生成的 CSS 类（如 `.css-xyz123`）
   - 优先级顺序：文本 > 语义属性 > CSS 类 > ID
   - 至少提供 2-3 个备选选择器

4. 维护者工作流文档（`CONTRIBUTING.md`）：
   - 如何验证新选择器：`autosub validate-selectors`
   - 如何测试选择器：`autosub diagnose <站点>`
   - PR 提交规范：标题格式、测试要求

5. 内置 `autosub validate-selectors` 命令：
   - 验证 `sites.json` 格式正确
   - 检查必需字段是否存在
   - 检查选择器数组是否为空
   - 输出验证报告

6. GitHub Actions 自动验证：
   - PR 触发时自动运行 `validate-selectors`
   - JSON 格式错误时自动注释 PR
   - 通过验证后显示绿色勾

7. 提供选择器测试工具：`autosub test-selector <站点> <选择器名>`
   ```bash
   $ autosub test-selector candytally subscription_button

   🧪 测试选择器: subscription_button

   尝试 [1/3]: button:has-text('订阅') ✅ 成功 (120ms)

   📊 结果: 成功定位元素
   元素: <button class="btn-primary">一键订阅</button>
   ```

8. 文档包含常见错误排查：
   - "选择器超时" → 检查页面加载是否完成
   - "元素不可见" → 检查是否需要滚动或点击展开
   - "多个匹配" → 使用 `:first` 或更具体的选择器

9. 选择器命名规范：`login_*`、`subscription_*`、`profile_*`
10. 文档提供视频教程链接（可选）：如何使用诊断模式

---

## Epic 4: 定时任务与自动升级

**Epic 目标：** 实现 Cron 定时任务配置（cron 命令），让用户设置自动化更新周期（默认每天 1 次）。提供脚本自动升级功能（upgrade 命令），确保用户始终使用最新版本。完善状态查看（status 命令）和 Cookie 刷新（refresh-cookie 命令）等辅助功能。

---

### **Story 4.1: Cron 定时任务配置**

**As a** 用户，
**I want** 配置定时任务自动更新订阅地址，
**so that** 我无需手动操作，实现完全自动化。

#### **Acceptance Criteria:**

1. `autosub cron` 启动定时任务配置向导，显示当前 Cron 状态（已配置/未配置）
2. 提供频率选择：
   ```
   ⏰ 请选择定时更新频率：

   1. 每天 1 次（早上 8:00）            - 默认推荐  ✨
   2. 每 3 天 1 次（早上 8:00）         - 节点稳定时
   3. 每周 1 次（周一早上 8:00）        - 低频更新
   4. 自定义 Cron 表达式              - 高级用户

   请选择 [1-4]:
   ```

3. **默认选项 1（每天 1 次）**，Cron 表达式：`0 8 * * *`
4. 选项 2（每 3 天），Cron 表达式：`0 8 */3 * *`
5. 选项 3（每周一次），Cron 表达式：`0 8 * * 1`
6. 选项 4（自定义）提示用户输入 Cron 表达式，并验证格式正确性
7. 自动检测操作系统：
   - macOS/Linux：直接写入用户 crontab
   - Windows（WSL）：写入 WSL 的 crontab
8. 生成的 Cron 任务命令（以默认每天 1 次为例）：
   ```bash
   0 8 * * * /usr/local/bin/autosub update --silent >> ~/.autosub/logs/cron.log 2>&1
   ```

9. 使用 `--silent` 模式避免终端输出，日志重定向到 `~/.autosub/logs/cron.log`
10. 配置前备份当前 crontab（保存到 `~/.autosub/crontab.backup`）
11. 配置成功后显示：
    ```
    ✅ 定时任务已配置

    📅 更新频率: 每天 1 次（早上 8:00）
    📁 日志文件: ~/.autosub/logs/cron.log

    💡 管理命令:
    - autosub cron-status   查看定时任务状态
    - autosub cron-logs     查看定时任务日志
    - autosub cron-remove   移除定时任务
    ```

12. `autosub cron-status` 显示当前 Cron 配置和下次执行时间
13. `autosub cron-logs` 显示最近 50 行日志（`tail -n 50 ~/.autosub/logs/cron.log`）
14. `autosub cron-remove` 移除定时任务，恢复 crontab 备份

---

### **Story 4.2: 状态查看与健康检查**

**As a** 用户，
**I want** 查看所有账户的当前状态和健康度，
**so that** 我可以快速了解哪些账户需要处理。

#### **Acceptance Criteria:**

1. `autosub status` 显示完整状态概览，包含表格和摘要信息
2. 状态表格包含以下字段：
   ```
   📋 AutoSub 状态概览

   ┌────────────────────────────────────────────────────────────────┐
   │ 账户    最后更新           订阅状态     Cookie 状态            │
   ├────────────────────────────────────────────────────────────────┤
   │ 糖果云  2025-01-15 14:30   ✅ 有效      🔑 7 天后过期         │
   │ 红杏云  2025-01-14 08:00   ❌ 未验证    🔑 已过期             │
   └────────────────────────────────────────────────────────────────┘

   ⏰ 定时任务: ✅ 已启用（每天 8:00）
   📁 Clash 配置: /Users/xxx/.config/clash/config.yaml
   📦 AutoSub 版本: v1.0.0 (最新)
   🔄 选择器版本: v1.2.0

   ⚠️ 需要处理:
   - 红杏云: Cookie 已过期，运行 autosub refresh-cookie 红杏云
   ```

3. 订阅状态检查逻辑：
   - 读取上次更新时间（从配置文件或日志）
   - 如果配置了验证记录，显示 ✅ 有效 / ❌ 失败
   - 超过 24 小时未更新显示 ⚠️ 过期

4. Cookie 状态检查逻辑：
   - 读取 Cookie 文件的修改时间
   - 估算过期时间（默认 30 天）
   - 剩余 < 7 天显示警告："X 天后过期"
   - 已过期显示："已过期"

5. Clash 配置文件状态：
   - 检查文件存在性和可写权限
   - 显示文件路径
   - 权限错误时显示警告

6. 定时任务状态：
   - 检查 crontab 是否包含 autosub 任务
   - 显示下次执行时间（解析 Cron 表达式）
   - 未配置时显示提示："运行 autosub cron 配置定时任务"

7. 版本检查：
   - 当前版本 vs GitHub 最新版本
   - 有新版本时显示："⬆️ v1.1.0 可用，运行 autosub upgrade 升级"

8. 支持 `--simple` 参数：仅显示账户状态，不显示系统信息
9. 支持 `--json` 参数：输出 JSON 格式，便于脚本解析
10. 异常情况友好提示（如：配置文件损坏、网络连接失败）

---

### **Story 4.3: Cookie 会话刷新**

**As a** 用户，
**I want** 快速刷新过期的 Cookie 会话，
**so that** 我无需重新配置账户，仅重新登录即可。

#### **Acceptance Criteria:**

1. `autosub refresh-cookie <账户名>` 启动 Cookie 刷新流程
2. 检查账户是否使用 Cookie 登录策略，密码登录账户显示错误
3. 显示提示信息：
   ```
   🔄 刷新 Cookie: 糖果云

   即将打开浏览器，请手动登录...
   登录成功后回到终端按回车继续
   ```

4. 使用 Playwright 打开浏览器窗口（`headless=False`），加载登录页面
5. 等待用户手动完成登录（处理验证码、2FA 等）
6. 用户按回车后，自动检测登录状态（URL 变化或特定元素）
7. 登录成功后自动提取浏览器 Cookie
8. 备份旧 Cookie 文件：`~/.autosub/cookies/{账户名}.json.backup`
9. 保存新 Cookie 到 `~/.autosub/cookies/{账户名}.json`
10. 显示成功信息：
    ```
    ✅ Cookie 已刷新

    📁 保存位置: ~/.autosub/cookies/糖果云.json
    🔑 预估有效期: 30 天

    💡 测试新 Cookie:
    autosub update --account 糖果云
    ```

11. 刷新失败时保留原 Cookie 文件，显示错误原因
12. 支持批量刷新：`autosub refresh-cookie --all`（刷新所有 Cookie 登录账户）

---

### **Story 4.4: 脚本自动升级**

**As a** 用户，
**I want** 一键升级 AutoSub 到最新版本，
**so that** 我可以获得新功能和 Bug 修复。

#### **Acceptance Criteria:**

1. `autosub upgrade` 启动自动升级流程
2. 检查 GitHub Releases 最新版本：
   ```
   GET https://api.github.com/repos/xxx/AutoSub/releases/latest
   ```

3. 对比当前版本（从 `__version__` 读取）
4. 已是最新版本时显示：
   ```
   ✅ 已是最新版本

   当前版本: v1.0.0
   最新版本: v1.0.0
   ```

5. 有新版本时显示更新日志摘要：
   ```
   🎉 发现新版本！

   当前版本: v1.0.0
   最新版本: v1.1.0

   📝 更新内容:
   - 新增：支持更多 VPN 站点
   - 修复：选择器失效问题
   - 优化：登录速度提升 30%

   是否升级? [Y/n]:
   ```

6. 用户确认后执行升级：
   ```bash
   cd ~/.autosub/source
   git pull origin main
   pip install -r requirements.txt --upgrade
   ```

7. 如果安装时使用的是 `curl | bash`（无 Git 仓库），则：
   ```bash
   # 下载最新版本
   curl -L https://github.com/xxx/AutoSub/archive/main.tar.gz | tar xz
   # 替换源代码
   cp -r AutoSub-main/* ~/.autosub/source/
   # 更新依赖
   pip install -r requirements.txt --upgrade
   ```

8. 升级过程中保留用户配置文件（`~/.autosub/config.yaml`、Cookie、日志）
9. 升级完成后显示：
   ```
   ✅ 升级完成！

   新版本: v1.1.0

   💡 查看变更:
   https://github.com/xxx/AutoSub/releases/tag/v1.1.0

   🧪 建议测试:
   autosub update --dry-run
   ```

10. 升级失败时自动回滚到备份版本
11. 支持 `--check` 参数：仅检查更新，不执行升级
12. 支持 `--force` 参数：强制重新安装当前版本（用于修复损坏文件）

---

### **Story 4.5: 配置备份与恢复**

**As a** 用户，
**I want** 备份和恢复我的配置，
**so that** 重装系统或迁移设备时可以快速恢复。

#### **Acceptance Criteria:**

1. `autosub backup` 创建完整配置备份，包含：
   - 配置文件：`~/.autosub/config.yaml`
   - Cookie 文件：`~/.autosub/cookies/*.json`
   - 本地选择器覆盖：`~/.autosub/selectors-override.json`
   - 备份元数据：版本号、备份时间、账户列表

2. 备份文件格式：`autosub-backup-{日期}.tar.gz`
3. 保存位置：`~/Downloads/autosub-backup-20250115.tar.gz`
4. 备份时自动加密敏感信息（密码、Cookie），使用用户密码作为密钥
5. 备份完成后显示：
   ```
   ✅ 备份完成

   📁 备份文件: ~/Downloads/autosub-backup-20250115.tar.gz
   🔐 包含内容: 3 个账户配置 + Cookie + 本地选择器

   💡 恢复备份:
   autosub restore ~/Downloads/autosub-backup-20250115.tar.gz
   ```

6. `autosub restore <备份文件>` 恢复配置：
   - 验证备份文件完整性（MD5 校验）
   - 提示用户输入备份密码（解密敏感信息）
   - 解压并覆盖现有配置
   - 显示恢复摘要

7. 恢复前自动备份当前配置（防止误操作）
8. 恢复完成后提示测试：`autosub status`
9. 支持 `--export-only` 参数：仅导出配置到 YAML 文件（不压缩，便于查看）
10. 备份文件包含 README.txt，说明如何手动恢复

---

### **Story 4.6: 辅助工具命令**

**As a** 用户，
**I want** 一些便捷的辅助命令和安全的卸载方式，
**so that** 我可以快速完成常见操作，并在需要时干净卸载。

#### **Acceptance Criteria:**

1. `autosub version` - 显示详细版本信息：
   ```
   AutoSub v1.0.0

   Python: 3.11.0
   Playwright: 1.40.0
   Platform: macOS 14.0

   📦 安装位置: ~/.autosub/source
   📁 配置位置: ~/.autosub
   ```

2. `autosub doctor` - 健康检查，诊断常见问题：
   ```
   🏥 AutoSub 健康检查

   ✅ Python 环境: 3.11.0
   ✅ 依赖包: 已安装
   ✅ Playwright 浏览器: Chromium 已安装
   ✅ 配置文件: 格式正确
   ✅ Clash 配置: 可访问
   ⚠️ 定时任务: 未配置

   💡 建议: 运行 autosub cron 配置定时任务
   ```

3. `autosub clean` - 清理临时文件和日志：
   - 删除超过 7 天的日志文件
   - 删除备份文件（保留最近 3 个）
   - 删除临时诊断输出
   - 显示释放的磁盘空间

4. **`autosub uninstall` - 完全卸载 AutoSub（增强版）：**

   **选项 A：本地卸载脚本执行**
   ```bash
   $ autosub uninstall

   ⚠️  警告：即将完全卸载 AutoSub

   将删除以下内容：
   📁 源代码: ~/.autosub/source
   📁 配置文件: ~/.autosub/config.yaml
   📁 Cookie 文件: ~/.autosub/cookies/
   📁 日志文件: ~/.autosub/logs/
   📁 所有缓存: ~/.autosub/
   🗑️  Cron 定时任务
   🔗 全局命令: /usr/local/bin/autosub

   💾 是否在卸载前创建备份? [Y/n]: y

   📦 备份已保存: ~/Downloads/autosub-backup-final-20250115.tar.gz

   ⚠️  请再次确认：这将永久删除所有 AutoSub 数据

   输入 'yes' 确认卸载: yes

   🗑️  正在卸载...
   ✅ 卸载完成

   💡 如需重新安装:
   curl -fsSL https://raw.githubusercontent.com/xxx/AutoSub/main/install.sh | bash
   ```

   **选项 B：在线卸载脚本（推荐）**
   ```bash
   $ autosub uninstall --online

   ⚠️  即将从 GitHub 下载并执行卸载脚本

   🌐 脚本地址: https://raw.githubusercontent.com/xxx/AutoSub/main/uninstall.sh

   是否继续? [Y/n]: y

   📥 正在下载卸载脚本...
   ✅ 下载完成

   [执行在线 uninstall.sh 脚本，包含相同的二次确认流程]
   ```

   **选项 C：用户直接执行在线脚本（与 install.sh 对称）**
   ```bash
   $ curl -fsSL https://raw.githubusercontent.com/xxx/AutoSub/main/uninstall.sh | bash

   ⚠️  AutoSub 卸载脚本

   [显示相同的警告和确认流程]
   ```

5. **GitHub `uninstall.sh` 脚本要求：**
   - 显示将删除的内容清单
   - 二次确认机制：必须输入完整的 `yes`
   - 卸载前强制询问是否备份
   - 移除 Cron 任务、全局命令、所有文件
   - 提供重新安装指引

6. **卸载安全机制：**
   - 必须输入完整的 `yes` 才能执行（不接受 `y`）
   - 卸载前强制询问是否备份
   - 显示将删除的具体路径和内容
   - 支持 `--force` 跳过确认（仅限自动化脚本）
   - 支持 `--keep-config` 保留配置文件（仅删除程序）

7. `autosub logs` - 快速查看日志：
   - 默认显示最近 50 行
   - 支持 `--lines N` 参数指定行数
   - 支持 `--follow` 实时跟踪日志（类似 `tail -f`）

8. `autosub config-path` - 输出配置目录路径（便于脚本使用）
9. `autosub test-login <账户名>` - 测试账户登录（不抓取订阅）
10. `autosub clear-cache` - 清除选择器缓存，强制重新下载
11. 所有辅助命令支持 `--help` 显示详细说明
12. 命令别名支持：`autosub st` = `autosub status`，`autosub up` = `autosub update`

---

## Next Steps（后续步骤）

### **UX Expert Prompt（UI/UX 专家提示）**

**任务：** 基于 PRD 创建前端交互规范

虽然 AutoSub 是纯 CLI 工具，但仍需要详细的交互设计：

```markdown
@ux-expert

请基于 AutoSub PRD 创建 CLI 交互规范文档，重点关注：

1. **向导式配置流程设计**
   - 步骤划分和进度提示
   - 错误处理和回退机制
   - 交互式问答的最佳实践

2. **终端输出美化规范**
   - 表格布局和对齐规则
   - 颜色编码系统（成功/失败/警告/信息）
   - 进度条和加载动画

3. **错误提示和帮助信息**
   - 友好的错误消息模板
   - 修复建议的展示方式
   - 上下文相关的帮助提示

4. **CLI 命令命名规范**
   - 命令层级结构
   - 参数命名约定
   - 别名设计原则

参考 PRD 中的 UI Design Goals 章节，创建详细的 CLI 交互规范。
```

---

### **Architect Prompt（架构师提示）**

**任务：** 基于 PRD 创建完整的技术架构文档

```markdown
@architect

请基于 AutoSub PRD 创建全栈技术架构文档（fullstack-architecture.md），重点关注：

1. **核心使命实现架构**
   - 自动登录模块（双策略：密码/Cookie）
   - 订阅链接抓取模块（多重选择器 Fallback）
   - 订阅地址验证模块（HTTP + 格式检查）
   - Clash 配置更新模块（智能部分更新）

2. **技术栈详细说明**
   - Python 3.9+ + Playwright 1.40+
   - 分层依赖管理策略
   - 核心依赖（20MB）vs 按需依赖（150MB）

3. **模块化设计**
   ```
   src/
   ├── cli.py                # CLI 入口
   ├── auth.py               # 登录模块（密码/Cookie）
   ├── scraper.py            # 抓取模块（多重选择器）
   ├── validator.py          # 验证模块（订阅地址验证）
   ├── updater.py            # 更新模块（Clash 配置更新）
   ├── config.py             # 配置管理
   ├── selectors.py          # 选择器管理（远程 + 本地）
   ├── cron.py               # Cron 任务管理
   └── utils.py              # 工具函数
   ```

4. **远程选择器配置系统**
   - GitHub Raw URL 拉取机制
   - 本地缓存策略（24 小时）
   - 版本检查和自动更新
   - 本地覆盖优先级

5. **数据流设计**
   - 配置文件加密存储（Fernet）
   - Cookie 会话管理
   - 日志记录和脱敏

6. **错误处理和重试机制**
   - 网络请求超时处理
   - 选择器失效降级策略
   - 配置文件备份和回滚

7. **性能优化**
   - 多账户并行抓取（asyncio）
   - 选择器缓存机制
   - 依赖按需加载

8. **安全性设计**
   - 密码加密存储
   - Cookie 文件权限（600）
   - 日志脱敏（密码、URL）

9. **跨平台兼容性**
   - macOS/Linux/Windows（WSL）
   - Cron 任务配置适配
   - 路径处理（pathlib）

10. **编码规范**
    - PEP 8 代码风格
    - 类型提示（Type Hints）
    - 文档字符串（Docstrings）

参考 PRD 中的 Technical Assumptions 和所有 Epic Stories，确保架构设计覆盖所有功能需求。

**关键约束：**
- 代码简洁，避免过度设计
- 核心使命优先：保证正确获取订阅链接
- 轻量化：源代码 < 100KB，核心依赖 < 25MB
```

---

## 文档完整性检查

**✅ 已完成章节：**
- Goals and Background Context
- Requirements（FR1-FR15 + NFR1-NFR10）
- User Interface Design Goals
- Technical Assumptions
- Epic List（4 个 Epic）
- Epic Details（23 个 Stories，每个含 10+ 验收标准）
- Next Steps（UX & Architect Prompts）

**✅ 关键决策记录：**
- 核心使命：保证正确获取订阅链接
- 技术栈：Python + Playwright（无 MCP）
- 依赖策略：分层按需加载（核心 20MB）
- 定时频率：默认每天 1 次
- 可维护性：GitHub 远程选择器 + 诊断模式
- 安装/卸载：install.sh ↔ uninstall.sh

---

**PRD 版本：** 1.0
**文档状态：** ✅ 完成
**下一步：** 移交给 UX Expert 和 Architect
