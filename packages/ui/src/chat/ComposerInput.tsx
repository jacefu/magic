import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useMentionAutocomplete } from "../hooks/useMentionAutocomplete.js";
import { MentionAutocomplete } from "../mentions/MentionAutocomplete.js";

interface ComposerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  roomId: string;
}

const MAX_ROWS = 6;
const LINE_HEIGHT = 20;
const MIN_HEIGHT = LINE_HEIGHT + 8;
const MAX_HEIGHT = LINE_HEIGHT * MAX_ROWS + 8;

export const ComposerInput = forwardRef<HTMLTextAreaElement, ComposerInputProps>(
  function ComposerInput(
    { value, onChange, onSend, disabled, placeholder, roomId },
    ref,
  ) {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;
    const [cursorPosition, setCursorPosition] = useState(0);
    const [escapedAt, setEscapedAt] = useState<number | null>(null);

    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = `${MIN_HEIGHT}px`;
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, MAX_HEIGHT)}px`;
    }, [textareaRef]);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    const {
      isOpen,
      candidates,
      selectedIndex,
      navigateUp,
      navigateDown,
      selectCandidate,
    } = useMentionAutocomplete({
      roomId,
      inputValue: value,
      cursorPosition,
    });

    // Esc keeps the autocomplete suppressed until the user edits (any change to
    // the value clears the suppression). Compare lengths so reopening @ later
    // works as expected.
    const suppressed = escapedAt !== null && escapedAt === value.length;
    const autocompleteOpen = isOpen && !suppressed;

    const applyCandidate = useCallback(
      (index?: number) => {
        const result = selectCandidate(index);
        if (!result) return;
        onChange(result.newValue);
        setEscapedAt(null);
        requestAnimationFrame(() => {
          const textarea = textareaRef.current;
          if (!textarea) return;
          textarea.selectionStart = result.newCursorPos;
          textarea.selectionEnd = result.newCursorPos;
          setCursorPosition(result.newCursorPos);
          textarea.focus();
        });
      },
      [selectCandidate, onChange, textareaRef],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (autocompleteOpen) {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            navigateUp();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            navigateDown();
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            applyCandidate();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEscapedAt(value.length);
            return;
          }
        }

        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onSend();
          return;
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSend();
          return;
        }
      },
      [
        autocompleteOpen,
        navigateUp,
        navigateDown,
        applyCandidate,
        onSend,
        value.length,
      ],
    );

    const trackCursor = useCallback(
      (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursorPosition((e.target as HTMLTextAreaElement).selectionStart);
      },
      [],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        setCursorPosition(e.target.selectionStart);
        setEscapedAt(null);
      },
      [onChange],
    );

    return (
      <div className="relative flex-1">
        <MentionAutocomplete
          isOpen={autocompleteOpen}
          candidates={candidates}
          selectedIndex={selectedIndex}
          onSelect={(index) => applyCandidate(index)}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={trackCursor}
          onClick={trackCursor}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent text-[13px] text-[#DBDEE1]
                     placeholder:text-[#6D6F78] outline-none disabled:opacity-50"
          style={{
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
            lineHeight: `${LINE_HEIGHT}px`,
          }}
        />
      </div>
    );
  },
);
