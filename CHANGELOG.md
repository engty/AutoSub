# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2025-10-04

### ✨ 新增功能

#### 站点兼容性测试命令
- **新增 `test` 命令** - `clash-autosub test <url>` 测试站点兼容性
  - 自动检测登录、凭证、API配置
  - 计算兼容性评分（0-100分）
  - 评估支持的模式（HTTP API / 浏览器模式）
  - 完全不保存任何数据（只读测试）
- **AI增强报告** - 使用AI将技术报告转换成用户友好格式
  - 自动生成Markdown格式报告
  - 提供实用建议
  - AI不可用时自动降级到默认格式
- **Issue提交支持** - 输出原始JSON数据供用户提交Issue使用
- **开发者工具** - 帮助评估新站点兼容性，改进项目支持

### 📝 变更详情

**新增文件：**
- `src/service/site-test.ts` - 站点测试服务
- `src/types/test-report.ts` - 测试报告类型定义
- `src/utils/test-report-formatter.ts` - AI报告格式化工具

**修改文件：**
- `src/cli/index.ts` - 添加test命令和handleSiteTest处理函数

**兼容性：**
- ✅ 向后兼容 - 不影响现有功能
- ✅ 纯测试功能 - 不修改任何配置
- ✅ 可选AI - AI不可用时自动降级

## [1.4.0] - 2025-10-04

### 🐛 Bug修复

#### localStorage认证支持修复
- **扩展localStorage字段检测** - ApiDetector现在支持检测更多localStorage字段
  - 新增支持：`info`, `userInfo`, `user-info`
  - 支持大写Token字段：`info.Token`（不仅仅是小写`token`）
  - 修复了牛牛云等使用`info.Token`字段的站点无法正确检测认证方式的问题

#### HttpApiExtractor凭证验证优化
- **灵活的凭证验证** - 根据`authSource`类型智能验证凭证
  - `cookie`: 只检查cookies是否存在
  - `localStorage`: 只检查localStorage是否存在
  - `both`: 至少需要一个
- **修复强制Cookie问题** - 之前版本错误地要求所有站点必须有Cookie，导致localStorage认证的站点（如牛牛云）无法使用

#### CLI命令优化
- **版本号显示修复** - 修复 `--help` 显示版本号为 1.0.0 的问题，现在正确显示当前版本
- **简化update命令** - 移除冗余的 `--silent` 和 `--all` 选项
  - `clash-autosub update` - 默认静默模式更新所有站点（< 1秒）
  - `clash-autosub update <siteId>` - 非静默模式更新指定站点

#### 菜单文案优化
- **精简菜单文字** - 使菜单更加简洁易读
  - "订阅站点管理（已保存 3 站点）" → "站点管理（3）"
  - "AI 智能识别设置（已配置）" → "AI 智能识别（已开启|未开启）"
  - "Clash 路径配置（已配置）" → "Clash 配置路径（已配置）"

### 📝 变更详情

**影响的文件：**
- `src/subscription/api-detector.ts` - 扩展localStorage认证字段检测
- `src/subscription/http-api-extractor.ts` - 修复凭证验证逻辑
- `src/cli/index.ts` - CLI命令优化和菜单文案简化

**兼容性：**
- ✅ 向后兼容 - 不影响现有Cookie认证站点
- ✅ 修复localStorage认证 - 牛牛云等站点现在可以正常工作
- ✅ 改进用户体验 - 命令更简洁，默认行为更智能

## [1.3.1] - 2025-10-03

### 🚀 重大改进

#### Cookie过期自动刷新机制
- **智能检测** - HTTP API在遇到403/401认证失败时，自动识别Cookie过期
- **自动修复** - 静默模式下检测到Cookie过期后，自动使用headless模式刷新Cookie
- **无缝体验** - Cookie刷新成功后自动重试API请求，用户无需手动干预

#### 错误处理优化
- **结构化错误** - HttpApiExtractor现在返回带有错误代码的结构化错误信息
  - `AUTH_EXPIRED`: 认证已过期（403/401 + 关键词检测）
  - `CREDENTIALS_NOT_FOUND`: 未找到凭证文件
