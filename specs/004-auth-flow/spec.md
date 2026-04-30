# Spec 004: 认证流程（Auth Flow）

> 优先级: P0 | 波次: Wave 2 | 预估: 2-3 天 | 前置依赖: 002-matrix-sdk-wrapper, 003-electron-shell

---

## 1. 目标

实现完整的用户认证流程——登录页面 UI、密码登录、会话持久化、应用启动时自动恢复会话、登出、以及认证状态驱动的路由切换。完成后，用户打开应用可以登录 Matrix homeserver，关闭重开后自动恢复登录态，无需重新输入密码。

### 用户故事

- 作为用户，我希望首次打开应用时看到一个简洁的登录页面，输入 homeserver 地址、用户名、密码即可登录
- 作为用户，我希望登录后看到"正在同步…"的加载状态，同步完成后自动进入主界面
- 作为用户，我希望关闭应用再打开时自动恢复登录态，无需重新登录
- 作为用户，我希望会话过期或 token 失效时自动跳回登录页面并提示原因
- 作为用户，我希望点击"登出"按钮后清除所有本地数据并返回登录页面
- 作为用户，我希望登录失败时看到清晰的错误提示（密码错误、服务器不可达等）

### 非目标（本 spec 不实现）

- SSO / OIDC 登录 —— 后续 spec 扩展
- 注册新账号 —— 由 homeserver 管理端处理
- 多账号切换 —— 后续 spec

---

## 2. 架构设计

### 2.1 认证状态机

```
            ┌─────────────┐
            │  INITIALIZING │  应用启动，尝试恢复会话
            └──────┬──────┘
                   │
          ┌────────┴────────┐
          │ 有存储的 session? │
          └────────┬────────┘
           Yes ↙      ↘ No
  ┌──────────────┐  ┌──────────────┐
  │  RESTORING   │  │ UNAUTHENTICATED│  显示登录页
  │ 恢复会话中... │  └──────┬───────┘
  └──────┬──────┘         │
         │            用户点击登录
    ┌────┴────┐    ┌──────┴──────┐
    │ 恢复成功? │   │  LOGGING_IN  │  显示加载状态
    └────┬────┘    └──────┬──────┘
   Yes ↙    ↘ No         │
         跳回登录    ┌────┴────┐
                    │ 登录成功? │
  ┌──────────────┐  └────┬────┘
  │   SYNCING    │ Yes ↙    ↘ No → 显示错误，回到登录表单
  │ 首次同步中... │
  └──────┬──────┘
         │ 同步完成
  ┌──────┴──────┐
  │ AUTHENTICATED │  显示主界面
  └──────┬──────┘
         │ 登出 / token 失效
  ┌──────┴───────┐
  │UNAUTHENTICATED│
  └──────────────┘
```

### 2.2 状态管理

新增 `useAuthStore`（Zustand），与 002 的 `useSyncStore` 协同：

- `useAuthStore` —— 认证阶段、用户信息、错误消息
- `useSyncStore` —— 同步状态（SYNCING / PREPARED / ERROR）
- 路由逻辑通过 `authStage` 决定渲染哪个视图

### 2.3 文件结构

```
packages/
├── matrix-client/src/
│   └── stores/
│       └── authStore.ts          # 新增：认证状态 store
│
├── ui/src/
│   ├── auth/
│   │   ├── LoginPage.tsx         # 登录页面
│   │   ├── LoginForm.tsx         # 登录表单组件
│   │   ├── SyncingScreen.tsx     # 同步中加载屏
│   │   └── AuthGuard.tsx         # 认证路由守卫
│   └── hooks/
│       └── useAuth.ts            # 认证操作 hook
│
apps/
├── desktop/src/renderer/src/
│   ├── App.tsx                   # 更新：接入 AuthGuard
│   └── layouts/
│       └── MainLayout.tsx        # 登录后的主布局占位
│
└── web/src/
    └── App.tsx                   # 更新：同样接入 AuthGuard
```

