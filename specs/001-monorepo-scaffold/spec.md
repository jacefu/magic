# Spec 001: Monorepo 脚手架初始化

> 优先级: P0 | 波次: Wave 1 | 预估: 1-2 天 | 前置依赖: 无

---

## 1. 目标

搭建 MAGIC Client 项目的 monorepo 基础架构，包括 pnpm workspace、Turborepo 构建编排、共享 TypeScript 配置、ESLint/Prettier 代码规范、Tailwind CSS 样式系统，以及所有包的空壳结构。完成后，团队可以在各包中独立开发并通过 `pnpm dev` / `pnpm build` / `pnpm test` 统一运行。

### 用户故事

- 作为开发者，我希望运行 `pnpm install` 后所有包的依赖正确链接，无报错
- 作为开发者，我希望运行 `pnpm dev` 后 Electron 桌面端和 Web 端均可热重载启动
- 作为开发者，我希望运行 `pnpm build` 后所有包按依赖顺序构建成功
- 作为开发者，我希望运行 `pnpm test` 后 Vitest 能发现并运行所有包的测试
- 作为开发者，我希望运行 `pnpm typecheck` 后全局类型检查通过
- 作为开发者，我希望运行 `pnpm lint` 后 ESLint 检查所有包并自动修复

---

## 2. 产出物

### 2.1 包结构

```
magic-client/                          # 项目根目录
├── .github/
│   └── workflows/
│       └── ci.yml                     # GitHub Actions CI
├── .claude/
│   └── rules/
│       ├── matrix-events.md           # Matrix 事件编写规则
│       └── electron-security.md       # Electron 安全规则
├── CLAUDE.md                          # Claude Code 项目配置
├── specs/
│   ├── 000-project-constitution.md
│   └── 001-monorepo-scaffold/
│       └── spec.md                    # 本文件
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                       # 根 package.json
├── tsconfig.base.json                 # 共享 TS 基础配置
├── .npmrc
├── .gitignore
├── .prettierrc
├── .eslintrc.cjs
├── vitest.workspace.ts                # Vitest workspace 配置
│
├── apps/
│   ├── desktop/                       # @magic/desktop
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.node.json
│   │   ├── electron-builder.yml
│   │   ├── electron.vite.config.ts
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   └── index.ts           # Electron main 进程入口
│   │   │   ├── preload/
│   │   │   │   ├── index.ts           # contextBridge 桥接
│   │   │   │   └── index.d.ts         # 类型声明
│   │   │   └── renderer/
│   │   │       ├── index.html
│   │   │       └── src/
│   │   │           ├── main.tsx        # React 入口
│   │   │           ├── App.tsx         # 根组件（含占位 UI）
│   │   │           └── env.d.ts
│   │   └── e2e/
│   │       └── .gitkeep
│   │
│   └── web/                           # @magic/web
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           └── env.d.ts
│
└── packages/
    ├── matrix-client/                 # @magic/matrix-client
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── tsup.config.ts
    │   ├── src/
    │   │   └── index.ts               # 空导出占位
    │   └── __tests__/
    │       └── client.test.ts          # 占位测试
    │
    ├── ui/                            # @magic/ui
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── tsup.config.ts
    │   ├── src/
    │   │   ├── index.ts
    │   │   └── components/
    │   │       └── Placeholder.tsx     # 占位组件
    │   └── __tests__/
    │       └── placeholder.test.tsx    # 占位测试
    │
    ├── shared-types/                  # @magic/shared-types
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── matrix-events.ts       # Magic 自定义事件类型
    │   │   └── ipc-channels.ts        # IPC 类型定义
    │   └── __tests__/
    │       └── schemas.test.ts
    │
    └── config/                        # @magic/config（共享配置）
        ├── eslint/
        │   └── index.cjs
        ├── tsconfig/
        │   ├── base.json
        │   ├── react.json
        │   └── node.json
        └── tailwind/
            └── preset.js
```

### 2.2 每个包的职责

