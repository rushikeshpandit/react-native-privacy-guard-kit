# react-native-privacy-guard-kit

<p align="center">
  <img src="https://img.shields.io/npm/v/react-native-privacy-guard-kit?color=crimson&style=for-the-badge" alt="npm version" />
  <img src="https://img.shields.io/badge/Android-API_29%2B-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android API 29+" />
  <img src="https://img.shields.io/badge/iOS_13%2B-000000?style=for-the-badge&logo=apple&logoColor=white" alt="iOS 13+" />
  <img src="https://img.shields.io/badge/New_Architecture-Fabric_%2B_Paper-blue?style=for-the-badge" alt="New Architecture" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/16KB_Page_Size-Compatible-22C55E?style=for-the-badge" alt="16KB Compatible" />
  <img src="https://img.shields.io/badge/License-MIT-orange?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  A production-ready, zero-dependency React Native library that protects your app's sensitive content from screenshots, screen recordings, app-switcher previews, and clipboard leaks — with a full hook, provider, and strict TypeScript API.
</p>

---

## Why PrivacyGuardKit?

Most sensitive apps (banking, health, fintech, enterprise) need several privacy protections at once. Rolling them yourself means dealing with `FLAG_SECURE`, UIKit overlay hacks, `ContentObserver` threading, and clipboard timing — on two platforms, across multiple architecture generations. PrivacyGuardKit handles all of it in a single, well-tested package:

| What you need | How the library solves it |
|---|---|
| Block screenshots and screen recordings | `disableScreenCapture()` — `FLAG_SECURE` on Android, secure `UITextField` overlay on iOS |
| Know when recording starts / stops | `useScreenRecording()` reactive hook + `onScreenRecordingStarted/Stopped` events |
| Hide content in the OS task switcher | `enableAppSwitcherProtection()` — blank overlay before the OS snapshot is taken |
| Alert the user a screenshot was taken | `useScreenshotListener(callback)` — native observer, zero polling |
| Prevent copy/paste of sensitive text | `<SecureView>` — blocks at the native view level, not with JS heuristics |
| Wipe sensitive data from the clipboard | `clearClipboard()` — full pasteboard/clipboard clear |

Everything is fully typed, tree-shakeable, and works without any configuration changes for both the Old Architecture (Paper) and New Architecture (Fabric / TurboModules).

---

## Feature Highlights

- **Screen Capture Blocking** — Blackens screenshots and recording previews without any visible change to the live UI. App Store–safe on iOS (documented UIKit technique, not a private API).
- **Real-time Recording Detection** — Reactive `useScreenRecording()` hook backed by `UIScreen.capturedDidChangeNotification` on iOS. No polling, instant updates.
- **App Switcher Protection** — Covers the recent-tasks thumbnail with a blank overlay the moment the app resigns active — *before* the OS takes its snapshot.
- **Screenshot Events** — Subscribe to `onScreenshotTaken` to log, warn, or react. Uses a ref-counted shared native observer so multiple subscribers never create duplicate OS listeners.
- **Copy/Paste Blocking** — `<SecureView>` intercepts `canPerformAction:withSender:` (iOS) and overrides `ActionMode.Callback` on all `TextView`/`EditText` descendants (Android) — at the native level, not breakable by JS.
- **Clipboard Wipe** — `clearClipboard()` removes all pasteboard items. Call on screen blur, session timeout, or logout.
- **Dual Architecture Support** — Ships a Fabric Codegen spec (`RNSecureViewNativeComponent.ts`) for the New Architecture and a Paper `RNSecureViewManager.mm` fallback for legacy projects.
- **Google 16KB Page Size Compatible** — No native `.so` files with non-standard memory alignment. Fully compliant with Android 15's mandatory 16KB page size requirement.
- **Strict TypeScript** — Every function, hook, event, error code, and config field is typed. `NativeErrorCode` union type lets you handle specific native rejections.
- **Zero dependencies** — No third-party packages. Pure React Native bridge code.

---

## Platform Support

