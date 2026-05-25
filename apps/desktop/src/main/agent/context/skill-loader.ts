import * as fs from 'fs'
import * as path from 'path'
import { ALWAYS_ON_SKILLS, listDiscoverableSkills, resolveBuiltinSkillsDir } from '../skill.js'

const ALWAYS_LOAD_SKILLS = ['memory', 'my'] as const

function stripFrontmatter(md: string): string {
  const match = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  return match ? match[2].trim() : md.trim()
}

export class SkillLoader {
  constructor(
    readonly workspace: string,
    readonly disabledSkills: Set<string>,
  ) {}

  loadAlwaysSkills(): string {
    const parts: string[] = []
    for (const name of ALWAYS_LOAD_SKILLS) {
      const content = this.readSkill(name)
      if (content) parts.push(content)
    }
    return parts.join('\n\n')
  }

  readSkill(name: string): string {
    const workspaceSkill = path.join(this.workspace, 'skills', name, 'SKILL.md')
    const builtinSkill = path.join(resolveBuiltinSkillsDir(), name, 'SKILL.md')

    for (const p of [workspaceSkill, builtinSkill]) {
      try {
        const raw = fs.readFileSync(p, 'utf-8')
        return stripFrontmatter(raw)
      } catch {}
    }
    return ''
  }

  buildSkillsSummary(): string {
    const skills = listDiscoverableSkills(this.workspace, this.disabledSkills)
      .filter((s) => !ALWAYS_ON_SKILLS.has(s.name) && s.enabled)

    if (skills.length === 0) return ''

    return skills.map((s) => `- **${s.name}**: ${s.description}`).join('\n')
  }

  /** Cheap mtime fingerprint for system-prompt cache invalidation. */
  fingerprint(): string {
    const ws = skillDirFingerprint(path.join(this.workspace, 'skills'))
    const builtin = skillDirFingerprint(resolveBuiltinSkillsDir())
    const disabled = [...this.disabledSkills].sort().join(',')
    return `${ws}|${builtin}|${disabled}`
  }
}

function skillDirFingerprint(root: string): string {
  try {
    return fs.readdirSync(root)
      .sort()
      .map((dir) => {
        const skillMd = path.join(root, dir, 'SKILL.md')
        try {
          return `${dir}:${fs.statSync(skillMd).mtimeMs}`
        } catch {
          return ''
        }
      })
      .filter(Boolean)
      .join(',')
  } catch {
    return ''
  }
}
