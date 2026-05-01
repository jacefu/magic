# Spec 008: 端到端加密配置（E2EE Setup）

> 优先级: P1 | 波次: Wave 3 | 预估: 3-4 天 | 前置依赖: 002-matrix-sdk-wrapper, 004-auth-flow, 006-chat-timeline

---

## 1. 目标

将 matrix-js-sdk 的 Rust Crypto 模块（`@matrix-org/matrix-sdk-crypto-wasm`）集成到完整的用户体验流程中——加密初始化、设备验证（SAS emoji 验证）、交叉签名引导、密钥备份与恢复、加密房间的消息解密状态显示、以及未验证设备警告。完成后，用户可以在加密房间中安全收发消息，新设备登录时通过 emoji 验证建立信任链，历史密钥通过服务端备份自动恢复。

### 用户故事

- 作为用户，我希望首次登录时自动完成加密初始化，无需手动配置
- 作为用户，我希望在新设备登录后看到设备验证提示，通过 emoji 对比完成验证
- 作为用户，我希望加密房间中的消息正常解密显示，无法解密的消息显示明确提示
- 作为用户，我希望历史消息的密钥可以从服务端备份自动恢复
- 作为用户，我希望在聊天头部看到房间的加密状态（已验证 / 部分验证 / 未加密）
- 作为用户，我希望在设置页面看到所有设备列表，可以删除不信任的设备

### 非目标（本 spec 不实现）

- QR 码设备验证 —— 后续 spec
- 密钥导入/导出文件 —— 后续 spec
- 加密房间的邀请密钥共享策略配置 —— 后续 spec

---

## 2. 架构设计

### 2.1 E2EE 层次

```
matrix-js-sdk
  └── initRustCrypto()
        └── @matrix-org/matrix-sdk-crypto-wasm（WASM 模块）
              └── vodozemac（Olm/Megolm 实现）
                    └── IndexedDB（加密密钥持久化）
```

所有加密操作在 **renderer 进程**中执行（WASM + IndexedDB），main 进程不参与。

### 2.2 加密生命周期

```
首次登录
  ├── initRustCrypto()          → 生成设备密钥对
  ├── bootstrapCrossSigning()   → 创建交叉签名密钥
  ├── bootstrapSecretStorage()  → 创建 SSSS（安全密钥/恢复密钥）
  └── enableKeyBackup()         → 开启服务端密钥备份

后续登录（新设备）
  ├── initRustCrypto()          → 生成新设备密钥对
  ├── 交互式设备验证（SAS）     → 与已验证设备对比 emoji
  ├── 获取交叉签名密钥         → 通过 SSSS 或已验证设备
  └── 恢复密钥备份             → 从服务端下载历史 Megolm 密钥
```

### 2.3 文件结构

```
packages/
├── matrix-client/src/
│   └── crypto.ts                    # 更新：完整 E2EE 生命周期
│
├── ui/src/
│   ├── crypto/
│   │   ├── DeviceVerificationDialog.tsx  # SAS emoji 验证对话框
│   │   ├── VerificationEmojiGrid.tsx     # 7 个 emoji 显示网格
│   │   ├── SetupEncryptionDialog.tsx     # 首次加密初始化引导
│   │   ├── RecoveryKeyDialog.tsx         # 恢复密钥显示/输入
│   │   ├── DeviceListPanel.tsx           # 设备列表面板
│   │   ├── EncryptionBadge.tsx           # 加密状态 badge
│   │   └── UndecryptedMessage.tsx        # 无法解密消息占位
│   ├── hooks/
│   │   ├── useVerification.ts            # 设备验证流程 hook
│   │   └── useEncryptionStatus.ts        # 房间/设备加密状态
│   └── chat/
│       ├── ChatHeader.tsx                # 更新：加密 badge
│       └── MessageBubble.tsx             # 更新：解密失败显示
```

---

## 3. 技术规格

