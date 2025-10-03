# 🧪 AI 智能识别功能测试指南

## 测试目标

验证 AI 能够智能识别糖果云站点的"复制订阅链接"按钮,完成完整的自动化订阅流程。

---

## 📋 测试前准备

### 1. 确认配置
```bash
cat ~/.autosub/config.yaml
```

应该看到:
```yaml
ai:
  enabled: true
  provider: deepseek
  apiKey: sk-a18863b846854e8e8a84b0fecd7cebc0
  model: deepseek-chat
```

✅ **状态**: AI 配置已就绪

### 2. 检查项目构建
```bash
npm run build
```

应该输出: `⚡️ Build success`

---

## 🚀 测试步骤

### 测试 1: 添加糖果云站点

**方法 1: 使用交互式菜单 (推荐)**

```bash
node dist/index.js
```

按照提示操作:
```
1. 选择: 2. 配置管理（添加·编辑·删除站点）
2. 选择: 1. 添加站点
3. 输入站点名称: 糖果云
4. 输入网址: https://candytally.xyz/web/#/login
5. 选择获取方式: 1. 自动获取（推荐）
```

**方法 2: 手动编辑配置文件**

编辑 `~/.autosub/config.yaml`:
```yaml
sites:
  - id: tangguo
    name: 糖果云
    url: https://candytally.xyz/web/#/login
    credentials:
      cookies: ''
      localStorage: ''
      sessionStorage: ''
      tokens: ''
    lastUpdate: ''
    subscriptionUrl: ''
    extractionMode: api  # 使用 API 模式触发 AI 识别
    enabled: true
```

---

### 测试 2: 运行自动更新

```bash
node dist/index.js update tangguo
```

**预期流程:**

#### 阶段 1: 浏览器启动和登录
```
[INFO] [API 模式] 开始提取订阅地址: 糖果云
[INFO] 打开页面: https://candytally.xyz/web/#/login
⏳ 请在浏览器中完成登录操作...
   系统将自动检测登录完成状态
```

**👉 操作**: 在打开的浏览器中手动登录糖果云账号

#### 阶段 2: 登录检测成功
```
[INFO] ✓ 检测到登录完成(通用检测(URL Hash变化)) - 用时 XX.X秒
✅ 登录成功! (检测方式: 通用检测(URL Hash变化))
[DEBUG] 尝试关闭广告弹窗...
[DEBUG] ✓ 广告弹窗处理完成
```

#### 阶段 3: AI 智能识别按钮 ⭐️
```
[INFO] 寻找并点击"复制链接"按钮...
[INFO] 🤖 使用 AI DOM 结构分析识别按钮...
[DEBUG] 找到 XX 个可见按钮
[INFO] 🤖 使用 AI 分析 DOM 结构,识别"复制订阅链接"按钮...
[INFO] ✓ AI 识别成功: 复制订阅链接按钮(位于一键订阅卡片)
[INFO]   选择器: button.copy-link-btn
[INFO]   置信度: 0.95
[INFO] ✓ 已点击 AI 识别的按钮
```

#### 阶段 4: 订阅地址提取
```
[DEBUG] 找到 X 个订阅相关请求
[DEBUG] 通过常见模式找到: https://sub.candytally.xyz/api/v1/client/subscribe?token=xxx
[INFO] ✓ 成功提取订阅地址: https://sub.candytally.xyz/...
```

#### 阶段 5: 完成
```
📊 更新结果:
✅ tangguo
   节点数量: XX
   订阅地址: https://sub.candytally.xyz/...
```

---

### 测试 3: 验证配置更新

```bash
cat ~/.autosub/config.yaml
```

应该看到 `subscriptionUrl` 已填充:
```yaml
sites:
  - id: tangguo
    name: 糖果云
    subscriptionUrl: https://sub.candytally.xyz/api/v1/client/subscribe?token=xxx
    lastUpdate: '2025-10-02T...'
```

---

## 🔍 故障排查

### 问题 1: AI 识别失败

**症状:**
```
[WARN] AI 识别置信度过低或未找到: 0.3
[WARN] AI 识别失败,回退到传统方法
[WARN] 未找到"复制链接"按钮，将尝试从现有请求中提取
```

**可能原因:**
1. 页面结构与预期不符
2. AI 返回的按钮选择器不正确
3. API 请求失败

**解决方法:**
```bash
# 查看详细日志
LOG_LEVEL=debug node dist/index.js update tangguo

# 检查 AI API 是否正常
curl -X POST https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-a18863b846854e8e8a84b0fecd7cebc0" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Hello"}]}'
```

