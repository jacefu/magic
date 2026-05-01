# 设计规范：MAGIC Client 视觉系统

> 类型: 全局补充 | 适用于: 所有 UI spec（005-013+）| 参考风格: Discord 2025 Onyx 主题
> 文件路径: `specs/shared/design-system.md`

---

## 1. 设计理念

MAGIC Client 的视觉风格对齐 Discord 2025 桌面端重设计（Onyx 主题），核心特征：

- **深色优先**：以近黑色为基底，通过 4-5 层灰度层次建立空间层级
- **高对比度**：文字与背景的对比度 ≥ 4.5:1（WCAG AA 标准）
- **大圆角**：所有容器和交互元素使用圆角，避免尖锐边缘
- **紧凑但有呼吸**：信息密度高，但通过精确的间距保持可读性
- **品牌色克制**：Blurple（#5865F2）仅用于主要操作和选中态，不滥用

---

## 2. 色板

### 2.1 背景层级（从深到浅）

| 用途 | CSS 变量 | HEX | 说明 |
|------|---------|-----|------|
| 最底层（工作区栏） | `--bg-tertiary` | `#1E1F22` | 最深，视觉最远 |
| 侧边栏 / 右侧面板 | `--bg-secondary` | `#2B2D31` | 次深层 |
| 聊天区主体 | `--bg-primary` | `#313338` | 主内容区 |
| 输入框 / 悬浮卡片 | `--bg-modifier` | `#383A40` | 略浅于主体 |
| Hover 状态 | `--bg-hover` | `#35373C` | 鼠标悬浮 |
| Active / 选中状态 | `--bg-active` | `#404249` | 选中高亮 |
| 用户面板 | `--bg-user-panel` | `#232428` | 底部用户面板 |

### 2.2 文字层级

| 用途 | CSS 变量 | HEX | 说明 |
|------|---------|-----|------|
| 正文 / 主要文字 | `--text-normal` | `#DBDEE1` | 消息内容、标题 |
| 次要文字 | `--text-muted` | `#949BA4` | 房间名、分类标题、时间戳 |
| 辅助文字 / 占位 | `--text-faint` | `#6D6F78` | placeholder、禁用态 |
| 链接 / 可交互文字 | `--text-link` | `#00A8FC` | 超链接 |

### 2.3 品牌色与语义色

| 用途 | CSS 变量 | HEX | 说明 |
|------|---------|-----|------|
| 品牌主色（Blurple） | `--brand` | `#5865F2` | 按钮、选中态、活跃指示 |
| 品牌 Hover | `--brand-hover` | `#4752C4` | 品牌色按钮悬浮 |
| 成功 / 在线 | `--green` | `#23A55A` | 在线状态、成功提示 |
| 警告 / 空闲 | `--yellow` | `#F0B232` | 空闲状态、警告 |
| 危险 / 错误 | `--red` | `#F23F43` | 错误、未读@提及、离线异常 |
| 信息 | `--blue-info` | `#5865F2` | 信息提示（同品牌色） |

### 2.4 分隔线与边框

| 用途 | CSS 变量 | HEX |
|------|---------|-----|
| 分隔线 / 边框 | `--divider` | `#3F4147` |
| 轻分隔 | `--divider-light` | `#3B3D44` |

### 2.5 @Mention 高亮色

| 状态 | 背景 | 文字 |
|------|------|------|
| 默认 | `rgba(88,101,242,0.25)` | `#C9CDFB` |
| Hover | `rgba(88,101,242,0.45)` | `#FFFFFF` |
| 提及自己 | `rgba(88,101,242,0.35)` | `#FFFFFF` |

---

## 3. 字体

### 3.1 字体栈

```css
--font-primary: "gg sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-code: "Consolas", "Monaco", "Noto Sans Mono", monospace;
--font-display: "gg sans", "Noto Sans SC", sans-serif;
```

> "gg sans" 是 Discord 的专属字体，MAGIC Client 实际使用时以 "Inter" 替代（MIT 许可），中文回退到 "Noto Sans SC" / "PingFang SC"。

### 3.2 字号与行高

