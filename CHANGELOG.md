# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-03

### 🎉 首次发布

Clash AutoSub 首个稳定版本，实现基于 Puppeteer 的完全自动化 VPN 订阅管理。

### ✨ 新增功能

#### 核心功能
- **完全自动化订阅更新** - 用户只需登录一次，后续自动完成所有操作
- **智能登录检测** - 5+ 检测策略（URL/元素/网络/Cookie/通用模式）
- **Cookie 持久化** - 登录状态本地加密存储，自动复用
- **自动会话校验** - 启动时刷新各站点 Cookie 有效性

#### 浏览器自动化
- **Puppeteer 集成** - 直接驱动系统 Chrome 浏览器
- **自动 Chrome 检测** - 支持 macOS/Windows/Linux 多平台
- **凭证捕获** - 自动捕获 Cookie/localStorage/sessionStorage
- **网络请求监控** - 智能提取订阅 API 地址

#### AI 增强
- **AI 辅助验证** - 使用 DeepSeek/OpenRouter 分析订阅响应内容
- **智能错误检测** - 识别 `{"status":"fail"}` 等 JSON 错误
- **AI 视觉分析** - 登录状态检测（可选）

#### 订阅管理
- **多站点支持** - 同时管理多个 VPN 订阅站点
- **智能部分更新** - 成功的更新，失败的保留原配置
- **订阅地址验证** - HTTP状态码 + AI分析 + YAML格式 + 节点数量检查
- **SSL 证书忽略** - 支持自签名证书（`curl -k` 模式）

#### Clash 集成
- **配置自动更新** - 自动合并订阅到 Clash 配置
- **订阅 URL 替换** - 自动更新 Clash 配置中的订阅地址
- **配置备份** - 自动备份 Clash 配置文件

#### Cookie 管理
- **过期检测** - 智能检测 Cookie 过期时间
- **自动刷新** - 支持通过访问站点刷新 Cookie
- **多存储支持** - 支持 localStorage/sessionStorage 作为有效凭证

#### CLI 交互
- **向导式配置** - 交互式 CLI，自动检测 Clash 路径
- **菜单驱动** - 友好的菜单界面，实时显示状态
- **实时状态标注** - Cookie 有效性实时显示

### 🔧 技术架构

- **语言**: TypeScript 5.0+
- **运行时**: Node.js 18+
- **浏览器控制**: Puppeteer-core 24.x
- **CLI 框架**: CAC 6.7+
- **交互提示**: Inquirer.js 9.0+
- **HTTP 客户端**: Axios 1.12+
- **配置解析**: js-yaml 4.1+
- **加密**: crypto-js 4.2+

### 📝 文档

- 完整的 README.md 使用指南
- 详细的 PRD.md 产品需求文档
- CHANGELOG.md 版本历史

### 🔄 技术迁移

从 Chrome DevTools MCP 迁移到 Puppeteer 方案：
- **更好的控制力** - Puppeteer 提供更直接的浏览器控制
- **简化部署** - 无需额外的 MCP Server 进程
- **更好的稳定性** - 减少中间层，降低故障点
- **AI 增强** - 集成 AI 分析能力

### 🐛 已知问题

- 某些站点可能需要手动配置选择器
- Headless 模式下 Cookie 刷新可能不稳定

### 📦 发布信息

- **npm**: https://www.npmjs.com/package/clash-autosub
- **GitHub**: https://github.com/engty/clash-autosub
- **许可证**: MIT

---

## [开发阶段] - 2025-10-01 至 2025-10-02

### 主要开发里程碑

- 项目初始化，确定技术栈
- MCP 方案原型开发
- Puppeteer 迁移重构
- AI 功能集成
- Cookie 管理优化
- 文档完善

---

**注**: 本项目遵循语义化版本规范。版本号格式为 `主版本号.次版本号.修订号`，递增规则如下：
- 主版本号：做了不兼容的 API 修改
- 次版本号：做了向下兼容的功能性新增
- 修订号：做了向下兼容的问题修正
