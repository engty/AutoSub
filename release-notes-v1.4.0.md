# v1.4.0 - CLI体验优化与代码清理

## 🚀 功能改进

### CLI命令优化
- **版本号显示修复** - 修复 `--help` 显示版本号为 1.0.0 的问题，现在正确显示当前版本
- **简化update命令** - 移除冗余的 `--silent` 和 `--all` 选项，使命令更简洁
  - `clash-autosub update` - 默认静默模式更新所有站点（< 1秒）
  - `clash-autosub update <siteId>` - 非静默模式更新指定站点

### 菜单文案优化
- **精简菜单文字** - 使主菜单更加简洁易读
  - "订阅站点管理（已保存 3 站点）" → "站点管理（3）"
  - "AI 智能识别设置（已配置）" → "AI 智能识别（已开启|未开启）"
  - "Clash 路径配置（已配置）" → "Clash 配置路径（已配置）"

## 🐛 Bug修复

### localStorage认证支持修复
- **扩展localStorage字段检测** - ApiDetector现在支持检测更多localStorage字段
  - 新增支持：`info`, `userInfo`, `user-info`
  - 支持大写Token字段：`info.Token`（不仅仅是小写`token`）
  - 修复了牛牛云等使用`info.Token`字段的站点无法正确检测认证方式的问题

### HttpApiExtractor凭证验证优化
- **灵活的凭证验证** - 根据`authSource`类型智能验证凭证
  - `cookie`: 只检查cookies是否存在
  - `localStorage`: 只检查localStorage是否存在
  - `both`: 至少需要一个
- **修复强制Cookie问题** - 之前版本错误地要求所有站点必须有Cookie，导致localStorage认证的站点（如牛牛云）无法使用

## 🧹 代码清理

### 移除冗余文件
- 删除所有临时测试文件和文档
  - `test-local.sh`
  - `TEST_REPORT.md`
  - `FINAL_TEST_REPORT.md`
  - `TESTING.md`
  - `tests/` 目录
- 移除未使用的 `vitest` 依赖

## 📝 变更详情

**影响的文件：**
- `src/subscription/api-detector.ts` - 扩展localStorage认证字段检测
- `src/subscription/http-api-extractor.ts` - 修复凭证验证逻辑
- `src/cli/index.ts` - CLI命令优化和菜单文案简化
- `package.json` - 版本更新和依赖清理

**兼容性：**
- ✅ 向后兼容 - 不影响现有Cookie认证站点
- ✅ 修复localStorage认证 - 牛牛云等站点现在可以正常工作
- ✅ 改进用户体验 - 命令更简洁，默认行为更智能
- ✅ 更清晰的代码库 - 移除所有测试相关临时文件

## 📦 安装

```bash
npm install -g clash-autosub@1.4.0
```

或升级：
```bash
npm update -g clash-autosub
```

## 🔄 从v1.3.x升级

直接升级即可，无需额外配置：
```bash
npm update -g clash-autosub
```

所有现有配置和凭证将自动保留并继续工作。
