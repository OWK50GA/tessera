import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const coreDir = resolve(scriptDir, '../../core')
const tscName = process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
const coreTsc = resolve(coreDir, 'node_modules', '.bin', tscName)

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (!existsSync(coreTsc)) {
  run('pnpm', ['install', '--frozen-lockfile'], coreDir)
}

run(coreTsc, ['-p', 'tsconfig.build.json'], coreDir)
