# Structa

Structa is the modeling language of [Paper](https://papernotes.online). It describes UML diagrams as plain text that reads like Python, checks it like a typed language, and draws it in Paper, GitHub (through Mermaid) or anything that speaks PlantUML.

```structa
title "Budget assistant · architecture"

let route = "/analyze"

@React
class Frontend:
    def play_script(script)

@FastAPI
module API:
    def analyze(input: Input) -> dict

@Pydantic
class Input:
    income: float
    expenses: dict[str, float]

@Pydantic
class Result:
    script: list[Line]

class Line:
    text: str

Frontend -> API "POST {route} (JSON)"
API uses Input "receives and validates"
Result has many Line
```

## Why another diagram language

Mermaid and PlantUML are great at drawing. They are less great at being written and maintained by people:

- **Readable relations.** `Result has many Line` and `Dog is Animal` say what they mean. Arrow glyphs such as `*--` and `<|--` stay available through the Mermaid and PlantUML outputs.
- **Typed ids.** Every shape has an id. Referencing one that does not exist is an error at the exact column, with a suggestion: `Nothing has the id "Resul". Did you mean "Result"?`
- **Python-shaped classes.** `class Duck(Animal, Flyer):` declares inheritance and realization. `_protected`, `__private` and `def name(self, x: int) -> str` mean what a Python developer expects.
- **One canonical style.** `structa fmt` rewrites any file into the same shape and keeps comments and variables, so diffs stay about content.
- **Editor support from day one.** Diagnostics, completion, hover docs, go to definition, references, rename, symbols and formatting over LSP.

## Install

```bash
npm install --global github:Paper-Notes/structa
```

Node 20 or newer. No runtime dependencies.

## Command line

```bash
structa check   examples/architecture.sct
structa fmt     examples/architecture.sct --write
structa compile examples/architecture.sct --to mermaid
structa compile examples/architecture.sct --to plantuml -o architecture.puml
structa lsp
```

`check` and `compile` exit with `1` when the file has errors, which makes them usable in CI. `fmt --check` exits with `1` when a file is not formatted.

## Editors

The server speaks LSP over stdio: `structa-lsp` (or `structa lsp`).

Neovim:

```lua
vim.filetype.add({ extension = { sct = 'structa' } })
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'structa',
  callback = function() vim.lsp.start({ name = 'structa', cmd = { 'structa-lsp' } }) end,
})
```

Helix (`languages.toml`):

```toml
[[language]]
name = "structa"
scope = "source.structa"
file-types = ["sct"]
comment-token = "#"
language-servers = ["structa-lsp"]

[language-server.structa-lsp]
command = "structa-lsp"
```

Inside Paper the same engine runs in the browser; nothing needs to be installed.

## Library

```ts
import { compile, format, toMermaid } from 'structa'

const { model, diagnostics } = compile(source)
if (!diagnostics.some((d) => d.severity === 'error')) console.log(toMermaid(model))
```

`compile` never throws on user input: every problem becomes a diagnostic with a line, a column and, when possible, a fix.

## Design decisions

| Decision | Why | Trade-off |
|---|---|---|
| Line-oriented grammar with indentation blocks | Errors stay local to one line, recovery is trivial, and the shape matches Python | Statements cannot span lines |
| Words for relations (`has`, `is`, `uses`) | Readable by people learning UML; symbols are an output concern | Slightly longer lines |
| Variables only substitute text | Reuse without turning a diagram into a program | No expressions, conditions or loops, by design |
| Layout lives in an optional `layout:` block | Hand-written files stay clean; tools keep positions stable | Positions are coordinates, not constraints |
| Hand-written LSP transport, zero dependencies | Small attack surface and nothing to audit but this repository | Implements the subset of LSP the language needs |
| Hard limits on size, nodes, relations and nesting | Untrusted files cannot stall an editor | Very large models must be split |

## Security model

Structa files are treated as untrusted input.

- Nothing is executed. There is no `eval`, no import of other files, no file system or network access from the language.
- Variables only replace `{name}` inside strings.
- Inputs are bounded: 400 000 characters, 8 000 lines, 800 shapes, 3 000 relations, 12 nesting levels.
- The language server only reads the text the editor sends, drops malformed or oversized messages, and runs no commands.
- Consumers that render labels to HTML or SVG must escape them; Paper does.

Report vulnerabilities privately through GitHub security advisories on this repository.

## Specification

[SPEC.md](SPEC.md) covers the full grammar, the relation table, multiplicities, options and limits.

## Development

```bash
npm install
npm run check    # typecheck, build and tests
```

The suite covers the compiler, the printer and formatter round trip, the editor services and a real LSP session over stdio.

## License

[AGPL-3.0](LICENSE). Use it, fork it and ship it, commercially or not; changes you distribute or run as a service stay open under the same license.
