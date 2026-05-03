# 设计规范：MAGIC Client 视觉系统

> 类型: 全局补充 | 适用于: 所有 UI spec | 设计语言: AI 时代宇宙感（Cosmic AI）
> 文件路径: `specs/shared/design-system.md`

---

## 1. 设计理念

MAGIC Client 的视觉语言融合 **Google Gemini 的渐变能量感** + **Glassmorphism 毛玻璃层次** + **Discord 的四栏布局效率**，打造属于 AI 协同时代的界面风格。

### 核心原则

- **渐变 = AI 能量**：渐变色（紫→青→翠）专属于 AI 元素（Agent 标签、AI 消息、选中态），真人元素保持朴素白色。用户一眼即可区分 AI 和真人内容
- **深空黑基底**：`#0F0F14` 微偏蓝的深空黑替代纯灰，营造宇宙感纵深
- **毛玻璃层次**：侧边栏和面板使用 `backdrop-filter: blur()` + 半透明背景，创造视觉层次而非扁平分割
- **微光与辉光**：在线状态点、选中边框、交互态使用柔和的 `box-shadow` 辉光，而非生硬的纯色切换
- **克制使用**：渐变和光效只用于关键元素（品牌、AI 标识、选中态），不滥用。90% 的界面仍然是安静的暗色

---

## 2. 色板

### 2.1 背景层级（深空黑体系）

| 用途 | CSS 变量 | 值 | 说明 |
|------|---------|-----|------|
| 最底层（工作区栏） | `--bg-deepest` | `rgba(12,12,18,0.95)` | 近乎纯黑，微偏蓝 |
| 侧边栏 / 右侧面板 | `--bg-glass` | `rgba(18,18,26,0.85)` | 毛玻璃底色，配合 `backdrop-filter: blur(20px)` |
| 聊天区主体 | `--bg-primary` | `rgba(15,15,21,0.95)` | 主内容区 |
| 输入框 / 卡片 | `--bg-surface` | `rgba(255,255,255,0.04)` | 极微白，区分层次 |
| Hover 状态 | `--bg-hover` | `rgba(255,255,255,0.03)` | 悬浮微亮 |
| Active / 选中状态 | `--bg-active` | 见 2.3 渐变选中 | 渐变半透明 |
| 用户面板 | `--bg-panel` | `rgba(12,12,18,0.6)` | 底部面板，配合 blur |

### 2.2 文字层级

| 用途 | CSS 变量 | 值 | 说明 |
|------|---------|-----|------|
| 主要文字 | `--text-primary` | `rgba(255,255,255,0.85)` | 消息内容、标题 |
| 次要文字 | `--text-secondary` | `rgba(255,255,255,0.4)` | 房间名、分类标题 |
| 辅助文字 | `--text-tertiary` | `rgba(255,255,255,0.2)` | 时间戳、placeholder |
| 禁用文字 | `--text-disabled` | `rgba(255,255,255,0.1)` | 提示、禁用态 |

### 2.3 品牌渐变（三色系统）

MAGIC 的品牌色不是单色，而是一条**三色渐变光谱**：

```
紫 #6C5CE7 → 青 #00B4D8 → 翠 #00F5A0
```

| 用途 | CSS 变量 | 值 |
|------|---------|-----|
| 品牌渐变（主方向） | `--gradient-brand` | `linear-gradient(135deg, #6C5CE7, #00B4D8, #00F5A0)` |
| 品牌渐变（水平） | `--gradient-brand-h` | `linear-gradient(90deg, #6C5CE7, #00B4D8, #00F5A0)` |
| 品牌渐变（垂直） | `--gradient-brand-v` | `linear-gradient(180deg, #6C5CE7, #00B4D8, #00F5A0)` |
| 按钮渐变 | `--gradient-button` | `linear-gradient(135deg, #6C5CE7, #3B82F6)` |
| 选中态背景 | `--bg-active` | `linear-gradient(135deg, rgba(108,92,231,0.12), rgba(0,180,216,0.08))` |
| 选中态边框 | `--border-active` | `rgba(108,92,231,0.2)` |

### 2.4 语义色

