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

// Chat
export { ChatView } from "./chat/ChatView.js";
export { ChatHeader } from "./chat/ChatHeader.js";
export { ChatTimeline } from "./chat/ChatTimeline.js";
export { MessageBubble } from "./chat/MessageBubble.js";
export { MessageContent } from "./chat/MessageContent.js";
export { TextMessage } from "./chat/TextMessage.js";
export { ImageMessage } from "./chat/ImageMessage.js";
export { FileMessage } from "./chat/FileMessage.js";
export { DateSeparator } from "./chat/DateSeparator.js";
export { TypingIndicator } from "./chat/TypingIndicator.js";
export { NewMessageButton } from "./chat/NewMessageButton.js";
export { EmptyRoom } from "./chat/EmptyRoom.js";
export { MessageComposer } from "./chat/MessageComposer.js";
export { ComposerInput } from "./chat/ComposerInput.js";
export { ComposerToolbar } from "./chat/ComposerToolbar.js";
export { ReplyPreview } from "./chat/ReplyPreview.js";

// Hooks
export { useAuth } from "./hooks/useAuth.js";
export { useElectronAPI, isElectron } from "./hooks/useElectronAPI.js";
export { useFilteredRooms } from "./hooks/useFilteredRooms.js";
export type { RoomGroup } from "./hooks/useFilteredRooms.js";
export { useTimeline } from "./hooks/useTimeline.js";
export type { TimelineItem } from "./hooks/useTimeline.js";
export { useComposer } from "./hooks/useComposer.js";
export { useTypingNotifier } from "./hooks/useTypingNotifier.js";
export { useEncryptionStatus } from "./hooks/useEncryptionStatus.js";
export { useVerification } from "./hooks/useVerification.js";
export type { VerificationPhase } from "./hooks/useVerification.js";

// Files
export { FileUploadPreview } from "./files/FileUploadPreview.js";
export { UploadProgressBar } from "./files/UploadProgressBar.js";
export { DropZoneOverlay } from "./files/DropZoneOverlay.js";
export { useFileUpload } from "./hooks/useFileUpload.js";
export { useAuthenticatedMedia } from "./hooks/useAuthenticatedMedia.js";
export type { UploadTask } from "./hooks/useFileUpload.js";
export { useDragDrop } from "./hooks/useDragDrop.js";
export { usePasteFile } from "./hooks/usePasteFile.js";

// Crypto
export { EncryptionBadge } from "./crypto/EncryptionBadge.js";
export { UndecryptedMessage } from "./crypto/UndecryptedMessage.js";
export { VerificationEmojiGrid } from "./crypto/VerificationEmojiGrid.js";
export { DeviceVerificationDialog } from "./crypto/DeviceVerificationDialog.js";
export { DeviceListPanel } from "./crypto/DeviceListPanel.js";
