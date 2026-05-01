import { useRef } from "react";

interface RoomSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

// Sidebar search per design-system § 4.1: sunken into bg-secondary using
// bg-tertiary (#1E1F22), small radius, compact height.
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
        className="w-full rounded border border-[#1E1F22] bg-[#1E1F22]
                   py-1 pl-7 pr-2 text-xs text-[#DBDEE1] placeholder:text-[#6D6F78]
                   focus:border-[#5865F2] focus:outline-none focus:ring-1
                   focus:ring-[#5865F2]/40"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#949BA4]
                     hover:text-[#DBDEE1]"
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
      className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6D6F78]"
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
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
