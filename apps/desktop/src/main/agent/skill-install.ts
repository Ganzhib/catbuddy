/**
 * Copy a built-in skill directory into the user workspace.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { resolveBuiltinSkillsDir } from './skill.js'

export function isSkillInstalledInWorkspace(workspace: string, skillName: string): boolean {
  return fs.existsSync(path.join(workspace, 'skills', skillName, 'SKILL.md'))
}

export function installBuiltinSkillToWorkspace(
  skillName: string,
  workspace: string,
): { dest: string; alreadyInstalled: boolean } {
  const builtinRoot = resolveBuiltinSkillsDir()
  const src = path.join(builtinRoot, skillName)
  const skillMd = path.join(src, 'SKILL.md')

  if (!fs.existsSync(skillMd)) {
    throw new Error(`Built-in skill not found: ${skillName}`)
  }

  const dest = path.join(workspace, 'skills', skillName)
  if (isSkillInstalledInWorkspace(workspace, skillName)) {
    return { dest, alreadyInstalled: true }
  }

  fs.mkdirSync(path.join(workspace, 'skills'), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: false })
  return { dest, alreadyInstalled: false }
}
