import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const uri = 'file:///workspace/example.sct'
let server
let buffer = Buffer.alloc(0)
let nextId = 1
const replies = new Map()
const notifications = []

function onData(chunk) {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd < 0) return
    const length = Number(/Content-Length: (\d+)/.exec(buffer.subarray(0, headerEnd).toString())[1])
    if (buffer.length < headerEnd + 4 + length) return
    const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString())
    buffer = buffer.subarray(headerEnd + 4 + length)
    if (replies.has(message.id)) replies.get(message.id)(message)
    else notifications.push(message)
  }
}

const write = (text) => server.stdin.write(text)
const notify = (method, params) => {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', method, params }))
  write(`Content-Length: ${body.length}\r\n\r\n`)
  write(body)
}
const request = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    const timer = setTimeout(() => reject(new Error(`no reply to ${method}`)), 3000)
    replies.set(id, (message) => {
      clearTimeout(timer)
      resolve(message.result)
    })
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    write(`Content-Length: ${body.length}\r\n\r\n`)
    write(body)
  })
const settle = () => new Promise((resolve) => setTimeout(resolve, 300))
const at = (line, character) => ({ textDocument: { uri }, position: { line, character } })

before(() => {
  server = spawn(process.execPath, [fileURLToPath(new URL('../dist/lsp.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'inherit'] })
  server.stdout.on('data', onData)
})

after(() => server.kill())

test('initialize advertises the supported features', async () => {
  const { capabilities } = await request('initialize', { capabilities: {} })
  for (const feature of ['completionProvider', 'hoverProvider', 'definitionProvider', 'referencesProvider', 'renameProvider', 'documentSymbolProvider', 'documentFormattingProvider']) assert.ok(capabilities[feature], feature)
})

test('opening a document publishes diagnostics at the right position', async () => {
  notify('textDocument/didOpen', { textDocument: { uri, languageId: 'structa', version: 1, text: 'action send\nsnd -> send' } })
  await settle()
  const [diagnostic] = notifications.find((message) => message.method === 'textDocument/publishDiagnostics').params.diagnostics
  assert.deepEqual(diagnostic.range.start, { line: 1, character: 0 })
  assert.match(diagnostic.message, /send/)
})

test('completion, hover, definition and formatting answer from the open document', async () => {
  assert.ok((await request('textDocument/completion', at(1, 7))).some((item) => item.label === 'send'))
  assert.match((await request('textDocument/hover', at(1, 4))).contents.value, /Flow/)
  notify('textDocument/didChange', { textDocument: { uri, version: 2 }, contentChanges: [{ text: 'action   send\nsend->done\nend done' }] })
  const [edit] = await request('textDocument/formatting', { textDocument: { uri }, options: {} })
  assert.equal(edit.newText, 'action send\nsend -> done\nend done\n')
  assert.equal((await request('textDocument/definition', at(1, 7))).range.start.line, 2)
})

test('malformed and oversized messages are dropped without taking the server down', async () => {
  write('Content-Length: 5\r\n\r\n{nope')
  write('Content-Length: 999999999\r\n\r\n')
  write('garbage without a header\r\n\r\n')
  await settle()
  assert.equal(await request('shutdown', null), null)
})
