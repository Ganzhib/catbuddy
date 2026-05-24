import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const rules = [
  [/from ['"]@\/lib\/types['"]/g, 'from "@catbuddy/shared"'],
  [/from ['"]@\/lib\/catbuddy-client['"]/g, 'from "@catbuddy/client"'],
  [/from ['"]@\/lib\/bootstrap['"]/g, 'from "@catbuddy/platform"'],
  [/from ['"]@\/lib\/api['"]/g, 'from "@catbuddy/platform"'],
  [/from ['"]\.\.\/\.\.\/shared\/types(\.js)?['"]/g, 'from "@catbuddy/shared"'],
  [/from ['"]\.\.\/\.\.\/shared\/relay(\.js)?['"]/g, 'from "@catbuddy/shared"'],
  [/from ['"]@shared\/brand\.mjs['"]/g, 'from "@catbuddy/shared/brand"'],
  [/from ['"]\.\.\/\.\.\/\.\.\/shared\/types(\.js)?['"]/g, 'from "@catbuddy/shared"'],
  [/from ['"]@\/lib\/tool-traces['"]/g, 'from "@catbuddy/client"'],
  [/from ['"]\.\.\/tool-traces['"]/g, 'from "@catbuddy/client"'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'dist-electron') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const dirs = [
  path.join(root, 'packages/ui/src'),
  path.join(root, 'packages/client/src'),
  path.join(root, 'apps/desktop/electron'),
]

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue
  for (const file of walk(dir)) {
    let text = fs.readFileSync(file, 'utf8')
    let next = text
    for (const [re, rep] of rules) {
      next = next.replace(re, typeof rep === 'function' ? (...a) => rep(...a, file) : rep)
    }
    if (next !== text) fs.writeFileSync(file, next, 'utf8')
  }
}

// client event-mappers: relative tool-traces
const em = path.join(root, 'packages/client/src/transport/event-mappers.ts')
if (fs.existsSync(em)) {
  let t = fs.readFileSync(em, 'utf8')
  t = t.replace(/from ["']\.\.\/tool-traces["']/, 'from "../tool-traces"')
  t = t.replace(/from ["']@\/lib\/tool-traces["']/, 'from "../tool-traces"')
  fs.writeFileSync(em, t, 'utf8')
}

console.log('imports updated')
