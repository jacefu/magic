import { useEffect, useRef } from "react";
import { MentionItem } from "./MentionItem.js";
import type { MentionCandidate } from "../hooks/useMentionAutocomplete.js";

interface MentionAutocompleteProps {
  isOpen: boolean;
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function MentionAutocomplete({
  isOpen,
  candidates,
  selectedIndex,
  onSelect,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const itemContainer = listRef.current.querySelector("[data-mention-list]");
    if (!itemContainer) return;
    const selected = itemContainer.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen || candidates.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-52 overflow-y-auto
                 rounded-xl border border-[var(--border-default)] bg-[var(--bg-glass)] shadow-xl"
      role="listbox"
    >
      <div className="border-b border-[var(--border-default)]-light px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          提及成员
        </span>
      </div>

      <div data-mention-list>
        {candidates.map((candidate, index) => (
          <MentionItem
            key={candidate.type === "room" ? "__room__" : candidate.member!.userId}
            candidate={candidate}
            isSelected={index === selectedIndex}
            onSelect={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}
