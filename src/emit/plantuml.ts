import type { RelationKind, StructaModel, StructaNode } from '../model'

const ARROWS: Readonly<Record<RelationKind, string>> = {
  flow: '-->',
  association: '--',
  inheritance: '--|>',
  realization: '..|>',
  composition: '*--',
  aggregation: 'o--',
  dependency: '..>',
  include: '..>',
  extend: '..>',
}

const CLASS_KEYWORD = { class: 'class', interface: 'interface', abstract: 'abstract class', enum: 'enum' } as const

function classBlock(node: StructaNode, pad: string) {
  const alias = node.label !== node.id ? ` as "${node.label}"` : ''
  const stereotype = node.tag ? ` <<${node.tag}>>` : ''
  const members = [...node.attributes, ...node.methods].map((line) => `${pad}  ${line.replace(/^([+\-#~])\s+/, '$1')}`)
  return [`${pad}${CLASS_KEYWORD[node.classKind ?? 'class']} ${node.id}${alias}${stereotype} {`, ...members, `${pad}}`]
}

export function toPlantUml(model: StructaModel): string {
  const lines = ['@startuml', 'hide empty members']
  if (model.title) lines.push(`title ${model.title}`)
  const emit = (parent: string | undefined, depth: number) => {
    for (const node of model.nodes.filter((candidate) => candidate.parent === parent)) {
      const pad = '  '.repeat(depth)
      const stereotype = node.tag ? ` <<${node.tag}>>` : ''
      if (node.kind === 'class') lines.push(...classBlock(node, pad))
      else if (node.kind === 'actor' || node.kind === 'usecase') lines.push(`${pad}${node.kind} "${node.label}" as ${node.id}${stereotype}`)
      else if (node.kind === 'note') lines.push(`${pad}note "${node.label}" as ${node.id}`)
      else if (node.kind === 'system' || node.kind === 'package') {
        lines.push(`${pad}${node.kind === 'system' ? 'rectangle' : 'package'} "${node.label}" as ${node.id} {`)
        emit(node.id, depth + 1)
        lines.push(`${pad}}`)
      } else lines.push(`${pad}rectangle "${node.label || node.kind}" as ${node.id}${stereotype}`)
    }
  }
  emit(undefined, 0)
  for (const relation of model.relations) {
    const label = relation.label ?? (relation.kind === 'include' ? '<<include>>' : relation.kind === 'extend' ? '<<extend>>' : '')
    const fromCard = relation.fromMult ? ` "${relation.fromMult}"` : ''
    const toCard = relation.toMult ? ` "${relation.toMult}"` : ''
    lines.push(`${relation.from}${fromCard} ${ARROWS[relation.kind]}${toCard} ${relation.to}${label ? ` : ${label}` : ''}`)
  }
  lines.push('@enduml')
  return `${lines.join('\n')}\n`
}
