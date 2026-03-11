/**
 * types.ts
 *
 * Shared TypeScript types and interfaces for the PrivacyGuardKit library.
 *
 * This file is the single source of truth for all public-facing types.
 * Import from here rather than defining inline types in individual files
 * to guarantee consistency across the API, hooks, and provider.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Event Names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of all event names that PrivacyGuardKit can emit from the native layer.
 *
 * These string values MUST exactly match:
 *   - iOS:     The event names in ScreenshotDetectionManager.swift
 *              (`screenshotTakenEvent`, `recordingStartedEvent`, `recordingStoppedEvent`)
 *   - Android: The companion object constants in PrivacyGuardKitModule.kt
 *              (`EVENT_SCREENSHOT_TAKEN`, `EVENT_SCREEN_RECORDING_STARTED`,
 *               `EVENT_SCREEN_RECORDING_STOPPED`)
 *
 * A mismatch between this type and the native constants will result in
 * listeners that silently never fire — no runtime error is thrown.
 */
export type PrivacyGuardEvent =
  | 'onScreenshotTaken'
  | 'onScreenRecordingStarted'
  | 'onScreenRecordingStopped';

// ─────────────────────────────────────────────────────────────────────────────
// Event Payloads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload delivered with `onScreenRecordingStarted` and
 * `onScreenRecordingStopped` events.
 *
 * Platform notes:
 *   - iOS:     `isRecording` is derived from `UIScreen.isCaptured`.
 *              `true` during ReplayKit recordings, AirPlay mirroring,
 *              and wired/wireless QuickTime captures. Always `false` on the
 *              iOS Simulator.
 *   - Android: Recording events are NOT currently emitted (no public API).
 *              `isRecording` will always be the initial `false` on Android.
 */
export interface ScreenRecordingEventPayload {
  /** Whether the screen is currently being captured/recorded. */
  isRecording: boolean;
}

/**
 * Payload for the `onScreenshotTaken` event.
 *
 * The native layer sends `null` body for this event (no metadata available).
 * The JS listener is called with no arguments; this type exists for
 * forward-compatibility if metadata is added later.
 *
 * Platform notes:
 *   - iOS:     Fires via `UIApplication.userDidTakeScreenshotNotification`.
 *              Does NOT fire on the iOS Simulator.
 *   - Android: Fires via MediaStore ContentObserver watching screenshot
 *              directories. Requires READ_EXTERNAL_STORAGE (API 29–32) or
 *              READ_MEDIA_IMAGES (API 33+).
 */
export type ScreenshotEventPayload = Record<string, never>;

// ─────────────────────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Native error codes that can surface as the `code` property of a rejected
 * Promise Error.
 *
 * Android-only (iOS never rejects):
 *   - `NO_ACTIVITY`                    — no foreground Activity available
 *   - `NO_WINDOW`                      — Activity window is null
 *   - `DISABLE_CAPTURE_ERROR`          — FLAG_SECURE could not be applied
 *   - `ENABLE_CAPTURE_ERROR`           — FLAG_SECURE could not be cleared
 *   - `APP_SWITCHER_ERROR`             — app-switcher flag mutation failed
 *   - `APP_SWITCHER_DISABLE_ERROR`     — app-switcher flag clear failed
 *   - `SCREENSHOT_LISTENER_ERROR`      — ContentObserver registration failed
 *   - `SCREENSHOT_LISTENER_STOP_ERROR` — ContentObserver unregister failed
 *   - `CLIPBOARD_CLEAR_ERROR`          — clipboard clear failed
 */
export type NativeErrorCode =
  | 'NO_ACTIVITY'
  | 'NO_WINDOW'
  | 'DISABLE_CAPTURE_ERROR'
  | 'ENABLE_CAPTURE_ERROR'
  | 'APP_SWITCHER_ERROR'
  | 'APP_SWITCHER_DISABLE_ERROR'
  | 'SCREENSHOT_LISTENER_ERROR'
  | 'SCREENSHOT_LISTENER_STOP_ERROR'
  | 'CLIPBOARD_CLEAR_ERROR';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration object accepted by `usePrivacyGuard` and `PrivacyGuardProvider`.
 *
 * All fields are optional. Features are opt-in by default.
 */
export interface PrivacyGuardKitConfig {
  /**
   * Disable screen capture (screenshots + screen-recording preview).
   *
   * Platform behaviour:
   *   - Android: Applies `FLAG_SECURE` to the Activity window.
   *   - iOS:     Installs a full-screen secure UITextField overlay.
   *
   * @default false
   */
  disableScreenCapture?: boolean;

  /**
   * Show a blank overlay in the OS app-switcher thumbnail.
   *
   * Platform behaviour:
   *   - Android: Applies `FLAG_SECURE` independently from screen-capture.
   *   - iOS:     Registers `willResignActive` / `didBecomeActive` observers.
   *
   * @default false
   */
  enableAppSwitcherProtection?: boolean;

  /**
   * Prevent copy/paste within `<SecureView>` children.
   *
   * Informational — does not directly call native APIs from the
   * hook/provider setup phase. Pass to `<SecureView disableCopyPaste>`.
   *
   * @default false
   */
  disableCopyPaste?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook / Provider Return
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Object returned by `usePrivacyGuard` and exposed via `usePrivacyGuardContext`.
 *
 * All async methods return `Promise<void>` and propagate native errors so
 * callers can handle them if desired.
 */
export interface UsePrivacyGuardReturn {
  /**
   * `true` when screen-capture protection is currently active.
   * Reflects in-JS state only — set after the native call resolves.
   */
  isScreenCaptureDisabled: boolean;

  /**
   * `true` while the screen is being recorded or mirrored.
   *
   * Bootstrapped on mount by `isScreenBeingRecorded()`, then kept in sync
   * via recording change events.
   *
   * Platform notes:
   *   - iOS: Reflects `UIScreen.isCaptured`. Always `false` on Simulator.
   *   - Android: Always `false` (no public detection API).
   */
  isRecording: boolean;

  /** Activates screen-capture protection. Idempotent. */
  disableScreenCapture: () => Promise<void>;

  /** Deactivates screen-capture protection. Idempotent. */
  enableScreenCapture: () => Promise<void>;

  /** Activates app-switcher privacy overlay. Idempotent. */
  enableAppSwitcherProtection: () => Promise<void>;

  /** Deactivates app-switcher privacy overlay. Idempotent. */
  disableAppSwitcherProtection: () => Promise<void>;

  /**
   * Clears the system clipboard / pasteboard.
   *
   * Platform notes:
   *   - Android API 29+: System may show a "cleared clipboard" toast.
   *   - iOS 16+: Clearing does not trigger the transparency banner.
   */
  clearClipboard: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Listener Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Callback for the `onScreenshotTaken` event listener. No payload.
 */
export type ScreenshotListener = () => void;

/**
 * Callback for `onScreenRecordingStarted` and `onScreenRecordingStopped`.
 */
export type RecordingListener = (payload: ScreenRecordingEventPayload) => void;

/**
 * Unsubscribe function returned by all `on*` listener registration functions.
 *
 * @example
 * const remove = onScreenshotTaken(() => console.log('screenshot'));
 * remove(); // cleans up the subscription
 */
export type UnsubscribeFn = () => void;
