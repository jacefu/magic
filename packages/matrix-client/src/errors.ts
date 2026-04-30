export class MagicClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MagicClientError";
  }
}

export class AuthError extends MagicClientError {
  constructor(message: string, cause?: unknown) {
    super(message, "AUTH_ERROR", cause);
    this.name = "AuthError";
  }
}

export class SyncError extends MagicClientError {
  constructor(message: string, cause?: unknown) {
    super(message, "SYNC_ERROR", cause);
    this.name = "SyncError";
  }
}

export class RoomError extends MagicClientError {
  constructor(message: string, cause?: unknown) {
    super(message, "ROOM_ERROR", cause);
    this.name = "RoomError";
  }
}
