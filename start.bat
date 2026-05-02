@echo off
title SplitPay Server
echo.
echo  ==========================================
echo   SplitPay - Starting...
echo  ==========================================
echo.

echo  [1/2] Starting MongoDB...
net start MongoDB
echo.

echo  [2/2] Starting SplitPay server...
echo  Open your browser and go to: http://localhost:5000
echo  Press Ctrl+C in this window to STOP the server.
echo.
npm start
