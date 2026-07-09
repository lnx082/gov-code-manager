#!/bin/bash
# ===============================================
# 党政软件版本管控平台 - 数据库初始化脚本
# 适用于 openGauss / PostgreSQL
# ===============================================

# 数据库配置
DB_HOST="123.60.219.19"
DB_PORT="5432"
DB_NAME="gov_code_manager"
DB_USER="dev_admin"
DB_PASSWORD="Besti@2026_db"
ADMIN_USER="postgres"
ADMIN_PASSWORD="Besti@2026_db"

echo "=========================================="
echo "  党政软件版本管控平台"
echo "  数据库初始化脚本"
echo "=========================================="
echo ""
echo "数据库配置:"
echo "  主机: $DB_HOST"
echo "  端口: $DB_PORT"
echo "  数据库: $DB_NAME"
echo "  用户: $DB_USER"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 psql 是否安装
check_psql() {
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✅ psql 已安装${NC}"
        return 0
    else
        echo -e "${RED}❌ psql 未安装${NC}"
        echo "请先安装 psql 客户端:"
        echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
        echo "  CentOS/RHEL: sudo yum install postgresql"
        echo "  Windows: 下载 pgAdmin 或 PostgreSQL 安装包"
        return 1
    fi
}

# 创建数据库
create_database() {
    echo -e "\n${YELLOW}📦 创建数据库...${NC}"
    
    # 检查数据库是否存在
    EXISTS=$(PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null)
    
    if [ "$EXISTS" = "1" ]; then
        echo -e "${GREEN}✅ 数据库 '$DB_NAME' 已存在${NC}"
    else
        PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 数据库 '$DB_NAME' 创建成功${NC}"
        else
            echo -e "${RED}❌ 数据库创建失败${NC}"
            return 1
        fi
    fi
}

# 创建数据库用户
create_user() {
    echo -e "\n${YELLOW}👤 创建数据库用户...${NC}"
    
    # 检查用户是否存在
    EXISTS=$(PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null)
    
    if [ "$EXISTS" = "1" ]; then
        echo -e "${GREEN}✅ 用户 '$DB_USER' 已存在${NC}"
    else
        PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 用户 '$DB_USER' 创建成功${NC}"
        else
            echo -e "${RED}❌ 用户创建失败${NC}"
            return 1
        fi
    fi
}

# 授权
grant_privileges() {
    echo -e "\n${YELLOW}🔐 授权用户权限...${NC}"
    
    PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null
    PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;" 2>/dev/null
    PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;" 2>/dev/null
    PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null
    
    echo -e "${GREEN}✅ 权限授予成功${NC}"
}

