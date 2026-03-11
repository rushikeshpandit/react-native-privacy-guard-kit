/**
 * PrivacyGuardKitApi.ts
 *
 * Public imperative API for PrivacyGuardKit.
 *
 * All functions are fully typed, error-safe, platform-aware, and idempotent
 * on the native side.
 *
 * ── LISTENER REFERENCE COUNTING ───────────────────────────────────────────────
 *   The native screenshot/recording observer is SHARED across all JS listeners.
 *   `onScreenshotTaken`, `onScreenRecordingStarted`, and `onScreenRecordingStopped`
 *   all share a single native observer managed by a ref-counter here:
 *
 *     • First subscriber of ANY type → starts the native observer.
 *     • Last subscriber of ANY type  → stops the native observer.
 *
 */

import {
  NativePrivacyGuardKit,
  PrivacyGuardKitEmitter,
} from './NativePrivacyGuardKit';
import type {
  ScreenshotListener,
  RecordingListener,
  UnsubscribeFn,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Listener Reference Counter
// ─────────────────────────────────────────────────────────────────────────────

let _nativeListenerCount = 0;

/**
 * Track the in-flight start promise so concurrent first-subscribers
 * await the same operation instead of calling startScreenshotListener twice.
 */
let _startPromise: Promise<boolean> | null = null;

/**
 * Increments the native listener ref-count and starts the native observer
 * if this is the first subscriber.
 *
 * Returns a promise that resolves once the native observer is started
 * (or immediately if it was already running). Callers fire-and-forget this
 * in synchronous subscription functions; the promise is tracked internally
 * to prevent duplicate start calls.
 *
 * @internal
 */
function _acquireNativeListener(): void {
  _nativeListenerCount += 1;
  if (_nativeListenerCount === 1) {
    // Store and reuse the in-flight promise so concurrent acquires
    // don't fire multiple startScreenshotListener() calls.
    _startPromise = NativePrivacyGuardKit.startScreenshotListener().catch(
      (err: unknown) => {
        console.warn('[PrivacyGuardKit] startScreenshotListener failed:', err);
        return false;
      }
    );
    _startPromise.finally(() => {
      _startPromise = null;
    });
  }
}

/**
 * Decrements the native listener ref-count and stops the native observer
 * if this was the last subscriber.
 *
 * Waits for any in-flight _startPromise before stopping, so we never
 * call stopScreenshotListener before the start has resolved.
 *
 * @internal
 */
function _releaseNativeListener(): void {
  if (_nativeListenerCount <= 0) {
    // Guard: should never go negative — protect against mismatched calls.
    return;
  }
  _nativeListenerCount -= 1;
  if (_nativeListenerCount === 0) {
    const stop = () => {
      NativePrivacyGuardKit.stopScreenshotListener().catch((err: unknown) => {
        console.warn('[PrivacyGuardKit] stopScreenshotListener failed:', err);
      });
    };
    // If a start is still in-flight, wait for it before stopping.
    if (_startPromise) {
      _startPromise.then(stop, stop);
    } else {
      stop();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen Capture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activates screen-capture protection.
 *
 * Platform behaviour:
 *   - Android: Applies `FLAG_SECURE` to the Activity window. Content appears
 *     black in screenshots and recordings. Also blurs app-switcher thumbnails.
 *     Rejects with `NO_ACTIVITY` if the app is backgrounded.
 *   - iOS:     Installs a full-screen secure UITextField overlay at the back
 *     of the window. On the Simulator, capture prevention has no effect
 *     (host-OS screenshots bypass UIKit rendering).
 *
 * @throws On Android if no foreground Activity is available (`NO_ACTIVITY`).
 */
export async function disableScreenCapture(): Promise<void> {
  await NativePrivacyGuardKit.disableScreenCapture();
}

/**
 * Deactivates screen-capture protection.
 *
 * Android: FLAG_SECURE is only cleared if app-switcher protection is also
 * inactive (the two share the same underlying OS flag but are tracked
 * independently). Call `disableAppSwitcherProtection()` as well to fully remove it.
 *
 * @throws On Android if no foreground Activity is available.
 */
export async function enableScreenCapture(): Promise<void> {
  await NativePrivacyGuardKit.enableScreenCapture();
}

/**
 * Returns whether screen-capture protection is currently active.
 *
 * Android reads the actual window flags; iOS reflects in-module state.
 * Always resolves — never throws.
 *
 * @returns `true` if screen capture is blocked, `false` otherwise.
 */
export async function isScreenCaptureDisabled(): Promise<boolean> {
  return NativePrivacyGuardKit.isScreenCaptureDisabled();
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen Recording Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns whether the screen is currently being recorded or mirrored.
 *
 * Platform behaviour:
 *   - iOS:     Reads `UIScreen.isCaptured`. Returns `true` during ReplayKit
 *     recordings, AirPlay mirroring, and QuickTime captures.
 *     Always `false` on the iOS Simulator.
 *   - Android: Always returns `false`. Use `disableScreenCapture()` to prevent
 *     recording content from being visible.
 *
 * Always resolves — never throws.
 */
export async function isScreenBeingRecorded(): Promise<boolean> {
  return NativePrivacyGuardKit.isScreenBeingRecorded();
}

// ─────────────────────────────────────────────────────────────────────────────
// App Switcher Protection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activates app-switcher (recent tasks) thumbnail privacy protection.
 *
 * Platform behaviour:
 *   - iOS:     Registers `willResignActive` / `didBecomeActive` observers.
 *     A full-screen overlay is shown just before the OS takes the snapshot.
 *     Works on the Simulator.
 *   - Android: Applies `FLAG_SECURE` independently from screen-capture.
 *     The two features are tracked with separate state variables.
 *
 * @throws On Android if no foreground Activity is available.
 */
export async function enableAppSwitcherProtection(): Promise<void> {
  await NativePrivacyGuardKit.enableAppSwitcherProtection();
}

/**
 * Deactivates app-switcher thumbnail privacy protection.
 *
 * @throws On Android if no foreground Activity is available.
 */
export async function disableAppSwitcherProtection(): Promise<void> {
  await NativePrivacyGuardKit.disableAppSwitcherProtection();
}

// ─────────────────────────────────────────────────────────────────────────────
// Clipboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clears all items from the system clipboard / pasteboard.
 *
 * Platform behaviour:
 *   - iOS:     Sets `UIPasteboard.general.items = []`. Never throws.
 *   - Android API 28+: Uses `ClipboardManager.clearPrimaryClip()`. On API 29+
 *     the system may briefly show a toast "App cleared your clipboard" — this
 *     is OS behaviour and cannot be suppressed.
 *   - Android API < 28: Overwrites the clip with empty `ClipData`.
 *
 * @throws On Android: `CLIPBOARD_CLEAR_ERROR` on unexpected failures.
 */
export async function clearClipboard(): Promise<void> {
  await NativePrivacyGuardKit.clearClipboard();
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers a callback invoked every time the user takes a screenshot.
 *
 * Starts the native observer on the first subscriber (ref-counted, shared with
 * recording listeners). Stops it when the last subscriber is removed.
 *
 * Platform behaviour:
 *   - iOS:     Fires via `UIApplication.userDidTakeScreenshotNotification`.
 *     Fires AFTER capture — cannot prevent it. Does NOT fire on the Simulator.
 *   - Android: Fires when a new image matching screenshot path keywords is
 *     written to MediaStore. Requires READ_EXTERNAL_STORAGE (API 29–32) or
 *     READ_MEDIA_IMAGES (API 33+). Does NOT fire for host-OS emulator captures.
 *
 * The returned unsubscribe function is idempotent — calling it multiple
 * times has no effect after the first call (guarded by a `released` flag).
 *
 * @param callback Called with no arguments when a screenshot is detected.
 * @returns An `UnsubscribeFn` — call it to remove the listener.
 */
export function onScreenshotTaken(callback: ScreenshotListener): UnsubscribeFn {
  _acquireNativeListener();

  const sub = PrivacyGuardKitEmitter.addListener('onScreenshotTaken', () =>
    callback()
  );

  // Guard against multiple unsubscribe calls.
  let released = false;
  return () => {
    if (released) return;
    released = true;
    sub.remove();
    _releaseNativeListener();
  };
}

/**
 * Registers a callback that fires when screen recording or mirroring begins.
 *
 * Shares the native observer ref-count with `onScreenshotTaken` and
 * `onScreenRecordingStopped`.
 *
 * Platform behaviour:
 *   - iOS:     Fires via `UIScreen.capturedDidChangeNotification` on
 *     transition to `isCaptured = true`. Does NOT fire on the Simulator.
 *   - Android: NOT currently emitted (no public recording-detection API).
 *
 * Unsubscribe is idempotent.
 *
 * @param callback Called with `{ isRecording: true }` when recording starts.
 * @returns An `UnsubscribeFn` — call it to remove the listener.
 */
export function onScreenRecordingStarted(
  callback: RecordingListener
): UnsubscribeFn {
  _acquireNativeListener();

  const sub = PrivacyGuardKitEmitter.addListener(
    'onScreenRecordingStarted',
    (payload: unknown) => {
      const p = (payload ?? { isRecording: true }) as { isRecording: boolean };
      callback({ isRecording: p.isRecording ?? true });
    }
  );

  let released = false;
  return () => {
    if (released) return;
    released = true;
    sub.remove();
    _releaseNativeListener();
  };
}

/**
 * Registers a callback that fires when screen recording or mirroring ends.
 *
 * Shares the native observer ref-count with `onScreenshotTaken` and
 * `onScreenRecordingStarted`.
 *
 * Platform behaviour:
 *   - iOS:     Fires via `UIScreen.capturedDidChangeNotification` on
 *     transition to `isCaptured = false`. Does NOT fire on the Simulator.
 *   - Android: NOT currently emitted.
 *
 * Unsubscribe is idempotent.
 *
 * @param callback Called with `{ isRecording: false }` when recording stops.
 * @returns An `UnsubscribeFn` — call it to remove the listener.
 */
export function onScreenRecordingStopped(
  callback: RecordingListener
): UnsubscribeFn {
  _acquireNativeListener();

  const sub = PrivacyGuardKitEmitter.addListener(
    'onScreenRecordingStopped',
    (payload: unknown) => {
      const p = (payload ?? { isRecording: false }) as { isRecording: boolean };
      callback({ isRecording: p.isRecording ?? false });
    }
  );

  let released = false;
  return () => {
    if (released) return;
    released = true;
    sub.remove();
    _releaseNativeListener();
  };
}
