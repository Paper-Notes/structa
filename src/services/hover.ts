import { compile } from '../compiler'
import { describe } from '../i18n'
import { tokenizeLine } from '../lexer'
import type { Span } from '../model'
import { kindName } from './completion'

export type Hover = { title: string; text: string; example?: string; span: Span }

export function hover(source: string, line: number, col: number): Hover | null {
  const text = source.replace(/\r\n?/g, '\n').split('\n')[line - 1] ?? ''
  const token = tokenizeLine(text).tokens.find((candidate) => col >= candidate.col && col < candidate.end)
  if (!token) return null
  const span = { line, col: token.col, endCol: token.end }
  const docs = describe(token.value)
  const leading = token.col === 1 + text.length - text.trimStart().length
  const node = token.type === 'id' && !(docs && leading) ? compile(source).model.nodes.find((candidate) => candidate.id === token.value) : undefined
  if (node) {
    const members = node.kind === 'class' ? [...node.attributes, ...node.methods] : []
    const label = node.label && node.label !== node.id ? `"${node.label}"` : ''
    return {
      title: `${kindName(node)} ${node.id}${node.tag ? ` «${node.tag}»` : ''}`,
      text: [label, members.join('\n'), describe(kindName(node))?.text ?? ''].filter(Boolean).join('\n\n'),
      span,
    }
  }
  return docs ? { title: token.value, text: docs.text, example: docs.example, span } : null
}
