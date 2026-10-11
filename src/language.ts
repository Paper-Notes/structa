import type { ClassKind, RelationKind, Route, ShapeKind } from './model'

export const VERSION = '0.1.0'

export const LIMITS = {
  chars: 400_000,
  lines: 8_000,
  nodes: 800,
  relations: 3_000,
  depth: 12,
  label: 2_000,
  multiplicityTokens: 4,
} as const

export const COLORS = ['yellow', 'orange', 'blue', 'purple', 'green', 'pink', 'white', 'gray'] as const

export const COLOR_ALIASES: Readonly<Record<string, string>> = {
  amarelo: 'yellow',
  laranja: 'orange',
  azul: 'blue',
  roxo: 'purple',
  verde: 'green',
  rosa: 'pink',
  branco: 'white',
  cinza: 'gray',
  grey: 'gray',
}

export const DEFAULT_COLOR: Readonly<Record<ShapeKind, string>> = {
  start: 'gray',
  end: 'gray',
  action: 'yellow',
  decision: 'white',
  state: 'blue',
  actor: 'white',
  usecase: 'purple',
  system: 'white',
  package: 'gray',
  note: 'yellow',
  text: 'white',
  class: 'white',
}

export type ShapeKeyword = { kind: ShapeKind; classKind?: ClassKind; tag?: string }

export const SHAPE_KEYWORDS: Readonly<Record<string, ShapeKeyword>> = {
  start: { kind: 'start' },
  end: { kind: 'end' },
  action: { kind: 'action' },
  decision: { kind: 'decision' },
  state: { kind: 'state' },
  actor: { kind: 'actor' },
  usecase: { kind: 'usecase' },
  system: { kind: 'system' },
  package: { kind: 'package' },
  note: { kind: 'note' },
  text: { kind: 'text' },
  class: { kind: 'class', classKind: 'class' },
  interface: { kind: 'class', classKind: 'interface' },
  enum: { kind: 'class', classKind: 'enum' },
  module: { kind: 'class', classKind: 'class', tag: 'module' },
}

export const CONTAINER_SHAPES: ReadonlySet<ShapeKind> = new Set(['system', 'package'])

export const RELATION_KEYWORDS: Readonly<Record<string, RelationKind>> = {
  '->': 'flow',
  '--': 'association',
  '..>': 'dependency',
  is: 'inheritance',
  implements: 'realization',
  has: 'composition',
  groups: 'aggregation',
  uses: 'dependency',
  includes: 'include',
  extends: 'extend',
}

export const RELATION_SPELLING: Readonly<Record<RelationKind, string>> = {
  flow: '->',
  association: '--',
  dependency: 'uses',
  inheritance: 'is',
  realization: 'implements',
  composition: 'has',
  aggregation: 'groups',
  include: 'includes',
  extend: 'extends',
}

export const RELATIONS_WITH_MULTIPLICITY: ReadonlySet<RelationKind> = new Set(['composition', 'aggregation', 'association', 'dependency'])

export const MULTIPLICITY_WORDS: Readonly<Record<string, string>> = { many: '0..*', one: '1', optional: '0..1' }
export const MULTIPLICITY_SPELLING: Readonly<Record<string, string>> = { '0..*': 'many', '1': 'one', '0..1': 'optional' }

export const ROUTE_ALIASES: Readonly<Record<string, Route>> = {
  angle: 'elbow',
  elbow: 'elbow',
  angulo: 'elbow',
  straight: 'straight',
  reta: 'straight',
  curve: 'curve',
  curva: 'curve',
}
export const ROUTE_SPELLING: Readonly<Record<Route, string>> = { elbow: 'angle', straight: 'straight', curve: 'curve' }

export const VISIBILITY_WORDS: Readonly<Record<string, string>> = { public: '+', private: '-', protected: '#', package: '~' }
export const VISIBILITY_SPELLING: Readonly<Record<string, string>> = { '+': '', '-': 'private ', '#': 'protected ', '~': 'package ' }

export const STATEMENT_KEYWORDS = ['let', 'title', 'layout'] as const

export const TAG_SUGGESTIONS = ['React', 'FastAPI', 'Pydantic', 'Django', 'Flask', 'Express', 'Spring', 'service', 'controller', 'repository', 'entity', 'model', 'component', 'database', 'queue'] as const

export const isIdentifier = (value: string) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(value)
export const isMultiplicity = (value: string) => value in MULTIPLICITY_WORDS || /^(\d+|\*)(\.\.(\d+|\*))?$/.test(value)
