# Spec 023: App Icon 替换 + 字母默认头像（含拼音支持）

> 优先级: P1 | 波次: Wave 6 | 预估: 1-2 天 | 前置依赖: 020-ui-polish-round1
> 文件路径: `specs/023-app-icon-and-letter-avatars/spec.md`

---

## 1. 目标

替换 Magic Client 的 App Icon 和默认头像系统：

1. **App Icon**：用用户提供的图标替换当前 Magic App 图标。包含**浅色和深色两个版本**，跟随应用主题切换
2. **默认头像**：把所有 Agent 和真人帐号的默认渐变首字母头像，替换为用户提供的 A-Z 字母图标
3. **拼音支持**：中文名按**拼音首字母**映射（如 "岛风" → 'D'）
4. **数字 fallback**：名字以数字开头时，**Agent 使用 A，真人帐号使用 H**
5. **主题适配**：字母图标也有浅色/深色两个版本，自动跟随主题

---

## 2. 素材准备（用户先做）

### 2.1 文件结构

```
项目根目录/
├── apps/
│   ├── desktop/
│   │   ├── build/
│   │   │   ├── icon.icns          # macOS（OS 级 dock 图标，单一版本）
│   │   │   ├── icon.ico           # Windows（OS 级任务栏图标）
│   │   │   └── icon.png           # Linux（1024×1024 PNG）
│   │   └── resources/
│   │       ├── icon-light.png     # 应用内浅色图标（512×512）
│   │       └── icon-dark.png      # 应用内深色图标（512×512）
│   └── web/
│       └── public/
│           ├── favicon.png        # Web 主 favicon（512×512）
│           ├── favicon-light.png  # 浅色主题
│           └── favicon-dark.png   # 深色主题
└── packages/
    └── ui/
        └── src/
            └── assets/
                ├── app-icon/
                │   ├── icon-light.png  # 应用内 Magic 图标
                │   ├── icon-dark.png
                │   └── icon.svg        # 可选：SVG 版本
                └── letters/
                    ├── light/          # 浅色主题用
                    │   ├── A.png
                    │   ├── B.png
                    │   └── ... Z.png
                    └── dark/           # 深色主题用
                        ├── A.png
                        └── ... Z.png
```

⚠️ **OS 级图标说明**：macOS dock / Windows 任务栏的图标通常**不**跟随应用内主题切换，因此 `apps/desktop/build/` 下只放一个版本（建议选透明背景、能在浅色和深色背景下都好看的设计）。

应用内的图标（如左上角 workspace 切换器、设置页面 logo 等）才会跟随主题切换。

### 2.2 字母图标建议格式

- **PNG**：256×256，透明背景，便于直接用 `<img>` 嵌入
- **SVG**：更佳，无损缩放、文件更小
- 单字母居中，建议 padding 充足（避免裁切）
- light/dark 两套要保持**同样的设计语言**，仅颜色变化

### 2.3 命名严格要求

- 字母图标必须命名为 **大写字母 + 扩展名**：`A.png` / `B.png` / ... / `Z.png`
- light 和 dark 文件夹下文件名一一对应

---

## 3. 主题检测

App 已通过 `document.documentElement.dataset.theme` 切换主题（取值 `"light"` / `"dark"`）。

### 3.1 useTheme Hook（如已存在则复用）

```typescript
// packages/ui/src/hooks/useTheme.ts
import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = document.documentElement.dataset.theme;
    return t === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    // 订阅 data-theme 变化（监听 attribute 变化）
    const observer = new MutationObserver(() => {
      const t = document.documentElement.dataset.theme;
      setTheme(t === 'dark' ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
```

⚠️ 实现前先用 `grep -rn "useTheme\|data-theme" packages/ui/src/` 确认是否已有此 hook。如有，复用；如无，新建。

---

## 4. 默认头像逻辑

### 4.1 字母映射规则（按优先级）

