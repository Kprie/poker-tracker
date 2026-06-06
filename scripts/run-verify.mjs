// Plattformübergreifender Runner für die verify-*.mjs-Skripte.
// Bündelt das Ziel-Skript (das .ts-Module importiert) via esbuild in eine
// temporäre Datei und führt es aus. Exit-Code wird durchgereicht.
//
//   node scripts/run-verify.mjs scripts/verify-b6.mjs
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const entry = process.argv[2]
if (!entry) {
  console.error('Usage: node scripts/run-verify.mjs <script.mjs>')
  process.exit(2)
}

const out = join(tmpdir(), `verify-${process.pid}-${Date.now()}.mjs`)
try {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: out,
    logLevel: 'warning',
  })
  await import(pathToFileURL(out).href)
} finally {
  try { rmSync(out, { force: true }) } catch { /* ignore */ }
}
