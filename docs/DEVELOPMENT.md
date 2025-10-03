# 开发守则

## ESM 模块导入规范（重要！）

### ❌ 错误做法

在 TypeScript ESM 项目中，**禁止**使用以下导入方式：

```typescript
// ❌ 错误：会导致运行时错误 "xxx.existsSync is not a function"
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

fs.existsSync('/path');  // 运行时错误！需要 fs.default.existsSync
```

### ✅ 正确做法

**始终使用默认导入**：

```typescript
// ✅ 正确
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

fs.existsSync('/path');  // 正常工作
```

### 📋 原因说明

- TypeScript 编译时 `import * as` 会创建命名空间对象
- 当导入的是 CommonJS 模块时，实际内容在 `.default` 属性下
- 使用默认导入可以避免访问 `.default` 的问题
- 特别注意：`fs-extra`、`path`、`os`、`inquirer` 等常用库都需要默认导入

### 🔍 检查清单

每次使用以下模块时，必须检查导入方式：

- ✅ `import fs from 'fs-extra'`
- ✅ `import path from 'path'`
- ✅ `import os from 'os'`
- ✅ `import inquirer from 'inquirer'`
- ✅ `import chalk from 'chalk'`
- ✅ `import yaml from 'js-yaml'`

### 动态导入规范

如果必须使用动态导入（如在函数内部），使用解构赋值：

```typescript
// ✅ 正确的动态导入
const { default: fs } = await import('fs-extra');
const { default: path } = await import('path');
const { default: os } = await import('os');
```

## 代码质量原则

### KISS (Keep It Simple, Stupid)
- 追求代码和设计的极致简洁
- 拒绝不必要的复杂性
- 优先选择最直观的解决方案

### YAGNI (You Aren't Gonna Need It)
- 仅实现当前明确所需的功能
- 抵制过度设计和未来特性预留
- 删除未使用的代码和依赖

### DRY (Don't Repeat Yourself)
- 自动识别重复代码模式
- 主动建议抽象和复用
- 统一相似功能的实现方式

### SOLID 原则
- **S**：确保单一职责，拆分过大的组件
- **O**：设计可扩展接口，避免修改现有代码
- **L**：保证子类型可替换父类型
- **I**：接口专一，避免"胖接口"
- **D**：依赖抽象而非具体实现

## Git 提交规范

### Conventional Commits

格式：`<type>(<scope>): <subject>`

**类型（type）**：
- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 重构（不改变功能）
- `perf`: 性能优化
- `style`: 代码格式（不影响代码运行）
- `docs`: 文档更新
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动
- `ci`: CI 配置变更
- `revert`: 回滚提交

**作用域（scope）**：
- `cli`: 命令行界面
- `puppeteer`: 浏览器自动化
- `config`: 配置管理
- `subscription`: 订阅提取
- `clash`: Clash 配置更新
- `types`: 类型定义

### 提交信息要求

1. **标题**：
   - 不超过 72 字符
   - 使用中文
   - 祈使语气（"添加"而非"添加了"）

2. **正文**：
   - 说明改动的原因
   - 列出主要变更点
   - 注明影响范围
   - 标注破坏性变更

3. **示例**：
```
feat(puppeteer): 添加智能登录检测

- 支持 URL 变化检测
- 支持元素出现检测
- 支持网络请求检测
- 最长等待 120 秒

影响：提升用户体验，实现真正的自动化
```

## 错误处理规范

### 自定义错误

使用 `AutoSubError` 类，必须提供：
- `ErrorCode`: 明确的错误代码
- `message`: 清晰的错误信息（中文）
- `details`: 详细的错误上下文（可选）

```typescript
throw new AutoSubError(
  ErrorCode.BROWSER_LAUNCH_FAILED,
  `浏览器启动失败: ${error.message}`,
  error
);
```

### 日志规范

- `logger.debug()`: 调试信息（开发环境）
- `logger.info()`: 关键流程节点
- `logger.warn()`: 警告（不影响主流程）
- `logger.error()`: 错误（影响功能）

## 测试规范

### 单元测试

- 每个工具类必须有对应的测试文件
- 测试覆盖率目标：80%+
- 使用描述性的测试名称

### 集成测试

- 测试完整的用户流程
- 模拟真实使用场景
- 验证错误处理逻辑

## 文档规范

### 代码注释

- 所有导出的类、接口、函数必须有 JSDoc 注释
- 注释使用中文
- 说明参数、返回值、异常

```typescript
/**
 * 智能检测用户登录状态
 * @param page - Puppeteer 页面实例
 * @param siteConfig - 站点配置
 * @param timeout - 超时时间（毫秒），默认 120000
 * @throws {AutoSubError} 登录检测超时或失败
 */
async waitForLogin(page: Page, siteConfig: SiteConfig, timeout?: number): Promise<void>
```

### README 文档

- 保持技术栈信息最新
- 提供清晰的使用示例
- 列出常见问题解决方案

## 性能优化

### 构建优化

- 使用 tree-shaking 移除未使用代码
- 按需导入第三方库
- 避免打包大型依赖

### 运行时优化

- 使用系统 Chrome 而非下载 Chromium
- 实施 Cookie 持久化减少登录次数
- 智能缓存配置和订阅数据

## 安全规范

### 敏感数据处理

- 加密存储凭证信息
- 不在日志中输出敏感数据
- 使用环境变量管理密钥

### 依赖安全

- 定期运行 `npm audit`
- 及时更新有安全漏洞的依赖
- 锁定核心依赖版本
