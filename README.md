<div align="center">

<img src="docs/assets/logo.png" alt="Magic Client" width="120" />

# Magic Client

**为 Multi-Agent 时代而生的协同 IM 客户端**

A Matrix-native desktop & web client built for multi-agent collaboration

## 🤔 这是什么？

**Magic Client** 是 [Magic](https://github.com/jacefu/magic) 多 Agent 协同治理平台的桌面与 Web 客户端。

它的本质是一个**类 Discord 风格的 Matrix IM 客户端**，但区别于通用 IM：

- 🤖 **Agent-Native**：把 AI Agent 视作一等公民，与真人帐号一视同仁地存在于房间中
- 🔗 **Matrix 联邦协议**：基于开放协议，不锁定厂商；支持端到端加密、跨服务器互联
- 📁 **本地工作区**：把本地文件夹绑定到对话，让 Agent 直接读写你的代码/文档
- 🏢 **企业级治理**：与 Higress AI 网关 + Consumer Token 配合，提供细粒度的权限治理

> 🌉 **桥接 Harness 方法论与生产级基础设施**：与 [OpenMagic](https://github.com/agentscope-ai/HiClaw) 合作，把 Agent 协作从单 runtime 编排提升为网络化协同。

---

## ✨ 核心功能

### 💬 现代化 IM 体验
- 房间 / 私聊一体化 UI，支持多服务器多账号
- 实时输入提示、@提及、消息引用回复、Emoji
- 自定义字母头像（含中文拼音首字母映射）
- 暗色 / 浅色双主题，自动跟随系统

### 🤖 Agent 协同
- **Manager-Worker 分层架构**：Manager Agent 自动拆解任务，Worker 执行
- **OPOC（One Person One Company）**：每个 Agent 拥有独立凭证空间
- **Consumer Token 透传**：通过 Higress AI 网关实现身份治理
- **多 Agent 同房间协作**：Agent 团队的群聊场景

### 📁 本地工作区绑定 ⭐
- 把本地文件夹绑定到任意对话（群聊或与 Agent 私聊）
- **文件不上传服务器**：Agent 通过 Matrix 协议按需读取
- 智能文件路径检测：消息中提到 `` `src/main.py` `` 自动附加文件内容
- 双向白名单：默认排除 `.env` / `.ssh` / `node_modules` 等敏感目录

### 🔐 安全与隐私
- 基于 Matrix 端到端加密（Megolm）
- 房间级权限控制（state event 鉴权）
- 用户绑定的本地文件夹永远不离开本机
- 完整的访问审计日志

### 🛠 开发友好
- 100% TypeScript
- 模块化 monorepo（matrix-client / ui / desktop / web 解耦）
- 不 fork [Element](https://github.com/element-hq/element-web)（避免 AGPL 传染），从零构建
- 与 [Tuwunel](https://github.com/tuwunel/tuwunel) Matrix 服务端深度配合


---

## 📦 下载安装

### macOS

到 [Releases](https://github.com/jacefu/magic/releases) 下载最新的 `Magic-x.x.x-universal.dmg`：

1. 双击 DMG，把 Magic 拖到 Applications 文件夹
2. **首次打开**会提示"无法验证开发者"——这是因为应用暂未做 Apple 代码签名（节省开发者费用）

   **方法 A**：右键 Magic.app → 选"打开" → 弹窗中再点"打开"

   **方法 B**（命令行）：
   ```bash
   xattr -cr /Applications/Magic.app
   open /Applications/Magic.app
   ```

> 💡 **CPU 架构**：Magic 提供 universal 二进制，自动适配 Apple Silicon (M1/M2/M3) 和 Intel Mac，无需选择。

### Windows / Linux

🚧 即将推出。当前 `v0.x` 版本仅发布 macOS 安装包。Windows 和 Linux 的 CI 已配置就绪，将在稳定后开放。

需要尝鲜的开发者可参考 [面向开发者](#-面向开发者) 章节自行构建。

---

## 🏗️ 架构设计

### 整体架构

```
┌──────────────────────────────────────────────────────┐
│                    Magic Client                       │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  apps/                                          │ │
│  │  ├── desktop  (Electron 38)                     │ │
│  │  └── web      (Vite + React 19)                 │ │
│  └────────────────────┬────────────────────────────┘ │
│                       │                               │
│  ┌────────────────────▼────────────────────────────┐ │
│  │  packages/                                      │ │
│  │  ├── ui              (React 组件)                │ │
│  │  ├── matrix-client   (matrix-js-sdk 包装层)     │ │
│  │  ├── shared-types    (TypeScript 类型)          │ │
│  │  └── config          (Tailwind / TS 配置)       │ │
│  └────────────────────┬────────────────────────────┘ │
└──────────────────────┼────────────────────────────────┘
                       │ Matrix 协议
        ┌──────────────▼──────────────┐
        │   Matrix Homeserver          │
        │   (Tuwunel)                  │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │   Magic Backend              │
        │   ├── Higress AI Gateway     │
        │   ├── Manager Agent          │
        │   └── Worker Agents          │
        └──────────────────────────────┘
```

### 关键设计决策

| 维度 | 选择 | 理由 |
|------|------|------|
| 协议 | Matrix（matrix-js-sdk） | 联邦化、端到端加密、可审计 |
| 渲染 | Electron + React 19 | 跨平台、生态成熟 |
| 状态 | Zustand | 轻量、无样板代码 |
| 样式 | Tailwind v4 | CSS 变量驱动主题切换 |
| Monorepo | pnpm + Turborepo | 包之间引用清晰、构建并行 |
| Matrix Crypto | initRustCrypto in renderer | IndexedDB 持久化 session |
| 文件传输 | Matrix 原生 m.file 附件 | Agent 无需自定义协议适配 |

### 自定义 Matrix 事件类型

Magic 在标准 Matrix 协议之上扩展了 `com.magic.*` 命名空间：

| 事件类型 | 用途 |
|---------|------|
| `com.magic.workspace.binding` (state) | 通告对话已绑定本地文件夹 |
| `com.magic.workspace.notification` (msg) | 文件清单 + Agent 操作指引 |
| `com.magic.workspace.attached` (msg metadata) | 标记消息含 workspace 文件附件 |

详见 [docs/matrix-extensions.md](docs/matrix-extensions.md)。

---

## 📂 项目结构

```
magic-client/
├── apps/
│   ├── desktop/              # Electron 桌面应用
│   │   ├── src/main/         # 主进程（Node.js）
│   │   ├── src/preload/      # Preload 脚本
│   │   ├── src/renderer/     # 渲染进程（React）
│   │   ├── build/            # 应用图标 + 构建资源
│   │   └── electron-builder.yml
│   └── web/                  # Web 版本
│       └── src/
├── packages/
│   ├── ui/                   # 共享 React 组件
│   │   ├── src/chat/         # 聊天界面（消息气泡、滚动等)
│   │   ├── src/rooms/        # 房间列表、创建对话框
│   │   ├── src/workspace/    # 本地文件夹绑定 UI
│   │   ├── src/settings/     # 设置面板
│   │   ├── src/avatar/       # 字母头像系统
│   │   └── src/hooks/        # 共享 hooks
│   ├── matrix-client/        # Matrix SDK 包装
│   │   ├── src/auth.ts       # 登录/会话管理
│   │   ├── src/rooms.ts      # 房间操作
│   │   ├── src/dm.ts         # 私聊管理
│   │   ├── src/stores/       # Zustand stores
│   │   └── src/sync.ts       # 同步循环
│   ├── shared-types/         # 跨包共享类型
│   └── config/               # tsconfig / tailwind 共享配置
├── specs/                    # 设计文档
│   ├── 020-ui-polish-round1/
│   ├── 021-room-settings/
│   ├── 022-workspace-binding/
│   ├── 023-app-icon-and-letter-avatars/
│   └── 024-desktop-release/
└── docs/                     # 用户文档 + 设计文档
```

---

## 🗺️ Roadmap

### v0.x（当前阶段）—— 核心 IM + 工作区
- [x] Matrix 协议核心：登录、同步、消息收发、E2EE
- [x] 群聊 / 私聊 / 多服务器
- [x] 房间设置面板（信息、成员、通知、安全）
- [x] 本地文件夹绑定 + 智能附件
- [x] 浅色 / 深色双主题
- [x] 字母头像系统（含中文拼音）
- [x] macOS 桌面端打包发布
- [ ] 应用内升级（electron-updater）
- [ ] Apple 代码签名 + 公证

### v1.0 —— 生产就绪
- [ ] Windows / Linux 安装包
- [ ] 离线工作模式
- [ ] 完整的 i18n（中英日韩）
- [ ] 性能优化（虚拟滚动 + IndexedDB 缓存）
- [ ] 完整的 E2E 测试覆盖

### v2.0 —— Agent 高级特性
- [ ] Agent 写文件：通过 Matrix 协议写回本地（带用户审批）
- [ ] Thread 线程视图
- [ ] Agent 状态实时面板
- [ ] Soul / Memory 编辑器
- [ ] 与 [CoPaw](https://github.com/your-org/copaw) 深度集成

### v3.0 —— 生态扩展
- [ ] 移动端（iOS / Android）
- [ ] Bridge 到 DingTalk / Feishu / WeCom（IDP 集成）
- [ ] 等保三级合规

---

## 🤝 贡献

欢迎所有形式的贡献！

### 报告 Bug / 提需求

通过 [GitHub Issues](https://github.com/your-org/magic-client/issues) 提交。请尽量提供：
- 复现步骤
- 期望行为 vs 实际行为
- 截图或录屏（如果是 UI 问题）
- 系统环境（OS、Magic 版本）

### 提交代码

1. Fork 本仓库
2. 创建 feature 分支：`git checkout -b feature/your-feature`
3. 修改后跑 `pnpm typecheck && pnpm lint && pnpm test`
4. 提交：`git commit -m "feat: 你的修改"`
5. Push 并发起 Pull Request

### 开发规范

- TypeScript strict 模式，避免 `any`
- 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 提交规范
- 复杂功能先在 [`specs/`](specs/) 写设计文档再编码
- UI 改动需附截图

---

## ❓ FAQ

<details>
<summary><b>Magic Client 与 Element / FluffyChat 等其他 Matrix 客户端有什么区别？</b></summary>

通用 Matrix 客户端面向人类对话场景。Magic Client **专为 Agent 协同优化**：

- 把 Agent 视作一等公民（区分 Agent vs 真人，UI 上有特殊标记）
- 内置工作区绑定能力（让 Agent 读本地文件）
- 与 Higress AI 网关 + Manager Agent 深度集成
- 默认主题、信息密度针对 Agent 协作场景调整

如果你只用 Matrix 做团队 IM，Element 完全够用。如果你想跑多 Agent 协作，Magic Client 是为此而生。
</details>

<details>
<summary><b>为什么选择 Matrix 协议而不是自研？</b></summary>

- **联邦化**：不同组织的 Magic 实例可互联，跨组织协作
- **生态成熟**：matrix-js-sdk、Tuwunel 等已生产可用
- **审计与加密**：Megolm E2EE、房间状态完整审计
- **开放标准**：避免被任何厂商锁定

我们扩展了 `com.magic.*` 自定义事件类型来承载 Agent 特有语义，但底层完全标准 Matrix。
</details>

<details>
<summary><b>本地文件夹绑定后，文件会上传到服务器吗？</b></summary>

**默认情况下不会持久化上传**。绑定后：

1. Magic Client 扫描文件夹，把**文件清单**（仅路径和大小）通过 Matrix 协议发布
2. 你的消息中提到某个文件路径时（如 `` `src/main.py` ``），Magic Client 拦截发送，读取本地文件，**作为消息内容的一部分**发出
3. Agent 像看普通聊天消息一样看到代码块

文件确实会经过 Matrix Homeserver（消息正文），但：
- 端到端加密房间中，文件被 Megolm 加密，仅房间成员可解密
- Magic Client 不依赖任何独立后端服务
- 用户随时可解绑

详见 [specs/022-workspace-binding/spec.md](specs/022-workspace-binding/spec.md)。
</details>

<details>
<summary><b>为什么不 fork Element？</b></summary>

Element 采用 AGPL 开源协议，会传染到衍生作品。Magic 希望保持灵活的商用许可空间，所以从零构建。我们大量参考了 Element 的设计，对其工作表示感谢。
</details>

<details>
<summary><b>能否用于商业产品？</b></summary>

请查阅 [LICENSE](LICENSE) 文件。商业合作请联系 [your-email@example.com](mailto:your-email@example.com)。
</details>

---

## 📜 License

[Apache License 2.0](LICENSE)

```
Copyright 2026 Magic Team

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

---

## 🙏 致谢

Magic Client 站在以下伟大开源项目的肩膀上：

- [Matrix](https://matrix.org) —— 开放的实时通信协议
- [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) —— Matrix JavaScript SDK
- [Tuwunel](https://github.com/tuwunel/tuwunel) —— 高性能 Matrix Homeserver
- [Element](https://element.io) —— 优秀的 Matrix 客户端，给我们很多设计启发
- [Electron](https://www.electronjs.org/) —— 跨平台桌面应用框架
- [React](https://react.dev/) / [Zustand](https://github.com/pmndrs/zustand) / [Tailwind CSS](https://tailwindcss.com/)

特别感谢：
- [Higress](https://higress.cn) 团队提供的 AI 网关与治理能力
- [AgentScope](https://github.com/your-org/agentscope) 社区的协作

---

## 📮 联系我们

- 📧 Email: [your-email@example.com](mailto:your-email@example.com)
- 💬 Matrix: [#magic:matrix.org](https://matrix.to/#/#magic:matrix.org)
- 🌐 官网: [https://magic.your-domain.com](https://magic.your-domain.com)
- 🐦 GitHub Discussions: [magic-client/discussions](https://github.com/your-org/magic-client/discussions)

---

<div align="center">

**如果 Magic Client 对你有帮助，请给我们一颗 ⭐ Star，这是对项目最大的支持！**

Made with ❤️ by the Magic Team

</div>