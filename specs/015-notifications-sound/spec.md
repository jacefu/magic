# Spec 015: 通知与声音（Notifications & Sound）

> 优先级: P0 | 波次: Wave 4 | 预估: 2-3 天 | 前置依赖: 003-electron-shell, 005-room-list-sidebar, 012-mentions
> 文件路径: `specs/015-notifications-sound/spec.md`

---

## 1. 目标

实现完整的消息通知链路——新消息触发桌面原生通知、被 @mention 时高优先级通知、通知点击跳转到对应房间、托盘未读角标实时更新、通知声音、勿扰模式、房间级静音。完成后，用户不盯着屏幕也能第一时间知道有新消息或被 @提及。

### 用户故事

- 作为用户，我希望收到新消息时桌面弹出原生通知（显示发送者名和消息预览）
- 作为用户，我希望被 @mention 时通知更醒目（不同声音、不同样式）
- 作为用户，我希望点击通知后窗口恢复并跳转到对应房间和消息位置
- 作为用户，我希望托盘图标上显示未读消息总数（macOS Dock 角标 / Windows 任务栏）
- 作为用户，我希望新消息有提示音，被 @mention 有不同的提示音
- 作为用户，我希望可以选择通知级别：全部通知 / 仅 @提及 / 静音
- 作为用户，我希望开启勿扰模式后不弹任何通知和声音
- 作为用户，我希望对单个房间设置静音，不影响其他房间
- 作为用户，我希望当前正在查看的房间不弹通知（避免重复打扰）
- 作为用户，我希望自己发的消息不触发通知

### 非目标（本 spec 不实现）

- 推送通知（移动端 / Web Push API）—— 后续 spec
- 通知历史列表（通知中心）—— 后续 spec
- 自定义通知铃声上传 —— 后续 spec

---

## 2. 架构设计

### 2.1 通知触发链路

```
matrix-js-sdk 收到新事件
       ↓ bridge.ts
useRoomStore.addMessage()
       ↓ 同时
NotificationService.evaluate(event)
       ↓ 判断是否应该通知
       ├── 当前活跃房间？ → 不通知
       ├── 自己发的？ → 不通知
       ├── 房间被静音？ → 不通知
       ├── 勿扰模式？ → 不通知
       ├── 通知级别 = 静音？ → 不通知
       ├── 通知级别 = 仅@提及 且 没被@？ → 不通知
       └── 通过所有检查 → 触发通知
              ↓
       ┌──────┴──────┐
       │  Electron   │  Web
       │ notify:show │  new Notification()
       │  IPC 调用    │  Web Notification API
       └──────┬──────┘
              ↓
       播放声音（普通 / @提及）
       更新托盘角标
```

### 2.2 文件结构

```
packages/
├── matrix-client/src/
│   └── stores/
│       └── notificationStore.ts     # 新增：通知偏好 + 勿扰 + 房间静音
│
├── ui/src/
│   ├── notifications/
│   │   ├── NotificationService.ts   # 核心：通知判断 + 触发逻辑
│   │   ├── NotificationSound.ts     # 声音播放
│   │   └── NotificationSettings.tsx # 通知偏好设置 UI
│   └── hooks/
│       └── useNotifications.ts      # 初始化通知服务的 Hook
│
├── assets/
│   └── sounds/
│       ├── message.mp3              # 普通消息提示音
│       └── mention.mp3              # @提及提示音
│
apps/desktop/src/main/
│   └── ipc/notify.ts                # 已有（003），本 spec 增强
```

---

## 3. 技术规格

### 3.1 notificationStore.ts — 通知偏好状态