| 用途 | 颜色 | 辉光 | 说明 |
|------|------|------|------|
| 在线 / 成功 | `#00F5A0` | `0 0 6px rgba(0,245,160,0.4)` | 翠绿辉光 |
| 空闲 / 警告 | `#FBBF24` | `0 0 6px rgba(251,191,36,0.3)` | 琥珀辉光 |
| 离线 | `rgba(255,255,255,0.15)` | 无 | 暗淡无光 |
| 错误 / 危险 | `#F43F5E` | `0 0 6px rgba(244,63,94,0.3)` | 玫红辉光 |
| 未读 Badge | `linear-gradient(135deg, #E040A0, #F06040)` | — | 粉→橘渐变 |

### 2.5 角色色（发送者名称颜色）

| 角色 | 颜色 | 头像渐变 | 说明 |
|------|------|---------|------|
| 真人用户 | `#A5B4FC` | `#6C5CE7 → #3B82F6` | 蓝紫系 |
| OpenClaw Agent | `#34D399` | `#059669 → #34D399` | 翠绿系 |
| Hermes Agent | `#FB923C` | `#DC2626 → #F97316` | 火焰系 |
| QwenPaw Agent | `#FBBF24` | `#D97706 → #FBBF24` | 琥珀系 |
| Manager | `#2DD4BF` | `#0D9488 → #2DD4BF` | 青色系 |
| Team Leader | `#A78BFA` | `#7C3AED → #A78BFA` | 紫色系 |

### 2.6 边框与分隔

| 用途 | 值 | 说明 |
|------|-----|------|
| 默认边框 | `0.5px solid rgba(255,255,255,0.04)` | 极淡，仅做区域分隔 |
| 悬浮边框 | `0.5px solid rgba(255,255,255,0.08)` | hover 时微亮 |
| 选中边框 | `0.5px solid rgba(108,92,231,0.2)` | 品牌色微光 |
| 分隔线 | `linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)` | 渐变分隔线 |

### 2.7 @Mention 高亮色

| 状态 | 背景 | 文字 |
|------|------|------|
| 默认 | `linear-gradient(135deg, rgba(108,92,231,0.25), rgba(0,180,216,0.15))` | `#A5B4FC` |
| Hover | `linear-gradient(135deg, rgba(108,92,231,0.4), rgba(0,180,216,0.3))` | `#FFFFFF` |
| 提及自己 | `linear-gradient(135deg, rgba(108,92,231,0.35), rgba(0,180,216,0.25))` | `#FFFFFF` |

---

## 3. 字体

### 3.1 字体栈

```css
--font-primary: "Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-code: "JetBrains Mono", "Consolas", "Monaco", "Noto Sans Mono", monospace;
```

### 3.2 字号与行高

| 用途 | 字号 | 行高 | 字重 |
|------|------|------|------|
| 频道名 / 聊天头部 | 13.5px | 1.25 | 600 |
| 消息正文 | 13px | 1.5 | 400 |
| 房间列表项 | 12.5px | 1.375 | 400（未读时 500） |
| 分类标题（大写） | 10px | 1.3 | 700 |
| 时间戳 | 10px | 1.3 | 400 |
| 发送者名 | 12.5px | 1.25 | 600 |
| Badge 文字 | 9px | 1 | 700 |
| Agent 运行时标签 | 8px | 1 | 700 |

### 3.3 代码片段样式

```css
code {
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11.5px;
  font-family: var(--font-code);
  color: #A78BFA;  /* 紫色代码高亮 */
}
```

---

## 4. 布局结构

### 4.1 四栏布局（保持 Discord 结构）

```
┌──────┬──────────┬───────────────────────────┬──────────┐
│ 56px │  200px   │          弹性             │  200px   │
│      │          │        (min 480px)         │ (可收起)  │
│ 工作  │  房间    │         聊天区              │  成员    │
│ 区栏  │  列表    │                            │  面板    │
│      │ 毛玻璃   │                            │ 毛玻璃   │
└──────┴──────────┴───────────────────────────┴──────────┘
```

### 4.2 各栏规格

