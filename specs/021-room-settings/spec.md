# Spec 021: 房间与私聊设置面板（Room & DM Settings）

> 优先级: P1 | 波次: Wave 5 | 预估: 3-4 天 | 前置依赖: 013-ui-restructure, 018-room-invitations, 020-ui-polish
> 文件路径: `specs/021-room-settings/spec.md`

---

## 1. 目标

在聊天区域右上角（成员列表图标右侧）增加**设置按钮 ⚙**，点击后弹出当前房间/私聊的设置面板。面板覆盖房间信息编辑、成员管理、通知偏好、安全与加密、高级操作五大模块。

### 用户故事

- 作为用户，我希望点击右上角⚙按钮打开当前房间的设置面板
- 作为房间管理员，我希望在设置中修改房间名称、话题、头像
- 作为用户，我希望在设置中邀请新成员或移除成员
- 作为用户，我希望设置当前房间的通知偏好（全部通知 / 仅 @提及 / 静音）
- 作为用户，我希望查看房间的加密状态和安全信息
- 作为用户，我希望在设置中离开房间
- 作为房间创建者，我希望能删除房间

---

## 2. 设置项总览

### 2.1 群聊房间设置（Room Settings）

| 模块 | 设置项 | 权限要求 | 说明 |
|------|--------|---------|------|
| **房间信息** | 房间名称 | Admin/Mod | 修改 `m.room.name` state event |
| | 房间话题 | Admin/Mod | 修改 `m.room.topic` state event |
| | 房间头像 | Admin/Mod | 修改 `m.room.avatar` state event（上传图片） |
| **成员管理** | 成员列表 | 所有人 | 显示当前成员，可搜索 |
| | 邀请成员 | Admin/Mod | 使用 MemberSearch 组件搜索并邀请 |
| | 移除成员 | Admin | `client.kick(roomId, userId)` |
| | 修改权限级别 | Admin | 设置成员 power level（Admin/Mod/Member） |
| **通知** | 通知模式 | 所有人 | 三档：全部通知 / 仅 @提及 / 静音 |
| | 置顶房间 | 所有人 | `m.favourite` tag |
| **安全** | 加密状态 | 所有人（只读） | 显示是否已启用 E2EE |
| | 设备验证 | 所有人 | 显示未验证设备数 |
| **高级** | 房间 ID | 所有人（只读） | 显示 `!xxx:server` |
| | 房间版本 | 所有人（只读） | 显示 Matrix room version |
| | 离开房间 | 所有人 | `client.leave(roomId)` |
| | 删除房间 | Admin | 移除所有成员 + 自己离开 |

### 2.2 私聊设置（DM Settings）

| 模块 | 设置项 | 说明 |
|------|--------|------|
| **用户信息** | 对方头像 + 名称 | 只读显示 |
| | Matrix ID | 只读显示 |
| **通知** | 通知模式 | 三档：全部通知 / 仅 @提及 / 静音 |
| | 置顶对话 | `m.favourite` tag |
| **安全** | 加密状态 | 显示是否已启用 E2EE |
| | 启用/关闭加密 | 加密只能开启不能关闭（Matrix 限制） |
| **高级** | 房间 ID | 只读 |
| | 关闭对话 | 离开 DM 房间 |

---

## 3. 架构设计

### 3.1 组件结构

```
packages/ui/src/
├── settings/
│   ├── RoomSettingsPanel.tsx       # 设置面板容器（右侧滑出或模态框）
│   ├── RoomInfoSection.tsx         # 房间信息编辑（名称/话题/头像）
│   ├── MemberManageSection.tsx     # 成员管理（列表/邀请/移除/权限）
│   ├── NotificationSection.tsx     # 通知偏好
│   ├── SecuritySection.tsx         # 安全与加密
│   ├── AdvancedSection.tsx         # 高级操作（离开/删除/房间ID）
│   └── DMSettingsPanel.tsx         # 私聊设置（精简版）
├── chat/
│   └── ChannelHeader.tsx           # 更新：增加⚙设置按钮
└── hooks/
    ├── useRoomSettings.ts          # 房间设置读写 hook
    └── useNotificationMode.ts     # 通知模式 hook
```

