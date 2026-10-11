import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compile, setLang } from '../dist/structa.mjs'

const example = (name) => readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8')
const errors = (result) => result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')

test('the architecture example compiles with tags, typed members, variables and composition', () => {
  const result = compile(example('architecture.sct'))
  assert.deepEqual(errors(result), [])
  const api = result.model.nodes.find((node) => node.id === 'API')
  assert.equal(api.tag, 'FastAPI')
  assert.ok(api.methods.includes('+ analyze(input: Input): dict'))
  assert.equal(result.model.nodes.find((node) => node.id === 'Engine').attributes[0], '+ CUTS: dict[str, float]')
  assert.equal(result.model.relations.find((relation) => relation.from === 'Frontend').label, 'POST /analyze (JSON)')
  assert.deepEqual(
    result.model.relations.filter((relation) => relation.kind === 'composition').map(({ from, to, toMult }) => ({ from, to, toMult })),
    [{ from: 'Result', to: 'Line', toMult: '0..*' }],
  )
})

test('a flow chain becomes one relation per arrow', () => {
  const result = compile(example('supply-chain.sct'))
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.model.relations.filter((relation) => relation.kind === 'flow').length, 6)
})

test('shapes indented under a system belong to it', () => {
  const result = compile(example('online-shop.sct'))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual(result.model.nodes.filter((node) => node.parent === 'shop').map((node) => node.id), ['sign_in', 'checkout', 'pay', 'coupon'])
  assert.deepEqual(result.model.relations.map((relation) => relation.kind), ['association', 'association', 'include', 'extend', 'association'])
})

test('class bases declare inheritance, and an interface base becomes realization', () => {
  const result = compile('interface Flyer:\n    def fly() -> None\nclass Animal:\n    name: str\nclass Duck(Animal, Flyer):\n    def quack() -> str')
  assert.deepEqual(result.model.relations.map(({ from, to, kind }) => `${from}>${to}:${kind}`).sort(), ['Duck>Animal:inheritance', 'Duck>Flyer:realization'])
})

test('members follow Python conventions for visibility and drop self', () => {
  const result = compile('class Account:\n    _balance: float\n    __pin: str\n    private limit: float = 100\n    def deposit(self, amount: float) -> None\nenum Color:\n    RED\n    BLUE')
  const [account, color] = result.model.nodes
  assert.deepEqual(account.attributes, ['# _balance: float', '- __pin: str', '- limit: float = 100'])
  assert.deepEqual(account.methods, ['+ deposit(amount: float): None'])
  assert.deepEqual(color.attributes, ['RED', 'BLUE'])
})

test('an unknown id points at the exact column and suggests the closest one', () => {
  const [diagnostic] = compile('action send\nsnd -> send').diagnostics
  assert.equal(diagnostic.line, 2)
  assert.equal(diagnostic.col, 1)
  assert.equal(diagnostic.fix.text, 'send')
})

test('duplicate ids, unknown colors, missing variables and unclosed strings are reported', () => {
  const codes = compile('action a\naction a\naction b "x" [color=neon]\naction c "{missing}"\naction d "open').diagnostics.map((diagnostic) => diagnostic.code)
  for (const code of ['duplicate', 'color', 'variable', 'string']) assert.ok(codes.includes(code), code)
})

test('messages follow the selected language', () => {
  setLang('pt')
  try {
    assert.match(compile('a -> b').diagnostics[0].message, /Não existe nada/)
  } finally {
    setLang('en')
  }
})

test('oversized input is rejected quickly instead of hanging', () => {
  const started = Date.now()
  assert.equal(compile('action a\n'.repeat(9000)).diagnostics[0].code, 'limit')
  compile(`${'a -> '.repeat(5000)}b`)
  assert.ok(Date.now() - started < 3000)
})
