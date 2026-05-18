@echo off
chcp 65001 >nul
echo === nanobot 一键构建 ===

echo [1/4] 构建 WebUI...
cd /d "%~dp0..\webui"
call npm run build
cd /d "%~dp0"

echo [2/4] 构建 Electron 壳...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
if exist dist rd /s /q dist
call npx electron-builder --win --dir

echo [3/4] 打包数据...
del /q nanobot_data.zip 2>nul
cd /d "%~dp0"
..\.venv\Scripts\python.exe -c "import shutil; shutil.make_archive('nanobot_data','zip','dist/win-unpacked')"

echo [4/4] 编译安装程序...
..\.venv\Scripts\pyinstaller --onefile --name nanobot-setup --add-data "nanobot_data.zip;." --add-data "assets/nanobot.ico;assets" --icon "assets/nanobot.ico" --noconsole setup_launcher.py

del /q nanobot_data.zip 2>nul
echo === 完成! dist\nanobot-setup.exe ===
pause