| Feature | Android | iOS |
|---|---|---|
| Screen capture blocking | ✅ API 29+ (`FLAG_SECURE`) | ✅ iOS 13+ (UITextField overlay) |
| Screen recording detection | ❌ No public API (see note) | ✅ iOS 11+ (`UIScreen.isCaptured`) |
| App switcher protection | ✅ API 29+ (`FLAG_SECURE`) | ✅ iOS 13+ (`willResignActive`) |
| Screenshot detection | ✅ API 29+ (`ContentObserver`) | ✅ iOS 7+ (`userDidTakeScreenshotNotification`) |
| Copy/paste blocking (SecureView) | ✅ All versions | ✅ iOS 13+ (Fabric + Paper) |
| Clipboard clear | ✅ API 21+ | ✅ iOS 9+ |

> **Android recording detection note:** No public Android API exists for detecting active screen recordings (as of API 34). `isScreenBeingRecorded()` always returns `false` on Android. Use `disableScreenCapture()` instead — `FLAG_SECURE` prevents recording content from being visible regardless of detection.

> **iOS Simulator note:** Screen capture blocking installs the overlay correctly but host-OS screenshots bypass UIKit rendering. `userDidTakeScreenshotNotification` and `UIScreen.isCaptured` never fire on the Simulator. Test these features on a physical device.

---

## Installation

```sh
npm install react-native-privacy-guard-kit
# or
yarn add react-native-privacy-guard-kit
```

### iOS

```sh
cd ios && pod install
```

### Android

Auto-linking handles everything. No manual steps required.

### Permissions (Android only)

Screenshot detection requires a storage read permission to watch `MediaStore`. Add the appropriate permission to your `AndroidManifest.xml`:

```xml
<!-- API 32 and below -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />

<!-- API 33+ (Android 13+) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

Request the permission at runtime before calling `onScreenshotTaken` / `useScreenshotListener`:

```tsx
import { PermissionsAndroid, Platform } from 'react-native';

if (Platform.OS === 'android') {
  await PermissionsAndroid.request(
    Platform.Version >= 33
      ? 'android.permission.READ_MEDIA_IMAGES'
      : 'android.permission.READ_EXTERNAL_STORAGE'
  );
}
```

> Screen capture blocking, app-switcher protection, and clipboard clearing require **no permissions** on either platform.

---

## Quick Start

### Option 1 — Provider (Recommended for most apps)

Wrap your root component (or any sensitive screen subtree) with `<PrivacyGuardProvider>`. Every child gets full access to the API via `usePrivacyGuardContext()` — one setup, zero prop drilling.

```tsx
import { PrivacyGuardProvider } from 'react-native-privacy-guard-kit';

export default function App() {
  return (
    <PrivacyGuardProvider
      config={{
        disableScreenCapture: true,
        enableAppSwitcherProtection: true,
      }}
      onScreenshot={() => Alert.alert('📸 Screenshot detected!')}
    >
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </PrivacyGuardProvider>
  );
}
```

Then anywhere inside your tree:

```tsx
import { usePrivacyGuardContext } from 'react-native-privacy-guard-kit';

function PaymentScreen() {
  const { isRecording, clearClipboard } = usePrivacyGuardContext();

  return (
    <View>
      {isRecording && (
        <Text style={{ color: 'red' }}>
          Screen recording is active — your data may be visible to the recorder.
        </Text>
      )}
      <Button title="Clear clipboard" onPress={clearClipboard} />
    </View>
  );
}
```

---

### Option 2 — Hooks (per-screen control)

Use `usePrivacyGuard` when you want protection to automatically activate on mount and deactivate on unmount — perfect for individual sensitive screens.

```tsx
import {
  usePrivacyGuard,
  useScreenshotListener,
  useScreenRecording,
} from 'react-native-privacy-guard-kit';

function SensitiveScreen() {
  // Applies on mount, reverses on unmount automatically
  const { isRecording, isScreenCaptureDisabled } = usePrivacyGuard({
    disableScreenCapture: true,
    enableAppSwitcherProtection: true,
  });

  // Fires every time the user takes a screenshot
  useScreenshotListener(() => {
    analytics.track('screenshot_on_sensitive_screen');
    Alert.alert('Screenshot detected', 'This screen contains sensitive data.');
  });

  // Reactive boolean — re-renders component when recording state changes
  const isBeingRecorded = useScreenRecording();

  if (isBeingRecorded) {
    return <SafeRecordingFallback />;
  }

  return <SensitiveContent />;
}
```

---

### Option 3 — Imperative API (full manual control)

Useful for navigation lifecycle callbacks, Redux middleware, or anywhere outside a React component.

```tsx
import {
  disableScreenCapture,
  enableScreenCapture,
  enableAppSwitcherProtection,
  disableAppSwitcherProtection,
  isScreenBeingRecorded,
  clearClipboard,
  onScreenshotTaken,
  onScreenRecordingStarted,
  onScreenRecordingStopped,
} from 'react-native-privacy-guard-kit';

