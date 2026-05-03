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
const LINE_HEIGHT = 22;
// MIN_HEIGHT == LINE_HEIGHT (single line, no extra padding). The parent
// flex container uses items-center, so this single-line textarea is
// vertically centered against the icon row's 36px height.
const MIN_HEIGHT = LINE_HEIGHT;
const MAX_HEIGHT = LINE_HEIGHT * MAX_ROWS;

export const ComposerInput = forwardRef<HTMLTextAreaElement, ComposerInputProps>(
  function ComposerInput(
    { value, onChange, onSend, disabled, placeholder, roomId },
    ref,
  ) {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;
    const [cursorPosition, setCursorPosition] = useState(0);
    const [escapedAt, setEscapedAt] = useState<number | null>(null);

    // Spec 019 FIX-2 — Chinese / Japanese / Korean IMEs use Enter to
    // commit the candidate phrase. Without these guards, the same
    // Enter that confirms the IME selection also fires onSend(),
    // shipping a half-typed message. Three layers of protection:
    //   1. `e.nativeEvent.isComposing` — standard, set true while the
    //      composition session is open. Modern browsers all support it.
    //   2. `isComposingRef` — fallback for browsers/IMEs where (1)
    //      lies (older Safari has been known to).
    //   3. `justFinishedComposingRef` — Chrome/Safari fire a phantom
    //      `keydown` *immediately after* `compositionend` whose
    //      `isComposing` is already false. That ghost keystroke is the
    //      one that historically reached `onSend`. Block any Enter for
    //      a tick after compositionend.
    const isComposingRef = useRef(false);
    const justFinishedComposingRef = useRef(false);

    const handleCompositionStart = useCallback(() => {
      isComposingRef.current = true;
    }, []);

    const handleCompositionEnd = useCallback(() => {
      isComposingRef.current = false;
      justFinishedComposingRef.current = true;
      // setTimeout(0) flushes after the ghost keydown that some
      // browsers dispatch right after compositionend.
      setTimeout(() => {
        justFinishedComposingRef.current = false;
      }, 0);
    }, []);

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
        // Skip every Enter-driven branch (autocomplete-pick AND send)
        // while an IME composition is active or just ended. Other keys
        // like ArrowUp/Escape are still allowed through — those don't
        // ship a message.
        const enterDuringIME =
          e.key === "Enter" &&
          (e.nativeEvent.isComposing ||
            isComposingRef.current ||
            justFinishedComposingRef.current);
        if (enterDuringIME) return;

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
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onSelect={trackCursor}
          onClick={trackCursor}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="block w-full resize-none bg-transparent py-0 text-[15px]
                     text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
                     outline-none disabled:opacity-50"
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
