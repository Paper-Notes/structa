export type Message = { jsonrpc: '2.0'; id?: number | string | null; method?: string; params?: unknown; result?: unknown; error?: { code: number; message: string } }

const MAX_HEADER = 8 * 1024
const MAX_BODY = 8 * 1024 * 1024
const SEPARATOR = '\r\n\r\n'

export class Transport {
  private buffer = Buffer.alloc(0)
  private readonly input: NodeJS.ReadableStream
  private readonly output: NodeJS.WritableStream

  constructor(input: NodeJS.ReadableStream, output: NodeJS.WritableStream) {
    this.input = input
    this.output = output
  }

  listen(onMessage: (message: Message) => void) {
    this.input.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      for (let message = this.next(); message; message = this.next()) if (message !== 'skip') onMessage(message)
    })
  }

  send(message: Omit<Message, 'jsonrpc'>) {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }), 'utf8')
    this.output.write(`Content-Length: ${body.length}${SEPARATOR}`)
    this.output.write(body)
  }

  private next(): Message | 'skip' | null {
    const headerEnd = this.buffer.indexOf(SEPARATOR)
    if (headerEnd < 0) {
      if (this.buffer.length > MAX_HEADER) this.buffer = Buffer.alloc(0)
      return null
    }
    const length = Number(/Content-Length:\s*(\d+)/i.exec(this.buffer.subarray(0, headerEnd).toString('ascii'))?.[1] ?? NaN)
    if (!Number.isFinite(length) || length > MAX_BODY) {
      this.buffer = Buffer.alloc(0)
      return null
    }
    const bodyStart = headerEnd + SEPARATOR.length
    if (this.buffer.length < bodyStart + length) return null
    const body = this.buffer.subarray(bodyStart, bodyStart + length).toString('utf8')
    this.buffer = this.buffer.subarray(bodyStart + length)
    try {
      return JSON.parse(body) as Message
    } catch {
      return 'skip'
    }
  }
}
