import { getClient } from "./client.js";

export async function startSync(options?: SyncOptions): Promise<void> {
  const client = getClient();
  await client.startClient({
    initialSyncLimit: options?.initialSyncLimit ?? 20,
    lazyLoadMembers: options?.lazyLoadMembers ?? true,
  });
}

export function stopSync(): void {
  const client = getClient();
  client.stopClient();
}

export interface SyncOptions {
  initialSyncLimit?: number;
  lazyLoadMembers?: boolean;
}
