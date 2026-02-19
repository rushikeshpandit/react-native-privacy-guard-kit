import {
  NativePrivacyGuardKit,
  PrivacyGuardKitEmitter,
} from './NativePrivacyGuardKit';
import type { ScreenRecordingEventPayload } from './types';

// ─────────────────────────────────────────────────────────────
// Screen Capture
// ─────────────────────────────────────────────────────────────

/**
 * Prevents screenshots and blurs screen-recording output.
 * On Android uses FLAG_SECURE; on iOS uses a secure UITextField overlay.
 */
export async function disableScreenCapture(): Promise<void> {
  await NativePrivacyGuardKit.disableScreenCapture();
}

/** Re-enables screenshots and screen-recording. */
export async function enableScreenCapture(): Promise<void> {
  await NativePrivacyGuardKit.enableScreenCapture();
}

/** Returns true if screen capture is currently disabled. */
export async function isScreenCaptureDisabled(): Promise<boolean> {
  return NativePrivacyGuardKit.isScreenCaptureDisabled();
}

// ─────────────────────────────────────────────────────────────
// Screen Recording Detection
// ─────────────────────────────────────────────────────────────

/** Returns true if the screen is currently being recorded/mirrored. */
export async function isScreenBeingRecorded(): Promise<boolean> {
  return NativePrivacyGuardKit.isScreenBeingRecorded();
}

// ─────────────────────────────────────────────────────────────
// App Switcher Protection
// ─────────────────────────────────────────────────────────────

/**
 * Covers the app preview shown in the OS task switcher with a
 * blank overlay, preventing sensitive content from being visible.
 */
export async function enableAppSwitcherProtection(): Promise<void> {
  await NativePrivacyGuardKit.enableAppSwitcherProtection();
}

/** Removes the app switcher overlay. */
export async function disableAppSwitcherProtection(): Promise<void> {
  await NativePrivacyGuardKit.disableAppSwitcherProtection();
}

// ─────────────────────────────────────────────────────────────
// Clipboard
// ─────────────────────────────────────────────────────────────

/** Clears the system clipboard immediately. */
export async function clearClipboard(): Promise<void> {
  await NativePrivacyGuardKit.clearClipboard();
}

// ─────────────────────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────────────────────

type ScreenshotListener = () => void;
type RecordingListener = (payload: ScreenRecordingEventPayload) => void;

// NativeEventEmitter expects (...args: readonly Object[]) => unknown
// We wrap the typed callback to satisfy that constraint safely.
type NativeListener = (...args: readonly object[]) => unknown;

/**
 * Starts the native screenshot observer and registers your callback.
 * Returns a cleanup function — call it to unsubscribe.
 *
 * @example
 * const remove = onScreenshotTaken(() => Alert.alert('Screenshot detected!'));
 * // later:
 * remove();
 */
export function onScreenshotTaken(callback: ScreenshotListener): () => void {
  NativePrivacyGuardKit.startScreenshotListener();
  const sub = PrivacyGuardKitEmitter.addListener(
    'onScreenshotTaken',
    callback as NativeListener
  );
  return () => {
    sub.remove();
    NativePrivacyGuardKit.stopScreenshotListener();
  };
}

/**
 * Fires when screen recording begins.
 * Returns a cleanup function.
 */
export function onScreenRecordingStarted(
  callback: RecordingListener
): () => void {
  NativePrivacyGuardKit.startScreenshotListener(); // same listener start
  const sub = PrivacyGuardKitEmitter.addListener(
    'onScreenRecordingStarted',
    callback as NativeListener
  );
  return () => sub.remove();
}

/**
 * Fires when screen recording stops.
 * Returns a cleanup function.
 */
export function onScreenRecordingStopped(
  callback: RecordingListener
): () => void {
  const sub = PrivacyGuardKitEmitter.addListener(
    'onScreenRecordingStopped',
    callback as NativeListener
  );
  return () => sub.remove();
}
