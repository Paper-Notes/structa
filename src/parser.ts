import { message } from './i18n'
import { COLOR_ALIASES, COLORS, isMultiplicity, LIMITS, MULTIPLICITY_WORDS, RELATION_KEYWORDS, RELATIONS_WITH_MULTIPLICITY, ROUTE_ALIASES, SHAPE_KEYWORDS, type ShapeKeyword } from './language'
import { tokenizeLine, type Token } from './lexer'
import { memberToUml } from './members'
import type { ClassKind, Diagnostic, RelationKind, Route, Severity, ShapeKind, Span } from './model'

export type Options = { color?: string; route?: Route; from?: string }

export type Link = { from: Token; op: Token; kind: RelationKind; multiplicity?: Token[]; to: Token }

export type Statement =
  | { type: 'blank'; line: number }
  | { type: 'comment'; line: number; indent: number; text: string }
  | { type: 'let'; line: number; indent: number; name: Token; value: Token; comment?: string }
  | { type: 'title'; line: number; indent: number; value: Token; comment?: string }
  | { type: 'tag'; line: number; indent: number; value: Token; comment?: string }
  | { type: 'decl'; line: number; indent: number; keyword: string; shape: ShapeKind; classKind?: ClassKind; implicitTag?: string; id: Token; bases: Token[]; label?: Token; options: Options; block: boolean; inline: boolean; comment?: string }
  | { type: 'rel'; line: number; indent: number; chain: Link[]; label?: Token; options: Options; comment?: string }
  | { type: 'member'; line: number; indent: number; text: string; uml: string; method: boolean; comment?: string }
  | { type: 'layout'; line: number; indent: number; comment?: string }
  | { type: 'pos'; line: number; indent: number; id: Token; x: number; y: number; w?: number; h?: number; comment?: string }
  | { type: 'error'; line: number; indent: number; text: string }

export type Occurrence = { id: string; span: Span; declaration: boolean }

export type ParseResult = {
  statements: Statement[]
  diagnostics: Diagnostic[]
  occurrences: Occurrence[]
  variables: Map<string, { value: string; line: number }>
}

type Block = { indent: number; kind: 'class' | 'container' | 'layout'; id?: string; line: number; used: boolean }
type Line = { line: number; indent: number; text: string; tokens: Token[]; comment?: string }

const LAYOUT_ENTRY = /^([\p{L}_][\p{L}\p{N}_]*)\s+at\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s+size\s+(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?))?$/u
const EMPTY_BODY = new Set(['pass', '...'])

