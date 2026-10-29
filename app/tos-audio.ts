export const tosKeyAsset = (cancel = false) => `/assets/sounds/${cancel ? "tos_cancel_keypress" : "tos_keypress1"}.mp3`;
export const tosEventAsset = (failure = false) => `/assets/sounds/${failure ? "tos_unabletocomply" : "tos_datareceived_ep"}.mp3`;
export const isTosCancelKey = (label: string) => /\b(cancel|close|dismiss|back|later)\b/i.test(label) || /^[×✕]$/.test(label.trim());
type KeyAudio = { volume: number; currentTime: number; play: () => Promise<void>; pause: () => void };
/** Lazy, local playback with a single active key sound and the operator's existing controls. */
export function createTosKeyPlayer(makeAudio: (path: string) => KeyAudio = path => new Audio(path), assetPath: (kind: boolean) => string = tosKeyAsset) {
  const clips = new Map<string, KeyAudio>();
  let active: KeyAudio | undefined;
  return {
    play(enabled: boolean, volume: number, cancel = false) {
      const level = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
      if (!enabled || level === 0) return;
      const path = assetPath(cancel);
      let clip = clips.get(path);
      if (!clip) { clip = makeAudio(path); clips.set(path, clip); }
      active?.pause();
      active = clip;
      clip.currentTime = 0;
      clip.volume = level;
      void clip.play().catch(() => {});
    },
    stop() { active?.pause(); active = undefined; },
  };
}

export const createTosEventPlayer = (makeAudio?: (path: string) => KeyAudio) => createTosKeyPlayer(makeAudio, tosEventAsset);
