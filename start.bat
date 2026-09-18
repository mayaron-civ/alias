@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Alias
cls
echo.
echo   Alias. Сервер запущен.
echo.
echo   На этом компьютере:
echo     http://localhost:8777
echo.
echo   С телефона, если он в той же Wi-Fi сети:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo     http://%%b:8777
echo.
echo   Чтобы остановить — закрой это окно.
echo.
start "" http://localhost:8777
python -m http.server 8777 --bind 0.0.0.0
pause
