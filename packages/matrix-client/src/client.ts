import { createClient, type MatrixClient } from "matrix-js-sdk";
import { MagicClientError } from "./errors.js";
import { getSessionClient } from "./session-manager.js";

/**
 * Standalone client (used by the legacy single-server `auth.login` flow
 * before spec 016). When the multi-session manager is in play this is
 * unused — `getClient()` resolves through `getSessionClient` instead.
 *
 * Keeping it around so any caller that pre-dates the session manager
 * (some tests, CLI scripts) keeps working.
 */
let standaloneClient: MatrixClient | null = null;

export function getClient(): MatrixClient {
  // Prefer the active session's client when the session manager has any
  // sessions. Falls back to the legacy standalone client for callers
  // that still go through `initClient`.
  const fromSession = getSessionClient();
  if (fromSession) return fromSession;
  if (!standaloneClient) {
    throw new MagicClientError(
      "MatrixClient 未初始化，请先添加 Matrix 服务器或调用 initClient()",
    );
  }
  return standaloneClient;
}

export async function initClient(options: InitClientOptions): Promise<MatrixClient> {
  if (standaloneClient) {
    await destroyClient();
  }

  standaloneClient = createClient({
    baseUrl: options.homeserver,
    accessToken: options.accessToken,
    userId: options.userId,
    deviceId: options.deviceId,
    timelineSupport: true,
    useAuthorizationHeader: true,
  });

  if (options.enableCrypto !== false) {
    await standaloneClient.initRustCrypto();
  }

  return standaloneClient;
}

export async function destroyClient(): Promise<void> {
  if (standaloneClient) {
    standaloneClient.stopClient();
    standaloneClient.removeAllListeners();
    standaloneClient = null;
  }
}

export function hasClient(): boolean {
  return getSessionClient() !== null || standaloneClient !== null;
}

export interface InitClientOptions {
  homeserver: string;
  accessToken?: string;
  userId?: string;
  deviceId?: string;
  enableCrypto?: boolean;
}