| 优先级 | 规则 | 示例 |
|--------|------|------|
| 1 | 首字符是 A-Z 或 a-z | "Manager" → 'M'，"alice" → 'A' |
| 2 | 首字符是中文 → 拼音首字母 | "岛风" → 'D'，"李明" → 'L' |
| 3 | 首字符是数字 | "123用户"（Agent）→ 'A'，"123user"（真人）→ 'H' |
| 4 | 其他（emoji、符号等） | 尝试从 userId 取字母（如 `@manager:server` → 'M'）；都失败时按数字规则 fallback（Agent → A / 真人 → H） |

### 4.2 拼音库选择：pinyin-pro

```bash
pnpm add pinyin-pro -F @magic/ui
```

**pinyin-pro 用法示例**：

```typescript
import { pinyin } from 'pinyin-pro';

pinyin('岛', { pattern: 'first', toneType: 'none', type: 'string' });
// → 'd'

pinyin('张三', { pattern: 'first', toneType: 'none', type: 'string' });
// → 'z s'（多字会有空格分隔，取第一个非空字符）
```

**为什么是 pinyin-pro 而不是 pinyin**：体积更小（~80KB gzipped）、维护更活跃、API 更现代、支持 tree-shaking。

### 4.3 核心函数

```typescript
// packages/ui/src/avatar/getDefaultAvatarLetter.ts
import { pinyin } from 'pinyin-pro';

/**
 * 根据名字 + 是否 Agent，决定使用哪个字母图标
 *
 * @param name 显示名（可能是中文/英文/数字/emoji）
 * @param isAgent 是否是 Agent
 * @param userId 备用：当 name 取不到字母时从 userId 取
 * @returns 大写字母 'A' ~ 'Z'
 */
export function getDefaultAvatarLetter(
  name: string,
  isAgent: boolean,
  userId?: string
): string {
  const fallback = isAgent ? 'A' : 'H';

  const trimmed = (name || '').trim();

  // 1. 名字为空 → 尝试从 userId 取
  if (!trimmed && userId) {
    return getLetterFromUserId(userId) ?? fallback;
  }
  if (!trimmed) return fallback;

  const firstChar = trimmed.charAt(0);

  // 2. ASCII 字母
  if (/^[a-zA-Z]$/.test(firstChar)) {
    return firstChar.toUpperCase();
  }

  // 3. 数字 → 按 isAgent 区分
  if (/^[0-9]$/.test(firstChar)) {
    return fallback;
  }

  // 4. 中文（含 CJK 扩展） → 拼音首字母
  if (/^[\u4e00-\u9fff\u3400-\u4dbf]$/.test(firstChar)) {
    try {
      const result = pinyin(firstChar, {
        pattern: 'first',
        toneType: 'none',
        type: 'string',
      });
      const letter = result.replace(/\s+/g, '').charAt(0);
      if (letter && /^[a-zA-Z]$/.test(letter)) {
        return letter.toUpperCase();
      }
    } catch {
      // 拼音转换失败，继续 fallback
    }
  }

  // 5. 其他情况（emoji、特殊符号等） → 试 userId
  if (userId) {
    const fromUserId = getLetterFromUserId(userId);
    if (fromUserId) return fromUserId;
  }

  // 6. 最终 fallback
  return fallback;
}

/**
 * 从 Matrix userId 提取首字母（如 "@manager:server" → 'M'）
 */
function getLetterFromUserId(userId: string): string | null {
  const match = userId.match(/^@?([a-zA-Z])/);
  return match ? match[1].toUpperCase() : null;
}
```

### 4.4 单元测试用例（强烈建议写）

