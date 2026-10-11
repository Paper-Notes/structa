import { compile } from '../compiler'
import { isIdentifier } from '../language'
import type { Span } from '../model'
import type { Occurrence } from '../parser'
import { kindName } from './completion'

const contains = (span: Span, line: number, col: number) => span.line === line && col >= span.col && col < span.endCol

function occurrenceAt(occurrences: Occurrence[], line: number, col: number) {
  return occurrences.find((occurrence) => contains(occurrence.span, line, col))
}

export function definition(source: string, line: number, col: number): Span | null {
  const { occurrences } = compile(source)
  const target = occurrenceAt(occurrences, line, col)
  return target ? (occurrences.find((occurrence) => occurrence.id === target.id && occurrence.declaration)?.span ?? null) : null
}

export function references(source: string, line: number, col: number): Span[] {
  const { occurrences } = compile(source)
  const target = occurrenceAt(occurrences, line, col)
  return target ? occurrences.filter((occurrence) => occurrence.id === target.id).map((occurrence) => occurrence.span) : []
}

export function rename(source: string, line: number, col: number, newName: string): string | null {
  if (!isIdentifier(newName)) return null
  const spans = references(source, line, col)
  if (!spans.length) return null
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const lastFirst = [...spans].sort((a, b) => b.line - a.line || b.col - a.col)
  for (const span of lastFirst) {
    const text = lines[span.line - 1]
    lines[span.line - 1] = text.slice(0, span.col - 1) + newName + text.slice(span.endCol - 1)
  }
  return lines.join('\n')
}

export function symbols(source: string) {
  return compile(source).model.nodes.map((node) => ({ name: node.id, kind: kindName(node), label: node.label, parent: node.parent, span: node.span }))
}

export const diagnose = (source: string) => compile(source).diagnostics
