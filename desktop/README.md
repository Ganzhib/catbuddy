# nanobot 桌面版

## 项目结构

```
desktop/
├── main.js          # Electron 主进程（启动 gateway + 窗口 + 系统托盘）
├── preload.js       # 预加载脚本
├── package.json     # 依赖和打包配置
├── setup.html       # 首次安装向导（内嵌在 main.js 中）
└── assets/          # 图标等资源
```

## 工作流程

1. 首次启动 → 弹出安装向导，选择模型 + 输入 API Key
2. 写入 `~/.nanobot/config.json`
3. 后台启动 nanobot gateway
4. 加载 WebUI 界面
5. 关闭窗口 → 最小化到系统托盘继续运行

## 开发

```bash
cd desktop
npm install
npm start
```

## 打包为 .exe

```bash
cd desktop
npm install
npx electron-builder --win
# 输出: desktop/dist-electron/nanobot Setup x.x.x.exe
```
