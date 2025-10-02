# 📅 Clash AutoSub 开发计划

**版本**: 1.0
**创建日期**: 2025-10-02
**预计总工期**: 15-22 工作日
**当前状态**: Phase 1 进行中

---

## 🎯 项目目标

开发一个基于 Node.js + TypeScript + Chrome DevTools MCP 的 CLI 自动化工具，解决动态 VPN 订阅地址频繁更新的痛点。

---

## 📊 原始 TODO 分析

### ✅ 优点
1. 模块划分清晰，按层次组织
2. 覆盖 PRD 核心功能
3. 依赖关系合理

### ⚠️ 问题识别
1. **粒度过粗**：单个任务包含多个子模块
2. **缺失模块**：工具函数层、错误处理、测试
3. **依赖不明**：无法识别可并行任务
4. **无时间估算**：难以把控进度

---

## 🏗️ 优化后的 4 阶段开发计划

### Phase 1: 基础设施层 (Foundation)
**目标**: 构建项目基础架构
**工期**: 3-5 工作日
**可并行**: ✅ 所有任务可并行开发

#### 📋 任务清单

| ID | 任务 | 文件 | 估时 | 依赖 | 状态 |
|----|------|------|------|------|------|
| 1.1 | 完善 TypeScript 类型定义 | `src/types/index.ts` | 4h | 无 | 🟡 进行中 |
| 1.2 | 实现工具函数层 | `src/utils/` | 6h | 无 | ⚪ 待开始 |
| 1.3 | 实现配置管理模块 | `src/config/` | 8h | 1.1 | ⚪ 待开始 |

#### 📝 详细说明

**Task 1.1: 完善 TypeScript 类型定义**
- 📁 `src/types/index.ts`
- ⏱️ 4 小时
- 📌 输出：
  - ✅ 扩展现有类型定义
  - ✅ 添加 MCP 响应类型
  - ✅ 添加选择器配置类型
  - ✅ 添加错误类型枚举
  - ✅ 添加命令参数类型

**Task 1.2: 实现工具函数层**
- 📁 `src/utils/logger.ts` - 日志系统 (2h)
  - 控制台彩色输出（chalk）
  - 日志级别（debug/info/warn/error）
  - 文件日志记录
- 📁 `src/utils/crypto.ts` - 加密工具 (2h)
  - AES 加密/解密凭证
  - 密钥管理
- 📁 `src/utils/file.ts` - 文件操作 (2h)
  - 备份文件创建
  - 目录检测和创建
  - 配置文件读写

**Task 1.3: 实现配置管理模块**
- 📁 `src/config/manager.ts` - 配置管理器 (4h)
  - 配置文件加载/保存
  - 配置版本迁移
  - 默认配置生成
- 📁 `src/config/schema.ts` - 配置校验 (2h)
  - YAML schema 定义
  - 配置格式验证
- 📁 `src/config/paths.ts` - 路径管理 (2h)
  - 配置目录：`~/.autosub/`
  - Clash 路径自动检测

#### ✅ 阶段验收标准
- [ ] 所有类型定义无 TypeScript 错误
- [ ] 工具函数有单元测试覆盖
- [ ] 配置管理器可正确加载/保存 YAML
- [ ] 日志系统输出格式统一

---

### Phase 2: 核心引擎层 (Core Engine)
**目标**: 实现 MCP 集成和凭证捕获
**工期**: 5-7 工作日
**关键风险**: MCP 连接稳定性、网络请求拦截准确性

#### 📋 任务清单

| ID | 任务 | 文件 | 估时 | 依赖 | 状态 |
|----|------|------|------|------|------|
| 2.1 | MCP 客户端基础连接 | `src/core/mcp/client.ts` | 6h | 1.1, 1.2 | ⚪ 待开始 |
| 2.2 | 网络请求监听和拦截 | `src/core/mcp/network.ts` | 8h | 2.1 | ⚪ 待开始 |
| 2.3 | Cookie/Storage 捕获 | `src/core/auth/cookie-capture.ts` | 6h | 2.1 | ⚪ 待开始 |
| 2.4 | Token 提取模块 | `src/core/auth/token-extractor.ts` | 8h | 2.2 | ⚪ 待开始 |

#### 📝 详细说明

**Task 2.1: MCP 客户端基础连接**
- 📁 `src/core/mcp/client.ts`
- ⏱️ 6 小时
- 📌 功能：
  - ✅ 连接 Chrome DevTools MCP Server
  - ✅ 实现 `navigatePage(url)` - 打开登录页
  - ✅ 实现 `waitForElement(selector)` - 等待页面加载
  - ✅ 实现 `handleDialog()` - 处理弹窗
  - ✅ 支持 `--isolated=true` 独立浏览器实例