// ── In a React component lifecycle ───────────────────────────────────────────

useEffect(() => {
  disableScreenCapture();
  return () => enableScreenCapture();
}, []);

// ── One-time queries ─────────────────────────────────────────────────────────

const isRecording = await isScreenBeingRecorded(); // boolean

// ── Event listeners — each returns an unsubscribe function ──────────────────

const unsubScreenshot = onScreenshotTaken(() => {
  console.log('Screenshot taken!');
});

const unsubRecStart = onScreenRecordingStarted(({ isRecording }) => {
  console.log('Recording started:', isRecording); // true
});

const unsubRecStop = onScreenRecordingStopped(({ isRecording }) => {
  console.log('Recording stopped:', isRecording); // false
});

// Cleanup
unsubScreenshot();
unsubRecStart();
unsubRecStop();

// ── On logout / session end ──────────────────────────────────────────────────

await clearClipboard();
```

---

### Option 4 — SecureView Component

Drop `<SecureView>` around any sensitive content to block copy, paste, cut, and text selection at the native level. Works on `<Text>`, `<TextInput>`, and any custom components that render text.

```tsx
import { SecureView } from 'react-native-privacy-guard-kit';

function SensitiveCard() {
  return (
    // isCopyPasteDisabled defaults to true — omitting it is fine
    <SecureView>
      <Text>Account number: 1234-5678-9012-3456</Text>
      <TextInput
        value={secretToken}
        editable={false}
        // Recommended belt-and-suspenders for iOS Paper (Old Architecture)
        contextMenuHidden
        selectTextOnFocus={false}
      />
    </SecureView>
  );
}

// Conditionally toggle protection:
<SecureView isCopyPasteDisabled={isAuthenticated}>
  <SensitiveContent />
</SecureView>
```

> **iOS Paper tip:** Add `contextMenuHidden` and `selectTextOnFocus={false}` to `<TextInput>` children for complete protection on the Old Architecture, where the responder-chain approach may not intercept the TextInput's own context menu before `canPerformAction:withSender:`.

---

## Real-World Use Cases

### Banking & Fintech

```tsx
// Auto-protect on mount, auto-restore on unmount
function AccountBalanceScreen() {
  usePrivacyGuard({
    disableScreenCapture: true,
    enableAppSwitcherProtection: true,
  });

  return (
    <SecureView>
      <Text>Balance: $12,345.67</Text>
      <Text>Account: ****9012</Text>
    </SecureView>
  );
}
```

### Health & Medical

```tsx
// Warn the user + log when a screenshot is attempted
function PatientRecordScreen() {
  useScreenshotListener(useCallback(() => {
    auditLog.record({ event: 'screenshot', screen: 'patient_record', userId });
    Alert.alert(
      'Privacy Notice',
      'Screenshots of patient records may violate HIPAA. Please review your organisation\'s data handling policy.'
    );
  }, [userId]));

  return <PatientRecord />;
}
```

### Authentication / OTP Screens

```tsx
// Clear the clipboard the moment the user leaves the screen
function OTPScreen() {
  const { clearClipboard } = usePrivacyGuardContext();

  useEffect(() => {
    return () => {
      // Wipe any OTP that may have been pasted from SMS
      clearClipboard();
    };
  }, [clearClipboard]);

  return (
    <SecureView>
      <OTPInput />
    </SecureView>
  );
}
```

### Enterprise / Document Viewer

```tsx
// Detect and react to recording in real time
function ConfidentialDocumentViewer() {
  const isRecording = useScreenRecording();

  if (isRecording) {
    return (
      <View style={styles.blocked}>
        <Text>Screen recording detected.</Text>
        <Text>Stop the recording to view this document.</Text>
      </View>
    );
  }

  return <PDFViewer uri={documentUri} />;
}
```

### App-Wide Coverage (Root Provider)

```tsx
// Global protection: auto-enable on every screen, disable on public screens
export default function App() {
  return (
    <PrivacyGuardProvider
      config={{
        disableScreenCapture: true,
        enableAppSwitcherProtection: true,
      }}
      onScreenshot={() => {
        analytics.track('app_screenshot');
      }}
    >
      <AppNavigator />
    </PrivacyGuardProvider>
  );
}
```

---

## API Reference

### `<PrivacyGuardProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `config` | `PrivacyGuardKitConfig` | `{}` | Feature flags applied on mount, reversed on unmount |
| `onScreenshot` | `() => void` | — | Fired on every screenshot. Always calls the latest version even if the prop changes between renders. |
| `children` | `ReactNode` | — | Your component subtree |

