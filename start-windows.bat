@echo off
title Milanote Clone
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org & pause & exit /b)
if not exist node_modules (
  echo Installing packages, please wait...
  call npm install
)
if not exist .next\BUILD_ID (
  echo Building the app...
  call npm run build
)
start "" http://localhost:3000
call npm start
pause