- 🔗 依赖：`@modelcontextprotocol/sdk`

**Task 2.2: 网络请求监听和拦截**
- 📁 `src/core/mcp/network.ts`
- ⏱️ 8 小时
- 📌 功能：
  - ✅ 使用 `list_network_requests` 获取请求列表
  - ✅ 过滤包含 `api|token|subscription` 的请求
  - ✅ 使用 `get_network_request(url)` 获取详情
  - ✅ 解析 JSON 响应体
  - ✅ 提取订阅地址或 Token
- 📊 测试站点：糖果云 API

**Task 2.3: Cookie/Storage 捕获**
- 📁 `src/core/auth/cookie-capture.ts`
- ⏱️ 6 小时
- 📌 功能：
  - ✅ 使用 `evaluate_script` 读取 `document.cookie`
  - ✅ 读取 `localStorage` 和 `sessionStorage`
  - ✅ 序列化为 JSON 格式
  - ✅ 使用 crypto.ts 加密存储
- 🔐 安全：本地加密，密钥由用户设置

**Task 2.4: Token 提取模块**
- 📁 `src/core/auth/token-extractor.ts`
- ⏱️ 8 小时
- 📌 功能：
  - ✅ 从 API 响应体提取 Token
  - ✅ 支持多种 Token 格式（Bearer, Custom Header）
  - ✅ 支持 Token 拼接订阅 URL
  - ✅ 验证 Token 有效性（非空、格式正确）

#### ✅ 阶段验收标准
- [ ] MCP 客户端可稳定连接
- [ ] 成功捕获糖果云登录凭证
- [ ] 网络请求拦截准确率 > 95%
- [ ] 凭证加密存储可靠

---

### Phase 3: 业务逻辑层 (Business Logic)
**目标**: 实现订阅抓取、验证和更新
**工期**: 4-6 工作日
**关键功能**: 智能部分更新机制

#### 📋 任务清单

| ID | 任务 | 文件 | 估时 | 依赖 | 状态 |
|----|------|------|------|------|------|
| 3.1 | 订阅抓取 - API 模式 | `src/core/scraper/api-mode.ts` | 6h | 2.2, 2.4 | ⚪ 待开始 |
| 3.2 | 订阅抓取 - DOM 模式 | `src/core/scraper/dom-mode.ts` | 6h | 2.1 | ⚪ 待开始 |
| 3.3 | 订阅地址验证 | `src/core/validator/subscription.ts` | 6h | 无 | ⚪ 待开始 |
| 3.4 | Clash 配置更新 | `src/core/updater/clash.ts` | 8h | 1.3, 3.3 | ⚪ 待开始 |
| 3.5 | 智能部分更新机制 | `src/core/updater/partial-update.ts` | 6h | 3.4 | ⚪ 待开始 |

#### 📝 详细说明

**Task 3.1: 订阅抓取 - API 模式（优先）**
- 📁 `src/core/scraper/api-mode.ts`
- ⏱️ 6 小时
- 📌 策略：
  - ✅ 监听包含订阅地址的 API 响应
  - ✅ 支持 GET/POST 请求解析
  - ✅ 处理分页 API（如果需要）
  - ✅ 错误处理和重试（3次）

**Task 3.2: 订阅抓取 - DOM 模式（备用）**
- 📁 `src/core/scraper/dom-mode.ts`
- ⏱️ 6 小时
- 📌 策略：
  - ✅ 使用 `take_snapshot` 获取页面文本
  - ✅ 使用 `evaluate_script` 查找订阅按钮
  - ✅ 支持多重选择器（优先级数组）
  - ✅ 从 GitHub 加载选择器配置

**Task 3.3: 订阅地址验证**
- 📁 `src/core/validator/subscription.ts`
- ⏱️ 6 小时
- 📌 验证规则：
  - ✅ HTTP 状态码 = 200
  - ✅ 内容包含 `proxies` 或 `proxy-groups`
  - ✅ YAML 格式解析成功
  - ✅ 节点数量 > 0
  - ✅ 超时时间：10秒
- 🚫 失败不允许强制更新

**Task 3.4: Clash 配置更新**
- 📁 `src/core/updater/clash.ts`
- ⏱️ 8 小时
- 📌 功能：
  - ✅ 读取 Clash YAML 配置
  - ✅ 定位 `proxy-providers` 部分
  - ✅ 更新对应站点的 `url` 字段
  - ✅ 自动备份（保留 5 个版本）
  - ✅ 更新失败自动回滚

