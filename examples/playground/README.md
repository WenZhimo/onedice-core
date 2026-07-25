# @onedice/core Browser Playground

这是一个最小浏览器 Playground，用来验证 `@onedice/core` 在浏览器中的实际使用体验。它不修改核心库语义，不新增骰子语法，也不进入 npm 发布包。

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
