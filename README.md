# react-native-privacy-guard-kit

<p align="center">
  <img src="https://img.shields.io/npm/v/react-native-privacy-guard-kit?color=crimson&style=for-the-badge" alt="npm version" />
  <img src="https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/iOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="iOS" />
  <img src="https://img.shields.io/badge/New_Architecture-Ready-blue?style=for-the-badge" alt="New Architecture" />
  <img src="https://img.shields.io/badge/16KB_Page_Size-Compatible-green?style=for-the-badge" alt="16KB Compatible" />
  <img src="https://img.shields.io/badge/Open_Source-Forever-orange?style=for-the-badge" alt="Open Source" />
</p>

<p align="center">
  A production-ready, zero-dependency React Native library that protects your app's sensitive content from screenshots, screen recordings, app switcher previews, and clipboard leaks — with full hook, provider, and TypeScript support.
</p>

---

## Features

- **Disable Screenshots** — Prevent users or system tools from capturing your screen
- **Screen Recording Detection** — Detect and react to active screen recording in real time
- **App Switcher Protection** — Blur / cover sensitive content in the iOS & Android task switcher
- **Clipboard Protection** — Programmatically clear the system clipboard
- **Event Listeners** — Subscribe to screenshot taken, recording started, and recording stopped events
- **Hooks & Provider** — `usePrivacyGuard`, `useScreenRecording`, `useScreenshotListener`, and `<PrivacyGuardProvider>`
- **SecureView Component** — Drop-in `<View>` replacement that disables copy/paste for all children
- **Google 16KB Page Size Compatible** — Fully aligned with Android's new 16KB memory page size requirement mandatory from Android 15+
- **New Architecture Ready** — Built with React Native's new architecture (JSI / Fabric) in mind
- **Open Source Forever** — MIT licensed, community-driven, always free

---

## Installation

```sh
npm install react-native-privacy-guard-kit
```

or

```sh
yarn add react-native-privacy-guard-kit
```

### iOS

```sh
cd ios && pod install
```

### Android

No extra steps required. Auto-linking handles everything.

---

## Quick Start

### Option 1 — Provider (Recommended)

Wrap your root component (or any sensitive screen) with `<PrivacyGuardProvider>`. Every child gets access to the full API via `usePrivacyGuardContext()`.

```tsx
import { PrivacyGuardProvider } from 'react-native-privacy-guard-kit';

export default function App() {
  return (
    <PrivacyGuardProvider
      config={{
        disableScreenCapture: true,
        enableAppSwitcherProtection: true,
      }}
      onScreenshot={() => Alert.alert('Screenshot detected!')}
    >
      <YourApp />
    </PrivacyGuardProvider>
  );
}
```

Then inside any child component:

```tsx
import { usePrivacyGuardContext } from 'react-native-privacy-guard-kit';

function PaymentScreen() {
  const { isRecording, clearClipboard } = usePrivacyGuardContext();

  return (
    <View>
      {isRecording && <Text>Screen recording is active</Text>}
      <Button title="Clear clipboard" onPress={clearClipboard} />
    </View>
  );
}
```

---

### Option 2 — Hooks

```tsx
import {
  usePrivacyGuard,
  useScreenshotListener,
  useScreenRecording,
} from 'react-native-privacy-guard-kit';

function SecretScreen() {
  // All-in-one hook
  const { isRecording, disableScreenCapture, enableScreenCapture } = usePrivacyGuard({
    disableScreenCapture: true,
    enableAppSwitcherProtection: true,
  });

  // Standalone screenshot listener
  useScreenshotListener(() => {
    console.log('User took a screenshot!');
  });

  // Standalone recording state
  const isBeingRecorded = useScreenRecording();

  return <View />;
}
```

---

### Option 3 — Imperative API

Full async/await API for manual control:

```tsx
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
} from 'react-native-privacy-guard-kit';

// Disable capture on mount, re-enable on unmount
useEffect(() => {
  disableScreenCapture();
  return () => enableScreenCapture();
}, []);

// One-time check
const recording = await isScreenBeingRecorded(); // boolean

// Event listeners — each returns a cleanup function
const unsubscribe = onScreenshotTaken(() => {
  console.log('Screenshot taken!');
});

// later...
unsubscribe();
```

---

### Option 4 — SecureView (Copy/Paste Protection)

Drop-in replacement for `<View>` that disables text selection and copy/paste for all nested children, including `<Text>` and `<TextInput>`.

```tsx
import { SecureView } from 'react-native-privacy-guard-kit';

function SensitiveForm() {
  return (
    <SecureView disableCopyPaste>
      <Text>Your account number: 1234-5678-9012</Text>
      <TextInput
        value={secretToken}
        placeholder="Secret token (cannot be copied)"
      />
    </SecureView>
  );
}
```

---

## 📖 API Reference

### `<PrivacyGuardProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `config` | `PrivacyGuardKitConfig` | `{}` | Feature flags applied on mount |
| `onScreenshot` | `() => void` | — | Fired every time a screenshot is taken |
| `children` | `ReactNode` | — | Your app tree |