# 创建数据表
create_tables() {
    echo -e "\n${YELLOW}📋 创建数据表...${NC}"
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF' 2>/dev/null

-- 审批流程模板表
CREATE TABLE IF NOT EXISTS approval_flows (
    flow_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    applicable_operations TEXT[],
    applicable_secret_levels TEXT[],
    steps TEXT[],
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 审批申请主表
CREATE TABLE IF NOT EXISTS approvals (
    approval_id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    repo_owner VARCHAR(100),
    repo_name VARCHAR(100),
    source_branch VARCHAR(100),
    target_branch VARCHAR(100),
    gitea_pr_number INTEGER,
    secret_level VARCHAR(20) DEFAULT 'internal',
    urgency VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    current_step INTEGER DEFAULT 1,
    approval_flow_id INTEGER,
    applicant_user_id INTEGER NOT NULL,
    applicant_username VARCHAR(100) NOT NULL,
    reviewers TEXT,
    attachments TEXT,
    compliance_checklist TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 审批记录表
CREATE TABLE IF NOT EXISTS approval_records (
    record_id SERIAL PRIMARY KEY,
    approval_id INTEGER NOT NULL,
    step INTEGER NOT NULL,
    step_name VARCHAR(100),
    reviewer_user_id INTEGER,
    action VARCHAR(20) NOT NULL,
    comment TEXT,
    action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 基线表
CREATE TABLE IF NOT EXISTS baselines (
    baseline_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    repo_owner VARCHAR(100) NOT NULL,
    repo_name VARCHAR(100) NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    lock_status VARCHAR(20) DEFAULT 'locked',
    approval_id INTEGER,
    created_by INTEGER NOT NULL,
    created_username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP
);

-- 归档表
CREATE TABLE IF NOT EXISTS archives (
    archive_id SERIAL PRIMARY KEY,
    repo_owner VARCHAR(100) NOT NULL,
    repo_name VARCHAR(100) NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    archive_type VARCHAR(50) DEFAULT 'archive',
    archive_reason TEXT,
    archive_file_name VARCHAR(255),
    archive_file_size BIGINT,
    storage_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'archived',
    archived_by INTEGER,
    approval_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 版本废弃表
CREATE TABLE IF NOT EXISTS version_deprecations (
    deprecation_id SERIAL PRIMARY KEY,
    repo_owner VARCHAR(100) NOT NULL,
    repo_name VARCHAR(100) NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    reason TEXT,
    deprecation_type VARCHAR(50) DEFAULT 'archive',
    migration_version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'deprecated',
    approval_id VARCHAR(100),
    deprecated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 审计日志表（防篡改链）
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id VARCHAR(100) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    username VARCHAR(100),
    nickname VARCHAR(100),
    department_id INTEGER,
    department_name VARCHAR(100),
    role_code VARCHAR(50),
    action_type VARCHAR(50) NOT NULL,
    action_name VARCHAR(100),
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    target_name VARCHAR(255),
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_body TEXT,
    request_ip VARCHAR(50),
    request_user_agent VARCHAR(500),
    response_status INTEGER,
    response_time_ms INTEGER,
    result VARCHAR(20),
    error_message TEXT,
    details TEXT,
    session_id VARCHAR(100),
    integrity_hash VARCHAR(64),
    prev_hash VARCHAR(64)
);

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_code VARCHAR(50) UNIQUE NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 部门表
CREATE TABLE IF NOT EXISTS departments (
    dept_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    leader VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户扩展表
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    gitea_username VARCHAR(100) NOT NULL,
    nickname VARCHAR(100),
    password_hash VARCHAR(255),
    department_id INTEGER,
    role_code VARCHAR(50) DEFAULT 'user',
    secret_level VARCHAR(20) DEFAULT 'internal',
    permissions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    account_locked BOOLEAN DEFAULT FALSE,
    last_login_ip VARCHAR(50),
    last_login_time TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    related_type VARCHAR(50),
    related_id VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 风险预警表
CREATE TABLE IF NOT EXISTS risk_warnings (
    warning_id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    related_user_id INTEGER,
    related_username VARCHAR(100),
    source_ip VARCHAR(50),
    triggered_rule VARCHAR(100),
    triggered_value TEXT,
    rule_threshold TEXT,
    status VARCHAR(20) DEFAULT 'unhandled',
    handler_user_id INTEGER,
    handler_comment TEXT,
    handled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 报表记录表
CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    template_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    format VARCHAR(20) DEFAULT 'pdf',
    parameters TEXT,
    status VARCHAR(20) DEFAULT 'generating',
    file_path TEXT,
    file_size BIGINT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 备份记录表
CREATE TABLE IF NOT EXISTS backups (
    backup_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'manual',
    scope VARCHAR(20) DEFAULT 'full',
    status VARCHAR(20) DEFAULT 'running',
    progress INTEGER DEFAULT 0,
    file_size BIGINT,
    storage_path TEXT,
    checksum_sha256 VARCHAR(64),
    created_by VARCHAR(100),
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT,
    config_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 版本规则表
CREATE TABLE IF NOT EXISTS version_rules (
    id SERIAL PRIMARY KEY,
    default_pattern VARCHAR(100) DEFAULT 'MAJOR.MINOR.PATCH',
    patterns TEXT,
    auto_increment_rules TEXT,
    prohibit_patterns TEXT,
    enforce_on_tag_creation BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据表创建成功${NC}"
    else
        echo -e "${RED}❌ 数据表创建失败${NC}"
        return 1
    fi
}

# 插入默认数据
insert_defaults() {
    echo -e "\n${YELLOW}📝 插入默认数据...${NC}"
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF' 2>/dev/null

-- 插入默认角色
INSERT INTO roles (role_code, role_name, description, permissions, is_system, sort_order)
SELECT 'admin', '系统管理员', '系统管理员，拥有所有权限', '["*"]', true, 1
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'admin');

INSERT INTO roles (role_code, role_name, description, permissions, is_system, sort_order)
SELECT 'project_manager', '项目管理员', '项目管理员，负责仓库和版本管理', '["repo:*", "branch:*", "version:*", "approval:*", "baseline:*"]', true, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'project_manager');

INSERT INTO roles (role_code, role_name, description, permissions, is_system, sort_order)
SELECT 'developer', '开发人员', '开发人员，负责代码提交和分支操作', '["repo:view", "branch:create", "version:view", "approval:create"]', true, 3
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'developer');

INSERT INTO roles (role_code, role_name, description, permissions, is_system, sort_order)
SELECT 'auditor', '审计人员', '审计人员，负责查看审计日志', '["audit:*", "report:*"]', true, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'auditor');

INSERT INTO roles (role_code, role_name, description, permissions, is_system, sort_order)
SELECT 'user', '普通用户', '普通用户，仅有查看权限', '["repo:view", "branch:view", "version:view"]', true, 5
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'user');

-- 插入默认部门
INSERT INTO departments (name, code, sort_order)
SELECT '技术部', 'TECH', 1
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'TECH');

INSERT INTO departments (name, code, sort_order)
SELECT '运维部', 'OPS', 2
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'OPS');

INSERT INTO departments (name, code, sort_order)
SELECT '安全部', 'SEC', 3
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'SEC');

INSERT INTO departments (name, code, sort_order)
SELECT '综合部', 'ADMIN', 4
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'ADMIN');