| 栏位 | 宽度 | 背景 | 特效 |
|------|------|------|------|
| 工作区栏 | 56px | `--bg-deepest` | 无 blur（最底层） |
| 房间列表 | 200px | `--bg-glass` | `backdrop-filter: blur(20px)` |
| 聊天区 | 弹性 | `--bg-primary` | 无 blur（主内容层清晰） |
| 成员面板 | 200px | `--bg-glass` 稍降 opacity | `backdrop-filter: blur(16px)` |

### 4.3 高度规格

| 区域 | 高度 |
|------|------|
| 聊天头部 | 42px |
| 用户面板 | 52px |
| 消息编辑器 | 动态（52px~160px） |

---

## 5. 圆角系统

| 元素 | 圆角 |
|------|------|
| 工作区图标（默认） | 50%（圆形） |
| 工作区图标（选中/悬浮） | 14px |
| 房间列表项 | 8px |
| 消息编辑器 | 10px |
| 弹窗 / 对话框 | 14px |
| Badge | 8px |
| 代码块 | 4px |
| 头像 | 50% |
| Agent 标签 | 3px |
| @mention pill | 4px |

---

## 6. 间距系统

基于 4px 栅格，与之前一致。关键间距：

- 消息组间距：同发送者 `2px`，不同发送者 `10px`
- 消息头像与内容：`10px`
- 房间列表项：`5px 10px`，列表项间 `1px`
- 分类标题：上方 `14px`，下方 `4px`

---

## 7. 核心组件规范

### 7.1 工作区图标（Server Icon）— 渐变光晕

**默认态**：
```css
width: 44px; height: 44px;
border-radius: 50%;
background: rgba(255,255,255,0.06);
color: rgba(255,255,255,0.7);
transition: all 0.25s;
```

**悬浮态**：
```css
border-radius: 14px;
/* 背景微亮 */
```

**选中态**：
```css
border-radius: 14px;
color: #fff;
/* ⭐ 关键：外层渐变边框光晕 */
/* 用 ::before 伪元素实现旋转渐变边框 */
&::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 16px;
  background: var(--gradient-brand);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
  z-index: -1;
}
&::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: #1A1A24; /* 内部填充，露出 2px 渐变边框 */
}
```

**左侧指示条**：
```css
width: 3px;
border-radius: 0 3px 3px 0;
background: linear-gradient(180deg, #6C5CE7, #00B4D8);
/* 选中时 height: 18px，未读时 height: 8px */
```

**关键动画**：
```css
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### 7.2 房间列表项（Channel Item）

| 状态 | 文字色 | 背景 | 边框 |
|------|--------|------|------|
| 默认 | `rgba(255,255,255,0.4)` | 透明 | 无 |
| 悬浮 | `rgba(255,255,255,0.7)` | `rgba(255,255,255,0.04)` | 无 |
| 选中 | `#fff` | `linear-gradient(135deg, rgba(108,92,231,0.12), rgba(0,180,216,0.08))` | `0.5px solid rgba(108,92,231,0.2)` |
| 未读 | `rgba(255,255,255,0.85)` + font-weight 500 | 透明 | 无 |

- 群聊前缀 `#`：`opacity: 0.4`，`font-size: 14px`
- 私聊状态点：`7px` 圆形，带辉光 `box-shadow`
- 未读 Badge：渐变背景 `#E040A0 → #F06040`
- 整体高度 ~30px，单行

### 7.3 消息布局 — AI 消息竖条标识

**所有消息统一左对齐，无气泡包裹。hover 时背景 `rgba(255,255,255,0.02)`**

**真人消息**：
```
[Avatar 34px]  发送者名(角色色)  10:23
               消息内容
```

**Agent 消息**（AI 回复）：
```
[Avatar 34px]  发送者名(角色色)  AGENT标签  10:24
 ┃              消息内容
 ┃              消息第二行
 ↑
左侧 2px 渐变竖条（紫→青→翠）
```

Agent 消息竖条样式：
```css
.ai-message::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, #6C5CE7, #00B4D8, #00F5A0);
  opacity: 0.5;
}
```

