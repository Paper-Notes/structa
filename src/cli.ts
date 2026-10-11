import { readFileSync, writeFileSync } from 'node:fs'
import { compile, type CompileResult } from './compiler'
import { toMermaid } from './emit/mermaid'
import { toPlantUml } from './emit/plantuml'
import { format } from './formatter'
import { setLang } from './i18n'
import { VERSION } from './language'
import type { StructaModel } from './model'
import { print } from './printer'

const USAGE = `Structa ${VERSION}

  structa check   <file.sct>
  structa fmt     <file.sct> [--write | --check]
  structa compile <file.sct> [--to json|mermaid|plantuml|sct] [-o <out>]
  structa lsp
`

const EXIT = { ok: 0, failed: 1, usage: 2 } as const

const EMITTERS: Readonly<Record<string, (model: StructaModel) => string>> = {
  json: (model) => `${JSON.stringify({ structa: VERSION, title: model.title, nodes: model.nodes.map(({ span: _, ...node }) => node), relations: model.relations.map(({ span: _, ...relation }) => relation) }, null, 2)}\n`,
  mermaid: toMermaid,
  plantuml: toPlantUml,
  sct: (model) => print(model),
}

type Args = { command?: string; file?: string; flags: Set<string>; values: Map<string, string> }

function parseArgs(argv: string[]): Args {
  const args: Args = { flags: new Set(), values: new Map() }
  const positional: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--to' || arg === '-o') args.values.set(arg, argv[++index] ?? '')
    else if (arg.startsWith('-')) args.flags.add(arg)
    else positional.push(arg)
  }
  ;[args.command, args.file] = positional
  return args
}

function read(file: string | undefined) {
  if (!file) {
    process.stderr.write(USAGE)
    process.exit(EXIT.usage)
  }
  return readFileSync(file, 'utf8')
}

function report(file: string, result: CompileResult) {
  for (const diagnostic of result.diagnostics) process.stderr.write(`${file}:${diagnostic.line}:${diagnostic.col} ${diagnostic.severity}: ${diagnostic.message}\n`)
  return result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

function check(args: Args) {
  const result = compile(read(args.file))
  if (report(args.file!, result)) return EXIT.failed
  process.stdout.write(`${args.file}: ok (${result.model.nodes.length} shapes, ${result.model.relations.length} relations)\n`)
  return EXIT.ok
}

function fmt(args: Args) {
  const source = read(args.file)
  const formatted = format(source)
  if (args.flags.has('--check')) return formatted === source ? EXIT.ok : EXIT.failed
  if (args.flags.has('--write')) writeFileSync(args.file!, formatted)
  else process.stdout.write(formatted)
  return EXIT.ok
}

function build(args: Args) {
  const result = compile(read(args.file))
  if (report(args.file!, result)) return EXIT.failed
  const target = args.values.get('--to') ?? 'json'
  const emit = EMITTERS[target]
  if (!emit) {
    process.stderr.write(`Unknown target "${target}". Use ${Object.keys(EMITTERS).join(', ')}.\n`)
    return EXIT.usage
  }
  const output = emit(result.model)
  const destination = args.values.get('-o')
  if (destination) writeFileSync(destination, output)
  else process.stdout.write(output)
  return EXIT.ok
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.flags.has('--pt') || process.env.LANG?.startsWith('pt')) setLang('pt')
  switch (args.command) {
    case 'check':
      return check(args)
    case 'fmt':
      return fmt(args)
    case 'compile':
      return build(args)
    case 'lsp':
      await import('./lsp')
      return null
    case 'version':
      process.stdout.write(`${VERSION}\n`)
      return EXIT.ok
    default:
      process.stdout.write(USAGE)
      return args.command ? EXIT.usage : EXIT.ok
  }
}

main().then((code) => {
  if (code !== null) process.exitCode = code
})
