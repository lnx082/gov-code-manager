-- ===============================================
-- 党政软件版本管控平台 - 数据表结构
-- 适用于 openGauss / PostgreSQL
-- ===============================================

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
