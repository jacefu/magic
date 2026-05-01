import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk";
import { usePresenceStore, type PresenceState } from "./stores/presenceStore.js";

/**
 * Subscribe to Matrix `m.presence` events and feed `presenceStore`. Called
 * from `bridgeToStores`. Returns a cleanup function.
 *
 * Note: presence is server-driven — the homeserver pushes `m.presence`
 * events as users come online / go idle / log out. Tuwunel may have
 * presence disabled; in that case nothing arrives here and humans default
 * to `offline` per `agentDetection.getHumanOnlineStatus`.
 */
export function bridgePresence(client: MatrixClient): () => void {
  const onEvent = (event: MatrixEvent) => {
    if (event.getType() !== "m.presence") return;
    const sender = event.getSender();
    const content = event.getContent() as {
      presence?: PresenceState;
      last_active_ago?: number;
      currently_active?: boolean;
      status_msg?: string;
    };
    if (!sender || !content.presence) return;

    usePresenceStore.getState().setPresence(sender, {
      presence: content.presence,
      lastActiveAgo: content.last_active_ago,
      currentlyActive: content.currently_active,
      statusMsg: content.status_msg,
    });
  };

  // matrix-js-sdk's "event" emits every event the client receives.
  // Cast: the typed event map doesn't include this generic name.
  (client as unknown as {
    on(name: "event", handler: (e: MatrixEvent) => void): void;
    off(name: "event", handler: (e: MatrixEvent) => void): void;
  }).on("event", onEvent);

  return () => {
    (client as unknown as {
      off(name: "event", handler: (e: MatrixEvent) => void): void;
    }).off("event", onEvent);
  };
}