---

## 3. 技术规格

### 3.1 authStore.ts — 认证状态

```typescript
// packages/matrix-client/src/stores/authStore.ts
import { create } from "zustand";

export type AuthStage =
  | "initializing"     // 应用启动，检查本地会话
  | "unauthenticated"  // 无有效会话，显示登录页
  | "logging_in"       // 正在登录
  | "restoring"        // 正在恢复会话
  | "syncing"          // 已登录，首次同步中
  | "authenticated"    // 已登录且同步完成，显示主界面
  | "error";           // 认证/同步出错

interface AuthStoreState {
  stage: AuthStage;
  userId: string | null;
  homeserver: string | null;
  displayName: string | null;
  avatarMxc: string | null;
  error: string | null;

  setStage: (stage: AuthStage) => void;
  setUser: (user: AuthUser) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export interface AuthUser {
  userId: string;
  homeserver: string;
  displayName?: string;
  avatarMxc?: string;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  stage: "initializing",
  userId: null,
  homeserver: null,
  displayName: null,
  avatarMxc: null,
  error: null,

  setStage: (stage) => set({ stage, error: stage === "error" ? undefined : null }),
  setUser: (user) => set({
    userId: user.userId,
    homeserver: user.homeserver,
    displayName: user.displayName ?? null,
    avatarMxc: user.avatarMxc ?? null,
  }),
  setError: (error) => set({ error, stage: error ? "error" : undefined }),
  reset: () => set({
    stage: "unauthenticated",
    userId: null,
    homeserver: null,
    displayName: null,
    avatarMxc: null,
    error: null,
  }),
}));
```

### 3.2 useAuth.ts — 认证操作 Hook

```typescript
// packages/ui/src/hooks/useAuth.ts
import {
  login as sdkLogin,
  logout as sdkLogout,
  restoreSession as sdkRestore,
  startSync,
  bridgeToStores,
  getClient,
  useAuthStore,
  useSyncStore,
  useRoomStore,
  useTypingStore,
  useUserStore,
} from "@magic/matrix-client";
import { useCallback, useEffect, useRef } from "react";

/**
 * 提供认证相关的操作函数和状态。
 * 在 App 顶层使用一次即可。
 */
export function useAuth() {
  const { stage, error } = useAuthStore();
  const cleanupRef = useRef<(() => void) | null>(null);

  /**
   * 应用启动时调用——尝试恢复已有会话。
   */
  const initialize = useCallback(async () => {
    const authStore = useAuthStore.getState();
    authStore.setStage("initializing");

    try {
      const restored = await sdkRestore();
      if (restored) {
        authStore.setStage("restoring");
        await startSyncAndBridge();
      } else {
        authStore.setStage("unauthenticated");
      }
    } catch (err) {
      console.error("会话恢复失败:", err);
      authStore.setStage("unauthenticated");
    }
  }, []);

  /**
   * 用户名密码登录。
   */
  const login = useCallback(async (
    homeserver: string,
    username: string,
    password: string,
  ) => {
    const authStore = useAuthStore.getState();
    authStore.setStage("logging_in");
    authStore.setError(null);

    try {
      const response = await sdkLogin(homeserver, username, password);
      authStore.setUser({
        userId: response.userId,
        homeserver,
      });
      await startSyncAndBridge();
    } catch (err: any) {
      const message = parseLoginError(err);
      authStore.setError(message);
      authStore.setStage("unauthenticated");
    }
  }, []);

  /**
   * 登出并清理所有状态。
   */
  const logout = useCallback(async () => {
    // 解除事件桥接
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    await sdkLogout();

    // 重置所有 store
    useAuthStore.getState().reset();
    useSyncStore.getState().reset();
    useRoomStore.getState().reset();
    useTypingStore.getState().reset();
    useUserStore.getState().reset();
  }, []);

  /**
   * 启动同步 + 桥接事件到 store。
   */
  async function startSyncAndBridge() {
    const authStore = useAuthStore.getState();
    authStore.setStage("syncing");

    try {
      const client = getClient();

      // 桥接 SDK 事件到 Zustand
      cleanupRef.current = bridgeToStores(client);

      // 监听同步完成
      const syncStore = useSyncStore.getState();
      const unsubSync = useSyncStore.subscribe((state) => {
        if (state.syncState === "PREPARED" && state.initialSyncComplete) {
          authStore.setStage("authenticated");
          // 获取当前用户信息
          const user = client.getUser(client.getUserId()!);
          if (user) {
            authStore.setUser({
              userId: client.getUserId()!,
              homeserver: authStore.homeserver ?? "",
              displayName: user.displayName ?? undefined,
              avatarMxc: user.avatarUrl ?? undefined,
            });
          }
        }
        if (state.syncState === "ERROR") {
          authStore.setError(state.lastSyncError ?? "同步失败");
        }
      });

      // 启动同步
      await startSync();
    } catch (err: any) {
      authStore.setError(`同步启动失败: ${err.message}`);
      authStore.setStage("error");
    }
  }

  return {
    stage,
    error,
    initialize,
    login,
    logout,
  };
}

/**
 * 将 SDK 登录错误转为用户友好的中文提示。
 */
function parseLoginError(err: any): string {
  const msg = err?.message ?? String(err);
  const status = err?.httpStatus ?? err?.data?.httpStatus;

  if (status === 403 || msg.includes("M_FORBIDDEN")) {
    return "用户名或密码错误";
  }
  if (status === 429 || msg.includes("M_LIMIT_EXCEEDED")) {
    return "登录请求过于频繁，请稍后重试";
  }
  if (msg.includes("M_USER_DEACTIVATED")) {
    return "账号已被停用，请联系管理员";
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
    return "无法连接到服务器，请检查网络和 Homeserver 地址";
  }
  if (msg.includes("M_UNKNOWN_TOKEN") || msg.includes("M_MISSING_TOKEN")) {
    return "会话已过期，请重新登录";
  }
  return `登录失败: ${msg}`;
}
```