### 3.1 crypto.ts — 完整 E2EE 生命周期

```typescript
// packages/matrix-client/src/crypto.ts
import { getClient } from "./client";
import type { MatrixClient } from "matrix-js-sdk";

/**
 * 首次登录后执行完整的加密引导。
 * 包括交叉签名 + 安全密钥存储 + 密钥备份。
 */
export async function bootstrapEncryption(): Promise<BootstrapResult> {
  const client = getClient();
  const crypto = client.getCrypto();
  if (!crypto) {
    throw new Error("加密模块未初始化，请先调用 initRustCrypto()");
  }

  const result: BootstrapResult = {
    crossSigningReady: false,
    keyBackupEnabled: false,
    recoveryKey: null,
  };

  try {
    // 1. 引导交叉签名
    await crypto.bootstrapCrossSigning({
      authUploadDeviceSigningKeys: async (makeRequest) => {
        // 在 UIA（用户交互认证）流程中，使用当前会话的凭证
        await makeRequest({});
      },
    });
    result.crossSigningReady = true;

    // 2. 引导安全密钥存储（SSSS）+ 密钥备份
    await crypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => {
        // SDK 自动生成恢复密钥
        return {};
      },
      setupNewKeyBackup: true,
    });
    result.keyBackupEnabled = true;

    // 3. 获取恢复密钥（显示给用户保存）
    // 注意：恢复密钥在 bootstrapSecretStorage 的回调中生成
    // 实际中需要通过 createSecretStorageKey 的返回值获取

  } catch (err) {
    console.error("加密引导失败:", err);
    throw err;
  }

  return result;
}

/**
 * 恢复已有的密钥备份（新设备登录后调用）。
 */
export async function restoreKeyBackup(recoveryKey?: string): Promise<boolean> {
  const client = getClient();
  const crypto = client.getCrypto();
  if (!crypto) return false;

  try {
    // 检查是否有备份存在
    const backupInfo = await client.getKeyBackupVersion();
    if (!backupInfo) return false;

    if (recoveryKey) {
      // 使用恢复密钥恢复
      await client.restoreKeyBackupWithRecoveryKey(
        recoveryKey,
        undefined,
        undefined,
        backupInfo,
      );
    }

    return true;
  } catch (err) {
    console.error("密钥备份恢复失败:", err);
    return false;
  }
}

/**
 * 获取设备的验证状态。
 */
export async function getDeviceVerificationStatus(
  userId: string,
  deviceId: string,
): Promise<DeviceVerificationStatus> {
  const client = getClient();
  const crypto = client.getCrypto();
  if (!crypto) return "unknown";

  try {
    const device = await crypto.getDeviceVerificationStatus(userId, deviceId);
    if (!device) return "unknown";
    if (device.isVerified()) return "verified";
    if (device.crossSigningVerified) return "cross-signed";
    return "unverified";
  } catch {
    return "unknown";
  }
}

/**
 * 获取当前用户的所有设备列表。
 */
export async function getOwnDevices(): Promise<DeviceInfo[]> {
  const client = getClient();
  const crypto = client.getCrypto();
  if (!crypto) return [];

  try {
    const userId = client.getUserId()!;
    const devices = await crypto.getUserDeviceInfo([userId]);
    const userDevices = devices.get(userId);
    if (!userDevices) return [];

    const result: DeviceInfo[] = [];
    for (const [deviceId, device] of userDevices) {
      const verStatus = await getDeviceVerificationStatus(userId, deviceId);
      result.push({
        deviceId,
        displayName: device.displayName ?? deviceId,
        lastSeenIp: device.lastSeenIp ?? undefined,
        lastSeenTs: device.lastSeenTs ?? undefined,
        isCurrentDevice: deviceId === client.getDeviceId(),
        verificationStatus: verStatus,
      });
    }

    return result;
  } catch (err) {
    console.error("获取设备列表失败:", err);
    return [];
  }
}

/**
 * 删除指定设备。
 */
export async function deleteDevice(deviceId: string): Promise<void> {
  const client = getClient();
  await client.deleteDevice(deviceId, {
    // UIA 流程——使用当前会话凭证
  });
}

/**
 * 获取房间的加密状态汇总。
 */
export async function getRoomEncryptionStatus(roomId: string): Promise<RoomEncryptionStatus> {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return "unknown";

  if (!room.hasEncryptionStateEvent()) return "unencrypted";

  const crypto = client.getCrypto();
  if (!crypto) return "encrypted-unverified";

  try {
    // 检查房间内所有成员的设备验证状态
    const members = room.getJoinedMembers();
    let allVerified = true;
    let hasUnverified = false;

    for (const member of members) {
      const userDevices = await crypto.getUserDeviceInfo([member.userId]);
      const devices = userDevices.get(member.userId);
      if (!devices) continue;

      for (const [deviceId] of devices) {
        const status = await getDeviceVerificationStatus(member.userId, deviceId);
        if (status !== "verified" && status !== "cross-signed") {
          allVerified = false;
          hasUnverified = true;
        }
      }
    }

    if (allVerified) return "verified";
    if (hasUnverified) return "encrypted-unverified";
    return "encrypted-unverified";
  } catch {
    return "encrypted-unverified";
  }
}

/**
 * 开始 SAS（emoji）设备验证。
 */
export function startVerification(userId: string, deviceId: string) {
  const client = getClient();
  const crypto = client.getCrypto()!;
  return crypto.requestDeviceVerification(userId, deviceId);
}

// ---- 类型 ----

export type DeviceVerificationStatus = "verified" | "cross-signed" | "unverified" | "unknown";
export type RoomEncryptionStatus = "verified" | "encrypted-unverified" | "unencrypted" | "unknown";

export interface BootstrapResult {
  crossSigningReady: boolean;
  keyBackupEnabled: boolean;
  recoveryKey: string | null;
}

export interface DeviceInfo {
  deviceId: string;
  displayName: string;
  lastSeenIp?: string;
  lastSeenTs?: number;
  isCurrentDevice: boolean;
  verificationStatus: DeviceVerificationStatus;
}
```

