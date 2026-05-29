import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoomMembers, type RoomMember } from "./useRoomMembers.js";

interface UseMentionAutocompleteOptions {
  roomId: string;
  inputValue: string;
  cursorPosition: number;
}

export interface MentionCandidate {
  type: "user" | "room";
  member?: RoomMember;
  label: string;
}

export function useMentionAutocomplete({
  roomId,
  inputValue,
  cursorPosition,
}: UseMentionAutocompleteOptions) {
  const members = useRoomMembers(roomId);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Detect an unclosed "@..." prefix between cursor and the nearest whitespace/start.
  // Requires whitespace or line start before the @ so email addresses don't trigger.
  const mentionContext = useMemo(() => {
    const textBeforeCursor = inputValue.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(?:^|[\s\n])@([^\s@]*)$/);
    if (!match) {
      return { active: false, query: "", triggerIndex: -1 };
    }
    const query = match[1];
    const triggerIndex = textBeforeCursor.lastIndexOf("@" + query);
    return { active: true, query, triggerIndex };
  }, [inputValue, cursorPosition]);

  const candidates = useMemo<MentionCandidate[]>(() => {
    if (!mentionContext.active) return [];

    const q = mentionContext.query.toLowerCase();
    const result: MentionCandidate[] = [];

    if (q === "" || "全体".includes(q) || "all".includes(q) || "room".includes(q)) {
      result.push({ type: "room", label: "全体成员" });
    }

    // Skip self — @-mentioning yourself is never the user's intent.
    const filtered = members.filter((m) => {
      if (m.isSelf) return false;
      const name = m.displayName.toLowerCase();
      const userId = m.userId.toLowerCase();
      return name.includes(q) || userId.includes(q);
    });

    for (const member of filtered.slice(0, 10)) {
      result.push({ type: "user", member, label: member.displayName });
    }

    return result;
  }, [mentionContext.active, mentionContext.query, members]);

  // Reset highlight when the candidate list shape changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [candidates.length, mentionContext.query]);

  const navigateUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : candidates.length - 1));
  }, [candidates.length]);

  const navigateDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : 0));
  }, [candidates.length]);

  const selectCandidate = useCallback(
    (index?: number): { newValue: string; newCursorPos: number } | null => {
      const idx = index ?? selectedIndex;
      const candidate = candidates[idx];
      if (!candidate || mentionContext.triggerIndex < 0) return null;

      const before = inputValue.slice(0, mentionContext.triggerIndex);
      const after = inputValue.slice(cursorPosition);

      // Insert clean "@displayName " (no markdown brackets visible to the
      // user). The actual userId mapping is recovered at send time by
      // matching display names against the room's joined-member list —
      // see `resolveMentionsToPlaceholders` in useComposer.
      const insert =
        candidate.type === "room"
          ? "@全体 "
          : `@${candidate.member!.displayName} `;

      return {
        newValue: before + insert + after,
        newCursorPos: before.length + insert.length,
      };
    },
    [candidates, selectedIndex, mentionContext, inputValue, cursorPosition],
  );

  return {
    isOpen: mentionContext.active && candidates.length > 0,
    candidates,
    selectedIndex,
    navigateUp,
    navigateDown,
    selectCandidate,
  };
}
