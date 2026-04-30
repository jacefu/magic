import { getClient, initClient, destroyClient } from "./client.js";
import type { LoginResponse } from "@magic/shared-types";

const SESSION_KEY = "magic_session";

export async function login(
  homeserver: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const tempClient = await initClient({ homeserver, enableCrypto: false });
  const response = await tempClient.loginWithPassword(username, password);

  const session: LoginResponse = {
    userId: response.user_id,
    deviceId: response.device_id,
    accessToken: response.access_token,
    homeserver,
  };

  // Each loginWithPassword creates a new server-side device ID. Clear the
  // IndexedDB crypto store so initRustCrypto() doesn't throw
  // "account in store doesn't match the account in the constructor".
  tempClient.stopClient();
  await tempClient.clearStores().catch(() => {});

  await initClient({
    homeserver: session.homeserver,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
  });

  saveSession(session);
  return session;
}

export async function restoreSession(): Promise<boolean> {
  const session = loadSession();
  if (!session) return false;

  try {
    await initClient({
      homeserver: session.homeserver,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
    });
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    const c = getClient();
    await c.logout(true);
    c.stopClient();
    await c.clearStores().catch(() => {});
  } catch {
    // silence
  }
  clearSession();
  await destroyClient();
}

function saveSession(session: LoginResponse): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // silent fail in private mode
  }
}

function loadSession(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LoginResponse) : null;
  } catch {
    return null;
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // silent
  }
}
