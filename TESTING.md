# v1.3.1 本地测试指南

## 快速测试（使用测试脚本）

```bash
./test-local.sh
```

测试脚本会自动：
1. 构建项目
2. 创建全局链接
3. 提供测试选项菜单

## 手动测试步骤

### 步骤1: 构建并安装到全局

```bash
# 构建项目
npm run build

# 创建全局链接
npm link
```

### 步骤2: 测试核心功能

#### 🎯 重点测试：Cookie过期自动刷新

这是v1.3.1的核心改进功能。

**测试方法：**

```bash
# 方式1: 使用静默模式更新所有站点
autosub update --all --silent

# 方式2: 使用交互菜单（选择"4. 更新订阅 -> 1. 更新所有站点"）
autosub
```

**预期行为：**

如果Cookie已过期：
```
[INFO] 检测到API配置，尝试静默HTTP提取...
[INFO] API 响应状态: 403
[INFO] API 响应数据: {"status": "fail", "message": "未登录或登陆已过期", ...}
[WARN] 检测到Cookie已过期，尝试自动刷新...
[INFO] 正在为 红杏云 自动刷新Cookie（headless模式）...
[INFO] ✓ Cookie刷新成功
[INFO] Cookie刷新成功，重试HTTP API提取...
[INFO] ✓ HTTP API静默提取成功（刷新后）
```

如果Cookie有效：
```
[INFO] 检测到API配置，尝试静默HTTP提取...
[INFO] API 响应状态: 200
[INFO] ✓ HTTP API静默提取成功
```

#### 其他功能测试

```bash
# 1. 查看站点状态
autosub status

# 2. 测试单个站点更新
autosub update <站点ID> --silent

# 3. 手动刷新Cookie（headless模式）
autosub refresh-credentials --headless --all

# 4. 查看帮助信息
autosub --help
autosub update --help
```

### 步骤3: 验证错误处理

#### 测试场景1: Cookie过期且无法刷新

如果站点无法访问或登录页面结构变化：

**预期输出：**
```
[ERROR] 自动刷新Cookie失败
❌ 更新失败: Cookie已过期且自动刷新失败: [具体错误信息]
```

#### 测试场景2: 缺少凭证文件

删除某个站点的凭证文件后测试：

```bash
rm ~/.autosub/credentials/<站点ID>.json
autosub update <站点ID> --silent
```

**预期输出：**
```
❌ 更新失败: 缺少凭证文件，静默模式下无法重新获取。请运行: autosub refresh-credentials --headless
```

#### 测试场景3: 订阅地址无效

**预期输出：**
```
❌ 更新失败: 已保存的订阅地址无效，静默模式下无法使用浏览器重新获取。请运行: autosub add 重新配置站点
```

### 步骤4: 测试完成后清理

```bash
# 取消全局链接
npm unlink -g clash-autosub
```

## 调试技巧

### 查看详细日志

日志文件位置：`~/.autosub/logs/`

```bash
# 查看最新日志
tail -f ~/.autosub/logs/autosub-$(date +%Y-%m-%d).log

# 或者使用less查看
less ~/.autosub/logs/autosub-$(date +%Y-%m-%d).log
```

### 手动触发Cookie过期测试

如果想强制测试Cookie过期场景：

1. 备份当前凭证：
```bash
cp ~/.autosub/credentials/<站点ID>.json ~/.autosub/credentials/<站点ID>.json.bak
```

2. 修改Cookie过期时间（使其立即过期）：
```bash
# 编辑凭证文件，将所有cookie的expires字段改为过去的时间戳
# 例如：将 1735747200 改为 1000000000
```

3. 运行测试：
```bash
autosub update <站点ID> --silent
```

4. 恢复凭证：
```bash
mv ~/.autosub/credentials/<站点ID>.json.bak ~/.autosub/credentials/<站点ID>.json
```

## 成功标准

✅ **v1.3.1测试通过标准：**

1. Cookie有效时，静默更新直接成功（< 2秒完成）
2. Cookie过期时，自动触发headless刷新，然后更新成功
3. Cookie刷新失败时，显示明确的错误信息和解决方案
4. 缺少凭证时，显示正确的CLI命令提示
5. 订阅地址无效时，提示重新配置站点
6. 日志输出清晰，能够追踪整个流程
7. 不会弹出浏览器窗口（headless模式）

## 回归测试

确保v1.3.1没有破坏现有功能：

```bash
# 1. 标准模式（非静默）仍然正常工作
autosub update --all

# 2. 交互菜单所有选项正常
autosub

# 3. 添加新站点功能正常
autosub add

# 4. 查看配置功能正常
autosub config

# 5. 手动刷新Cookie功能正常（有头模式）
autosub refresh-credentials --all
```

## 常见问题

### Q: npm link失败
```bash
# 可能需要sudo权限
sudo npm link
```

### Q: 命令找不到
```bash
# 检查全局node_modules路径
npm config get prefix

# 确保该路径在你的PATH中
echo $PATH
```

### Q: 想直接测试不安装
```bash
# 使用node直接运行
node dist/index.js update --all --silent

# 或使用tsx运行源码（开发模式）
npx tsx src/cli/index.ts update --all --silent
```