```typescript
// packages/matrix-client/src/stores/notificationStore.ts
import { create } from "zustand";

export type NotificationLevel = "all" | "mentions" | "mute";

interface NotificationStoreState {
  /** 全局通知级别 */
  level: NotificationLevel;
  /** 勿扰模式 */
  dnd: boolean;
  /** 是否启用声音 */
  soundEnabled: boolean;
  /** 房间级静音列表 */
  mutedRooms: Set<string>;
  /** 全局未读总数（用于托盘角标） */
  totalUnreadCount: number;
  /** 全局 @提及总数 */
  totalMentionCount: number;

  setLevel: (level: NotificationLevel) => void;
  setDnd: (dnd: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  muteRoom: (roomId: string) => void;
  unmuteRoom: (roomId: string) => void;
  isRoomMuted: (roomId: string) => boolean;
  setUnreadCounts: (unread: number, mentions: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  level: "all",
  dnd: false,
  soundEnabled: true,
  mutedRooms: new Set(),
  totalUnreadCount: 0,
  totalMentionCount: 0,

  setLevel: (level) => set({ level }),
  setDnd: (dnd) => set({ dnd }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

  muteRoom: (roomId) => set((s) => {
    const next = new Set(s.mutedRooms);
    next.add(roomId);
    return { mutedRooms: next };
  }),

  unmuteRoom: (roomId) => set((s) => {
    const next = new Set(s.mutedRooms);
    next.delete(roomId);
    return { mutedRooms: next };
  }),

  isRoomMuted: (roomId) => get().mutedRooms.has(roomId),

  setUnreadCounts: (unread, mentions) => set({
    totalUnreadCount: unread,
    totalMentionCount: mentions,
  }),

  reset: () => set({
    level: "all",
    dnd: false,
    soundEnabled: true,
    mutedRooms: new Set(),
    totalUnreadCount: 0,
    totalMentionCount: 0,
  }),
}));
```

### 3.2 NotificationSound.ts — 声音播放

```typescript
// packages/ui/src/notifications/NotificationSound.ts

let messageAudio: HTMLAudioElement | null = null;
let mentionAudio: HTMLAudioElement | null = null;

/**
 * 预加载声音文件。在应用启动时调用一次。
 */
export function preloadSounds(): void {
  try {
    messageAudio = new Audio("/sounds/message.mp3");
    messageAudio.volume = 0.5;
    messageAudio.preload = "auto";

    mentionAudio = new Audio("/sounds/mention.mp3");
    mentionAudio.volume = 0.7;
    mentionAudio.preload = "auto";
  } catch {
    // Web Audio API 不可用时静默失败
  }
}

/**
 * 播放普通消息提示音。
 */
export function playMessageSound(): void {
  try {
    if (messageAudio) {
      messageAudio.currentTime = 0;
      messageAudio.play().catch(() => {});
    }
  } catch {}
}

/**
 * 播放 @提及提示音（更醒目）。
 */
export function playMentionSound(): void {
  try {
    if (mentionAudio) {
      mentionAudio.currentTime = 0;
      mentionAudio.play().catch(() => {});
    }
  } catch {}
}
```

### 3.3 NotificationService.ts — 核心通知判断 + 触发

