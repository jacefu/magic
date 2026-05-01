import { useState, useCallback, useEffect, useRef } from "react";
import { getClient, startDeviceVerification } from "@magic/matrix-client";
import type {
  VerificationRequest,
  Verifier,
  ShowSasCallbacks,
  EmojiMapping,
} from "matrix-js-sdk/lib/crypto-api";

export type VerificationPhase =
  | "idle"
  | "requested"
  | "ready"
  | "showing-sas"
  | "confirmed"
  | "done"
  | "cancelled"
  | "error";

interface SASData {
  emoji: EmojiMapping[];
}

const VERIFICATION_REQUEST_RECEIVED = "crypto.verificationRequestReceived";

export function useVerification() {
  const [phase, setPhase] = useState<VerificationPhase>("idle");
  const [sasData, setSasData] = useState<SASData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sasCallbacksRef = useRef<ShowSasCallbacks | null>(null);

  const wireVerifier = useCallback((verifier: Verifier) => {
    verifier.on("show_sas" as never, ((callbacks: ShowSasCallbacks) => {
      sasCallbacksRef.current = callbacks;
      setSasData({ emoji: callbacks.sas.emoji ?? [] });
      setPhase("showing-sas");
    }) as never);

    verifier.on("cancel" as never, ((e: Error | unknown) => {
      const msg = e instanceof Error ? e.message : "验证已取消";
      setError(msg);
      setPhase("cancelled");
    }) as never);

    verifier
      .verify()
      .then(() => setPhase("done"))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setPhase("error");
      });
  }, []);

  const handleIncomingRequest = useCallback(
    async (request: VerificationRequest) => {
      try {
        await request.accept();
        setPhase("ready");
        const verifier = await request.startVerification("m.sas.v1");
        wireVerifier(verifier);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setPhase("error");
      }
    },
    [wireVerifier],
  );

  useEffect(() => {
    let crypto: ReturnType<typeof import("matrix-js-sdk").MatrixClient.prototype.getCrypto>;
    try {
      crypto = getClient().getCrypto();
    } catch {
      return;
    }
    if (!crypto) return;

    const onRequest = (request: VerificationRequest) => {
      setPhase("requested");
      void handleIncomingRequest(request);
    };

    (crypto as unknown as {
      on: (event: string, fn: (req: VerificationRequest) => void) => void;
      off: (event: string, fn: (req: VerificationRequest) => void) => void;
    }).on(VERIFICATION_REQUEST_RECEIVED, onRequest);
    return () => {
      (crypto as unknown as {
        off: (event: string, fn: (req: VerificationRequest) => void) => void;
      }).off(VERIFICATION_REQUEST_RECEIVED, onRequest);
    };
  }, [handleIncomingRequest]);

  const requestVerification = useCallback(
    async (userId: string, deviceId: string) => {
      setPhase("requested");
      setError(null);
      setSasData(null);

      try {
        const request = await startDeviceVerification(userId, deviceId);
        setPhase("ready");
        const verifier = await request.startVerification("m.sas.v1");
        wireVerifier(verifier);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setPhase("error");
      }
    },
    [wireVerifier],
  );

  const confirmSas = useCallback(async () => {
    const cb = sasCallbacksRef.current;
    if (!cb) return;
    setPhase("confirmed");
    try {
      await cb.confirm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
    }
  }, []);

  const rejectSas = useCallback(() => {
    const cb = sasCallbacksRef.current;
    if (cb) {
      try {
        cb.mismatch();
      } catch {
        // ignore
      }
    }
    setPhase("cancelled");
    setError("emoji 不匹配，验证已取消");
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setSasData(null);
    setError(null);
    sasCallbacksRef.current = null;
  }, []);

  return {
    phase,
    sasData,
    error,
    requestVerification,
    confirmSas,
    rejectSas,
    reset,
  };
}
