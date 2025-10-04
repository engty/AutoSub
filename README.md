# Clash AutoSub

> 基于 Node.js + Puppeteer 的 VPN 订阅全自动化工具

[![npm version](https://badge.fury.io/js/clash-autosub.svg)](https://www.npmjs.com/package/clash-autosub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 📋 简介

Clash AutoSub 是一个命令行全自动化工具，解决动态 VPN 订阅地址频繁变更导致的手动维护负担。通过 Puppeteer 控制系统 Chrome 浏览器，实现智能登录检测和自动订阅地址提取，自动更新 Clash 配置文件。

### 核心特性

- 🎯 **完全自动化** - 用户只需登录一次，后续自动完成所有操作
- ⚡ **智能API检测** - 首次登录时自动分析网络请求，识别订阅API模式
- 🔇 **静默后台更新** - 检测到API配置后，后续更新无需启动浏览器（< 1秒完成）
- 🧠 **智能登录检测** - 多种检测策略（URL/元素/网络/Cookie）
- 🤖 **AI 辅助验证** - 可选的 AI 分析订阅响应内容，智能判断有效性
- 🍪 **Cookie 持久化** - 登录状态加密存储于 `~/.autosub/credentials/`，自动复用
- 🔄 **自动校验会话** - 启动时刷新各站点 Cookie 有效性
- 🌐 **系统 Chrome** - 使用本地已安装的 Chrome，无需下载 Chromium
- 🛡️ **智能部分更新** - 成功的更新，失败的保留原配置
- 📡 **订阅地址验证** - HTTP状态码 + AI内容分析 + YAML格式检查
- 🔧 **向导式配置** - 交互式 CLI，自动检测 Clash 路径
- 🔒 **本地化安全** - 凭证加密存储，零云端上传

### 工作原理

**三级订阅提取策略**（自动降级）：

1. **HTTP API 模式**（优先，< 1秒）
   - 首次登录时自动检测订阅API端点、认证方式和数据结构
   - 保存API配置到本地，后续使用纯HTTP请求获取订阅
   - 支持多种认证：Cookie、localStorage Token、混合认证
   - 完全静默后台执行，不启动浏览器

2. **缓存地址模式**（备用）
   - 如果API失败，使用上次成功的订阅地址
   - 适用于订阅地址有一定有效期的站点

3. **浏览器模式**（最后手段）
   - 启动浏览器，自动注入凭证登录
   - 智能检测登录状态，自动提取订阅地址
   - 使用AI辅助识别订阅按钮（可选）

**性能提升**：
- 更新速度：5-10秒 → < 1秒
- 内存占用：几百MB → 几KB
- 用户体验：完全后台静默执行

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- Chrome 浏览器（stable/canary/beta/dev）
- （可选）DeepSeek 或 OpenRouter API Key（用于AI辅助）

### 安装

```bash
# 使用 npx（推荐，无需安装）
npx clash-autosub

# 或全局安装
npm install -g clash-autosub
```

### 基本使用

```bash
# 打开交互式菜单（推荐）
clash-autosub
# 或
autosub

# 直接命令（无交互）
autosub update          # 静默更新所有站点
autosub update 红杏云   # 更新指定站点（会打开浏览器）
autosub status          # 查看站点状态
autosub refresh-credentials --headless --all  # 刷新所有站点凭证
```

### 首次配置

1. **配置 Clash 路径**
   ```bash
   autosub
   # 选择 "1. Clash 配置路径"
   # 输入你的 Clash 配置文件路径，如：
   # ~/.config/clash.meta/config.yaml
   ```

2. **配置 AI（可选）**
   ```bash
   # 选择 "2. AI 智能识别"
   # 选择 DeepSeek 或 OpenRouter
   # 输入 API Key
   ```

3. **添加订阅站点**
   ```bash
   # 选择 "3. 站点管理"
   # 选择 "1. 添加站点"
   # 输入站点名称和URL
   # 浏览器会自动打开，完成登录
   # 工具会自动检测并保存API配置
   ```

4. **更新订阅**
   ```bash
   # 选择 "4. 更新订阅"
   # 首次会使用浏览器模式
   # 之后会自动使用静默的HTTP API模式（< 1秒）
   ```

## 📖 详细功能

### 交互式菜单

```
┌──────────────────────────────────┐
│   Clash AutoSub - 订阅管理工具   │
└──────────────────────────────────┘

1. Clash 配置路径（已配置|未配置）
2. AI 智能识别（已开启|未开启）
3. 站点管理（3）
4. 更新订阅
5. 查看状态
6. 刷新凭证
7. 退出
```

### 站点管理

- **添加站点** - 自动检测API配置，保存认证信息
- **查看站点** - 显示订阅地址、凭证状态、最后更新时间
- **编辑站点** - 修改站点配置
- **删除站点** - 移除站点及其凭证
- **测试站点** - 验证订阅地址有效性

### 凭证管理

- **自动刷新** - 更新失败时自动刷新凭证并重试
- **手动刷新** - 使用 `refresh-credentials` 命令
- **凭证状态** - 实时显示Cookie有效期
- **支持类型**：
  - Cookie认证（适用于大多数站点）
  - localStorage Token认证（如牛牛云）
  - sessionStorage认证
  - 混合认证

### AI 辅助功能

**AI Provider 支持**：
- DeepSeek（推荐，成本低）
- OpenRouter

**AI 用途**：
1. **订阅验证** - 分析HTTP响应内容，识别错误消息
2. **按钮识别**（可选）- AI视觉分析识别订阅按钮

**配置方法**：
```bash
autosub
# 选择 "2. AI 智能识别"
# 填写 API Key
```

## 🛠️ 命令行参考

### `clash-autosub` 或 `autosub`

打开交互式菜单（推荐使用）

### `autosub update [siteId]`

更新 Clash 订阅

- 不带参数：静默模式更新所有站点（< 1秒）
- 带站点ID：更新指定站点（可能打开浏览器）

```bash
autosub update           # 静默更新所有
autosub update 红杏云    # 更新红杏云
```

### `autosub status`

查看所有站点状态，包括：
- 订阅地址
- 凭证有效期
- 最后更新时间
- 提取模式（API/浏览器）

### `autosub refresh-credentials [siteId]`

刷新站点Cookie（保持登录）

选项：
- `--headless` - 无头模式运行（后台，不显示浏览器）
- `--all` - 刷新所有站点
- `--force` - 强制刷新（包括不需要的）

```bash
autosub refresh-credentials --headless --all
autosub refresh-credentials 红杏云
```

### `autosub setup`

初始化配置（等同于交互式菜单中的添加站点）

### `autosub uninstall`

卸载并清理数据

选项：
- `--keep-config` - 保留配置文件

```bash
autosub uninstall                  # 完全卸载
autosub uninstall --keep-config    # 保留配置
```

## 📦 技术栈

| 类别 | 技术选型 | 说明 |
|------|----------|------|
| **语言** | TypeScript 5.0+ | 类型安全，开发体验好 |
| **运行时** | Node.js 18+ | 现代 JS 特性支持 |
| **CLI 框架** | CAC | 轻量级命令行框架 |
| **交互提示** | Inquirer.js | 交互式问答系统 |
| **浏览器控制** | Puppeteer-core | 使用系统 Chrome，轻量高效 |
| **配置管理** | js-yaml | YAML 配置文件 |
| **加密存储** | crypto-js | 凭证加密 |
| **HTTP 客户端** | Axios | 静默API请求 |

## 🏗️ 项目结构

```
clash-autosub/
├── bin/                    # CLI 入口
│   ├── clash-autosub.js   # 主命令
│   └── autosub.js         # 别名
├── src/
│   ├── types/             # TypeScript 类型定义
│   ├── utils/             # 工具函数
│   │   ├── logger.ts      # 日志系统
│   │   └── file.ts        # 文件操作
│   ├── config/            # 配置管理
│   │   ├── manager.ts     # 配置管理器
│   │   └── schema.ts      # 配置验证
│   ├── credentials/       # 凭证管理
│   │   ├── manager.ts     # 凭证加密存储
│   │   └── cookie-expiry.ts # Cookie过期检测
│   ├── puppeteer/         # 浏览器控制
│   │   ├── browser.ts     # 浏览器管理（Chrome 检测 + 启动）
│   │   ├── login-detector.ts  # 智能登录检测
│   │   └── network.ts     # 网络请求监听
│   ├── subscription/      # 订阅抓取
│   │   ├── api-detector.ts          # API自动检测器
│   │   ├── http-api-extractor.ts    # HTTP静默提取器
│   │   ├── puppeteer-extractor.ts   # 浏览器方式提取
│   │   └── validator.ts             # 订阅验证
│   ├── ai/                # AI 辅助
│   │   ├── ai-config.ts   # AI 配置管理
│   │   └── providers/     # AI Provider 实现
│   ├── clash/             # Clash 配置更新
│   │   └── updater.ts     # 配置更新器
│   ├── service/           # 业务服务
│   │   ├── auto-update.ts       # 自动更新服务
│   │   ├── cookie-refresh.ts    # Cookie 刷新服务
│   │   └── cookie-status.ts     # Cookie 状态管理
│   └── cli/               # CLI 层
│       └── index.ts       # 命令行接口
└── dist/                  # 编译输出
```

## 🗑️ 卸载

### 完全卸载（删除所有数据）

```bash
# 方式 1: 使用内置卸载命令（推荐）
autosub uninstall

# 方式 2: 手动卸载
npm uninstall -g clash-autosub
rm -rf ~/.autosub
```

### 保留配置的卸载

```bash
# 卸载程序但保留配置文件（下次安装可继续使用）
autosub uninstall --keep-config
```

### 配置文件位置

- **配置目录**: `~/.autosub/`
- **配置文件**: `~/.autosub/config.yaml`
- **凭证目录**: `~/.autosub/credentials/`（每站点一份，加密存储）
- **日志文件**: `~/.autosub/logs/`
- **备份文件**: `~/.autosub/backups/`（Clash配置备份）
- **加密密钥**: `~/.autosub/.key`

## ❓ 故障排查

### Chrome 浏览器未找到

**错误信息**: `未找到 Chrome 浏览器`

**解决方法**:
1. 确保已安装 Google Chrome 浏览器
2. 检查安装路径是否符合系统默认位置:
   - **macOS**: `/Applications/Google Chrome.app/`
   - **Windows**: `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - **Linux**: `/usr/bin/google-chrome` 或 `/usr/bin/chromium-browser`

### 登录检测超时

**问题**: 系统提示"登录检测超时"

**原因**: 120秒内未检测到登录成功

**解决方法**:
1. 确保在浏览器中完成登录操作
2. 检查网络连接是否正常
3. 查看日志文件 `~/.autosub/logs/` 了解详细错误

### Cookie 过期自动刷新失败

**问题**: 静默更新时提示"认证已过期"

**解决方法**:
1. 工具会自动尝试刷新Cookie并重试
2. 如果自动刷新失败，使用：
   ```bash
   autosub refresh-credentials --headless --all
   ```
3. 如果仍然失败，使用浏览器模式手动登录：
   ```bash
   autosub refresh-credentials --all
   ```

### 订阅地址提取失败

**问题**: 无法提取到订阅地址

**解决方法**:
1. 检查网络连接
2. 查看日志 `~/.autosub/logs/` 确认错误原因
3. 尝试手动刷新凭证
4. 如果站点改版，可能需要重新添加站点

### AI 功能无法使用

**问题**: AI 验证失败

**解决方法**:
1. 检查 API Key 是否正确
2. 检查网络是否能访问 AI Provider
3. AI 功能是可选的，关闭不影响核心功能

## 🔧 开发

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome 浏览器

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/engty/clash-autosub.git
cd clash-autosub

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run typecheck
```

### 构建发布

```bash
# 构建
npm run build

# 发布到 npm
npm publish
```

## 🤝 贡献

欢迎贡献代码、报告问题或提出新功能建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 开源协议

[MIT License](./LICENSE)

## 🙏 致谢

- [Puppeteer](https://pptr.dev/) - 强大的浏览器自动化引擎
- [DeepSeek](https://www.deepseek.com/) - 高性价比的 AI API
- 所有贡献者和用户的支持
