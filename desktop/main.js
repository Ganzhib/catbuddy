const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

let mainWindow = null;
let tray = null;
let gatewayProcess = null;
let gatewayPort = 8765;
let healthPort = 18790;
let isQuitting = false;

// ---- 配置路径 ----
const configDir = path.join(require('os').homedir(), '.nanobot');
const configPath = path.join(configDir, 'config.json');
const workspaceDir = path.join(configDir, 'workspace');

// ---- 启动 Gateway ----
function startGateway() {
  // Bundled PyInstaller gateway (production)
  const bundledExe = path.join(process.resourcesPath, 'nanobot-gateway.exe');
  // Development fallback
  const devExe = path.join(__dirname, 'backend', 'dist', 'nanobot-gateway.exe');
  // Editable install fallback
  const venvExe = path.join(__dirname, '..', '.venv', 'Scripts', 'nanobot.exe');

  let exe, cwd;
  if (fs.existsSync(bundledExe)) {
    exe = bundledExe;
    cwd = configDir;  // Use config dir as cwd for bundled version
  } else if (fs.existsSync(devExe)) {
    exe = devExe;
    cwd = path.join(__dirname, '..');
  } else if (fs.existsSync(venvExe)) {
    exe = venvExe;
    cwd = path.join(__dirname, '..');
  } else {
    console.error('找不到 nanobot-gateway.exe');
    return;
  }

  gatewayProcess = spawn(exe, [], {
    cwd: cwd,
    stdio: 'pipe',
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  gatewayProcess.stdout?.on('data', (data) => {
    const msg = data.toString();
    process.stdout.write('[Gateway] ' + msg);
  });

  gatewayProcess.stderr?.on('data', (data) => {
    const msg = data.toString();
    process.stderr.write('[Gateway] ' + msg);
  });

  gatewayProcess.on('error', (err) => {
    console.error('Gateway 启动失败:', err.message);
  });

  gatewayProcess.on('exit', (code) => {
    console.log(`Gateway 已退出 (code: ${code})`);
    if (!isQuitting) {
      // 意外退出，5 秒后重试
      setTimeout(() => {
        if (!isQuitting) startGateway();
      }, 5000);
    }
  });
}

// ---- 等待 Gateway 就绪 ----
function waitForGateway(url, maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) resolve();
        else { retries++; if (retries < maxRetries) setTimeout(check, 1000); else reject(new Error('Gateway 未就绪')); }
      }).on('error', () => {
        retries++;
        if (retries < maxRetries) setTimeout(check, 1000);
        else reject(new Error('Gateway 启动超时'));
      });
    };
    check();
  });
}

// ---- 检查是否已配置 ----
function isConfigured() {
  if (!fs.existsSync(configPath)) return false;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const providers = config.providers || {};
    // 检查是否有任何 provider 配置了 apiKey
    for (const [name, cfg] of Object.entries(providers)) {
      if (cfg.api_key || cfg.apiKey) return true;
    }
    return false;
  } catch { return false; }
}

// ---- 杀端口占用 ----
function findAndKillProcess(port) {
  return new Promise((resolve) => {
    const cmd = spawn('cmd', ['/c', `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`], { stdio: 'ignore' });
    cmd.on('close', () => setTimeout(resolve, 2000));
    setTimeout(resolve, 3000);
  });
}

// ---- 创建主窗口 ----
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'nanobot - 个人 AI 助手',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // 加载 WebUI
  mainWindow.loadURL(`http://127.0.0.1:${gatewayPort}/webui/`);

  // 监听 WebUI 加载失败，重试
  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`http://127.0.0.1:${gatewayPort}/webui/`);
      }
    }, 2000);
  });
}

// ---- 系统托盘 ----
function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 nanobot', click: () => { if (mainWindow) mainWindow.show(); } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('nanobot - 你的 AI 助手');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });
}

// ---- 初始化/安装向导 ----
async function runSetupWizard() {
  const setupWin = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    title: 'nanobot 安装向导',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  });

  const setupHTML = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>nanobot 安装向导</title><style>