```typescript
// packages/ui/src/avatar/__tests__/getDefaultAvatarLetter.test.ts
import { describe, it, expect } from 'vitest';
import { getDefaultAvatarLetter } from '../getDefaultAvatarLetter';

describe('getDefaultAvatarLetter', () => {
  // 英文
  it('英文名取首字母大写', () => {
    expect(getDefaultAvatarLetter('Manager', true)).toBe('M');
    expect(getDefaultAvatarLetter('alice', false)).toBe('A');
  });

  // 中文 → 拼音
  it('中文名取拼音首字母', () => {
    expect(getDefaultAvatarLetter('岛风', false)).toBe('D');
    expect(getDefaultAvatarLetter('李明', false)).toBe('L');
    expect(getDefaultAvatarLetter('张三', true)).toBe('Z');
    expect(getDefaultAvatarLetter('王小二', false)).toBe('W');
  });

  // 数字 → Agent 用 A，真人用 H
  it('数字开头：Agent 用 A，真人用 H', () => {
    expect(getDefaultAvatarLetter('123agent', true)).toBe('A');
    expect(getDefaultAvatarLetter('123user', false)).toBe('H');
  });

  // 空字符串 / 仅空白
  it('空字符串 fallback 正确', () => {
    expect(getDefaultAvatarLetter('', true)).toBe('A');
    expect(getDefaultAvatarLetter('', false)).toBe('H');
    expect(getDefaultAvatarLetter('   ', true)).toBe('A');
  });

  // emoji 开头 → 试 userId → fallback
  it('emoji 开头 fallback 到 userId', () => {
    expect(getDefaultAvatarLetter('💕manager', true, '@manager:server')).toBe('M');
    expect(getDefaultAvatarLetter('💕', false, '@xiaoai:server')).toBe('X');
    // 都没有 → fallback
    expect(getDefaultAvatarLetter('💕', true)).toBe('A');
    expect(getDefaultAvatarLetter('💕', false)).toBe('H');
  });

  // 复合场景
  it('真实使用场景', () => {
    expect(getDefaultAvatarLetter('manager 💕', true)).toBe('M');
    expect(getDefaultAvatarLetter('Worker: JFK_Defense', true)).toBe('W');
    expect(getDefaultAvatarLetter('admin', false)).toBe('A');
  });
});
```

---

## 5. LetterAvatar 组件