### 3.2 设置面板的展示方式

**方案：右侧面板**（与成员面板共用位置，互斥显示）

- 点击⚙按钮 → 右侧面板切换到 `settings` 模式
- 面板宽度 280px（比成员面板稍宽）
- 内容可滚动
- 顶部显示房间名 + 关闭按钮

---

## 4. 技术规格

### 4.1 ChannelHeader.tsx — 增加设置按钮

```tsx
// packages/ui/src/chat/ChannelHeader.tsx（关键更新部分）

// 在成员列表按钮右侧增加设置按钮：
<div className="flex shrink-0 items-center gap-3 text-[var(--text-secondary)]">
  {/* Agent 面板按钮 */}
  <HeaderIconButton title="Agent 面板" onClick={() => setRightPanel("agents")}>
    {/* 人群图标 */}
  </HeaderIconButton>

  {/* 成员列表按钮 */}
  <HeaderIconButton
    title="成员列表"
    isActive={rightPanelOpen && rightPanelMode === "members"}
    onClick={() => rightPanelMode === "members" ? closeRightPanel() : setRightPanel("members")}
  >
    {/* 成员图标 */}
  </HeaderIconButton>

  {/* ⭐ 新增：设置按钮 */}
  <HeaderIconButton
    title="房间设置"
    isActive={rightPanelOpen && rightPanelMode === "settings"}
    onClick={() => rightPanelMode === "settings" ? closeRightPanel() : setRightPanel("settings")}
  >
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  </HeaderIconButton>

  {/* 搜索栏 */}
  {/* ... */}
</div>
```

### 4.2 更新 UIStore — 增加 settings 模式

```typescript
// packages/matrix-client/src/stores/uiStore.ts
interface UIState {
  rightPanelOpen: boolean;
  rightPanelMode: "members" | "agents" | "settings"; // ⭐ 新增 "settings"
  // ...
}
```

### 4.3 更新 MainLayout — 渲染设置面板

```tsx
// MainLayout.tsx 右侧面板区域
{rightPanelOpen && activeRoomId && (
  <div className="flex w-[280px] shrink-0 flex-col border-l"
       style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
    {/* 面板头部 */}
    <div className="flex h-10 items-center justify-between border-b px-3"
         style={{ borderColor: 'var(--border-default)' }}>
      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {rightPanelMode === "agents" ? "Agent 面板"
          : rightPanelMode === "settings" ? "设置"
          : "成员"}
      </span>
      <button onClick={closeRightPanel} className="rounded p-0.5"
              style={{ color: 'var(--text-secondary)' }}>
        ✕
      </button>
    </div>

    {/* 面板内容 */}
    <div className="min-h-0 flex-1 overflow-y-auto">
      {rightPanelMode === "members" && <MemberPanel roomId={activeRoomId} />}
      {rightPanelMode === "agents" && <AgentDashboard roomId={activeRoomId} />}
      {rightPanelMode === "settings" && <RoomSettingsPanel roomId={activeRoomId} />}
    </div>
  </div>
)}
```

### 4.4 useRoomSettings.ts — 房间设置读写 Hook

