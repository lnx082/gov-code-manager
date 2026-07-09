#!/bin/bash

# ===========================================
# 党政软件版本管控平台 - 部署脚本
# 适用于后端服务器 (123.60.219.19)
# ===========================================

set -e

echo "=========================================="
echo "  党政软件版本管控平台 - 部署脚本"
echo "=========================================="
echo ""

# 配置变量
BFF_DIR="/home/git/gov-code-manager/bff"
DB_HOST="123.60.219.19"
DB_PORT="5432"
DB_NAME="gov_code_manager"
DB_USER="dev_admin"
DB_PASSWORD="Besti@2026_db"
GITEA_URL="http://123.60.219.19:3000"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数定义
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    log_info "Node.js 版本: $(node -v)"
}

# 检查 npm
check_npm() {
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    log_info "npm 版本: $(npm -v)"
}

# 安装 BFF 依赖
install_bff_deps() {
    log_info "安装 BFF 服务依赖..."
    cd "$BFF_DIR"
    npm install
    log_info "依赖安装完成"
}

# 配置 BFF 环境变量
configure_bff() {
    log_info "配置 BFF 环境变量..."
    cat > "$BFF_DIR/.env" << EOF
PORT=8080
NODE_ENV=production

DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

GITEA_URL=$GITEA_URL
GITEA_API_VERSION=v1

JWT_SECRET=gov_code_manager_jwt_secret_key_2024_secure_production
JWT_EXPIRES_IN=7d

AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=3650

BFF_API_PREFIX=/api/bff
EOF
    log_info "环境变量配置完成"
}

# 运行数据库迁移
run_migrate() {
    log_info "运行数据库迁移..."
    cd "$BFF_DIR"
    npm run migrate
    log_info "数据库迁移完成"
}

# 填充种子数据
run_seed() {
    log_info "填充初始数据..."
    cd "$BFF_DIR"
    npm run seed
    log_info "数据填充完成"
}

# 启动 BFF 服务
start_bff() {
    log_info "启动 BFF 服务..."
    
    # 检查是否已在运行
    if pgrep -f "node src/index.js" > /dev/null; then
        log_warn "BFF 服务已在运行，正在重启..."
        pkill -f "node src/index.js"
        sleep 2
    fi
    
    # 后台启动
    cd "$BFF_DIR"
    nohup npm start > /var/log/gov-bff.log 2>&1 &
    
    # 等待服务启动
    sleep 3
    
    # 检查服务状态
    if curl -s http://localhost:8080/health > /dev/null; then
        log_info "✅ BFF 服务启动成功"
    else
        log_error "❌ BFF 服务启动失败，请检查日志"
        tail -50 /var/log/gov-bff.log
        exit 1
    fi
}

# 显示部署信息
show_info() {
    echo ""
    echo "=========================================="
    echo "  部署完成！"
    echo "=========================================="
    echo ""
    echo "BFF 服务地址: http://123.60.219.19:8080/api/bff"
    echo "健康检查: http://123.60.219.19:8080/health"
    echo "日志文件: /var/log/gov-bff.log"
    echo ""
    echo "Gitea 地址: $GITEA_URL"
    echo "数据库: $DB_HOST:$DB_PORT/$DB_NAME"
    echo ""
    echo "=========================================="
}

# 主流程
main() {
    log_info "开始部署党政软件版本管控平台..."
    echo ""
    
    check_node
    check_npm
    install_bff_deps
    configure_bff
    run_migrate
    run_seed
    start_bff
    show_info
}

main "$@"
