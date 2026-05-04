# Spec 020: UI/UX 七项改进（UI Polish Round 1）

> 优先级: P1 | 波次: Wave 5 | 预估: 2-3 天 | 前置依赖: 013-ui-restructure, 019-ux-fixes
> 文件路径: `specs/020-ui-polish-round1/spec.md`

---

## 1. 目标

修复 7 个影响日常使用的 UI/UX 问题。

| # | 问题 | 严重度 | 截图 |
|---|------|--------|------|
| FIX-1 | 暗色模式下左侧房间列表文字颜色太暗，不够明显 | 🟡 | 图1 |
| FIX-2 | 创建房间后无法邀请成员（Agent 和真人都是 Matrix 帐号） | 🔴 | — |
| FIX-3 | 没有和某个 Agent 或真人发起私聊的入口 | 🔴 | — |
| FIX-4 | "正在输入"提示缺少动效，太朴素 | 🟡 | 图2 |
| FIX-5 | 成员面板强行区分 Agent/成员但实际区分不准，统一为"成员"即可 | 🟡 | 图3 |
| FIX-6 | 搜索栏颜色太暗，不够明显 | 🟡 | 图4 |
| FIX-7 | 创建房间弹窗在左侧列表区域，应改为居中模态框 | 🟡 | 图5 |

---

## 2. FIX-1：左侧房间列表文字对比度提升

### 问题

暗色模式下，房间列表的默认文字颜色 `var(--text-secondary)`（`rgba(255,255,255,0.4)`）在深色背景上辨识度不够。

### 修复

提升房间列表项的默认文字亮度，未读房间更亮：

| 状态 | 之前 | 之后 |
|------|------|------|
| 默认（已读） | `rgba(255,255,255,0.4)` | `rgba(255,255,255,0.55)` |
| 未读 | `rgba(255,255,255,0.85)` | 不变 |
| 选中 | `#fff` | 不变 |
| 分类标题 | `rgba(255,255,255,0.25)` | `rgba(255,255,255,0.4)` |
| 私聊前缀 `@` | `rgba(255,255,255,0.2)` | `rgba(255,255,255,0.35)` |

### 修改文件

- `packages/ui/src/rooms/RoomListItem.tsx` — 默认文字色从 `text-secondary` 提升
- `packages/ui/src/rooms/RoomSection.tsx` — 分类标题文字色提升

### 代码示例

```tsx
// RoomListItem.tsx — 修改默认态文字色
// 之前：
"text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
// 之后：
"text-[rgba(255,255,255,0.55)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"

// 浅色主题对应值在 CSS 变量中新增：
// --text-room-default: rgba(255,255,255,0.55)  (暗色)
// --text-room-default: rgba(0,0,0,0.55)        (浅色)
```

---

## 3. FIX-2：创建房间后邀请成员

### 问题

当前创建房间的流程只有房间名和话题，没有邀请成员的步骤。创建完房间后是空房间，无法使用。

### 修复

在创建房间对话框中增加**邀请成员**步骤：

1. 用户输入房间名 + 话题
2. 点击"下一步"或直接在同一页面显示成员搜索
3. 输入用户名（Matrix userId）或从已知用户列表中选择
4. 支持多选（标签式显示已选成员）
5. 点击"创建"后先 `createRoom()`，再逐个 `invite()` 已选成员

### 新增/修改文件

- `packages/ui/src/rooms/CreateRoomDialog.tsx` — 重写为居中模态框（与 FIX-7 合并）
- `packages/ui/src/rooms/MemberSearch.tsx` — 新增：成员搜索 + 多选组件
- `packages/matrix-client/src/rooms.ts` — 确认 `inviteUser()` API 存在

### 核心代码

#### MemberSearch.tsx — 成员搜索多选

