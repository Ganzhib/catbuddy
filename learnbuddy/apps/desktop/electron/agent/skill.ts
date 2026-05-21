/**
 * Skill discovery and enable/disable — mirrors context.ts scanning rules.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SkillInfo } from "@learnbuddy/shared"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Bundled main lives in dist-electron/ → ../skills is the app skills root. */
export function resolveBuiltinSkillsDir(): string {
  return path.resolve(__dirname, '../skills')
}

export const ALWAYS_ON_SKILLS = new Set(['memory', 'my'])

function parseFrontmatterDescription(md: string): string {
  const match = md.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return ''
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^description:\s*(.+)$/i)
    if (kv) return kv[1].trim()
  }
  return ''
}

function scanSkillsRoot(
  root: string,
  isBuiltin: boolean,
  disabled: Set<string>,
  seen: Set<string>,
  out: SkillInfo[],
): void {
  let entries: string[]
  try {
    entries = fs.readdirSync(root)
  } catch {
    return
  }

  for (const dir of entries) {
    if (seen.has(dir)) continue
    const skillPath = path.join(root, dir, 'SKILL.md')
    try {
      if (!fs.statSync(path.join(root, dir)).isDirectory()) continue
      if (!fs.existsSync(skillPath)) continue
    } catch {
      continue
    }

    seen.add(dir)
    const raw = fs.readFileSync(skillPath, 'utf-8')
    const alwaysOn = ALWAYS_ON_SKILLS.has(dir)
    out.push({
      name: dir,
      description: parseFrontmatterDescription(raw),
      enabled: alwaysOn || !disabled.has(dir),
      isBuiltin,
    })
  }
}

export function listDiscoverableSkills(
  workspace: string,
  disabledSkills: Iterable<string>,
): SkillInfo[] {
  const disabled = new Set(disabledSkills)
  const seen = new Set<string>()
  const result: SkillInfo[] = []

  scanSkillsRoot(resolveBuiltinSkillsDir(), true, disabled, seen, result)
  scanSkillsRoot(path.join(workspace, 'skills'), false, disabled, seen, result)

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

export function applySkillToggle(
  disabledSkills: Iterable<string>,
  name: string,
  enabled: boolean,
): string[] {
  if (ALWAYS_ON_SKILLS.has(name)) {
    return [...disabledSkills]
  }
  const disabled = new Set(disabledSkills)
  if (enabled) {
    disabled.delete(name)
  } else {
    disabled.add(name)
  }
  return [...disabled].sort()
}
