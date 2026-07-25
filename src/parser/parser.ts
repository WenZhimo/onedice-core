
import { grammars, terms } from './grammar.json'
import table from './table.json'
import { lexer, Token } from './lexer'
import { DiceNode, resolve } from '../ast'
import { OneDiceError } from '../errors'
import type { Config } from '../config'

export interface Producer {
  id: number
  name: string
  tokens: string[]
}

export type BufferElement = Token | DiceNode | DiceNode[] | null

enum ActionType {
  shift, reduce, goto
}

// [type, target]
type Action = [ActionType, number]

const producers: Record<string, Producer> = {}
const terminalTerms = new Set<string>([...terms, '$'])

Object.values(grammars).flat()
  .forEach(producer => producers[producer.id] = producer)

export function parse(input: string, config: Config = {}) {
  const next = lexer(input, config)
  const stack = [1]
  const buffer: BufferElement[] = []
  let token: Token
  while (true) {
    if (!token) token = next()
    const state = stack[stack.length - 1]
    const action: Action = table[state][token.name === 'term' ? token.value : token.name]
    if (!action) throwParseError(input, state, token)
    switch (action[0]) {
      case ActionType.shift:
        stack.push(action[1])
        buffer.push(token)
        token = null
        break
      case ActionType.reduce:
        const id = action[1]
        const producer = producers[id]
        const { name, tokens } = producer
        const nodes: BufferElement[] = []
        if (tokens[0] !== 'empty') {
          tokens.forEach(_ => {
            nodes.unshift(buffer.pop())
            stack.pop()
          })
        }
        buffer.push(resolve(producer, nodes))
        if (name === 'G') {
          return buffer.pop()
        }
        const next: Action = table[stack[stack.length - 1]][name]
        if (!next) throwParseError(input, stack[stack.length - 1], token)
        stack.push(next[1])
        break
    }
  }
}

function throwParseError(input: string, state: number, token: Token): never {
  const actual = token.name === 'term' ? token.value : token.raw
  const expected = expectedTerms(state)
  const isEnd = token.name === 'term' && token.value === '$'

  throw new OneDiceError(
    isEnd ? 'PARSE_UNEXPECTED_END' : 'PARSE_UNEXPECTED_TOKEN',
    isEnd ? 'Unexpected end of OneDice expression' : `Unexpected OneDice token: ${actual}`,
    {
      input,
      actual,
      expected,
      range: token.range,
      hint: isEnd
        ? 'Complete the expression with a number, interpolation, dice expression, or closing operand.'
        : 'Remove the token or replace it with one of the expected OneDice syntax elements.',
    },
  )
}

function expectedTerms(state: number): string[] {
  return Object.keys(table[state] ?? {})
    .filter(key => terminalTerms.has(key))
    .sort()
}