- **友好提示** - 错误消息中包含具体的解决方案和CLI命令
  - 缺少凭证：`autosub refresh-credentials --headless`
  - 订阅地址无效：`autosub add` 重新配置
  - 静默模式不可用：`autosub update` 使用标准模式

#### 工作流程改进
```
旧流程（v1.3.0）：
HTTP API失败 → 直接报错 → 用户手动刷新Cookie → 重新运行

新流程（v1.3.1）：
HTTP API失败 → 检测到AUTH_EXPIRED → 自动刷新Cookie → 重试成功 ✓
```

### 🐛 问题修复

#### 解决v1.3.0静默模式失败问题
- **问题**: 静默模式下Cookie过期导致更新失败，无明确解决方案
- **修复**:
  - 自动检测403响应中的"未登录或登陆已过期"等关键词
  - 在静默模式下自动触发headless Cookie刷新
  - 刷新成功后立即重试HTTP API请求

### 📝 技术细节

#### 文件变更
- `src/subscription/http-api-extractor.ts` (src/subscription/http-api-extractor.ts:35-109)
  - 添加认证状态检测逻辑（401/403检测）
  - 添加关键词匹配识别Cookie过期
  - 返回结构化错误对象（带error.code）

- `src/service/auto-update.ts` (src/service/auto-update.ts:229-344)
  - 添加Cookie过期检测和处理逻辑
  - 实现`autoRefreshCookieInSilentMode()`方法
  - 优化错误提示消息，提供具体CLI命令

## [1.2.0] - 2025-10-03

### ✨ 新增功能

#### 查看状态功能增强
- **订阅地址显示** - 在"查看状态"菜单中显示各站点的订阅地址
- **Cookie 状态显示** - 在"查看状态"菜单中显示各站点的凭证有效期
- **智能 URL 截断** - 订阅地址过长时自动截断（显示前 60 个字符）
- **颜色状态标识** - Cookie 状态使用颜色区分（绿色/黄色/红色）

#### 技术改进
- 将 `forEach` 改为 `for...of` 循环以支持异步操作
- 复用 `getCookieExpiryInfo` 和 `formatExpiryInfo` 函数
- 保持与"刷新凭证"菜单一致的显示风格

#### 用户体验提升
- 用户可以直观查看所有站点的订阅地址
- 用户可以快速了解各站点的凭证有效期
- 支持 Storage 登录类型的正确显示

## [1.1.1] - 2025-10-03

### 🐛 重大问题修复

#### 订阅地址提取失败问题（关键修复）
- **问题描述**：AI 识别按钮后点击失败，导致剪贴板持续读取旧内容
- **根本原因**：
  - 广告/弹窗遮挡层阻止按钮点击
  - 使用固定延迟代替智能等待
  - 仅使用单一点击方式，容易被拦截

#### 修复方案
- ✅ **遮挡层清理**：自动按 ESC 键关闭广告和弹窗
- ✅ **遮挡检测**：使用 `document.elementFromPoint()` 检测按钮是否被遮挡
- ✅ **多策略点击**：3 种点击方式自动降级重试
  1. `page.click()` - Puppeteer 标准点击
  2. `element.click()` - DOM 直接点击（绕过遮挡层）
  3. `focus + Enter` - 键盘模拟点击
- ✅ **智能等待**：使用 `page.waitForFunction()` 等待剪贴板内容变化
  - 最长等待 10 秒
  - 每 200ms 检查一次
  - 检测到变化立即返回

#### Cookie 状态显示误判问题（关键修复）
- **问题描述**：使用 localStorage/sessionStorage 登录的站点显示"[无Cookie]"
- **根本原因**：`getCookieExpiryInfo` 函数只检查 cookies，忽略了 Web Storage
- **修复方案**：
  - 扩展 `CookieExpiryInfo` 类型，添加 `'storage'` 类型
  - 修改 `getCookieExpiryInfo` 支持检测 localStorage/sessionStorage
  - 修改 `formatExpiryInfo` 显示"Storage 登录（长期有效）"
