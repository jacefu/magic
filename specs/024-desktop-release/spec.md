# Spec 024: 桌面端打包发布到 GitHub Releases（macOS DMG）

> 优先级: P0 | 波次: Wave 6 | 预估: 1-2 天 | 前置依赖: 023-app-icon-and-letter-avatars
> 文件路径: `specs/024-desktop-release/spec.md`

---

## 1. 目标

把 Magic Desktop Electron 应用打包成 macOS `.dmg` 安装包，并通过 GitHub Releases 分发，让其他用户能下载安装。

### 范围

| 阶段 | 内容 |
|------|------|
| **阶段 1（本 spec 重点）** | 配置 electron-builder + **本地构建** + 手动上传 GitHub Release |
| **阶段 2（本 spec 重点）** | GitHub Actions 自动化：打 git tag 触发自动构建 + 发布 |
| 阶段 3（v2，本 spec 不做） | Apple 代码签名 + 公证（消除"无法验证开发者"提示） |
| 阶段 4（v2，本 spec 不做） | electron-updater 应用内自动升级 |

### 关键决策（已确认）

| 决策 | 选择 | 备注 |
|------|------|------|
| **代码签名** | ❌ 不签名（先跑通流程） | 用户首次打开需 `xattr -cr` 或右键→打开 |
| **公证** | ❌ 不公证 | 同上 |
| **CPU 架构** | ✅ universal（arm64 + x64） | Apple Silicon 和 Intel Mac 都支持 |
| **打包格式** | ✅ DMG + ZIP | DMG 给普通用户，ZIP 给 power user |
| **分发渠道** | ✅ GitHub Releases | 稳定、免费 |
| **触发方式** | ✅ git tag (`v*`) 触发 GHA | 也支持本地手动构建 |

### 用户故事

- 作为普通用户，我访问 github.com/<repo>/releases，下载 `Magic-1.0.0-universal.dmg`，双击挂载，拖入 Applications 文件夹，首次打开按提示授权后就能用
- 作为开发者，我在 main 分支打 `v1.0.0` 标签，GitHub Actions 自动构建并发布 release
- 作为开发者，我在本地运行 `pnpm release:desktop`，几分钟后在 release 文件夹里看到 dmg 和 zip 文件

---

## 2. 前置条件

### 2.1 项目层面

- ✅ Magic App Icon 已就位（spec 023 的产物）：`apps/desktop/build/icon.icns` / `icon.ico` / `icon.png`
- ✅ `apps/desktop/package.json` 中有 `version` 字段（如 `1.0.0`）
- ✅ 应用能成功 `pnpm dev:desktop` 运行

### 2.2 开发机器要求

- ✅ macOS（Apple 官方限制：构建 macOS 应用必须在 macOS 系统上）
- ✅ Node.js 18+ 和 pnpm 已安装
- ✅ 磁盘空间至少 5 GB（构建产物较大）

### 2.3 GitHub 仓库要求

- ✅ 项目已推送到 GitHub
- ✅ 仓库设置中开启了 Releases
- ⚠️ 需要 `GITHUB_TOKEN` 权限（GHA 自动提供，不需要手动配置）

---

## 3. Electron-builder 配置

### 3.1 安装依赖

```bash
pnpm add -D electron-builder -F @magic/desktop
```

### 3.2 修改 apps/desktop/package.json

```json
{
  "name": "@magic/desktop",
  "version": "1.0.0",
  "description": "Magic — Multi-Agent Collaboration Platform",
  "main": "out/main/index.js",
  "author": {
    "name": "Magic",
    "email": "你的邮箱"
  },
  "homepage": "https://github.com/<your-org>/<your-repo>",
  "scripts": {
    "build": "electron-vite build",
    "build:unpack": "pnpm build && electron-builder --dir",
    "build:mac": "pnpm build && electron-builder --mac --universal",
    "release:mac": "pnpm build && electron-builder --mac --universal --publish always",
    "release:dryrun": "pnpm build && electron-builder --mac --universal --publish never"
  }
}
```

⚠️ **`version` 字段就是 release 版本号**——每次发布前需要 bump。建议用 `pnpm version 1.0.1` 之类命令。

### 3.3 创建 apps/desktop/electron-builder.yml

