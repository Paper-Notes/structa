import { build } from 'esbuild'

const shared = { bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'warning' }
const executable = { ...shared, banner: { js: '#!/usr/bin/env node' } }

await Promise.all([
  build({ ...shared, entryPoints: ['src/index.ts'], outfile: 'dist/structa.mjs' }),
  build({ ...executable, entryPoints: ['src/cli.ts'], outfile: 'dist/cli.mjs' }),
  build({ ...executable, entryPoints: ['src/lsp.ts'], outfile: 'dist/lsp.mjs' }),
])
