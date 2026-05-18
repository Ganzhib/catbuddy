# 图片生成

nanobot 可以通过 `generate_image` 工具生成和编辑图片。在 WebUI 中，用户可以从编辑器启用**图片生成**，选择宽高比，并在同一聊天内持续迭代生成的图片。

此功能默认关闭。在 `~/.nanobot/config.json` 中启用，配置支持的图片生成 provider，然后重启网关。

## 快速设置

OpenRouter 示例：

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "${OPENROUTER_API_KEY}"
    }
  },
  "tools": {
    "imageGeneration": {
      "enabled": true,
      "provider": "openrouter",
      "model": "openai/gpt-5.4-image-2",
      "defaultAspectRatio": "1:1",
      "defaultImageSize": "1K"
    }
  }
}
```

AIHubMix 示例：

```json
{
  "providers": {
    "aihubmix": {
      "apiKey": "${AIHUBMIX_API_KEY}"
    }
  },
  "tools": {
    "imageGeneration": {
      "enabled": true,
      "provider": "aihubmix",
      "model": "gpt-image-2-free",
      "defaultAspectRatio": "1:1",
      "defaultImageSize": "1K"
    }
  }
}
```

> [!TIP]
> 推荐使用环境变量存储 API Key。nanobot 在启动时从环境解析 `${VAR_NAME}` 值。

## WebUI 使用

在 WebUI 编辑器中：

1. 点击**图片生成**。
2. 选择宽高比：`Auto`、`1:1`、`3:4`、`9:16`、`4:3` 或 `16:9`。
3. 描述你想要的图片或编辑。
4. 编辑已有图片时附加参考图片。

生成的图片在聊天中作为助手媒体显示。后续提示如"调暖一些""换一下背景"或"试试 16:9 版本"可以复用最近生成的产物。

WebUI 对用户隐藏了 provider 的存储细节。agent 内部看到保存的产物路径，可以传回 `generate_image` 的 `reference_images` 进行迭代编辑。

## 配置参考

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|-------------|
| `tools.imageGeneration.enabled` | boolean | `false` | 注册 `generate_image` 工具 |
| `tools.imageGeneration.provider` | string | `"openrouter"` | 图片 provider 名称。当前支持 `openrouter` 和 `aihubmix` |
| `tools.imageGeneration.model` | string | `"openai/gpt-5.4-image-2"` | Provider 模型名称 |
| `tools.imageGeneration.defaultAspectRatio` | string | `"1:1"` | 提示词/工具调用未指定时的默认比例 |
| `tools.imageGeneration.defaultImageSize` | string | `"1K"` | 默认尺寸提示，如 `1K`、`2K`、`4K` 或 `1024x1024` |
| `tools.imageGeneration.maxImagesPerTurn` | number | `4` | 单次工具调用接受的最大 `count`。有效范围：`1` 到 `8` |
| `tools.imageGeneration.saveDir` | string | `"generated"` | nanobot 媒体目录下存储生成产物的相对目录 |

Provider 设置复用常规的 provider 配置字段：

| 选项 | 说明 |
|--------|-------------|
| `providers.<name>.apiKey` | Provider API Key。推荐使用 `${ENV_VAR}` |
| `providers.<name>.apiBase` | 可选的自定义基础 URL |
| `providers.<name>.extraHeaders` | 合并到 provider 请求中的头信息 |
| `providers.<name>.extraBody` | 合并到 provider 请求体中的额外 JSON 字段 |

配置键支持 camelCase 和 snake_case，但文档使用 camelCase 以匹配 `config.json`。

## Provider 说明

### OpenRouter

OpenRouter 使用类 chat-completions 的图片响应。配置：

```json
{
  "tools": {
    "imageGeneration": {
      "enabled": true,
      "provider": "openrouter",
      "model": "openai/gpt-5.4-image-2"
    }
  }
}
```

如需参考图编辑，使用支持图片生成和图片编辑的模型。

### AIHubMix

AIHubMix 的 `gpt-image-2-free` 通过 AIHubMix 的统一 predictions API 支持。内部 nanobot 调用：

```text
/v1/models/openai/gpt-image-2-free/predictions
```

配置：

```json
{
  "providers": {
    "aihubmix": {
      "apiKey": "${AIHUBMIX_API_KEY}",
      "extraBody": {
        "quality": "low"
      }
    }
  },
  "tools": {
    "imageGeneration": {
      "enabled": true,
      "provider": "aihubmix",
      "model": "gpt-image-2-free"
    }
  }
}
```

`quality: low` 是可选的。它能让免费图片模型更快且不太容易超时，但并非必需。

## 产物

生成的图片存储在活跃 nanobot 实例的媒体目录下：

```text
~/.nanobot/media/generated/YYYY-MM-DD/img_<id>.<ext>
~/.nanobot/media/generated/YYYY-MM-DD/img_<id>.json
```

对于非默认配置位置，媒体目录相对于活跃配置文件的目录。

JSON 附属文件存储：

| 字段 | 含义 |
|-------|---------|
| `id` | 简短的生成图片 ID，如 `img_ab12cd34ef56` |
| `path` | 内部用于后续编辑的本地图片路径 |
| `mime` | 检测到的图片 MIME 类型 |
| `prompt` | 生成时使用的提示词 |
| `model` | Provider 模型 |
| `provider` | Provider 名称 |
| `source_images` | 编辑时使用的参考图片路径 |
| `created_at` | 创建时间戳 |

不要将 base64 图片负载粘贴到聊天中。agent 应将本地产物路径保持内部使用，除非用户明确要求调试细节。

## 提示词技巧

好的图片生成提示词包括：

- 主体和场景。
- 构图、镜头或布局。
- 风格、氛围、光线和调色板。
- 必须出现在图片中的精确文本，用引号标注。
- 约束条件如"保持相同角色"或"保留 logo"。

示例：

```text
一个极简的 nanobot 应用图标：友好的机器人头部，圆角方形，柔和的蓝白配色，干净的矢量风格，无文字
```

编辑时，描述要改变什么以及必须保持不变的内容：

```text
使用参考图片。保持相同的机器人和构图，将配色改为温暖的橙色，并添加微妙的日出背景。
```

## 故障排查

| 症状 | 检查项 |
|---------|-------|
| `generate_image` 不可用 | 将 `tools.imageGeneration.enabled` 设为 `true` 并重启网关 |
| 缺少 API Key 错误 | 配置 `providers.<provider>.apiKey`；若使用 `${VAR_NAME}`，确认环境变量对网关进程可见 |
| `unsupported image generation provider` | 使用 `openrouter` 或 `aihubmix` |
| AIHubMix 报 `Incorrect model ID` | 使用 `model: "gpt-image-2-free"`；nanobot 内部会展开为所需的 `openai/gpt-image-2-free` 模型路径 |
| 生成超时 | 尝试使用较小/默认的图片尺寸，将 `extraBody.quality` 设为 `"low"`，或稍后重试 |
| 参考图片被拒绝 | 参考图片路径必须在工作区或 nanobot 媒体目录内，且必须是有效的图片文件 |
