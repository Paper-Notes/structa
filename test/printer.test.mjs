import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compile, format, makeId, print, toMermaid, toPlantUml } from '../dist/structa.mjs'

const architecture = readFileSync(new URL('../examples/architecture.sct', import.meta.url), 'utf8')
const withoutSpans = (model) => ({
  nodes: model.nodes.map(({ span, ...node }) => node),
  relations: model.relations.map(({ span, ...relation }) => relation).sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)),
})

test('printing a model and compiling it again gives the same model', () => {
  const original = compile(architecture).model
  const reprinted = compile(print(original))
  assert.deepEqual(reprinted.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), [])
  assert.deepEqual(withoutSpans(reprinted.model), withoutSpans(original))
})

test('the printer writes positions in a layout block that compiles back', () => {
  const model = compile('action send\nend done').model
  model.nodes[0].at = { x: 120, y: 80 }
  model.nodes[0].size = { w: 200, h: 80 }
  const printed = print(model)
  assert.match(printed, /layout:\n {4}send at 120, 80 size 200, 80/)
  assert.deepEqual(compile(printed).model.nodes[0].at, { x: 120, y: 80 })
})

test('the formatter normalizes spacing and indentation but keeps comments and variables', () => {
  const messy = '# my diagram\nlet  api =  "/x"\naction   send   "Send {api}"  [ color = blue ]  # note\nclass A:\n  name:str\n  def f( ) -> int\nsend->A'
  const formatted = format(messy)
  assert.equal(formatted, '# my diagram\nlet api = "/x"\naction send "Send {api}" [color=blue]  # note\nclass A:\n    name:str\n    def f( ) -> int\nsend -> A\n')
  assert.equal(format(formatted), formatted)
})

test('generated ids are readable, ascii and unique', () => {
  const taken = new Set()
  assert.deepEqual(['Enviar e-mail', 'Enviar e-mail', 'Pedido', '3 passos', ''].map((label) => makeId(label, taken)), ['enviar_e_mail', 'enviar_e_mail_2', 'Pedido', '_3_passos', 'item'])
})

test('mermaid output is a class diagram with UML arrows', () => {
  const mermaid = toMermaid(compile(architecture).model)
  assert.ok(mermaid.startsWith('classDiagram'))
  assert.ok(mermaid.includes('Result *-- "0..*" Line'))
  assert.ok(mermaid.includes('<<FastAPI>>'))
})

test('plantuml output keeps stereotypes and multiplicity', () => {
  const plantuml = toPlantUml(compile(architecture).model)
  assert.ok(plantuml.startsWith('@startuml'))
  assert.ok(plantuml.includes('class API <<FastAPI>> {'))
  assert.ok(plantuml.includes('Result *-- "0..*" Line'))
  assert.ok(plantuml.trimEnd().endsWith('@enduml'))
})