-- 插入默认审批流程
INSERT INTO approval_flows (name, description, applicable_operations, applicable_secret_levels, steps, is_default, is_active)
SELECT '标准审批流程', '适用于普通操作的二级审批流程', 
    ARRAY['merge', 'version_create', 'baseline_create'],
    ARRAY['public', 'internal'],
    ARRAY['技术负责人审核', '项目经理审批'],
    true, true
WHERE NOT EXISTS (SELECT 1 FROM approval_flows WHERE name = '标准审批流程');

INSERT INTO approval_flows (name, description, applicable_operations, applicable_secret_levels, steps, is_default, is_active)
SELECT '涉密版本审批流程', '适用于涉密操作的四级审批流程',
    ARRAY['merge', 'version_create', 'baseline_create', 'delete'],
    ARRAY['secret', 'top-secret'],
    ARRAY['开发人员提交', '技术负责人审核', '安全管理员审核', '主管领导审批'],
    false, true
WHERE NOT EXISTS (SELECT 1 FROM approval_flows WHERE name = '涉密版本审批流程');

-- 插入默认版本规则
INSERT INTO version_rules (default_pattern, patterns, auto_increment_rules, prohibit_patterns, enforce_on_tag_creation, is_active)
SELECT 'MAJOR.MINOR.PATCH',
    '[{"pattern": "MAJOR.MINOR.PATCH", "example": "1.2.3", "description": "标准语义化版本"}]',
    '{"commit": "patch", "feature": "minor", "breaking": "major"}',
    '[{"pattern": "v0.0.0", "reason": "不能使用 0.0.0 版本"}]',
    true, true
WHERE NOT EXISTS (SELECT 1 FROM version_rules WHERE default_pattern = 'MAJOR.MINOR.PATCH');

-- 插入系统配置
INSERT INTO system_config (config_key, config_value, config_type, description)
SELECT 'system_name', '党政软件版本管控平台', 'string', '系统名称'
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'system_name');

INSERT INTO system_config (config_key, config_value, config_type, description)
SELECT 'version', '1.0.0', 'string', '系统版本'
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'version');

EOF
    
    echo -e "${GREEN}✅ 默认数据插入成功${NC}"
}

# 测试连接
test_connection() {
    echo -e "\n${YELLOW}🔍 测试数据库连接...${NC}"
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库连接测试成功${NC}"
        return 0
    else
        echo -e "${RED}❌ 数据库连接测试失败${NC}"
        return 1
    fi
}

# 主流程
main() {
    if ! check_psql; then
        exit 1
    fi
    
    create_database
    create_user
    grant_privileges
    create_tables
    insert_defaults
    test_connection
    
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ 数据库初始化完成！${NC}"
    echo "=========================================="
    echo ""
    echo "下一步操作:"
    echo "  1. 启动 BFF 服务: cd bff && npm run dev"
    echo "  2. 启动前端服务: cd front && npm run dev"
    echo ""
    echo "默认账号:"
    echo "  用户名: root"
    echo "  密码: admin123"
    echo ""
}

main