| 用途 | 字号 | 行高 | 字重 | 对应 CSS 变量 |
|------|------|------|------|-------------|
| 频道名 / 聊天头部 | 14px | 1.25 | 600 | `--font-size-md` |
| 消息正文 | 13.5px | 1.45 | 400 | `--font-size-body` |
| 房间列表项 | 13px | 1.375 | 500 | `--font-size-sm` |
| 分类标题（大写） | 10.5px | 1.3 | 700 | `--font-size-xs` |
| 时间戳 / 辅助 | 10.5px | 1.3 | 400 | `--font-size-xs` |
| 消息发送者名 | 13px | 1.25 | 600 | `--font-size-sm` |
| Badge 文字 | 10px | 1 | 700 | `--font-size-xxs` |
| 分类标题 | 10.5px | 1.3 | 700 | `--font-size-xs` |

### 3.3 字体规则

- 分类标题（如"AGENT 团队"）使用 `text-transform: uppercase` + `letter-spacing: 0.04em`
- 消息正文禁止使用 `font-weight: 700`，最重为 `600`（发送者名）
- 代码片段使用 `--font-code`，背景为 `--bg-secondary`，padding `1px 5px`，圆角 `4px`

---

## 4. 布局结构

### 4.1 四栏布局

```
┌──────┬──────────┬───────────────────────────┬──────────┐
│ 56px │  200px   │          弹性             │  200px   │
│      │          │        (min 480px)         │ (可收起)  │
│ 工作  │  房间    │         聊天区              │  成员    │
│ 区栏  │  列表    │                            │  面板    │
│      │          │  ┌───────────────────┐     │          │
│      │          │  │ 聊天头部 (40px)    │     │          │
│      │          │  ├───────────────────┤     │          │
│      │          │  │                   │     │          │
│      │          │  │   消息时间线        │     │          │
│      │          │  │   (弹性高度)       │     │          │
│      │          │  │                   │     │          │
│      │          │  ├───────────────────┤     │          │
│      │          │  │ 消息编辑器         │     │          │
│      │          │  └───────────────────┘     │          │
│      │          │                            │          │
│      ├──────────┤                            │          │
│      │ 用户面板  │                            │          │
│      │ (52px)   │                            │          │
└──────┴──────────┴───────────────────────────┴──────────┘
```

### 4.2 各栏规格

| 栏位 | 宽度 | 背景色 | 可调整 | 说明 |
|------|------|--------|--------|------|
| 工作区栏 | 56px 固定 | `--bg-tertiary` | 否 | 圆形图标，48px icon，垂直排列 |
| 房间列表 | 200px 默认 | `--bg-secondary` | 后续可拖拽 | 最小 160px，最大 300px |
| 聊天区 | 弹性填充 | `--bg-primary` | 自动 | 最小宽度 480px |
| 成员/Agent 面板 | 200px | `--bg-secondary` | 可收起 | 点击头部按钮切换显示 |

### 4.3 高度规格

| 区域 | 高度 | 说明 |
|------|------|------|
| 聊天头部 | 40px | 固定，含房间名 + 话题 + 操作按钮 |
| 用户面板 | 52px | 固定，底部贴合 |
| 消息编辑器 | 动态 | 最小 52px（单行），最大 ~160px（6 行） |
| 时间线 | 弹性 | 填充剩余空间 |

---

## 5. 圆角系统

| 元素 | 圆角 | CSS 变量 |
|------|------|---------|
| 工作区图标（默认） | 50%（圆形） | `--radius-full` |
| 工作区图标（选中/悬浮） | 12px | `--radius-lg` |
| 房间列表项 | 6px | `--radius-sm` |
| 消息编辑器 | 8px | `--radius-md` |
| 弹窗 / 对话框 | 12px | `--radius-lg` |
| Badge | 8px（半圆） | `--radius-full` |
| 代码块 | 4px | `--radius-xs` |
| 用户头像 | 50%（圆形） | `--radius-full` |
| 按钮 | 4px | `--radius-xs` |
| 卡片容器 | 8px | `--radius-md` |

---

## 6. 间距系统

基于 4px 栅格：

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 4px | 内部微调 |
| `--space-2` | 8px | 图标间距、Badge 内边距 |
| `--space-3` | 12px | 列表项内边距、消息分组间距 |
| `--space-4` | 16px | 消息水平边距、区域间距 |
| `--space-5` | 20px | 大区域间距 |
| `--space-6` | 24px | 分组间距 |

### 6.1 关键间距规则