```tsx
// packages/ui/src/rooms/MemberSearch.tsx
import { useState, useCallback, useMemo } from "react";
import { getClient } from "@magic/matrix-client";

interface MemberSearchProps {
  selectedUserIds: string[];
  onSelect: (userId: string) => void;
  onRemove: (userId: string) => void;
  placeholder?: string;
}

export function MemberSearch({
  selectedUserIds,
  onSelect,
  onRemove,
  placeholder = "输入用户名搜索…",
}: MemberSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ userId: string; displayName: string; avatarUrl: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 搜索 Matrix 用户目录
  const handleSearch = useCallback(async (term: string) => {
    setQuery(term);
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const client = getClient();
      const response = await client.searchUserDirectory({ term, limit: 10 });
      setResults(
        response.results.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name ?? r.user_id.match(/^@([^:]+)/)?.[1] ?? r.user_id,
          avatarUrl: r.avatar_url ?? null,
        }))
      );
    } catch (err) {
      console.error("搜索用户失败:", err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 过滤掉已选的
  const filteredResults = useMemo(
    () => results.filter((r) => !selectedUserIds.includes(r.userId)),
    [results, selectedUserIds]
  );

  return (
    <div>
      {/* 已选成员标签 */}
      {selectedUserIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedUserIds.map((uid) => (
            <span
              key={uid}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              {uid.match(/^@([^:]+)/)?.[1] ?? uid}
              <button
                onClick={() => onRemove(uid)}
                className="ml-0.5 rounded-full p-0.5 transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 搜索输入框 */}
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border-default)',
          color: 'var(--text-primary)',
        }}
      />

      {/* 搜索结果 */}
      {filteredResults.length > 0 && (
        <div
          className="mt-1 max-h-40 overflow-y-auto rounded-lg"
          style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}
        >
          {filteredResults.map((user) => (
            <button
              key={user.userId}
              onClick={() => {
                onSelect(user.userId);
                setQuery("");
                setResults([]);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6C5CE7, #3B82F6)' }}
              >
                {user.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                  {user.displayName}
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {user.userId}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 搜索中 */}
      {isSearching && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>搜索中…</p>
      )}

      {/* 也支持直接输入 Matrix userId */}
      {query.startsWith("@") && query.includes(":") && !selectedUserIds.includes(query) && (
        <button
          onClick={() => {
            onSelect(query);
            setQuery("");
            setResults([]);
          }}
          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs transition-colors"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
        >
          直接邀请 <strong style={{ color: 'var(--text-primary)' }}>{query}</strong>
        </button>
      )}
    </div>
  );
}
```

#### 创建房间时邀请

```typescript
// 创建房间的 handler（在 CreateRoomDialog 中）
const handleCreate = async () => {
  setIsCreating(true);
  try {
    const client = getClient();

    // 1. 创建房间
    const { room_id } = await client.createRoom({
      name: roomName.trim(),
      topic: topic.trim() || undefined,
      preset: isEncrypted ? "trusted_private_chat" : "private_chat",
      initial_state: isEncrypted ? [
        { type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }
      ] : [],
    });

    // 2. 逐个邀请已选成员
    for (const userId of selectedUserIds) {
      try {
        await client.invite(room_id, userId);
      } catch (err) {
        console.error(`邀请 ${userId} 失败:`, err);
      }
    }

    // 3. 切换到新房间
    useRoomStore.getState().setActiveRoom(room_id);
    onClose();
  } catch (err: any) {
    setError(err.message ?? "创建房间失败");
  } finally {
    setIsCreating(false);
  }
};
```

---

## 4. FIX-3：发起私聊入口

### 问题

用户想和某个 Agent 或真人发起 1:1 私聊，但没有入口。

### 修复

在以下位置增加"发起私聊"入口：

1. **成员面板**：点击成员项 → 弹出用户卡片 → "发起私聊"按钮
2. **房间列表顶部**：搜索栏旁的 `+` 按钮 → 下拉菜单 → "发起私聊"

### 发起私聊的 API

```typescript
// packages/matrix-client/src/rooms.ts — 新增
export async function createDM(userId: string): Promise<string> {
  const client = getClient();

  // 检查是否已有和该用户的 DM 房间
  const existingDMRoomId = findExistingDM(client, userId);
  if (existingDMRoomId) {
    return existingDMRoomId;
  }

  // 创建新的 DM 房间
  const { room_id } = await client.createRoom({
    preset: "trusted_private_chat",
    invite: [userId],
    is_direct: true,
    initial_state: [
      { type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } },
    ],
  });

  // 标记为 DM（更新 m.direct account data）
  const directEvent = client.getAccountData("m.direct")?.getContent() ?? {};
  const existingRooms = directEvent[userId] ?? [];
  await client.setAccountData("m.direct", {
    ...directEvent,
    [userId]: [...existingRooms, room_id],
  });

  return room_id;
}

function findExistingDM(client: MatrixClient, userId: string): string | null {
  const directEvent = client.getAccountData("m.direct")?.getContent();
  if (!directEvent) return null;
  const roomIds = directEvent[userId] as string[] | undefined;
  if (!roomIds || roomIds.length === 0) return null;

  // 找到一个还存在且已加入的房间
  for (const roomId of roomIds) {
    const room = client.getRoom(roomId);
    if (room && room.getMyMembership() === "join") {
      return roomId;
    }
  }
  return null;
}
```