```typescript
// packages/ui/src/notifications/NotificationService.ts
import {
  useRoomStore,
  useAuthStore,
  useNotificationStore,
} from "@magic/matrix-client";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import { isElectron, useElectronAPI } from "../hooks/useElectronAPI";
import { playMessageSound, playMentionSound } from "./NotificationSound";

/**
 * 评估一条新消息是否应该触发通知。
 * 在 bridge.ts 的 onTimeline 回调中调用。
 */
export function evaluateNotification(event: SerializedMatrixEvent): void {
  const authStore = useAuthStore.getState();
  const roomStore = useRoomStore.getState();
  const notifStore = useNotificationStore.getState();

  // ---- 前置检查：不应该通知的情况 ----

  // 1. 不是消息事件
  if (event.type !== "m.room.message") return;

  // 2. 自己发的
  if (event.sender === authStore.userId) return;

  // 3. 勿扰模式
  if (notifStore.dnd) return;

  // 4. 全局静音
  if (notifStore.level === "mute") return;

  // 5. 房间被静音
  if (notifStore.isRoomMuted(event.roomId)) return;

  // 6. 当前正在查看的房间（活跃房间 + 窗口聚焦）
  if (roomStore.activeRoomId === event.roomId && isWindowFocused()) return;

  // ---- 判断通知类型 ----
  const isMentioned = checkIfMentioned(event, authStore.userId);

  // 7. 仅@提及模式下，没被@就不通知
  if (notifStore.level === "mentions" && !isMentioned) return;

  // ---- 通过所有检查，触发通知 ----

  const senderName = extractDisplayName(event.sender);
  const roomName = roomStore.rooms[event.roomId]?.name ?? "未知房间";
  const messagePreview = getMessagePreview(event);

  // 桌面通知
  showDesktopNotification({
    title: isMentioned ? `${senderName} 在 ${roomName} 中提及了你` : senderName,
    body: messagePreview,
    roomId: event.roomId,
    eventId: event.eventId,
  });

  // 声音
  if (notifStore.soundEnabled) {
    if (isMentioned) {
      playMentionSound();
    } else {
      playMessageSound();
    }
  }

  // 更新托盘角标
  updateTrayBadge();
}

/**
 * 检查消息是否 @mention 了当前用户。
 */
function checkIfMentioned(event: SerializedMatrixEvent, userId: string | null): boolean {
  if (!userId) return false;

  // 检查 m.mentions 字段
  const mentions = event.content["m.mentions"] as
    | { user_ids?: string[]; room?: boolean }
    | undefined;

  if (mentions) {
    // 被直接 @
    if (mentions.user_ids?.includes(userId)) return true;
    // @全体
    if (mentions.room === true) return true;
  }

  // 兼容旧格式：检查 body 中是否包含用户名
  const body = (event.content.body as string) ?? "";
  const localpart = userId.match(/^@([^:]+)/)?.[1];
  if (localpart && body.includes(`@${localpart}`)) return true;

  return false;
}

/**
 * 发送桌面通知（Electron 原生 / Web Notification API）。
 */
function showDesktopNotification(payload: {
  title: string;
  body: string;
  roomId: string;
  eventId: string;
}): void {
  if (isElectron()) {
    // Electron：通过 IPC 调用原生 Notification
    const electronAPI = (window as any).electronAPI;
    electronAPI?.showNotification?.({
      title: payload.title,
      body: payload.body,
      roomId: payload.roomId,
      eventId: payload.eventId,
    });
  } else {
    // Web：使用 Notification API
    if ("Notification" in window && Notification.permission === "granted") {
      const notif = new Notification(payload.title, {
        body: payload.body,
        icon: "/favicon.ico",
        tag: payload.roomId, // 同一房间的通知互相替换
        silent: true, // 声音由我们自己控制
      });
      notif.onclick = () => {
        window.focus();
        navigateToRoom(payload.roomId, payload.eventId);
      };
    }
  }
}

/**
 * 更新托盘角标（Electron 专有）。
 */
function updateTrayBadge(): void {
  const roomStore = useRoomStore.getState();
  const notifStore = useNotificationStore.getState();

  let totalUnread = 0;
  let totalMentions = 0;

  for (const room of Object.values(roomStore.rooms)) {
    if (notifStore.isRoomMuted(room.roomId)) continue;
    totalUnread += room.unreadCount;
    totalMentions += room.highlightCount;
  }

  notifStore.setUnreadCounts(totalUnread, totalMentions);

  if (isElectron()) {
    const electronAPI = (window as any).electronAPI;
    // 使用 003 的 updateTrayBadge IPC（通过 app.dock.setBadge / tray.setTitle）
    // 传递总未读数
    electronAPI?.setBadgeCount?.(totalUnread);
  }
}

/**
 * 跳转到指定房间和消息。
 */
function navigateToRoom(roomId: string, _eventId?: string): void {
  const roomStore = useRoomStore.getState();
  roomStore.setActiveRoom(roomId);
  // TODO: 滚动到 eventId 位置（需要 ChatTimeline 支持 scrollToEvent）
}

function isWindowFocused(): boolean {
  return typeof document !== "undefined" && document.hasFocus();
}

function extractDisplayName(userId: string): string {
  return userId.match(/^@([^:]+)/)?.[1] ?? userId;
}

function getMessagePreview(event: SerializedMatrixEvent): string {
  const content = event.content;
  const msgtype = content.msgtype as string | undefined;
  const body = content.body as string | undefined;

  switch (msgtype) {
    case "m.text": return body?.slice(0, 100) ?? "";
    case "m.image": return "📷 发送了一张图片";
    case "m.file": return "📎 发送了一个文件";
    case "m.video": return "🎬 发送了一个视频";
    case "m.audio": return "🎵 发送了一段音频";
    default: return body?.slice(0, 100) ?? "";
  }
}
```

