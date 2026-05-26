import * as fs from 'fs'

/**
 * Simple glob matching — supports *, **, ?, {a,b}.
 * matchBase: match only basename.
 * dot: match dot-files (without this, *.ts won't match .config.ts).
 */
export function matchGlob(filename: string, glob: string): boolean {
  const re = new RegExp(
    '^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    'i',
  )
  return re.test(filename)
}

/** Advanced glob matching with **, {a,b}, matchBase, and dot support. */
export function simpleGlob(
  str: string,
  pattern: string,
  options?: { dot?: boolean; matchBase?: boolean },
): boolean {
  if (!pattern) return false
  const dot = options?.dot ?? false
  const matchBase = options?.matchBase ?? false
  const target = str.replace(/\\/g, '/')
  const pat = pattern.replace(/\\/g, '/')

  // matchBase: match against filename only
  if (matchBase) {
    const base = target.split('/').pop() ?? target
    if (simpleGlob(base, pattern, { dot })) return true
  }

  // Build regex from pattern
  let regexStr = ''
  let i = 0
  const braceStack: number[] = []
  while (i < pat.length) {
    const ch = pat[i]
    if (ch === '{') {
      braceStack.push(regexStr.length)
      regexStr += '('
    } else if (ch === '}') {
      if (braceStack.pop() !== undefined) regexStr += ')'
      else regexStr += '\\}'
    } else if (ch === ',' && braceStack.length > 0) {
      regexStr += '|'
    } else if (ch === '*' && pat[i + 1] === '*') {
      regexStr += '.*'
      i++
      if (pat[i + 1] === '/') i++
    } else if (ch === '*') {
      regexStr += '[^/]*'
    } else if (ch === '?') {
      regexStr += '[^/]'
    } else if (/[.+^$()\[\]|]/.test(ch)) {
      regexStr += '\\' + ch
    } else {
      regexStr += ch
    }
    i++
  }
  if (braceStack.length > 0) return target.includes(pat.replace(/[{}]/g, ''))
  const fullPattern = dot
    ? '^' + regexStr + '$'
    : '^(?:(?!\\.)[^/]*?|' + regexStr + ')$'
  try {
    return new RegExp(fullPattern, 'i').test(target)
  } catch {
    return target.includes(pat)
  }
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
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}