```typescript
// packages/ui/src/hooks/useRoomSettings.ts
import { useState, useCallback, useMemo } from "react";
import { getClient, useRoomStore, useAuthStore } from "@magic/matrix-client";

interface RoomSettings {
  roomId: string;
  name: string;
  topic: string;
  avatarMxc: string | null;
  isEncrypted: boolean;
  isDirect: boolean;
  myPowerLevel: number;    // 当前用户的权限级别
  canEditInfo: boolean;    // 是否可以编辑房间信息
  canInvite: boolean;      // 是否可以邀请成员
  canKick: boolean;        // 是否可以移除成员
  canSetPower: boolean;    // 是否可以修改权限
  roomVersion: string;
  memberCount: number;
}

export function useRoomSettings(roomId: string) {
  const userId = useAuthStore((s) => s.userId);
  const room = useRoomStore((s) => s.rooms?.[roomId]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings = useMemo((): RoomSettings | null => {
    const client = getClient();
    const matrixRoom = client.getRoom(roomId);
    if (!matrixRoom || !userId) return null;

    const myPower = matrixRoom.getMemberPowerLevel(userId);
    const stateRequired = matrixRoom.currentState.getStateEvents("m.room.power_levels", "")
      ?.getContent();

    // 默认 power level 要求
    const editPower = stateRequired?.events?.["m.room.name"] ?? stateRequired?.state_default ?? 50;
    const invitePower = stateRequired?.invite ?? 50;
    const kickPower = stateRequired?.kick ?? 50;

    const encryptionEvent = matrixRoom.currentState.getStateEvents("m.room.encryption", "");

    return {
      roomId,
      name: room?.name ?? "",
      topic: room?.topic ?? "",
      avatarMxc: null, // TODO: 从 state event 获取
      isEncrypted: !!encryptionEvent,
      isDirect: !!room?.isDirect,
      myPowerLevel: myPower,
      canEditInfo: myPower >= editPower,
      canInvite: myPower >= invitePower,
      canKick: myPower >= kickPower,
      canSetPower: myPower >= 100, // 只有 Admin 可以
      roomVersion: matrixRoom.getVersion() ?? "?",
      memberCount: matrixRoom.getJoinedMemberCount(),
    };
  }, [roomId, userId, room]);

  // 修改房间名称
  const setRoomName = useCallback(async (name: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const client = getClient();
      await client.sendStateEvent(roomId, "m.room.name", { name }, "");
    } catch (err: any) {
      setError(err.message ?? "修改失败");
    } finally {
      setIsSaving(false);
    }
  }, [roomId]);

  // 修改房间话题
  const setRoomTopic = useCallback(async (topic: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const client = getClient();
      await client.sendStateEvent(roomId, "m.room.topic", { topic }, "");
    } catch (err: any) {
      setError(err.message ?? "修改失败");
    } finally {
      setIsSaving(false);
    }
  }, [roomId]);

  // 邀请成员
  const inviteMember = useCallback(async (userId: string) => {
    try {
      const client = getClient();
      await client.invite(roomId, userId);
    } catch (err: any) {
      throw new Error(err.message ?? "邀请失败");
    }
  }, [roomId]);

  // 移除成员
  const kickMember = useCallback(async (targetUserId: string, reason?: string) => {
    try {
      const client = getClient();
      await client.kick(roomId, targetUserId, reason);
    } catch (err: any) {
      throw new Error(err.message ?? "移除失败");
    }
  }, [roomId]);

  // 离开房间
  const leaveRoom = useCallback(async () => {
    try {
      const client = getClient();
      await client.leave(roomId);
    } catch (err: any) {
      throw new Error(err.message ?? "离开失败");
    }
  }, [roomId]);

  // 设置通知模式
  const setNotificationMode = useCallback(async (mode: "all" | "mentions" | "mute") => {
    try {
      const client = getClient();
      // Matrix 使用 push rules 控制通知
      if (mode === "mute") {
        await client.setRoomMutePushRule("global", roomId, true);
      } else {
        await client.setRoomMutePushRule("global", roomId, false);
        // mentions-only 需要设置特定的 push rule
        // 简化处理：通过 room account data 存储偏好
        await client.setRoomAccountData(roomId, "com.magic.notification_mode", { mode });
      }
    } catch (err: any) {
      console.error("设置通知失败:", err);
    }
  }, [roomId]);

  // 置顶/取消置顶
  const toggleFavourite = useCallback(async () => {
    try {
      const client = getClient();
      const matrixRoom = client.getRoom(roomId);
      const tags = matrixRoom?.tags ?? {};
      if (tags["m.favourite"]) {
        await client.deleteRoomTag(roomId, "m.favourite");
      } else {
        await client.setRoomTag(roomId, "m.favourite", { order: 0.5 });
      }
    } catch (err: any) {
      console.error("置顶失败:", err);
    }
  }, [roomId]);

  return {
    settings,
    isSaving,
    error,
    setRoomName,
    setRoomTopic,
    inviteMember,
    kickMember,
    leaveRoom,
    setNotificationMode,
    toggleFavourite,
  };
}
```