| 包名 | 职责 | 构建工具 |
|------|------|---------|
| `@magic/desktop` | Electron 桌面应用 | electron-vite |
| `@magic/web` | Web SPA 部署 | Vite |
| `@magic/matrix-client` | matrix-js-sdk 封装层 | tsup |
| `@magic/ui` | 共享 React 组件 | tsup |
| `@magic/shared-types` | 跨包类型定义 + Zod schema | 无构建（源码引用） |
| `@magic/config` | 共享 ESLint/TS/Tailwind 配置 | 无构建 |

---

## 3. 技术规格

### 3.1 根 package.json

```json
{
  "name": "magic-client",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.17.0",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  },
  "scripts": {
    "dev": "turbo run dev",
    "dev:desktop": "turbo run dev --filter=@magic/desktop",
    "dev:web": "turbo run dev --filter=@magic/web",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint -- --fix",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,js,cjs,json,md}\"",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.8.0",
    "prettier": "^3.5.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.8.0"
  }
}
```

### 3.2 pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3.3 .npmrc

```ini
node-linker=hoisted
shamefully-hoist=true
auto-install-peers=true
strict-peer-dependencies=false
```

> `shamefully-hoist=true` 是 electron-builder 兼容性的关键——Electron 打包需要依赖在顶层 node_modules 中。

### 3.4 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "out/**"],
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "test": {
      "outputs": ["coverage/**"],
      "dependsOn": ["build"]
    },
    "test:e2e": {
      "cache": false,
      "dependsOn": ["build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 3.5 tsconfig.base.json（根目录）

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true
  },
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### 3.6 packages/config/tsconfig/ 分层配置

**base.json**（纯 TS 库）：
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "incremental": true
  }
}
```

**react.json**（React 组件库 / Renderer 进程）：
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  }
}
```

**node.json**（Electron main 进程 / CLI）：
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"]
  }
}
```

### 3.7 库包 package.json 模板（以 @magic/matrix-client 为例）

```json
{
  "name": "@magic/matrix-client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@magic/shared-types": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "vitest": "^3.2.0",
    "typescript": "^5.8.0"
  }
}
```

> **关键设计**：开发阶段 `exports` 直接指向 `./src/index.ts`（源码引用），避免每次修改都重新构建。正式发布时通过 `publishConfig` 切换到 `./dist/`。

### 3.8 tsup.config.ts（库包通用）

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2023",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  external: [
    "react",
    "react-dom",
    "matrix-js-sdk",
    "zustand",
  ],
});
```

### 3.9 @magic/shared-types 核心类型定义

```typescript
// packages/shared-types/src/matrix-events.ts
import { z } from "zod";

/** Magic 自定义 Matrix 事件类型常量 */
export const MAGIC_EVENTS = {
  AGENT_STATUS: "com.magic.agent.status",
  TASK_ASSIGNMENT: "com.magic.task.assignment",
  SOUL_CONTENT: "com.magic.soul.content",
  MEMORY_CONTENT: "com.magic.memory.content",
  HEARTBEAT: "com.magic.heartbeat",
} as const;

export const AgentStatusEvent = z.object({
  agent_id: z.string(),
  status: z.enum(["active", "idle", "offline", "error"]),
  capabilities: z.array(z.string()),
  model: z.string().optional(),
  current_task_id: z.string().nullable(),
  timestamp: z.number(),
});
export type AgentStatusEvent = z.infer<typeof AgentStatusEvent>;

export const TaskAssignmentEvent = z.object({
  task_id: z.string(),
  title: z.string(),
  assignee: z.string(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  due_date: z.string().optional(),
  description: z.string().optional(),
});
export type TaskAssignmentEvent = z.infer<typeof TaskAssignmentEvent>;

export const SoulContentEvent = z.object({
  content: z.string(),
  file_type: z.enum(["soul", "memory"]),
  version: z.number(),
  editor: z.string(),
});
export type SoulContentEvent = z.infer<typeof SoulContentEvent>;
```

