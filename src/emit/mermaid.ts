import type { StructaModel, StructaNode, StructaRelation } from '../model'

const quoted = (value: string) => `"${value.replace(/"/g, '#quot;').replace(/\n/g, '<br/>')}"`
const isClassDiagram = (model: StructaModel) => model.nodes.some((node) => node.kind === 'class') && model.nodes.every((node) => node.kind === 'class' || node.kind === 'note')

function annotation(node: StructaNode) {
  if (node.classKind && node.classKind !== 'class') return `<<${node.classKind === 'enum' ? 'enumeration' : node.classKind}>>`
  return node.tag ? `<<${node.tag}>>` : null
}

function classRelation(relation: StructaRelation) {
  const label = relation.label ? ` : ${relation.label}` : ''
  if (relation.kind === 'inheritance') return `${relation.to} <|-- ${relation.from}${label}`
  if (relation.kind === 'realization') return `${relation.to} <|.. ${relation.from}${label}`
  const arrow = relation.kind === 'composition' ? '*--' : relation.kind === 'aggregation' ? 'o--' : relation.kind === 'flow' || relation.kind === 'association' ? '-->' : '..>'
  const fromCard = relation.fromMult ? ` ${quoted(relation.fromMult)}` : ''
  const toCard = relation.toMult ? ` ${quoted(relation.toMult)}` : ''
  return `${relation.from}${fromCard} ${arrow}${toCard} ${relation.to}${label}`
}

function flowShape(node: StructaNode) {
  const label = node.label || node.id
  switch (node.kind) {
    case 'start':
      return `${node.id}(( ))`
    case 'end':
      return `${node.id}((( )))`
    case 'decision':
      return `${node.id}{${quoted(label)}}`
    case 'usecase':
    case 'state':
      return `${node.id}([${quoted(label)}])`
    case 'note':
      return `${node.id}>${quoted(label)}]`
    case 'actor':
      return `${node.id}[${quoted(`👤 ${label}`)}]`
    default:
      return `${node.id}(${quoted(label)})`
  }
}

function flowRelation(relation: StructaRelation) {
  const label = relation.label ?? (relation.kind === 'include' ? '«include»' : relation.kind === 'extend' ? '«extend»' : '')
  const arrow = relation.kind === 'association' ? '---' : ['dependency', 'include', 'extend', 'realization'].includes(relation.kind) ? '-.->' : '-->'
  return `${relation.from} ${arrow}${label ? `|${quoted(label)}|` : ''} ${relation.to}`
}

export function toMermaid(model: StructaModel): string {
  if (isClassDiagram(model)) {
    const classes = model.nodes
      .filter((node) => node.kind === 'class')
      .map((node) => {
        const body = [annotation(node), ...node.attributes, ...node.methods].filter((line): line is string => !!line)
        return body.length ? `  class ${node.id} {\n${body.map((line) => `    ${line}`).join('\n')}\n  }` : `  class ${node.id}`
      })
    return `${['classDiagram', ...classes, ...model.relations.map((relation) => `  ${classRelation(relation)}`)].join('\n')}\n`
  }
  const lines = ['flowchart TD']
  const emit = (parent: string | undefined, depth: number) => {
    for (const node of model.nodes.filter((candidate) => candidate.parent === parent)) {
      const pad = '  '.repeat(depth + 1)
      if (node.kind === 'system' || node.kind === 'package') {
        lines.push(`${pad}subgraph ${node.id}[${quoted(node.label)}]`)
        emit(node.id, depth + 1)
        lines.push(`${pad}end`)
      } else lines.push(`${pad}${flowShape(node)}`)
    }
  }
  emit(undefined, 0)
  return `${[...lines, ...model.relations.map((relation) => `  ${flowRelation(relation)}`)].join('\n')}\n`
}
