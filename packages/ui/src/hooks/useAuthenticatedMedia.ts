import { useEffect, useState } from "react";
import { fetchAuthenticatedMedia } from "@magic/matrix-client";

/**
 * Resolve an MXC URI to a URL that `<img src>` can load. Uses the authenticated
 * media endpoint with a Bearer token, returning a blob URL; falls back to the
 * legacy unauthenticated URL when auth fails.
 */
export function useAuthenticatedMedia(
  mxcUri: string | null | undefined,
  width?: number,
  height?: number,
  method?: "crop" | "scale",
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mxcUri) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let createdBlob: string | null = null;

    fetchAuthenticatedMedia(mxcUri, width, height, method)
      .then((result) => {
        if (cancelled) {
          if (result?.startsWith("blob:")) URL.revokeObjectURL(result);
          return;
        }
        if (result?.startsWith("blob:")) createdBlob = result;
        setUrl(result);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      if (createdBlob) URL.revokeObjectURL(createdBlob);
    };
  }, [mxcUri, width, height, method]);

  return url;
}
