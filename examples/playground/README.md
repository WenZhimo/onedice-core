# @onedice/core Browser Playground

这是一个最小浏览器 Playground，用来验证 `@onedice/core` 在浏览器中的实际使用体验。它不修改核心库语义，不新增骰子语法，也不进入 npm 发布包。

该文档参考了上游 OneDice 的 `inputdescribe.md` 语法说明，并结合本仓库当前已实现的浏览器合同整理。

## 运行

```bash
npm install
npm run playground
```

默认 Vite 会启动本地开发服务，通常地址为：

```text
http://127.0.0.1:5173/
```

如果该端口已被占用，Vite 会自动选择下一个可用端口。

## 浏览器演示用法

1. 在“表达式”输入框中输入 OneDice 表达式，例如 `2d6+1d20`。
2. 选择语法模式：
   - `OneDice 默认语法`：使用本库默认 V1 语法。
   - `FVTT 兼容语法`：启用 FVTT 兼容输入归一化和受控子集。
3. 按需要勾选功能开关。未勾选的实验语法会保持关闭。
4. 使用“固定随机序列”复现结果。随机序列会按实际随机调用顺序逐个消费，例如 `2d6+1d20` 需要 3 个随机值。
5. 点击“掷骰”或直接修改输入。页面会同步显示：
   - 结果值。
   - 表达式自然语言解析。
   - 每个骰子的独立点数。
   - 可复用骰子结果组件，以及组件内的“重投”按钮。
   - `raw`、`trace`、`diagnostics` JSON。
   - 结构化错误 code、message、meta，以及 `meta.range` 高亮。

零基础说明页位于：

```text
http://127.0.0.1:5173/docs.html
```

该页面按“概念 -> 可运行示例 -> 浅显解释”组织。示例不会跳转回演示页，而是在说明页内直接用同一个骰子结果组件渲染；每个示例都可以编辑表达式、运行，并用“重置”恢复默认表达式和默认首屏结果。功能开关章节也为每个开关提供了可运行示例。

## 基础语法速查

| 语法 | 含义 | 示例 |
| --- | --- | --- |
| `AdB` | 投掷 A 个 B 面骰并求和；省略 A 时默认为 1，省略 B 时默认为 100 | `d`、`d20`、`2d6`、`2d` |
| `AdBkC` | 投掷 A 个 B 面骰，保留最大的 C 个 | `4d6k3` |
| `AdBqC` | 投掷 A 个 B 面骰，保留最小的 C 个 | `4d6q2` |
| `AdBpD` | COC 惩罚骰 | `1d100p1`、`p1` |
| `AdBbD` | COC 奖励骰 | `1d100b1`、`b1` |
| `AdBaE` | 普通 d 表达式内的骰池成功计数，统计不低于 E 的骰子 | `4d6a5` |
| `AfB` | FATE 骰，默认 `4f3` | `4f` |
| `df` | FVTT/FATE 常见别名，需开启 `fateAlias` | `4df` |
| `[x,y,z]` | 元组字面量，需开启 `tupleLiterals` | `[1,2,3]` |
| `[1,2,3]kh1` | 元组保留/丢弃，需开启 `tupleOperators` | `[1,2,3]kh1` |
| `{4d6,3d8}kh` | FVTT 风格骰池，需 `fvtt-compatible` 与 `tupleOperators` | `{4d6,3d8}kh` |
| `1d20cs>15` | FVTT 成功计数，需 `fvtt-compatible` 与 `fvttSuccessCounting` | `1d20cs>15` |

普通 `d` 表达式的完整合同见根 README 的“`d` 表达式说明”和 `docs/decisions/0010-d-expression-contract.md`。其中明确了槽位默认值、合法组合、互斥 modifier、错误码和浏览器 UI 可消费的 `meta.range`。

## 选项功能

| 选项 | 功能 | 常用示例 |
| --- | --- | --- |
| `tupleLiterals` | 开启 `[1,2,3]` 这类元组字面量 | `[1,2,3]` |
| `tupleOperators` | 开启 `kh/kl/dh/dl` 这类元组选取或丢弃 | `[1,2,3]kh1` |
| `clampOperators` | 开启 `min/max` 上下限裁剪 | `[1,2,3]max2` |
| `tupleProjection` | 开启元组投影 | `[1,2,3]tp` |
| `tupleSlice` | 开启元组裁切 | `[1,2,3]sp[1,2]` |
| `conditionals` | 开启条件表达式 | `1>0?1d6:1d4` |
| `loopOperator` | 开启循环运算符 | `3lp[1d6]` |
| `fateAlias` | 将 `df` 归一化为 FATE 骰 | `4df` |
| `fvttSuccessCounting` | 开启 FVTT 风格成功计数 | `4d6cs>4` |

## 表达式解析与骰子展示

Playground 使用 `roll()` 返回的 `trace` 和 `raw` 构造自然语言说明，不额外调用私有 parser，也不修改核心库语义。

- 普通 `d` 表达式会显示骰数、面数、modifier、每次投掷点数以及是否计入结果。
- 复合表达式会递归解释子表达式，例如 `2d6+1d20` 会分别显示两个 d6 和一个 d20 的点数。
- FATE、COC 奖惩骰和骰池会按各自 trace 结构拆出可见骰子。
- `src/dice-result.ts` 是可复用的小型骰子结果组件，可渲染结果值、骰子点数和重投按钮。
- 错误输入不会生成自然语言成功解析；页面会显示结构化错误，并用 `meta.range` 高亮问题片段。

## 构建

```bash
npm run playground:build
```

该命令只构建 `examples/playground`，产物位于 `examples/playground/dist/`。根 `package.json` 的 `files` 白名单仍然只包含 `dist`，因此 playground 不会进入 `npm pack` 的发布内容。

## 导入方式

Playground 代码中使用：

```ts
import { OneDiceError, roll } from '@onedice/core'
```

`examples/playground/vite.config.ts` 将 `@onedice/core` alias 到仓库本地 `src/index.ts`，因此本地开发时可以直接验证当前分支源码；真实浏览器项目安装包后仍应从 `@onedice/core` 包入口导入。