### 问题 2: 登录检测超时

**症状:**
```
[ERROR] 登录检测失败
Error: 登录检测超时,请重试
```

**解决方法:**
1. 确保在浏览器中完成登录
2. 检查是否有广告弹窗阻挡
3. 手动按 ESC 键关闭弹窗

### 问题 3: 未找到订阅地址

**症状:**
```
[ERROR] 提取订阅地址失败
AutoSubError: 未能找到订阅地址,请检查站点配置或网络请求
```

**解决方法:**
1. 检查网络请求捕获是否正常
2. 尝试手动点击"复制链接"按钮,观察是否有 API 请求
3. 使用浏览器开发者工具查看网络请求

---

## 📊 测试结果记录

### 测试执行记录

| 测试项 | 状态 | 耗时 | 备注 |
|--------|------|------|------|
| 浏览器启动 | ⬜ | - | |
| 用户登录 | ⬜ | - | |
| 登录检测 | ⬜ | - | |
| 广告关闭 | ⬜ | - | |
| AI 按钮识别 | ⬜ | - | |
| 按钮点击 | ⬜ | - | |
| API 请求捕获 | ⬜ | - | |
| 订阅地址提取 | ⬜ | - | |

**符号说明:**
- ✅ 通过
- ❌ 失败
- ⚠️ 警告
- ⬜ 待测试

### AI 识别详情

- **识别的按钮文本**: `________________`
- **识别的选择器**: `________________`
- **置信度**: `____`
- **是否回退到传统方法**: `□ 是  □ 否`

---

## 💡 高级测试

### 测试 AI 配置切换

#### 测试 OpenRouter 提供商

1. 修改配置:
```bash
node dist/index.js
# 选择: 2. 配置管理
# 选择: 4. AI 智能识别设置
# 选择: 2. 配置 AI 提供商
# 选择提供商: OpenRouter
# 输入 API 密钥
```

2. 重新测试更新流程

#### 测试禁用 AI

1. 禁用 AI:
```bash
node dist/index.js
# 选择: 2. 配置管理
# 选择: 4. AI 智能识别设置
# 选择: 1. 启用/禁用 AI 识别
# 选择: No
```

2. 观察是否回退到传统文本匹配:
```
[INFO] 寻找并点击"复制链接"按钮...
[INFO] ✓ 找到"复制链接"按钮: "复制链接" (title: "")
[INFO] ✓ 已点击"复制链接"按钮
```

---

## 📝 测试完成检查清单

- [ ] AI 配置正确加载
- [ ] 站点添加成功
- [ ] 浏览器正常启动
- [ ] 登录检测工作正常
- [ ] 广告自动关闭
- [ ] AI 成功识别按钮
- [ ] 按钮点击成功
- [ ] 网络请求被捕获
- [ ] 订阅地址成功提取
- [ ] 配置文件正确更新
- [ ] API 密钥安全保存(不在 Git 中)

---

## 🎯 预期最终结果

运行 `node dist/index.js status` 应该看到:

```
📊 系统状态:

✅ Clash 配置: [你的配置路径]
✅ 订阅站点: 1 个

站点状态:

糖果云: 🟢 已配置
  最后更新: 2025-10-02 XX:XX:XX
  状态: 已启用
```

运行 `node dist/index.js` → `5. 查看配置` 应该看到:

```
📋 当前配置:

Clash 配置文件: [路径]
订阅站点数量: 1
AI 智能识别: 已启用
  提供商: DeepSeek
  模型: deepseek-chat

站点列表:

1. 糖果云
   网址: https://candytally.xyz/web/#/login
   获取方式: 自动获取
   订阅地址: https://sub.candytally.xyz/api/v1/client/subscribe?token=xxx
```

---

## 🚨 重要提醒

1. **API 密钥安全**:
   - 配置文件在 `~/.autosub/config.yaml`
   - 已添加到 `.gitignore`
   - 不要分享配置文件或提交到 Git

2. **浏览器会话**:
   - Chrome 配置文件保存在 `~/.autosub/chrome-profile`
   - 包含登录状态和 Cookie
   - 下次运行时会自动登录

3. **测试环境**:
   - 确保网络畅通
   - 确保糖果云账号有效
   - 建议在测试环境中先验证

---

## 📞 遇到问题?

如果测试过程中遇到问题,请提供:

1. 完整的错误日志
2. AI 识别的详细输出
3. 浏览器截图(如果可能)
4. `~/.autosub/config.yaml` 内容(隐藏 API 密钥)

祝测试顺利!🎉
