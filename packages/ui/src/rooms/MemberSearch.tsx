import { useCallback, useMemo, useRef, useState } from "react";
import { getClient, hasClient } from "@magic/matrix-client";

/**
 * Spec 020 FIX-2 + FIX-3 — search the Matrix user directory and let
 * the caller maintain a multi-select list of userIds. Used by
 * `CreateRoomDialog` (multi-invite) and `StartDMDialog` (single
 * recipient with `selectedUserIds.length === 1`).
 *
 * If the homeserver doesn't expose user-directory search or returns
 * nothing, the user can still paste a fully-qualified Matrix id
 * (`@user:server`) and we surface a "直接邀请" fallback button.
 */
interface DirectoryResult {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface MemberSearchProps {
  selectedUserIds: string[];
  onSelect: (userId: string) => void;
  onRemove: (userId: string) => void;
  placeholder?: string;
  /** Hide selected-tags row when caller manages chips themselves. */
  showSelectedChips?: boolean;
}

export function MemberSearch({
  selectedUserIds,
  onSelect,
  onRemove,
  placeholder = "输入用户名搜索…",
  showSelectedChips = true,
}: MemberSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce the homeserver call so we don't hit /user_directory on
  // every keystroke. 200ms is long enough that holding a key doesn't
  // fire 10 requests but short enough that the dropdown still feels
  // live while typing.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (term: string) => {
    if (!hasClient() || term.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const client = getClient();
      const response = await client.searchUserDirectory({ term, limit: 10 });
      setResults(
        response.results.map((r) => ({
          userId: r.user_id,
          displayName:
            r.display_name ??
            r.user_id.match(/^@([^:]+)/)?.[1] ??
            r.user_id,
          avatarUrl: r.avatar_url ?? null,
        })),
      );
    } catch (err) {
      console.error("搜索用户失败:", (err as Error).message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (next: string) => {
      setQuery(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (next.trim().length < 2) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      debounceRef.current = setTimeout(() => runSearch(next), 200);
    },
    [runSearch],
  );

  const selectedSet = useMemo(
    () => new Set(selectedUserIds),
    [selectedUserIds],
  );
  const filteredResults = useMemo(
    () => results.filter((r) => !selectedSet.has(r.userId)),
    [results, selectedSet],
  );

  const trimmedQuery = query.trim();
  const looksLikeMatrixId =
    trimmedQuery.startsWith("@") &&
    trimmedQuery.includes(":") &&
    !selectedSet.has(trimmedQuery);

  const handlePick = useCallback(
    (userId: string) => {
      onSelect(userId);
      setQuery("");
      setResults([]);
    },
    [onSelect],
  );

  return (
    <div>
      {showSelectedChips && selectedUserIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedUserIds.map((uid) => (
            <span
              key={uid}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
              }}
            >
              {uid.match(/^@([^:]+)/)?.[1] ?? uid}
              <button
                type="button"
                onClick={() => onRemove(uid)}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:text-[var(--text-primary)]"
                style={{ color: "var(--text-tertiary)" }}
                aria-label={`移除 ${uid}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors
                   focus:border-[var(--border-active)]"
        style={{
          background: "var(--bg-surface)",
          border: "0.5px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
      />

      {filteredResults.length > 0 && (
        <div
          className="mt-1 max-h-40 overflow-y-auto rounded-lg"
          style={{
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border-default)",
          }}
        >
          {filteredResults.map((user) => (
            <button
              key={user.userId}
              type="button"
              onClick={() => handlePick(user.userId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
                         hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-primary)" }}
            >
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: "var(--gradient-button)" }}
              >
                {user.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {user.displayName}
                </p>
                <p
                  className="truncate text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {user.userId}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isSearching && (
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          搜索中…
        </p>
      )}

      {looksLikeMatrixId && (
        <button
          type="button"
          onClick={() => handlePick(trimmedQuery)}
          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs transition-colors
                     hover:bg-[var(--bg-hover)]"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
        >
          直接邀请{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {trimmedQuery}
          </strong>
        </button>
      )}
    </div>
  );
}
