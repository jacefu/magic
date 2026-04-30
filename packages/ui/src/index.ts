export { Placeholder } from "./components/Placeholder.js";

// Auth
export { LoginPage } from "./auth/LoginPage.js";
export { LoginForm } from "./auth/LoginForm.js";
export { SyncingScreen } from "./auth/SyncingScreen.js";
export { AuthGuard } from "./auth/AuthGuard.js";

// Layouts
export { MainLayout } from "./layouts/MainLayout.js";

// Rooms
export { RoomList } from "./rooms/RoomList.js";
export { RoomSection } from "./rooms/RoomSection.js";
export { RoomListItem } from "./rooms/RoomListItem.js";
export { RoomAvatar } from "./rooms/RoomAvatar.js";
export { UnreadBadge } from "./rooms/UnreadBadge.js";
export { RoomSearchInput } from "./rooms/RoomSearchInput.js";
export { CreateRoomDialog } from "./rooms/CreateRoomDialog.js";
export { JoinRoomDialog } from "./rooms/JoinRoomDialog.js";

// Common
export { DialogOverlay } from "./common/DialogOverlay.js";

// Hooks
export { useAuth } from "./hooks/useAuth.js";
export { useElectronAPI, isElectron } from "./hooks/useElectronAPI.js";
export { useFilteredRooms } from "./hooks/useFilteredRooms.js";
export type { RoomGroup } from "./hooks/useFilteredRooms.js";
