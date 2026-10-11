export type Lang = 'en' | 'pt'

const en = {
  tooLong: 'The file is over the limit of {max} characters.',
  tooManyLines: 'The file is over the limit of {max} lines.',
  unknownStatement: "I didn't understand this line. Start with a shape (action, class, actor…), a relation (a -> b) or let.",
  expectedId: 'Missing the id, the short name of the shape. Example: action send "Send email"',
  badId: '"{id}" is not a valid id: use letters, digits and _, not starting with a digit.',
  duplicateId: 'The id "{id}" is already used on line {line}. Each shape needs its own id.',
  unknownId: 'Nothing has the id "{id}".',
  didYouMean: 'Did you mean "{id}"?',
  createIt: 'Create action {id}',
  unknownVar: 'The variable "{name}" does not exist. Declare it first: let {name} = "text"',
  unclosedString: 'Missing the closing quote.',
  unknownOption: 'Unknown option "{name}". Use color=, route= or from=.',
  badColor: 'Unknown color "{value}". Colors: {list}.',
  badRoute: 'Unknown route "{value}". Use angle, straight or curve.',
  badMultiplicity: 'Invalid multiplicity "{value}". Use many, one, optional, 1, 0..1, 1..* or *.',
  expectedTarget: 'The relation needs a target. Example: {from} -> other_id',
  inheritanceOnClasses: '"is" and "implements" connect classes, and "{id}" is a {kind}.',
  includeOnUseCases: '"includes" and "extends" connect use cases.',
  memberOutside: 'Attributes and methods belong inside a class, indented by 4 spaces.',
  badMember: "I didn't understand this member. Attribute: name: type   Method: def name(params) -> type",
  badIndent: 'This line is indented without being inside a class, system or package.',
  tooDeep: 'Too much nesting: more than {max} levels.',
  tooManyNodes: 'Too many shapes: more than {max}.',
  badLayout: 'Invalid layout entry. Use: id at x, y size width, height',
  selfRelation: 'A relation from "{id}" to itself is not drawn.',
  emptyContainer: '"{id}" ends with ":" but has nothing inside.',
}

const pt: typeof en = {
  tooLong: 'O arquivo passou do limite de {max} caracteres.',
  tooManyLines: 'O arquivo passou do limite de {max} linhas.',
  unknownStatement: 'Não entendi esta linha. Comece com uma forma (action, class, actor…), uma ligação (a -> b) ou let.',
  expectedId: 'Faltou o id, o nome curto da forma. Exemplo: action enviar "Enviar e-mail"',
  badId: '"{id}" não serve como id: use letras, números e _, sem começar com número.',
  duplicateId: 'O id "{id}" já foi usado na linha {line}. Cada forma precisa de um id próprio.',
  unknownId: 'Não existe nada com o id "{id}".',
  didYouMean: 'Você quis dizer "{id}"?',
  createIt: 'Criar action {id}',
  unknownVar: 'A variável "{name}" não existe. Declare antes: let {name} = "texto"',
  unclosedString: 'Faltou fechar as aspas.',
  unknownOption: 'Opção desconhecida "{name}". Use color=, route= ou from=.',
  badColor: 'Cor desconhecida "{value}". Cores: {list}.',
  badRoute: 'Rota desconhecida "{value}". Use angle, straight ou curve.',
  badMultiplicity: 'Multiplicidade inválida "{value}". Use many, one, optional, 1, 0..1, 1..* ou *.',
  expectedTarget: 'A ligação precisa de um destino. Exemplo: {from} -> outro_id',
  inheritanceOnClasses: '"is" e "implements" ligam classes, e "{id}" é um(a) {kind}.',
  includeOnUseCases: '"includes" e "extends" ligam casos de uso.',
  memberOutside: 'Atributos e métodos ficam dentro de uma classe, com recuo de 4 espaços.',
  badMember: 'Não entendi este membro. Atributo: nome: tipo   Método: def nome(parâmetros) -> tipo',
  badIndent: 'Esta linha tem recuo sem estar dentro de uma classe, system ou package.',
  tooDeep: 'Aninhamento demais: mais de {max} níveis.',
  tooManyNodes: 'Formas demais: mais de {max}.',
  badLayout: 'Linha de layout inválida. Use: id at x, y size largura, altura',
  selfRelation: 'Uma ligação de "{id}" para ele mesmo não aparece no desenho.',
  emptyContainer: '"{id}" termina com ":" mas não tem nada dentro.',
}

type Doc = { en: string; pt: string; example: string }