### 成员面板中的入口

```tsx
// MemberPanel.tsx 中的 MemberItem — 增加点击打开私聊
const handleStartDM = async () => {
  try {
    const roomId = await createDM(member.userId);
    useRoomStore.getState().setActiveRoom(roomId);
  } catch (err) {
    console.error("发起私聊失败:", err);
  }
};

// MemberItem 增加 onClick：
<div onClick={handleStartDM} className="... cursor-pointer">
```

### 房间列表 `+` 按钮下拉菜单

```tsx
// RoomList.tsx 中的 + 按钮 → 改为下拉菜单
<DropdownMenu>
  <DropdownTrigger>
    <button className="..."><PlusIcon /></button>
  </DropdownTrigger>
  <DropdownContent>
    <DropdownItem onClick={() => setShowCreateDialog(true)}>
      创建房间
    </DropdownItem>
    <DropdownItem onClick={() => setShowDMDialog(true)}>
      发起私聊
    </DropdownItem>
  </DropdownContent>
</DropdownMenu>
```

### StartDMDialog.tsx — 发起私聊对话框

```tsx
// packages/ui/src/rooms/StartDMDialog.tsx
import { useState, useCallback } from "react";
import { createDM, useRoomStore } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay";
import { MemberSearch } from "./MemberSearch";

interface StartDMDialogProps {
  onClose: () => void;
}

export function StartDMDialog({ onClose }: StartDMDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    if (!selectedUserId) return;
    setIsCreating(true);
    setError(null);
    try {
      const roomId = await createDM(selectedUserId);
      useRoomStore.getState().setActiveRoom(roomId);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "发起私聊失败");
    } finally {
      setIsCreating(false);
    }
  }, [selectedUserId, onClose]);

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-2xl"
           style={{ background: 'var(--bg-primary)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          发起私聊
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          搜索用户名或输入完整的 Matrix ID（如 @user:server.com）
        </p>

        <div className="mt-4">
          <MemberSearch
            selectedUserIds={selectedUserId ? [selectedUserId] : []}
            onSelect={(uid) => setSelectedUserId(uid)}
            onRemove={() => setSelectedUserId(null)}
            placeholder="搜索用户…"
          />
        </div>

        {error && <p className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}>
            取消
          </button>
          <button
            onClick={handleStart}
            disabled={!selectedUserId || isCreating}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--gradient-button, linear-gradient(135deg, #6C5CE7, #3B82F6))' }}
          >
            {isCreating ? "创建中…" : "开始对话"}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
```

---

## 5. FIX-4：输入中提示动效

### 问题

"manager 正在输入"提示文字太朴素，没有动态感。

### 修复

在"正在输入"文字后面加上**三个跳动的圆点**动画：

```tsx
// packages/ui/src/chat/TypingIndicator.tsx
import { memo } from "react";

interface TypingIndicatorProps {
  typingUsers: string[];
}

export const TypingIndicator = memo(function TypingIndicator({
  typingUsers,
}: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const text = typingUsers.length === 1
    ? `${typingUsers[0]} 正在输入`
    : typingUsers.length === 2
      ? `${typingUsers[0]} 和 ${typingUsers[1]} 正在输入`
      : `${typingUsers[0]} 等 ${typingUsers.length} 人正在输入`;

  return (
    <div className="flex items-center gap-1.5 px-4 py-1" style={{ color: 'var(--text-secondary)' }}>
      {/* 三个跳动的圆点 */}
      <span className="inline-flex items-center gap-[3px]">
        <span className="typing-dot" style={{ animationDelay: "0ms" }} />
        <span className="typing-dot" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot" style={{ animationDelay: "300ms" }} />
      </span>
      <span className="text-xs">{text}</span>
    </div>
  );
});
```

CSS 动画（追加到 `index.css`）：

```css
@keyframes typing-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.typing-dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-secondary);
  animation: typing-bounce 1.2s ease-in-out infinite;
}
```

### 放置位置

在 `MessageComposer` 上方（编辑器容器和消息列表之间）：

```tsx
// ChatArea.tsx
<ChatTimeline ... />
<TypingIndicator typingUsers={typingUsers} />
<MessageComposer ... />
```

---

