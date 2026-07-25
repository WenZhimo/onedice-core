# ADR-001: 浏览器包输出策略

## Status

Accepted

## Date

2026-07-16

## Context

本 fork 的主要目标是让 `@onedice/core` 可以直接嵌入浏览器应用。调用方需要：

- 在 Vite、React、Vue 等现代前端项目中直接 `import`。
- 在仍使用 CommonJS 的工具链中继续 `require()`。
- 获取稳定 `.d.ts` 类型声明。
- 发布包时只包含运行所需产物，避免把 `src/`、`test/`、`docs/`、`node_modules/` 或临时 tarball 发出去。
- 在浏览器 bundle 中不引入 `fs`、`path`、`os`、`crypto`、`process.`、`Buffer` 或其他 Node-only/polyfill 依赖。

原仓库缺少现代浏览器包输出和发布内容审计，本地改造已经引入 `tsup`、`exports`、`files`、`sideEffects=false` 和 Vite smoke test。浏览器 smoke test 不得只检查“能 build”，还必须执行构建产物并扫描 bundle 中是否出现 Node-only 依赖痕迹。

## Decision

使用 `tsup` 作为主构建工具，从 `src/index.ts` 输出：

- `dist/index.mjs`：ESM 入口，供浏览器打包器消费。
- `dist/index.cjs`：CommonJS 入口，供旧 Node/CJS 调用方消费。
- `dist/index.d.ts` 与 `dist/index.d.mts`：类型声明。

`package.json` 必须保持：

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "sideEffects": false
}
```

浏览器 smoke test 必须从构建后的 `dist/index.mjs` 导入，而不是直接导入 `src/`。测试必须真实执行 Vite 产物，并断言 bundle 不包含 `fs`、`path`、`os`、`crypto` 的 import/require、`process.` 或 `Buffer`。如果未来需要顶层副作用或 Node-only 入口，必须先新增 ADR 或 superseding ADR，把副作用、入口隔离和浏览器验证方式写清楚。

## Alternatives Considered

### 只使用 `tsc`

- 优点：开发依赖更少，构建链更保守。
- 缺点：双 ESM/CJS 输出、扩展名和声明文件管理更繁琐。
- 结论：不作为主路径；只在 `tsup` 不可用时作为应急退路。

### Rollup

- 优点：浏览器库生态成熟，可控性强。
- 缺点：当前项目体积小，Rollup 配置成本高于收益。
- 结论：可作为未来复杂打包需求的替代方案，但当前不采用。

### 只发布源码

- 优点：发布流程简单。
- 缺点：把转译责任推给下游，浏览器兼容性和类型入口不可控。
- 结论：不采用。

## Compatibility Impact

- `dice()` 的旧 API 不变。
- 新增 `roll()`、错误类型和值模型类型会通过同一包入口导出。
- 下游 ESM 与 CJS 调用方都应当能继续消费包入口。
- `files: ["dist"]` 意味着发布包不包含 `docs/` 和 `test/`；文档仍保留在仓库中。
- `sideEffects: false` 告诉打包器包入口没有顶层注册、I/O、环境探测或随机数副作用；所有状态都应当来自调用方显式传入的配置。
- 浏览器包不得为了兼容 FVTT、变量 resolver 或未来 V2 能力而访问 Node 内置模块、`process.env`、`Buffer`、WASM/Rust 二进制或 Foundry runtime 全局对象。

## Test Requirements

发布前必须通过：

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd pack --dry-run
```

`npm.cmd pack --dry-run` 的内容必须只包含 `README.md`、`package.json` 和 `dist/` 产物。`test/browser/package-contents.test.ts` 必须通过 `npm pack --dry-run --json` 解析实际 pack 文件列表，并拒绝 `src/`、`test/`、`docs/`、`node_modules/`、临时 tarball、WASM 和 native addon 产物进入发布包。

`test/browser/vite-import.test.ts` 必须覆盖：

- `package.json.sideEffects === false`。
- 从构建后的 `dist/index.mjs` 经 Vite 打包并执行 bundle。
- bundle 文本中不得出现 Node-only import/require、`process.` 或 `Buffer`。
- bundle 运行时至少调用 `dice()`、`rollProgram()`、`lp`、FVTT pool、`@path` resolver、`df` alias、`cs` 成功计数和 Foundry runtime binding 结构化拒绝路径。

`test/browser/package-contents.test.ts` 必须覆盖：

- `package.json.main/module/types/exports` 必须分别指向 `dist/index.cjs`、`dist/index.mjs` 和 `dist/index.d.ts`。
- `package.json.files` 必须等于 `["dist"]`。
- `dist/index.cjs` 必须可以被 CommonJS `require()` 并调用 `dice()`、`roll()` 和 `OneDiceError`。
- `dist/index.d.ts` 必须导出 `dice()`、`roll()`、`rollProgram()`、`OneDiceError`、`Config`、`RollFeatureFlags`、`SyntaxMode`、`RollResult`、`RollValue`、`RollTrace`、`RollDiagnostic` 和 `ProgramResult`。
- `npm pack --dry-run --json` 必须包含 `README.md`、`package.json`、`dist/index.cjs`、`dist/index.mjs` 和 `dist/index.d.ts`。
- 实际 pack 文件路径不得落入 `src/`、`test/`、`docs/`、`node_modules/`，也不得包含 `.tgz`、`.wasm` 或 native addon 产物。

## Rollback Strategy

如果 `tsup` 输出在某些环境下不可用，应当：

1. 保留当前 `exports` 合同不变。
2. 用 `tsc` 双配置或 Rollup 生成同名产物。
3. 保持 `test/browser/vite-import.test.ts` 继续从 `dist/index.mjs` 验证。