### 3.4 useNotifications.ts — 初始化 Hook

```typescript
// packages/ui/src/hooks/useNotifications.ts
import { useEffect } from "react";
import { preloadSounds } from "../notifications/NotificationSound";

/**
 * 在 App 顶层调用一次，初始化通知系统。
 */
export function useNotifications() {
  useEffect(() => {
    // 预加载声音
    preloadSounds();

    // Web 端：请求通知权限
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);
}
```

### 3.5 更新 bridge.ts — 接入通知评估

在 002 的 `bridge.ts` 中，`onTimeline` 回调里追加通知评估：

```typescript
// packages/matrix-client/src/bridge.ts（追加到 onTimeline 回调）

import { evaluateNotification } from "@magic/ui/notifications/NotificationService";

const onTimeline = (event: any, room: Room | undefined, toStartOfTimeline: boolean | undefined) => {
  if (!room || toStartOfTimeline) return;
  const serialized = serializeEvent(event);
  useRoomStore.getState().addMessage(room.roomId, serialized);

  // ⭐ 新增：评估是否需要通知
  evaluateNotification(serialized);
};
```

> **注意**：`@magic/ui` 依赖 `@magic/matrix-client`，反过来 import 会造成循环依赖。解决方案：将 `evaluateNotification` 改为回调注册模式（见任务 3）。

### 3.6 解决循环依赖——回调注册模式

```typescript
// packages/matrix-client/src/bridge.ts 中不直接 import evaluateNotification，
// 而是提供一个注册接口：

let notificationCallback: ((event: SerializedMatrixEvent) => void) | null = null;

/**
 * 注册通知回调。由 UI 层在初始化时调用。
 */
export function registerNotificationCallback(
  cb: (event: SerializedMatrixEvent) => void,
): void {
  notificationCallback = cb;
}

// 在 onTimeline 中：
const onTimeline = (event: any, room: Room | undefined, toStartOfTimeline: boolean | undefined) => {
  if (!room || toStartOfTimeline) return;
  const serialized = serializeEvent(event);
  useRoomStore.getState().addMessage(room.roomId, serialized);

  // 通过回调通知 UI 层
  notificationCallback?.(serialized);
};
```

```typescript
// packages/ui/src/hooks/useNotifications.ts（更新）
import { useEffect } from "react";
import { registerNotificationCallback } from "@magic/matrix-client";
import { evaluateNotification } from "../notifications/NotificationService";
import { preloadSounds } from "../notifications/NotificationSound";

export function useNotifications() {
  useEffect(() => {
    preloadSounds();

    // 注册通知回调
    registerNotificationCallback(evaluateNotification);

    // Web 端：请求通知权限
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      registerNotificationCallback(() => {}); // cleanup
    };
  }, []);
}
```

### 3.7 更新 IElectronAPI 接口 — 追加通知和角标方法