### 3.3 LoginPage.tsx — 登录页面

```tsx
// packages/ui/src/auth/LoginPage.tsx
import { useState } from "react";
import { LoginForm } from "./LoginForm";

interface LoginPageProps {
  onLogin: (homeserver: string, username: string, password: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

export function LoginPage({ onLogin, error, isLoading }: LoginPageProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-magic-surface">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            MAGIC
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Multi-Agent Governance & Intelligent Collaboration
          </p>
        </div>

        {/* 登录表单 */}
        <LoginForm
          onSubmit={onLogin}
          isLoading={isLoading}
          error={error}
        />

        {/* 底部信息 */}
        <p className="mt-6 text-center text-xs text-gray-500">
          由 Magic 平台提供 · 基于 Matrix 协议
        </p>
      </div>
    </div>
  );
}
```

### 3.4 LoginForm.tsx — 登录表单

```tsx
// packages/ui/src/auth/LoginForm.tsx
import { useState, type FormEvent } from "react";

interface LoginFormProps {
  onSubmit: (homeserver: string, username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [homeserver, setHomeserver] = useState("https://matrix.magic.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await onSubmit(homeserver.trim(), username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Homeserver（默认折叠） */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          {showAdvanced ? "▾ 隐藏高级设置" : "▸ Homeserver 设置"}
        </button>
        {showAdvanced && (
          <input
            type="url"
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
            placeholder="https://matrix.magic.com"
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-700 bg-magic-surface-alt
                       px-3 py-2 text-sm text-white placeholder-gray-500
                       focus:border-magic-primary focus:outline-none focus:ring-1
                       focus:ring-magic-primary disabled:opacity-50"
          />
        )}
      </div>

      {/* 用户名 */}
      <div>
        <label htmlFor="username" className="mb-1 block text-sm text-gray-300">
          用户名
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@user:magic.com 或 user"
          disabled={isLoading}
          autoFocus
          autoComplete="username"
          className="w-full rounded-lg border border-gray-700 bg-magic-surface-alt
                     px-3 py-2.5 text-sm text-white placeholder-gray-500
                     focus:border-magic-primary focus:outline-none focus:ring-1
                     focus:ring-magic-primary disabled:opacity-50"
        />
      </div>

      {/* 密码 */}
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-gray-300">
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入密码"
          disabled={isLoading}
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-700 bg-magic-surface-alt
                     px-3 py-2.5 text-sm text-white placeholder-gray-500
                     focus:border-magic-primary focus:outline-none focus:ring-1
                     focus:ring-magic-primary disabled:opacity-50"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 登录按钮 */}
      <button
        type="submit"
        disabled={isLoading || !username.trim() || !password.trim()}
        className="w-full rounded-lg bg-magic-primary px-4 py-2.5 text-sm font-medium
                   text-white transition-colors hover:bg-blue-600
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner />
            登录中…
          </span>
        ) : (
          "登录"
        )}
      </button>
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
```

