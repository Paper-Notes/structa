export type ShapeKind = 'start' | 'end' | 'action' | 'decision' | 'state' | 'actor' | 'usecase' | 'system' | 'package' | 'note' | 'text' | 'class'
export type ClassKind = 'class' | 'interface' | 'abstract' | 'enum'
export type RelationKind = 'flow' | 'association' | 'inheritance' | 'realization' | 'composition' | 'aggregation' | 'dependency' | 'include' | 'extend'
export type Route = 'elbow' | 'straight' | 'curve'

export type Span = { line: number; col: number; endCol: number }

export type StructaNode = {
  id: string
  kind: ShapeKind
  label: string
  color?: string
  tag?: string
  classKind?: ClassKind
  attributes: string[]
  methods: string[]
  parent?: string
  at?: { x: number; y: number }
  size?: { w: number; h: number }
  span: Span
}

export type StructaRelation = {
  from: string
  to: string
  kind: RelationKind
  label?: string
  fromMult?: string
  toMult?: string
  route?: Route
  span: Span
}

export type StructaModel = { title?: string; nodes: StructaNode[]; relations: StructaRelation[] }

export type Severity = 'error' | 'warning' | 'info'
export type Fix = { title: string; line: number; text: string; insert?: boolean }
export type Diagnostic = Span & { severity: Severity; code: string; message: string; fix?: Fix }
