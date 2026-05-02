import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore } from "../../src/stores/notificationStore.js";

beforeEach(() => {
  useNotificationStore.getState().reset();
});

describe("notificationStore", () => {
  describe("defaults", () => {
    it("starts at level=all, dnd=off, sound=on, no muted rooms, zero counts", () => {
      const s = useNotificationStore.getState();
      expect(s.level).toBe("all");
      expect(s.dnd).toBe(false);
      expect(s.soundEnabled).toBe(true);
      expect(s.mutedRooms.size).toBe(0);
      expect(s.totalUnreadCount).toBe(0);
      expect(s.totalMentionCount).toBe(0);
    });
  });

  describe("level / dnd / sound toggles", () => {
    it("setLevel updates level", () => {
      useNotificationStore.getState().setLevel("mentions");
      expect(useNotificationStore.getState().level).toBe("mentions");
      useNotificationStore.getState().setLevel("mute");
      expect(useNotificationStore.getState().level).toBe("mute");
    });

    it("setDnd toggles dnd", () => {
      useNotificationStore.getState().setDnd(true);
      expect(useNotificationStore.getState().dnd).toBe(true);
    });

    it("setSoundEnabled toggles sound", () => {
      useNotificationStore.getState().setSoundEnabled(false);
      expect(useNotificationStore.getState().soundEnabled).toBe(false);
    });
  });

  describe("muteRoom / unmuteRoom / isRoomMuted", () => {
    it("muteRoom adds the roomId; isRoomMuted returns true", () => {
      useNotificationStore.getState().muteRoom("!a:x");
      expect(useNotificationStore.getState().isRoomMuted("!a:x")).toBe(true);
      expect(useNotificationStore.getState().isRoomMuted("!b:x")).toBe(false);
    });

    it("unmuteRoom removes the roomId", () => {
      useNotificationStore.getState().muteRoom("!a:x");
      useNotificationStore.getState().unmuteRoom("!a:x");
      expect(useNotificationStore.getState().isRoomMuted("!a:x")).toBe(false);
    });

    it("muteRoom is idempotent", () => {
      useNotificationStore.getState().muteRoom("!a:x");
      useNotificationStore.getState().muteRoom("!a:x");
      expect(useNotificationStore.getState().mutedRooms.size).toBe(1);
    });

    it("muteRoom replaces the Set so subscribers can detect the change", () => {
      const before = useNotificationStore.getState().mutedRooms;
      useNotificationStore.getState().muteRoom("!a:x");
      const after = useNotificationStore.getState().mutedRooms;
      expect(after).not.toBe(before); // immutable update
    });
  });

  describe("setUnreadCounts", () => {
    it("updates total unread + mention counts", () => {
      useNotificationStore.getState().setUnreadCounts(7, 2);
      const s = useNotificationStore.getState();
      expect(s.totalUnreadCount).toBe(7);
      expect(s.totalMentionCount).toBe(2);
    });
  });

  describe("reset", () => {
    it("returns the store to defaults", () => {
      useNotificationStore.getState().setLevel("mentions");
      useNotificationStore.getState().setDnd(true);
      useNotificationStore.getState().setSoundEnabled(false);
      useNotificationStore.getState().muteRoom("!a:x");
      useNotificationStore.getState().setUnreadCounts(5, 1);

      useNotificationStore.getState().reset();

      const s = useNotificationStore.getState();
      expect(s.level).toBe("all");
      expect(s.dnd).toBe(false);
      expect(s.soundEnabled).toBe(true);
      expect(s.mutedRooms.size).toBe(0);
      expect(s.totalUnreadCount).toBe(0);
      expect(s.totalMentionCount).toBe(0);
    });
  });
});
