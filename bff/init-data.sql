-- ===============================================
-- 党政软件版本管控平台 - 默认数据
-- ===============================================

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

INSERT INTO system_config (config_key, config_value, config_type, description)
SELECT 'gitea_url', 'http://123.60.219.19:3000', 'string', 'Gitea 服务地址'
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'gitea_url');

-- 插入测试用户（密码 admin123）
-- 密码哈希: $2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqzX2MKn1lzwBzj0ZLRxNjZfCq0Fe (实际需要重新生成)
INSERT INTO user_profiles (user_id, gitea_username, nickname, role_code, department_id, secret_level, is_active)
SELECT 1, 'root', '系统管理员', 'admin', 4, 'secret', true
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE gitea_username = 'root');