```typescript
// packages/shared-types/src/ipc-channels.ts

/** Electron IPC 通道类型定义 */
export interface IElectronAPI {
  // Matrix 认证
  matrixLogin: (homeserver: string, username: string, password: string) => Promise<LoginResponse>;
  matrixLogout: () => Promise<void>;
  matrixRestoreSession: () => Promise<boolean>;

  // 消息
  matrixSendMessage: (roomId: string, body: string, html?: string) => Promise<void>;
  matrixSendFile: (roomId: string, filePath: string) => Promise<void>;

  // 事件流
  onMatrixEvent: (cb: (event: SerializedMatrixEvent) => void) => () => void;
  onSyncStateChange: (cb: (state: string) => void) => () => void;

  // 设置
  getSettings: () => Promise<AppSettings>;
  setSetting: (key: string, value: unknown) => Promise<void>;

  // 窗口
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}

export interface LoginResponse {
  userId: string;
  deviceId: string;
  accessToken: string;
  homeserver: string;
}

export interface SerializedMatrixEvent {
  eventId: string;
  roomId: string;
  type: string;
  sender: string;
  content: Record<string, unknown>;
  timestamp: number;
  unsigned?: Record<string, unknown>;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: "zh" | "en";
  notifications: boolean;
  startMinimized: boolean;
  homeserver: string;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
```

### 3.10 Electron Desktop 关键配置

**electron.vite.config.ts**：
```typescript
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: resolve(__dirname, "src/main/index.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.ts"),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer/src"),
      },
    },
  },
});
```

**electron-builder.yml**：
```yaml
appId: com.magic.client
productName: MAGIC Client
directories:
  output: release
  buildResources: build
files:
  - dist/**/*
  - "!node_modules/**/*"
mac:
  category: public.app-category.productivity
  target:
    - dmg
    - zip
  notarize: false  # 开发阶段关闭
win:
  target:
    - nsis
  nsis:
    oneClick: false
    allowToChangeInstallationDirectory: true
publish:
  provider: github
  owner: magic-platform
  repo: magic-client
```

**src/main/index.ts**（最小 Electron 入口）：
```typescript
import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    titleBarStyle: "hiddenInset", // macOS 无框窗口
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  // 外部链接在系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // 开发环境加载 HMR，生产环境加载本地文件
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

**src/preload/index.ts**（最小桥接）：
```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // 占位 — 后续 spec 逐步填充
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke("settings:set", key, value),
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximize: () => ipcRenderer.send("window:maximize"),
  windowClose: () => ipcRenderer.send("window:close"),
});
```

### 3.11 Web 端 Vite 配置

```typescript
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    target: "esnext",
  },
});
```

### 3.12 Vitest Workspace 配置

```typescript
// vitest.workspace.ts（根目录）
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/matrix-client",
  "packages/ui",
  "packages/shared-types",
  "apps/web",
]);
```

### 3.13 ESLint 配置

```javascript
// .eslintrc.cjs（根目录）
module.exports = {
  root: true,
  env: { browser: true, es2023: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "react-refresh"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  ignorePatterns: ["dist/", "node_modules/", "coverage/", "*.d.ts"],
};
```

### 3.14 占位 React 应用（desktop & web 共用模式）

```tsx
// App.tsx（桌面端和 Web 端各有一份，初始内容相同）
export default function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          MAGIC Client
        </h1>
        <p className="mt-2 text-gray-400">
          Magic 企业级多 Agent 协同平台
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Spec 001 ✅ Monorepo 脚手架已就绪
        </p>
      </div>
    </div>
  );
}
```

### 3.15 Tailwind CSS v4 配置

```css
/* apps/desktop/src/renderer/src/index.css */
@import "tailwindcss";

