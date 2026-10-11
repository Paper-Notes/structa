import { message } from './i18n'
import { isIdentifier, LIMITS, MULTIPLICITY_WORDS } from './language'
import type { Token } from './lexer'
import type { Diagnostic, Severity, Span, StructaModel, StructaNode, StructaRelation } from './model'
import { parse, spanOf, type ParseResult, type Statement } from './parser'
import { closest } from './suggest'

export type CompileResult = ParseResult & { model: StructaModel }

type Declaration = Extract<Statement, { type: 'decl' }>
type Position = { x: number; y: number; w?: number; h?: number }
type Scope = { indent: number; id: string }

const INTERPOLATION = /\{\{|\}\}|\{([\p{L}_][\p{L}\p{N}_]*)\}/gu

function defaultLabel(declaration: Declaration) {
  if (declaration.shape === 'start' || declaration.shape === 'end') return ''
  return declaration.shape === 'class' ? declaration.id.value : declaration.id.value.replace(/_/g, ' ')
}

class Compiler {
  private readonly model: StructaModel = { nodes: [], relations: [] }
  private readonly nodes = new Map<string, StructaNode>()
  private readonly positions = new Map<string, Position>()
  private readonly containers: Scope[] = []
  private currentClass: { node: StructaNode; indent: number } | null = null
  private pendingTag: string | undefined
  private readonly parsed: ParseResult

  constructor(parsed: ParseResult) {
    this.parsed = parsed
  }

  compile(): CompileResult {
    for (const statement of this.parsed.statements) this.visit(statement)
    this.reportUnknownIds()
    this.model.relations = this.model.relations.filter((relation) => this.validateRelation(relation)).slice(0, LIMITS.relations)
    this.applyLayout()
    this.parsed.diagnostics.sort((a, b) => a.line - b.line || a.col - b.col)
    return { ...this.parsed, model: this.model }
  }

  private report(span: Span, text: string, code: string, severity: Severity = 'error', fix?: Diagnostic['fix']) {
    this.parsed.diagnostics.push({ ...span, severity, code, message: text, ...(fix ? { fix } : {}) })
  }

  private text(token: Token, line: number) {
    return token.value
      .replace(INTERPOLATION, (whole, name?: string) => {
        if (whole === '{{') return '{'
        if (whole === '}}') return '}'
        const variable = this.parsed.variables.get(name!)
        if (variable) return variable.value
        this.report(spanOf(line, token), message('unknownVar', { name: name! }), 'variable')
        return whole
      })
      .slice(0, LIMITS.label)
  }

  private leaveScopes(statement: Statement) {
    if (statement.type === 'blank' || statement.type === 'comment') return
    if (this.currentClass && statement.indent <= this.currentClass.indent) this.currentClass = null
    while (this.containers.length && statement.indent <= this.containers[this.containers.length - 1].indent) this.containers.pop()
  }

  private visit(statement: Statement) {
    this.leaveScopes(statement)
    switch (statement.type) {
      case 'title':
        this.model.title = this.text(statement.value, statement.line)
        return
      case 'tag':
        this.pendingTag = statement.value.value
        return
      case 'decl':
        return this.declare(statement)
      case 'member':
        return this.addMember(statement)
      case 'rel':
        return this.relate(statement)
      case 'pos':
        this.positions.set(statement.id.value, { x: statement.x, y: statement.y, w: statement.w, h: statement.h })
        return
    }
  }

