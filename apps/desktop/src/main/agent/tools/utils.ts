import * as fs from 'fs'

export function matchGlob(filename: string, glob: string): boolean {
  const re = new RegExp(
    '^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    'i',
  )
  return re.test(filename)
}

export function isBinaryFile(fp: string): boolean {
  try {
    const buf = fs.readFileSync(fp).slice(0, 512)
    return buf.includes(0) || buf.filter(b => b < 9 && b !== 0x0a && b !== 0x0d && b !== 0x09).length > 1
  } catch {
    return true
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