### 4.5 RoomSettingsPanel.tsx — 设置面板容器

```tsx
// packages/ui/src/settings/RoomSettingsPanel.tsx
import { useRoomSettings } from "../hooks/useRoomSettings";
import { RoomInfoSection } from "./RoomInfoSection";
import { MemberManageSection } from "./MemberManageSection";
import { NotificationSection } from "./NotificationSection";
import { SecuritySection } from "./SecuritySection";
import { AdvancedSection } from "./AdvancedSection";
import { DMSettingsPanel } from "./DMSettingsPanel";

interface RoomSettingsPanelProps {
  roomId: string;
}

export function RoomSettingsPanel({ roomId }: RoomSettingsPanelProps) {
  const {
    settings,
    isSaving,
    error,
    setRoomName,
    setRoomTopic,
    inviteMember,
    kickMember,
    leaveRoom,
    setNotificationMode,
    toggleFavourite,
  } = useRoomSettings(roomId);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>加载中…</p>
      </div>
    );
  }

  // 私聊用精简版设置
  if (settings.isDirect) {
    return (
      <DMSettingsPanel
        roomId={roomId}
        settings={settings}
        onSetNotification={setNotificationMode}
        onToggleFavourite={toggleFavourite}
        onLeave={leaveRoom}
      />
    );
  }

  // 群聊用完整设置
  return (
    <div className="space-y-1 p-3">
      {/* 房间信息 */}
      <RoomInfoSection
        settings={settings}
        isSaving={isSaving}
        error={error}
        onSetName={setRoomName}
        onSetTopic={setRoomTopic}
      />

      <Divider />

      {/* 成员管理 */}
      <MemberManageSection
        roomId={roomId}
        settings={settings}
        onInvite={inviteMember}
        onKick={kickMember}
      />

      <Divider />

      {/* 通知偏好 */}
      <NotificationSection
        roomId={roomId}
        onSetMode={setNotificationMode}
        onToggleFavourite={toggleFavourite}
      />

      <Divider />

      {/* 安全 */}
      <SecuritySection settings={settings} />

      <Divider />

      {/* 高级操作 */}
      <AdvancedSection
        settings={settings}
        onLeave={leaveRoom}
      />
    </div>
  );
}

function Divider() {
  return <div className="my-2 h-px" style={{ background: 'var(--border-default)' }} />;
}
```

### 4.6 RoomInfoSection.tsx — 房间信息编辑

