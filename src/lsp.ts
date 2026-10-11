import { StructaServer } from './lsp/server'
import { Transport } from './lsp/transport'

new StructaServer(new Transport(process.stdin, process.stdout)).start()
