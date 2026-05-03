import { useEffect, useMemo, useRef, useState } from "react";

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  /** Anchor element used for outside-click detection. */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/**
 * Lightweight inline emoji picker — curated list of common emoji organised
 * into categories. Avoids pulling in a 5MB picker library for what is
 * essentially "send a smiley". Search filters across the visible emoji
 * keywords. Click outside or Escape to close.
 */
export function EmojiPicker({
  open,
  onClose,
  onPick,
  anchorRef,
}: EmojiPickerProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] =
    useState<EmojiCategory["key"]>("smileys");
  const [query, setQuery] = useState("");

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  // Reset filter on open so the user always starts on the categories view.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const visibleEmoji = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return EMOJI_CATEGORIES.find((c) => c.key === activeCategory)?.emojis ??
        [];
    }
    // Cross-category search by keyword
    const matches: EmojiEntry[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emojis) {
        if (
          e.char.includes(q) ||
          e.keywords.some((k) => k.includes(q))
        ) {
          matches.push(e);
        }
      }
    }
    return matches;
  }, [query, activeCategory]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      className="absolute bottom-full right-0 mb-2 w-[320px] overflow-hidden
                 rounded-lg border border-[var(--border-default)] bg-[var(--bg-glass)] shadow-2xl"
    >
      {/* Search */}
      <div className="border-b border-[var(--border-default)] p-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索 emoji"
          className="w-full rounded bg-[var(--bg-deepest)] px-2 py-1.5 text-[13px]
                     text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        />
      </div>

      {/* Categories */}
      {!query && (
        <div className="flex border-b border-[var(--border-default)]">
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              title={c.label}
              className={`flex flex-1 items-center justify-center py-1.5
                          text-[15px] transition-colors ${
                            activeCategory === c.key
                              ? "bg-[var(--ws-icon-bg)] text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                          }`}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="max-h-[300px] overflow-y-auto p-1">
        {visibleEmoji.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
            没有找到匹配的 emoji
          </p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {visibleEmoji.map((e) => (
              <button
                key={e.char + e.keywords[0]}
                title={e.keywords[0]}
                onClick={() => onPick(e.char)}
                className="flex h-8 w-8 items-center justify-center rounded
                           text-[20px] transition-colors hover:bg-[var(--bg-surface)]"
              >
                {e.char}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EmojiEntry {
  char: string;
  keywords: string[];
}

interface EmojiCategory {
  key: "smileys" | "gestures" | "hearts" | "animals" | "food" | "objects" | "symbols";
  label: string;
  icon: string;
  emojis: EmojiEntry[];
}

// Curated, keyboard-typeable subset of common emojis. Intentionally not
// exhaustive — pulling the full Unicode emoji list would balloon the
// bundle. Add more as needed.
const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: "smileys",
    label: "笑脸",
    icon: "😀",
    emojis: [
      { char: "😀", keywords: ["grin", "smile", "笑"] },
      { char: "😁", keywords: ["beam", "笑"] },
      { char: "😂", keywords: ["joy", "tears", "笑哭"] },
      { char: "🤣", keywords: ["rofl", "笑"] },
      { char: "😃", keywords: ["smile", "笑"] },
      { char: "😄", keywords: ["smile", "笑"] },
      { char: "😅", keywords: ["sweat", "汗"] },
      { char: "😆", keywords: ["laugh", "笑"] },
      { char: "😉", keywords: ["wink", "眨眼"] },
      { char: "😊", keywords: ["blush", "害羞"] },
      { char: "😋", keywords: ["yum", "好吃"] },
      { char: "😎", keywords: ["cool", "酷"] },
      { char: "😍", keywords: ["love", "爱"] },
      { char: "🥰", keywords: ["love", "爱"] },
      { char: "😘", keywords: ["kiss", "亲"] },
      { char: "🤔", keywords: ["thinking", "思考"] },
      { char: "🤨", keywords: ["raised_brow", "怀疑"] },
      { char: "😐", keywords: ["neutral", "面无表情"] },
      { char: "😑", keywords: ["expressionless"] },
      { char: "😶", keywords: ["no_mouth", "无言"] },
      { char: "😏", keywords: ["smirk"] },
      { char: "😒", keywords: ["unamused"] },
      { char: "🙄", keywords: ["roll_eyes", "翻白眼"] },
      { char: "😬", keywords: ["grimace"] },
      { char: "🤐", keywords: ["zipper"] },
      { char: "😴", keywords: ["sleep", "睡"] },
      { char: "🤤", keywords: ["drool"] },
      { char: "😪", keywords: ["sleepy", "困"] },
      { char: "😵", keywords: ["dizzy", "晕"] },
      { char: "🤯", keywords: ["mind_blown"] },
      { char: "🤠", keywords: ["cowboy"] },
      { char: "🥳", keywords: ["party", "庆祝"] },
      { char: "😢", keywords: ["cry", "哭"] },
      { char: "😭", keywords: ["sob", "哭"] },
      { char: "😡", keywords: ["angry", "怒"] },
      { char: "🤬", keywords: ["cursing", "怒"] },
      { char: "🥵", keywords: ["hot", "热"] },
      { char: "🥶", keywords: ["cold", "冷"] },
      { char: "🤒", keywords: ["sick", "病"] },
      { char: "🤧", keywords: ["sneeze"] },
    ],
  },
  {
    key: "gestures",
    label: "手势",
    icon: "👋",
    emojis: [
      { char: "👋", keywords: ["wave", "你好"] },
      { char: "🤚", keywords: ["raised_hand"] },
      { char: "✋", keywords: ["hand", "停"] },
      { char: "👌", keywords: ["ok"] },
      { char: "🤌", keywords: ["pinched"] },
      { char: "✌️", keywords: ["peace", "胜利"] },
      { char: "🤞", keywords: ["fingers_crossed", "祈祷"] },
      { char: "🤟", keywords: ["love_you"] },
      { char: "🤘", keywords: ["rock"] },
      { char: "👈", keywords: ["point_left"] },
      { char: "👉", keywords: ["point_right"] },
      { char: "👆", keywords: ["point_up"] },
      { char: "👇", keywords: ["point_down"] },
      { char: "👍", keywords: ["thumbs_up", "赞"] },
      { char: "👎", keywords: ["thumbs_down", "踩"] },
      { char: "👏", keywords: ["clap", "鼓掌"] },
      { char: "🙌", keywords: ["raised_hands", "庆祝"] },
      { char: "🙏", keywords: ["pray", "拜托", "感谢"] },
      { char: "💪", keywords: ["muscle", "加油"] },
      { char: "🤝", keywords: ["handshake", "握手"] },
      { char: "✍️", keywords: ["writing", "写"] },
      { char: "🫡", keywords: ["salute", "敬礼"] },
    ],
  },
  {
    key: "hearts",
    label: "爱心",
    icon: "❤️",
    emojis: [
      { char: "❤️", keywords: ["heart", "爱"] },
      { char: "🧡", keywords: ["orange_heart"] },
      { char: "💛", keywords: ["yellow_heart"] },
      { char: "💚", keywords: ["green_heart"] },
      { char: "💙", keywords: ["blue_heart"] },
      { char: "💜", keywords: ["purple_heart"] },
      { char: "🖤", keywords: ["black_heart"] },
      { char: "🤍", keywords: ["white_heart"] },
      { char: "🤎", keywords: ["brown_heart"] },
      { char: "💔", keywords: ["broken_heart"] },
      { char: "❣️", keywords: ["heart_exclamation"] },
      { char: "💕", keywords: ["two_hearts"] },
      { char: "💞", keywords: ["revolving_hearts"] },
      { char: "💓", keywords: ["beating_heart"] },
      { char: "💗", keywords: ["growing_heart"] },
      { char: "💖", keywords: ["sparkling_heart"] },
      { char: "💘", keywords: ["heart_arrow"] },
      { char: "💝", keywords: ["heart_gift"] },
      { char: "💟", keywords: ["heart_decoration"] },
    ],
  },
  {
    key: "animals",
    label: "动物",
    icon: "🐶",
    emojis: [
      { char: "🐶", keywords: ["dog", "狗"] },
      { char: "🐱", keywords: ["cat", "猫"] },
      { char: "🐭", keywords: ["mouse", "鼠"] },
      { char: "🐹", keywords: ["hamster"] },
      { char: "🐰", keywords: ["rabbit", "兔"] },
      { char: "🦊", keywords: ["fox"] },
      { char: "🐻", keywords: ["bear", "熊"] },
      { char: "🐼", keywords: ["panda", "熊猫"] },
      { char: "🐨", keywords: ["koala"] },
      { char: "🐯", keywords: ["tiger", "虎"] },
      { char: "🦁", keywords: ["lion"] },
      { char: "🐮", keywords: ["cow", "牛"] },
      { char: "🐷", keywords: ["pig", "猪"] },
      { char: "🐸", keywords: ["frog"] },
      { char: "🐵", keywords: ["monkey", "猴"] },
      { char: "🦄", keywords: ["unicorn"] },
      { char: "🐔", keywords: ["chicken", "鸡"] },
      { char: "🐧", keywords: ["penguin"] },
      { char: "🐦", keywords: ["bird", "鸟"] },
      { char: "🦋", keywords: ["butterfly"] },
    ],
  },
  {
    key: "food",
    label: "食物",
    icon: "🍕",
    emojis: [
      { char: "🍎", keywords: ["apple", "苹果"] },
      { char: "🍊", keywords: ["orange"] },
      { char: "🍋", keywords: ["lemon"] },
      { char: "🍌", keywords: ["banana", "香蕉"] },
      { char: "🍉", keywords: ["watermelon"] },
      { char: "🍇", keywords: ["grapes"] },
      { char: "🍓", keywords: ["strawberry"] },
      { char: "🥝", keywords: ["kiwi"] },
      { char: "🍅", keywords: ["tomato"] },
      { char: "🍔", keywords: ["burger"] },
      { char: "🍟", keywords: ["fries"] },
      { char: "🍕", keywords: ["pizza"] },
      { char: "🌭", keywords: ["hotdog"] },
      { char: "🍿", keywords: ["popcorn"] },
      { char: "🍱", keywords: ["bento"] },
      { char: "🍙", keywords: ["riceball"] },
      { char: "🍣", keywords: ["sushi"] },
      { char: "🍜", keywords: ["ramen"] },
      { char: "🍦", keywords: ["icecream"] },
      { char: "🍰", keywords: ["cake"] },
      { char: "🍪", keywords: ["cookie"] },
      { char: "🍩", keywords: ["donut"] },
      { char: "🍫", keywords: ["chocolate"] },
      { char: "🍺", keywords: ["beer"] },
      { char: "🍷", keywords: ["wine"] },
      { char: "☕", keywords: ["coffee", "咖啡"] },
      { char: "🍵", keywords: ["tea", "茶"] },
    ],
  },
  {
    key: "objects",
    label: "物品",
    icon: "💡",
    emojis: [
      { char: "💡", keywords: ["bulb", "想法"] },
      { char: "🔥", keywords: ["fire", "火"] },
      { char: "⭐", keywords: ["star"] },
      { char: "🌟", keywords: ["sparkle"] },
      { char: "✨", keywords: ["sparkles"] },
      { char: "💯", keywords: ["100"] },
      { char: "💢", keywords: ["anger"] },
      { char: "💥", keywords: ["boom"] },
      { char: "💦", keywords: ["sweat"] },
      { char: "💨", keywords: ["dash"] },
      { char: "🎉", keywords: ["party"] },
      { char: "🎊", keywords: ["confetti"] },
      { char: "🎁", keywords: ["gift", "礼物"] },
      { char: "🏆", keywords: ["trophy"] },
      { char: "🎯", keywords: ["target"] },
      { char: "🔔", keywords: ["bell"] },
      { char: "📣", keywords: ["megaphone"] },
      { char: "💎", keywords: ["gem"] },
      { char: "🔑", keywords: ["key"] },
      { char: "🚀", keywords: ["rocket"] },
      { char: "🎵", keywords: ["music"] },
      { char: "📷", keywords: ["camera"] },
      { char: "💻", keywords: ["laptop"] },
      { char: "📱", keywords: ["phone"] },
      { char: "⏰", keywords: ["alarm"] },
      { char: "📌", keywords: ["pin"] },
      { char: "📎", keywords: ["clip"] },
      { char: "📝", keywords: ["memo"] },
      { char: "✅", keywords: ["check"] },
      { char: "❌", keywords: ["cross"] },
      { char: "⚠️", keywords: ["warning"] },
      { char: "❓", keywords: ["question"] },
      { char: "❗", keywords: ["exclamation"] },
    ],
  },
  {
    key: "symbols",
    label: "符号",
    icon: "🔢",
    emojis: [
      { char: "👀", keywords: ["eyes"] },
      { char: "🌈", keywords: ["rainbow"] },
      { char: "☀️", keywords: ["sun"] },
      { char: "🌙", keywords: ["moon"] },
      { char: "⛄", keywords: ["snowman"] },
      { char: "🌍", keywords: ["earth"] },
      { char: "🌹", keywords: ["rose"] },
      { char: "🌷", keywords: ["tulip"] },
      { char: "🌸", keywords: ["blossom"] },
      { char: "🍀", keywords: ["clover", "幸运"] },
      { char: "🍃", keywords: ["leaf"] },
      { char: "🎈", keywords: ["balloon"] },
      { char: "🎂", keywords: ["birthday"] },
      { char: "🚗", keywords: ["car"] },
      { char: "✈️", keywords: ["plane"] },
      { char: "⚽", keywords: ["soccer"] },
      { char: "🏀", keywords: ["basketball"] },
      { char: "🎮", keywords: ["game"] },
    ],
  },
];
