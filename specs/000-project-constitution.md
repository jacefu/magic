# Spec 000: 项目宪章（Project Constitution）

> 本文件定义 MAGIC Client 项目的不可变原则。所有 spec 必须遵守这些原则。

---

## 项目身份

- **产品名称**：MAGIC Client（Multi-Agent Governance & Intelligent Collaboration Client）
- **所属平台**：Magic — 企业级多 Agent 协同平台
- **协议基座**：Matrix（通过 Tuwunel homeserver）
- **商业属性**：闭源商业产品，技术栈零 Copyleft 依赖

## 技术红线

1. **许可证合规**：禁止引入 AGPL/GPL 依赖。所有依赖必须为 Apache 2.0 / MIT / BSD / ISC
2. **Electron 安全**：`contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`，永远不直接暴露 `ipcRenderer`
3. **E2EE 必须**：所有加密房间必须使用 `initRustCrypto()`，禁止回退到 libolm
4. **MatrixClient 位置**：运行在 renderer 进程（IndexedDB 加密存储），main 进程仅处理原生 OS 功能
5. **类型安全**：TypeScript strict 模式，所有 Matrix 自定义事件使用 Zod schema 校验
6. **单向依赖**：`shared-types` ← `matrix-client` / `ui` ← `desktop` / `web`，禁止循环引用

## 内容红线

1. **禁止引用 DeerFlow 2.0 / ByteDance 项目**：在任何 Magic/AgentScope 相关材料中不得出现
2. **品牌一致性**：MAGIC = Multi-Agent Governance & Intelligent Collaboration

## 技术栈锁定

| 层级 | 选型 | 许可证 | 锁定版本 |
|------|------|--------|---------|
| Matrix SDK | matrix-js-sdk | Apache 2.0 | ^41.3.0 |
| E2EE | @matrix-org/matrix-sdk-crypto-wasm | Apache 2.0 | ^18.0.0 |
| 桌面端 | Electron | MIT | ^38.0.0 |
| 构建 | electron-vite + electron-builder | MIT | ^5.0.0 / ^26.9.0 |
| UI 框架 | React | MIT | ^19.0.0 |
| 状态管理 | Zustand + immer | MIT | ^5.0.0 |
| CSS | Tailwind CSS v4 | MIT | ^4.2.0 |
| 组件 | shadcn/ui (Radix) | MIT | latest |
| 类型校验 | Zod | MIT | ^3.24.0 |
| Monorepo | pnpm + Turborepo | MIT | ^10.17.0 / ^2.8.0 |
| 测试 | Vitest + Playwright | MIT | ^3.2.0 |
| Homeserver | Tuwunel | Apache 2.0 | v1.6.0+ |

## 开发原则

1. **Spec 先行**：每个功能模块必须有 spec 文件，Claude Code 实现前必须先读 spec
2. **增量交付**：按 Wave（波次）顺序实施，每个 spec 完成后可独立验证
3. **原子提交**：每个任务完成后运行测试 + typecheck，通过后立即提交
4. **最小 IPC**：仅原生 OS 功能走 IPC，Matrix 事件流在 renderer 内处理