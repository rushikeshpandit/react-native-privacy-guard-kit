/**
 * Hooks.ts
 *
 * React hooks for PrivacyGuardKit.
 *
 * ── AVAILABLE HOOKS ───────────────────────────────────────────────────────────
 *   usePrivacyGuard        — all-in-one hook (capture, switcher, recording state)
 *   useScreenshotListener  — runs a callback on every screenshot
 *   useScreenRecording     — reactive boolean for recording/mirroring state
 *
 * ── STABILITY CONTRACT ────────────────────────────────────────────────────────
 *   All returned function references are stable across re-renders (wrapped in
 *   useCallback). Safe to pass as props or use in dependency arrays.
 *
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  disableScreenCapture,
  enableScreenCapture,
  isScreenCaptureDisabled,
  isScreenBeingRecorded,
  enableAppSwitcherProtection,
  disableAppSwitcherProtection,
  clearClipboard,
  onScreenshotTaken,
  onScreenRecordingStarted,
  onScreenRecordingStopped,
} from './PrivacyGuardKitApi';
import type { UsePrivacyGuardReturn, PrivacyGuardKitConfig } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// usePrivacyGuard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All-in-one hook that wires up privacy guard features declaratively.
 *
 * On mount: applies the provided `config`.
 * On unmount: reverses everything that was applied on mount.
 *
 * The config is read once on mount via a ref. For dynamic changes, use the
 * returned imperative methods.
 *
 * @param config - Feature flags to apply on mount.
 * @returns State values and stable imperative control methods.
 */
export function usePrivacyGuard(
  config: PrivacyGuardKitConfig = {}
): UsePrivacyGuardReturn {
  const [captureDisabled, setCaptureDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Capture config at mount time. Using a ref means the cleanup function
  // always reverses exactly what was applied, even if the parent re-renders
  // with a new config object before unmount.
  const configRef = useRef(config);

  useEffect(() => {
    const appliedConfig = configRef.current;
    let mounted = true;

    // ── Bootstrap current native state ────────────────────────────────────────
    // Read actual native state on mount rather than assuming false.
    // Covers re-mount after hot-reload when native state was already set.
    isScreenCaptureDisabled()
      .then((disabled) => {
        if (mounted) setCaptureDisabled(disabled);
      })
      .catch(() => {
        /* Non-fatal — fall back to false. */
      });

    isScreenBeingRecorded()
      .then((recording) => {
        if (mounted) setIsRecording(recording);
      })
      .catch(() => {
        /* Non-fatal — fall back to false. */
      });

    // ── Apply config on mount ─────────────────────────────────────────────────
    if (appliedConfig.disableScreenCapture) {
      disableScreenCapture()
        .then(() => {
          if (mounted) setCaptureDisabled(true);
        })
        .catch((err: unknown) =>
          console.warn('[PrivacyGuardKit] disableScreenCapture failed:', err)
        );
    }

    if (appliedConfig.enableAppSwitcherProtection) {
      enableAppSwitcherProtection().catch((err: unknown) =>
        console.warn(
          '[PrivacyGuardKit] enableAppSwitcherProtection failed:',
          err
        )
      );
    }

    // ── Subscribe to recording change events ──────────────────────────────────
    // Always registered regardless of config so `isRecording` stays accurate.
    const unsubStart = onScreenRecordingStarted(({ isRecording: r }) => {
      if (mounted) setIsRecording(r);
    });
    const unsubStop = onScreenRecordingStopped(({ isRecording: r }) => {
      if (mounted) setIsRecording(r);
    });

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    return () => {
      mounted = false;

      unsubStart();
      unsubStop();

      if (appliedConfig.disableScreenCapture) {
        enableScreenCapture().catch((err: unknown) =>
          console.warn(
            '[PrivacyGuardKit] enableScreenCapture (cleanup) failed:',
            err
          )
        );
      }

      if (appliedConfig.enableAppSwitcherProtection) {
        disableAppSwitcherProtection().catch((err: unknown) =>
          console.warn(
            '[PrivacyGuardKit] disableAppSwitcherProtection (cleanup) failed:',
            err
          )
        );
      }
    };
  }, []); // Empty deps: mount/unmount lifecycle only

  // ── Stable imperative control functions ────────────────────────────────────
  // Errors propagate to callers instead of being silently swallowed.

  const handleDisableCapture = useCallback(async () => {
    await disableScreenCapture();
    setCaptureDisabled(true);
  }, []);

  const handleEnableCapture = useCallback(async () => {
    await enableScreenCapture();
    setCaptureDisabled(false);
  }, []);

  const handleEnableAppSwitcher = useCallback(async () => {
    await enableAppSwitcherProtection();
  }, []);

  const handleDisableAppSwitcher = useCallback(async () => {
    await disableAppSwitcherProtection();
  }, []);

  const handleClearClipboard = useCallback(async () => {
    await clearClipboard();
  }, []);

  return {
    isScreenCaptureDisabled: captureDisabled,
    isRecording,
    disableScreenCapture: handleDisableCapture,
    enableScreenCapture: handleEnableCapture,
    enableAppSwitcherProtection: handleEnableAppSwitcher,
    disableAppSwitcherProtection: handleDisableAppSwitcher,
    clearClipboard: handleClearClipboard,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useScreenshotListener
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls `onTaken` every time the user takes a screenshot.
 *
 * Automatically starts the native observer on mount and stops it on unmount.
 * Handles `onTaken` identity changes via an internal ref — the native
 * subscription is NOT recreated on every render.
 *
 * The returned unsubscribe function from `onScreenshotTaken` is idempotent, so
 * React 18 Strict Mode double-invocation is safe.
 *
 * Platform notes:
 *   - iOS:     Does NOT fire on the iOS Simulator.
 *   - Android: Requires READ_EXTERNAL_STORAGE (API 29–32) or
 *     READ_MEDIA_IMAGES (API 33+) to be granted before use.
 *
 * @param onTaken Callback invoked when a screenshot is detected.
 */
export function useScreenshotListener(onTaken: () => void): void {
  const callbackRef = useRef(onTaken);

  // Keep the ref current on every render so the subscription closure always
  // calls the latest callback without re-subscribing.
  useEffect(() => {
    callbackRef.current = onTaken;
  });

  useEffect(() => {
    const remove = onScreenshotTaken(() => callbackRef.current());
    return remove;
  }, []); // Subscribe once on mount, unsubscribe on unmount
}

// ─────────────────────────────────────────────────────────────────────────────
// useScreenRecording
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reactive boolean — `true` while the screen is being recorded or mirrored.
 *
 * Bootstraps the initial value from `isScreenBeingRecorded()` on mount, then
 * listens for recording change events to stay in sync.
 *
 * Platform notes:
 *   - iOS:     Reflects `UIScreen.isCaptured`. Always `false` on Simulator.
 *   - Android: Always `false` (no public detection API).
 *
 * @returns `true` while recording is active, `false` otherwise.
 */
export function useScreenRecording(): boolean {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let mounted = true;

    isScreenBeingRecorded()
      .then((recording) => {
        if (mounted) setIsRecording(recording);
      })
      .catch(() => {
        /* Non-fatal — default to false. */
      });

    const unsubStart = onScreenRecordingStarted(({ isRecording: r }) => {
      if (mounted) setIsRecording(r);
    });
    const unsubStop = onScreenRecordingStopped(({ isRecording: r }) => {
      if (mounted) setIsRecording(r);
    });

    return () => {
      mounted = false;
      unsubStart();
      unsubStop();
    };
  }, []);

  return isRecording;
}