```yaml
appId: com.magic.client
productName: Magic
copyright: Copyright © 2026 Magic Team
directories:
  output: release/${version}
  buildResources: build

files:
  - out/**/*
  - resources/**/*
  - package.json
  - "!node_modules/**/*"

# === macOS 配置 ===
mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch:
        - universal
    - target: zip
      arch:
        - universal
  icon: build/icon.icns
  artifactName: ${productName}-${version}-${arch}.${ext}
  # 不签名（阶段 1）
  identity: null
  # 阶段 2 升级时改为：
  # identity: "Developer ID Application: Your Name (XXXXXXXXXX)"
  # hardenedRuntime: true
  # entitlements: build/entitlements.mac.plist
  # entitlementsInherit: build/entitlements.mac.plist
  # gatekeeperAssess: false

# === DMG 美化 ===
dmg:
  background: build/dmg-background.png  # 可选
  iconSize: 100
  iconTextSize: 14
  window:
    width: 540
    height: 380
  contents:
    - x: 130
      y: 200
      type: file
    - x: 410
      y: 200
      type: link
      path: /Applications
  artifactName: ${productName}-${version}-${arch}.${ext}

# === Linux 配置（可选，如果不打 Linux 包就删掉） ===
linux:
  target:
    - AppImage
    - deb
  category: Network
  icon: build/icon.png

# === Windows 配置（可选） ===
win:
  target:
    - target: nsis
      arch:
        - x64
  icon: build/icon.ico
  artifactName: ${productName}-Setup-${version}-${arch}.${ext}

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: always

# === 发布配置 ===
publish:
  provider: github
  owner: your-github-org      # ⭐ 改为你的 GitHub 组织/用户名
  repo: your-repo-name        # ⭐ 改为你的仓库名
  releaseType: release        # 也可以是 draft / prerelease
```

⚠️ 必须修改的字段：
- `appId`: 反向域名格式，唯一标识应用
- `publish.owner`: GitHub 用户名/组织名
- `publish.repo`: 仓库名

### 3.4 DMG 背景图（可选但推荐）

如果你想要一个好看的 DMG 安装界面（拖到 Applications 文件夹的视觉提示），创建：

```
apps/desktop/build/dmg-background.png
```

尺寸：540×380（与 yml 中 `dmg.window` 一致）。如果不做，删掉 yml 中的 `background` 字段即可。

### 3.5 关键注意点

⚠️ **`out/**/*` 是 electron-vite 的构建输出目录**，不是 `dist/**/*`。如果你的 main/preload 构建输出到别的地方，相应修改 `files` 字段。

⚠️ **`resources/**/*`** 包含 spec 023 中放置的 icon-light.png / icon-dark.png 等运行时资源，必须打包进去。

⚠️ **`directories.output: release/${version}`** 让每个版本的产物在独立目录里，避免覆盖。

---

## 4. 阶段 1：本地构建并发布

### 4.1 第一次构建（dry run，不发布）

```bash
cd apps/desktop

# 1. 确认版本号
cat package.json | grep '"version"'

# 2. 构建（不发布）
pnpm release:dryrun

# 3. 查看产物
ls -la release/1.0.0/
```

预期产物：

```
release/1.0.0/
├── Magic-1.0.0-universal.dmg          ← 普通用户下载这个
├── Magic-1.0.0-universal.dmg.blockmap ← 用于 electron-updater（暂不用）
├── Magic-1.0.0-universal-mac.zip      ← power user 下载这个
├── Magic-1.0.0-universal-mac.zip.blockmap
├── builder-debug.yml
├── builder-effective-config.yaml
└── latest-mac.yml                     ← electron-updater 用，暂不用
```

### 4.2 验证 DMG 能正常使用

```bash
# 1. 双击 DMG
open release/1.0.0/Magic-1.0.0-universal.dmg

# 2. 把 Magic 拖到 Applications 文件夹

# 3. 启动应用
open /Applications/Magic.app
```

⚠️ 由于没有签名，**首次打开会提示**："Magic 无法打开，因为无法验证开发者" 或 "Magic.app 已损坏，无法打开"。

**用户解决方案**（必须在 README 写清楚）：

