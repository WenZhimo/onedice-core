import {
  Producer, BufferElement,
  NumberToken, InterpolationToken, TermToken, TokenRange, VariableToken,
} from '../parser'
import { DNode, PNode, CNode, ANode, FNode } from './dice'
import { BracketNode } from './bracket'
import { ClampNode } from './clamp'
import { BooleanNode, ComparisonNode, ConditionalNode } from './conditionals'
import { InterpolationNode } from './interpolation'
import { LoopNode } from './loop'
import { NumberNode } from './number'
import { SimpleNode } from './simple'
import { TupleNode } from './tuple'
import { TupleProjectionNode } from './tuple-projection'
import { TupleSelectionNode } from './tuple-selection'
import { TupleSliceNode } from './tuple-slice'
import { UnaryNode } from './unary'
import { VariableReferenceNode } from './variable'
import { Config } from '..'
import { OneDiceError } from '../errors'

export * from './bracket'
export * from './clamp'
export * from './conditionals'
export * from './loop'
export * from './simple'
export * from './success-count'
export * from './number'
export * from './tuple'
export * from './tuple-projection'
export * from './tuple-selection'
export * from './tuple-slice'
export * from './unary'
export * from './variable'
export * from './dice'

export interface DiceNode<T = unknown> {
  evaluation: T
  eval(config: Config): number
  // If this node contains dices. Used to determine whether to show details
  pure(): boolean
  toString(indentation?: number): string
  range?: TokenRange
}

interface Options extends DiceNode {
  options: Record<string, DiceNode>
}

