#!/bin/bash
# nanobot 一键构建脚本
# 用法: bash build.sh        (打包桌面版)
#       bash build.sh all    (打包桌面版 + 后端)

set -e
cd "$(dirname "$0")"

echo "=== Step 1: Build WebUI ==="
cd ../webui && npm run build && cd ../desktop

if [ "$1" = "all" ]; then
  echo "=== Step 2: Build Python Backend ==="
  rm -rf backend/dist backend/build
  cd backend
  pyinstaller --onefile --name nanobot-gateway \
    --add-data "../../nanobot/web/dist;nanobot/web/dist" \
    --add-data "../../nanobot/templates;nanobot/templates" \
    --add-data "../../nanobot/skills;nanobot/skills" \
    --hidden-import nanobot.cli.commands \
    --hidden-import nanobot.providers \
    --hidden-import nanobot.channels \
    --hidden-import nanobot.agent.tools \
    --collect-all nanobot \
    gateway_launcher.py
  cd ..
fi

echo "=== Step 3: Build Electron ==="
rm -rf dist
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npx electron-builder --win --dir

echo "=== Step 4: Build Installer ==="
python ../.venv/Scripts/python.exe -c "
import shutil, os, subprocess, sys
shutil.make_archive('nanobot_data', 'zip', 'dist/win-unpacked')
r = subprocess.run([os.path.join('..', '.venv', 'Scripts', 'pyinstaller.exe'),
    '--onefile', '--name', 'nanobot-setup',
    '--add-data', 'nanobot_data.zip;.',
    '--add-data', 'assets/nanobot.ico;assets',
    '--icon', 'assets/nanobot.ico', '--noconsole',
    'setup_launcher.py'], capture_output=True, text=True)
if r.returncode: print(r.stderr); sys.exit(1)
print(f'Done: {os.path.getsize(\"dist/nanobot-setup.exe\")/1024/1024:.0f} MB')
os.remove('nanobot_data.zip')
"

echo "=== nanobot-setup.exe ready! ==="
