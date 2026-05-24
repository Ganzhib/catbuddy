import * as fs from 'fs'
import * as path from 'path'
import type { Tool, ToolContext } from './types'

export function createGenerateImageTool(ctx: ToolContext): Tool {
  return {
    name: 'generate_image',
    definition: {
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Generate an image using AI. Returns the saved file path.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Image description' },
            size: {
              type: 'string',
              enum: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
              description: 'Image size (default 1024x1024)',
            },
            quality: {
              type: 'string',
              enum: ['standard', 'hd'],
              description: 'Image quality (default standard)',
            },
            style: {
              type: 'string',
              enum: ['vivid', 'natural'],
              description: 'Image style (default vivid)',
            },
          },
          required: ['prompt'],
        },
      },
    },
    execute: async (call) => {
      const {
        prompt,
        size = '1024x1024',
        quality = 'standard',
        style = 'vivid',
      } = call.arguments as Record<string, unknown>
      const apiKey = process.env.OPENAI_API_KEY
      const apiBase = process.env.IMAGE_GEN_BASE || 'https://api.openai.com/v1'

      if (!apiKey) return 'Error: No image generation API key configured. Set OPENAI_API_KEY.'

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 60000)
        const res = await fetch(`${apiBase}/images/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: String(prompt),
            n: 1,
            size: String(size),
            quality: String(quality),
            style: String(style),
          }),
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (!res.ok) {
          const text = await res.text()
          return `Error: ${res.status} ${text.slice(0, 200)}`
        }

        const data = (await res.json()) as { data?: Array<{ url?: string }> }
        const imageUrl = data.data?.[0]?.url
        if (!imageUrl) return 'Error: no image URL in response'

        const imgRes = await fetch(imageUrl)
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const filename = `generated_${Date.now()}.png`
        const filePath = path.join(ctx.workspace, 'images', filename)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, buf)

        return `Image generated: ${filename} (${size}, ${(buf.length / 1024).toFixed(1)}KB)\nSaved to: ${filePath}`
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return `Error generating image: ${message}`
      }
    },
  }
}
