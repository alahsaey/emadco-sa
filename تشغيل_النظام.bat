@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Emadco ERP Local Server

echo ========================================================
echo   EMADCO ERP - LOCAL OFFLINE SERVER
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] Node.js detected. Starting Node server...
    if exist run_node_server.cjs (
        node run_node_server.cjs
        goto :SERVER_STOPPED
    )
    if exist dist\server.cjs (
        node dist\server.cjs
        goto :SERVER_STOPPED
    )
)

echo [*] Starting Windows native server via PowerShell...
echo [*] Initializing offline system, please wait...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0offline_server.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo [!] Standard launch failed, retrying with unrestricted execution policy...
    powershell.exe -NoProfile -ExecutionPolicy Unrestricted -File "%~dp0offline_server.ps1"
)

if %ERRORLEVEL% NEQ 0 (
    where python >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo [*] PowerShell restricted. Launching via Python fallback...
        start http://localhost:3000
        python -m http.server 3000
        goto :SERVER_STOPPED
    )
)

:SERVER_STOPPED
echo.
echo ========================================================
echo   Emadco Local Server has ended.
echo ========================================================
pause
