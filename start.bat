@echo off
chcp 65001 >nul
echo ==========================================
echo   党政软件版本管控平台
echo   GovCode Version Control Platform
echo ==========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装，请先安装 Node.js 18+
    pause
    exit /b 1
)

echo ✅ Node.js 版本: 
node --version
echo.

:: 安装 BFF 依赖
cd /d "%~dp0bff"
if not exist "node_modules" (
    echo.
    echo 📦 安装 BFF 依赖...
    call npm install
)

:: 安装前端依赖
cd /d "%~dp0front"
if not exist "node_modules" (
    echo.
    echo 📦 安装前端依赖...
    call npm install
)

echo.
echo ==========================================
echo   启动完成！
echo ==========================================
echo.
echo 前端访问地址: http://localhost:3000
echo API 服务地址: http://localhost:8080
echo.
echo 默认账号:
echo   用户名: root
echo   密码: admin123
echo.
echo Gitea 地址: http://123.60.219.19:3000
echo.
echo ==========================================
echo.

:: 提示启动命令
echo 请在两个终端窗口中分别运行以下命令:
echo.
echo 终端 1 - 启动后端 API:
echo   cd bff ^&^& npm run dev
echo.
echo 终端 2 - 启动前端:
echo   cd front ^&^& npm run dev
echo.

pause
