import { getClient } from "./client.js";

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
  return client.mxcUrlToHttp(mxcUri, width, height, resizeMethod ?? "scale", false, true, true);
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
  const method = resizeMethod ?? "scale";

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
