import { VISIBILITY_SPELLING, VISIBILITY_WORDS } from './language'

export type Member = { uml: string; method: boolean }

const IDENTIFIER = '[\\p{L}_][\\p{L}\\p{N}_]*'
const METHOD = new RegExp(`^def\\s+(${IDENTIFIER})\\s*\\((.*)\\)\\s*(?:->\\s*(.+?))?\\s*:?\\s*$`, 'u')
const ATTRIBUTE = new RegExp(`^(${IDENTIFIER})\\s*(?::\\s*([^=]+?))?\\s*(?:=\\s*(.+))?$`, 'u')
const UML_METHOD = new RegExp(`^(${IDENTIFIER})\\s*\\((.*)\\)\\s*(?::\\s*(.+))?$`, 'u')
const RECEIVER_PARAMETERS = new Set(['self', 'cls'])
const MODIFIERS = /^(static|async|abstract)\s+/

function pythonVisibility(name: string) {
  const dunder = name.startsWith('__') && name.endsWith('__')
  if (name.startsWith('__') && !dunder) return '-'
  if (name.startsWith('_') && !name.startsWith('__')) return '#'
  return '+'
}

function splitVisibility(text: string): { visibility?: string; rest: string } {
  const word = /^(public|private|protected|package)\s+/.exec(text)
  if (word) return { visibility: VISIBILITY_WORDS[word[1]], rest: text.slice(word[0].length) }
  if (/^[+\-~]/.test(text) && !/^-\d/.test(text)) return { visibility: text[0], rest: text.slice(1).trim() }
  return { rest: text }
}

export function memberToUml(source: string): Member | null {
  const { visibility, rest } = splitVisibility(source.trim())
  const body = rest.replace(MODIFIERS, '')
  const method = METHOD.exec(body)
  if (method) {
    const [, name, rawParameters, returns] = method
    const parameters = rawParameters
      .split(',')
      .map((parameter) => parameter.trim())
      .filter((parameter) => parameter && !RECEIVER_PARAMETERS.has(parameter))
      .join(', ')
    return { uml: `${visibility ?? pythonVisibility(name)} ${name}(${parameters})${returns ? `: ${returns.trim()}` : ''}`, method: true }
  }
  const attribute = ATTRIBUTE.exec(body)
  if (!attribute) return null
  const [, name, type, initial] = attribute
  return { uml: `${visibility ?? pythonVisibility(name)} ${name}${type ? `: ${type.trim()}` : ''}${initial ? ` = ${initial.trim()}` : ''}`, method: false }
}

export function umlToMember(uml: string, method: boolean): string {
  const [, visibility = '+', body] = /^\s*([+\-#~])?\s*(.*)$/.exec(uml)!
  const prefix = VISIBILITY_SPELLING[visibility]
  if (method) {
    const signature = UML_METHOD.exec(body)
    if (signature) return `${prefix}def ${signature[1]}(${signature[2]})${signature[3] ? ` -> ${signature[3]}` : ''}`
  } else {
    const attribute = ATTRIBUTE.exec(body)
    if (attribute) return `${prefix}${attribute[1]}${attribute[2] ? `: ${attribute[2].trim()}` : ''}${attribute[3] ? ` = ${attribute[3]}` : ''}`
  }
  return JSON.stringify(uml)
}