## 6. FIX-5：成员面板去掉 Agent/成员分组

### 问题

当前成员面板分为 "AGENT — N" 和 "成员 — N" 两组，但 Agent 检测不准，导致分组混乱。

### 修复

统一为单一列表 **"成员 — N"**，不区分 Agent 和真人。按字母排序。

### 修改代码

```tsx
// packages/ui/src/panels/MemberPanel.tsx
export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-3 pt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em]"
           style={{ color: 'var(--text-tertiary)' }}>
          成员 — {members.length}
        </p>
        {members
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
          .map((m) => (
            <MemberItem key={m.userId} member={m} />
          ))
        }
      </div>
    </div>
  );
}
```

Agent 运行时标签（`MANAGER`、`AGENT` 等）保留在成员项上——只是不再作为分组依据。

---

## 7. FIX-6：搜索栏对比度提升

### 问题

聊天头部右侧的搜索输入框颜色太暗，与背景几乎融为一体。

### 修复

提升搜索栏的边框和文字对比度：

```tsx
// 搜索栏样式修改（ChannelHeader 或 SearchInput 组件）
// 之前：
<input className="rounded-lg px-2 py-1 text-xs"
       style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }} />

// 之后：
<input
  className="rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors"
  style={{
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-hover)',   // 边框从 default 提升到 hover 级
    color: 'var(--text-secondary)',              // 文字从 tertiary 提升到 secondary
  }}
  placeholder="搜索…"
/>
```

placeholder 也需要更亮：

```css
/* 在 index.css 追加 */
input::placeholder {
  color: var(--text-tertiary);
}
```

---

## 8. FIX-7：创建房间改为居中模态框

### 问题

当前创建房间的弹窗直接出现在左侧列表区域内，遮挡了房间列表，样式局促。

### 修复

改为**居中模态框**，使用 `DialogOverlay` 组件：

```tsx
// packages/ui/src/rooms/CreateRoomDialog.tsx（完全重写）
import { useState, useCallback } from "react";
import { getClient, useRoomStore } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay";
import { MemberSearch } from "./MemberSearch";

interface CreateRoomDialogProps {
  onClose: () => void;
}

export function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const [roomName, setRoomName] = useState("");
  const [topic, setTopic] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!roomName.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      const client = getClient();
      const { room_id } = await client.createRoom({
        name: roomName.trim(),
        topic: topic.trim() || undefined,
        preset: isEncrypted ? "trusted_private_chat" : "private_chat",
        initial_state: isEncrypted ? [
          { type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }
        ] : [],
        invite: selectedUserIds,
      });

      useRoomStore.getState().setActiveRoom(room_id);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "创建房间失败");
    } finally {
      setIsCreating(false);
    }
  }, [roomName, topic, isEncrypted, selectedUserIds, onClose]);

  return (
    <DialogOverlay onClose={onClose}>
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{ background: 'var(--bg-primary)' }}
      >
        {/* 标题 */}
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          创建房间
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          创建一个新的聊天房间，邀请 Agent 或团队成员加入
        </p>

        {/* 表单 */}
        <div className="mt-5 space-y-4">
          {/* 房间名称 */}
          <div>
            <label className="mb-1 block text-xs font-medium"
                   style={{ color: 'var(--text-secondary)' }}>
              房间名称
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="输入房间名称"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
          </div>

          {/* 话题 */}
          <div>
            <label className="mb-1 block text-xs font-medium"
                   style={{ color: 'var(--text-secondary)' }}>
              话题（可选）
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="房间话题描述"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* 邀请成员 */}
          <div>
            <label className="mb-1 block text-xs font-medium"
                   style={{ color: 'var(--text-secondary)' }}>
              邀请成员（可选）
            </label>
            <MemberSearch
              selectedUserIds={selectedUserIds}
              onSelect={(uid) => setSelectedUserIds((prev) => [...prev, uid])}
              onRemove={(uid) => setSelectedUserIds((prev) => prev.filter((id) => id !== uid))}
              placeholder="搜索用户名或输入 Matrix ID…"
            />
          </div>

          {/* 加密开关 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEncrypted}
              onChange={(e) => setIsEncrypted(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              启用端到端加密
            </span>
          </label>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="mt-3 text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}>
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!roomName.trim() || isCreating}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--gradient-button, linear-gradient(135deg, #6C5CE7, #3B82F6))' }}
          >
            {isCreating ? "创建中…" : "创建"}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
```

---

