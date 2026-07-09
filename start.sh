#!/bin/bash
# 党政软件版本管控平台 - 启动脚本

echo "=========================================="
echo "  党政软件版本管控平台"
echo "  GovCode Version Control Platform"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 进入 BFF 目录
cd "$(dirname "$0")/bff" || exit 1

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 安装 BFF 依赖..."
    npm install
fi

# 进入前端目录
cd "../front" || exit 1

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 安装前端依赖..."
    npm install
fi

echo ""
echo "=========================================="
echo "  启动完成！"
echo "=========================================="
echo ""
echo "前端访问地址: http://localhost:3000"
echo "API 服务地址: http://localhost:8080"
echo ""
echo "默认账号:"
echo "  用户名: root"
echo "  密码: admin123"
echo ""
echo "Gitea 地址: http://123.60.219.19:3000"
echo ""
echo "=========================================="