### 3.2 useVerification.ts — 设备验证流程 Hook

```typescript
// packages/ui/src/hooks/useVerification.ts
import { useState, useCallback, useEffect, useRef } from "react";
import { getClient } from "@magic/matrix-client";
import type { VerificationRequest } from "matrix-js-sdk/lib/crypto-api";

export type VerificationPhase =
  | "idle"
  | "requested"     // 等待对方接受
  | "ready"          // 双方就绪
  | "showing-sas"    // 显示 emoji，等待用户确认
  | "confirmed"      // 用户已确认
  | "done"           // 验证成功
  | "cancelled"      // 已取消
  | "error";

interface SASData {
  emoji: Array<[string, string]>;  // [emoji, name] 对
  decimal: [number, number, number];
}

export function useVerification() {
  const [phase, setPhase] = useState<VerificationPhase>("idle");
  const [sasData, setSasData] = useState<SASData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verifierRef = useRef<any>(null);

  // 监听来自其他设备的验证请求
  useEffect(() => {
    const client = getClient();
    const crypto = client.getCrypto();
    if (!crypto) return;

    const onRequest = (request: VerificationRequest) => {
      // 自动进入 requested 阶段
      setPhase("requested");
      handleIncomingRequest(request);
    };

    crypto.on("verificationRequestReceived" as any, onRequest);
    return () => {
      crypto.off("verificationRequestReceived" as any, onRequest);
    };
  }, []);

  // 处理传入的验证请求
  const handleIncomingRequest = useCallback(async (request: VerificationRequest) => {
    try {
      await request.accept();
      setPhase("ready");

      const verifier = await request.startVerification("m.sas.v1");
      verifierRef.current = verifier;

      verifier.on("show_sas", (sas: any) => {
        setSasData({
          emoji: sas.emoji || [],
          decimal: sas.decimal || [0, 0, 0],
        });
        setPhase("showing-sas");
      });

      verifier.on("done", () => {
        setPhase("done");
      });

      verifier.on("cancel", (e: any) => {
        setError(e?.message ?? "验证已取消");
        setPhase("cancelled");
      });
    } catch (err: any) {
      setError(err.message);
      setPhase("error");
    }
  }, []);

  // 主动发起验证
  const requestVerification = useCallback(async (userId: string, deviceId: string) => {
    setPhase("requested");
    setError(null);
    setSasData(null);

    try {
      const client = getClient();
      const crypto = client.getCrypto()!;
      const request = await crypto.requestDeviceVerification(userId, deviceId);

      setPhase("ready");

      const verifier = await request.startVerification("m.sas.v1");
      verifierRef.current = verifier;

      verifier.on("show_sas", (sas: any) => {
        setSasData({
          emoji: sas.emoji || [],
          decimal: sas.decimal || [0, 0, 0],
        });
        setPhase("showing-sas");
      });

      verifier.on("done", () => {
        setPhase("done");
      });

      verifier.on("cancel", (e: any) => {
        setError(e?.message ?? "验证已取消");
        setPhase("cancelled");
      });
    } catch (err: any) {
      setError(err.message);
      setPhase("error");
    }
  }, []);

  // 用户确认 emoji 匹配
  const confirmSas = useCallback(async () => {
    if (!verifierRef.current) return;
    setPhase("confirmed");
    try {
      await verifierRef.current.verify();
    } catch (err: any) {
      setError(err.message);
      setPhase("error");
    }
  }, []);

  // 用户否认 emoji 不匹配
  const rejectSas = useCallback(async () => {
    if (!verifierRef.current) return;
    try {
      await verifierRef.current.cancel();
    } catch {
      // 忽略
    }
    setPhase("cancelled");
    setError("emoji 不匹配，验证已取消");
  }, []);

  // 重置
  const reset = useCallback(() => {
    setPhase("idle");
    setSasData(null);
    setError(null);
    verifierRef.current = null;
  }, []);

  return {
    phase,
    sasData,
    error,
    requestVerification,
    confirmSas,
    rejectSas,
    reset,
  };
}
```

