# Clash AutoSub

> 基于 Node.js + Chrome DevTools MCP 的 VPN 订阅自动化工具

[![npm version](https://badge.fury.io/js/clash-autosub.svg)](https://www.npmjs.com/package/clash-autosub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 📋 简介

Clash AutoSub 是一个命令行自动化工具，解决动态 VPN 订阅地址（5分钟更新）导致的手动维护负担。通过 Google 官方的 Chrome DevTools MCP Server，实现用户手动登录后自动捕获凭证（Cookie + Token + Storage），并更新 Clash 配置文件。

### 核心特性

- 🌐 **Chrome DevTools MCP 集成** - 使用 Google 官方 MCP Server 控制浏览器
- 🔐 **统一登录策略** - 用户手动登录 + MCP 自动捕获所有凭证
- 🛡️ **智能部分更新** - 成功的更新，失败的保留原配置
- 📡 **订阅地址验证** - HTTP状态码 + YAML格式 + 节点数量检查
- 🔧 **向导式配置** - 交互式 CLI（借鉴 ZCF 设计），自动检测 Clash 路径
- 🔄 **远程维护** - GitHub 托管选择器配置，快速适配网站变化
- 🔒 **本地化安全** - 凭证加密存储，零云端上传

## 🚀 快速开始

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
| **浏览器控制** | Chrome DevTools MCP | Google 官方 MCP Server |
| **MCP 客户端** | @modelcontextprotocol/sdk | 官方 MCP SDK |

## 🏗️ 项目结构

```
clash-autosub/
├── bin/                    # CLI 入口
├── src/
│   ├── cli/               # CLI 主程序
│   ├── core/              # 核心业务逻辑
│   │   ├── mcp/          # MCP 客户端
│   │   ├── auth/         # 登录模块
│   │   ├── scraper/      # 订阅抓取
│   │   ├── validator/    # 订阅验证
│   │   └── updater/      # Clash 配置更新
│   ├── config/           # 配置管理
│   ├── utils/            # 工具函数
│   └── types/            # TypeScript 类型定义
├── selectors/             # 选择器配置（GitHub 远程）
├── templates/             # 配置模板
└── tests/                 # 测试用例
```

## 🛠️ 开发

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome 浏览器（stable/canary/beta/dev）

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

## 📝 文档

详细文档请查看 [docs](./docs) 目录：

- [产品需求文档 (PRD)](./docs/prd.md)
- [项目简报](./docs/project-brief.md)
- [基础需求](./docs/basic_prd.md)

## 🤝 贡献

欢迎贡献代码、报告问题或提出新功能建议！

## 📄 开源协议

[MIT License](./LICENSE)

## 🙏 致谢

- [ZCF](https://github.com/UfoMiao/zcf) - CLI 交互设计参考
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) - 浏览器自动化引擎