**Task 3.5: 智能部分更新机制**
- 📁 `src/core/updater/partial-update.ts`
- ⏱️ 6 小时
- 📌 核心逻辑：
  - ✅ 逐个站点获取订阅地址
  - ✅ 验证每个订阅地址
  - ✅ 成功的更新，失败的保留原配置
  - ✅ 生成更新报告（成功/失败明细）

#### ✅ 阶段验收标准
- [ ] API 模式成功率 > 90%
- [ ] DOM 模式作为备用可用
- [ ] 订阅验证无误判
- [ ] 部分更新零配置损坏
- [ ] 备份和回滚功能正常

---

### Phase 4: 用户界面层 (User Interface)
**目标**: 实现 CLI 交互界面
**工期**: 3-4 工作日
**重点**: ZCF 风格的向导式体验

#### 📋 任务清单

| ID | 任务 | 文件 | 估时 | 依赖 | 状态 |
|----|------|------|------|------|------|
| 4.1 | 交互式配置向导 | `src/cli/commands/setup.ts` | 8h | Phase 1-3 全部 | ⚪ 待开始 |
| 4.2 | 更新命令处理器 | `src/cli/commands/update.ts` | 6h | Phase 3 | ⚪ 待开始 |
| 4.3 | 状态查看命令 | `src/cli/commands/status.ts` | 4h | 1.3 | ⚪ 待开始 |
| 4.4 | 定时任务配置 | `src/cli/commands/cron.ts` | 6h | 4.2 | ⚪ 待开始 |
| 4.5 | 主交互式菜单 | `src/cli/menu.ts` | 6h | 4.1-4.4 | ⚪ 待开始 |

#### 📝 详细说明

**Task 4.1: 交互式配置向导 (`setup` 命令)**
- 📁 `src/cli/commands/setup.ts`
- ⏱️ 8 小时
- 📌 流程（借鉴 ZCF）：
  1. 欢迎界面（Chalk 彩色输出）
  2. 检测 Clash 配置路径（自动 + 手动）
  3. 选择预定义站点或自定义
  4. 打开 MCP 浏览器，等待手动登录
  5. 捕获凭证并保存
  6. 验证订阅地址
  7. 完成提示和下一步建议
- 🎨 组件：Inquirer.js + Ora + Chalk

**Task 4.2: 更新命令处理器 (`update` 命令)**
- 📁 `src/cli/commands/update.ts`
- ⏱️ 6 小时
- 📌 功能：
  - ✅ `autosub update` - 更新所有站点
  - ✅ `autosub update <站点名>` - 更新指定站点
  - ✅ `--silent` 静默模式（Cron 使用）
  - ✅ 进度条显示（Ora）
  - ✅ 更新报告表格（cli-table3）

**Task 4.3: 状态查看命令 (`status` 命令)**
- 📁 `src/cli/commands/status.ts`
- ⏱️ 4 小时
- 📌 显示内容：
  - ✅ 配置站点列表
  - ✅ 最后更新时间
  - ✅ 订阅地址状态（有效/失效）
  - ✅ Clash 配置路径
  - ✅ 定时任务状态

**Task 4.4: 定时任务配置 (`cron` 命令)**
- 📁 `src/cli/commands/cron.ts`
- ⏱️ 6 小时
- 📌 功能：
  - ✅ `autosub cron` - 设置定时更新
  - ✅ 自动配置 Crontab (macOS/Linux)
  - ✅ 配置 Task Scheduler (Windows)
  - ✅ 删除定时任务
  - ✅ 查看定时任务状态

**Task 4.5: 主交互式菜单**
- 📁 `src/cli/menu.ts`
- ⏱️ 6 小时
- 📌 菜单选项：
  1. 🚀 更新订阅地址
  2. ⚙️  配置新站点
  3. 📊 查看状态
  4. ⏰ 设置定时任务
  5. 🔄 刷新凭证（重新登录）
  6. ❌ 退出
- 🎨 使用 Inquirer.js list 类型

#### ✅ 阶段验收标准
- [ ] 配置向导流程顺畅
- [ ] 所有命令运行无错误
- [ ] CLI 输出美观（彩色、表格、进度条）
- [ ] 定时任务配置成功

---

## 📊 开发进度追踪

### 当前状态
- ✅ **已完成**：0/17 任务 (0%)
- 🟡 **进行中**：1/17 任务 (Phase 1.1)
- ⚪ **待开始**：16/17 任务

### 时间估算
| 阶段 | 任务数 | 总工时 | 工作日 | 状态 |
|------|--------|--------|--------|------|
| Phase 1 | 3 | 18h | 3-5天 | 🟡 进行中 |
| Phase 2 | 4 | 28h | 5-7天 | ⚪ 待开始 |
| Phase 3 | 5 | 32h | 4-6天 | ⚪ 待开始 |
| Phase 4 | 5 | 30h | 3-4天 | ⚪ 待开始 |
| **总计** | **17** | **108h** | **15-22天** | - |