### 3.3 useEncryptionStatus.ts — 加密状态 Hook

```typescript
// packages/ui/src/hooks/useEncryptionStatus.ts
import { useState, useEffect } from "react";
import { getRoomEncryptionStatus, type RoomEncryptionStatus } from "@magic/matrix-client";

export function useEncryptionStatus(roomId: string | null) {
  const [status, setStatus] = useState<RoomEncryptionStatus>("unknown");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomId) {
      setStatus("unknown");
      return;
    }

    let cancelled = false;
    setLoading(true);

    getRoomEncryptionStatus(roomId)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus("unknown");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [roomId]);

  return { status, loading };
}
```

### 3.4 DeviceVerificationDialog.tsx — SAS 验证对话框

```tsx
// packages/ui/src/crypto/DeviceVerificationDialog.tsx
import { useVerification, type VerificationPhase } from "../hooks/useVerification";
import { VerificationEmojiGrid } from "./VerificationEmojiGrid";
import { DialogOverlay } from "../common/DialogOverlay";

interface DeviceVerificationDialogProps {
  userId: string;
  deviceId: string;
  onClose: () => void;
}

export function DeviceVerificationDialog({
  userId,
  deviceId,
  onClose,
}: DeviceVerificationDialogProps) {
  const {
    phase,
    sasData,
    error,
    requestVerification,
    confirmSas,
    rejectSas,
    reset,
  } = useVerification();

  // 自动发起验证
  useEffect(() => {
    requestVerification(userId, deviceId);
  }, [userId, deviceId, requestVerification]);

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <DialogOverlay onClose={handleClose}>
      <div className="w-full max-w-md rounded-xl bg-magic-surface-alt p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">设备验证</h2>
        <p className="mt-1 text-sm text-gray-400">
          与 {deviceId} 进行安全验证
        </p>

        <div className="mt-6">
          {phase === "requested" && <PhaseRequested />}
          {phase === "ready" && <PhaseReady />}
          {phase === "showing-sas" && sasData && (
            <PhaseSas
              emoji={sasData.emoji}
              onConfirm={confirmSas}
              onReject={rejectSas}
            />
          )}
          {phase === "confirmed" && <PhaseConfirmed />}
          {phase === "done" && <PhaseDone onClose={handleClose} />}
          {(phase === "cancelled" || phase === "error") && (
            <PhaseError error={error} onRetry={() => requestVerification(userId, deviceId)} onClose={handleClose} />
          )}
        </div>
      </div>
    </DialogOverlay>
  );
}

function PhaseRequested() {
  return (
    <div className="text-center py-6">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
      <p className="mt-4 text-sm text-gray-300">等待对方设备响应…</p>
      <p className="mt-1 text-xs text-gray-500">请在另一台设备上确认验证请求</p>
    </div>
  );
}

function PhaseReady() {
  return (
    <div className="text-center py-6">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
      <p className="mt-4 text-sm text-gray-300">正在建立安全通道…</p>
    </div>
  );
}

function PhaseSas({
  emoji,
  onConfirm,
  onReject,
}: {
  emoji: Array<[string, string]>;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-300 text-center">
        请确认以下 emoji 与另一台设备上显示的完全一致：
      </p>
      <div className="my-6">
        <VerificationEmojiGrid emoji={emoji} />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm
                     text-gray-300 hover:bg-gray-700 transition-colors"
        >
          不一致
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium
                     text-white hover:bg-green-700 transition-colors"
        >
          一致，确认验证
        </button>
      </div>
    </div>
  );
}

function PhaseConfirmed() {
  return (
    <div className="text-center py-6">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
      <p className="mt-4 text-sm text-gray-300">正在完成验证…</p>
    </div>
  );
}

function PhaseDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-600/20">
        <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-green-400">验证成功</p>
      <p className="mt-1 text-xs text-gray-500">设备已通过安全验证</p>
      <button
        onClick={onClose}
        className="mt-4 rounded-lg bg-magic-primary px-6 py-2 text-sm font-medium
                   text-white hover:bg-blue-600 transition-colors"
      >
        完成
      </button>
    </div>
  );
}

function PhaseError({
  error,
  onRetry,
  onClose,
}: {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-600/20">
        <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-red-400">验证失败</p>
      <p className="mt-1 text-xs text-gray-500">{error ?? "未知错误"}</p>
      <div className="mt-4 flex gap-3 justify-center">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300
                     hover:bg-gray-700 transition-colors"
        >
          关闭
        </button>
        <button
          onClick={onRetry}
          className="rounded-lg bg-magic-primary px-4 py-2 text-sm font-medium text-white
                     hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  );
}

import { useEffect } from "react";
```

