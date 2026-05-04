import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DialogOverlayProps {
  children: ReactNode;
  onClose: () => void;
}

// Portal-mounted so dialogs render at <body> level, escaping the
// `overflow-hidden` clipping that any of the left-rail / chat column
// flex containers apply. Without the portal, opening a dialog from
// inside the room list rail would clip the dialog at the rail's
// 240px width.
//
// The portal target is a per-instance <div> we own. Mounting straight
// to `document.body` works in browsers but trips a removeChild race
// against @testing-library's cleanup in happy-dom — the testing
// library's container holds a reference to the portal content and
// tries to detach it during unmount even though React already moved
// it to body. Owning the target ourselves lets React detach cleanly.
export function DialogOverlay({ children, onClose }: DialogOverlayProps) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  // Create + insert the portal host on mount, remove it on unmount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.setAttribute("data-magic-portal", "");
    document.body.appendChild(el);
    setPortalEl(el);
    return () => {
      el.remove();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!portalEl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      style={{
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    portalEl,
  );
}
