@echo off
REM 汉学课堂 — start the site (static files + login/progress API) on http://127.0.0.1:8091
cd /d "%~dp0"
echo Starting 汉学课堂 on http://127.0.0.1:8091 ...
node server\server.js
pause