---

### `PrivacyGuardKitConfig`

| Key | Type | Description |
|---|---|---|
| `disableScreenCapture` | `boolean` | Block screenshots and recording previews on mount |
| `enableAppSwitcherProtection` | `boolean` | Show blank overlay in the OS task switcher on mount |
| `isCopyPasteDisabled` | `boolean` | Informational — passed through to `<SecureView>` |

---

### Hooks

#### `usePrivacyGuard(config?): UsePrivacyGuardReturn`

All-in-one declarative hook. Applies `config` on mount and reverses it on unmount. Returns stable imperative method references (safe as `useCallback` dependencies).

| Return field | Type | Description |
|---|---|---|
| `isScreenCaptureDisabled` | `boolean` | Whether capture blocking is currently active |
| `isRecording` | `boolean` | Whether the screen is being recorded (iOS only; always `false` on Android) |
| `disableScreenCapture` | `() => Promise<void>` | Block screenshots |
| `enableScreenCapture` | `() => Promise<void>` | Re-enable screenshots |
| `enableAppSwitcherProtection` | `() => Promise<void>` | Enable task-switcher overlay |
| `disableAppSwitcherProtection` | `() => Promise<void>` | Remove task-switcher overlay |
| `clearClipboard` | `() => Promise<void>` | Wipe clipboard |

#### `useScreenshotListener(callback: () => void): void`

Registers `callback` on every screenshot event. Callback reference can change between renders safely — the native subscription is created once on mount via an internal ref pattern; no re-subscription occurs.

#### `useScreenRecording(): boolean`

Returns a reactive boolean that is `true` while the screen is being recorded or mirrored. Bootstraps from `isScreenBeingRecorded()` on mount, then stays in sync via native events. Always `false` on Android and iOS Simulator.

#### `usePrivacyGuardContext(): UsePrivacyGuardReturn`

Returns the same shape as `usePrivacyGuard`. Must be called inside a `<PrivacyGuardProvider>`. Throws a descriptive error with setup instructions if called outside.

---

### Imperative API

| Function | Returns | Description |
|---|---|---|
| `disableScreenCapture()` | `Promise<void>` | Block screenshots and recording previews |
| `enableScreenCapture()` | `Promise<void>` | Re-enable screenshots |
| `isScreenCaptureDisabled()` | `Promise<boolean>` | Query current capture protection state |
| `isScreenBeingRecorded()` | `Promise<boolean>` | Query recording/mirroring state (iOS only) |
| `enableAppSwitcherProtection()` | `Promise<void>` | Show blank overlay in the task switcher |
| `disableAppSwitcherProtection()` | `Promise<void>` | Remove the task-switcher overlay |
| `clearClipboard()` | `Promise<void>` | Wipe all system clipboard/pasteboard items |
| `onScreenshotTaken(cb)` | `UnsubscribeFn` | Subscribe to screenshot events. Returns unsubscribe. |
| `onScreenRecordingStarted(cb)` | `UnsubscribeFn` | Subscribe to recording start. Returns unsubscribe. |
| `onScreenRecordingStopped(cb)` | `UnsubscribeFn` | Subscribe to recording stop. Returns unsubscribe. |

#### Native Listener Ref-Counting

`onScreenshotTaken`, `onScreenRecordingStarted`, and `onScreenRecordingStopped` all share a **single** native observer that is ref-counted in JavaScript:

- First subscriber of any type → native observer starts
- Last subscriber of any type → native observer stops

This means registering 3 different callbacks creates only 1 native OS listener, and all 3 `UnsubscribeFn` calls are required to stop it.

---