```bash
# 方法 1：右键 → 打开（推荐普通用户）
# Finder 中右键 Magic.app → 打开 → 弹窗中再点"打开"

# 方法 2：终端命令（推荐有命令行经验的用户）
xattr -cr /Applications/Magic.app
# 然后正常双击打开
```

### 4.3 创建 GitHub Release（手动）

```bash
# 1. 推送代码到 GitHub
git add -A
git commit -m "chore: prepare for v1.0.0 release"
git push origin main

# 2. 打 tag
git tag v1.0.0
git push origin v1.0.0

# 3. 在 GitHub 网页创建 Release
# 访问 https://github.com/<owner>/<repo>/releases/new
# - Tag: v1.0.0
# - Release title: v1.0.0
# - Description: 写 changelog（什么新功能、修了什么 bug）
# - 把 release/1.0.0/ 下的 .dmg 和 .zip 拖到 Attach binaries 区域
# - 点击 "Publish release"
```

### 4.4 全自动本地发布（推荐）

如果你配置了 `GH_TOKEN` 环境变量，electron-builder 可以**自动**创建 release 并上传产物：

```bash
# 1. 在 https://github.com/settings/tokens 创建一个 token
#    权限至少包含 "repo"
# 2. 设置环境变量
export GH_TOKEN=ghp_xxxxxxxxxxxx

# 3. 一键发布
cd apps/desktop
pnpm release:mac
```

执行后会：
1. 构建产物
2. 自动在 GitHub 创建 release（draft 状态）
3. 上传所有产物
4. 你只需要去 GitHub release 页面写描述、点 publish

---

## 5. 阶段 2：GitHub Actions 自动化

### 5.1 创建 .github/workflows/release.yml

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'                      # 推 v1.0.0 这类 tag 触发
  workflow_dispatch:              # 也支持手动触发

permissions:
  contents: write                 # 写 release

jobs:
  release-mac:
    name: Build macOS DMG
    runs-on: macos-latest         # ⚠️ 必须是 macOS
    timeout-minutes: 60

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9              # 与项目使用的 pnpm 版本一致

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build app
        run: pnpm build --filter @magic/desktop

      - name: Build and Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        working-directory: apps/desktop
        run: pnpm release:mac

      # 阶段 2 升级到签名 + 公证时取消注释：
      # env:
      #   GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      #   APPLE_ID: ${{ secrets.APPLE_ID }}
      #   APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
      #   APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      #   CSC_LINK: ${{ secrets.CSC_LINK }}
      #   CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
```

### 5.2 触发流程

```bash
# 1. 准备发布
# 修改 apps/desktop/package.json 中的 version
# 比如从 "1.0.0" 改为 "1.0.1"

# 2. 提交
git add apps/desktop/package.json
git commit -m "chore: bump version to 1.0.1"
git push

# 3. 打 tag
git tag v1.0.1
git push origin v1.0.1

# → GHA 自动触发，约 5-15 分钟后 release 就好了
```

### 5.3 工作流的几个细节

⚠️ **GHA 上的 macos-latest** 通常是 macos-14 (Apple Silicon)，能构建 universal 包。

⚠️ **`secrets.GITHUB_TOKEN`** 是 GitHub 自动提供的，**不需要手动创建**。

⚠️ **`pnpm install --frozen-lockfile`** 确保 GHA 用的依赖版本和你本地一致。

⚠️ **`timeout-minutes: 60`** 防止卡死。Mac 构建通常 5-15 分钟够了，但首次可能更长。

⚠️ **构建失败排查**：在 GHA 网页可看到日志。常见错误：
- `Cannot find module 'xxx'`：依赖没装上 → 检查 pnpm-lock.yaml
- `Code signing failed`：阶段 1 不应出现，如出现说明 `identity: null` 没生效
- `EACCES`：权限问题，通常是 cache 损坏，重跑即可

---

## 6. 用户安装文档

在仓库 README.md 增加一节：

```markdown
## 下载与安装

### macOS