> 竖条只在 Agent 消息上显示，真人消息没有。这是区分 AI/真人的最直观视觉信号。

### 7.4 Agent 运行时标签

标签使用**渐变背景**（而非纯色半透明）：

| 运行时 | 标签文字 | 背景 | 文字色 |
|--------|---------|------|--------|
| OpenClaw | `AGENT` | `linear-gradient(135deg, rgba(108,92,231,0.3), rgba(52,211,153,0.2))` | `#A78BFA` |
| Hermes | `HERMES` | `linear-gradient(135deg, rgba(220,38,38,0.25), rgba(249,115,22,0.2))` | `#FB923C` |
| QwenPaw | `QWENPAW` | `linear-gradient(135deg, rgba(217,119,6,0.25), rgba(251,191,36,0.2))` | `#FBBF24` |
| Manager | `MANAGER` | `linear-gradient(135deg, rgba(13,148,136,0.25), rgba(45,212,191,0.2))` | `#2DD4BF` |

标签尺寸：`font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 3px;`

### 7.5 头像 — 渐变背景

每个角色的头像使用**渐变背景**而非纯色：

```css
/* 真人 */
background: linear-gradient(135deg, #6C5CE7, #3B82F6);

/* OpenClaw Agent */
background: linear-gradient(135deg, #059669, #34D399);

/* Hermes Agent */
background: linear-gradient(135deg, #DC2626, #F97316);

/* QwenPaw Agent */
background: linear-gradient(135deg, #D97706, #FBBF24);
```

### 7.6 消息编辑器

```css
background: rgba(255,255,255,0.04);
border: 0.5px solid rgba(255,255,255,0.06);
border-radius: 10px;
padding: 10px 14px;
transition: border-color 0.2s;

/* ⭐ 聚焦时边框渐变微光 */
&:focus-within {
  border-color: rgba(108,92,231,0.3);
}
```

### 7.7 状态指示点 — 辉光效果

| 状态 | 颜色 | box-shadow |
|------|------|------------|
| 在线 | `#00F5A0` | `0 0 6px rgba(0,245,160,0.4)` |
| 空闲 | `#FBBF24` | `0 0 6px rgba(251,191,36,0.3)` |
| 离线 | `rgba(255,255,255,0.15)` | 无 |
| 异常 | `#F43F5E` | `0 0 6px rgba(244,63,94,0.3)` |

辉光通过 `box-shadow` 实现，不使用额外元素。在线状态可选加呼吸动画：
```css
@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
```

### 7.8 未读 Badge — 渐变

```css
background: linear-gradient(135deg, #E040A0, #F06040);
color: #fff;
font-size: 9px;
font-weight: 700;
min-width: 16px;
height: 16px;
border-radius: 8px;
padding: 0 4px;
```

非提及未读使用低调版：`background: rgba(255,255,255,0.1)`

### 7.9 日期分隔线

```css
/* 渐变分隔线 */
.divider-line {
  border: none;
  height: 0.5px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
}
.divider-text {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.15);
}
```

### 7.10 对话框 / 弹窗

```css
background: rgba(15,15,21,0.95);
backdrop-filter: blur(24px);
border: 0.5px solid rgba(255,255,255,0.06);
border-radius: 14px;
box-shadow: 0 24px 48px rgba(0,0,0,0.4);
```

遮罩：`rgba(0,0,0,0.6)` + `backdrop-filter: blur(4px)`

### 7.11 按钮

**主要按钮**（品牌色）：
```css
background: linear-gradient(135deg, #6C5CE7, #3B82F6);
color: #fff;
border-radius: 8px;
border: none;
padding: 8px 16px;
font-weight: 500;
transition: opacity 0.15s;
&:hover { opacity: 0.9; }
&:disabled { opacity: 0.4; }
```

**次要按钮**：
```css
background: transparent;
color: rgba(255,255,255,0.7);
border: 0.5px solid rgba(255,255,255,0.08);
&:hover { background: rgba(255,255,255,0.04); }
```

**危险按钮**：
```css
color: #F43F5E;
&:hover { background: rgba(244,63,94,0.08); }
```

### 7.12 成员面板

