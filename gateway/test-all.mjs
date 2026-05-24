/**
 * Run all gateway smoke tests (requires gateway listening on :18765).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const tests = ["test-e2e.mjs", "test-ui-event.mjs", "test-acceptance.mjs"];

async function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(dir, file)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`))));
  });
}

async function main() {
  for (const t of tests) {
    console.log(`\n========== ${t} ==========\n`);
    await run(t);
  }
  console.log("\n[test-all] all passed");
}

main().catch((e) => {
  console.error("[test-all] FAIL", e.message);
  process.exit(1);
});
