@echo off
cd /d "%~dp0muse-assistant"
start /min "" node server.mjs
timeout /t 1 /nobreak >nul
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:47821 --window-size=456,195 --window-position=540,12 --user-data-dir="%~dp0muse-assistant\.edge-profile"