---

## 🚨 风险与缓解

### 高风险项
1. **MCP 连接稳定性** (Phase 2.1)
   - 缓解：提前测试 Chrome DevTools MCP，准备 Playwright 备用方案

2. **网络请求拦截准确性** (Phase 2.2)
   - 缓解：使用糖果云真实环境测试，记录所有 API 模式

3. **订阅地址验证误判** (Phase 3.3)
   - 缓解：多重验证规则，提供手动强制更新选项（仅开发模式）

### 中风险项
1. **Clash 配置更新兼容性** (Phase 3.4)
   - 缓解：支持多版本 Clash YAML 格式

2. **定时任务跨平台兼容** (Phase 4.4)
   - 缓解：分别实现 Cron (macOS/Linux) 和 Task Scheduler (Windows)

---

## 🎯 里程碑

### Milestone 1: 基础设施完成 (Day 5)
- [ ] 所有类型定义完成
- [ ] 工具函数层可用
- [ ] 配置管理模块通过测试

### Milestone 2: 核心引擎完成 (Day 12)
- [ ] MCP 客户端稳定连接
- [ ] 成功捕获凭证
- [ ] Token 提取成功率 > 90%

### Milestone 3: 业务逻辑完成 (Day 18)
- [ ] 订阅地址抓取成功
- [ ] 验证机制可靠
- [ ] Clash 配置更新无损坏

### Milestone 4: MVP 发布 (Day 22)
- [ ] 所有 CLI 命令可用
- [ ] 配置向导流程完整
- [ ] 通过端到端测试

---

## 🔄 迭代策略

### 迭代 1: 垂直切片（推荐优先）
**目标**: 快速验证技术可行性

1. **Day 1-2**: Phase 1.1 + 1.2（类型 + 工具）
2. **Day 3-5**: Phase 2.1 + 2.3（MCP 连接 + Cookie 捕获）
3. **Day 6-7**: Phase 3.1 + 3.3（API 抓取 + 验证）
4. **Day 8-9**: Phase 3.4（Clash 更新）
5. **Day 10**: Phase 4.2（update 命令）

✅ **验收**: 端到端流程走通，可手动更新一个站点

### 迭代 2: 功能完善
**目标**: 补全剩余功能

6. **Day 11-12**: Phase 2.2 + 2.4（网络拦截 + Token）
7. **Day 13-14**: Phase 3.2 + 3.5（DOM 模式 + 部分更新）
8. **Day 15-16**: Phase 4.1 + 4.3（setup + status）
9. **Day 17-18**: Phase 4.4 + 4.5（cron + 菜单）
10. **Day 19-22**: 测试 + 文档 + 发布

---

## 📝 开发规范

### 代码规范
- ✅ ESM 模块（`import/export`）
- ✅ TypeScript strict 模式
- ✅ 遵循 SOLID 原则
- ✅ 单一职责：每个文件只做一件事

### 提交规范（Conventional Commits）
- `feat:` 新功能
- `fix:` 修复 bug
- `refactor:` 重构
- `docs:` 文档更新
- `test:` 测试相关

### 测试要求
- 工具函数层：单元测试覆盖率 > 80%
- 核心模块：集成测试必须通过
- CLI 命令：端到端测试

---

## 🚀 下一步行动

### 立即开始
1. **完成 Phase 1.1** (当前任务)
   - 扩展 `src/types/index.ts`
   - 添加 MCP 响应类型、选择器配置类型

2. **准备 Phase 1.2**
   - 创建 `src/utils/` 目录
   - 参考 ZCF 的 logger 实现

### 建议工作流
```bash
# 1. 切换到 Dev 代理
*agent dev

# 2. 开始编码
npm run dev  # 开发模式

# 3. 测试
npm run typecheck  # 类型检查
npm run test       # 运行测试

# 4. 构建
npm run build      # 编译 TypeScript
```

---

## 📚 参考资源

### 技术文档
- [Chrome DevTools MCP 文档](https://github.com/modelcontextprotocol/servers/tree/main/src/chrome-devtools)
- [Inquirer.js 示例](https://github.com/SBoudrias/Inquirer.js/tree/master/packages/inquirer/examples)
- [ZCF 项目参考](https://github.com/zerocloude/zcf)

### 内部文档
- PRD: `docs/prd.md`
- 架构文档: `docs/architecture.md`
- 项目简报: `docs/project-brief.md`

---

**最后更新**: 2025-10-02
**维护者**: BMad Orchestrator
