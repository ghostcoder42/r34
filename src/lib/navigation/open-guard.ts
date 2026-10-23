/**
 * Single-flight guard for opening the post screen.
 *
 * `router.push` is a synchronous dispatch — the tap IS the open. The only
 * window where a repeat tap can duplicate the push is while the open is
 * still in flight (the pushed screen has not gained focus yet — e.g. taps
 * queued during a JS-thread stall, or jabs landing during the transition).
 * While that window is open, further opens of the SAME video are swallowed;
 * the pushed screen unlocks the guard when it gains focus. No timers: the
 * lock's lifetime is exactly the open operation.
 */
let openingVideoId: string | null = null;

/**
 * Ghost-tap shield after a context-menu interaction, MODULE-scoped on
 * purpose: the popup menu usually covers NEIGHBORING tiles, and after an
 * item is chosen the popup's dismiss animation (~150-250ms) leaves it
 * visible but no longer touchable — a fast follow-up tap then falls through
 * onto whatever tile sits underneath (reproduced via double-tap on an
 * emulator: menu action on tile A → 158ms → tile B's onPress fired). Every
 * tile shares one shield so the ghost is swallowed no matter which tile it
 * lands on.
 */
const MENU_GHOST_SHIELD_MS = 600;
let menuInteractedAt = 0;

/** Returns true when this video's open may proceed; false = already opening. */
export function tryBeginVideoOpen(videoId: string): boolean {
  if (openingVideoId === videoId) return false;
  openingVideoId = videoId;
  return true;
}

/** Called by the post screen when it gains focus — the open has completed. */
export function endVideoOpen(): void {
  openingVideoId = null;
}

/** Stamp "a menu interaction just happened" — starts the ghost shield. */
export function markMenuInteraction(): void {
  menuInteractedAt = Date.now();
}

/** True while a tap should be treated as a popup-dismiss ghost. */
export function isGhostTapAfterMenu(now: number = Date.now()): boolean {
  return now - menuInteractedAt < MENU_GHOST_SHIELD_MS;
}

/** Test hook — clears any in-flight open. */
export function resetOpenGuard(): void {
  openingVideoId = null;
  menuInteractedAt = 0;
}
