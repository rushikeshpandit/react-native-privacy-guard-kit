/**
 * index.tsx
 *
 * Public API surface for the PrivacyGuardKit library.
 *
 * This is the ONLY file consumers should import from. Do not import from
 * internal files (PrivacyGuardKitApi, NativePrivacyGuardKit, etc.) directly —
 * those are implementation details subject to change.
 *
 */

// ─────────────────────────────────────────────────────────────────────────────
// Imperative API
// ─────────────────────────────────────────────────────────────────────────────

export {
  /** Activates screen-capture protection (FLAG_SECURE on Android; secure overlay on iOS). */
  disableScreenCapture,
  /** Deactivates screen-capture protection. */
  enableScreenCapture,
  /**
   * Returns `true` if screen-capture protection is currently active.
   */
  isScreenCaptureDisabled,
  /** Returns `true` if the screen is being recorded/mirrored (iOS only; always false on Android). */
  isScreenBeingRecorded,
  /** Activates app-switcher thumbnail privacy protection. */
  enableAppSwitcherProtection,
  /** Deactivates app-switcher thumbnail privacy protection. */
  disableAppSwitcherProtection,
  /** Clears the system clipboard / pasteboard. */
  clearClipboard,
  /** Subscribes to screenshot events. Returns an unsubscribe function. */
  onScreenshotTaken,
  /** Subscribes to screen-recording-started events. Returns an unsubscribe function. */
  onScreenRecordingStarted,
  /** Subscribes to screen-recording-stopped events. Returns an unsubscribe function. */
  onScreenRecordingStopped,
} from './PrivacyGuardKitApi';

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export {
  /** All-in-one hook. Applies config on mount, reverses on unmount. */
  usePrivacyGuard,
  /** Calls a callback every time the user takes a screenshot. */
  useScreenshotListener,
  /** Reactive boolean — `true` while screen is being recorded/mirrored. */
  useScreenRecording,
} from './Hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Provider + Context Hook
// ─────────────────────────────────────────────────────────────────────────────

export {
  /** Context provider. Wrap your root or a sensitive subtree with this. */
  PrivacyGuardProvider,
  /** Context consumer hook. Throws if called outside <PrivacyGuardProvider>. */
  usePrivacyGuardContext,
} from './PrivacyGuardProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

export {
  /**
   * Cross-platform container that blocks copy/paste for all text children
   * at the native level. Supports both Fabric and Paper architectures.
   * Supports ref forwarding to the underlying native view.
   */
  SecureView,
} from './SecureView';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  /** Union of all native event name strings. */
  PrivacyGuardEvent,
  /** Config object for `usePrivacyGuard` and `PrivacyGuardProvider`. */
  PrivacyGuardKitConfig,
  /** Return type of `usePrivacyGuard` and `usePrivacyGuardContext`. */
  UsePrivacyGuardReturn,
  /** Payload for recording-started / recording-stopped event callbacks. */
  ScreenRecordingEventPayload,
  /** Payload type for screenshot event (currently empty — future-proof). */
  ScreenshotEventPayload,
  /** Callback type for screenshot events. */
  ScreenshotListener,
  /** Callback type for recording events. */
  RecordingListener,
  /** Function returned by all `on*` listener registration functions. */
  UnsubscribeFn,
  /** Native error codes surfaced as `error.code` on rejected Promises. */
  NativeErrorCode,
} from './types';

export type { SecureViewProps } from './SecureView';