- 消息组间距：同一发送者连续消息 `2px`，不同发送者 `12px`
- 消息头像与内容：`12px` 水平间距
- 房间列表项：`5px 10px` 内边距，列表项间 `1px`
- 分类标题：上方 `16px`，下方 `4px`
- 编辑器内边距：`8px 12px`

---

## 7. 核心组件规范

### 7.1 工作区图标（Server Icon）

```
┌────────┐
│        │  默认：48px × 48px 圆形 (border-radius: 50%)
│   M    │  选中/悬浮：48px × 48px 方圆 (border-radius: 12px)
│        │  背景：--bg-primary 或角色色
│        │  文字：16px 600weight
└────────┘  左侧指示条：选中时显示 4px × 8px 白色半圆
            分隔线：28px × 2px --divider 色
```

- 工作区图标默认圆形，悬浮和选中时过渡为 `border-radius: 12px`（Discord 标志性动效）
- 选中的工作区左侧显示一个白色小条（4px 宽，8px 高，圆角）
- 未读通知：右下角显示红色数字 badge
- 过渡动画：`transition: border-radius 0.2s ease, background 0.15s ease`

### 7.2 房间列表项（Channel Item）

```
┌─ 6px 圆角 ──────────────────────────────┐
│ # frontend-team                    [3] │  高度：30px
│                                         │  padding: 5px 10px
└─────────────────────────────────────────┘  margin: 1px 6px (左右缩进)
```

| 状态 | 文字色 | 背景色 | 说明 |
|------|--------|--------|------|
| 默认 | `--text-muted` | 透明 | |
| 悬浮 | `--text-normal` | `--bg-hover` | |
| 选中 | `#FFFFFF` | `--bg-active` | 文字变白 |
| 未读 | `--text-normal` | 透明 | 字重变 600，无背景变化 |

- `#` 前缀图标：`16px`，`opacity: 0.6`
- 私聊项用状态点（8px 圆形）替代 `#`
- 未读 Badge：右侧对齐，最小 16px 宽度，红色（@提及）或灰色（普通未读）

### 7.3 消息气泡（Message Group）

MAGIC Client 使用 Discord 的**非气泡式**消息布局——消息不使用背景色气泡包裹，而是通过缩进和分组表达层级：

```
┌──────────────────────────────────────────────────────┐
│ [Avatar 36px]  发送者名 (彩色)  AGENT标签  10:23      │
│                消息内容第一行                           │
│                消息内容第二行                           │
│                                                       │
│       (12px gap)                                      │
│                                                       │
│ [Avatar 36px]  另一发送者  10:25                       │
│                另一条消息                               │
└──────────────────────────────────────────────────────┘
  padding: 2px 16px
  hover 时整条消息背景变为 --bg-hover
```

#### 消息组规则

- **头像**：36px 圆形，与第一行顶部对齐
- **发送者名**：13px，font-weight 600，**使用角色色**（见 7.8 角色色）
- **Agent 标签**：紧跟发送者名，`9px`，font-weight 700，`padding: 1px 4px`，圆角 3px
  - Agent 类型标签：`background: rgba(88,101,242,0.25); color: #A5B0FC`
  - Hermes 运行时标签：`background: rgba(237,66,69,0.25); color: #F47B67`
  - QwenPaw 运行时标签：`background: rgba(35,165,90,0.25); color: #57F287`
- **时间戳**：10.5px，`--text-faint`，baseline 对齐发送者名
- **消息内容**：13.5px，`--text-normal`，行高 1.45
- **同人连续消息**：5 分钟内同一发送者的后续消息不显示头像和名称，头像位置留白（36px + 12px gap = 48px 缩进）
- **不同发送者间距**：`margin-top: 12px`
- **Hover**：整个消息组（含头像）背景变为 `--bg-hover`

### 7.4 消息编辑器（Composer）

```
┌── 8px 圆角 ───────────────────────────────────────────┐
│ [+]  发消息到 #frontend-team                          │  背景：--bg-modifier
│                                                       │  padding: 8px 12px
└───────────────────────────────────────────────────────┘
  支持 Markdown · Enter 发送 · Shift+Enter 换行           ← 提示文字 12px --text-faint
```

- 附件按钮 `+`：左侧，20px，`--text-muted`，悬浮变 `--text-normal`
- 输入区：弹性宽度，`13px`，placeholder 色为 `--text-faint`
- 底部提示：编辑器下方 4px，`12px`，`--text-faint`