```tsx
// packages/ui/src/avatar/LetterAvatar.tsx
import { useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { getDefaultAvatarLetter } from './getDefaultAvatarLetter';

// ⭐ 静态导入 26 × 2 = 52 个字母图标
// Vite/Webpack 都会做静态资源处理
import lightA from '../assets/letters/light/A.png';
import lightB from '../assets/letters/light/B.png';
import lightC from '../assets/letters/light/C.png';
import lightD from '../assets/letters/light/D.png';
import lightE from '../assets/letters/light/E.png';
import lightF from '../assets/letters/light/F.png';
import lightG from '../assets/letters/light/G.png';
import lightH from '../assets/letters/light/H.png';
import lightI from '../assets/letters/light/I.png';
import lightJ from '../assets/letters/light/J.png';
import lightK from '../assets/letters/light/K.png';
import lightL from '../assets/letters/light/L.png';
import lightM from '../assets/letters/light/M.png';
import lightN from '../assets/letters/light/N.png';
import lightO from '../assets/letters/light/O.png';
import lightP from '../assets/letters/light/P.png';
import lightQ from '../assets/letters/light/Q.png';
import lightR from '../assets/letters/light/R.png';
import lightS from '../assets/letters/light/S.png';
import lightT from '../assets/letters/light/T.png';
import lightU from '../assets/letters/light/U.png';
import lightV from '../assets/letters/light/V.png';
import lightW from '../assets/letters/light/W.png';
import lightX from '../assets/letters/light/X.png';
import lightY from '../assets/letters/light/Y.png';
import lightZ from '../assets/letters/light/Z.png';

import darkA from '../assets/letters/dark/A.png';
import darkB from '../assets/letters/dark/B.png';
import darkC from '../assets/letters/dark/C.png';
import darkD from '../assets/letters/dark/D.png';
import darkE from '../assets/letters/dark/E.png';
import darkF from '../assets/letters/dark/F.png';
import darkG from '../assets/letters/dark/G.png';
import darkH from '../assets/letters/dark/H.png';
import darkI from '../assets/letters/dark/I.png';
import darkJ from '../assets/letters/dark/J.png';
import darkK from '../assets/letters/dark/K.png';
import darkL from '../assets/letters/dark/L.png';
import darkM from '../assets/letters/dark/M.png';
import darkN from '../assets/letters/dark/N.png';
import darkO from '../assets/letters/dark/O.png';
import darkP from '../assets/letters/dark/P.png';
import darkQ from '../assets/letters/dark/Q.png';
import darkR from '../assets/letters/dark/R.png';
import darkS from '../assets/letters/dark/S.png';
import darkT from '../assets/letters/dark/T.png';
import darkU from '../assets/letters/dark/U.png';
import darkV from '../assets/letters/dark/V.png';
import darkW from '../assets/letters/dark/W.png';
import darkX from '../assets/letters/dark/X.png';
import darkY from '../assets/letters/dark/Y.png';
import darkZ from '../assets/letters/dark/Z.png';

const LIGHT_LETTERS: Record<string, string> = {
  A: lightA, B: lightB, C: lightC, D: lightD, E: lightE,
  F: lightF, G: lightG, H: lightH, I: lightI, J: lightJ,
  K: lightK, L: lightL, M: lightM, N: lightN, O: lightO,
  P: lightP, Q: lightQ, R: lightR, S: lightS, T: lightT,
  U: lightU, V: lightV, W: lightW, X: lightX, Y: lightY,
  Z: lightZ,
};

const DARK_LETTERS: Record<string, string> = {
  A: darkA, B: darkB, C: darkC, D: darkD, E: darkE,
  F: darkF, G: darkG, H: darkH, I: darkI, J: darkJ,
  K: darkK, L: darkL, M: darkM, N: darkN, O: darkO,
  P: darkP, Q: darkQ, R: darkR, S: darkS, T: darkT,
  U: darkU, V: darkV, W: darkW, X: darkX, Y: darkY,
  Z: darkZ,
};

interface LetterAvatarProps {
  name: string;
  userId?: string;
  isAgent: boolean;       // ⭐ 必传：用于数字 fallback 区分
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * 默认头像组件
 *
 * 字母选择规则（详见 getDefaultAvatarLetter）：
 * - 英文 → 首字母
 * - 中文 → 拼音首字母（"岛风" → D）
 * - 数字 → Agent: A, 真人: H
 * - 其他 → 试 userId → fallback (Agent: A, 真人: H)
 *
 * 主题：根据当前 data-theme 自动选择 light/dark 版本
 */
export function LetterAvatar({
  name,
  userId,
  isAgent,
  size = 36,
  className = '',
  alt,
}: LetterAvatarProps) {
  const theme = useTheme();

  const letter = useMemo(
    () => getDefaultAvatarLetter(name, isAgent, userId),
    [name, isAgent, userId]
  );

  const map = theme === 'dark' ? DARK_LETTERS : LIGHT_LETTERS;
  const letterUrl = map[letter] ?? map.A;

  return (
    <img
      src={letterUrl}
      alt={alt ?? name}
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
      }}
      draggable={false}
    />
  );
}
```

---

## 6. App Icon 替换

### 6.1 OS 级图标（Electron 构建配置）

修改 `apps/desktop/electron-builder.yml`（或 package.json 的 build 字段）：

```yaml
mac:
  icon: build/icon.icns
win:
  icon: build/icon.ico
linux:
  icon: build/icon.png
```

修改 `apps/desktop/src/main/index.ts`，BrowserWindow 创建时显式指定 icon（Linux 必需，macOS/Windows 由 build 字段处理）：

```typescript
import { join } from "path";
import icon from "../../resources/icon-light.png?asset";  // OS 级用 light 版本

const mainWindow = new BrowserWindow({
  // ... 现有配置
  icon: process.platform === "linux" ? icon : undefined,
});
```

