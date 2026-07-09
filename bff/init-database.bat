@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo   党政软件版本管控平台
echo   数据库初始化脚本
echo ==========================================
echo.

:: 数据库配置
set DB_HOST=123.60.219.19
set DB_PORT=5432
set DB_NAME=gov_code_manager
set DB_USER=dev_admin
set DB_PASSWORD=Besti@2026_db
set ADMIN_USER=postgres
set ADMIN_PASSWORD=Besti@2026_db

echo 数据库配置:
echo   主机: %DB_HOST%
echo   端口: %DB_PORT%
echo   数据库: %DB_NAME%
echo   用户: %DB_USER%
echo.

:: 检查 psql
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] psql 未安装
    echo.
    echo 请先安装 PostgreSQL 客户端:
    echo   下载地址: https://www.postgresql.org/download/
    echo   或下载 pgAdmin: https://www.pgadmin.org/download/
    echo.
    echo 或者在服务器上执行:
    echo   sudo apt-get install postgresql-client
    echo.
    pause
    exit /b 1
)

echo [信息] psql 已安装
echo.

:: 设置 PGPASSWORD
set PGPASSWORD=%DB_PASSWORD%

:: 检查数据库是否存在
echo [步骤] 检查数据库...
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'" >nul 2>&1
if %errorlevel% equ 0 (
    echo [完成] 数据库 '%DB_NAME%' 已存在
) else (
    echo [步骤] 创建数据库...
    set PGPASSWORD=%ADMIN_PASSWORD%
    psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%ADMIN_USER%" -c "CREATE DATABASE %DB_NAME%;"
    set PGPASSWORD=%DB_PASSWORD%
    if %errorlevel% equ 0 (
        echo [完成] 数据库 '%DB_NAME%' 创建成功
    ) else (
        echo [错误] 数据库创建失败
    )
)

:: 检查用户是否存在
echo.
echo [步骤] 检查用户...
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -tAc "SELECT 1 FROM pg_roles WHERE rolname='%DB_USER%'" >nul 2>&1
if %errorlevel% equ 0 (
    echo [完成] 用户 '%DB_USER%' 已存在
) else (
    echo [步骤] 创建用户...
    set PGPASSWORD=%ADMIN_PASSWORD%
    psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%ADMIN_USER%" -c "CREATE USER %DB_USER% WITH PASSWORD '%DB_PASSWORD%';"
    set PGPASSWORD=%DB_PASSWORD%
    echo [完成] 用户 '%DB_USER%' 创建成功
)

:: 授权
echo.
echo [步骤] 授权...
set PGPASSWORD=%ADMIN_PASSWORD%
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%ADMIN_USER%" -c "GRANT ALL PRIVILEGES ON DATABASE %DB_NAME% TO %DB_USER%;"
set PGPASSWORD=%DB_PASSWORD%
echo [完成] 权限授予成功

:: 创建数据表
echo.
echo [步骤] 创建数据表...
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -f "%~dp0init-tables.sql" >nul 2>&1
if %errorlevel% equ 0 (
    echo [完成] 数据表创建成功
) else (
    echo [警告] 部分数据表可能已存在
)

:: 插入默认数据
echo.
echo [步骤] 插入默认数据...
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -f "%~dp0init-data.sql" >nul 2>&1
if %errorlevel% equ 0 (
    echo [完成] 默认数据插入成功
) else (
    echo [警告] 部分数据可能已存在
)

:: 测试连接
echo.
echo [步骤] 测试连接...
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "SELECT '连接成功' as status;" >nul 2>&1
if %errorlevel% equ 0 (
    echo [完成] 数据库连接测试成功
) else (
    echo [错误] 数据库连接测试失败
)

echo.
echo ==========================================
echo   数据库初始化完成！
echo ==========================================
echo.
echo 下一步操作:
echo   1. 启动 BFF: cd bff ^&^& npm run dev
echo   2. 启动前端: cd front ^&^& npm run dev
echo.
echo 默认账号:
echo   用户名: root
echo   密码: admin123
echo.

pause
