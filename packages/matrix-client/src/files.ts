import { getClient } from "./client.js";
import { useSessionStore } from "./stores/sessionStore.js";
import { useAuthStore } from "./stores/authStore.js";

/**
 * Update the current user's Matrix display name + reflect the
 * change locally so any UI watching the auth/session store updates
 * immediately (rather than waiting for the homeserver to echo the
 * profile event back through sync).
 */
export async function updateProfileDisplayName(
  displayName: string,
): Promise<void> {
  const client = getClient();
  await client.setDisplayName(displayName);
  const session = useSessionStore.getState().getActiveSession();
  if (session) {
    useSessionStore.getState().updateSession(session.id, { displayName });
  }
  useAuthStore.getState().setUser({
    userId: useAuthStore.getState().userId ?? "",
    homeserver: useAuthStore.getState().homeserver ?? "",
    displayName,
    avatarMxc: useAuthStore.getState().avatarMxc ?? undefined,
  });
}

/**
 * Upload an image to the homeserver media repo and use the
 * resulting `mxc://` URL as the current user's avatar. Mirrors the
 * change into the local stores like `updateProfileDisplayName`.
 */
export async function updateProfileAvatar(file: File): Promise<string> {
  const client = getClient();
  const upload = await client.uploadContent(file, {
    name: file.name,
    type: file.type,
  });
  const mxc = (upload as { content_uri: string }).content_uri;
  await client.setAvatarUrl(mxc);
  const session = useSessionStore.getState().getActiveSession();
  if (session) {
    useSessionStore.getState().updateSession(session.id, { avatarMxc: mxc });
  }
  useAuthStore.getState().setUser({
    userId: useAuthStore.getState().userId ?? "",
    homeserver: useAuthStore.getState().homeserver ?? "",
    displayName: useAuthStore.getState().displayName ?? undefined,
    avatarMxc: mxc,
  });
  return mxc;
}

export async function uploadAndSendFile(
  roomId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<string> {
  const client = getClient();

  const { content_uri } = await client.uploadContent(file, {
    name: file.name,
    type: file.type,
    progressHandler: onProgress
      ? ({ loaded, total }: { loaded: number; total: number }) =>
          onProgress(loaded, total)
      : undefined,
  });

  const content: Record<string, unknown> = {
    msgtype: getMessageType(file.type),
    body: file.name,
    url: content_uri,
    info: { mimetype: file.type, size: file.size },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { event_id } = await client.sendMessage(roomId, content as any);
  return event_id ?? "";
}

export function mxcToHttp(
  mxcUri: string,
  width?: number,
  height?: number,
  resizeMethod?: "crop" | "scale",
): string | null {
  const client = getClient();
  // Only pass method when we actually want a thumbnail. matrix-js-sdk treats
  // any non-undefined method as "this is a thumbnail request" and routes to
  // /_matrix/.../thumbnail/, which servers reject without dimensions.
  const method = width || height ? resizeMethod ?? "scale" : undefined;
  return client.mxcUrlToHttp(mxcUri, width, height, method, false, true, true);
}

/**
 * Fetch a media resource using authenticated media endpoints, returning a
 * blob URL the renderer can drop into `<img src>`. Falls back to the legacy
 * unauthenticated URL if the auth fetch fails.
 *
 * Caller (typically `useAuthenticatedMedia`) is responsible for revoking the
 * blob URL when no longer needed.
 */
export async function fetchAuthenticatedMedia(
  mxcUri: string,
  width?: number,
  height?: number,
  resizeMethod?: "crop" | "scale",
): Promise<string | null> {
  const client = getClient();
  const accessToken = client.getAccessToken();
  // See note in mxcToHttp — passing a method without dimensions forces
  // matrix-js-sdk to generate a (malformed) thumbnail URL.
  const method = width || height ? resizeMethod ?? "scale" : undefined;

  const authUrl = client.mxcUrlToHttp(mxcUri, width, height, method, false, true, true);
  if (authUrl && accessToken) {
    try {
      const res = await fetch(authUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch {
      // fall through to legacy URL
    }
  }

  return client.mxcUrlToHttp(mxcUri, width, height, method, false, true, false);
}

function getMessageType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "m.image";
  if (mimeType.startsWith("video/")) return "m.video";
  if (mimeType.startsWith("audio/")) return "m.audio";
  return "m.file";
}
