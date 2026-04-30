# MAGIC Client — Magic Matrix IM 客户端

## 项目概述
基于 matrix-js-sdk + Electron + React 从零构建的企业级 Matrix IM 客户端，
服务于 Magic 多 Agent 协同平台的商业化需求。

## 架构
- Monorepo: pnpm workspace + Turborepo
- 桌面端: Electron 38 + electron-vite
- Web 端: Vite SPA
- SDK: matrix-js-sdk v41.3.0 + @matrix-org/matrix-sdk-crypto-wasm
- UI: React 19 + Zustand + Tailwind CSS v4 + shadcn/ui
- 类型: TypeScript strict + Zod

## 命令
- 开发: `pnpm dev` / `pnpm dev:desktop` / `pnpm dev:web`
- 构建: `pnpm build`
- 测试: `pnpm test`
- 代码检查: `pnpm lint:fix`
- 类型检查: `pnpm typecheck`
- 格式化: `pnpm format`
- 清理: `pnpm clean`

## 代码规范
- 全局 ES modules，TypeScript strict 模式
- Zustand 管理状态，immer 中间件处理嵌套更新
- 使用 matrix-js-sdk 类型化事件枚举（RoomEvent.Timeline，非字符串）
- IPC 通道使用 domain:action 命名（matrix:login, settings:get）
- 组件使用函数式声明 + React.memo 优化
- 所有自定义 Matrix 事件类型在 @magic/shared-types 中定义

## Spec 工作流
- 实现前始终阅读 specs/ 中的相关 spec
- 涉及 3+ 个文件的变更使用 Plan Mode（Shift+Tab）
- 每个任务由子代理在新上下文中实现
- 每个完成的任务后运行测试并提交

## 边界
- ✅ 始终: 运行测试、遵循现有模式、使用类型化 IPC
- ⚠️ 先确认: 新依赖、Matrix 事件 schema 变更、IPC 通道新增
- 🚫 禁止: 直接暴露 ipcRenderer、提交密钥、生产环境跳过 E2EE