
# 打包


## 1. PyInstaller — 打包 Python 后端

```
nanobot/ (Python 源码 + web/dist + templates + skills)
    ↓  PyInstaller --onefile
backend/dist/nanobot-gateway.exe  (86MB，自带 Python 解释器)
```

入口文件 `desktop/backend/gateway_launcher.py`：

```python
from nanobot.cli.commands import app
app()  # 等价于命令行 `nanobot gateway`
```

## 2. Electron-builder — 包一层桌面壳

```
main.js  +  preload.js          (Electron 壳代码)
    +
nanobot-gateway.exe (86MB)       (上一步的 Python 后端)
    ↓  electron-builder --win
nanobot.exe (190MB)              (最终产物)
```

`main.js` 启动时：

```javascript
// 1. 检查是否首次运行 → 弹出安装向导
// 2. 找到内置的 nanobot-gateway.exe，后台启动
spawn('nanobot-gateway.exe', ...)
// 3. 等待 health check 通过
// 4. 加载 http://127.0.0.1:8765/webui 到 Electron 窗口
```

## 核心配置

`desktop/package.json` 中关键的两行：

```json
"extraResources": [
  { "from": "backend/dist/nanobot-gateway.exe", "to": "nanobot-gateway.exe" }
]
```

这行告诉 electron-builder：**把 PyInstaller 产出的 exe 塞进安装包里**，运行时 Electron 从 `process.resourcesPath` 找到它。

## 完整命令

```powershell
# 步骤 1：打包后端
cd desktop/backend
pyinstaller --onefile --name nanobot-gateway \
  --add-data "../../nanobot/web/dist;nanobot/web/dist" \
  --collect-all nanobot gateway_launcher.py

# 步骤 2：打包桌面壳
cd ..
npx electron-builder --win
```

产物在 `desktop/dist2/win-unpacked/`，整个文件夹压缩就能分发。
