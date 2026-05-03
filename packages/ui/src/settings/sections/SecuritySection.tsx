import { DeviceListPanel } from "../../crypto/DeviceListPanel.js";

export function SecuritySection() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">已登录设备</h3>
        <p className="text-xs text-[var(--text-secondary)]">
          管理当前账号下所有已登录的设备。删除某个设备会强制其下次启动重新登录。
        </p>
      </div>
      <DeviceListPanel />
    </div>
  );
}