```tsx
// packages/ui/src/settings/RoomInfoSection.tsx
import { useState, useCallback } from "react";
import type { RoomSettings } from "../hooks/useRoomSettings";

interface RoomInfoSectionProps {
  settings: RoomSettings;
  isSaving: boolean;
  error: string | null;
  onSetName: (name: string) => Promise<void>;
  onSetTopic: (topic: string) => Promise<void>;
}

export function RoomInfoSection({
  settings, isSaving, error, onSetName, onSetTopic,
}: RoomInfoSectionProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [nameValue, setNameValue] = useState(settings.name);
  const [topicValue, setTopicValue] = useState(settings.topic);

  const handleSaveName = useCallback(async () => {
    if (nameValue.trim() && nameValue !== settings.name) {
      await onSetName(nameValue.trim());
    }
    setEditingName(false);
  }, [nameValue, settings.name, onSetName]);

  const handleSaveTopic = useCallback(async () => {
    if (topicValue !== settings.topic) {
      await onSetTopic(topicValue.trim());
    }
    setEditingTopic(false);
  }, [topicValue, settings.topic, onSetTopic]);

  return (
    <div>
      <SectionTitle>房间信息</SectionTitle>

      {/* 房间名称 */}
      <SettingRow label="房间名称">
        {editingName ? (
          <div className="flex gap-1">
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              className="flex-1 rounded px-2 py-1 text-xs outline-none"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)',
                       border: '0.5px solid var(--border-hover)' }}
              autoFocus
            />
            <button onClick={handleSaveName} disabled={isSaving}
                    className="rounded px-2 py-1 text-[10px] font-medium text-white"
                    style={{ background: 'var(--color-accent, #5865F2)' }}>
              保存
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
              {settings.name || "未命名"}
            </span>
            {settings.canEditInfo && (
              <button onClick={() => { setNameValue(settings.name); setEditingName(true); }}
                      className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                编辑
              </button>
            )}
          </div>
        )}
      </SettingRow>

      {/* 房间话题 */}
      <SettingRow label="话题">
        {editingTopic ? (
          <div className="flex flex-col gap-1">
            <textarea
              value={topicValue}
              onChange={(e) => setTopicValue(e.target.value)}
              rows={2}
              className="w-full rounded px-2 py-1 text-xs outline-none resize-none"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)',
                       border: '0.5px solid var(--border-hover)' }}
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <button onClick={() => setEditingTopic(false)}
                      className="rounded px-2 py-1 text-[10px]"
                      style={{ color: 'var(--text-secondary)' }}>
                取消
              </button>
              <button onClick={handleSaveTopic} disabled={isSaving}
                      className="rounded px-2 py-1 text-[10px] font-medium text-white"
                      style={{ background: 'var(--color-accent, #5865F2)' }}>
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs truncate" style={{ color: settings.topic ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
              {settings.topic || "无话题"}
            </span>
            {settings.canEditInfo && (
              <button onClick={() => { setTopicValue(settings.topic); setEditingTopic(true); }}
                      className="shrink-0 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                编辑
              </button>
            )}
          </div>
        )}
      </SettingRow>

      {error && <p className="mt-1 text-[10px]" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
```

### 4.7 NotificationSection.tsx — 通知偏好

```tsx
// packages/ui/src/settings/NotificationSection.tsx
import { useState, useEffect } from "react";
import { getClient } from "@magic/matrix-client";

interface NotificationSectionProps {
  roomId: string;
  onSetMode: (mode: "all" | "mentions" | "mute") => Promise<void>;
  onToggleFavourite: () => Promise<void>;
}

export function NotificationSection({ roomId, onSetMode, onToggleFavourite }: NotificationSectionProps) {
  const [mode, setMode] = useState<"all" | "mentions" | "mute">("all");
  const [isFavourite, setIsFavourite] = useState(false);

  // 读取当前设置
  useEffect(() => {
    const client = getClient();
    const room = client.getRoom(roomId);
    if (room) {
      setIsFavourite(!!room.tags?.["m.favourite"]);
      // 检查是否静音
      const pushRules = client.getAccountData("m.push_rules")?.getContent();
      // 简化：检查 room account data
      const notifData = room.getAccountData("com.magic.notification_mode")?.getContent();
      if (notifData?.mode) setMode(notifData.mode);
    }
  }, [roomId]);

  const handleModeChange = async (newMode: "all" | "mentions" | "mute") => {
    setMode(newMode);
    await onSetMode(newMode);
  };

  return (
    <div>
      <SectionTitle>通知</SectionTitle>

      {/* 通知模式 */}
      <div className="space-y-1">
        {(["all", "mentions", "mute"] as const).map((m) => (
          <label key={m}
                 className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors"
                 style={{ background: mode === m ? 'var(--bg-surface)' : 'transparent' }}>
            <input
              type="radio"
              name="notif-mode"
              checked={mode === m}
              onChange={() => handleModeChange(m)}
              className="h-3 w-3"
            />
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
              {m === "all" ? "全部消息" : m === "mentions" ? "仅 @提及" : "静音"}
            </span>
          </label>
        ))}
      </div>

      {/* 置顶 */}
      <label className="mt-2 flex items-center justify-between rounded px-2 py-1.5 cursor-pointer">
        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>置顶</span>
        <input
          type="checkbox"
          checked={isFavourite}
          onChange={async () => {
            setIsFavourite(!isFavourite);
            await onToggleFavourite();
          }}
          className="h-4 w-4 rounded"
        />
      </label>
    </div>
  );
}
```