  private declare(statement: Declaration) {
    const id = statement.id.value
    const span = spanOf(statement.line, statement.id)
    if (!isIdentifier(id)) this.report(span, message('badId', { id }), 'id')
    const existing = this.nodes.get(id)
    if (existing) return this.report(span, message('duplicateId', { id, line: existing.span.line }), 'duplicate')
    if (this.model.nodes.length >= LIMITS.nodes) return this.report(span, message('tooManyNodes', { max: LIMITS.nodes }), 'limit')
    const tag = this.pendingTag ?? statement.implicitTag
    this.pendingTag = undefined
    const parent = this.containers[this.containers.length - 1]?.id
    const node: StructaNode = {
      id,
      kind: statement.shape,
      label: statement.label ? this.text(statement.label, statement.line) : defaultLabel(statement),
      ...(statement.options.color ? { color: statement.options.color } : {}),
      ...(tag ? { tag } : {}),
      ...(statement.shape === 'class' ? { classKind: statement.classKind ?? 'class' } : {}),
      attributes: [],
      methods: [],
      ...(parent ? { parent } : {}),
      span,
    }
    this.nodes.set(id, node)
    this.model.nodes.push(node)
    for (const base of statement.bases) this.model.relations.push({ from: id, to: base.value, kind: 'inheritance', span: spanOf(statement.line, base) })
    if (!statement.block) return
    if (statement.shape === 'class') this.currentClass = { node, indent: statement.indent }
    else this.containers.push({ indent: statement.indent, id })
  }

  private addMember(statement: Extract<Statement, { type: 'member' }>) {
    const owner = this.currentClass?.node
    if (!owner) return this.report({ line: statement.line, col: statement.indent + 1, endCol: statement.indent + 2 + statement.text.length }, message('memberOutside'), 'member')
    if (statement.method) owner.methods.push(statement.uml)
    else owner.attributes.push(owner.classKind === 'enum' ? statement.uml.replace(/^\+\s/, '') : statement.uml)
  }

  private relate(statement: Extract<Statement, { type: 'rel' }>) {
    const label = statement.label ? this.text(statement.label, statement.line) : undefined
    for (const link of statement.chain) {
      const multiplicity = link.multiplicity?.map((part) => part.value).join('')
      this.model.relations.push({
        from: link.from.value,
        to: link.to.value,
        kind: link.kind,
        ...(label ? { label } : {}),
        ...(multiplicity ? { toMult: MULTIPLICITY_WORDS[multiplicity] ?? multiplicity } : {}),
        ...(statement.options.from ? { fromMult: statement.options.from } : {}),
        ...(statement.options.route ? { route: statement.options.route } : {}),
        span: { line: statement.line, col: link.from.col, endCol: link.to.end },
      })
    }
  }

  private reportUnknownIds() {
    for (const occurrence of this.parsed.occurrences) {
      if (occurrence.declaration || this.nodes.has(occurrence.id)) continue
      const near = closest(occurrence.id, this.nodes.keys())
      const fix = near ? { title: message('didYouMean', { id: near }), line: occurrence.span.line, text: near } : { title: message('createIt', { id: occurrence.id }), line: 1, text: `action ${occurrence.id}`, insert: true }
      this.report(occurrence.span, `${message('unknownId', { id: occurrence.id })}${near ? ` ${message('didYouMean', { id: near })}` : ''}`, 'unknown-id', 'error', fix)
    }
  }

  private validateRelation(relation: StructaRelation) {
    const from = this.nodes.get(relation.from)
    const to = this.nodes.get(relation.to)
    if (!from || !to) return false
    if (from === to) {
      this.report(relation.span, message('selfRelation', { id: from.id }), 'self', 'warning')
      return false
    }
    if (relation.kind === 'inheritance' && to.classKind === 'interface' && from.classKind !== 'interface') relation.kind = 'realization'
    const typed = relation.kind === 'inheritance' || relation.kind === 'realization'
    if (typed && (from.kind !== 'class' || to.kind !== 'class')) {
      const offender = from.kind !== 'class' ? from : to
      this.report(relation.span, message('inheritanceOnClasses', { id: offender.id, kind: offender.kind }), 'semantics', 'warning')
    }
    const useCaseOnly = relation.kind === 'include' || relation.kind === 'extend'
    if (useCaseOnly && (from.kind !== 'usecase' || to.kind !== 'usecase')) this.report(relation.span, message('includeOnUseCases'), 'semantics', 'warning')
    return true
  }

  private applyLayout() {
    for (const node of this.model.nodes) {
      const position = this.positions.get(node.id)
      if (!position) continue
      node.at = { x: position.x, y: position.y }
      if (position.w && position.h) node.size = { w: position.w, h: position.h }
    }
  }
}

export const compile = (source: string): CompileResult => new Compiler(parse(source)).compile()