### 3.5 SyncingScreen.tsx — 同步中加载屏

```tsx
// packages/ui/src/auth/SyncingScreen.tsx
import { useSyncStore } from "@magic/matrix-client";

export function SyncingScreen() {
  const syncState = useSyncStore((s) => s.syncState);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-magic-surface text-white">
      {/* 动画 Logo */}
      <div className="mb-6">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-magic-primary/20 flex items-center justify-center">
          <span className="text-2xl font-bold text-magic-primary">M</span>
        </div>
      </div>

      <h2 className="text-lg font-medium">正在同步</h2>
      <p className="mt-2 text-sm text-gray-400">
        {syncState === "SYNCING" && "正在从服务器获取数据…"}
        {syncState === "RECONNECTING" && "正在重新连接…"}
        {syncState === "ERROR" && "同步遇到问题，正在重试…"}
        {(syncState === "STOPPED" || !syncState) && "准备中…"}
      </p>

      {/* 进度条 */}
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-gray-800">
        <div className="h-full animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-magic-primary" />
      </div>
    </div>
  );
}
```

### 3.6 AuthGuard.tsx — 认证路由守卫

```tsx
// packages/ui/src/auth/AuthGuard.tsx
import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth";
import { LoginPage } from "./LoginPage";
import { SyncingScreen } from "./SyncingScreen";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * 根据认证状态决定渲染登录页、同步屏还是主应用。
 * 在 App.tsx 顶层包裹使用。
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { stage, error, initialize, login, logout } = useAuth();

  // 应用启动时自动尝试恢复会话
  useEffect(() => {
    initialize();
  }, [initialize]);

  switch (stage) {
    case "initializing":
    case "restoring":
      // 应用启动 / 会话恢复中 → 简单加载屏
      return (
        <div className="flex h-screen items-center justify-center bg-magic-surface">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
        </div>
      );

    case "unauthenticated":
      // 未登录 → 显示登录页
      return (
        <LoginPage
          onLogin={login}
          error={error}
          isLoading={false}
        />
      );

    case "logging_in":
      // 正在登录 → 登录页（加载状态）
      return (
        <LoginPage
          onLogin={login}
          error={error}
          isLoading={true}
        />
      );

    case "syncing":
      // 已登录，首次同步中
      return <SyncingScreen />;

    case "authenticated":
      // 已登录且同步完成 → 渲染主应用
      return <>{children}</>;

    case "error":
      // 出错 → 登录页 + 错误信息
      return (
        <LoginPage
          onLogin={login}
          error={error}
          isLoading={false}
        />
      );

    default:
      return null;
  }
}
```

### 3.7 MainLayout.tsx — 登录后的主布局占位