**`PrivacyGuardKitConfig`**

| Key | Type | Description |
|---|---|---|
| `disableScreenCapture` | `boolean` | Disable screenshots + recording blur on mount |
| `enableAppSwitcherProtection` | `boolean` | Show blank overlay in task switcher |
| `disableCopyPaste` | `boolean` | Used with `<SecureView>` |

---

### Hooks

#### `usePrivacyGuard(config?)`

All-in-one hook. Returns:

| Return value | Type | Description |
|---|---|---|
| `isScreenCaptureDisabled` | `boolean` | Current capture disabled state |
| `isRecording` | `boolean` | Whether screen is being recorded right now |
| `disableScreenCapture` | `() => Promise<void>` | Disable screenshots |
| `enableScreenCapture` | `() => Promise<void>` | Re-enable screenshots |
| `enableAppSwitcherProtection` | `() => Promise<void>` | Enable switcher overlay |
| `disableAppSwitcherProtection` | `() => Promise<void>` | Disable switcher overlay |
| `clearClipboard` | `() => Promise<void>` | Wipe clipboard contents |

#### `useScreenshotListener(callback)`

Subscribes to screenshot events. Automatically starts and stops the native observer.

#### `useScreenRecording()`

Returns a reactive `boolean` that is `true` whenever the screen is being recorded or mirrored.

#### `usePrivacyGuardContext()`

Must be used inside `<PrivacyGuardProvider>`. Returns the same shape as `usePrivacyGuard`.

---

### Imperative Functions

| Function | Returns | Description |
|---|---|---|
| `disableScreenCapture()` | `Promise<void>` | Block screenshots and recording preview |
| `enableScreenCapture()` | `Promise<void>` | Unblock screenshots |
| `isScreenCaptureDisabled()` | `Promise<boolean>` | Check current state |
| `isScreenBeingRecorded()` | `Promise<boolean>` | Check if recording is active |
| `enableAppSwitcherProtection()` | `Promise<void>` | Show blank overlay in task switcher |
| `disableAppSwitcherProtection()` | `Promise<void>` | Remove the overlay |
| `clearClipboard()` | `Promise<void>` | Wipe the system clipboard |
| `onScreenshotTaken(cb)` | `() => void` | Subscribe — returns unsubscribe fn |
| `onScreenRecordingStarted(cb)` | `() => void` | Subscribe — returns unsubscribe fn |
| `onScreenRecordingStopped(cb)` | `() => void` | Subscribe — returns unsubscribe fn |

---

### `<SecureView>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `disableCopyPaste` | `boolean` | `true` | Disables text selection and copy/paste for all children |
| `style` | `StyleProp<ViewStyle>` | — | Standard view styles |
| `children` | `ReactNode` | — | Any React Native content |

---

## How It Works

### Android
- Uses `WindowManager.LayoutParams.FLAG_SECURE` to block screenshots, screen recording previews, and app switcher thumbnails in a single flag.
- Screenshot detection is powered by a `ContentObserver` watching `MediaStore.Images.Media` for new entries in the `Screenshots` folder.
- Copy/paste is blocked at the `View` level by overriding `ActionMode.Callback` on all `TextView` and `EditText` descendants within `SecureView`.

### iOS
- Screenshot and screen recording blur is achieved by embedding a `UITextField` with `isSecureTextEntry = true` into the window — a well-known and App Store-compliant technique that causes iOS to automatically blur any captured content.
- App switcher protection uses `UIApplication.willResignActiveNotification` to place a full-screen blank overlay before the system grabs the snapshot.
- Screenshot detection uses `UIApplication.userDidTakeScreenshotNotification`.
- Screen recording detection uses `UIScreen.capturedDidChangeNotification` and `UIScreen.main.isCaptured`.
- Copy/paste is blocked at the `UIView` level by overriding `canPerformAction(_:withSender:)`.

---

## Google 16KB Page Size Compatible

Starting with **Android 15**, Google requires all apps and native libraries to support 16KB memory page alignment. `react-native-privacy-guard-kit` is fully compliant — no native `.so` files with non-standard alignment, no legacy memory assumptions. Your app stays on the Play Store without modification.

---

## New Architecture Support

This library is built with React Native's **New Architecture** in mind — compatible with the JSI bridge and Fabric renderer. If you have `newArchEnabled=true` in your project, everything works out of the box.

---

## Open Source Forever

This project is and will always remain **MIT licensed**. No paywalls, no premium tiers, no license keys. Privacy is a right, not a feature.

---

## Contributing

Contributions are what make the open source community such an amazing place. **Pull Requests are always welcome!**

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Found a bug or have a feature request? **[File an issue on GitHub](https://github.com/rushikeshpandit/react-native-privacy-guard-kit/issues)** — we respond fast.

---

## License

MIT © [Rushikesh Pandit](https://github.com/rushikeshpandit)

---

<p align="center">Made with ❤️ in India for the React Native community</p>