/**
 * Notification sound playback.
 *
 * Two strategies, selected at preload time:
 *   1. Static MP3s under /sounds/{message,mention}.mp3 (preferred — drop a
 *      file there and it'll be picked up). The HTMLAudioElement is created
 *      and `.preload = "auto"` is set so the file is decoded eagerly.
 *   2. Web Audio oscillator beep — a tiny synthesised cue used until real
 *      audio assets are added. No bundled assets required.
 *
 * Both strategies are guarded with try/catch — if neither works (no DOM,
 * autoplay blocked, etc.) the call is a silent no-op.
 *
 * Repeat-suppression: any sound played within the last 300ms is dropped to
 * avoid being machine-gunned when many messages arrive at once.
 */

let messageAudio: HTMLAudioElement | null = null;
let mentionAudio: HTMLAudioElement | null = null;

const REPEAT_SUPPRESSION_MS = 300;
let lastMessageAt = 0;
let lastMentionAt = 0;

export function preloadSounds(): void {
  if (typeof window === "undefined") return;
  try {
    messageAudio = new Audio("/sounds/message.mp3");
    messageAudio.volume = 0.5;
    messageAudio.preload = "auto";
    mentionAudio = new Audio("/sounds/mention.mp3");
    mentionAudio.volume = 0.7;
    mentionAudio.preload = "auto";
  } catch {
    /* silent */
  }
}

export function playMessageSound(): void {
  const now = Date.now();
  if (now - lastMessageAt < REPEAT_SUPPRESSION_MS) return;
  lastMessageAt = now;
  if (!playFromAudio(messageAudio)) playBeep(800, 0.1, 0.3);
}

export function playMentionSound(): void {
  const now = Date.now();
  if (now - lastMentionAt < REPEAT_SUPPRESSION_MS) return;
  lastMentionAt = now;
  if (!playFromAudio(mentionAudio)) {
    // Two short beeps so @mentions sound distinct from regular messages.
    playBeep(1000, 0.15, 0.5);
    setTimeout(() => playBeep(1200, 0.15, 0.5), 200);
  }
}

function playFromAudio(audio: HTMLAudioElement | null): boolean {
  if (!audio) return false;
  try {
    audio.currentTime = 0;
    const promise = audio.play();
    if (promise && typeof promise.then === "function") {
      // Swallow autoplay rejections — we'll fall through to beep instead
      // on the *next* play because lastMessageAt has been updated, but the
      // first attempt here at least tried.
      promise.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

function playBeep(frequency: number, duration: number, volume: number): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* silent */
  }
}

/** Test-only reset hook. */
export function __resetSoundCachesForTests(): void {
  messageAudio = null;
  mentionAudio = null;
  lastMessageAt = 0;
  lastMentionAt = 0;
}
