#!/bin/bash

echo "🧪 Clash AutoSub - 快速测试启动"
echo "================================"
echo ""

# 检查配置
echo "📋 1. 检查 AI 配置..."
if [ -f ~/.autosub/config.yaml ]; then
    if grep -q "ai:" ~/.autosub/config.yaml; then
        echo "   ✅ AI 配置存在"
        grep -A 4 "ai:" ~/.autosub/config.yaml | sed 's/^/   /'
    else
        echo "   ❌ AI 配置不存在"
        exit 1
    fi
else
    echo "   ❌ 配置文件不存在: ~/.autosub/config.yaml"
    exit 1
fi

echo ""
echo "📋 2. 检查站点配置..."
if grep -q "sites:" ~/.autosub/config.yaml; then
    site_count=$(grep -c "  - id:" ~/.autosub/config.yaml || echo "0")
    echo "   ℹ️  已配置 $site_count 个站点"

    if [ "$site_count" -eq "0" ]; then
        echo ""
        echo "   ⚠️  还没有添加站点，请先添加糖果云站点:"
        echo ""
        echo "   方法 1: 使用交互式菜单"
        echo "   $ node dist/index.js"
        echo "   选择: 2. 配置管理 → 1. 添加站点"
        echo ""
        echo "   方法 2: 手动编辑配置"
        echo "   $ vi ~/.autosub/config.yaml"
        echo ""
        read -p "   是否现在启动交互式菜单? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            node dist/index.js
            exit 0
        else
            exit 0
        fi
    fi
fi

echo ""
echo "📋 3. 检查构建状态..."
if [ -f dist/index.js ]; then
    echo "   ✅ 项目已构建"
else
    echo "   ⚠️  项目未构建，正在构建..."
    npm run build
fi

echo ""
echo "================================"
echo "✅ 准备完成!"
echo ""
echo "🚀 测试选项:"
echo ""
echo "1. 添加/管理站点:"
echo "   $ node dist/index.js"
echo ""
echo "2. 运行自动更新 (已添加站点后):"
echo "   $ node dist/index.js update [站点ID]"
echo "   或"
echo "   $ node dist/index.js update --all"
echo ""
echo "3. 查看状态:"
echo "   $ node dist/index.js status"
echo ""
echo "📚 完整测试指南: TEST_GUIDE.md"
echo ""
