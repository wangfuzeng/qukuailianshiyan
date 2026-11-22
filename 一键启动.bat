@echo off
chcp 65001 >nul
title ChainPulse 区块链节点
cd /d "%~dp0blockchaindemo"

echo ==================================================
echo   链脉 ChainPulse 一键启动
echo   启动后浏览器会自动打开 http://localhost:3001
echo   关闭本黑色窗口即停止服务
echo ==================================================
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

node headless-server.js

echo.
echo 服务已停止，按任意键关闭窗口。
pause >nul
