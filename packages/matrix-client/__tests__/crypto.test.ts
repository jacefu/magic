import { describe, it, expect, vi, beforeEach } from "vitest";

const cryptoMock = {
  bootstrapCrossSigning: vi.fn().mockResolvedValue(undefined),
  bootstrapSecretStorage: vi.fn().mockResolvedValue(undefined),
  createRecoveryKeyFromPassphrase: vi
    .fn()
    .mockResolvedValue({ privateKey: new Uint8Array(32) }),
  getKeyBackupInfo: vi.fn().mockResolvedValue(null),
  loadSessionBackupPrivateKeyFromSecretStorage: vi.fn().mockResolvedValue(undefined),
  restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 0, total: 0 }),
  getDeviceVerificationStatus: vi.fn(),
  requestDeviceVerification: vi.fn(),
};

const matrixClientMock = {
  getCrypto: vi.fn(() => cryptoMock),
  getUserId: vi.fn(() => "@me:example.com"),
  getDeviceId: vi.fn(() => "DEV1"),
  getDevices: vi.fn().mockResolvedValue({ devices: [] }),
  deleteDevice: vi.fn().mockResolvedValue({}),
  getRoom: vi.fn(),
  initRustCrypto: vi.fn(),
  stopClient: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(() => matrixClientMock),
}));

import { initClient, destroyClient } from "../src/client.js";
import {
  bootstrapEncryption,
  restoreKeyBackup,
  getDeviceTrustLevel,
  getOwnDevices,
  deleteDevice,
  getRoomEncryptionStatus,
} from "../src/crypto.js";

beforeEach(async () => {
  await destroyClient();
  await initClient({ homeserver: "https://matrix.example.com", enableCrypto: false });
  for (const fn of Object.values(cryptoMock)) {
    if (typeof fn === "function" && "mockClear" in fn) fn.mockClear();
  }
  matrixClientMock.getDevices.mockClear();
  matrixClientMock.deleteDevice.mockClear();
  cryptoMock.getDeviceVerificationStatus.mockReset();
});

describe("bootstrapEncryption", () => {
  it("calls bootstrapCrossSigning and bootstrapSecretStorage", async () => {
    const result = await bootstrapEncryption();
    expect(cryptoMock.bootstrapCrossSigning).toHaveBeenCalledOnce();
    expect(cryptoMock.bootstrapSecretStorage).toHaveBeenCalledOnce();
    expect(result.crossSigningReady).toBe(true);
    expect(result.keyBackupEnabled).toBe(true);
  });
});

describe("restoreKeyBackup", () => {
  it("returns false when no backup info exists", async () => {
    cryptoMock.getKeyBackupInfo.mockResolvedValueOnce(null);
    const result = await restoreKeyBackup();
    expect(result).toBe(false);
  });

  it("calls restoreKeyBackup when backup info exists", async () => {
    cryptoMock.getKeyBackupInfo.mockResolvedValueOnce({ version: "1" });
    cryptoMock.restoreKeyBackup.mockResolvedValueOnce({ imported: 5, total: 5 });
    const result = await restoreKeyBackup();
    expect(cryptoMock.restoreKeyBackup).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("returns false when imported is 0", async () => {
    cryptoMock.getKeyBackupInfo.mockResolvedValueOnce({ version: "1" });
    cryptoMock.restoreKeyBackup.mockResolvedValueOnce({ imported: 0, total: 0 });
    const result = await restoreKeyBackup();
    expect(result).toBe(false);
  });
});

describe("getDeviceTrustLevel", () => {
  it("returns 'verified' when isVerified() returns true", async () => {
    cryptoMock.getDeviceVerificationStatus.mockResolvedValueOnce({
      isVerified: () => true,
      crossSigningVerified: true,
    });
    expect(await getDeviceTrustLevel("@me:example.com", "DEV1")).toBe("verified");
  });

  it("returns 'cross-signed' when crossSigningVerified but not isVerified", async () => {
    cryptoMock.getDeviceVerificationStatus.mockResolvedValueOnce({
      isVerified: () => false,
      crossSigningVerified: true,
    });
    expect(await getDeviceTrustLevel("@me:example.com", "DEV1")).toBe("cross-signed");
  });

  it("returns 'unverified' when no verification", async () => {
    cryptoMock.getDeviceVerificationStatus.mockResolvedValueOnce({
      isVerified: () => false,
      crossSigningVerified: false,
    });
    expect(await getDeviceTrustLevel("@me:example.com", "DEV1")).toBe("unverified");
  });

  it("returns 'unknown' when status is null", async () => {
    cryptoMock.getDeviceVerificationStatus.mockResolvedValueOnce(null);
    expect(await getDeviceTrustLevel("@me:example.com", "DEV1")).toBe("unknown");
  });

  it("returns 'unknown' when SDK throws", async () => {
    cryptoMock.getDeviceVerificationStatus.mockRejectedValueOnce(new Error("boom"));
    expect(await getDeviceTrustLevel("@me:example.com", "DEV1")).toBe("unknown");
  });
});

describe("getOwnDevices", () => {
  it("returns mapped devices with verification status", async () => {
    matrixClientMock.getDevices.mockResolvedValueOnce({
      devices: [
        { device_id: "DEV1", display_name: "Current", last_seen_ts: 1000 },
        { device_id: "DEV2", display_name: "Other", last_seen_ts: 2000 },
      ],
    });
    cryptoMock.getDeviceVerificationStatus.mockResolvedValue({
      isVerified: () => false,
      crossSigningVerified: false,
    });
    const devices = await getOwnDevices();
    expect(devices).toHaveLength(2);
    expect(devices[0].isCurrentDevice).toBe(true);
    expect(devices[1].isCurrentDevice).toBe(false);
    expect(devices[0].verificationStatus).toBe("unverified");
  });

  it("returns empty array on error", async () => {
    matrixClientMock.getDevices.mockRejectedValueOnce(new Error("network"));
    expect(await getOwnDevices()).toEqual([]);
  });
});

describe("deleteDevice", () => {
  it("calls client.deleteDevice with the deviceId", async () => {
    await deleteDevice("DEV2");
    expect(matrixClientMock.deleteDevice).toHaveBeenCalledWith("DEV2");
  });
});

describe("getRoomEncryptionStatus", () => {
  it("returns 'unknown' when room does not exist", async () => {
    matrixClientMock.getRoom.mockReturnValueOnce(null);
    expect(await getRoomEncryptionStatus("!x:example.com")).toBe("unknown");
  });

  it("returns 'unencrypted' for non-encrypted rooms", async () => {
    matrixClientMock.getRoom.mockReturnValueOnce({
      hasEncryptionStateEvent: () => false,
    });
    expect(await getRoomEncryptionStatus("!x:example.com")).toBe("unencrypted");
  });
});
