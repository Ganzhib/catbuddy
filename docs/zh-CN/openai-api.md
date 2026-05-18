# OpenAI 兼容 API

nanobot 可以为本地集成暴露一个最小化的 OpenAI 兼容端点：

```bash
pip install "nanobot-ai[api]"
nanobot serve
```

默认情况下，API 绑定在 `127.0.0.1:8900`。可在 `config.json` 中修改。

## 行为

- 会话隔离：在请求体中传递 `"session_id"` 以隔离对话；省略则使用共享默认会话（`api:default`）
- 单条消息输入：每个请求必须包含恰好一条 `user` 消息
- 固定模型：省略 `model`，或传递与 `/v1/models` 显示的相同模型
- 流式传输：设置 `stream=true` 接收 Server-Sent Events（`text/event-stream`），包含 OpenAI 兼容的 delta 分块，以 `data: [DONE]` 终止；省略或设置 `stream=false` 则返回单个 JSON 响应
- **文件上传**：支持通过 JSON base64 或 `multipart/form-data` 上传图片、PDF、Word（.docx）、Excel（.xlsx）、PowerPoint（.pptx）（每文件最大 10MB）
- API 请求在合成的 `api` 通道中运行，所以 `message` 工具**不会**自动投递到 Telegram/Discord 等平台。要主动发送到另一个聊天，调用 `message` 时明确指定已启用通道的 `channel` 和 `chat_id`

示例：从 API 会话跨通道投递的工具调用：

```json
{
  "content": "构建成功完成。",
  "channel": "telegram",
  "chat_id": "123456789"
}
```

如果 `channel` 指向配置中未启用的通道，nanobot 会将出站事件排队，但不会进行平台投递。

## 端点

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`

## curl

```bash
curl http://127.0.0.1:8900/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "hi"}],
    "session_id": "my-session"
  }'
```

## 文件上传（JSON base64）

使用 OpenAI 多模态内容格式发送内联图片：

```bash
curl http://127.0.0.1:8900/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": [
      {"type": "text", "text": "描述这张图片"},
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBOR..."}}
    ]}]
  }'
```

## 文件上传（multipart/form-data）

通过 multipart 上传任何支持的文件类型（图片、PDF、Word、Excel、PPT）：

```bash
# 单个文件
curl http://127.0.0.1:8900/v1/chat/completions \
  -F "message=总结这份报告" \
  -F "files=@report.docx"

# 多文件带会话隔离
curl http://127.0.0.1:8900/v1/chat/completions \
  -F "message=比较这些文件" \
  -F "files=@chart.png" \
  -F "files=@data.xlsx" \
  -F "session_id=my-session"
```

支持的文件类型：
- **图片**：PNG、JPEG、GIF、WebP（以 base64 形式发送给 AI 进行视觉分析）
- **文档**：PDF、Word（.docx）、Excel（.xlsx）、PowerPoint（.pptx）（提取文本后发送给 AI）
- **文本**：TXT、Markdown、CSV、JSON 等（直接读取）

## Python（`requests`）

```python
import requests

resp = requests.post(
    "http://127.0.0.1:8900/v1/chat/completions",
    json={
        "messages": [{"role": "user", "content": "hi"}],
        "session_id": "my-session",  # 可选：隔离对话
    },
    timeout=120,
)
resp.raise_for_status()
print(resp.json()["choices"][0]["message"]["content"])
```

## Python（`openai`）

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8900/v1",
    api_key="dummy",
)

resp = client.chat.completions.create(
    model="MiniMax-M2.7",
    messages=[{"role": "user", "content": "hi"}],
    extra_body={"session_id": "my-session"},  # 可选：隔离对话
)
print(resp.choices[0].message.content)
```
