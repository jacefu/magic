# Matrix 事件编写规则

## 使用类型化枚举，禁止字符串字面量

```typescript
// ✅ 正确
import { RoomEvent, MatrixEventType } from "matrix-js-sdk";
client.on(RoomEvent.Timeline, handler);

// ❌ 错误
client.on("Room.timeline", handler);
```

## 自定义事件类型在 @magic/shared-types 中定义

所有 Magic 平台自定义事件（`com.magic.*`）必须：
1. 在 `packages/shared-types/src/matrix-events.ts` 中用 Zod schema 定义
2. 在 `MAGIC_EVENTS` 常量中注册类型字符串
3. 收发时用 schema 的 `.parse()` / `.safeParse()` 验证内容

## 事件内容校验

```typescript
// ✅ 接收时必须校验
const result = AgentStatusEvent.safeParse(event.getContent());
if (!result.success) return;

// ❌ 禁止直接 cast
const content = event.getContent() as AgentStatusEvent;
```

## 命名规范

- 事件类型字符串：`com.magic.<domain>.<action>`（全小写，点分隔）
- Zod schema 变量名：PascalCase，与类型同名（`AgentStatusEvent`）
- 常量 key：SCREAMING_SNAKE_CASE（`AGENT_STATUS`）