### 3.5 VerificationEmojiGrid.tsx — Emoji 网格

```tsx
// packages/ui/src/crypto/VerificationEmojiGrid.tsx

interface VerificationEmojiGridProps {
  emoji: Array<[string, string]>;  // [emoji, name]
}

export function VerificationEmojiGrid({ emoji }: VerificationEmojiGridProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {emoji.map(([symbol, name], i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-2xl">{symbol}</span>
          <span className="text-[10px] text-gray-500 text-center leading-tight">
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### 3.6 EncryptionBadge.tsx — 加密状态标识

```tsx
// packages/ui/src/crypto/EncryptionBadge.tsx
import { memo } from "react";
import type { RoomEncryptionStatus } from "@magic/matrix-client";

interface EncryptionBadgeProps {
  status: RoomEncryptionStatus;
  size?: "sm" | "md";
}

export const EncryptionBadge = memo(function EncryptionBadge({
  status,
  size = "sm",
}: EncryptionBadgeProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  switch (status) {
    case "verified":
      return (
        <span className="flex items-center gap-1" title="所有设备已验证">
          <ShieldCheckIcon className={`${iconSize} text-green-500`} />
          {size === "md" && <span className="text-xs text-green-500">已验证</span>}
        </span>
      );
    case "encrypted-unverified":
      return (
        <span className="flex items-center gap-1" title="已加密，部分设备未验证">
          <ShieldIcon className={`${iconSize} text-yellow-500`} />
          {size === "md" && <span className="text-xs text-yellow-500">部分验证</span>}
        </span>
      );
    case "unencrypted":
      return (
        <span className="flex items-center gap-1" title="未加密">
          <ShieldOffIcon className={`${iconSize} text-gray-500`} />
          {size === "md" && <span className="text-xs text-gray-500">未加密</span>}
        </span>
      );
    default:
      return null;
  }
});

function ShieldCheckIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zm3.28 5.78a.75.75 0 00-1.06-1.06L9 9.878 7.78 8.66a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.75-3.75z" clipRule="evenodd" />
    </svg>
  );
}

function ShieldIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}

function ShieldOffIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
    </svg>
  );
}
```

### 3.7 UndecryptedMessage.tsx — 无法解密消息

```tsx
// packages/ui/src/crypto/UndecryptedMessage.tsx

interface UndecryptedMessageProps {
  reason?: string;
}

export function UndecryptedMessage({ reason }: UndecryptedMessageProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow-800/50 bg-yellow-950/20 px-3 py-2">
      <LockIcon />
      <div>
        <p className="text-sm text-yellow-300">无法解密此消息</p>
        <p className="text-xs text-yellow-600">
          {reason ?? "缺少解密密钥。请验证发送方设备或恢复密钥备份。"}
        </p>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
```

### 3.8 DeviceListPanel.tsx — 设备列表

```tsx
// packages/ui/src/crypto/DeviceListPanel.tsx
import { useEffect, useState } from "react";
import { getOwnDevices, deleteDevice, type DeviceInfo } from "@magic/matrix-client";
import { DeviceVerificationDialog } from "./DeviceVerificationDialog";
import { useAuthStore } from "@magic/matrix-client";

export function DeviceListPanel() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingDevice, setVerifyingDevice] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    setLoading(true);
    const list = await getOwnDevices();
    setDevices(list);
    setLoading(false);
  }

  async function handleDelete(deviceId: string) {
    if (!confirm(`确定要删除设备 ${deviceId} 吗？`)) return;
    try {
      await deleteDevice(deviceId);
      await loadDevices();
    } catch (err) {
      console.error("删除设备失败:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300 px-1">
        我的设备 ({devices.length})
      </h3>

      {devices.map((device) => (
        <div
          key={device.deviceId}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
            device.isCurrentDevice ? "bg-magic-primary/10 border border-magic-primary/20" : "bg-magic-surface-alt"
          }`}
        >
          <DeviceStatusIcon status={device.verificationStatus} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white truncate">
                {device.displayName}
              </p>
              {device.isCurrentDevice && (
                <span className="rounded bg-magic-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-magic-primary">
                  当前
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">
              {device.deviceId}
              {device.lastSeenTs && ` · 最后活跃 ${formatRelative(device.lastSeenTs)}`}
            </p>
          </div>

          {!device.isCurrentDevice && (
            <div className="flex gap-1">
              {device.verificationStatus !== "verified" && (
                <button
                  onClick={() => setVerifyingDevice(device.deviceId)}
                  className="rounded px-2 py-1 text-xs text-magic-primary hover:bg-magic-primary/10 transition-colors"
                >
                  验证
                </button>
              )}
              <button
                onClick={() => handleDelete(device.deviceId)}
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                title="删除设备"
              >
                删除
              </button>
            </div>
          )}
        </div>
      ))}

      {verifyingDevice && userId && (
        <DeviceVerificationDialog
          userId={userId}
          deviceId={verifyingDevice}
          onClose={() => {
            setVerifyingDevice(null);
            loadDevices();
          }}
        />
      )}
    </div>
  );
}

function DeviceStatusIcon({ status }: { status: DeviceInfo["verificationStatus"] }) {
  const colors = {
    verified: "text-green-500",
    "cross-signed": "text-green-500",
    unverified: "text-yellow-500",
    unknown: "text-gray-500",
  };

  return (
    <svg className={`h-5 w-5 shrink-0 ${colors[status]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
```

### 3.9 更新 ChatHeader.tsx — 加密 badge

在 006 的 `ChatHeader.tsx` 中替换静态锁图标为动态 `EncryptionBadge`：

```tsx
// packages/ui/src/chat/ChatHeader.tsx（更新）
import { useEncryptionStatus } from "../hooks/useEncryptionStatus";
import { EncryptionBadge } from "../crypto/EncryptionBadge";

// 在 ChatHeader 中：
export function ChatHeader({ roomId }: ChatHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  const { status } = useEncryptionStatus(roomId);
  // ...

  return (
    <div className="flex items-center gap-3 ...">
      {/* ... */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <EncryptionBadge status={status} />
          <h2 className="truncate text-sm font-semibold text-white">
            {room.name || "未命名房间"}
          </h2>
        </div>
        {/* ... */}
      </div>
    </div>
  );
}
```

### 3.10 更新 MessageContent.tsx — 解密失败处理

在 006 的 `MessageContent.tsx` 中增加解密失败情况：

```tsx
// 在 MessageContent 组件的 switch 之前添加：
export function MessageContent({ event, isOwn }: MessageContentProps) {
  // 检查解密失败
  if (event.type === "m.room.encrypted") {
    return <UndecryptedMessage />;
  }

  // ... 现有 switch 逻辑
}
```

### 3.11 更新 @magic/matrix-client 和 @magic/ui 导出

**matrix-client/src/index.ts** 追加：
```typescript
// Crypto
export {
  bootstrapEncryption,
  restoreKeyBackup,
  getDeviceVerificationStatus,
  getOwnDevices,
  deleteDevice,
  getRoomEncryptionStatus,
  startVerification,
} from "./crypto";
export type {
  DeviceVerificationStatus,
  RoomEncryptionStatus,
  BootstrapResult,
  DeviceInfo,
} from "./crypto";
```

**ui/src/index.ts** 追加：
```typescript
// Crypto
export { DeviceVerificationDialog } from "./crypto/DeviceVerificationDialog";
export { VerificationEmojiGrid } from "./crypto/VerificationEmojiGrid";
export { EncryptionBadge } from "./crypto/EncryptionBadge";
export { UndecryptedMessage } from "./crypto/UndecryptedMessage";
export { DeviceListPanel } from "./crypto/DeviceListPanel";

// Hooks
export { useVerification } from "./hooks/useVerification";
export { useEncryptionStatus } from "./hooks/useEncryptionStatus";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 首次登录后 `initRustCrypto()` 自动完成，无用户干预 | 检查 IndexedDB 中是否有 crypto store |
| AC-2 | 加密房间中的消息可以正常解密显示 | 在加密房间发消息并查看 |
| AC-3 | 无法解密的消息显示"无法解密此消息"黄色警告框 | 清除密钥后查看历史消息 |
| AC-4 | ChatHeader 显示动态加密状态 badge（绿色盾/黄色盾/灰色） | 视觉检查 |
| AC-5 | 设备列表面板正确显示所有设备及验证状态 | 设置页面查看 |
| AC-6 | 可以发起 SAS emoji 验证，显示 7 个 emoji 对比 | 两台设备交叉验证 |
| AC-7 | 确认 emoji 匹配后验证成功，设备状态变为已验证 | 验证后查看设备列表 |
| AC-8 | 拒绝 emoji 匹配后验证取消，显示错误信息 | 手动验证 |
| AC-9 | 可以删除非当前设备 | 设备列表点击删除 |
| AC-10 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-11 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：完善 crypto.ts 模块

**修改文件**：`packages/matrix-client/src/crypto.ts`（从空壳更新为完整实现）

**验证**：`pnpm typecheck`

---

### 任务 2：更新 @magic/matrix-client 导出

**修改文件**：`packages/matrix-client/src/index.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 useVerification 和 useEncryptionStatus Hook

**创建文件**：
- `packages/ui/src/hooks/useVerification.ts`
- `packages/ui/src/hooks/useEncryptionStatus.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 EncryptionBadge 和 UndecryptedMessage

**创建文件**：
- `packages/ui/src/crypto/EncryptionBadge.tsx`
- `packages/ui/src/crypto/UndecryptedMessage.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 VerificationEmojiGrid

**创建文件**：`packages/ui/src/crypto/VerificationEmojiGrid.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 DeviceVerificationDialog

**创建文件**：`packages/ui/src/crypto/DeviceVerificationDialog.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：创建 DeviceListPanel

**创建文件**：`packages/ui/src/crypto/DeviceListPanel.tsx`

**验证**：`pnpm typecheck`

---

### 任务 8：更新 ChatHeader 接入 EncryptionBadge

**修改文件**：`packages/ui/src/chat/ChatHeader.tsx`

**验证**：`pnpm typecheck`

---

### 任务 9：更新 MessageContent 处理解密失败

**修改文件**：`packages/ui/src/chat/MessageContent.tsx`

**验证**：`pnpm typecheck`

---

### 任务 10：更新 @magic/ui 导出

**修改文件**：`packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 11：编写单元测试

**创建文件**：
- `packages/matrix-client/__tests__/crypto.test.ts` — bootstrapEncryption mock 测试
- `packages/ui/__tests__/crypto/EncryptionBadge.test.tsx` — 各状态的渲染
- `packages/ui/__tests__/crypto/VerificationEmojiGrid.test.tsx` — emoji 渲染

**验证**：`pnpm test`

---

### 任务 12：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 加密房间消息正常解密、ChatHeader 显示加密 badge
```

完成后提交：
```bash
git add -A
git commit -m "feat: 008 - E2EE setup with device verification, key backup, encryption badges"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `initRustCrypto()` WASM 首次加载约 6-7MB | 登录等待时间长 | SyncingScreen 提供反馈；后续可预缓存 WASM |
| SAS 验证的 EventEmitter API 在 matrix-js-sdk v41 中可能有变化 | 事件监听失败 | 使用 `getCrypto()` 返回的 `CryptoApi` 接口而非直接访问内部类 |
| `bootstrapCrossSigning` 需要 UIA 流程 | 首次设置可能失败 | 传入空 auth callback 使用当前会话 token |
| IndexedDB 在隐私模式不可用 | 加密密钥无法持久化 | 检测 IndexedDB 可用性，不可用时警告用户 |
| 密钥备份恢复需要恢复密钥 | 用户可能遗失 | 引导用户在首次设置时保存恢复密钥 |

---

## 7. 后续 Spec 的接入点

- **009-file-attachments**：加密房间的文件需要加密上传（SDK 自动处理）
- **010-agent-status-dashboard**：Agent 设备的验证状态显示
- **后续 QR 码验证 spec**：在 DeviceVerificationDialog 中增加 QR 模式
- **后续设置页面 spec**：将 DeviceListPanel 嵌入设置页的"安全"标签