import assert from 'node:assert/strict'
import { test } from 'node:test'
import { complete, definition, hover, references, rename, symbols } from '../dist/structa.mjs'

const labels = (items) => items.map((item) => item.label)

test('completion offers shapes at the start of a line', () => {
  const offered = labels(complete('', 1, 1))
  for (const word of ['action', 'class', 'decision', 'abstract class', 'let']) assert.ok(offered.includes(word), word)
})

test('completion offers declared ids after a relation', () => {
  assert.deepEqual(labels(complete('action send\naction receive\nsend -> ', 3, 9)).sort(), ['receive', 'send'])
})

test('completion offers multiplicities after has', () => {
  const offered = labels(complete('class Order\nclass Item\nOrder has ', 3, 11))
  assert.ok(offered.includes('many') && offered.includes('Item'))
})

test('completion offers values inside options', () => {
  assert.ok(labels(complete('action a [color=', 1, 17)).includes('blue'))
  assert.ok(labels(complete('a -> b [route=', 1, 15)).includes('curve'))
})

test('hover explains keywords and describes declared shapes', () => {
  assert.match(hover('Dog is Animal\nclass Animal\nclass Dog', 1, 5).text, /Inheritance/)
  const shape = hover('@Pydantic\nclass Input:\n    income: float\nInput -- Input', 4, 2)
  assert.equal(shape.title, 'class Input «Pydantic»')
  assert.match(shape.text, /\+ income: float/)
})

test('definition, references and rename follow ids across declarations, relations and layout', () => {
  const source = 'action send\nsend -> done\nend done\nlayout:\n    send at 0, 0'
  assert.deepEqual(definition(source, 2, 2), { line: 1, col: 8, endCol: 12 })
  assert.equal(references(source, 1, 9).length, 3)
  assert.equal(rename(source, 1, 9, 'deliver'), 'action deliver\ndeliver -> done\nend done\nlayout:\n    deliver at 0, 0')
  assert.equal(rename(source, 1, 9, 'not valid'), null)
})

test('symbols list every shape with its kind and parent', () => {
  assert.deepEqual(
    symbols('system shop:\n    usecase pay\nactor customer').map(({ name, kind, parent }) => ({ name, kind, parent })),
    [
      { name: 'shop', kind: 'system', parent: undefined },
      { name: 'pay', kind: 'usecase', parent: 'shop' },
      { name: 'customer', kind: 'actor', parent: undefined },
    ],
  )
})