- 头像 `26px`，渐变背景
- 右下角状态点 `5px`，带辉光，外围描边环与面板背景同色
- Agent 成员名称使用角色色
- 运行时标签紧跟名称后
- 分组标题：`9.5px` 大写 `letter-spacing: 0.06em` `rgba(255,255,255,0.2)`

---

## 8. 动效系统

### 8.1 过渡时间

```css
--transition-fast: 0.15s ease;     /* hover 背景 */
--transition-normal: 0.2s ease;    /* 颜色、opacity */
--transition-slow: 0.25s ease;     /* border-radius、布局 */
--transition-spring: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性效果 */
```

### 8.2 关键动画

| 动画 | CSS | 用途 |
|------|-----|------|
| 渐变边框旋转 | `gradient-shift` 3s ease infinite | 工作区选中图标光晕 |
| 辉光呼吸 | `glow-pulse` 2s ease-in-out infinite | 在线状态点（可选） |
| 微光闪烁 | `shimmer` 2s ease infinite | AI 消息加载态 |
| 淡入上滑 | `fade-in-up` 0.2s ease-out | 新消息进入、对话框出现 |

```css
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 8.3 交互动效

| 元素 | 触发 | 效果 |
|------|------|------|
| 工作区图标 | hover | `border-radius: 50% → 14px` (0.25s) |
| 工作区图标 | 选中 | 渐变边框光晕持续旋转 |
| 房间列表项 | hover | 背景 `rgba(255,255,255,0.04)` 淡入 |
| 房间列表项 | 选中 | 渐变背景 + 渐变边框淡入 |
| 消息组 | hover | 背景 `rgba(255,255,255,0.02)` |
| 编辑器 | focus | 边框色渐变为 `rgba(108,92,231,0.3)` |
| 按钮 | hover | opacity 0.9 |
| 按钮 | active | `transform: scale(0.98)` |
| 对话框 | 出现 | `fade-in-up` 0.2s |
| 新消息 | 到达 | 从右微滑入 `fade-in-up` |

---

## 9. AI 专属视觉语言

### 9.1 设计哲学

```
真人元素 = 朴素、安静、白色系
AI 元素  = 渐变、辉光、彩色系
```

| 维度 | 真人 | AI Agent |
|------|------|---------|
| 头像 | 蓝紫渐变（统一色） | 角色专属渐变（绿/橘/金/青） |
| 发送者名 | `#A5B4FC`（淡蓝） | 角色色（绿/橘/金/青） |
| 消息左侧 | 无标记 | 2px 渐变竖条（紫→青→翠） |
| 标签 | 无 | `AGENT` / `HERMES` / `QWENPAW` / `MANAGER` |
| 状态指示 | Matrix Presence 白点 | 辉光状态点（绿/黄/灰 + glow） |

### 9.2 AI 消息渐变竖条

这是 MAGIC Client 最具辨识度的设计元素——AI 消息左侧的**渐变竖条**：

```css
.ai-message {
  position: relative;
  padding-left: 10px;
}
.ai-message::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, #6C5CE7, #00B4D8, #00F5A0);
  opacity: 0.5;
}
```

- 只在 `getAgentInfo(sender).isAgent === true` 时显示
- 竖条颜色固定使用品牌三色渐变，不随 Agent 运行时变化
- `opacity: 0.5` 保持克制，不喧宾夺主

### 9.3 Agent 状态卡片（Agent Dashboard）

```css
border: 0.5px solid rgba(255,255,255,0.04);
background: rgba(255,255,255,0.02);
border-radius: 10px;
padding: 12px;
/* 悬浮时边框微亮 */
&:hover {
  border-color: rgba(255,255,255,0.08);
}
```

---

## 10. Tailwind CSS v4 实现

### 10.1 @theme 变量