### 6.2 应用内 Logo（跟随主题）

创建 `packages/ui/src/branding/MagicAppIcon.tsx`：

```tsx
import { useTheme } from '../hooks/useTheme';
import iconLight from '../assets/app-icon/icon-light.png';
import iconDark from '../assets/app-icon/icon-dark.png';

interface MagicAppIconProps {
  size?: number;
  className?: string;
}

/**
 * Magic App 图标 — 自动跟随主题切换浅色/深色版本
 * 用于左上角 logo、设置页面、关于对话框等所有应用内出现的地方
 */
export function MagicAppIcon({ size = 32, className = '' }: MagicAppIconProps) {
  const theme = useTheme();
  const src = theme === 'dark' ? iconDark : iconLight;

  return (
    <img
      src={src}
      alt="Magic"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  );
}
```

### 6.3 Web favicon 主题适配（可选）

修改 `apps/web/index.html`：

```html
<link rel="icon" type="image/png" href="/favicon-light.png" media="(prefers-color-scheme: light)" />
<link rel="icon" type="image/png" href="/favicon-dark.png" media="(prefers-color-scheme: dark)" />
<link rel="icon" type="image/png" href="/favicon.png" />  <!-- fallback -->
<link rel="apple-touch-icon" href="/favicon.png" />
```

---

## 7. 替换现有的默认头像渲染

### 7.1 找出所有渲染默认头像的地方

```bash
# 找当前的头像组件
grep -rn "PrincipalAvatar\|UserAvatar\|MemberAvatar\|Avatar" packages/ui/src/ --include="*.tsx" | head -30

# 找内联生成首字母 + 渐变背景的代码
grep -rn "getInitial\|charAt(0)\|substring(0,\s*1)\|\.slice(0,\s*1)" packages/ui/src/ --include="*.tsx"

# 找渐变头像样式
grep -rn "background.*linear-gradient.*#6C5CE7" packages/ui/src/ --include="*.tsx"
```

⚠️ Claude Code 执行这些命令后**先把找到的清单告诉我**，再决定哪些要替换。

### 7.2 改造现有头像组件

假设现有有一个 `PrincipalAvatar` 组件，改造为：

```tsx
// packages/ui/src/avatar/PrincipalAvatar.tsx
import { LetterAvatar } from './LetterAvatar';

interface PrincipalAvatarProps {
  user: {
    userId: string;
    displayName?: string;
    avatarUrl?: string | null;  // 用户上传的自定义头像
  };
  isAgent: boolean;
  size?: number;
  className?: string;
}

export function PrincipalAvatar({ user, isAgent, size = 36, className }: PrincipalAvatarProps) {
  // 1. 如果用户上传了自定义头像，优先用它
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName ?? user.userId}
        width={size}
        height={size}
        className={`shrink-0 rounded-full ${className ?? ''}`}
        style={{ width: size, height: size, objectFit: 'cover' }}
        draggable={false}
      />
    );
  }

  // 2. 否则用字母图标
  return (
    <LetterAvatar
      name={user.displayName ?? user.userId}
      userId={user.userId}
      isAgent={isAgent}
      size={size}
      className={className}
    />
  );
}
```

### 7.3 内联使用首字母+渐变的地方

找到所有手动写"渐变背景 + 首字符 div"的地方（房间列表、消息气泡、成员面板等），替换为 `<LetterAvatar>` 或 `<PrincipalAvatar>`。

⚠️ 关键：**调用方需要传 `isAgent`**。如果调用方还不知道是否是 Agent，需要先确定它（参考项目里现有的 Agent 判断逻辑——三层 fallback：HiClaw CRD API → agentStore → 用户名模式匹配）。

如果项目已有现成的 `useIsAgent(userId)` hook，复用；如无，简单规则：

