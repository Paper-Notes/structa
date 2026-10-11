import { CONTAINER_SHAPES, DEFAULT_COLOR, isIdentifier, MULTIPLICITY_SPELLING, RELATION_SPELLING, ROUTE_SPELLING } from './language'
import { umlToMember } from './members'
import type { StructaModel, StructaNode, StructaRelation } from './model'

const INDENT = '    '

export const quote = (value: string) =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\{/g, '{{').replace(/\}/g, '}}')}"`

export function makeId(label: string, taken: Set<string>, fallback = 'item') {
  const ascii = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
  const base = ascii || fallback
  const safe = /^\p{N}/u.test(base) ? `_${base}` : base
  const looksLikeTypeName = /^[\p{L}\p{N}]+$/u.test(label.trim()) && /^[A-Z]/.test(safe)
  const cased = looksLikeTypeName ? safe : safe.toLowerCase()
  let candidate = cased
  for (let suffix = 2; taken.has(candidate); suffix++) candidate = `${cased}_${suffix}`
  taken.add(candidate)
  return candidate
}

const isBlockShape = (node: StructaNode) => node.kind === 'class' || CONTAINER_SHAPES.has(node.kind)

function keywordOf(node: StructaNode) {
  if (node.kind !== 'class') return node.kind
  if (node.tag === 'module') return 'module'
  if (node.classKind === 'abstract') return 'abstract class'
  return node.classKind === 'interface' || node.classKind === 'enum' ? node.classKind : 'class'
}

function defaultLabel(node: StructaNode) {
  if (node.kind === 'start' || node.kind === 'end') return ''
  return node.kind === 'class' ? node.id : node.id.replace(/_/g, ' ')
}

function membersOf(node: StructaNode) {
  const attributes = node.attributes.map((line) => (node.classKind === 'enum' ? line.replace(/^\+\s/, '') : umlToMember(line, false)))
  return [...attributes, ...node.methods.map((line) => umlToMember(line, true))]
}

function isBaseRelation(relation: StructaRelation, nodes: Map<string, StructaNode>) {
  const typed = relation.kind === 'inheritance' || relation.kind === 'realization'
  return typed && nodes.get(relation.from)?.kind === 'class' && !relation.label && relation.route === undefined
}

function relationLine(relation: StructaRelation) {
  const multiplicity = relation.toMult ? ` ${MULTIPLICITY_SPELLING[relation.toMult] ?? relation.toMult}` : ''
  const options = [relation.route && relation.route !== 'elbow' ? `route=${ROUTE_SPELLING[relation.route]}` : '', relation.fromMult ? `from=${quote(relation.fromMult)}` : ''].filter(Boolean)
  const label = relation.label ? ` ${quote(relation.label)}` : ''
  return `${relation.from} ${RELATION_SPELLING[relation.kind]}${multiplicity} ${relation.to}${label}${options.length ? ` [${options.join(', ')}]` : ''}`
}

export function print(model: StructaModel, options: { layout?: boolean } = {}): string {
  const lines: string[] = []
  const byId = new Map(model.nodes.map((node) => [node.id, node]))
  const children = new Map<string | undefined, StructaNode[]>()
  for (const node of model.nodes) children.set(node.parent, [...(children.get(node.parent) ?? []), node])
  const bases = new Map<string, string[]>()
  const inlineRelations = new Set<StructaRelation>()
  for (const relation of model.relations) {
    if (!isBaseRelation(relation, byId)) continue
    bases.set(relation.from, [...(bases.get(relation.from) ?? []), relation.to])
    inlineRelations.add(relation)
  }

  const emit = (node: StructaNode, depth: number) => {
    const pad = INDENT.repeat(depth)
    if (node.tag && !(node.kind === 'class' && node.tag === 'module')) lines.push(`${pad}@${isIdentifier(node.tag) ? node.tag : quote(node.tag)}`)
    const parents = bases.get(node.id)
    const members = node.kind === 'class' ? membersOf(node) : []
    const inner = children.get(node.id) ?? []
    const parts = [`${pad}${keywordOf(node)} ${node.id}${parents?.length ? `(${parents.join(', ')})` : ''}`]
    if (node.label !== defaultLabel(node)) parts.push(quote(node.label))
    if (node.color && node.color !== DEFAULT_COLOR[node.kind]) parts.push(`[color=${node.color}]`)
    lines.push(parts.join(' ') + (members.length || inner.length ? ':' : ''))
    for (const member of members) lines.push(`${pad}${INDENT}${node.classKind === 'enum' ? member.replace(/^"(.*)"$/, '$1') : member}`)
    for (const child of inner) emit(child, depth + 1)
  }

  if (model.title) lines.push(`title ${quote(model.title)}`, '')
  const roots = children.get(undefined) ?? []
  roots.forEach((node, index) => {
    if (index > 0 && (isBlockShape(node) || isBlockShape(roots[index - 1]))) lines.push('')
    emit(node, 0)
  })
  const relations = model.relations.filter((relation) => !inlineRelations.has(relation))
  if (relations.length) lines.push('', ...relations.map(relationLine))
  if (options.layout !== false && model.nodes.some((node) => node.at)) {
    lines.push('', 'layout:')
    for (const node of model.nodes) {
      if (!node.at) continue
      const size = node.size ? ` size ${Math.round(node.size.w)}, ${Math.round(node.size.h)}` : ''
      lines.push(`${INDENT}${node.id} at ${Math.round(node.at.x)}, ${Math.round(node.at.y)}${size}`)
    }
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}
