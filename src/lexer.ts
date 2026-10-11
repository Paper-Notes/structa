export type TokenType = 'id' | 'str' | 'num' | 'sym'
export type Token = { type: TokenType; value: string; col: number; end: number }
export type LexedLine = { tokens: Token[]; comment?: string; unclosedStringAt?: number }

const SYMBOLS = ['..>', '->', '--', '..', ',', ':', '(', ')', '[', ']', '=', '@', '*', '+', '-', '~', '.', '|', '{', '}', '<', '>', '/', '!', '?', '&', '%', '^', ';']
const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t' }
const IDENTIFIER_START = /[\p{L}_]/u
const IDENTIFIER_PART = /[\p{L}\p{N}_]/u
const NUMBER = /^-?\d+(\.\d+)?/

type Scan = { token: Token; next: number } | { unclosedAt: number }

function scanString(line: string, start: number): Scan {
  const quote = line[start]
  let value = ''
  let index = start + 1
  while (index < line.length && line[index] !== quote) {
    if (line[index] === '\\' && index + 1 < line.length) {
      value += ESCAPES[line[index + 1]] ?? line[index + 1]
      index += 2
    } else value += line[index++]
  }
  if (index >= line.length) return { unclosedAt: start + 1 }
  return { token: { type: 'str', value, col: start + 1, end: index + 2 }, next: index + 1 }
}

function scanIdentifier(line: string, start: number): { token: Token; next: number } {
  let index = start + 1
  while (index < line.length && IDENTIFIER_PART.test(line[index])) index++
  return { token: { type: 'id', value: line.slice(start, index), col: start + 1, end: index + 1 }, next: index }
}

function scanNumber(line: string, start: number): { token: Token; next: number } {
  const text = NUMBER.exec(line.slice(start))![0]
  return { token: { type: 'num', value: text, col: start + 1, end: start + text.length + 1 }, next: start + text.length }
}

function scanSymbol(line: string, start: number): { token: Token; next: number } {
  const symbol = SYMBOLS.find((candidate) => line.startsWith(candidate, start)) ?? line[start]
  return { token: { type: 'sym', value: symbol, col: start + 1, end: start + symbol.length + 1 }, next: start + symbol.length }
}

const startsNegativeNumber = (line: string, index: number, previous?: Token) =>
  line[index] === '-' && /\d/.test(line[index + 1] ?? '') && (!previous || previous.type === 'sym')

export function tokenizeLine(line: string): LexedLine {
  const tokens: Token[] = []
  let index = 0
  while (index < line.length) {
    const char = line[index]
    if (char === ' ' || char === '\t') {
      index++
      continue
    }
    if (char === '#') return { tokens, comment: line.slice(index + 1).trim() }
    let scanned: Scan
    if (char === '"' || char === "'") scanned = scanString(line, index)
    else if (/\d/.test(char) || startsNegativeNumber(line, index, tokens[tokens.length - 1])) scanned = scanNumber(line, index)
    else if (IDENTIFIER_START.test(char)) scanned = scanIdentifier(line, index)
    else scanned = scanSymbol(line, index)
    if ('unclosedAt' in scanned) return { tokens, unclosedStringAt: scanned.unclosedAt }
    tokens.push(scanned.token)
    index = scanned.next
  }
  return { tokens }
}
