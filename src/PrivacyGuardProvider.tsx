/**
 * PrivacyGuardProvider.tsx
 *
 * React Context Provider for PrivacyGuardKit.
 *
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  disableScreenCapture,
  enableScreenCapture,
  isScreenCaptureDisabled,
  enableAppSwitcherProtection,
  disableAppSwitcherProtection,
  isScreenBeingRecorded,
  clearClipboard,
  onScreenRecordingStarted,
  onScreenRecordingStopped,
  onScreenshotTaken,
} from './PrivacyGuardKitApi';
import type { PrivacyGuardKitConfig, UsePrivacyGuardReturn } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

type PrivacyGuardContextType = UsePrivacyGuardReturn | null;

const PrivacyGuardContext = createContext<PrivacyGuardContextType>(null);
PrivacyGuardContext.displayName = 'PrivacyGuardContext';

// ─────────────────────────────────────────────────────────────────────────────
// Provider Props
// ─────────────────────────────────────────────────────────────────────────────

interface PrivacyGuardProviderProps {
  children: ReactNode;
  config?: PrivacyGuardKitConfig;
  /**
   * Optional callback invoked every time the user takes a screenshot.
   *
   * The prop can be added or changed after mount — the latest value is always
   * called via an internal ref without re-subscribing to the native layer.
   * If this prop is `undefined` on every render, no screenshot callback fires
   * but the native observer is still running (shared with recording listeners).
   */
  onScreenshot?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function PrivacyGuardProvider({
  children,
  config = {},
  onScreenshot,
}: PrivacyGuardProviderProps) {
  const [captureDisabled, setCaptureDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const configRef = useRef(config);
  const onScreenshotRef = useRef(onScreenshot);

  // Keep onScreenshot ref current without triggering re-subscriptions.
  useEffect(() => {
    onScreenshotRef.current = onScreenshot;
  });

  useEffect(() => {
    const appliedConfig = configRef.current;
    let mounted = true;

    // ── Bootstrap current native state ────────────────────────────────────────
    // Read actual native state instead of always starting from false.
    isScreenCaptureDisabled()
      .then((disabled) => {
        if (mounted) setCaptureDisabled(disabled);
      })
      .catch(() => {
        /* Non-fatal. */
      });

    isScreenBeingRecorded()
      .then((recording) => {
        if (mounted) setIsRecording(recording);
      })
      .catch(() => {
        /* Non-fatal. */
      });

    // ── Apply config features ─────────────────────────────────────────────────
    if (appliedConfig.disableScreenCapture) {
      disableScreenCapture()
        .then(() => {
          if (mounted) setCaptureDisabled(true);
        })
        .catch((err: unknown) =>
          console.warn(
            '[PrivacyGuardKit] Provider: disableScreenCapture failed:',
            err
          )
        );
    }

    if (appliedConfig.enableAppSwitcherProtection) {
      enableAppSwitcherProtection().catch((err: unknown) =>
        console.warn(
          '[PrivacyGuardKit] Provider: enableAppSwitcherProtection failed:',
          err
        )
      );
    }

    // ── Event subscriptions ───────────────────────────────────────────────────

    // Subscribe unconditionally — do NOT gate on onScreenshotRef.current.
    // If undefined, the closure is a no-op. If set later, it fires correctly.
    const unsubScreenshot = onScreenshotTaken(() => {
      onScreenshotRef.current?.();
    });

    const unsubStart = onScreenRecordingStarted(({ isRecording: r }) => {
      if (mounted) setIsRecording(r);
    });
    const unsubStop = onScreenRecordingStopped(({ isRecording: r }) => {
      if (mounted) setIsRecording(r);
    });

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      mounted = false;

      unsubScreenshot();
      unsubStart();
      unsubStop();

      if (appliedConfig.disableScreenCapture) {
        enableScreenCapture().catch((err: unknown) =>
          console.warn(
            '[PrivacyGuardKit] Provider: enableScreenCapture (cleanup) failed:',
            err
          )
        );
      }

      if (appliedConfig.enableAppSwitcherProtection) {
        disableAppSwitcherProtection().catch((err: unknown) =>
          console.warn(
            '[PrivacyGuardKit] Provider: disableAppSwitcherProtection (cleanup) failed:',
            err
          )
        );
      }
    };
  }, []); // Mount/unmount lifecycle only

  // ── Stable imperative methods ──────────────────────────────────────────────

  const handleDisable = useCallback(async () => {
    await disableScreenCapture();
    setCaptureDisabled(true);
  }, []);

  const handleEnable = useCallback(async () => {
    await enableScreenCapture();
    setCaptureDisabled(false);
  }, []);

  const handleEnableAppSwitcher = useCallback(
    async () => enableAppSwitcherProtection(),
    []
  );

  const handleDisableAppSwitcher = useCallback(
    async () => disableAppSwitcherProtection(),
    []
  );

  const handleClearClipboard = useCallback(async () => clearClipboard(), []);

  const value: UsePrivacyGuardReturn = {
    isScreenCaptureDisabled: captureDisabled,
    isRecording,
    disableScreenCapture: handleDisable,
    enableScreenCapture: handleEnable,
    enableAppSwitcherProtection: handleEnableAppSwitcher,
    disableAppSwitcherProtection: handleDisableAppSwitcher,
    clearClipboard: handleClearClipboard,
  };

  return (
    <PrivacyGuardContext.Provider value={value}>
      {children}
    </PrivacyGuardContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePrivacyGuardContext(): UsePrivacyGuardReturn {
  const ctx = useContext<PrivacyGuardContextType>(PrivacyGuardContext);

  if (ctx === null) {
    throw new Error(
      '[PrivacyGuardKit] usePrivacyGuardContext() was called outside of ' +
        '<PrivacyGuardProvider>.\n' +
        'Wrap your component tree (or just the sensitive subtree) with:\n' +
        '  <PrivacyGuardProvider>\n' +
        '    <YourComponent />\n' +
        '  </PrivacyGuardProvider>'
    );
  }

  return ctx;
}
