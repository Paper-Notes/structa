import { compile } from '../compiler'
import { describe } from '../i18n'
import { COLORS, RELATION_KEYWORDS, ROUTE_SPELLING, SHAPE_KEYWORDS, STATEMENT_KEYWORDS, TAG_SUGGESTIONS } from '../language'
import { tokenizeLine, type Token } from '../lexer'
import type { StructaModel, StructaNode } from '../model'

export type Completion = { label: string; kind: 'keyword' | 'id' | 'value' | 'snippet' | 'tag'; detail?: string; insert?: string }

const SHAPES = Object.keys(SHAPE_KEYWORDS)
const RELATIONS = Object.keys(RELATION_KEYWORDS)
const SNIPPETS: Completion[] = [
  { label: 'class', kind: 'snippet', detail: 'class Name:', insert: 'class Name:\n    field: str\n    def method() -> None' },
  { label: 'system', kind: 'snippet', detail: 'system id "Name":', insert: 'system app "App":\n    usecase action "Do something"' },
  { label: 'let', kind: 'snippet', detail: 'let name = "text"', insert: 'let name = "text"' },
]

export const kindName = (node: StructaNode) => (node.kind !== 'class' ? node.kind : node.tag === 'module' ? 'module' : node.classKind === 'class' ? 'class' : node.classKind!)

const keyword = (word: string): Completion => ({ label: word, kind: 'keyword', detail: describe(word)?.text })

const identifiers = (model: StructaModel): Completion[] =>
  model.nodes.map((node) => ({ label: node.id, kind: 'id', detail: `${kindName(node)}${node.label && node.label !== node.id ? ` · ${node.label}` : ''}` }))

function insideOptions(prefix: string): Completion[] | null {
  if (prefix.lastIndexOf('[') <= prefix.lastIndexOf(']')) return null
  if (/(color|cor)\s*=\s*\w*$/.test(prefix)) return COLORS.map((color) => ({ label: color, kind: 'value' }))
  if (/(route|rota)\s*=\s*\w*$/.test(prefix)) return Object.values(ROUTE_SPELLING).map((route) => ({ label: route, kind: 'value' }))
  return ['color', 'route', 'from'].map((option) => ({ label: option, kind: 'keyword', insert: `${option}=` }))
}

export function complete(source: string, line: number, col: number): Completion[] {
  const prefix = (source.replace(/\r\n?/g, '\n').split('\n')[line - 1] ?? '').slice(0, col - 1)
  const options = insideOptions(prefix)
  if (options) return options
  const tokens = tokenizeLine(prefix).tokens
  const last = tokens[tokens.length - 1]
  const typing = last && last.end === col && (last.type === 'id' || last.value === '@')
  const settled: Token[] = typing ? tokens.slice(0, -1) : tokens
  const previous = settled[settled.length - 1]
  if (last?.value === '@' || previous?.value === '@') return TAG_SUGGESTIONS.map((tag) => ({ label: tag, kind: 'tag', detail: '«stereotype»' }))
  const { model } = compile(source)
  if (previous && RELATIONS.includes(previous.value)) {
    const multiplicity = previous.value === 'has' || previous.value === 'groups' ? ['many', 'one', 'optional'].map(keyword) : []
    return [...multiplicity, ...identifiers(model)]
  }
  if (settled.length === 1 && settled[0].type === 'id' && !SHAPES.includes(settled[0].value)) return RELATIONS.map(keyword)
  if (/^\s*(abstract\s+)?class\s+\w+\(/.test(prefix) && !prefix.includes(')')) return identifiers(model).filter((item) => model.nodes.find((node) => node.id === item.label)?.kind === 'class')
  if (settled.length === 0) return [...SHAPES.map(keyword), { ...keyword('abstract'), label: 'abstract class' }, ...SNIPPETS, ...identifiers(model), ...STATEMENT_KEYWORDS.map(keyword)]
  return []
}