### `<SecureView>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `isCopyPasteDisabled` | `boolean` | `true` | Block text selection, copy, cut, and paste for all children |
| `style` | `StyleProp<ViewStyle>` | `{ flex: 1 }` | Container view style |
| `children` | `ReactNode` | — | Sensitive content |

> **Layout note:** `<SecureView>` defaults to `flex: 1` to fill its parent. When using it as an inline container (not full-screen), pass `style={{ flex: undefined }}` to let it size to its children.

---

### Types

```ts
import type {
  PrivacyGuardKitConfig,      // Config object for hooks and provider
  UsePrivacyGuardReturn,       // Return type of usePrivacyGuard / usePrivacyGuardContext
  PrivacyGuardEvent,           // Union of event name strings
  ScreenRecordingEventPayload, // { isRecording: boolean } — payload for recording events
  ScreenshotEventPayload,      // Record<string, never> — screenshot events carry no payload
  ScreenshotListener,          // () => void
  RecordingListener,           // (payload: ScreenRecordingEventPayload) => void
  UnsubscribeFn,               // () => void — returned by on* functions
  NativeErrorCode,             // Union of native error code strings
  SecureViewProps,             // Props for <SecureView>
} from 'react-native-privacy-guard-kit';
```

#### `NativeErrorCode`

Surfaces as `error.code` when a native call rejects. Android only — iOS methods never reject.

```ts
type NativeErrorCode =
  | 'NO_ACTIVITY'                  // No foreground Activity available
  | 'DISABLE_CAPTURE_ERROR'        // FLAG_SECURE could not be applied
  | 'ENABLE_CAPTURE_ERROR'         // FLAG_SECURE could not be cleared
  | 'APP_SWITCHER_ERROR'           // App-switcher flag mutation failed
  | 'APP_SWITCHER_DISABLE_ERROR'   // App-switcher flag clear failed
  | 'SCREENSHOT_LISTENER_ERROR'    // ContentObserver registration failed
  | 'SCREENSHOT_LISTENER_STOP_ERROR' // ContentObserver unregister failed
  | 'CLIPBOARD_CLEAR_ERROR';       // Clipboard clear failed
```

Handling native errors:

```tsx
try {
  await disableScreenCapture();
} catch (err) {
  if (err instanceof Error && (err as any).code === 'NO_ACTIVITY') {
    // App was backgrounded before the call completed
  }
}
```

---

## How It Works

### Android

| Feature | Implementation |
|---|---|
| Screen capture blocking | `WindowManager.LayoutParams.FLAG_SECURE` on the Activity window. Content appears black in all screenshots and recordings. |
| App switcher protection | Same `FLAG_SECURE` flag — it also hides content in the recent-tasks thumbnail on Android. Tracked independently from capture protection. |
| Screenshot detection | `ContentObserver` on `MediaStore.Images.Media.EXTERNAL_CONTENT_URI`, watching for new images whose path contains a screenshot keyword. |
| Copy/paste blocking | Disables `isLongClickable`, `setTextIsSelectable`, and overrides `customSelectionActionModeCallback` / `customInsertionActionModeCallback` on all `TextView` and `EditText` descendants recursively. |
| Clipboard clear | `ClipboardManager.clearPrimaryClip()` (API 28+) or overwrites with empty `ClipData` (pre-API 28). |

### iOS

| Feature | Implementation |
|---|---|
| Screen capture blocking | A full-screen `UITextField` with `isSecureTextEntry = true` is inserted at the back of the window (`layer.zPosition = Float.greatestFiniteMagnitude` ensures it stays behind all content). iOS's own rendering pipeline blacks out secure text fields in the capture pipeline. |
| App switcher protection | Registers `willResignActive` / `didBecomeActive` observers. A solid full-screen overlay is placed *before* the OS takes its snapshot. Removed immediately when the app returns to foreground. |
| Screenshot detection | `UIApplication.userDidTakeScreenshotNotification`. Fires after the screenshot is captured — cannot prevent it. |
| Screen recording detection | `UIScreen.capturedDidChangeNotification` + `UIScreen.main.isCaptured`. Covers ReplayKit, AirPlay mirroring, and QuickTime capture. |
| Copy/paste blocking (Fabric) | Overrides `canPerformAction:withSender:` at the container level; sets `selectable = NO` / `editable = NO` on `UITextView` children recursively via `updateProps:oldProps:`. Prop-change diff guards prevent redundant traversal. |
| Copy/paste blocking (Paper) | `canPerformAction:withSender:` override at the `RNSecureUIView` level. `hitTest:withEvent:` passthrough ensures the container enters the responder chain on all iOS versions. |
| Clipboard clear | `UIPasteboard.general.items = []`. Clears text, images, and all custom pasteboard types. |