- **影响范围**：所有使用 Web Storage 登录的站点（如牛牛云）都能正确显示状态

#### 技术改进
- **新增函数**：
  - `closeOverlaysWithEsc()` - 按 ESC 关闭遮挡层
  - `waitForClipboardChange()` - 智能等待剪贴板变化
  - `detectElementOverlay()` - 检测元素遮挡状态
  - `clickElementMultiWay()` - 多方式点击重试

- **重构方法**：
  - `clickButtonWithAI()` - AI 识别点击流程增强
  - `clickButtonWithTextMatching()` - 文本匹配点击流程增强
  - `extract()` - 主流程添加预防性遮挡层清理
  - `getCookieExpiryInfo()` - 支持 Web Storage 凭证检测
  - `formatExpiryInfo()` - 支持 Storage 类型显示

#### 日志优化
- 详细记录每个步骤的执行情况
- 显示剪贴板内容变化过程
- 标注使用的点击策略

### 🔧 代码质量
- 修复 TypeScript 类型错误
- 删除未使用的变量
- 优化错误处理逻辑

### 📈 预期效果
- 订阅地址提取成功率从 ~30% 提升至 ~95%+
- Web Storage 登录的站点状态显示正确
- 减少用户手动干预次数
- 提升自动化可靠性

## [1.1.0] - 2025-10-03

### ✨ 新增功能

#### AI 增强
- **AI 辅助验证** - 集成 DeepSeek/OpenRouter 分析订阅响应内容
- **智能错误检测** - 识别 `{"status":"fail"}` 等 JSON 错误格式
- **AI 视觉分析** - 可选的登录状态检测能力

#### Cookie 管理优化
- **过期检测** - 智能检测 Cookie 过期时间
- **自动刷新** - 支持通过访问站点刷新 Cookie
- **多存储支持** - 支持 localStorage/sessionStorage 作为有效凭证
- **状态实时显示** - CLI 菜单实时标注 Cookie 有效性

#### 凭证系统增强
- **凭证外置存储** - 每个站点独立凭证文件（`~/.autosub/credentials/`）
- **加密存储** - 使用 crypto-js 加密敏感信息
- **自动检测** - 启动时自动刷新各站点凭证状态

#### 订阅验证改进
- **SSL 证书忽略** - 支持自签名证书（`curl -k` 模式）
- **内容智能分析** - HTTP 状态码 + AI 内容分析 + YAML 格式检查
- **降级机制** - AI 不可用时自动使用规则匹配

#### CLI 体验优化
- **详细日志** - 凭证捕获过程详细记录
- **剪贴板清理** - 自动清理剪贴板避免读取旧数据
- **错误提示优化** - 更友好的错误信息和建议

### 🐛 问题修复
- 修复糖果云剪贴板读取旧数据的问题
- 修复牛牛云 localStorage 登录状态误判
- 修复订阅地址有效但缺少凭证文件的问题

### 📝 文档
- 完善 README.md，添加 AI 功能说明
- 更新 PRD.md 反映 Puppeteer 架构
- 创建完整的 CHANGELOG.md
- 移除文档中的隐私信息

### 🔧 代码质量
- 完整的隐私审查
- 删除测试文件和开发工具配置
- 更新 .gitignore
- 优化错误处理和降级机制

### 💥 破坏性变更
- 订阅验证逻辑从单纯 HTTP 状态码检查升级为 AI 内容分析（可选配置）

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
- CHANGELOG.md 版本历史

### 🔄 技术架构

项目采用现代化技术栈：
- **更好的控制力** - Puppeteer 提供直接的浏览器控制
- **简化部署** - 无需额外的服务进程
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
- 核心功能开发
- 自动化流程优化
- AI 功能集成
- Cookie 管理优化
- 文档完善

---

**注**: 本项目遵循语义化版本规范。版本号格式为 `主版本号.次版本号.修订号`，递增规则如下：
- 主版本号：做了不兼容的 API 修改
- 次版本号：做了向下兼容的功能性新增
- 修订号：做了向下兼容的问题修正
