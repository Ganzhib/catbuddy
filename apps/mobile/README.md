# CatBuddy Mobile

React Native (Expo) 移动端 App，通过 WebView 加载已部署的 Web 应用 `catbuddy.ganzhibin.icu/app`。

## 技术栈

- **Expo SDK 52** — 托管构建、OTA 更新
- **React Native 0.76** — 原生壳
- **react-native-webview** — WebView 容器
- **TypeScript**

## 快速开始

### 安装依赖

```bash
cd apps/mobile
npm install
```

### 本地开发

```bash
# 启动 Expo 开发服务器
npx expo start

# 扫码运行（需安装 Expo Go App）
# iOS: App Store 搜索 "Expo Go"
# Android: Google Play 搜索 "Expo Go"

# 或在模拟器中运行
npx expo start --ios      # 需要 macOS + Xcode
npx expo start --android  # 需要 Android Studio
```

### 构建安装包

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录 Expo 账号
eas login

# 构建 Android APK (本地/云端)
eas build --platform android --profile preview

# 构建 iOS IPA (需要 Apple Developer 账号)
eas build --platform ios --profile preview
```

### 发布到应用商店

```bash
# Android — Google Play
eas submit --platform android

# iOS — App Store
eas submit --platform ios
```

## 工作原理

```
┌─────────────────┐       WebView        ┌─────────────────┐
│  CatBuddy App   │ ──────────────────► │ catbuddy.        │
│  (React Native)  │   https://.../app   │ ganzhibin.icu    │
│                 │                      │ (已部署的 Web)   │
└─────────────────┘                      └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │    Gateway       │
                                          │  (Fastify:WS)    │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Desktop Agent   │
                                          │   (Electron)     │
                                          └─────────────────┘
```

- App 通过 WebView 加载已部署的 Web 前端
- Web 前端通过 WebSocket 连接 Gateway
- Gateway 将消息中转到 Desktop Agent
- **Agent 始终在 Desktop 端运行，移动端仅做遥控**

## App 图标 & 启动屏

当前使用占位图。正式发布前需替换：

| 文件 | 尺寸 | 说明 |
|------|------|------|
| `assets/icon.png` | 1024×1024 | App 图标 |
| `assets/adaptive-icon.png` | 1024×1024 | Android 自适应图标 |
| `assets/splash.png` | 1284×2778 | 启动屏（iOS 推荐尺寸） |

可使用 [Expo 图标生成工具](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) 一键生成所有尺寸。

## 发布前检查清单

- [ ] 替换 App 图标和启动屏
- [ ] 注册 Apple Developer 账号（iOS 发布必需）
- [ ] 注册 Google Play 开发者账号（Android 发布必需）
- [ ] 在 `app.json` 中更新 `bundleIdentifier` / `package` 为正式包名
- [ ] 配置 `eas.json` 构建配置文件
- [ ] iOS: 在 `app.json` 中更新 `buildNumber`
- [ ] Android: 在 `app.json` 中更新 `versionCode`
