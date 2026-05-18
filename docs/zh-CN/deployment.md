# 部署

## Docker

> [!TIP]
> `-v ~/.nanobot:/home/nanobot/.nanobot` 标志将本地配置目录挂载到容器中，使配置和工作区在容器重启后持久化。
> 容器以非 root 用户 `nanobot`（UID 1000）运行，从 `/home/nanobot/.nanobot` 读取配置。始终将主机配置目录挂载到 `/home/nanobot/.nanobot`，而非 `/root/.nanobot`。
> 如果遇到**权限拒绝**错误，先修复主机上的所有权：`sudo chown -R 1000:1000 ~/.nanobot`，或传递 `--user $(id -u):$(id -g)` 匹配主机 UID。Podman 用户可使用 `--userns=keep-id` 代替。
>
> [!IMPORTANT]
> 官方 Docker 使用当前指从此仓库使用包含的 `Dockerfile` 构建。第三方命名空间下的 Docker Hub 镜像未由 HKUDS/nanobot 维护或验证；除非信任发布者，否则不要挂载 API key 或 bot token 到其中。

> [!IMPORTANT]
> 网关和 WebSocket 通道在 `config.json`（`nanobot/config/schema.py` 中设置）中默认为 `host: "127.0.0.1"`。Docker 的 `-p` 端口转发无法访问容器的回环接口，因此为了让主机或局域网访问暴露的端口，启动容器前必须在 `~/.nanobot/config.json` 中将两个绑定均设为 `0.0.0.0`：
>
> ```json
> {
>   "gateway":  { "host": "0.0.0.0" },
>   "channels": { "websocket": { "host": "0.0.0.0" } }
> }
> ```

### Docker Compose

```bash
docker compose run --rm nanobot-cli onboard   # 首次设置
vim ~/.nanobot/config.json                     # 添加 API key
docker compose up -d nanobot-gateway           # 启动网关
```

```bash
docker compose run --rm nanobot-cli agent -m "Hello!"   # 运行 CLI
docker compose logs -f nanobot-gateway                   # 查看日志
docker compose down                                      # 停止
```

### Docker

```bash
# 构建镜像
docker build -t nanobot .

# 初始化配置（仅首次）
docker run -v ~/.nanobot:/home/nanobot/.nanobot --rm nanobot onboard

# 在主机上编辑配置以添加 API key
vim ~/.nanobot/config.json

# 运行网关
docker run \
  --cap-drop ALL --cap-add SYS_ADMIN \
  --security-opt apparmor=unconfined \
  --security-opt seccomp=unconfined \
  -v ~/.nanobot:/home/nanobot/.nanobot \
  -p 18790:18790 -p 8765:8765 \
  nanobot gateway

# 或运行单条命令
docker run -v ~/.nanobot:/home/nanobot/.nanobot --rm nanobot agent -m "Hello!"
docker run -v ~/.nanobot:/home/nanobot/.nanobot --rm nanobot status
```

## Linux 服务

将网关作为 systemd 用户服务运行，使其自动启动并在失败时重启。

**1. 找到 nanobot 二进制路径：**

```bash
which nanobot   # 如 /home/user/.local/bin/nanobot
```

**2. 创建服务文件** `~/.config/systemd/user/nanobot-gateway.service`：

```ini
[Unit]
Description=Nanobot Gateway
After=network.target

[Service]
Type=simple
ExecStart=%h/.local/bin/nanobot gateway
Restart=always
RestartSec=10
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=%h

[Install]
WantedBy=default.target
```

**3. 启用并启动：**

```bash
systemctl --user daemon-reload
systemctl --user enable --now nanobot-gateway
```

**常用操作：**

```bash
systemctl --user status nanobot-gateway    # 检查状态
systemctl --user restart nanobot-gateway   # 配置更改后重启
journalctl --user -u nanobot-gateway -f    # 实时查看日志
```

> **注意：** 用户服务仅在你登录期间运行。要保持网关在登出后运行，启用 lingering：
>
> ```bash
> loginctl enable-linger $USER
> ```

## macOS LaunchAgent

当希望 `nanobot gateway` 在登录后保持在线而无需保持终端打开时，使用 LaunchAgent。

**1. 获取 `nanobot` 绝对路径：**

```bash
which nanobot   # 如 /Users/youruser/.local/bin/nanobot
```

**2. 创建 `~/Library/LaunchAgents/ai.nanobot.gateway.plist`：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.nanobot.gateway</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/youruser/.local/bin/nanobot</string>
    <string>gateway</string>
    <string>--workspace</string>
    <string>/Users/youruser/.nanobot/workspace</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/youruser/.nanobot/workspace</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/youruser/.nanobot/logs/gateway.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/youruser/.nanobot/logs/gateway.error.log</string>
</dict>
</plist>
```

**3. 加载并启动：**

```bash
mkdir -p ~/Library/LaunchAgents ~/.nanobot/logs
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.nanobot.gateway.plist
launchctl enable gui/$(id -u)/ai.nanobot.gateway
launchctl kickstart -k gui/$(id -u)/ai.nanobot.gateway
```
