import { useRef } from "react";

interface RoomSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function RoomSearchInput({ value, onChange }: RoomSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex-1">
      <SearchIcon />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索房间…"
        className="w-full rounded-lg border border-gray-700 bg-magic-surface
                   py-1.5 pl-8 pr-3 text-sm text-white placeholder-gray-500
                   focus:border-magic-primary focus:outline-none focus:ring-1
                   focus:ring-magic-primary"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500
                     hover:text-gray-300"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
