#!/bin/bash

# AutoSub v1.3.1 本地测试脚本

echo "================================"
echo "AutoSub v1.3.1 本地测试"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 构建项目
echo -e "${YELLOW}步骤 1: 构建项目...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 构建成功${NC}"
echo ""

# 2. 创建全局链接
echo -e "${YELLOW}步骤 2: 创建全局链接...${NC}"
npm link
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 链接创建失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 全局链接创建成功${NC}"
echo ""

# 3. 显示测试选项
echo -e "${YELLOW}测试选项：${NC}"
echo ""
echo "A. 测试静默更新（会自动刷新过期Cookie）"
echo "   命令: autosub update --all --silent"
echo ""
echo "B. 测试交互菜单（选择'4. 更新订阅 -> 1. 更新所有站点'）"
echo "   命令: autosub"
echo ""
echo "C. 测试单个站点更新"
echo "   命令: autosub update <站点ID> --silent"
echo ""
echo "D. 测试headless刷新Cookie"
echo "   命令: autosub refresh-credentials --headless --all"
echo ""
echo "E. 查看站点状态"
echo "   命令: autosub status"
echo ""

# 4. 等待用户选择
echo -e "${YELLOW}请选择测试选项 [A/B/C/D/E] 或按 Ctrl+C 退出:${NC}"
read -r choice

case $choice in
    [Aa])
        echo -e "${GREEN}执行: autosub update --all --silent${NC}"
        autosub update --all --silent
        ;;
    [Bb])
        echo -e "${GREEN}执行: autosub${NC}"
        autosub
        ;;
    [Cc])
        echo -e "${YELLOW}请输入站点ID:${NC}"
        read -r site_id
        echo -e "${GREEN}执行: autosub update $site_id --silent${NC}"
        autosub update "$site_id" --silent
        ;;
    [Dd])
        echo -e "${GREEN}执行: autosub refresh-credentials --headless --all${NC}"
        autosub refresh-credentials --headless --all
        ;;
    [Ee])
        echo -e "${GREEN}执行: autosub status${NC}"
        autosub status
        ;;
    *)
        echo -e "${RED}无效选项${NC}"
        exit 1
        ;;
esac

# 5. 测试完成提示
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}测试完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${YELLOW}要取消全局链接，运行:${NC}"
echo "  npm unlink -g clash-autosub"
echo ""
