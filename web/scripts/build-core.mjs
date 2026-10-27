import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, statSync } from 'node:fs'
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

// A pnpm `file:` dependency may be a copied package rather than a symlink.
// Keep its generated dist in sync with the freshly built core package.
const localCorePackage = resolve(scriptDir, '../node_modules/@tessera/core')
if (existsSync(localCorePackage)) {
  const coreDist = resolve(realpathSync(coreDir), 'dist')
  const localDist = resolve(realpathSync(localCorePackage), 'dist')
  if (coreDist !== localDist) {
    mkdirSync(localDist, { recursive: true })
    for (const entry of readdirSync(coreDist)) {
      const source = resolve(coreDist, entry)
      const target = resolve(localDist, entry)
      if (existsSync(target)) {
        const sourceStat = statSync(source)
        const targetStat = statSync(target)
        if (sourceStat.dev === targetStat.dev && sourceStat.ino === targetStat.ino) continue
      }
      cpSync(source, target, { force: true })
    }
  }
}
