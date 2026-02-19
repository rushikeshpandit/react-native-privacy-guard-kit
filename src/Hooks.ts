import { useState, useEffect, useCallback } from 'react';
import {
  disableScreenCapture,
  enableScreenCapture,
  isScreenBeingRecorded,
  enableAppSwitcherProtection,
  disableAppSwitcherProtection,
  clearClipboard,
  onScreenshotTaken,
  onScreenRecordingStarted,
  onScreenRecordingStopped,
} from './PrivacyGuardkitApi';
import type { UsePrivacyGuardReturn, PrivacyGuardKitConfig } from './types';

// ─────────────────────────────────────────────────────────────
// usePrivacyGuard
// ─────────────────────────────────────────────────────────────

/**
 * One-stop hook that wires up all privacy guard features declaratively.
 *
 * @example
 * const { isRecording, disableScreenCapture } = usePrivacyGuard({
 *   disableScreenCapture: true,
 *   enableAppSwitcherProtection: true,
 * });
 */
export function usePrivacyGuard(
  config: PrivacyGuardKitConfig = {}
): UsePrivacyGuardReturn {
  const [captureDisabled, setCaptureDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Apply config on mount
  useEffect(() => {
    if (config.disableScreenCapture) {
      disableScreenCapture().then(() => setCaptureDisabled(true));
    }
    if (config.enableAppSwitcherProtection) {
      enableAppSwitcherProtection();
    }

    // Bootstrap recording state
    isScreenBeingRecorded().then(setIsRecording);

    // Recording listeners
    const stopStart = onScreenRecordingStarted(() => setIsRecording(true));
    const stopStop = onScreenRecordingStopped(() => setIsRecording(false));

    return () => {
      if (config.disableScreenCapture) {
        enableScreenCapture().then(() => setCaptureDisabled(false));
      }
      if (config.enableAppSwitcherProtection) {
        disableAppSwitcherProtection();
      }
      stopStart();
      stopStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisableCapture = useCallback(async () => {
    await disableScreenCapture();
    setCaptureDisabled(true);
  }, []);

  const handleEnableCapture = useCallback(async () => {
    await enableScreenCapture();
    setCaptureDisabled(false);
  }, []);

  return {
    isScreenCaptureDisabled: captureDisabled,
    isRecording,
    disableScreenCapture: handleDisableCapture,
    enableScreenCapture: handleEnableCapture,
    enableAppSwitcherProtection: async () => {
      await enableAppSwitcherProtection();
    },
    disableAppSwitcherProtection: async () => {
      await disableAppSwitcherProtection();
    },
    clearClipboard,
  };
}

// ─────────────────────────────────────────────────────────────
// useScreenshotListener
// ─────────────────────────────────────────────────────────────

/**
 * Calls `onTaken` every time the user takes a screenshot.
 *
 * @example
 * useScreenshotListener(() => {
 *   console.log('Screenshot detected!');
 * });
 */
export function useScreenshotListener(onTaken: () => void): void {
  useEffect(() => {
    const remove = onScreenshotTaken(onTaken);
    return remove;
  }, [onTaken]);
}

// ─────────────────────────────────────────────────────────────
// useScreenRecording
// ─────────────────────────────────────────────────────────────

/**
 * Reactive boolean — true while screen is being recorded.
 *
 * @example
 * const isRecording = useScreenRecording();
 * if (isRecording) return <BlurredScreen />;
 */
export function useScreenRecording(): boolean {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    isScreenBeingRecorded().then(setIsRecording);

    const stopStart = onScreenRecordingStarted(({ isRecording: r }) =>
      setIsRecording(r)
    );
    const stopEnd = onScreenRecordingStopped(({ isRecording: r }) =>
      setIsRecording(r)
    );

    return () => {
      stopStart();
      stopEnd();
    };
  }, []);

  return isRecording;
}