1. 前往 [Releases](https://github.com/<owner>/<repo>/releases) 下载最新的 `Magic-x.x.x-universal.dmg`
2. 双击 DMG 挂载，把 Magic 拖到 Applications 文件夹
3. **首次打开**会提示"无法验证开发者"，请按以下方式解决：

   **方法 A（推荐普通用户）**：
   - 在 Finder 中找到 Magic.app
   - 右键点击 → 选择"打开"
   - 弹窗中再点"打开"
   - 之后双击就能正常打开

   **方法 B（命令行用户）**：
   ```bash
   xattr -cr /Applications/Magic.app
   ```
   然后双击正常打开

> 这是因为 Magic 暂未做 Apple 代码签名（节省 99 美元/年的开发者费用）。如果你不放心，可以查看源代码或自己构建。

### Apple Silicon vs Intel Mac

我们提供 universal 二进制，自动适配 Apple Silicon 和 Intel Mac，无需选择。
```

---

## 7. 实现任务（按执行顺序）

### 任务 1：安装 electron-builder

```bash
pnpm add -D electron-builder -F @magic/desktop
```

**验证**：`pnpm typecheck`

---

### 任务 2：配置 package.json

按 §3.2 修改 `apps/desktop/package.json`：
- 添加 `description` / `author` / `homepage`
- 添加 `build` / `release:mac` / `release:dryrun` 等 scripts

**验证**：`cat apps/desktop/package.json | jq '.scripts'`

---

### 任务 3：创建 electron-builder.yml

按 §3.3 创建 `apps/desktop/electron-builder.yml`。

⚠️ 必须修改：
- `publish.owner` → 你的 GitHub 用户名/组织名
- `publish.repo` → 你的仓库名

**告诉我你的 GitHub owner 和 repo**，我帮你确认配置。

---

### 任务 4：DMG 背景图（可选）

按 §3.4 准备 `apps/desktop/build/dmg-background.png`（540×380）。

如果暂时不想做，把 yml 中 `dmg.background` 那一行删掉。

---

### 任务 5：本地 dryrun 构建测试

```bash
cd apps/desktop
pnpm release:dryrun
```

预期：在 `release/1.0.0/` 看到 dmg 和 zip 文件。

如果失败，把错误日志贴给我。

---

### 任务 6：本地安装测试

```bash
open release/1.0.0/Magic-1.0.0-universal.dmg
```

按 §4.2 验证：
1. DMG 能挂载
2. 可以拖到 Applications
3. 首次打开按 `xattr -cr` 或右键打开能成功
4. 应用能正常运行

⭐ 这一步**必须通过**才能进入下一步。

---

### 任务 7：本地手动发布（首个 release）

按 §4.4 配置 `GH_TOKEN`，跑：

```bash
export GH_TOKEN=ghp_xxxxxxxxxxxx
pnpm release:mac
```

完成后到 GitHub release 页面看到草稿，写好描述后 publish。

---

### 任务 8：配置 GitHub Actions

创建 `.github/workflows/release.yml`（按 §5.1）。

**验证**：在 GitHub 网页的 Actions 标签页能看到这个 workflow。

---

### 任务 9：更新 README

按 §6 在仓库根 README.md 添加下载安装章节。

---

### 任务 10：通过 git tag 触发自动发布

```bash
# Bump 到 1.0.1
# 修改 apps/desktop/package.json 的 version
git add -A
git commit -m "chore: bump to 1.0.1"
git push origin main

git tag v1.0.1
git push origin v1.0.1
```

观察 GHA 自动触发，约 10 分钟后 release 完成。

---

## 8. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | `pnpm release:dryrun` 在 `release/<version>/` 生成 dmg 和 zip | 检查目录 |
| AC-2 | DMG 可双击挂载，安装窗口显示应用图标 + Applications 链接 | 视觉验证 |
| AC-3 | 拖入 Applications 后，应用图标正确（spec 023 的 Magic icon） | Finder 检查 |
| AC-4 | 首次打开提示"无法验证开发者"——这是预期行为 | 双击验证 |
| AC-5 | 用 `xattr -cr` 或右键打开后，应用能正常启动 | 实测 |
| AC-6 | 应用启动后，所有功能正常（matrix 连接、聊天、绑定文件夹等） | 实测 |
| AC-7 | 应用是 universal 包（既能在 Apple Silicon 也能在 Intel Mac 跑） | `lipo -info /Applications/Magic.app/Contents/MacOS/Magic` |
| AC-8 | `pnpm release:mac` 自动在 GitHub 创建 draft release 并上传 dmg/zip | GitHub 页面检查 |
| AC-9 | 推 `v*` tag 后 GHA 自动构建并 publish release | Actions 页面观察 |
| AC-10 | Release 页面有清晰的下载链接，README 有安装说明 | 浏览器访问 |
| AC-11 | 其他 Mac 用户能从 Releases 下载 dmg 并成功安装运行 | 找朋友测试 ⭐ |
| AC-12 | 应用版本号显示正确（如设置页面或 About 弹窗） | 视觉检查 |

---

## 9. 升级路径（v2 阶段，本 spec 不实现）

### 9.1 Apple 代码签名 + 公证

**前置**：
- 注册 Apple Developer Program（99 USD/年）
- 在 Apple Developer 网站创建 "Developer ID Application" 证书
- 导出为 `.p12` 文件（含密码）
- 在 Apple ID 设置中创建 app-specific password（用于公证）

**配置变更**：

修改 `electron-builder.yml`：

```yaml
mac:
  identity: "Developer ID Application: Your Name (XXXXXXXXXX)"  # Team ID 在 Apple Developer 后台找
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  gatekeeperAssess: false
  notarize:
    teamId: XXXXXXXXXX
```

GHA secrets 添加：
- `CSC_LINK`：base64 编码的 .p12 文件（`base64 -i cert.p12 | pbcopy`）
- `CSC_KEY_PASSWORD`：.p12 密码
- `APPLE_ID`：Apple Developer 邮箱
- `APPLE_APP_SPECIFIC_PASSWORD`：app-specific password
- `APPLE_TEAM_ID`：Team ID

工作流中传入这些环境变量。

签名 + 公证后，用户**双击直接打开**，无需 `xattr` 或右键技巧。

### 9.2 应用内自动升级（electron-updater）

```bash
pnpm add electron-updater -F @magic/desktop
```

主进程添加：

```typescript
import { autoUpdater } from "electron-updater";

app.on("ready", () => {
  autoUpdater.checkForUpdatesAndNotify();
});
```

`electron-builder.yml` 的 `publish` 配置已就位，无需额外配置。

每次发新版后，已安装应用会自动检测、下载、提示用户重启升级。

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 不签名导致用户安装门槛高 | 用户流失 | README 写清楚两种解决方法；后续阶段升级到签名 |
| GHA macOS runner 慢/排队 | 发布延迟 | 接受这个限制；急用时本地构建 |
| pnpm-lock.yaml 与 macos-latest 不兼容 | GHA 构建失败 | 用 `--frozen-lockfile`；保持依赖版本稳定 |
| universal 包体积过大（约 200+ MB） | 下载慢 | 提供单架构 zip 作为备选；后期可分别打包 arm64 / x64 |
| GH_TOKEN 误推到 git 仓库 | 安全问题 | 严格用 `export` 临时变量 / GHA secrets，不要写入文件 |
| 用户拿到的 dmg 与本地构建版本不一致 | bug 难复现 | 严格依赖 GHA 出包；本地仅作 dryrun |
| 不签名 + 后续启用签名时，旧用户无法自动升级 | electron-updater 拒绝校验失败 | 升级到签名时，建议同时升级 major version 并提示用户重新下载 |
| 应用首次启动需要联网拉资源（Matrix 等） | 离线无法启动 | 在 README 标注；本地缓存为主要数据来源 |
| Apple Silicon 模拟器内构建失败 | 开发卡住 | 必须真机或 GHA macos-latest |

---

## 11. 命令速查表

```bash
# 本地 dryrun（开发期反复用）
cd apps/desktop && pnpm release:dryrun

# 本地手动发布（GH_TOKEN 已设置）
cd apps/desktop && pnpm release:mac

# 触发 GHA 自动发布
git tag v1.0.1 && git push origin v1.0.1

# 测试已下载的 dmg
xattr -cr /Applications/Magic.app && open /Applications/Magic.app

# 检查应用是否 universal
lipo -info /Applications/Magic.app/Contents/MacOS/Magic
# 期望输出：Architectures in the fat file: ... are: x86_64 arm64

# 删除有问题的旧版本
rm -rf /Applications/Magic.app
rm -rf ~/Library/Application\ Support/Magic

# 清理本地构建缓存
rm -rf apps/desktop/release apps/desktop/out apps/desktop/dist
```