---

## Architecture

```
react-native-privacy-guard-kit/
├── src/
│   ├── index.tsx                         ← Public API surface (barrel export)
│   ├── NativePrivacyGuardKit.ts          ← Native module bridge + INativePrivacyGuardKit interface
│   ├── PrivacyGuardKitApi.ts             ← Typed imperative API + ref-counted listener manager
│   ├── Hooks.ts                          ← usePrivacyGuard, useScreenshotListener, useScreenRecording
│   ├── PrivacyGuardProvider.tsx          ← Context provider + usePrivacyGuardContext
│   ├── SecureView.tsx                    ← <SecureView> component
│   ├── types.ts                          ← All public TypeScript types
│   └── specs/
│       └── RNSecureViewNativeComponent.ts ← Fabric codegen spec
├── android/
│   └── src/main/java/…/
│       ├── PrivacyGuardKitModule.kt       ← Main Android native module
│       ├── PrivacyGuardKitPackage.kt      ← ReactPackage registration
│       ├── SecureView.kt                  ← Android SecureView implementation
│       ├── SecureViewManager.kt           ← Android ViewManager
│       └── ScreenshotObserver.kt          ← ContentObserver for screenshot detection
└── ios/
    ├── PrivacyGuardKit.swift              ← Swift bridge coordinator
    ├── ScreenCaptureManager.swift         ← UITextField secure overlay
    ├── AppSwitcherProtectionManager.swift ← willResignActive overlay
    ├── ScreenshotDetectionManager.swift   ← NotificationCenter observers
    ├── PrivacyGuardKit.m                  ← ObjC bridge (RCT_EXTERN_MODULE)
    ├── PrivacyGuardKit-Umbrella.h         ← CocoaPods umbrella header
    ├── RNSecureViewComponentView.h        ← Fabric component header (New Arch only)
    ├── RNSecureViewComponentView.mm       ← Fabric component implementation
    └── RNSecureViewManager.mm             ← Paper ViewManager (Old Arch fallback)
```

---

## FAQ

**Does disableScreenCapture change what the user sees on screen?**
No. The secure `UITextField` overlay on iOS is sent to the *back* of the window hierarchy and is invisible to the user. On Android, `FLAG_SECURE` has no visual effect on the live display — it only affects the capture pipeline.

**Is the UITextField technique App Store–safe?**
Yes. It uses only documented UIKit APIs (`isSecureTextEntry`) and does not touch any private frameworks. It has been used in production apps on the App Store for many years.

**Does FLAG_SECURE block the Android emulator's screenshot button?**
No. Emulator host-OS screenshot tools (Android Studio, macOS screenshot, OBS) operate outside the Android process and bypass `FLAG_SECURE`. This is expected and cannot be prevented. The flag works correctly on all physical devices.

**Can I use both a PrivacyGuardProvider and usePrivacyGuard at the same time?**
Yes. The hook and provider manage separate state independently. The shared native observer is ref-counted, so starting both does not register the OS listener twice.

**What happens if I call disableScreenCapture multiple times?**
It is idempotent. iOS removes existing observers before re-registering; Android's `addFlags` is a no-op if the flag is already set.

**Does clearClipboard show any UI to the user?**
On Android API 29+, the OS may show a brief system toast "App cleared your clipboard". This is OS behaviour and cannot be suppressed. On iOS, no UI is shown.

---

## Contributing

Contributions are what make open source such an amazing place. **Pull Requests are always welcome.**

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feat/my-feature`
5. Open a Pull Request

Found a bug or have a feature request? **[Open an issue](https://github.com/rushikeshpandit/react-native-privacy-guard-kit/issues)** — we respond promptly.

Please follow the existing code style: TypeScript strict mode, JSDoc on every public symbol, and inline comments explaining the *why* for any non-obvious native bridge behaviour.

---

## License

MIT © [Rushikesh Pandit](https://github.com/rushikeshpandit)

---

<p align="center">Made with ❤️ in India for the React Native community</p>