@theme {
  --color-magic-primary: #2563eb;
  --color-magic-secondary: #7c3aed;
  --color-magic-accent: #06b6d4;
  --color-magic-surface: #111827;
  --color-magic-surface-alt: #1f2937;
  --font-sans: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

> Tailwind v4 使用 CSS-first 配置，不需要 `tailwind.config.js`。

### 3.16 CLAUDE.md

```markdown
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
```

### 3.17 .gitignore

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
out/
release/
*.tsbuildinfo

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Test
coverage/

# Turbo
.turbo/

# Electron
*.dmg
*.exe
*.msi
*.AppImage
```

---

## 4. 验收标准

| # | 检查项 | 验证命令 |
|---|--------|---------|
| AC-1 | `pnpm install` 无报错，所有 workspace 包正确链接 | `pnpm install && pnpm ls -r` |
| AC-2 | `pnpm typecheck` 全部通过 | `pnpm typecheck` |
| AC-3 | `pnpm lint` 全部通过 | `pnpm lint` |
| AC-4 | `pnpm test` 所有占位测试通过 | `pnpm test` |
| AC-5 | `pnpm build` 所有包按依赖序构建成功 | `pnpm build` |
| AC-6 | `pnpm dev:desktop` 启动 Electron 窗口显示占位 UI | 手动验证 |
| AC-7 | `pnpm dev:web` 启动 Vite dev server 显示占位 UI | 手动验证 |
| AC-8 | @magic/shared-types 可被其他包正确引用 | 在 matrix-client 中 import 类型并 typecheck |
| AC-9 | Tailwind CSS 类在占位 UI 中生效 | 视觉检查背景色和字体 |

---

## 5. 实现任务（按执行顺序）

### 任务 1：初始化根目录配置

**描述**：创建 Git 仓库根目录的所有配置文件。

**创建文件**：
- `package.json`
- `pnpm-workspace.yaml`
- `.npmrc`
- `turbo.json`
- `tsconfig.base.json`
- `.gitignore`
- `.prettierrc`（内容：`{ "semi": true, "singleQuote": false, "tabWidth": 2, "trailingComma": "all" }`）
- `.eslintrc.cjs`
- `vitest.workspace.ts`

**验证**：
```bash
pnpm install  # 应成功（此时还无 workspace 包）
```

---

### 任务 2：创建 @magic/config 共享配置包

**描述**：创建共享的 tsconfig、ESLint、Tailwind 配置预设。

**创建文件**：
- `packages/config/package.json`
- `packages/config/tsconfig/base.json`
- `packages/config/tsconfig/react.json`
- `packages/config/tsconfig/node.json`
- `packages/config/tailwind/preset.js`

**验证**：
```bash
pnpm install  # workspace 包链接正确
```

---

### 任务 3：创建 @magic/shared-types 类型包

**描述**：创建跨包共享的类型定义，含 Zod schema。

**创建文件**：
- `packages/shared-types/package.json`
- `packages/shared-types/tsconfig.json`
- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/matrix-events.ts`
- `packages/shared-types/src/ipc-channels.ts`
- `packages/shared-types/__tests__/schemas.test.ts`

**验证**：
```bash
cd packages/shared-types && pnpm test && pnpm typecheck
```

---

### 任务 4：创建 @magic/matrix-client 空壳包

**描述**：创建 SDK 封装包的骨架，含 tsup 配置和占位导出。

**创建文件**：
- `packages/matrix-client/package.json`（依赖 `@magic/shared-types`）
- `packages/matrix-client/tsconfig.json`
- `packages/matrix-client/tsup.config.ts`
- `packages/matrix-client/src/index.ts`（导出占位常量）
- `packages/matrix-client/__tests__/client.test.ts`

**验证**：
```bash
cd packages/matrix-client && pnpm build && pnpm test && pnpm typecheck
```

---

### 任务 5：创建 @magic/ui 共享组件包

**描述**：创建 React 组件库骨架，含占位组件。

**创建文件**：
- `packages/ui/package.json`（依赖 react, @magic/shared-types）
- `packages/ui/tsconfig.json`
- `packages/ui/tsup.config.ts`
- `packages/ui/src/index.ts`
- `packages/ui/src/components/Placeholder.tsx`
- `packages/ui/__tests__/placeholder.test.tsx`

**验证**：
```bash
cd packages/ui && pnpm build && pnpm test && pnpm typecheck
```

---

### 任务 6：创建 @magic/desktop Electron 应用

**描述**：创建 Electron 桌面应用，含 main/preload/renderer 三进程架构和 electron-vite 配置。

**安装依赖**：
- `electron`: ^38.0.0
- `electron-vite`: ^5.0.0
- `@electron-toolkit/utils`: latest
- `electron-builder`: ^26.9.0
- `@vitejs/plugin-react`: latest
- `@tailwindcss/vite`: latest
- `tailwindcss`: ^4.2.0
- `react`: ^19.0.0
- `react-dom`: ^19.0.0

**创建文件**：
- `apps/desktop/package.json`
- `apps/desktop/tsconfig.json`
- `apps/desktop/tsconfig.node.json`
- `apps/desktop/electron.vite.config.ts`
- `apps/desktop/electron-builder.yml`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/preload/index.d.ts`
- `apps/desktop/src/renderer/index.html`
- `apps/desktop/src/renderer/src/main.tsx`
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/index.css`（Tailwind 入口）
- `apps/desktop/src/renderer/src/env.d.ts`

**验证**：
```bash
cd apps/desktop && pnpm dev  # 应启动 Electron 窗口显示 MAGIC Client 占位 UI
```

---

### 任务 7：创建 @magic/web Vite SPA 应用

**描述**：创建独立的 Web 端应用，复用相同的 React 组件。

**创建文件**：
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/index.html`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/index.css`
- `apps/web/src/env.d.ts`

**验证**：
```bash
cd apps/web && pnpm dev  # 应启动 Vite dev server，浏览器显示占位 UI
```

---

### 任务 8：创建 CLAUDE.md 和 specs 目录

**描述**：创建 Claude Code 项目配置和 spec 目录结构。

**创建文件**：
- `CLAUDE.md`
- `specs/000-project-constitution.md`
- `specs/001-monorepo-scaffold/spec.md`（本文件）
- `.claude/rules/matrix-events.md`
- `.claude/rules/electron-security.md`

**验证**：目录结构正确，文件内容完整。

---

### 任务 9：全局集成验证

**描述**：从根目录运行所有验证命令，确保整个 monorepo 协同工作。

**验证**：
```bash
# 从根目录执行
pnpm install
pnpm typecheck    # 所有包类型检查通过
pnpm lint         # 所有包 lint 通过
pnpm test         # 所有占位测试通过
pnpm build        # 所有包按依赖序构建成功
pnpm dev:desktop  # Electron 窗口正常启动
pnpm dev:web      # Vite dev server 正常启动
```

完成后执行初始 Git 提交：
```bash
git init
git add -A
git commit -m "feat: 001 - monorepo scaffold with pnpm + turborepo + electron-vite"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| electron-vite 与 pnpm hoisted 模式冲突 | 构建失败 | `.npmrc` 中 `shamefully-hoist=true` |
| Tailwind v4 CSS-first 配置与 electron-vite 集成问题 | 样式不生效 | 使用 `@tailwindcss/vite` 插件而非 PostCSS |
| TypeScript 项目引用循环 | typecheck 失败 | 严格单向依赖：shared-types ← matrix-client/ui ← desktop/web |
| Vitest workspace 找不到测试 | test 命令空跑 | 每个包至少一个 `*.test.ts` 占位测试 |

---

## 7. 后续 Spec 的接入点

完成 001 后，后续 spec 可以直接在此骨架上开发：

- **002-matrix-sdk-wrapper**：在 `packages/matrix-client/src/` 中实现 SDK 封装
- **003-electron-shell**：在 `apps/desktop/src/main/ipc/` 中添加 IPC handler
- **004-auth-flow**：在 `packages/ui/src/` 中添加 LoginPage 组件
- **005-room-list-sidebar**：在 `packages/ui/src/rooms/` 中添加 RoomList 组件

每个后续 spec 只需新增文件，不修改脚手架结构。