### 4.8 SecuritySection.tsx — 安全信息

```tsx
// packages/ui/src/settings/SecuritySection.tsx

export function SecuritySection({ settings }: { settings: RoomSettings }) {
  return (
    <div>
      <SectionTitle>安全</SectionTitle>

      <SettingRow label="端到端加密">
        <span className="text-xs" style={{
          color: settings.isEncrypted ? 'var(--color-success, #23A55A)' : 'var(--text-tertiary)',
        }}>
          {settings.isEncrypted ? "已启用" : "未启用"}
        </span>
      </SettingRow>

      {settings.isEncrypted && (
        <p className="px-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          此房间的消息使用端到端加密保护。只有房间成员可以阅读消息。
        </p>
      )}
    </div>
  );
}
```

### 4.9 AdvancedSection.tsx — 高级操作

```tsx
// packages/ui/src/settings/AdvancedSection.tsx
import { useState, useCallback } from "react";
import { useRoomStore } from "@magic/matrix-client";

export function AdvancedSection({
  settings,
  onLeave,
}: {
  settings: RoomSettings;
  onLeave: () => Promise<void>;
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeave = useCallback(async () => {
    setIsLeaving(true);
    try {
      await onLeave();
      useRoomStore.getState().setActiveRoom(null);
    } catch (err) {
      console.error("离开房间失败:", err);
    } finally {
      setIsLeaving(false);
      setConfirmLeave(false);
    }
  }, [onLeave]);

  return (
    <div>
      <SectionTitle>高级</SectionTitle>

      {/* 房间 ID */}
      <SettingRow label="房间 ID">
        <span className="text-[10px] font-mono break-all select-all"
              style={{ color: 'var(--text-tertiary)' }}>
          {settings.roomId}
        </span>
      </SettingRow>

      {/* 房间版本 */}
      <SettingRow label="房间版本">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          v{settings.roomVersion}
        </span>
      </SettingRow>

      {/* 成员数 */}
      <SettingRow label="成员数">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {settings.memberCount}
        </span>
      </SettingRow>

      {/* 离开房间 */}
      <div className="mt-3">
        {confirmLeave ? (
          <div className="rounded-lg p-3" style={{ background: 'rgba(242,63,67,0.1)' }}>
            <p className="text-xs" style={{ color: 'var(--color-danger, #F23F43)' }}>
              确定要离开此{settings.isDirect ? "对话" : "房间"}吗？
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setConfirmLeave(false)}
                      className="rounded px-3 py-1 text-xs"
                      style={{ color: 'var(--text-secondary)' }}>
                取消
              </button>
              <button onClick={handleLeave} disabled={isLeaving}
                      className="rounded px-3 py-1 text-xs font-medium text-white"
                      style={{ background: 'var(--color-danger, #F23F43)' }}>
                {isLeaving ? "离开中…" : "确定离开"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLeave(true)}
            className="w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors"
            style={{ color: 'var(--color-danger, #F23F43)', background: 'rgba(242,63,67,0.08)' }}
          >
            离开{settings.isDirect ? "对话" : "房间"}
          </button>
        )}
      </div>
    </div>
  );
}
```

### 4.10 通用子组件

```tsx
// 在 RoomSettingsPanel.tsx 或单独文件中定义

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em]"
       style={{ color: 'var(--text-tertiary)' }}>
      {children}
    </p>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded px-2 py-1.5">
      <p className="mb-0.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      {children}
    </div>
  );
}
```

---

## 5. 更新 @magic/ui 导出

