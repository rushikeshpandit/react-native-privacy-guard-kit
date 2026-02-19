import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  disableScreenCapture,
  enableScreenCapture,
  enableAppSwitcherProtection,
  disableAppSwitcherProtection,
  isScreenBeingRecorded,
  clearClipboard,
  onScreenRecordingStarted,
  onScreenRecordingStopped,
  onScreenshotTaken,
} from './PrivacyGuardkitApi';
import type { PrivacyGuardKitConfig, UsePrivacyGuardReturn } from './types';

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

type PrivacyGuardContextType = UsePrivacyGuardReturn | null;
const PrivacyGuardContext = createContext<PrivacyGuardContextType>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

interface PrivacyGuardProviderProps {
  children: ReactNode;
  config?: PrivacyGuardKitConfig;
  /** Called every time a screenshot is detected */
  onScreenshot?: () => void;
}

/**
 * Wrap your root (or any sensitive screen) with this provider.
 * All children can call `usePrivacyGuardContext()` to access the API.
 *
 * @example
 * <PrivacyGuardProvider
 *   config={{ disableScreenCapture: true, enableAppSwitcherProtection: true }}
 *   onScreenshot={() => Alert.alert('Screenshot blocked!')}
 * >
 *   <App />
 * </PrivacyGuardProvider>
 */
export function PrivacyGuardProvider({
  children,
  config = {},
  onScreenshot,
}: PrivacyGuardProviderProps) {
  const [captureDisabled, setCaptureDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Apply config
    if (config.disableScreenCapture) {
      disableScreenCapture().then(() => setCaptureDisabled(true));
    }
    if (config.enableAppSwitcherProtection) {
      enableAppSwitcherProtection();
    }

    isScreenBeingRecorded().then(setIsRecording);

    // Event subscriptions
    const cleanups: Array<() => void> = [];

    if (onScreenshot) {
      cleanups.push(onScreenshotTaken(onScreenshot));
    }

    cleanups.push(onScreenRecordingStarted(() => setIsRecording(true)));
    cleanups.push(onScreenRecordingStopped(() => setIsRecording(false)));

    return () => {
      cleanups.forEach((fn) => fn());
      if (config.disableScreenCapture) enableScreenCapture();
      if (config.enableAppSwitcherProtection) disableAppSwitcherProtection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisable = useCallback(async () => {
    await disableScreenCapture();
    setCaptureDisabled(true);
  }, []);

  const handleEnable = useCallback(async () => {
    await enableScreenCapture();
    setCaptureDisabled(false);
  }, []);

  const value: UsePrivacyGuardReturn = {
    isScreenCaptureDisabled: captureDisabled,
    isRecording,
    disableScreenCapture: handleDisable,
    enableScreenCapture: handleEnable,
    enableAppSwitcherProtection: async () => enableAppSwitcherProtection(),
    disableAppSwitcherProtection: async () => disableAppSwitcherProtection(),
    clearClipboard,
  };

  return (
    <PrivacyGuardContext.Provider value={value}>
      {children}
    </PrivacyGuardContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Consumer hook
// ─────────────────────────────────────────────────────────────

/**
 * Access the PrivacyGuard API from any component inside the provider.
 *
 * @example
 * const { isRecording } = usePrivacyGuardContext();
 */
export function usePrivacyGuardContext(): UsePrivacyGuardReturn {
  const ctx = useContext<PrivacyGuardContextType>(PrivacyGuardContext);
  if (!ctx) {
    throw new Error(
      'usePrivacyGuardContext must be used inside <PrivacyGuardProvider>'
    );
  }
  return ctx;
}
