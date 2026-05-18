# nanobot 启动指南 (Windows)

## 环境要求

- Python ≥ 3.11
- Node.js ≥ 20

## 1. 安装依赖

```powershell
cd C:\Users\luli_\OneDrive\Desktop\nanobot

# 创建虚拟环境并安装 Python 依赖
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .

# 构建 WebUI
cd webui
npm install
npm run build
cd ..
```

## 2. 初始化配置

```powershell
.\.venv\Scripts\nanobot.exe onboard
```

配置写入 `~/.nanobot/config.json`，workpace 为 `~/.nanobot/workspace`。

## 3. 配置 API Key

编辑 `C:\Users\luli_\.nanobot\config.json`，找到对应 provider 下填入 `api_key`：

```json
"deepseek": {
  "api_key": "sk-xxx",
  ...
}
```

模型名设为 `deepseek/deepseek-v4-pro`（或 `deepseek-v4-flash`）。

## 4. 启用 WebSocket 通道（WebUI）

在 `config.json` 中：

```json
"websocket": {
  "enabled": true,
  "websocketRequiresToken": false,
  ...
}
```

## 5. 启动

```powershell
.\.venv\Scripts\nanobot.exe gateway
```

## 6. 访问

| 服务 | 地址 |
|------|------|
| **WebUI** | http://127.0.0.1:8765/webui/ |
| **Health** | http://127.0.0.1:18790/health |

## 其他命令

```powershell
.\.venv\Scripts\nanobot.exe status    # 查看状态
.\.venv\Scripts\nanobot.exe agent     # 终端交互模式
.\.venv\Scripts\nanobot.exe serve     # 启动 OpenAI 兼容 API
```

## 已知修复

`nanobot/providers/registry.py` — DeepSeek 的 `ProviderSpec` 需添加 `strip_model_prefix=True`，否则模型名 `deepseek/deepseek-v4-pro` 会原样发给 API 导致 400 错误。