```tsx
// packages/ui/src/layouts/MainLayout.tsx
import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth";

/**
 * 登录后的主界面布局。
 * 本 spec 仅提供占位，005-007 会填充具体内容。
 */
export function MainLayout() {
  const { userId, homeserver } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-magic-surface text-white">
      {/* 侧边栏占位 */}
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-magic-surface-alt">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium">MAGIC</span>
        </div>

        <div className="flex-1 p-4">
          <p className="text-xs text-gray-500">
            房间列表（005-room-list-sidebar）
          </p>
        </div>

        {/* 用户面板 */}
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userId}</p>
              <p className="truncate text-xs text-gray-500">{homeserver}</p>
            </div>
            <button
              onClick={logout}
              className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-gray-400
                         hover:bg-gray-700 hover:text-white transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区占位 */}
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium">欢迎回来</h2>
          <p className="mt-2 text-sm text-gray-400">
            选择一个房间开始聊天（006-chat-timeline）
          </p>
        </div>
      </main>
    </div>
  );
}
```

### 3.8 更新 App.tsx（桌面端和 Web 端）

```tsx
// apps/desktop/src/renderer/src/App.tsx
// apps/web/src/App.tsx
// （两端内容相同）

import { AuthGuard } from "@magic/ui";
import { MainLayout } from "@magic/ui";

export default function App() {
  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
```

### 3.9 更新 @magic/matrix-client 导出

在 `packages/matrix-client/src/index.ts` 追加：

```typescript
// stores（追加 authStore）
export { useAuthStore } from "./stores/authStore";
export type { AuthStage, AuthUser } from "./stores/authStore";
```

在 `packages/matrix-client/src/stores/index.ts` 追加：

```typescript
export { useAuthStore } from "./authStore";
```

### 3.10 更新 @magic/ui 导出

在 `packages/ui/src/index.ts` 追加：

```typescript
// Auth
export { LoginPage } from "./auth/LoginPage";
export { LoginForm } from "./auth/LoginForm";
export { SyncingScreen } from "./auth/SyncingScreen";
export { AuthGuard } from "./auth/AuthGuard";

// Layouts
export { MainLayout } from "./layouts/MainLayout";

// Hooks
export { useAuth } from "./hooks/useAuth";
export { useElectronAPI, isElectron } from "./hooks/useElectronAPI";
```

### 3.11 Tailwind 动画扩展

在 `apps/desktop/src/renderer/src/index.css` 和 `apps/web/src/index.css` 追加：

```css
@keyframes indeterminate {
  0% { transform: translateX(-100%); width: 40%; }
  50% { transform: translateX(60%); width: 60%; }
  100% { transform: translateX(200%); width: 40%; }
}
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 首次启动显示登录页面（无已存会话） | 清除 localStorage 后启动 |
| AC-2 | 输入正确的 homeserver/用户名/密码后登录成功，进入同步屏 | 连接真实或 mock homeserver |
| AC-3 | 同步完成后自动跳转到主界面，显示 userId 和 homeserver | 视觉检查 |
| AC-4 | 关闭应用重新打开，自动恢复会话（不显示登录页） | 手动验证 |
| AC-5 | 输入错误密码时显示"用户名或密码错误" | 手动验证 |
| AC-6 | 输入不可达的 homeserver 时显示"无法连接到服务器" | 手动验证 |
| AC-7 | 点击"登出"按钮后回到登录页，所有 store 被重置 | DevTools 检查 Zustand state |
| AC-8 | 登录按钮在加载中禁用，显示 spinner | 视觉检查 |
| AC-9 | Homeserver 输入框默认折叠，点击可展开 | 视觉检查 |
| AC-10 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-11 | `pnpm test` 所有测试通过 | `pnpm test` |
| AC-12 | 桌面端和 Web 端行为一致 | 分别启动验证 |

---

## 5. 实现任务（按执行顺序）

### 任务 1：创建 authStore.ts

**描述**：在 @magic/matrix-client 中新增认证状态 store。

**创建文件**：
- `packages/matrix-client/src/stores/authStore.ts`

**修改文件**：
- `packages/matrix-client/src/stores/index.ts`（追加导出）
- `packages/matrix-client/src/index.ts`（追加导出）

**验证**：`pnpm typecheck`

---

### 任务 2：创建 LoginForm.tsx 组件

**描述**：实现登录表单，含用户名/密码/homeserver 输入、错误提示、加载状态。

**创建文件**：
- `packages/ui/src/auth/LoginForm.tsx`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 LoginPage.tsx 和 SyncingScreen.tsx

**描述**：实现登录页面容器和同步中加载屏。

**创建文件**：
- `packages/ui/src/auth/LoginPage.tsx`
- `packages/ui/src/auth/SyncingScreen.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 useAuth.ts Hook

