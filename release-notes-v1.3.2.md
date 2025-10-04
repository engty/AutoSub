# v1.3.2 - localStorage认证支持修复

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

## 📝 变更详情

**影响的文件：**
- `src/subscription/api-detector.ts` - 扩展localStorage认证字段检测
- `src/subscription/http-api-extractor.ts` - 修复凭证验证逻辑

**兼容性：**
- ✅ 向后兼容 - 不影响现有Cookie认证站点
- ✅ 修复localStorage认证 - 牛牛云等站点现在可以正常工作

## 📦 安装

```bash
npm install -g clash-autosub@1.3.2
```

或升级：
```bash
npm update -g clash-autosub
```
