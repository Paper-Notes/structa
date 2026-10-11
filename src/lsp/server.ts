import { compile } from '../compiler'
import { VERSION } from '../language'
import type { Diagnostic, Span } from '../model'
import { format } from '../formatter'
import { complete } from '../services/completion'
import { hover } from '../services/hover'
import { definition, references, rename, symbols } from '../services/navigation'
import { Transport, type Message } from './transport'

type Position = { uri: string; line: number; col: number }
type Handler = (params: Record<string, any>) => unknown

const MAX_DOCUMENT = 2 * 1024 * 1024
const DIAGNOSTIC_DELAY_MS = 120
const COMPLETION_KIND = { keyword: 14, id: 6, value: 12, snippet: 15, tag: 20 } as const
const SYMBOL_KIND: Readonly<Record<string, number>> = { class: 5, interface: 11, enum: 10, abstract: 5, module: 2, system: 3, package: 4, actor: 13, usecase: 12, action: 12, decision: 12, state: 22, start: 14, end: 14, note: 15, text: 15 }
const CAPABILITIES = {
  textDocumentSync: 1,
  completionProvider: { triggerCharacters: [' ', '@', '=', '[', '('] },
  hoverProvider: true,
  definitionProvider: true,
  referencesProvider: true,
  renameProvider: true,
  documentSymbolProvider: true,
  documentFormattingProvider: true,
}

const toRange = (span: Span) => ({ start: { line: span.line - 1, character: span.col - 1 }, end: { line: span.line - 1, character: span.endCol - 1 } })
const severityOf = (diagnostic: Diagnostic) => ({ error: 1, warning: 2, info: 3 })[diagnostic.severity]
const wholeDocument = (text: string) => ({ start: { line: 0, character: 0 }, end: { line: text.split('\n').length, character: 0 } })

export class StructaServer {
  private readonly documents = new Map<string, string>()
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly transport: Transport
  private readonly requests: Readonly<Record<string, Handler>>
  private readonly notifications: Readonly<Record<string, Handler>>

  constructor(transport: Transport) {
    this.transport = transport
    this.requests = {
      initialize: () => ({ serverInfo: { name: 'structa-lsp', version: VERSION }, capabilities: CAPABILITIES }),
      shutdown: () => null,
      'textDocument/completion': (params) => this.completion(params),
      'textDocument/hover': (params) => this.hover(params),
      'textDocument/definition': (params) => this.definition(params),
      'textDocument/references': (params) => this.references(params),
      'textDocument/rename': (params) => this.rename(params),
      'textDocument/documentSymbol': (params) => this.symbols(params),
      'textDocument/formatting': (params) => this.formatting(params),
    }
    this.notifications = {
      'textDocument/didOpen': (params) => this.open(params),
      'textDocument/didChange': (params) => this.change(params),
      'textDocument/didClose': (params) => this.close(params),
      exit: () => process.exit(0),
    }
  }

  start() {
    this.transport.listen((message) => this.dispatch(message))
  }

  private dispatch(message: Message) {
    const params = (message.params ?? {}) as Record<string, any>
    const isRequest = message.id !== undefined && message.id !== null
    const handler = message.method ? (isRequest ? this.requests : this.notifications)[message.method] : undefined
    if (!handler) {
      if (isRequest) this.transport.send({ id: message.id, error: { code: -32601, message: `Unsupported method: ${message.method}` } })
      return
    }
    try {
      const result = handler(params)
      if (isRequest) this.transport.send({ id: message.id, result: result ?? null })
    } catch (error) {
      if (isRequest) this.transport.send({ id: message.id, error: { code: -32603, message: String((error as Error).message ?? error).slice(0, 300) } })
    }
  }

  private text(uri: string) {
    return this.documents.get(uri) ?? ''
  }

  private store(uri: unknown, text: unknown) {
    if (typeof uri !== 'string' || typeof text !== 'string') return
    this.documents.set(uri, text.slice(0, MAX_DOCUMENT))
    clearTimeout(this.pending.get(uri))
    this.pending.set(uri, setTimeout(() => this.publish(uri), DIAGNOSTIC_DELAY_MS))
  }

  private publish(uri: string) {
    const diagnostics = compile(this.text(uri)).diagnostics.map((diagnostic) => ({ range: toRange(diagnostic), severity: severityOf(diagnostic), code: diagnostic.code, source: 'structa', message: diagnostic.message }))
    this.transport.send({ method: 'textDocument/publishDiagnostics', params: { uri, diagnostics } })
  }

  private position(params: Record<string, any>): Position {
    return { uri: String(params.textDocument?.uri ?? ''), line: Number(params.position?.line ?? 0) + 1, col: Number(params.position?.character ?? 0) + 1 }
  }

  private open(params: Record<string, any>) {
    this.store(params.textDocument?.uri, params.textDocument?.text)
  }

  private change(params: Record<string, any>) {
    const changes = params.contentChanges
    if (Array.isArray(changes) && changes.length) this.store(params.textDocument?.uri, changes[changes.length - 1].text)
  }

  private close(params: Record<string, any>) {
    const uri = String(params.textDocument?.uri ?? '')
    this.documents.delete(uri)
    clearTimeout(this.pending.get(uri))
    this.transport.send({ method: 'textDocument/publishDiagnostics', params: { uri, diagnostics: [] } })
  }

  private completion(params: Record<string, any>) {
    const { uri, line, col } = this.position(params)
    return complete(this.text(uri), line, col).map((item) => ({ label: item.label, kind: COMPLETION_KIND[item.kind], detail: item.detail, insertText: item.insert ?? item.label }))
  }

  private hover(params: Record<string, any>) {
    const { uri, line, col } = this.position(params)
    const info = hover(this.text(uri), line, col)
    if (!info) return null
    const example = info.example ? `\n\n\`\`\`structa\n${info.example}\n\`\`\`` : ''
    return { contents: { kind: 'markdown', value: `**${info.title}**\n\n${info.text}${example}` }, range: toRange(info.span) }
  }

  private definition(params: Record<string, any>) {
    const { uri, line, col } = this.position(params)
    const span = definition(this.text(uri), line, col)
    return span ? { uri, range: toRange(span) } : null
  }

  private references(params: Record<string, any>) {
    const { uri, line, col } = this.position(params)
    return references(this.text(uri), line, col).map((span) => ({ uri, range: toRange(span) }))
  }

  private rename(params: Record<string, any>) {
    const { uri, line, col } = this.position(params)
    const source = this.text(uri)
    const renamed = rename(source, line, col, String(params.newName ?? ''))
    return renamed === null ? null : { changes: { [uri]: [{ range: wholeDocument(source), newText: renamed }] } }
  }

  private symbols(params: Record<string, any>) {
    return symbols(this.text(String(params.textDocument?.uri ?? ''))).map((symbol) => ({ name: symbol.name, detail: symbol.label, kind: SYMBOL_KIND[symbol.kind] ?? 13, range: toRange(symbol.span), selectionRange: toRange(symbol.span) }))
  }

  private formatting(params: Record<string, any>) {
    const source = this.text(String(params.textDocument?.uri ?? ''))
    const formatted = format(source)
    return formatted === source ? [] : [{ range: wholeDocument(source), newText: formatted }]
  }
}