### 7.5 日期分隔线

```
────────────────── 今天 ──────────────────
```

- 线条：`1px solid --divider`
- 文字：`10.5px`，font-weight 700，`--text-muted`
- 左右各一条线，文字居中，水平 padding `16px`

### 7.6 未读 Badge

| 类型 | 背景 | 字号 | 最小尺寸 | 用途 |
|------|------|------|---------|------|
| @提及 / 高优先级 | `--red` (#F23F43) | 10px bold | 16px × 16px | 有人 @你 |
| 普通未读 | `--text-faint` (#6D6F78) | 10px bold | 16px × 16px | 普通新消息 |
| 数字溢出 | 同上 | 同上 | 显示 "99+" | 超过 99 条 |

- `padding: 0 4px`，`border-radius: 8px`（半圆），文字白色居中
- 无未读时隐藏（不显示 0）

### 7.7 状态指示点

| 状态 | 颜色 | 大小 | 动画 |
|------|------|------|------|
| 在线 / 活跃 | `--green` (#23A55A) | 8px | 可选脉冲 |
| 空闲 | `--yellow` (#F0B232) | 8px | 无 |
| 离线 | `--text-faint` (#6D6F78) | 8px | 无 |
| 异常 / 勿扰 | `--red` (#F23F43) | 8px | 无 |

- 在成员头像右下角时：外围 2px 与父级背景色同色的描边环（模拟"剪裁"效果）
- 在房间列表中：8px 直接显示，无描边环

### 7.8 角色色（Role Colors）

Discord 中每个用户的名称颜色由其最高角色决定。MAGIC Client 中预设以下角色色：

| 角色 | 颜色 | HEX | 用途 |
|------|------|-----|------|
| Admin / Manager | 蓝紫色 | `#A5B0FC` | 管理员在消息中的名称色 |
| Worker Agent (OpenClaw) | 绿色 | `#57F287` | OpenClaw Worker 名称色 |
| Worker Agent (Hermes) | 珊瑚色 | `#F47B67` | Hermes Worker 名称色 |
| Worker Agent (QwenPaw) | 金色 | `#F0B232` | QwenPaw Worker 名称色 |
| Human User | 白色 | `#DBDEE1` | 默认真人用户名称色 |
| Team Leader | 青色 | `#1ABC9C` | Team 中的 Leader Agent |

### 7.9 对话框 / 弹窗（Modal）

```
┌── 12px 圆角 ──────────────────────┐
│ 标题                          [×] │  背景：--bg-primary
│───────────────────────────────────│  宽度：max 440px
│                                   │  padding: 16px 20px
│  内容区域                          │
│                                   │
│  ┌─────────┐  ┌─────────────────┐│
│  │  取消    │  │  确认（品牌色）   ││
│  └─────────┘  └─────────────────┘│
└───────────────────────────────────┘
  遮罩层：rgba(0, 0, 0, 0.6)
```

- 遮罩背景：`rgba(0, 0, 0, 0.6)`
- 对话框背景：`--bg-primary`
- 标题：16px，font-weight 600
- 按钮区：右对齐，间距 8px
- 主要按钮：`--brand` 背景，白色文字，圆角 4px
- 次要按钮：透明背景，`--text-normal` 文字

### 7.10 成员面板（Member List）

```
成员 — 5
─────────────────────
在线 — 3                  ← 分类标题：10.5px 大写 --text-muted
 [●] JaceFu              ← 28px 头像 + 12.5px 名称
 [●] worker-alice AGENT  ← Agent 带标签
 [●] hermes-coder HERMES
─────────────────────
离线 — 2
 [○] worker-bob
 [○] qwenpaw-lite
```

- 头像：28px 圆形
- 名称：12.5px，默认 `--text-muted`，悬浮 `--text-normal`
- Agent 名称使用角色色
- 分类标题与 Discord 频道分类标题样式一致

---

## 8. 交互模式

### 8.1 悬浮与选中

| 元素 | Hover | Active/Selected |
|------|-------|----------------|
| 房间列表项 | `bg: --bg-hover, color: --text-normal` | `bg: --bg-active, color: #fff` |
| 消息组 | `bg: --bg-hover`（整行） | 无 |
| 成员列表项 | `bg: --bg-hover` | 无 |
| 工作区图标 | `border-radius: 50%→12px` | `bg: --brand, border-radius: 12px` |
| 按钮（品牌色） | `bg: --brand-hover` | `transform: scale(0.98)` |

### 8.2 过渡动画

所有过渡使用统一的时间参数：

```css
--transition-fast: 0.1s ease;      /* hover 背景色变化 */
--transition-normal: 0.15s ease;   /* 颜色、透明度 */
--transition-slow: 0.2s ease;      /* border-radius、布局变化 */
```

- 工作区图标 border-radius 过渡：`0.2s ease`
- 消息 hover 背景：`0.1s ease`
- 弹窗出现：`0.15s ease` opacity + scale(0.98→1)

### 8.3 消息密度

Discord 提供三种消息密度，MAGIC Client 支持 Default 和 Compact 两种：

| 密度 | 消息组间距 | 头像大小 | 字号 |
|------|----------|---------|------|
| Default | 12px | 36px | 13.5px |
| Compact | 4px | 0（隐藏头像） | 13px |

Compact 模式下，时间戳移到消息左侧，发送者名内联。

---

## 9. Agent 专属设计元素

以下是 MAGIC Client 相对于 Discord 新增的设计元素，用于 Agent 协同场景：

### 9.1 Agent 运行时标签

紧跟发送者名称，在消息头部和成员列表中均显示：

| 运行时 | 标签文字 | 背景色 | 文字色 |
|--------|---------|--------|--------|
| OpenClaw | `AGENT` | `rgba(88,101,242,0.25)` | `#A5B0FC` |
| Hermes | `HERMES` | `rgba(237,66,69,0.25)` | `#F47B67` |
| QwenPaw | `QWENPAW` | `rgba(35,165,90,0.25)` | `#57F287` |
| Manager | `MANAGER` | `rgba(26,188,156,0.25)` | `#1ABC9C` |

标签样式：`font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; vertical-align: middle`

### 9.2 Agent 状态卡片

在 Agent 仪表盘面板中，每个 Agent 以卡片形式展示：

```
┌── 8px 圆角 ──────────────────────┐
│ [Avatar+StatusDot]  worker-alice │  边框：1px solid --divider
│                     claude-4     │  背景：--bg-secondary
│ ┌──────────────────────────────┐ │  padding: 12px
│ │ 当前任务                      │ │
│ │ Review LoginForm.tsx          │ │  ← 任务区：bg --bg-primary, 圆角 8px
│ └──────────────────────────────┘ │
│ [chat] [code-review] [+2]       │  ← 能力标签
└──────────────────────────────────┘
```

### 9.3 任务看板卡片

```
┌── 8px 圆角 ──── 左侧 2px 优先级色条 ──┐
│ Review 登录页面表单校验                   │  边框：1px solid --divider
│ → worker-alice              [高]        │  背景：--bg-secondary
│ 截止: 2026-05-15                        │  padding: 10px
└──────────────────────────────────────────┘
```

优先级色条：`border-left: 2px solid`
- 紧急：`--red`
- 高：`#F0B232`（amber）
- 中：`--brand`
- 低：`--text-faint`

---

## 10. Tailwind CSS v4 实现

### 10.1 替换现有 `@theme` 变量

将 001 spec 中的 `index.css` 更新为 Discord Onyx 色板：

```css
/* apps/desktop/src/renderer/src/index.css */
/* apps/web/src/index.css */
@import "tailwindcss";

@theme {
  /* 背景层级 */
  --color-bg-tertiary: #1E1F22;
  --color-bg-secondary: #2B2D31;
  --color-bg-primary: #313338;
  --color-bg-modifier: #383A40;
  --color-bg-hover: #35373C;
  --color-bg-active: #404249;
  --color-bg-user-panel: #232428;

  /* 文字 */
  --color-text-normal: #DBDEE1;
  --color-text-muted: #949BA4;
  --color-text-faint: #6D6F78;
  --color-text-link: #00A8FC;

  /* 品牌与语义 */
  --color-brand: #5865F2;
  --color-brand-hover: #4752C4;
  --color-green: #23A55A;
  --color-yellow: #F0B232;
  --color-red: #F23F43;

  /* 边框 */
  --color-divider: #3F4147;
  --color-divider-light: #3B3D44;

  /* 角色色 */
  --color-role-admin: #A5B0FC;
  --color-role-openclaw: #57F287;
  --color-role-hermes: #F47B67;
  --color-role-qwenpaw: #F0B232;
  --color-role-leader: #1ABC9C;

  /* 圆角 */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* 字体 */
  --font-sans: "Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "Consolas", "Monaco", "Noto Sans Mono", monospace;
}
```

### 10.2 Tailwind 工具类映射

常用组合的推荐写法（避免重复书写长串类名）：

```css
/* 可在全局 CSS 中定义 @apply 组合 */
@layer components {
  /* 房间列表项 */
  .room-item {
    @apply flex items-center gap-2 rounded-sm px-2.5 py-1.5 mx-1.5 cursor-pointer
           text-text-muted transition-colors duration-100
           hover:bg-bg-hover hover:text-text-normal;
  }
  .room-item-active {
    @apply bg-bg-active text-white;
  }

  /* 消息组 hover */
  .msg-group {
    @apply flex gap-3 px-4 py-0.5 hover:bg-bg-hover;
  }

  /* Agent 标签 */
  .agent-tag {
    @apply text-[9px] font-bold px-1 py-px rounded-sm align-middle ml-1;
  }

  /* Badge */
  .badge {
    @apply min-w-4 h-4 px-1 rounded-full text-[10px] font-bold
           flex items-center justify-center text-white;
  }
}
```

### 10.3 暗色模式说明

MAGIC Client **只有暗色模式**（与 Discord Onyx 一致）。不需要 `dark:` 前缀——所有颜色值直接定义为暗色。如果未来需要 Light 主题，通过 CSS 变量覆盖实现，不改动组件代码。

---

## 11. 实施清单

以下是将现有 spec 产出物对齐到本设计规范需要修改的内容：

### 11.1 立即修改（下一个 spec 执行前）

| 文件 | 变更 |
|------|------|
| `apps/desktop/src/renderer/src/index.css` | 替换 `@theme` 为 10.1 的 Discord Onyx 色板 |
| `apps/web/src/index.css` | 同上 |
| `CLAUDE.md` | 追加 `@specs/shared/design-system.md` 引用 |

### 11.2 组件对齐（在后续 spec 实现时逐步调整）

| 组件 | 原设计 | 对齐目标 |
|------|--------|---------|
| `RoomListItem` | 蓝色选中背景 | `--bg-active` 灰色选中 + 白色文字 |
| `MessageBubble` | 蓝色/灰色气泡 | **取消气泡**，改为 Discord 无气泡平铺 + hover 行高亮 |
| `RoomAvatar` | 固定圆形 | 群聊圆角方形 `12px`，私聊圆形 |
| `UnreadBadge` | 灰色 + 红色 | 对齐 7.6 Badge 规范 |
| `AgentStatusCard` | 自定义配色 | 对齐 9.2 卡片规范 |
| `LoginPage` | `--color-magic-*` 配色 | 使用 `--bg-tertiary` 全屏背景 + 居中卡片 |
| `MainLayout` | 两栏 | **四栏**（新增工作区栏 + 右侧面板结构化） |
| `ChatHeader` | 简单头部 | 对齐 Discord 头部（#频道名 + 话题 + 图标栏） |
| `MentionPill` | 蓝色标签 | 对齐 2.5 Mention 高亮色 |
| 所有文字色 | `text-white` / `text-gray-*` | 统一使用 `text-text-normal` / `text-text-muted` / `text-text-faint` |

### 11.3 新增组件（后续 spec）

| 组件 | 说明 |
|------|------|
| `WorkspaceBar` | 左侧 56px 工作区栏（Discord Server List 对应） |
| `WorkspaceIcon` | 圆形→方圆过渡的工作区图标 |
| `ChannelHeader` | Discord 风格的聊天头部（# + 名称 + 竖线 + 话题 + 图标） |

---

## 12. 参考

- Discord 2025 Desktop Redesign（Onyx/Ash/Dark/Light 四主题）
- Discord Brand Color: Blurple `#5865F2`
- Discord 新版配色：主背景 `#313338`，侧边栏 `#2B2D31`，最深层 `#1E1F22`
- 消息密度选项：Spacious / Default / Compact
- 圆角方向：所有容器和图标使用大圆角，2025 重设计后更加统一