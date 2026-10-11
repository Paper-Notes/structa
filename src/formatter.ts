import { ROUTE_SPELLING } from './language'
import type { Token } from './lexer'
import { parse, type Statement } from './parser'
import { quote } from './printer'

const INDENT = '    '

const literal = (token: Token) => (token.type === 'str' ? quote(token.value).replace(/\{\{/g, '{').replace(/\}\}/g, '}') : token.value)
const trailing = (comment?: string) => (comment ? `  # ${comment}` : '')

class IndentLevels {
  private readonly stack: number[] = []

  padFor(indent: number) {
    while (this.stack.length && indent < this.stack[this.stack.length - 1]) this.stack.pop()
    if (!this.stack.length || indent > this.stack[this.stack.length - 1]) this.stack.push(indent)
    return INDENT.repeat(this.stack.length - 1)
  }
}

function render(statement: Exclude<Statement, { type: 'blank' }>, original: string): string {
  switch (statement.type) {
    case 'comment':
      return statement.text ? `# ${statement.text}` : original.trim()
    case 'let':
      return `let ${statement.name.value} = ${literal(statement.value)}${trailing(statement.comment)}`
    case 'title':
      return `title ${literal(statement.value)}${trailing(statement.comment)}`
    case 'tag':
      return `@${literal(statement.value)}${trailing(statement.comment)}`
    case 'layout':
      return `layout:${trailing(statement.comment)}`
    case 'pos':
      return `${statement.id.value} at ${statement.x}, ${statement.y}${statement.w !== undefined ? ` size ${statement.w}, ${statement.h}` : ''}${trailing(statement.comment)}`
    case 'member':
      return `${statement.text}${trailing(statement.comment)}`
    case 'decl': {
      const bases = statement.bases.length ? `(${statement.bases.map((base) => base.value).join(', ')})` : ''
      const label = statement.label ? ` ${literal(statement.label)}` : ''
      const color = statement.options.color ? ` [color=${statement.options.color}]` : ''
      const suffix = statement.block ? ':' : statement.inline ? ': ...' : ''
      return `${statement.keyword} ${statement.id.value}${bases}${label}${color}${suffix}${trailing(statement.comment)}`
    }
    case 'rel': {
      const chain = statement.chain.reduce((text, link) => `${text} ${link.op.value}${link.multiplicity ? ` ${link.multiplicity.map((part) => part.value).join('')}` : ''} ${link.to.value}`, statement.chain[0].from.value)
      const options = [statement.options.route ? `route=${ROUTE_SPELLING[statement.options.route]}` : '', statement.options.from ? `from=${quote(statement.options.from)}` : ''].filter(Boolean)
      return `${chain}${statement.label ? ` ${literal(statement.label)}` : ''}${options.length ? ` [${options.join(', ')}]` : ''}${trailing(statement.comment)}`
    }
    case 'error':
      return statement.text
  }
}

export function format(source: string): string {
  const original = source.replace(/\r\n?/g, '\n').split('\n')
  const levels = new IndentLevels()
  const output: string[] = []
  let blankRun = 0
  for (const statement of parse(source).statements) {
    if (statement.type === 'blank') {
      if (blankRun++ === 0 && output.length) output.push('')
      continue
    }
    blankRun = 0
    output.push(levels.padFor(statement.indent) + render(statement, original[statement.line - 1]))
  }
  return `${output.join('\n').trim()}\n`
}
