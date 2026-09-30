# GitHub Actions CI/CD

仓库包含三条自动化流水线：

- `CI`：向 `master` 提交或创建 Pull Request 时执行类型检查，并构建 Gateway 和 Web。
- `Deploy production`：代码进入 `master` 且 CI 成功后，将 Gateway 和 Web 部署到生产服务器；也支持手动触发。
- `Release desktop apps`：推送 `v*` 标签时，构建 Windows x64、macOS Apple Silicon 和 macOS Intel 安装包，并创建 GitHub Release。

## 首次配置

在 GitHub 仓库进入 **Settings → Environments → New environment**，创建名为 `production` 的环境。

在 `production` 环境的 **Environment secrets** 中添加：

| Secret | 内容 |
| --- | --- |
| `DEPLOY_SSH_KEY` | 能以 `root` 用户登录生产服务器的无密码 SSH 私钥全文 |
| `PRODUCTION_ENV` | 本地 `.env.production` 的完整内容 |

不要提交私钥或 `.env.production`。工作流只在运行期间创建临时文件，并在结束时删除。

建议在 `production` 环境中配置 Required reviewers。这样代码进入 `master` 后，部署任务需要人工确认才会接触生产 Secrets。

## SSH 准备

将私钥对应的公钥添加到生产服务器的 `/root/.ssh/authorized_keys`，并在本地确认它可以无密码登录：

```powershell
ssh -i "私钥路径" root@150.158.27.165
```

GitHub Secret 中只保存私钥内容，不要包含文件路径。

## 发布桌面安装包

先修改 `apps/desktop/package.json` 的 `version`，提交到 `master`，然后创建与版本一致的标签。例如当前版本为 `0.1.0`：

```powershell
git tag v0.1.0
git push origin v0.1.0
```

标签版本必须和 `apps/desktop/package.json` 的版本一致。成功后 Release 会包含：

- `catbuddy-windows-x64.exe`
- `catbuddy-macos-arm64.dmg`
- `catbuddy-macos-x64.dmg`

安装包暂未签名，因此 Windows SmartScreen 可能显示“未知发布者”，macOS Gatekeeper 也可能要求用户手动确认打开。

也可以在 GitHub 的 **Actions → Release desktop apps → Run workflow** 手动构建。手动构建只上传临时 Artifact，不创建 Release。

## 生产目标

| 服务 | 地址/目录 |
| --- | --- |
| Gateway | `https://gateway.ganzhibin.icu`，服务器目录 `/opt/catbuddy/gateway` |
| Web | `https://catbuddy.ganzhibin.icu`，服务器目录 `/opt/catbuddy/web` |

Gateway 部署完成后会检查 `/health`，Web 部署完成后会检查网站首页。任一检查失败都会将工作流标记为失败。

Web 下载入口直接使用 GitHub 最新 Release 的固定附件地址：

```text
https://github.com/Ganzhib/catbuddy/releases/latest/download/catbuddy-windows-x64.exe
https://github.com/Ganzhib/catbuddy/releases/latest/download/catbuddy-macos-arm64.dmg
https://github.com/Ganzhib/catbuddy/releases/latest/download/catbuddy-macos-x64.dmg
```

因此发布新标签后不需要修改网页链接。Actions Artifact 只用于构建排查和手动构建，不作为官网公开下载源。