## 9. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 暗色模式下房间列表默认文字比之前更亮（对比修改前截图） | 视觉检查 |
| AC-2 | 浅色模式下房间列表文字对比度也正常 | 切换浅色检查 |
| AC-3 | 创建房间对话框为居中模态框，有房间名/话题/邀请成员/加密开关 | 视觉检查 |
| AC-4 | 创建房间时可搜索并选择多个成员邀请 | 搜索后选择 |
| AC-5 | 创建房间后已选成员收到邀请 | 在另一客户端验证 |
| AC-6 | 直接输入 Matrix userId（@user:server）也可以邀请 | 手动输入测试 |
| AC-7 | 成员面板点击成员可发起私聊 | 点击成员验证 |
| AC-8 | 如果已有 DM 房间则直接切换过去，不重复创建 | 再次点击同一成员 |
| AC-9 | 房间列表 `+` 按钮有下拉菜单：创建房间 / 发起私聊 | 点击 + 按钮 |
| AC-10 | "正在输入"提示有三个跳动圆点动画 | 让 Agent 回复时观察 |
| AC-11 | 成员面板为单一"成员 — N"列表，不分 Agent/成员 | 视觉检查 |
| AC-12 | 搜索栏有可见边框和更亮的文字 | 视觉检查 |
| AC-13 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 10. 实现任务（按执行顺序）

### 任务 1：FIX-1 + FIX-6 — 提升房间列表和搜索栏对比度

**修改文件**：
- `packages/ui/src/rooms/RoomListItem.tsx`（默认文字色提升）
- `packages/ui/src/rooms/RoomSection.tsx`（分类标题色提升）
- `packages/ui/src/chat/ChannelHeader.tsx` 或搜索组件（搜索栏边框和文字色提升）

**验证**：`pnpm typecheck`，视觉检查暗色和浅色

---

### 任务 2：FIX-5 — 成员面板去掉分组

**修改文件**：`packages/ui/src/panels/MemberPanel.tsx`

**变更**：移除 Agent/成员分组逻辑，统一为"成员 — N"单一列表

**验证**：`pnpm typecheck`

---

### 任务 3：FIX-4 — 输入中提示动效

**创建文件**：`packages/ui/src/chat/TypingIndicator.tsx`

**修改文件**：
- `apps/desktop/src/renderer/src/index.css`（追加 typing-bounce 动画）
- `apps/web/src/index.css`（同上）
- ChatArea 或 ChatView（放置 TypingIndicator 组件）

**验证**：`pnpm typecheck`

---

### 任务 4：创建 MemberSearch 组件

**创建文件**：`packages/ui/src/rooms/MemberSearch.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：FIX-7 + FIX-2 — 重写 CreateRoomDialog 居中模态框 + 邀请成员

**修改文件**：`packages/ui/src/rooms/CreateRoomDialog.tsx`（完全重写）

**验证**：`pnpm typecheck`

---

### 任务 6：FIX-3 — 发起私聊功能

**创建文件**：
- `packages/ui/src/rooms/StartDMDialog.tsx`
- `packages/matrix-client/src/dm.ts`（createDM + findExistingDM）

**修改文件**：
- `packages/ui/src/rooms/RoomList.tsx`（+ 按钮改为下拉菜单）
- `packages/ui/src/panels/MemberPanel.tsx`（点击成员发起私聊）
- `packages/matrix-client/src/index.ts`（导出 createDM）

**验证**：`pnpm typecheck`

---

### 任务 7：更新导出 + 全局验证

**修改文件**：
- `packages/ui/src/index.ts`
- `packages/matrix-client/src/index.ts`

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm dev:desktop
# 验证全部 7 项修复
```

完成后提交：
```bash
git add -A
git commit -m "feat: 020 - UI polish: contrast, invite members, start DM, typing animation, search visibility, centered dialog"
```

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `client.searchUserDirectory()` 需要 homeserver 支持 | 搜索无结果 | 提供直接输入 Matrix userId 的回退方式 |
| 创建 DM 后 `m.direct` account data 更新不及时 | 房间列表不显示为私聊 | 在 bridge.ts 的 sync 回调中监听 account data 更新 |
| 大量成员邀请时逐个 invite 较慢 | 创建房间等待时间长 | 显示进度条（"正在邀请 3/5…"），后续可改为 `createRoom({ invite: [...] })` 批量邀请 |
| 输入中提示动画在低性能设备卡顿 | 视觉问题 | CSS animation 不依赖 JS，性能影响极小 |