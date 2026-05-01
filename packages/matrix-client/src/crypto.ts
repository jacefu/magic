import { getClient } from "./client.js";

export type DeviceTrustLevel =
  | "verified"
  | "cross-signed"
  | "unverified"
  | "unknown";
export type RoomEncryptionStatus =
  | "verified"
  | "encrypted-unverified"
  | "unencrypted"
  | "unknown";

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
  verificationStatus: DeviceTrustLevel;
}

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

  await crypto.bootstrapCrossSigning({
    authUploadDeviceSigningKeys: async (makeRequest) => {
      await makeRequest({});
    },
  });
  result.crossSigningReady = true;

  await crypto.bootstrapSecretStorage({
    createSecretStorageKey: () => crypto.createRecoveryKeyFromPassphrase(),
    setupNewKeyBackup: true,
  });
  result.keyBackupEnabled = true;

  return result;
}

export async function restoreKeyBackup(): Promise<boolean> {
  const client = getClient();
  const crypto = client.getCrypto();
  if (!crypto) return false;

  try {
    const backupInfo = await crypto.getKeyBackupInfo();
    if (!backupInfo) return false;

    await crypto.loadSessionBackupPrivateKeyFromSecretStorage().catch(() => {});
    const result = await crypto.restoreKeyBackup();
    return result.imported > 0;
  } catch (err) {
    console.error("密钥备份恢复失败:", err);
    return false;
  }
}

export async function getDeviceTrustLevel(
  userId: string,
  deviceId: string,
): Promise<DeviceTrustLevel> {
  const client = getClient();
  const crypto = client.getCrypto();
  if (!crypto) return "unknown";

  try {
    const status = await crypto.getDeviceVerificationStatus(userId, deviceId);
    if (!status) return "unknown";
    if (status.isVerified()) return "verified";
    if (status.crossSigningVerified) return "cross-signed";
    return "unverified";
  } catch {
    return "unknown";
  }
}

export async function getOwnDevices(): Promise<DeviceInfo[]> {
  const client = getClient();
  const userId = client.getUserId();
  if (!userId) return [];

  try {
    const { devices } = await client.getDevices();
    const currentDeviceId = client.getDeviceId();
    return Promise.all(
      devices.map(async (d) => ({
        deviceId: d.device_id,
        displayName: d.display_name ?? d.device_id,
        lastSeenIp: d.last_seen_ip ?? undefined,
        lastSeenTs: d.last_seen_ts ?? undefined,
        isCurrentDevice: d.device_id === currentDeviceId,
        verificationStatus: await getDeviceTrustLevel(userId, d.device_id),
      })),
    );
  } catch (err) {
    console.error("获取设备列表失败:", err);
    return [];
  }
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const client = getClient();
  await client.deleteDevice(deviceId);
}

export async function getRoomEncryptionStatus(
  roomId: string,
): Promise<RoomEncryptionStatus> {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return "unknown";

  if (!room.hasEncryptionStateEvent()) return "unencrypted";

  const crypto = client.getCrypto();
  if (!crypto) return "encrypted-unverified";

  try {
    const members = room.getJoinedMembers();
    let allVerified = true;

    for (const member of members) {
      const userDevices = await crypto.getUserDeviceInfo([member.userId]);
      const devices = userDevices.get(member.userId);
      if (!devices || devices.size === 0) continue;

      for (const [deviceId] of devices) {
        const trust = await getDeviceTrustLevel(member.userId, deviceId);
        if (trust !== "verified" && trust !== "cross-signed") {
          allVerified = false;
        }
      }
    }

    return allVerified ? "verified" : "encrypted-unverified";
  } catch {
    return "encrypted-unverified";
  }
}

export async function startDeviceVerification(userId: string, deviceId: string) {
  const client = getClient();
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("加密模块未初始化");
  return crypto.requestDeviceVerification(userId, deviceId);
}
