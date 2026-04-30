import { Tray, Menu, nativeImage, type BrowserWindow, app } from "electron";
import { join } from "path";

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = join(
    app.isPackaged ? process.resourcesPath : join(__dirname, "../../build"),
    process.platform === "darwin" ? "tray-icon-mac.png" : "tray-icon.png",
  );

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch {
    icon = nativeImage.createEmpty();
  }

  if (process.platform === "darwin") {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip("MAGIC Client");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示 MAGIC Client",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

export function updateTrayBadge(count: number): void {
  if (process.platform === "darwin") {
    app.dock?.setBadge(count > 0 ? String(count) : "");
  }
  if (tray) {
    tray.setTitle(count > 0 ? ` ${count}` : "");
  }
}
