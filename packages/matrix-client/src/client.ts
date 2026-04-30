import { createClient, type MatrixClient } from "matrix-js-sdk";
import { MagicClientError } from "./errors.js";

let client: MatrixClient | null = null;

export function getClient(): MatrixClient {
  if (!client) {
    throw new MagicClientError("MatrixClient 未初始化，请先调用 initClient()");
  }
  return client;
}

export async function initClient(options: InitClientOptions): Promise<MatrixClient> {
  if (client) {
    await destroyClient();
  }

  client = createClient({
    baseUrl: options.homeserver,
    accessToken: options.accessToken,
    userId: options.userId,
    deviceId: options.deviceId,
    timelineSupport: true,
    useAuthorizationHeader: true,
  });

  if (options.enableCrypto !== false) {
    await client.initRustCrypto();
  }

  return client;
}

export async function destroyClient(): Promise<void> {
  if (client) {
    client.stopClient();
    client.removeAllListeners();
    client = null;
  }
}

export function hasClient(): boolean {
  return client !== null;
}

export interface InitClientOptions {
  homeserver: string;
  accessToken?: string;
  userId?: string;
  deviceId?: string;
  enableCrypto?: boolean;
}
