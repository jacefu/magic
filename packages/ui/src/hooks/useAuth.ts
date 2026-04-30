import {
  login as sdkLogin,
  logout as sdkLogout,
  restoreSession as sdkRestore,
  startSync,
  bridgeToStores,
  getClient,
  useAuthStore,
  useSyncStore,
  useRoomStore,
  useTypingStore,
  useUserStore,
} from "@magic/matrix-client";
import { useCallback, useRef } from "react";

export function useAuth() {
  const { stage, error } = useAuthStore();
  const cleanupRef = useRef<(() => void) | null>(null);

  const initialize = useCallback(async () => {
    const authStore = useAuthStore.getState();
    authStore.setStage("initializing");

    try {
      const restored = await sdkRestore();
      if (restored) {
        authStore.setStage("restoring");
        await startSyncAndBridge(authStore, cleanupRef);
      } else {
        authStore.setStage("unauthenticated");
      }
    } catch (err) {
      console.error("会话恢复失败:", err);
      authStore.setStage("unauthenticated");
    }
  }, []);

  const login = useCallback(async (
    homeserver: string,
    username: string,
    password: string,
  ) => {
    const authStore = useAuthStore.getState();
    authStore.setStage("logging_in");
    authStore.setError(null);

    try {
      const response = await sdkLogin(homeserver, username, password);
      authStore.setUser({
        userId: response.userId,
        homeserver,
      });
      await startSyncAndBridge(authStore, cleanupRef);
    } catch (err: any) {
      const message = parseLoginError(err);
      authStore.setError(message);
      authStore.setStage("unauthenticated");
    }
  }, []);

  const logout = useCallback(async () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    await sdkLogout();

    useAuthStore.getState().reset();
    useSyncStore.getState().reset();
    useRoomStore.getState().reset();
    useTypingStore.getState().reset();
    useUserStore.getState().reset();
  }, []);

  return { stage, error, initialize, login, logout };
}

async function startSyncAndBridge(
  authStore: ReturnType<typeof useAuthStore.getState>,
  cleanupRef: React.MutableRefObject<(() => void) | null>,
) {
  authStore.setStage("syncing");

  try {
    const client = getClient();
    const bridgeCleanup = bridgeToStores(client);

    const unsubSync = useSyncStore.subscribe((state) => {
      if (state.syncState === "PREPARED" && state.initialSyncComplete) {
        authStore.setStage("authenticated");
        const user = client.getUser(client.getUserId()!);
        if (user) {
          authStore.setUser({
            userId: client.getUserId()!,
            homeserver: useAuthStore.getState().homeserver ?? "",
            displayName: user.displayName ?? undefined,
            avatarMxc: user.avatarUrl ?? undefined,
          });
        }
      }
      if (state.syncState === "ERROR") {
        authStore.setError(state.lastSyncError ?? "同步失败");
      }
    });

    cleanupRef.current = () => {
      bridgeCleanup();
      unsubSync();
    };

    await startSync();
  } catch (err: any) {
    authStore.setError(`同步启动失败: ${err.message}`);
    authStore.setStage("error");
  }
}

function parseLoginError(err: any): string {
  const msg = err?.message ?? String(err);
  const status = err?.httpStatus ?? err?.data?.httpStatus;

  if (status === 403 || msg.includes("M_FORBIDDEN")) return "用户名或密码错误";
  if (status === 429 || msg.includes("M_LIMIT_EXCEEDED")) return "登录请求过于频繁，请稍后重试";
  if (msg.includes("M_USER_DEACTIVATED")) return "账号已被停用，请联系管理员";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
    return "无法连接到服务器，请检查网络和 Homeserver 地址";
  }
  if (msg.includes("M_UNKNOWN_TOKEN") || msg.includes("M_MISSING_TOKEN")) {
    return "会话已过期，请重新登录";
  }
  return `登录失败: ${msg}`;
}
