import fs from 'node:fs'
export function loadEnvFile(filePath: string) {
  try {
    console.log('[main] Loading env from:', filePath, 'exists:', fs.existsSync(filePath))
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    console.log(
      '[main] .env loaded, DEEPSEEK_KEY=',
      process.env.DEEPSEEK_KEY ? 'SET' : 'NOT SET',
      'GATEWAY_ENABLED=',
      process.env.GATEWAY_ENABLED ?? '(unset)',
      'LEARNBUDDY_GATEWAY_USE_LOCAL=',
      process.env.LEARNBUDDY_GATEWAY_USE_LOCAL ?? '(unset)',
    )
  } catch (err: any) { console.log('[main] No .env:', err.message) }
}
