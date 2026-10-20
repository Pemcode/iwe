@echo off
setlocal
cd /d "%~dp0"
uv run --locked python -m wiki gerer
if errorlevel 1 pause