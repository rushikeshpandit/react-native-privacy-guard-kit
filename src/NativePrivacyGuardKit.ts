/**
 * NativePrivacyGuardKit.ts
 *
 * Low-level bridge to the native PrivacyGuardKit module.
 *
 * This is the ONLY file that touches `NativeModules` directly. All higher-level
 * files (PrivacyGuardKitApi, Hooks, Provider) import from here.
 *
 * ── MODULE NOT FOUND ──────────────────────────────────────────────────────────
 *   If the native module is not found we throw at import time with a clear,
 *   actionable error rather than a cryptic "undefined is not an object" at
 *   the call site.
 *
 *   Common causes:
 *     - Library not linked: run `pod install` (iOS) or sync Gradle (Android).
 *     - App not rebuilt after linking.
 *     - Running in Expo Go without a custom dev client.
 *     - Running on web (React Native Web is not supported).
 *
 * ── NativeEventEmitter CONSTRUCTOR COMPATIBILITY ──────────────────────────────
 *   `ConstructorParameters<typeof NativeEventEmitter>[0]` resolves the first
 *   constructor argument type from whichever RN version is installed. This
 *   avoids hardcoding a specific RN-internal type that has changed across
 *   RN 0.65 → 0.72 → 0.73+. The intermediate `unknown` cast is required because
 *   `PrivacyGuardKit` comes out of `NativeModules` typed as `any`.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Native Module Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the exact method signatures exposed by the native layer.
 * All methods return Promise<T> — the bridge is always async.
 *
 * IMPORTANT: These signatures MUST match the native declarations:
 *   iOS:     RCT_EXTERN_METHOD declarations in PrivacyGuardKit.m
 *   Android: @ReactMethod signatures in PrivacyGuardKitModule.kt
 *
 * Do NOT call these directly from application code — use PrivacyGuardKitApi.ts.
 */
export interface INativePrivacyGuardKit {
  // ── Screen Capture ──────────────────────────────────────────────────────────

  /**
   * iOS:     Installs a secure UITextField overlay.
   * Android: Applies FLAG_SECURE to the Activity window.
   *          Rejects with `NO_ACTIVITY` if no foreground Activity is available.
   */
  disableScreenCapture(): Promise<boolean>;

  /**
   * Android: FLAG_SECURE is only cleared if app-switcher protection is also inactive.
   */
  enableScreenCapture(): Promise<boolean>;

  /**
   * Returns whether screen-capture protection is currently active.
   * Reads the actual window flags on Android; in-module state on iOS.
   * Always resolves, never rejects.
   */
  isScreenCaptureDisabled(): Promise<boolean>;

  // ── Screen Recording ────────────────────────────────────────────────────────

  /**
   * iOS:     Reads `UIScreen.isCaptured`. Returns `false` on Simulator.
   * Android: Always returns `false` (no public detection API).
   */
  isScreenBeingRecorded(): Promise<boolean>;

  // ── Screenshot Listener ─────────────────────────────────────────────────────

  /**
   * Registers the native screenshot/recording observer.
   * Must be called before screenshot or recording events will fire.
   * Idempotent on both platforms.
   */
  startScreenshotListener(): Promise<boolean>;

  /**
   * Unregisters the native screenshot/recording observer.
   * Safe to call when no listener is active (no-op).
   */
  stopScreenshotListener(): Promise<boolean>;

  // ── App Switcher ────────────────────────────────────────────────────────────

  /**
   * iOS:     Registers willResignActive / didBecomeActive overlay observers.
   * Android: Applies FLAG_SECURE independently from screen-capture protection.
   */
  enableAppSwitcherProtection(): Promise<boolean>;

  /**
   * Android: FLAG_SECURE only cleared if screen-capture protection is also inactive.
   */
  disableAppSwitcherProtection(): Promise<boolean>;

  // ── Clipboard ───────────────────────────────────────────────────────────────

  /**
   * iOS:     Sets `UIPasteboard.general.items = []`. Never rejects.
   * Android: Uses `clearPrimaryClip()` (API 28+) or empty ClipData (pre-28).
   *          May reject with `CLIPBOARD_CLEAR_ERROR`.
   *
   * Note (Android API 29+): System may show a toast "App cleared your clipboard".
   */
  clearClipboard(): Promise<boolean>;

  // ── NativeEventEmitter stubs ────────────────────────────────────────────────

  /** Required no-op stub. Called automatically by NativeEventEmitter. */
  addListener(eventName: string): void;

  /** Required no-op stub. Called automatically by NativeEventEmitter. */
  removeListeners(count: number): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Resolution
// ─────────────────────────────────────────────────────────────────────────────

const { PrivacyGuardKit } = NativeModules;

/**
 * Detect test environments before throwing.
 *
 * jest sets JEST_WORKER_ID in every test worker process.
 * NODE_ENV === 'test' is set by most test runners.
 * Either condition is sufficient to suppress the throw.
 */
const isTestEnvironment =
  typeof process !== 'undefined' &&
  (process.env['NODE_ENV'] === 'test' ||
    process.env['JEST_WORKER_ID'] !== undefined);

if (!PrivacyGuardKit && !isTestEnvironment) {
  const platform = Platform.OS;
  const hint =
    platform === 'android'
      ? 'Ensure the library is in your Gradle dependencies and the app has been rebuilt.'
      : platform === 'ios'
      ? 'Run `pod install` in the /ios directory and rebuild the app.'
      : `Platform "${platform}" is not supported by PrivacyGuardKit.`;

  throw new Error(
    `[PrivacyGuardKit] Native module "PrivacyGuardKit" was not found.\n` +
      `${hint}\n` +
      `If you are using Expo Go, you must use a custom development build.\n` +
      `See: https://docs.expo.dev/develop/development-builds/introduction/`
  );
}

/**
 * Typed reference to the native PrivacyGuardKit module.
 *
 * In test environments this may be an empty object — callers must mock
 * this module via jest.mock() for tests that exercise native calls:
 *
 * @example
 * jest.mock('react-native-privacy-guard-kit', () => ({
 *   NativePrivacyGuardKit: {
 *     disableScreenCapture: jest.fn().mockResolvedValue(true),
 *     // ... other methods
 *   },
 * }));
 */
export const NativePrivacyGuardKit = (PrivacyGuardKit ??
  {}) as INativePrivacyGuardKit;

/**
 * NativeEventEmitter instance for PrivacyGuardKit events.
 *
 * Constructed with the native module instance for correct listener ref-counting.
 * The bridge automatically calls `addListener` / `removeListeners` stubs on
 * the native side as JS subscribers are added and removed.
 *
 * The `ConstructorParameters<typeof NativeEventEmitter>[0]` cast resolves the
 * first constructor argument type from the installed RN version's .d.ts,
 * making this compatible with RN 0.65 through 0.73+ without hardcoding an
 * internal RN type.
 */
export const PrivacyGuardKitEmitter = new NativeEventEmitter(
  NativePrivacyGuardKit as unknown as ConstructorParameters<
    typeof NativeEventEmitter
  >[0]
);
