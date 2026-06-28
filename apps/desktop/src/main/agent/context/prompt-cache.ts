/** LRU-ish cache for assembled system prompts keyed by channel + content fingerprint. */
export class SystemPromptCache {
  private entries = new Map<string, string>()
  private readonly maxEntries: number

  constructor(maxEntries = 8) {
    this.maxEntries = maxEntries
  }

  get(key: string): string | undefined {
    const hit = this.entries.get(key)
    if (hit === undefined) return undefined
    // Refresh insertion order for simple LRU eviction.
    this.entries.delete(key)
    this.entries.set(key, hit)
    return hit
  }

  set(key: string, prompt: string): void {
    if (this.entries.has(key)) this.entries.delete(key)
    this.entries.set(key, prompt)
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}
