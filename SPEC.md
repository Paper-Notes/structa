# Structa 0.1 specification

Files use the `.sct` extension and UTF-8.

## 1. Lines

- One statement per line.
- `#` starts a comment that runs to the end of the line, outside strings.
- Indenting by 4 spaces opens a block: members of a class, or shapes inside a `system` or `package`. Tabs count as 4 spaces.

## 2. Ids and strings

- An **id** is letters, digits and `_`, not starting with a digit: `send_email`, `Order`, `_x`. Ids are unique within a file.
- A **string** uses double or single quotes. Escapes: `\"`, `\\`, `\n`, `\t`. `{name}` inserts a variable; `{{` and `}}` are literal braces.
- Without a string, a shape's label is its id, with `_` shown as spaces (classes keep the id as written).

## 3. Variables

```structa
let route = "/analyze"
let version = 2
web -> api "POST {route} (v{version})"
```

Variables hold text or numbers and only substitute into strings.

## 4. Shapes

```
<shape> <id> ["label"] [options]
```

| Shape | Meaning |
|---|---|
| `start`, `end` | Start and end of a process |
| `action` | A step |
| `decision` | A split on a condition |
| `state` | A situation something stays in |
| `actor` | Who uses the system |
| `usecase` | Something an actor does with the system |
| `system "Name":` | System boundary; indented shapes are inside it |
| `package "Name":` | Grouping, like a folder |
| `note`, `text` | Visible comment and free text |
| `class`, `abstract class`, `interface`, `enum`, `module` | Classes, see section 5 |

Options: `[color=blue]` with `yellow orange blue purple green pink white gray`. Portuguese names (`amarelo laranja azul roxo verde rosa branco cinza`) are accepted.

## 5. Classes

```structa
@Pydantic
class Result(Base, Serializable):
    income: float
    _cache: dict
    __secret: str
    private limit: float = 100
    def total(self, rate: float) -> float
```

- `class Child(Parent)` declares inheritance. When the parent is an `interface`, it becomes realization.
- Attribute: `name: type [= default]`. Method: `def name(params) -> return`. `self` and `cls` are dropped.
- Visibility follows Python (`_x` protected, `__x` private) or is explicit: `public`, `private`, `protected`, `package`.
- `enum` lists one value per line.
- `@Tag` on the line before a class sets its stereotype: `«React»`, `«FastAPI»`. `module X:` is a class with the `«module»` stereotype.
- `class X: ...` declares an empty class on one line; `pass` and `...` are allowed as empty bodies.

## 6. Relations

```
<id> <relation> [multiplicity] <id> ["label"] [options]
```

| Relation | Meaning | UML |
|---|---|---|
| `->` | Flow: after this comes that | Filled arrow |
| `--` | Association | Line |
| `is` | Inheritance | Hollow triangle |
| `implements` | Realization | Dashed line, hollow triangle |
| `has` | Composition: the part does not outlive the whole | Filled diamond |
| `groups` | Aggregation: the part also lives alone | Hollow diamond |
| `uses`, `..>` | Dependency | Dashed arrow |
| `includes`, `extends` | Use case «include» and «extend» | Dashed arrow |

- Multiplicity after `has`, `groups`, `--` or `uses`: `many` (0..*), `one` (1), `optional` (0..1), `1..*`, `*`, `3`. The source side goes in `[from="1"]`.
- Flows chain: `a -> b -> c`.
- Options: `[route=angle|straight|curve]`, `[from="1"]`.

## 7. Title and layout

```structa
title "Shop architecture"

layout:
    send at 120, 80 size 200, 80
```

`layout` stores positions and sizes, usually written by an editor. Without it, renderers lay the diagram out.

## 8. Diagnostics

Every diagnostic has a line, a column range, a severity and a code. Errors stop rendering; warnings do not.

| Code | Severity | Example |
|---|---|---|
| `unknown-id` | error | `snd -> send` (fix: `send`) |
| `duplicate` | error | Two shapes with the same id |
| `variable` | error | `"{missing}"` |
| `color`, `route`, `option`, `multiplicity` | error | `[color=neon]` |
| `string` | error | Unclosed quote |
| `syntax`, `id`, `member`, `layout`, `target` | error | Unrecognized statement |
| `semantics` | warning | `is` between non-class shapes |
| `self`, `empty`, `indent` | warning | `a -> a` |
| `limit` | error | Input over the limits |

## 9. Limits

400 000 characters, 8 000 lines, 800 shapes, 3 000 relations, 12 nesting levels, 2 000 characters per label.