```css
/* apps/desktop/src/renderer/src/index.css */
/* apps/web/src/index.css */
@import "tailwindcss";

@theme {
  /* 背景 */
  --color-bg-deepest: rgba(12,12,18,0.95);
  --color-bg-glass: rgba(18,18,26,0.85);
  --color-bg-primary: rgba(15,15,21,0.95);
  --color-bg-surface: rgba(255,255,255,0.04);
  --color-bg-hover: rgba(255,255,255,0.03);
  --color-bg-panel: rgba(12,12,18,0.6);

  /* 文字 */
  --color-text-primary: rgba(255,255,255,0.85);
  --color-text-secondary: rgba(255,255,255,0.4);
  --color-text-tertiary: rgba(255,255,255,0.2);
  --color-text-disabled: rgba(255,255,255,0.1);

  /* 品牌 */
  --color-brand-purple: #6C5CE7;
  --color-brand-cyan: #00B4D8;
  --color-brand-mint: #00F5A0;

  /* 语义 */
  --color-success: #00F5A0;
  --color-warning: #FBBF24;
  --color-danger: #F43F5E;

  /* 角色色 */
  --color-role-human: #A5B4FC;
  --color-role-openclaw: #34D399;
  --color-role-hermes: #FB923C;
  --color-role-qwenpaw: #FBBF24;
  --color-role-manager: #2DD4BF;
  --color-role-leader: #A78BFA;

  /* 边框 */
  --color-border-default: rgba(255,255,255,0.04);
  --color-border-hover: rgba(255,255,255,0.08);
  --color-border-active: rgba(108,92,231,0.2);

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-full: 9999px;

  /* 字体 */
  --font-sans: "Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "JetBrains Mono", "Consolas", "Monaco", "Noto Sans Mono", monospace;
}
```

### 10.2 全局动画定义

```css
/* 追加到 index.css */
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 10.3 暗色模式说明

MAGIC Client **只有暗色模式**。所有颜色直接为暗色，不需要 `dark:` 前缀。`background: #0F0F14` 作为 `<body>` 或 `<html>` 的基底色，确保毛玻璃面板的 blur 有底色可透。

---

## 11. 实施清单

### 11.1 立即修改

| 文件 | 变更 |
|------|------|
| `apps/desktop/src/renderer/src/index.css` | 替换 `@theme` 为 10.1 + 追加 10.2 动画 |
| `apps/web/src/index.css` | 同上 |
| `CLAUDE.md` | 确认 `@specs/shared/design-system.md` 引用存在 |

### 11.2 组件对齐

| 组件 | 变更要点 |
|------|---------|
| `WorkspaceBar` / `WorkspaceIcon` | 选中态加渐变光晕边框 + 指示条渐变 |
| `RoomListItem` | 选中态改为渐变背景 + 渐变边框 |
| `MessageBubble` | Agent 消息加左侧 2px 渐变竖条（`ai-shimmer` class） |
| `RoomAvatar` | 默认色改为角色渐变背景 |
| `AgentTag` | 背景改为渐变 |
| `UnreadBadge` | 背景改为粉→橘渐变 |
| `MentionPill` | 背景改为渐变半透明 |
| `LoginPage` / `WelcomePage` | 背景改为 `#0F0F14`，按钮渐变 |
| `MainLayout` | 侧边栏追加 `backdrop-filter: blur(20px)` |
| 所有边框 | 从 `border-[#1E1F22]` / `border-[#3F4147]` 改为 `border-[rgba(255,255,255,0.04)]` |
| 所有文字 | 从 `text-[#DBDEE1]` 改为 `text-[rgba(255,255,255,0.85)]`，次要从 `text-[#949BA4]` 改为 `text-[rgba(255,255,255,0.4)]` |
| 所有 hover | 从 `hover:bg-[#35373C]` 改为 `hover:bg-[rgba(255,255,255,0.03)]` |

---

## 12. 参考

- Google Gemini 视觉设计系统：渐变 = 能量传递 + 方向性
- Google 2025-2026 图标渐变化趋势：从扁平纯色走向柔和渐变
- Glassmorphism：Apple macOS / iOS 26 液态玻璃、Windows 11 Fluent Design
- 色彩心理学：紫色 = 智能创造、青色 = 科技清新、翠绿 = 生长活力
- 品牌三色 `#6C5CE7 → #00B4D8 → #00F5A0` 构成从"思考"到"执行"到"完成"的隐喻