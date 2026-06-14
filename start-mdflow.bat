@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\start-mdflow.ps1"
echo.
echo Press any key to close this window. Services will keep running in the background.
pause >nul