```typescript
// packages/ui/src/index.ts 追加
export { RoomSettingsPanel } from "./settings/RoomSettingsPanel";
export { DMSettingsPanel } from "./settings/DMSettingsPanel";
export { useRoomSettings } from "./hooks/useRoomSettings";
```

---

## 6. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 聊天头部右上角有⚙设置按钮 | 视觉检查 |
| AC-2 | 点击⚙按钮打开右侧设置面板，再次点击关闭 | 手动验证 |
| AC-3 | 设置面板和成员面板互斥（点击设置时成员面板关闭） | 手动验证 |
| AC-4 | 群聊设置显示：房间信息 + 成员管理 + 通知 + 安全 + 高级 五个模块 | 视觉检查 |
| AC-5 | 私聊设置显示精简版：用户信息 + 通知 + 安全 + 高级 | 视觉检查 |
| AC-6 | Admin 可以编辑房间名称和话题 | 手动验证 |
| AC-7 | 普通成员无法编辑房间信息（编辑按钮不显示） | 手动验证 |
| AC-8 | 通知可切换三档：全部 / 仅 @提及 / 静音 | 手动验证 |
| AC-9 | 可置顶/取消置顶房间 | 手动验证 |
| AC-10 | 加密状态正确显示（绿色"已启用"或灰色"未启用"） | 视觉检查 |
| AC-11 | 离开房间需二次确认，离开后切换到空状态 | 手动验证 |
| AC-12 | 房间 ID 可选中复制 | 手动验证 |
| AC-13 | Admin 可在设置中邀请新成员 | 手动验证 |
| AC-14 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 7. 实现任务（按执行顺序）

### 任务 1：更新 UIStore 增加 settings 模式

**修改文件**：`packages/matrix-client/src/stores/uiStore.ts`

**变更**：`rightPanelMode` 类型增加 `"settings"`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 useRoomSettings Hook

**创建文件**：`packages/ui/src/hooks/useRoomSettings.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建设置面板子组件

**创建文件**：
- `packages/ui/src/settings/RoomInfoSection.tsx`
- `packages/ui/src/settings/MemberManageSection.tsx`
- `packages/ui/src/settings/NotificationSection.tsx`
- `packages/ui/src/settings/SecuritySection.tsx`
- `packages/ui/src/settings/AdvancedSection.tsx`
- `packages/ui/src/settings/DMSettingsPanel.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 RoomSettingsPanel 容器

**创建文件**：`packages/ui/src/settings/RoomSettingsPanel.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：更新 ChannelHeader 增加设置按钮

**修改文件**：`packages/ui/src/chat/ChannelHeader.tsx`

**变更**：在成员列表按钮右侧增加⚙设置按钮

**验证**：`pnpm typecheck`

---

### 任务 6：更新 MainLayout 渲染设置面板

**修改文件**：`packages/ui/src/layouts/MainLayout.tsx`

**变更**：
- 右侧面板宽度改为 280px
- 增加 `rightPanelMode === "settings"` 的渲染分支
- 面板标题根据模式动态显示

**验证**：`pnpm typecheck`

---

### 任务 7：更新导出 + 全局验证

**修改文件**：`packages/ui/src/index.ts`

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm dev:desktop
# 点击⚙按钮 → 验证设置面板显示和功能
```

完成后提交：
```bash
git add -A
git commit -m "feat: 021 - room & DM settings panel with info, members, notifications, security, advanced"
```

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Matrix push rules API 复杂 | 通知模式切换不生效 | 使用 room account data 存储偏好作为回退 |
| 加密房间无法取消加密 | 用户误开加密后无法关闭 | UI 中说明"加密一旦启用无法关闭"，创建房间时默认不加密 |
| kick 操作需要足够 power level | 普通成员看到"移除"按钮但操作失败 | 根据 canKick 动态隐藏按钮 |
| 面板宽度 280px 在小屏幕上挤压聊天区 | 布局问题 | 设置最小聊天区宽度 400px，小屏幕改为模态框 |