**描述**：实现认证操作 Hook，封装 login/logout/restoreSession/startSync 完整流程。

**创建文件**：
- `packages/ui/src/hooks/useAuth.ts`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 AuthGuard.tsx 路由守卫

**描述**：实现认证状态驱动的视图切换组件。

**创建文件**：
- `packages/ui/src/auth/AuthGuard.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 MainLayout.tsx 占位布局

**描述**：实现登录后的主界面布局骨架，含侧边栏、用户面板、登出按钮。

**创建文件**：
- `packages/ui/src/layouts/MainLayout.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：更新 @magic/ui 导出

**描述**：更新 index.ts 导出所有新组件和 Hook。

**修改文件**：
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck`

---

### 任务 8：更新 App.tsx（桌面端 + Web 端）

**描述**：将 AuthGuard + MainLayout 接入两端的 App.tsx。

**修改文件**：
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/web/src/App.tsx`

**追加 CSS**：
- `apps/desktop/src/renderer/src/index.css`（indeterminate 动画）
- `apps/web/src/index.css`（同上）

**验证**：`pnpm dev:desktop` + `pnpm dev:web`（均显示登录页）

---

### 任务 9：编写单元测试

**描述**：为认证流程编写测试。

**创建文件**：
- `packages/matrix-client/__tests__/authStore.test.ts` — store 状态转换
- `packages/ui/__tests__/auth/LoginForm.test.tsx` — 表单提交、禁用状态、错误显示
- `packages/ui/__tests__/auth/AuthGuard.test.tsx` — 各 stage 下的渲染分支

**验证**：`pnpm test`

---

### 任务 10：全局集成验证

**描述**：从根目录确认整个 monorepo 正常。

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 显示登录页 → 可登录（需 homeserver）
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 004 - auth flow with login page, session restore, and auth guard"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 无可用的 Matrix homeserver 进行测试 | 无法验证真实登录流程 | 使用 Tuwunel 本地 Docker 部署或 matrix.org 公共服务器测试账号 |
| `initRustCrypto()` 在开发环境首次加载较慢 | 登录后等待时间长 | SyncingScreen 给用户反馈；WASM 文件在后续构建中可预缓存 |
| localStorage 在某些浏览器隐私模式下不可用 | 会话恢复失败 | auth.ts 中 try-catch 包裹，降级为每次启动重新登录 |
| SDK 登录错误消息不一致 | 用户看到原始英文错误 | `parseLoginError()` 统一转换为中文 |

---

## 7. 后续 Spec 的接入点

- **005-room-list-sidebar**：替换 MainLayout 侧边栏中的占位文字为真实的 RoomList 组件
- **006-chat-timeline**：替换 MainLayout 主内容区的占位为 ChatTimeline 组件
- **008-e2ee-setup**：在 useAuth 的 `startSyncAndBridge()` 中增加交叉签名验证提示
- **后续 SSO spec**：在 LoginForm 中增加"SSO 登录"按钮，调用 `client.loginWithToken()` 或 OIDC 流程