```typescript
function isAgentUser(userId: string, displayName: string): boolean {
  // 简单判断：根据用户名前缀（项目里 Agent 通常以特定前缀命名）
  // 如果项目里有更精确的判断，使用项目的逻辑
  return /^(@?Worker:|@?manager|@?xiaoai|@?jobfinder|@?hiclawpm)/i.test(userId)
      || /^(Worker:|manager|xiaoai)/i.test(displayName);
}
```

执行前用 `grep -rn "isAgent\|agentStore\|workerStore" packages/` 检查项目里已有的判断方式。

### 7.4 更新 Magic App 图标使用处

替换左上角 workspace 切换器、设置页 logo 等位置：

```bash
# 找出所有使用 Magic logo 的地方
grep -rn "Magic\|magic.*logo\|workspace.*icon" packages/ui/src/ --include="*.tsx" | head
```

替换为 `<MagicAppIcon size={...} />`。

---

## 8. 实现任务（按执行顺序）

### 任务 1：素材就位检查

**Claude Code 在动手前先确认**：

```bash
ls -la apps/desktop/build/icon.{png,ico,icns} 2>/dev/null
ls -la apps/desktop/resources/icon-{light,dark}.png 2>/dev/null
ls -la packages/ui/src/assets/app-icon/icon-{light,dark}.png 2>/dev/null
ls -la packages/ui/src/assets/letters/light/A.png 2>/dev/null
ls -la packages/ui/src/assets/letters/dark/A.png 2>/dev/null
```

如果任何文件不存在，停下来告诉我，由我来准备。

---

### 任务 2：安装 pinyin-pro 依赖

```bash
pnpm add pinyin-pro -F @magic/ui
```

**验证**：`pnpm typecheck`

---

### 任务 3：useTheme Hook

**先 grep**：`grep -rn "useTheme" packages/ui/src/`

- 如果已存在，跳过此任务
- 如果不存在，按 §3.1 创建 `packages/ui/src/hooks/useTheme.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：getDefaultAvatarLetter 函数 + 单元测试

**创建文件**：
- `packages/ui/src/avatar/getDefaultAvatarLetter.ts`（按 §4.3）
- `packages/ui/src/avatar/__tests__/getDefaultAvatarLetter.test.ts`（按 §4.4）

**验证**：
```bash
pnpm typecheck
pnpm test getDefaultAvatarLetter   # 所有测试用例必须通过
```

⭐ 这一步的测试**必须全部通过**才能继续。这是整个功能的核心逻辑。

---

### 任务 5：LetterAvatar 组件

**创建文件**：`packages/ui/src/avatar/LetterAvatar.tsx`（按 §5）

⚠️ 52 个 import 语句一次写完，不要简化。

**验证**：`pnpm typecheck`

---

### 任务 6：MagicAppIcon 组件

**创建文件**：`packages/ui/src/branding/MagicAppIcon.tsx`（按 §6.2）

**验证**：`pnpm typecheck`

---

### 任务 7：找出现有头像组件并改造

按 §7.1 的 grep 命令找出现有头像渲染清单，**告诉我清单**，我确认后再做改造。

改造方式按 §7.2 + §7.3。

**验证**：`pnpm typecheck && pnpm dev:desktop` 看视觉效果

---

### 任务 8：替换 Magic App 图标使用处

按 §7.4 找到所有使用 Magic logo 的地方，替换为 `<MagicAppIcon>`。

**验证**：`pnpm typecheck && pnpm dev:desktop`

---

### 任务 9：OS 级图标配置

按 §6.1 配置 electron-builder 和主进程。

**验证**：
```bash
pnpm build:desktop
# 在产物中查看 icon 是新的
```

---

### 任务 10：Web favicon

按 §6.3 修改 `apps/web/index.html`。

**验证**：
```bash
pnpm dev:web
# 浏览器标签页应显示新 favicon
```

---

### 任务 11：导出 + 全局验证

**修改文件**：`packages/ui/src/index.ts`

```typescript
export { LetterAvatar } from './avatar/LetterAvatar';
export { PrincipalAvatar } from './avatar/PrincipalAvatar';
export { MagicAppIcon } from './branding/MagicAppIcon';
export { getDefaultAvatarLetter } from './avatar/getDefaultAvatarLetter';
export { useTheme } from './hooks/useTheme';
```

**最终验证**：
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop
```

