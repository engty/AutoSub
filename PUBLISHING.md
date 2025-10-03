# Clash AutoSub 发布指南

## 📦 包信息

- **npm 包名**: `clash-autosub`
- **当前版本**: 1.0.0
- **包链接**: https://www.npmjs.com/package/clash-autosub
- **GitHub**: https://github.com/engty/clash-autosub

## 🚀 用户安装方式

### 方式 1：npx 直接运行（推荐）

```bash
npx clash-autosub
```

### 方式 2：全局安装

```bash
npm install -g clash-autosub

# 使用主命令
clash-autosub --version

# 使用别名
autosub --version
```

## 📝 发布流程记录

### 1. 准备阶段

- ✅ 检查包名可用性：`clash-autosub` 可用
- ✅ 设置 npm 官方源：`https://registry.npmjs.org/`
- ✅ 项目重命名：`autosub` → `clash-autosub`
- ✅ GitHub 仓库重命名完成

### 2. 构建阶段

```bash
# TypeScript 构建
npm run build

# 本地打包测试
npm pack

# 全局安装测试
npm install -g ./clash-autosub-1.0.0.tgz
```

### 3. 发布阶段

```bash
# 登录 npm
npm login

# 发布公共包
npm publish --access public
```

### 4. 验证阶段

```bash
# 查看包信息
npm view clash-autosub

# 测试全球安装
npx clash-autosub@latest --version
```

## 🔄 版本更新流程

### 升级版本号

```bash
# 补丁版本（1.0.0 → 1.0.1）
npm version patch

# 次要版本（1.0.0 → 1.1.0）
npm version minor

# 主要版本（1.0.0 → 2.0.0）
npm version major
```

### 发布新版本

```bash
# 1. 构建
npm run build

# 2. 提交代码
git add .
git commit -m "chore: release v1.x.x"
git push

# 3. 发布到 npm
npm publish

# 4. 创建 Git 标签（可选）
git tag v1.x.x
git push --tags
```

## 📊 包统计

- **包体积**: 9.9 KB
- **依赖数量**: 10 个
- **文件数量**: 6 个
- **支持命令**: `clash-autosub`, `autosub`

## 🔗 相关链接

- npm 包: https://www.npmjs.com/package/clash-autosub
- GitHub: https://github.com/engty/clash-autosub
- Issues: https://github.com/engty/clash-autosub/issues
- PRD 文档: [docs/prd.md](./docs/prd.md)

## 🛠️ 维护者信息

- **作者**: engty
- **许可证**: MIT
- **联系方式**: 请通过 GitHub Issues 联系