```typescript
// packages/shared-types/src/ipc-channels.ts（追加）
export interface IElectronAPI {
  // ... 已有方法 ...

  // 通知（015 增强）
  showNotification: (payload: {
    title: string;
    body: string;
    roomId?: string;
    eventId?: string;
  }) => Promise<void>;
  onNotifyClicked: (cb: (data: { roomId?: string; eventId?: string }) => void) => () => void;

  // 角标（015 新增）
  setBadgeCount: (count: number) => Promise<void>;
}
```

### 3.8 更新 Electron IPC — 角标 handler

```typescript
// apps/desktop/src/main/ipc/notify.ts（追加 setBadgeCount）
import { app } from "electron";

// 在 createNotifyHandlers 中追加：
"notify:set-badge": (count: number) => {
  if (process.platform === "darwin") {
    app.dock?.setBadge(count > 0 ? String(count) : "");
  }
  // Windows: 通过 tray.setTitle 显示
  if (tray) {
    tray.setTitle(count > 0 ? ` ${count}` : "");
  }
},
```

```typescript
// apps/desktop/src/preload/index.ts（追加）
setBadgeCount: (count: number) => ipcRenderer.invoke("notify:set-badge", count),
```

### 3.9 更新 Electron IPC — 通知点击跳转

```typescript
// apps/desktop/src/preload/index.ts（追加）
onNotifyClicked: (cb) => {
  const handler = (_event: any, data: any) => cb(data);
  ipcRenderer.on("notify:clicked", handler);
  return () => ipcRenderer.off("notify:clicked", handler);
},
```

### 3.10 NotificationSettings.tsx — 通知偏好 UI

