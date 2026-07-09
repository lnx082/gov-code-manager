-- 迁移脚本：为 user_profiles 表添加缺失的字段
-- 执行方式：psql -U postgres -d gitea -f migrate-add-columns.sql

-- 为 user_profiles 表添加缺失的字段
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_time TIMESTAMP;

-- 确认表结构
\dn
\d user_profiles
