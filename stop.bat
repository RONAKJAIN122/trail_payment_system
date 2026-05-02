@echo off
title SplitPay - Stopping
echo.
echo  ==========================================
echo   SplitPay - Stopping everything...
echo  ==========================================
echo.

echo  Stopping Node.js server...
taskkill /F /IM node.exe /T >nul 2>&1
echo  Done.

echo  Stopping MongoDB...
net stop MongoDB
echo  Done.

echo.
echo  Everything stopped. Your laptop is clean.
echo.
pause
