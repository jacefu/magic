import { useThemeMode } from "../hooks/useThemeMode.js";
import iconLight from "../assets/app-icon/icon-light.png";
import iconDark from "../assets/app-icon/icon-dark.png";

interface MagicAppIconProps {
  size?: number;
  className?: string;
}

/**
 * Spec 023 §6.2 — Magic app logo that follows the in-app theme.
 *
 * Used wherever the Magic logo appears inside the running app
 * (top-left workspace switcher, settings page, about dialog, …).
 * The OS-level icons (dock / taskbar / favicon) are configured
 * separately and don't pivot on theme.
 */
export function MagicAppIcon({ size = 32, className = "" }: MagicAppIconProps) {
  const theme = useThemeMode();
  const src = theme === "dark" ? iconDark : iconLight;

  return (
    <img
      src={src}
      alt="Magic"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );
}