export const spanOf = (line: number, token: Pick<Token, 'col' | 'end'>): Span => ({ line, col: token.col, endCol: token.end })
const isRelationWord = (token?: Token) => !!token && RELATION_KEYWORDS[token.value] !== undefined
const stripTrailingComment = (text: string) => text.replace(/\s+#.*$/, '').trim()

class Parser {
  private readonly statements: Statement[] = []
  private readonly diagnostics: Diagnostic[] = []
  private readonly occurrences: Occurrence[] = []
  private readonly variables = new Map<string, { value: string; line: number }>()
  private readonly blocks: Block[] = []

  parse(source: string): ParseResult {
    if (source.length > LIMITS.chars) return this.reject(message('tooLong', { max: LIMITS.chars }))
    const lines = source.replace(/\r\n?/g, '\n').split('\n')
    if (lines.length > LIMITS.lines) return this.reject(message('tooManyLines', { max: LIMITS.lines }))
    lines.forEach((text, index) => this.parseLine(text.replace(/\t/g, '    '), index + 1))
    this.closeBlocks(-1)
    return { statements: this.statements, diagnostics: this.diagnostics, occurrences: this.occurrences, variables: this.variables }
  }

  private reject(text: string): ParseResult {
    this.report({ line: 1, col: 1, endCol: 2 }, text, 'limit')
    return { statements: [], diagnostics: this.diagnostics, occurrences: [], variables: this.variables }
  }

  private report(span: Span, text: string, code: string, severity: Severity = 'error', fix?: Diagnostic['fix']) {
    this.diagnostics.push({ ...span, severity, code, message: text, ...(fix ? { fix } : {}) })
  }

  private fail(line: Line, text: string, code: string, from = line.indent + 1) {
    this.report({ line: line.line, col: from, endCol: line.text.length + 1 }, text, code)
    this.statements.push({ type: 'error', line: line.line, indent: line.indent, text: line.text.trim() })
    return true
  }

  private parseLine(text: string, lineNumber: number) {
    const indent = text.length - text.trimStart().length
    const lexed = tokenizeLine(text)
    if (lexed.unclosedStringAt) {
      this.report({ line: lineNumber, col: lexed.unclosedStringAt, endCol: text.length + 1 }, message('unclosedString'), 'string')
      this.statements.push({ type: 'error', line: lineNumber, indent, text: text.trim() })
      return
    }
    if (!lexed.tokens.length) {
      this.statements.push(lexed.comment !== undefined ? { type: 'comment', line: lineNumber, indent, text: lexed.comment } : { type: 'blank', line: lineNumber })
      return
    }
    this.closeBlocks(indent)
    const block = this.blocks[this.blocks.length - 1]
    if (block) block.used = true
    const line: Line = { line: lineNumber, indent, text, tokens: lexed.tokens, comment: lexed.comment }
    if (this.blocks.length > LIMITS.depth) return this.fail(line, message('tooDeep', { max: LIMITS.depth }), 'limit', 1)
    if (block?.kind === 'class') return this.parseMember(line)
    if (block?.kind === 'layout') return this.parseLayoutEntry(line)
    if (indent > 0 && !block) this.report({ line: lineNumber, col: 1, endCol: indent + 1 }, message('badIndent'), 'indent', 'warning')
    return this.parseLet(line) || this.parseTitle(line) || this.parseTag(line) || this.parseLayoutHeader(line) || this.parseDeclaration(line) || this.parseRelation(line) || this.fail(line, message('unknownStatement'), 'syntax', line.tokens[0].col)
  }

  private closeBlocks(indent: number) {
    while (this.blocks.length && indent <= this.blocks[this.blocks.length - 1].indent) {
      const closed = this.blocks.pop()!
      if (!closed.used && closed.kind !== 'layout') this.report({ line: closed.line, col: 1, endCol: 2 }, message('emptyContainer', { id: closed.id ?? '' }), 'empty', 'warning')
    }
  }

  private parseMember(line: Line) {
    const text = stripTrailingComment(line.text.slice(line.indent))
    if (EMPTY_BODY.has(text)) {
      this.statements.push({ type: 'comment', line: line.line, indent: line.indent, text: '' })
      return true
    }
    const raw = line.tokens[0].type === 'str' ? { uml: line.tokens[0].value, method: false } : memberToUml(text)
    if (!raw) return this.fail(line, message('badMember'), 'member')
    this.statements.push({ type: 'member', line: line.line, indent: line.indent, text, uml: raw.uml, method: raw.method, comment: line.comment })
    return true
  }

  private parseLayoutEntry(line: Line) {
    const entry = LAYOUT_ENTRY.exec(stripTrailingComment(line.text.slice(line.indent)))
    if (!entry) return this.fail(line, message('badLayout'), 'layout')
    const [, name, x, y, w, h] = entry
    const id: Token = { type: 'id', value: name, col: line.indent + 1, end: line.indent + 1 + name.length }
    this.occurrences.push({ id: name, span: spanOf(line.line, id), declaration: false })
    this.statements.push({ type: 'pos', line: line.line, indent: line.indent, id, x: Number(x), y: Number(y), ...(w ? { w: Number(w), h: Number(h) } : {}), comment: line.comment })
    return true
  }

  private parseLet(line: Line) {
    const [keyword, name, equals, value] = line.tokens
    if (keyword.type !== 'id' || keyword.value !== 'let') return false
    const valid = name?.type === 'id' && equals?.value === '=' && (value?.type === 'str' || value?.type === 'num')
    if (!valid) return this.fail(line, message('unknownStatement'), 'syntax', keyword.col)
    this.variables.set(name.value, { value: value.value, line: line.line })
    this.statements.push({ type: 'let', line: line.line, indent: line.indent, name, value, comment: line.comment })
    return true
  }

  private parseTitle(line: Line) {
    const [keyword, value] = line.tokens
    if (keyword.value !== 'title' || value?.type !== 'str') return false
    this.statements.push({ type: 'title', line: line.line, indent: line.indent, value, comment: line.comment })
    return true
  }

  private parseTag(line: Line) {
    const [at, value] = line.tokens
    if (at.value !== '@' || !value || (value.type !== 'id' && value.type !== 'str')) return false
    this.statements.push({ type: 'tag', line: line.line, indent: line.indent, value, comment: line.comment })
    return true
  }

  private parseLayoutHeader(line: Line) {
    const [keyword, colon] = line.tokens
    if (keyword.value !== 'layout' || colon?.value !== ':') return false
    this.blocks.push({ indent: line.indent, kind: 'layout', line: line.line, used: false })
    this.statements.push({ type: 'layout', line: line.line, indent: line.indent, comment: line.comment })
    return true
  }

  private parseDeclaration(line: Line) {
    const { tokens } = line
    const abstract = tokens[0].value === 'abstract' && tokens[1]?.value === 'class'
    const keyword = abstract ? 'abstract class' : tokens[0].value
    const shape: ShapeKeyword | undefined = tokens[0].type === 'id' ? SHAPE_KEYWORDS[abstract ? 'class' : keyword] : undefined
    let cursor = abstract ? 2 : 1
    if (!shape || isRelationWord(tokens[cursor])) return false
    const id = tokens[cursor]
    if (id?.type !== 'id') return this.fail(line, message('expectedId'), 'id', tokens[0].col)
    cursor++
    const bases = shape.kind === 'class' && tokens[cursor]?.value === '(' ? this.readBases(tokens, cursor) : { bases: [], next: cursor }
    cursor = bases.next
    const label = tokens[cursor]?.type === 'str' ? tokens[cursor++] : undefined
    const options = this.readOptions(tokens, cursor, line.line)
    cursor = options.next
    const opensBlock = tokens[cursor]?.value === ':'
    const inline = opensBlock && (tokens[cursor + 1]?.value === '..' || tokens[cursor + 1]?.value === '.')
    const canHoldChildren = shape.kind === 'class' || shape.kind === 'system' || shape.kind === 'package'
    const block = opensBlock && !inline && canHoldChildren
    this.occurrences.push({ id: id.value, span: spanOf(line.line, id), declaration: true })
    for (const base of bases.bases) this.occurrences.push({ id: base.value, span: spanOf(line.line, base), declaration: false })
    this.statements.push({ type: 'decl', line: line.line, indent: line.indent, keyword, shape: shape.kind, classKind: abstract ? 'abstract' : shape.classKind, implicitTag: shape.tag, id, bases: bases.bases, label, options: options.value, block, inline, comment: line.comment })
    if (block) this.blocks.push({ indent: line.indent, kind: shape.kind === 'class' ? 'class' : 'container', id: id.value, line: line.line, used: false })
    return true
  }

  private readBases(tokens: Token[], open: number) {
    const bases: Token[] = []
    let cursor = open + 1
    for (; tokens[cursor] && tokens[cursor].value !== ')'; cursor++) if (tokens[cursor].type === 'id') bases.push(tokens[cursor])
    return { bases, next: cursor + 1 }
  }

  private parseRelation(line: Line) {
    const { tokens } = line
    if (tokens[0].type !== 'id' || !isRelationWord(tokens[1])) return false
    const chain: Link[] = []
    let from = tokens[0]
    let cursor = 1
    while (isRelationWord(tokens[cursor])) {
      const op = tokens[cursor++]
      const kind = RELATION_KEYWORDS[op.value]
      const multiplicity = RELATIONS_WITH_MULTIPLICITY.has(kind) ? this.readMultiplicity(tokens, cursor, line.line) : []
      cursor += multiplicity.length
      const to = tokens[cursor]
      if (to?.type !== 'id') {
        this.report(spanOf(line.line, op), message('expectedTarget', { from: from.value }), 'target')
        this.statements.push({ type: 'error', line: line.line, indent: line.indent, text: line.text.trim() })
        return true
      }
      chain.push({ from, op, kind, ...(multiplicity.length ? { multiplicity } : {}), to })
      this.occurrences.push({ id: from.value, span: spanOf(line.line, from), declaration: false })
      from = to
      cursor++
    }
    this.occurrences.push({ id: from.value, span: spanOf(line.line, from), declaration: false })
    const label = tokens[cursor]?.type === 'str' ? tokens[cursor++] : undefined
    const options = this.readOptions(tokens, cursor, line.line)
    const leftover = tokens[options.next]
    if (leftover) this.report({ line: line.line, col: leftover.col, endCol: line.text.length + 1 }, message('unknownStatement'), 'syntax')
    this.statements.push({ type: 'rel', line: line.line, indent: line.indent, chain, label, options: options.value, comment: line.comment })
    return true
  }

  private readMultiplicity(tokens: Token[], start: number, line: number) {
    const parts: Token[] = []
    for (let cursor = start; tokens[cursor] && tokens[cursor + 1] && parts.length <= LIMITS.multiplicityTokens; cursor++) {
      const token = tokens[cursor]
      const isPart = token.type === 'num' || token.value === '*' || token.value === '..' || (token.type === 'id' && token.value in MULTIPLICITY_WORDS && tokens[cursor + 1].type === 'id')
      if (!isPart) break
      parts.push(token)
    }
    const text = parts.map((part) => part.value).join('')
    if (parts.length && !isMultiplicity(text)) this.report({ line, col: parts[0].col, endCol: parts[parts.length - 1].end }, message('badMultiplicity', { value: text }), 'multiplicity')
    return parts
  }

  private readOptions(tokens: Token[], start: number, line: number): { value: Options; next: number } {
    const value: Options = {}
    if (tokens[start]?.value !== '[') return { value, next: start }
    let cursor = start + 1
    while (tokens[cursor] && tokens[cursor].value !== ']') {
      const key = tokens[cursor]
      if (key.value === ',') {
        cursor++
        continue
      }
      const setting = tokens[cursor + 2]
      if (key.type !== 'id' || tokens[cursor + 1]?.value !== '=' || !setting) {
        this.report(spanOf(line, key), message('unknownOption', { name: key.value }), 'option')
        cursor++
        continue
      }
      this.applyOption(value, key, setting, line)
      cursor += 3
    }
    return { value, next: cursor + 1 }
  }

  private applyOption(options: Options, key: Token, setting: Token, line: number) {
    const name = key.value.toLowerCase()
    const raw = setting.value.toLowerCase()
    if (name === 'color' || name === 'cor') {
      const color = COLOR_ALIASES[raw] ?? raw
      if ((COLORS as readonly string[]).includes(color)) options.color = color
      else this.report(spanOf(line, setting), message('badColor', { value: setting.value, list: COLORS.join(', ') }), 'color')
    } else if (name === 'route' || name === 'rota') {
      const route = ROUTE_ALIASES[raw]
      if (route) options.route = route
      else this.report(spanOf(line, setting), message('badRoute', { value: setting.value }), 'route')
    } else if (name === 'from' || name === 'de') options.from = setting.value
    else this.report(spanOf(line, key), message('unknownOption', { name: key.value }), 'option')
  }
}

export const parse = (source: string): ParseResult => new Parser().parse(source)