*{margin:0;padding:0;box-sizing:border-box;font-family:"Microsoft YaHei","PingFang SC",sans-serif}
body{background:linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%);color:#e0e0e0;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px;width:440px}
h1{font-size:28px;margin-bottom:8px;text-align:center}
.sub{text-align:center;color:#888;margin-bottom:28px;font-size:13px}
.step{display:none}
.step.active{display:block}
label{display:block;margin-bottom:6px;color:#aaa;font-size:13px}
select,input{width:100%;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;margin-bottom:16px;outline:none}
select:focus,input:focus{border-color:#6366f1}
.btn{width:100%;padding:14px;border:none;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;transition:all .2s}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;margin-top:10px}
.btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.btn-link{background:none;color:#6366f1;font-weight:400;text-decoration:underline;margin-top:12px}
.hint{font-size:12px;color:#666;margin-top:-10px;margin-bottom:16px}
.error{color:#f87171;font-size:13px;margin-bottom:12px;display:none}
.success{text-align:center;padding:40px 0}
.success .icon{font-size:64px;margin-bottom:16px}
</style></head><body>
<div class="card">
  <h1>🐈 nanobot</h1>
  <p class="sub">给你的 AI 助手安个家</p>
  <div class="step active" id="step1">
    <label>选择 AI 模型</label>
    <select id="model">
      <option value="deepseek/deepseek-v4-pro">DeepSeek V4 Pro（推荐）</option>
      <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash（更快）</option>
      <option value="openai/gpt-4.1-mini">OpenAI GPT-4.1 Mini</option>
      <option value="openai/gpt-4.1">OpenAI GPT-4.1</option>
      <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4</option>
    </select>
    <label>API Key</label>
    <input type="password" id="apiKey" placeholder="输入你的 API Key">
    <p class="hint">如何获取？<a href="#" onclick="shell.openExternal('https://platform.deepseek.com/api_keys')">DeepSeek</a> · <a href="#" onclick="shell.openExternal('https://platform.openai.com/api-keys')">OpenAI</a></p>
    <div class="error" id="error"></div>
    <button class="btn btn-primary" onclick="setup()">🚀 开始使用</button>
  </div>
  <div class="step" id="step2">
    <div class="success">
      <div class="icon">✨</div>
      <h2>正在启动...</h2>
      <p style="color:#888;margin-top:8px">AI 助手马上就来</p>
    </div>
  </div>
</div>
<script>
const { ipcRenderer, shell } = require('electron');
async function setup() {
  const model = document.getElementById('model').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { document.getElementById('error').style.display='block'; document.getElementById('error').textContent='请输入 API Key'; return; }
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  const provider = model.split('/')[0];
  ipcRenderer.send('setup-config', { provider, model, apiKey });
}
</script>
</body></html>`;

  setupWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(setupHTML)}`);

  return new Promise((resolve) => {
    const { ipcMain } = require('electron');
    ipcMain.once('setup-config', async (event, { provider, model, apiKey }) => {
      // 写入配置
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

      const providers = {
        deepseek: 'deepseek',
        openai: 'openai',
        anthropic: 'anthropic',
      };
      const p = providers[provider] || provider;

      const config = {
        agents: {
          defaults: {
            model: model,
            provider: 'auto',
            maxTokens: 8192,
            contextWindowTokens: 65536,
            temperature: 0.1,
            timezone: 'Asia/Shanghai',
            botName: 'nanobot',
            botIcon: '🐈',
          }
        },
        providers: {
          [p]: { apiKey: apiKey }
        },
        channels: {
          websocket: {
            enabled: true,
            host: '127.0.0.1',
            port: 8765,
            path: '/',
            websocketRequiresToken: false,
            allowFrom: ['*'],
            streaming: true,
          }
        },
        gateway: { host: '127.0.0.1', port: 18790 },
        tools: {
          web: { enable: true },
          exec: { enable: true, timeout: 60 },
          my: { enable: true, allowSet: false },
        }
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('配置已写入:', configPath);

      await new Promise(r => setTimeout(r, 1000));
      setupWin.close();
      resolve();
    });
  });
}

// ---- 生命周期 ----
app.whenReady().then(async () => {
  createTray();

  // 检查是否首次运行
  if (!isConfigured()) {
    await runSetupWizard();
  }

  // 清理旧进程占用的端口
  await findAndKillProcess(gatewayPort);
  await findAndKillProcess(healthPort);

  // 启动 Gateway
  startGateway();

  // 等待就绪后创建窗口
  try {
    await waitForGateway(`http://127.0.0.1:${healthPort}/health`);
    console.log('Gateway 已就绪');
  } catch (err) {
    console.error('Gateway 启动失败:', err.message);
    dialog.showErrorBox('启动失败', 'nanobot 服务启动失败，请检查 Python 环境和依赖是否安装正确。');
    app.quit();
    return;
  }

  createWindow();
});

app.on('window-all-closed', () => { /* 不退出，隐藏到托盘 */ });

app.on('before-quit', () => {
  isQuitting = true;
  if (gatewayProcess) {
    gatewayProcess.kill('SIGTERM');
    // Windows fallback
    setTimeout(() => { if (gatewayProcess) gatewayProcess.kill(); }, 3000);
  }
});