export function resolve(producer: Producer, nodes: BufferElement[]): BufferElement {
  switch (producer.id) {
    case 1: {
      return nodes[0] as DiceNode
    }
    case 57: {
      const condition = nodes[0] as DiceNode
      const consequent = nodes[2] as DiceNode
      const alternate = nodes[4] as DiceNode
      return withRange(new ConditionalNode(condition, consequent, alternate), nodes)
    }
    case 59:
    case 61: {
      const left = nodes[0] as DiceNode
      const operator = nodes[1] as TermToken
      const right = nodes[2] as DiceNode
      return withRange(new BooleanNode(operator.value as '&' | '|', left, right), nodes)
    }
    case 63:
    case 64:
    case 65: {
      const left = nodes[0] as DiceNode
      const operator = nodes[1] as TermToken
      const right = nodes[2] as DiceNode
      return withRange(new ComparisonNode(operator.value as '>' | '<' | '=', left, right), nodes)
    }
    case 58:
    case 60:
    case 62:
    case 66: {
      return nodes[0] as DiceNode
    }
    case 2:
    case 3:
    case 7:
    case 8:
    case 9:
    case 11: {
      const operator = nodes[1] as TermToken
      const left = nodes[0] as DiceNode
      const right = nodes[2] as DiceNode
      return withRange(new SimpleNode(operator.value, left, right), nodes)
    }
    case 4:
    case 5: {
      const operator = nodes[0] as TermToken
      const right = nodes[1] as DiceNode
      return withRange(new UnaryNode(operator.value, right), nodes)
    }
    case 6:
    case 10:
    case 12:
    case 18: {
      return nodes[0] as DiceNode
    }
    case 44: {
      return nodes[0] as DiceNode
    }
    case 48:
    case 49:
    case 50:
    case 51: {
      const left = nodes[0] as DiceNode
      const operator = nodes[1] as TermToken
      const count = nodes[2] as DiceNode | null
      return withRange(new TupleSelectionNode(operator.value as 'kh' | 'kl' | 'dh' | 'dl', left, count), nodes)
    }
    case 54: {
      const left = nodes[0] as DiceNode
      return withRange(new TupleProjectionNode(left), nodes)
    }
    case 55: {
      const left = nodes[0] as DiceNode
      const parameters = nodes[2] as TupleNode
      return withRange(new TupleSliceNode(left, parameters), nodes)
    }
    case 67: {
      const bounds = nodes[0] as DiceNode
      const body = nodes[2] as TupleNode
      return withRange(new LoopNode(bounds, body), nodes)
    }
    case 52:
    case 53: {
      const left = nodes[0] as DiceNode
      const operator = nodes[1] as TermToken
      const right = nodes[2] as DiceNode
      return withRange(new ClampNode(operator.value as 'min' | 'max', left, right), nodes)
    }
    case 13:
    case 14:
    case 15:
    case 16:
    case 17: {
      return nodes[0] as DiceNode
    }
    case 19: {
      return withRange(new BracketNode(nodes[1] as DiceNode), nodes)
    }
    case 20: {
      const num = nodes[0] as NumberToken
      return withRange(new NumberNode(num.value), nodes)
    }
    case 21: {
      const int = nodes[0] as InterpolationToken
      return withRange(new InterpolationNode(int.value), nodes)
    }
    case 56: {
      const variable = nodes[0] as VariableToken
      return withRange(new VariableReferenceNode(variable.value), nodes)
    }
    case 45: {
      return withRange(new TupleNode(nodes[1] as DiceNode[]), nodes)
    }
    case 46: {
      return [...nodes[0] as DiceNode[], nodes[2] as DiceNode]
    }
    case 47: {
      return [nodes[0] as DiceNode]
    }
    case 22:
    case 24: {
      return nodes[0] as DiceNode
    }
    case 23:
    case 25:
    case 32:
    case 39:
    case 42: {
      return null
    }
    case 26: {
      const a = nodes[0] as DiceNode
      const b = nodes[2] as DiceNode
      const o = (nodes[3] as Options)?.options || {}
      const kq = o.k ? 'k' : (o.q ? 'q' : null)
      const pb = o.p ? 'p' : (o.b ? 'b' : null)
      return withRange(new DNode(a, b, o.k || o.q, o.p || o.b, o.a, kq, pb), nodes)
    }
    case 33:
    case 34: {
      const a = nodes[0] as DiceNode
      const b = nodes[2] as DiceNode
      const pb = (nodes[1] as TermToken).value as 'p' | 'b'
      return withRange(new PNode(a, b, pb), nodes)
    }
    case 35: {
      const a = nodes[0] as DiceNode
      const b = nodes[2] as DiceNode
      const o = (nodes[3] as Options)?.options || {}
      return withRange(new ANode(a, b, o.k, o.q, o.m), nodes)
    }
    case 40: {
      const a = nodes[0] as DiceNode
      const b = nodes[2] as DiceNode
      const o = (nodes[3] as Options)?.options || {}
      return withRange(new CNode(a, b, o.m), nodes)
    }
    case 43: {
      const a = nodes[0] as DiceNode
      const b = nodes[2] as DiceNode
      return withRange(new FNode(a, b), nodes)
    }
    case 27:
    case 28:
    case 29:
    case 30:
    case 31:
    case 36:
    case 37:
    case 38:
    case 41: {
      let prev = nodes[0] as Options
      if (!prev) prev = { options: {} } as Options
      const name = (nodes[1] as TermToken).value
      prev.options[name] = nodes[2] as DiceNode
      return withRange(prev, nodes)
    }
    default:
      throw new OneDiceError(
        'PARSE_UNSUPPORTED_SYNTAX',
        `Unsupported grammar production: ${producer.id}`,
        {
          actual: producer.id,
          hint: 'This parser table production is not mapped to an AST node.',
        },
      )
  }
}

function withRange<TNode extends DiceNode>(node: TNode, nodes: BufferElement[]): TNode {
  node.range = getNodeRange(nodes)
  return node
}

function getNodeRange(nodes: BufferElement[]): TokenRange | undefined {
  const ranges = nodes
    .map(node => node && 'range' in node ? node.range : undefined)
    .filter((range): range is TokenRange => Boolean(range))

  if (ranges.length === 0) return undefined

  return {
    start: Math.min(...ranges.map(range => range.start)),
    end: Math.max(...ranges.map(range => range.end)),
  }
}
