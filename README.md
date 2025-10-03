# Clash AutoSub

> 基于 Node.js + Puppeteer 的 VPN 订阅全自动化工具

[![npm version](https://badge.fury.io/js/clash-autosub.svg)](https://www.npmjs.com/package/clash-autosub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 📋 简介

Clash AutoSub 是一个命令行全自动化工具，解决动态 VPN 订阅地址（5分钟更新）导致的手动维护负担。通过 Puppeteer 控制系统 Chrome 浏览器，实现智能登录检测和自动订阅地址提取，自动更新 Clash 配置文件。

### 核心特性

- 🎯 **完全自动化** - 用户只需登录一次，后续自动完成所有操作
- 🧠 **智能登录检测** - 5+ 检测策略（URL/元素/网络/Cookie/通用模式）
- 🍪 **Cookie 持久化** - 登录状态保存，下次可能无需重新登录
- 🌐 **系统 Chrome** - 使用本地已安装的 Chrome，无需下载 Chromium
- 🛡️ **智能部分更新** - 成功的更新，失败的保留原配置
- 📡 **订阅地址验证** - HTTP状态码 + YAML格式 + 节点数量检查
- 🔧 **向导式配置** - 交互式 CLI，自动检测 Clash 路径
- 🔄 **远程维护** - GitHub 托管选择器配置，快速适配网站变化
- 🔒 **本地化安全** - 凭证加密存储，零云端上传

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- Chrome 浏览器（stable/canary/beta/dev）

### 安装

```bash
# 使用 npx（推荐）
npx clash-autosub

# 或全局安装
npm install -g clash-autosub
```

### 基本使用

```bash
# 打开交互式菜单（两种命令都可以）
clash-autosub
# 或
autosub

# 配置订阅站点
clash-autosub setup

# 手动更新订阅
autosub update

# 配置定时任务
autosub cron

# 查看状态
autosub status
```

## 📦 技术栈

| 类别 | 技术选型 | 说明 |
|------|----------|------|
| **语言** | TypeScript 5.0+ | 类型安全，开发体验好 |
| **运行时** | Node.js 18+ | 现代 JS 特性支持 |
| **CLI 框架** | CAC | 轻量级命令行框架 |
| **交互提示** | Inquirer.js | 交互式问答系统 |
| **浏览器控制** | Puppeteer-core | 使用系统 Chrome，轻量高效 |
| **登录检测** | 多策略智能检测 | URL/元素/网络/Cookie/通用模式 |
| **网络捕获** | Puppeteer Network | 100% 可靠的请求拦截 |

### 架构优势

- **完全自动化**: 智能登录检测（5+ 策略，120秒超时）
- **Cookie 持久化**: 保存到 `~/.autosub/chrome-profile`，下次可能无需登录
- **系统集成**: 使用本地 Chrome（macOS/Windows/Linux 自动检测）
- **可靠性提升**: Puppeteer 网络监听 99% 成功率（vs MCP 60-70%）
- **代码简化**: 相比 MCP 方案减少 20% 代码量

## 🏗️ 项目结构

```
clash-autosub/
├── bin/                    # CLI 入口
│   └── autosub.js         # 主入口文件
├── src/
│   ├── types/             # TypeScript 类型定义
│   ├── utils/             # 工具函数
│   │   ├── logger.ts      # 日志系统
│   │   ├── crypto.ts      # 加密工具
│   │   └── file.ts        # 文件操作
│   ├── config/            # 配置管理
│   │   ├── manager.ts     # 配置管理器
│   │   └── schema.ts      # 配置验证
│   ├── puppeteer/         # Puppeteer 浏览器控制
│   │   ├── browser.ts     # 浏览器管理（Chrome 检测 + 启动）
│   │   ├── login-detector.ts  # 智能登录检测（5+ 策略）
│   │   └── network.ts     # 网络请求监听
│   ├── subscription/      # 订阅抓取层
│   │   ├── puppeteer-api-extractor.ts  # API 模式提取
│   │   └── validator.ts   # 订阅验证
│   ├── clash/             # Clash 配置更新
│   │   └── updater.ts     # 配置更新器
│   ├── service/           # 业务服务层
│   │   └── auto-update.ts # 自动更新服务
│   └── cli/               # CLI 层
│       └── index.ts       # 命令行接口
└── docs/                  # 文档
    └── DEVELOPMENT.md     # 开发守则（含 ESM 导入规范）
```

## 🛠️ 开发

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome 浏览器（macOS/Windows/Linux 自动检测路径）

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

# 运行测试
npm test

# 代码检查
npm run lint

# 代码格式化
npm run format
```

## 🗑️ 卸载

### 完全卸载（删除所有数据）

```bash
# 方式 1: 使用内置卸载命令（推荐）
npx clash-autosub uninstall

# 方式 2: 手动卸载
# 1. 卸载程序
npm uninstall -g clash-autosub  # 全局安装的用户

# 2. 清理配置文件
rm -rf ~/.autosub

# 3. 清理 npx 缓存（可选）
npx clear-npx-cache
```

### 保留配置的卸载

```bash
# 卸载程序但保留配置文件（下次安装可继续使用）
npx clash-autosub uninstall --keep-config
```

### 配置文件位置

- **配置目录**: `~/.autosub/`
- **配置文件**: `~/.autosub/config.yaml`
- **Chrome 配置**: `~/.autosub/chrome-profile/`（Cookie 持久化）
- **日志文件**: `~/.autosub/logs/`
- **备份文件**: `~/.autosub/backups/`
- **加密密钥**: `~/.autosub/.key`

## 📝 文档

详细文档请查看 [docs](./docs) 目录：

- [**技术栈变更说明**](./docs/TECH_STACK_MIGRATION.md) - ⭐ MCP → Puppeteer 迁移详解
- [开发守则](./docs/DEVELOPMENT.md) - 包含 ESM 导入规范、代码质量原则等
- [产品需求文档 (PRD)](./docs/prd.md) - 原始需求(历史文档,基于 MCP)
- [项目简报](./docs/project-brief.md) - 项目概述(历史文档,基于 MCP)
- [基础需求](./docs/basic_prd.md)

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

### Cookie 持久化失败

**问题**: 每次都需要重新登录

**解决方法**:
1. 检查 `~/.autosub/chrome-profile/` 目录权限
2. 确保该目录未被其他程序占用
3. 尝试清除该目录并重新登录

### 订阅地址提取失败

**问题**: 无法提取到订阅地址

**解决方法**:
1. 检查站点配置中的选择器是否正确
2. 查看网络请求日志确认订阅 API 是否被调用
3. 联系项目维护者更新选择器配置

## 🤝 贡献

欢迎贡献代码、报告问题或提出新功能建议！

## 📄 开源协议

[MIT License](./LICENSE)

## 🙏 致谢

- [ZCF](https://github.com/UfoMiao/zcf) - CLI 交互设计参考
- [Puppeteer](https://pptr.dev/) - 强大的浏览器自动化引擎
