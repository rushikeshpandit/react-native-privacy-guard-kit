export type PrivacyGuardEvent =
  | 'onScreenshotTaken'
  | 'onScreenRecordingStarted'
  | 'onScreenRecordingStopped';

export interface ScreenRecordingEventPayload {
  isRecording: boolean;
}

export interface PrivacyGuardKitConfig {
  /** Disable screen capture (screenshot + screen recording blur) */
  disableScreenCapture?: boolean;
  /** Show a blank overlay in the app switcher */
  enableAppSwitcherProtection?: boolean;
  /** Prevent copy/paste within SecureView children */
  disableCopyPaste?: boolean;
}

export interface UsePrivacyGuardReturn {
  /** Whether screen capture is currently disabled */
  isScreenCaptureDisabled: boolean;
  /** Whether the screen is actively being recorded */
  isRecording: boolean;
  /** Disable screenshots and screen-recording preview */
  disableScreenCapture: () => Promise<void>;
  /** Re-enable screenshots */
  enableScreenCapture: () => Promise<void>;
  /** Enable app switcher blur overlay */
  enableAppSwitcherProtection: () => Promise<void>;
  /** Disable app switcher blur overlay */
  disableAppSwitcherProtection: () => Promise<void>;
  /** Clears the system clipboard */
  clearClipboard: () => Promise<void>;
}
