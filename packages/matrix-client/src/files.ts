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

function getMessageType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "m.image";
  if (mimeType.startsWith("video/")) return "m.video";
  if (mimeType.startsWith("audio/")) return "m.audio";
  return "m.file";
}
