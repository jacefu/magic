import { useMemo } from "react";
import { useThemeMode } from "../hooks/useThemeMode.js";
import { getDefaultAvatarLetter } from "./getDefaultAvatarLetter.js";

// Spec 023 §5 — 26 letters × 2 themes = 52 explicit static imports.
// Vite/Webpack hash + emit each one as a real asset URL; the
// alternative `import.meta.glob` would inline the same 52 URLs but
// hide the binding from "find all references" tooling, so we keep
// the explicit list.
import lightA from "../assets/letters/light/A.png";
import lightB from "../assets/letters/light/B.png";
import lightC from "../assets/letters/light/C.png";
import lightD from "../assets/letters/light/D.png";
import lightE from "../assets/letters/light/E.png";
import lightF from "../assets/letters/light/F.png";
import lightG from "../assets/letters/light/G.png";
import lightH from "../assets/letters/light/H.png";
import lightI from "../assets/letters/light/I.png";
import lightJ from "../assets/letters/light/J.png";
import lightK from "../assets/letters/light/K.png";
import lightL from "../assets/letters/light/L.png";
import lightM from "../assets/letters/light/M.png";
import lightN from "../assets/letters/light/N.png";
import lightO from "../assets/letters/light/O.png";
import lightP from "../assets/letters/light/P.png";
import lightQ from "../assets/letters/light/Q.png";
import lightR from "../assets/letters/light/R.png";
import lightS from "../assets/letters/light/S.png";
import lightT from "../assets/letters/light/T.png";
import lightU from "../assets/letters/light/U.png";
import lightV from "../assets/letters/light/V.png";
import lightW from "../assets/letters/light/W.png";
import lightX from "../assets/letters/light/X.png";
import lightY from "../assets/letters/light/Y.png";
import lightZ from "../assets/letters/light/Z.png";

import darkA from "../assets/letters/dark/A.png";
import darkB from "../assets/letters/dark/B.png";
import darkC from "../assets/letters/dark/C.png";
import darkD from "../assets/letters/dark/D.png";
import darkE from "../assets/letters/dark/E.png";
import darkF from "../assets/letters/dark/F.png";
import darkG from "../assets/letters/dark/G.png";
import darkH from "../assets/letters/dark/H.png";
import darkI from "../assets/letters/dark/I.png";
import darkJ from "../assets/letters/dark/J.png";
import darkK from "../assets/letters/dark/K.png";
import darkL from "../assets/letters/dark/L.png";
import darkM from "../assets/letters/dark/M.png";
import darkN from "../assets/letters/dark/N.png";
import darkO from "../assets/letters/dark/O.png";
import darkP from "../assets/letters/dark/P.png";
import darkQ from "../assets/letters/dark/Q.png";
import darkR from "../assets/letters/dark/R.png";
import darkS from "../assets/letters/dark/S.png";
import darkT from "../assets/letters/dark/T.png";
import darkU from "../assets/letters/dark/U.png";
import darkV from "../assets/letters/dark/V.png";
import darkW from "../assets/letters/dark/W.png";
import darkX from "../assets/letters/dark/X.png";
import darkY from "../assets/letters/dark/Y.png";
import darkZ from "../assets/letters/dark/Z.png";

const LIGHT_LETTERS: Record<string, string> = {
  A: lightA,
  B: lightB,
  C: lightC,
  D: lightD,
  E: lightE,
  F: lightF,
  G: lightG,
  H: lightH,
  I: lightI,
  J: lightJ,
  K: lightK,
  L: lightL,
  M: lightM,
  N: lightN,
  O: lightO,
  P: lightP,
  Q: lightQ,
  R: lightR,
  S: lightS,
  T: lightT,
  U: lightU,
  V: lightV,
  W: lightW,
  X: lightX,
  Y: lightY,
  Z: lightZ,
};

const DARK_LETTERS: Record<string, string> = {
  A: darkA,
  B: darkB,
  C: darkC,
  D: darkD,
  E: darkE,
  F: darkF,
  G: darkG,
  H: darkH,
  I: darkI,
  J: darkJ,
  K: darkK,
  L: darkL,
  M: darkM,
  N: darkN,
  O: darkO,
  P: darkP,
  Q: darkQ,
  R: darkR,
  S: darkS,
  T: darkT,
  U: darkU,
  V: darkV,
  W: darkW,
  X: darkX,
  Y: darkY,
  Z: darkZ,
};

interface LetterAvatarProps {
  name: string;
  userId?: string;
  /** Required — drives the digit / unmappable-name fallback. Agents
   *  fall back to 'A', humans to 'H'. */
  isAgent: boolean;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Spec 023 §5 — default avatar component.
 *
 * Letter mapping is delegated to `getDefaultAvatarLetter`:
 *   - English / pinyin / digit / userId fallback rules in priority.
 *
 * Theme is observed via `useThemeMode` so flipping dark/light at
 * runtime swaps the underlying PNG without remounting.
 */
export function LetterAvatar({
  name,
  userId,
  isAgent,
  size = 36,
  className = "",
  alt,
}: LetterAvatarProps) {
  const theme = useThemeMode();

  const letter = useMemo(
    () => getDefaultAvatarLetter(name, isAgent, userId),
    [name, isAgent, userId],
  );

  const map = theme === "dark" ? DARK_LETTERS : LIGHT_LETTERS;
  const letterUrl = map[letter] ?? map.A;

  return (
    <img
      src={letterUrl}
      alt={alt ?? name}
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
      }}
      draggable={false}
    />
  );
}