const docs: Readonly<Record<string, Doc>> = {
  start: { en: 'Start: where the process begins.', pt: 'Início: onde o processo começa.', example: 'start begin' },
  end: { en: 'End: where the process finishes. There can be several.', pt: 'Fim: onde o processo termina. Pode haver vários.', example: 'end done' },
  action: { en: 'Action: a step someone, or the system, takes.', pt: 'Ação: um passo que alguém, ou o sistema, faz.', example: 'action send "Send email"' },
  decision: { en: 'Decision: the path splits on a condition. Label the outgoing arrows.', pt: 'Decisão: o caminho se divide por uma condição. Escreva a condição nas setas que saem dela.', example: 'decision in_stock "In stock?"' },
  state: { en: 'State: a situation something stays in.', pt: 'Estado: uma situação em que algo fica.', example: 'state paid "Order paid"' },
  actor: { en: 'Actor: who uses the system — a person, a role or another system.', pt: 'Ator: quem usa o sistema — uma pessoa, um papel ou outro sistema.', example: 'actor customer "Customer"' },
  usecase: { en: 'Use case: something the actor can do with the system.', pt: 'Caso de uso: algo que o ator consegue fazer com o sistema.', example: 'usecase checkout "Check out"' },
  system: { en: 'System boundary: shapes indented below are inside it.', pt: 'Limite do sistema: as formas indentadas embaixo ficam dentro dele.', example: 'system shop "Online shop":\n    usecase checkout' },
  package: { en: 'Package: groups classes or parts, like a folder.', pt: 'Pacote: agrupa classes ou partes, como uma pasta.', example: 'package domain:\n    class Order' },
  note: { en: 'Note: a visible comment on the drawing.', pt: 'Nota: um comentário que aparece no desenho.', example: 'note warning "Plus plan only"' },
  text: { en: 'Text: a free title or caption.', pt: 'Texto: um título ou legenda solto.', example: 'text heading "Architecture"' },
  class: { en: 'Class: attributes (name: type) and methods (def name() -> type). class Child(Parent): declares the inheritance.', pt: 'Classe: atributos (nome: tipo) e métodos (def nome() -> tipo). class Filho(Pai): já declara a herança.', example: 'class Order:\n    total: float\n    def pay() -> bool' },
  interface: { en: 'Interface: a contract. Classes that list it as a base implement it.', pt: 'Interface: um contrato. Classes que a listam como base a implementam.', example: 'interface Flyer:\n    def fly() -> None' },
  abstract: { en: 'Abstract class: never instantiated alone; a base for children.', pt: 'Classe abstrata: não vira objeto sozinha; é base para as filhas.', example: 'abstract class Animal:' },
  enum: { en: 'Enum: a closed list of values, one per line.', pt: 'Enum: uma lista fechada de valores, um por linha.', example: 'enum Color:\n    RED\n    BLUE' },
  module: { en: 'Module: a file or service with functions, shown as «module».', pt: 'Módulo: um arquivo ou serviço com funções, mostrado como «module».', example: 'module engine:\n    def build_plan(income: float) -> dict' },
  let: { en: 'Variable holding text or a number. Use it inside strings as {name}.', pt: 'Variável com texto ou número. Use dentro de textos como {nome}.', example: 'let route = "/analyze"\nweb -> api "POST {route}"' },
  layout: { en: 'Positions and sizes, written by the editor. Delete it and the drawing lays itself out.', pt: 'Posições e tamanhos, escritos pelo editor. Apague e o desenho se arruma sozinho.', example: 'layout:\n    send at 120, 80 size 200, 80' },
  title: { en: 'Diagram title.', pt: 'Título do diagrama.', example: 'title "Shop architecture"' },
  def: { en: 'Method: def name(params) -> return type.', pt: 'Método: def nome(parâmetros) -> tipo de retorno.', example: 'def analyze(input: Input) -> dict' },
  '->': { en: 'Flow: after this comes that.', pt: 'Seta (fluxo): depois deste, vem aquele.', example: 'receive -> ship "yes"' },
  '--': { en: 'Association: one relates to the other.', pt: 'Associação: um se relaciona com o outro.', example: 'student -- course' },
  '..>': { en: 'Dependency: uses the other now and then.', pt: 'Dependência: usa o outro de vez em quando.', example: 'api ..> Input' },
  is: { en: 'Inheritance: "Dog is Animal".', pt: 'Herança: "Cachorro is Animal" = Cachorro é um tipo de Animal.', example: 'Dog is Animal' },
  implements: { en: 'Realization: the class fulfills an interface.', pt: 'Implementação: a classe cumpre o contrato de uma interface.', example: 'Duck implements Flyer' },
  has: { en: 'Composition: the part does not live without the whole.', pt: 'Composição: a parte não existe sem o todo.', example: 'Result has many Line' },
  groups: { en: 'Aggregation: groups parts that also live alone.', pt: 'Agregação: agrupa partes que existem sozinhas também.', example: 'Team groups many Player' },
  uses: { en: 'Dependency: uses the other; if it changes, this may break.', pt: 'Dependência: usa o outro; se ele mudar, este pode quebrar.', example: 'api uses Input "validates"' },
  includes: { en: 'Include: a use case always calls the other.', pt: 'Inclui: um caso de uso sempre chama o outro.', example: 'checkout includes pay' },
  extends: { en: 'Extend: an optional use case that adds to another.', pt: 'Estende: um caso de uso opcional que acrescenta algo ao outro.', example: 'coupon extends checkout' },
  many: { en: 'Multiplicity 0..* (zero or more).', pt: 'Multiplicidade 0..* (zero ou mais).', example: 'Order has many Item' },
  one: { en: 'Multiplicity 1 (exactly one).', pt: 'Multiplicidade 1 (exatamente um).', example: 'Order has one Customer' },
  optional: { en: 'Multiplicity 0..1 (at most one).', pt: 'Multiplicidade 0..1 (no máximo um).', example: 'Person has optional Address' },
}

export type MessageKey = keyof typeof en

let current: Lang = 'en'

export const setLang = (lang: Lang) => {
  current = lang
}

export const getLang = () => current

export function message(key: MessageKey, vars: Readonly<Record<string, string | number>> = {}) {
  const template = (current === 'pt' ? pt : en)[key]
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export function describe(word: string) {
  const entry = docs[word]
  return entry ? { text: entry[current], example: entry.example } : null
}