```tsx
// packages/ui/src/notifications/NotificationSettings.tsx
import { useNotificationStore, type NotificationLevel } from "@magic/matrix-client";

export function NotificationSettings() {
  const { level, dnd, soundEnabled, setLevel, setDnd, setSoundEnabled } = useNotificationStore();

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-semibold text-[#DBDEE1]">通知设置</h3>

      {/* 勿扰模式 */}
      <label className="flex items-center justify-between">
        <span className="text-sm text-[#949BA4]">勿扰模式</span>
        <ToggleSwitch checked={dnd} onChange={setDnd} />
      </label>

      {/* 通知级别 */}
      <div>
        <p className="mb-2 text-xs text-[#949BA4]">通知级别</p>
        <div className="space-y-1">
          {([
            { value: "all" as const, label: "全部消息", desc: "所有新消息都通知" },
            { value: "mentions" as const, label: "仅 @提及", desc: "只在被 @mention 时通知" },
            { value: "mute" as const, label: "静音", desc: "不接收任何通知" },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2
                         transition-colors ${level === opt.value ? "bg-[#404249]" : "hover:bg-[#35373C]"}`}
            >
              <input
                type="radio"
                name="notif-level"
                value={opt.value}
                checked={level === opt.value}
                onChange={() => setLevel(opt.value)}
                className="accent-[#5865F2]"
              />
              <div>
                <p className="text-sm text-[#DBDEE1]">{opt.label}</p>
                <p className="text-xs text-[#6D6F78]">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 声音 */}
      <label className="flex items-center justify-between">
        <span className="text-sm text-[#949BA4]">通知声音</span>
        <ToggleSwitch checked={soundEnabled} onChange={setSoundEnabled} />
      </label>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors
                  ${checked ? "bg-[#5865F2]" : "bg-[#6D6F78]"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform
                    ${checked ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}
```

### 3.11 接入通知点击跳转（Electron）

```typescript
// packages/ui/src/hooks/useNotifications.ts（追加 Electron 通知点击监听）

import { useRoomStore } from "@magic/matrix-client";

export function useNotifications() {
  useEffect(() => {
    preloadSounds();
    registerNotificationCallback(evaluateNotification);

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Electron：监听通知点击
    let cleanup: (() => void) | null = null;
    if (isElectron()) {
      const electronAPI = (window as any).electronAPI;
      cleanup = electronAPI?.onNotifyClicked?.((data: { roomId?: string; eventId?: string }) => {
        if (data.roomId) {
          useRoomStore.getState().setActiveRoom(data.roomId);
        }
      });
    }

    return () => {
      registerNotificationCallback(() => {});
      cleanup?.();
    };
  }, []);
}
```

### 3.12 在 App.tsx 中接入

```tsx
// apps/desktop/src/renderer/src/App.tsx 或 apps/web/src/App.tsx

import { useNotifications } from "@magic/ui";

export default function App() {
  useNotifications(); // ⭐ 初始化通知系统

  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
```

---

## 4. 声音资源

### 4.1 音频文件

需要两个简短的通知音效（各 < 50KB）：

| 文件 | 用途 | 风格 |
|------|------|------|
| `sounds/message.mp3` | 普通新消息 | 轻柔短促（如 Discord 的 "pop"） |
| `sounds/mention.mp3` | @提及 | 稍响亮、两声短促（如 Discord 的 "ding ding"） |

放置位置：
- Desktop：`apps/desktop/src/renderer/public/sounds/`
- Web：`apps/web/public/sounds/`

### 4.2 临时方案

如果暂时没有音频文件，可以用 Web Audio API 生成简单的正弦波音效：

```typescript
function playBeep(frequency: number, duration: number, volume: number): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

// 普通消息：800Hz, 0.1s
export function playMessageSound() { playBeep(800, 0.1, 0.3); }

// @提及：1000Hz, 0.15s × 2
export function playMentionSound() {
  playBeep(1000, 0.15, 0.5);
  setTimeout(() => playBeep(1200, 0.15, 0.5), 200);
}
```

---

## 5. 更新 @magic/matrix-client 和 @magic/ui 导出

**matrix-client/src/index.ts** 追加：
```typescript
export { useNotificationStore } from "./stores/notificationStore";
export type { NotificationLevel } from "./stores/notificationStore";
export { registerNotificationCallback } from "./bridge";
```

**ui/src/index.ts** 追加：
```typescript
// Notifications
export { evaluateNotification } from "./notifications/NotificationService";
export { preloadSounds, playMessageSound, playMentionSound } from "./notifications/NotificationSound";
export { NotificationSettings } from "./notifications/NotificationSettings";
export { useNotifications } from "./hooks/useNotifications";
```

---

## 6. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 收到新消息时桌面弹出原生通知（发送者名 + 消息预览） | 从另一客户端发消息 |
| AC-2 | 被 @mention 时通知标题为 "xxx 在 #room 中提及了你" | 从另一客户端发 @提及 |
| AC-3 | 通知点击后窗口恢复并切换到对应房间 | Electron：点击通知验证 |
| AC-4 | 当前正在查看的房间收到消息不弹通知 | 在活跃房间中接收消息 |
| AC-5 | 自己发的消息不触发通知 | 自己发消息验证 |
| AC-6 | 托盘图标显示未读总数（macOS Dock / 托盘 title） | 接收多条消息后检查 |
| AC-7 | 新消息播放提示音 | 在后台房间接收消息 |
| AC-8 | @提及播放不同的提示音 | 从另一客户端 @自己 |
| AC-9 | 勿扰模式下不弹通知、不播放声音 | 开启 DND 后测试 |
| AC-10 | 房间静音后该房间不再通知 | 静音一个房间后接收消息 |
| AC-11 | 通知级别切换到"仅@提及"后，普通消息不通知 | 切换后测试 |
| AC-12 | Web 端使用 Notification API 弹通知 | 在 Web 端测试 |
| AC-13 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 7. 实现任务（按执行顺序）

### 任务 1：创建 notificationStore

**创建文件**：`packages/matrix-client/src/stores/notificationStore.ts`

**修改文件**：
- `packages/matrix-client/src/stores/index.ts`
- `packages/matrix-client/src/index.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 NotificationSound（声音播放）

**创建文件**：
- `packages/ui/src/notifications/NotificationSound.ts`
- `apps/desktop/src/renderer/public/sounds/` 目录（可先用 Web Audio API 临时方案）
- `apps/web/public/sounds/` 目录

**验证**：`pnpm typecheck`

---

### 任务 3：更新 bridge.ts — 注册通知回调接口

**修改文件**：`packages/matrix-client/src/bridge.ts`

**变更**：
- 新增 `registerNotificationCallback()` 导出函数
- 在 `onTimeline` 回调中调用 `notificationCallback?.(serialized)`
- 更新 `packages/matrix-client/src/index.ts` 导出

**验证**：`pnpm typecheck`

---

### 任务 4：创建 NotificationService（核心判断逻辑）

**创建文件**：`packages/ui/src/notifications/NotificationService.ts`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 useNotifications Hook

**创建文件**：`packages/ui/src/hooks/useNotifications.ts`

**验证**：`pnpm typecheck`

---

### 任务 6：更新 Electron IPC — 通知增强 + 角标

**修改文件**：
- `apps/desktop/src/main/ipc/notify.ts`（追加 `notify:set-badge`）
- `apps/desktop/src/preload/index.ts`（追加 `setBadgeCount` + `onNotifyClicked`）
- `packages/shared-types/src/ipc-channels.ts`（追加接口定义）

**验证**：`pnpm typecheck`

---

### 任务 7：创建 NotificationSettings UI

**创建文件**：`packages/ui/src/notifications/NotificationSettings.tsx`

**验证**：`pnpm typecheck`

---

### 任务 8：接入 App.tsx

**修改文件**：
- `apps/desktop/src/renderer/src/App.tsx`（追加 `useNotifications()`）
- `apps/web/src/App.tsx`（同上）

**验证**：`pnpm dev:desktop`（测试通知）

---

### 任务 9：更新导出

**修改文件**：
- `packages/matrix-client/src/index.ts`
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 10：编写单元测试

**创建文件**：
- `packages/ui/__tests__/notifications/NotificationService.test.ts` — 通知判断逻辑（活跃房间、自己消息、DND、静音、级别过滤、@提及检测）
- `packages/matrix-client/__tests__/stores/notificationStore.test.ts` — store 状态管理

**验证**：`pnpm test`

---

### 任务 11：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 从另一客户端发消息、@自己、测试通知和声音
pnpm dev:web       # Web Notification API 测试
```

完成后提交：
```bash
git add -A
git commit -m "feat: 015 - notifications with sound, tray badge, DND, per-room mute"
```

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Web Audio API 在未交互页面不允许播放 | 首次声音无效 | 用户首次点击任意按钮后 resume AudioContext；或在登录时交互 |
| Notification API 被浏览器拒绝 | Web 端无通知 | 检查 `Notification.permission`，被拒绝时在 UI 提示用户 |
| 循环依赖（ui → matrix-client → ui） | 编译报错 | 回调注册模式（3.6 节），matrix-client 不 import ui |
| Electron 打包后声音文件路径变化 | 声音不播放 | 使用 `electron-vite` 的 public 目录，打包后自动映射 |
| 大量消息同时到达导致密集通知 | 用户被轰炸 | 通知去重（同一房间用 `tag` 替换），声音 300ms 内只播一次 |

---

## 9. 后续 Spec 的接入点

- **后续设置页面 spec**：将 NotificationSettings 嵌入设置页面的"通知"标签
- **后续 Web Push spec**：Web 端在浏览器关闭后也能收到通知（Service Worker + Push API）
- **后续通知历史 spec**：通知中心面板，展示最近的未读通知列表
- **后续自定义铃声 spec**：用户上传自定义通知铃声