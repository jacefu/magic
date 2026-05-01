import { useState, useEffect } from "react";
import { getRoomEncryptionStatus, type RoomEncryptionStatus } from "@magic/matrix-client";

export function useEncryptionStatus(roomId: string | null) {
  const [status, setStatus] = useState<RoomEncryptionStatus>("unknown");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomId) {
      setStatus("unknown");
      return;
    }

    let cancelled = false;
    setLoading(true);

    getRoomEncryptionStatus(roomId)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus("unknown");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return { status, loading };
}