---

## 9. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 打开 Magic Desktop，dock/任务栏图标是新的 Magic App Icon | 视觉检查 |
| AC-2 | 应用左上角的 logo 是新的 Magic App Icon | 视觉检查 |
| AC-3 | **切换深色/浅色主题**，应用内 Magic logo 自动切换浅色/深色版本 ⭐ | 切换主题验证 |
| AC-4 | 房间列表中，没有自定义头像的 Agent/真人显示字母图标 | 视觉检查 |
| AC-5 | 名字 "Manager" 显示字母 M 图标 | 视觉检查 |
| AC-6 | **名字 "岛风 💕" 显示字母 D 图标**（拼音首字母）⭐ | 视觉检查 |
| AC-7 | **名字 "李明" 显示字母 L 图标** ⭐ | 视觉检查 |
| AC-8 | **名字 "123agent" 的 Agent 显示字母 A** ⭐ | 视觉检查 |
| AC-9 | **名字 "123user" 的真人显示字母 H** ⭐ | 视觉检查 |
| AC-10 | 名字 "💕manager"（emoji 开头）显示字母 M（fallback userId） | 视觉检查 |
| AC-11 | **切换深色/浅色主题**，字母头像自动切换浅色/深色版本 ⭐ | 切换主题验证 |
| AC-12 | 用户已上传自定义头像的，仍显示自定义头像（不被字母覆盖） | 检查至少一个有头像的用户 |
| AC-13 | 聊天消息中的发送者头像也使用字母图标 | 视觉检查 |
| AC-14 | 成员面板中的头像也使用字母图标 | 视觉检查 |
| AC-15 | 房间列表中的私聊头像也使用字母图标 | 视觉检查 |
| AC-16 | `pnpm test` 中 `getDefaultAvatarLetter` 测试全部通过 | 命令验证 |
| AC-17 | `pnpm typecheck && pnpm lint && pnpm build` 全部通过 | 命令验证 |
| AC-18 | Web 端 favicon 是新的 Magic 图标 | 浏览器检查 |

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 拼音库引入增加 bundle 体积 | 首屏变慢 | pinyin-pro 已经是最轻量方案（~80KB gzipped），可接受 |
| 多音字拼音不准（如 "重庆" 应是 C 不是 Z） | 字母不对 | 限制：本 spec 只取首字符的常用拼音；多音字属于已知限制，可在 v2 加入字典 |
| 52 个 PNG 静态导入增加 bundle | 首次加载变大 | Vite 默认会做代码分割，未使用的字母不会立即加载；但首屏可能加载常用字母 |
| OS 级图标在 macOS 缓存难刷新 | 开发时看不到新图标 | 重启 Dock：`killall Dock`；或换用户重新登录 |
| 用户名为空字符串 | 渲染错误 | getDefaultAvatarLetter 已处理，fallback 到 A/H |
| 项目里 Agent 判断逻辑不一致 | 数字 fallback 错乱 | 任务 7 中**必须**先用 grep 找到项目里现成的 isAgent 判断，统一调用，不要自己写新的 |
| SVG vs PNG 格式不匹配 | import 路径错 | spec 默认 PNG；如用户提供 SVG，全局把 .png 改 .svg 即可 |

---

## 11. 后续优化（v2，本 spec 不实现）

- 多音字字典支持（"重庆" → C，"乐山" → L）
- 字母图标按用户身份生成不同颜色（区分 Agent / 真人 / 自己）
- 用户在设置中可选"使用首字母 / 使用 Identicon / 使用渐变"等头像风格
- 群聊头像聚合（多个成员的字母头像组合）