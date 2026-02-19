// API
export {
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
} from './PrivacyGuardkitApi';

// Hooks
export {
  usePrivacyGuard,
  useScreenshotListener,
  useScreenRecording,
} from './Hooks';

// Provider + context hook
export {
  PrivacyGuardProvider,
  usePrivacyGuardContext,
} from './PrivacyGuardProvider';

// Components
export { SecureView } from './SecureView';

// Types
export type {
  PrivacyGuardEvent,
  PrivacyGuardKitConfig,
  UsePrivacyGuardReturn,
  ScreenRecordingEventPayload,
} from './types';
