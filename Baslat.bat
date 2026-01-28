@echo off
cd /d "%~dp0"
echo Baslatiliyor... Lutfen bekleyin.
echo Tarayici otomatik olarak acilacaktir.
start "" "http://localhost:5173"
call npm run dev
pause
