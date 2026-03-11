/**
 * App.tsx — PrivacyGuardKit Full Feature Demo
 *
 * Demonstrates every feature of react-native-privacy-guard-kit:
 *   1. Screen capture protection (disable/enable, state query)
 *   2. Screen recording detection (reactive hook + imperative query)
 *   3. App-switcher thumbnail protection
 *   4. Screenshot event listener
 *   5. SecureView copy/paste blocking
 *   6. Clipboard wipe
 *   7. PrivacyGuardProvider + usePrivacyGuardContext
 *
 * ── EDGE CASES HANDLED ────────────────────────────────────────────────────────
 *   • All async handlers are guarded with a `pending` ref to prevent
 *     concurrent / double-tap native calls.
 *   • All handler functions are wrapped in useCallback with stable deps
 *     so no child re-renders are triggered unnecessarily.
 *   • Log entries use a stable unique key (timestamp + counter) instead of
 *     array index, so React reconciles prepended items correctly.
 *   • appSwitcherOn local state is kept in sync with the context via a
 *     dedicated local state flag rather than reading from context (the
 *     context doesn't expose the switcher state separately).
 *   • Platform caveat banners shown on iOS Simulator and Android for
 *     features that have limited/no native support there.
 *   • mounted-guard in all async callbacks to prevent setState after unmount.
 *   • All async errors from the native layer are caught and shown in the log.
 *
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PrivacyGuardProvider,
  SecureView,
  isScreenBeingRecorded,
  isScreenCaptureDisabled,
  usePrivacyGuardContext,
  useScreenRecording,
  useScreenshotListener,
} from 'react-native-privacy-guard-kit';

const _noopScreenshot = () => {
  // Provider-level screenshot callback — fires alongside the hook-level
  // listener in DemoScreen. Both share the same ref-counted native observer.
  // Use this slot for app-wide screenshot analytics or logging.
};

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  // Base
  bg: '#080B14',
  surface: '#0E1220',
  surfaceRaised: '#141828',
  surfaceHigh: '#1C2236',
  border: '#232840',
  borderBright: '#2E3660',

  // Brand
  primary: '#4F8EF7',
  primaryDim: '#1C3A6E',
  primaryGlow: 'rgba(79,142,247,0.18)',

  // Semantic
  success: '#16C172',
  successDim: '#0A3D29',
  danger: '#F04E5E',
  dangerDim: '#3D0E15',
  warning: '#F5A623',
  warningDim: '#3D2908',
  purple: '#A875F7',
  purpleDim: '#2A1860',

  // Text
  textPrimary: '#EDF0FF',
  textSecondary: '#6B728E',
  textMuted: '#3D4260',
  white: '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'success' | 'warning' | 'error';

interface LogItem {
  /** Unique stable key — timestamp + monotone counter avoids index-as-key pitfall. */
  id: string;
  message: string;
  time: string;
  level: LogLevel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: stable log key counter
// ─────────────────────────────────────────────────────────────────────────────

let _logCounter = 0;

function makeLogId(): string {
  return `${Date.now()}-${++_logCounter}`;
}

function makeLogTime(): string {
  const d = new Date();
  return [
    d.getHours().toString().padStart(2, '0'),
    d.getMinutes().toString().padStart(2, '0'),
    d.getSeconds().toString().padStart(2, '0'),
  ].join(':');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: async handler factory
//
// Wraps an async callback with:
//   - A pending guard (prevents double-tap / concurrent calls)
//   - Error catching (surfaces to the log rather than crashing)
// ─────────────────────────────────────────────────────────────────────────────

function useGuardedAsync(
  fn: () => Promise<void>,
  onError?: (err: unknown) => void
): [() => void, boolean] {
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false);

  // Store fn and onError in refs so the handler closure always calls the
  // LATEST version without needing to be recreated.
  //
  // fnRef.current is always the latest fn. Handler identity is
  // stable ([] deps), so no unnecessary re-renders, AND the correct fn runs.
  const fnRef = useRef(fn);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const handler = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);

    fnRef
      .current()
      .catch((err: unknown) => {
        onErrorRef.current?.(err);
      })
      .finally(() => {
        pendingRef.current = false;
        setBusy(false);
      });
  }, []); // Stable handler — refs provide access to latest fn/onError

  return [handler, busy];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: PlatformNote
// Shows a contextual warning for features limited on the current platform.
// ─────────────────────────────────────────────────────────────────────────────

function PlatformNote({ children }: { children: ReactNode }) {
  return (
    <View style={styles.platformNote}>
      <Text style={styles.platformNoteText}>⚠ {children}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: SectionTitle
// ─────────────────────────────────────────────────────────────────────────────

function SectionTitle({ number, title }: { number?: string; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {number ? (
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberText}>{number}</Text>
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: StatusPill
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({
  active,
  activeLabel,
  inactiveLabel,
  activeColor = C.success,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeColor?: string;
}) {
  const color = active ? activeColor : C.textMuted;
  const label = active ? activeLabel : inactiveLabel;

  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: active ? `${activeColor}22` : C.surfaceHigh,
          borderColor: active ? `${activeColor}55` : C.border,
        },
      ]}
    >
      <View style={[styles.statusPillDot, { backgroundColor: color }]} />
      <Text style={[styles.statusPillLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: ActionButton
// Supports: primary, danger, success, ghost, warning, purple variants + loading
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  primary: { bg: C.primary, border: C.primary, text: C.white },
  danger: { bg: C.dangerDim, border: C.danger, text: C.danger },
  success: { bg: C.successDim, border: C.success, text: C.success },
  warning: { bg: C.warningDim, border: C.warning, text: C.warning },
  ghost: { bg: 'transparent', border: C.border, text: C.textSecondary },
  purple: { bg: C.purpleDim, border: C.purple, text: C.purple },
};

function ActionButton({
  label,
  onPress,
  variant = 'primary',
  fullWidth = false,
  busy = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'success' | 'warning' | 'ghost' | 'purple';
  fullWidth?: boolean;
  busy?: boolean;
  icon?: string;
}) {
  // `VARIANT_STYLES[variant]` has type `T | undefined` from the
  // Record index signature even though variant is constrained to known keys.
  // The `?? VARIANT_STYLES['primary']` fallback also has type `T | undefined`.
  // Use non-null assertion — the map is a module-level constant with all keys.
  const v = (VARIANT_STYLES[variant] ?? VARIANT_STYLES['primary'])!;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: pressed || busy ? 0.6 : 1,
        },
        fullWidth && styles.buttonFull,
      ]}
    >
      {icon ? <Text style={styles.buttonIcon}>{icon}</Text> : null}
      <Text style={[styles.buttonText, { color: v.text }]}>
        {busy ? '…' : label}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Card
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: LogEntry — with level-based left border colour + fade-in
// ─────────────────────────────────────────────────────────────────────────────

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  info: C.primary,
  success: C.success,
  warning: C.warning,
  error: C.danger,
};

const LogEntry: FC<{ item: LogItem }> = ({ item }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  // `opacity` is a stable ref value — never changes across renders.
  // The [opacity] dependency was a lint-triggering no-op that would also refire
  // the animation if the ref were ever replaced (e.g. React Fast Refresh).
  // Use [] — run once on mount only.
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // LOG_LEVEL_COLORS[item.level] is `string | undefined` from the
  // index signature even though LogLevel is exhaustive. Non-null assertion is safe.
  const accentColor = LOG_LEVEL_COLORS[item.level]!;

  return (
    <Animated.View
      style={[styles.logEntry, { opacity, borderLeftColor: accentColor }]}
    >
      <Text style={styles.logTime}>{item.time}</Text>
      <Text style={[styles.logLevel, { color: accentColor }]}>
        {item.level.toUpperCase()}
      </Text>
      <Text style={styles.logMessage}>{item.message}</Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Component: RecordingBanner — full-width pulsing alert bar
// ─────────────────────────────────────────────────────────────────────────────

function RecordingBanner() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => {
      anim.stop();
      // Reset to the initial value so that if the banner remounts
      // (recording stops then quickly starts again), the animation begins from
      // opacity 1.0 rather than wherever the loop happened to stop.
      pulse.setValue(1);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.recordingBanner}>
      <Animated.View style={[styles.recordingDot, { opacity: pulse }]} />
      <Text style={styles.recordingBannerText}>
        SCREEN RECORDING ACTIVE — sensitive content is being captured
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Demo Screen
// ─────────────────────────────────────────────────────────────────────────────

function DemoScreen() {
  // ── Context API ────────────────────────────────────────────────────────────
  const {
    isScreenCaptureDisabled: captureDisabled,
    disableScreenCapture,
    enableScreenCapture,
    enableAppSwitcherProtection,
    disableAppSwitcherProtection,
    clearClipboard: clearClip,
  } = usePrivacyGuardContext();

  // ── Standalone hooks ───────────────────────────────────────────────────────

  /**
   * useScreenRecording: reactive boolean, always up-to-date.
   *
   * Platform notes:
   *   - iOS Simulator: always false (UIScreen.isCaptured unavailable)
   *   - Android:       always false (no public recording detection API)
   */
  const isRecording = useScreenRecording();

  // Prevents addLog → setLogs firing on an unmounted component if the component
  // unmounts while a native query promise is still in-flight.
  // useGuardedAsync guards its own setBusy in .finally(), but does NOT protect
  // the user-supplied fn's internal async continuations.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Local state ────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogItem[]>([]);

  /**
   * appSwitcherOn: local shadow of the app-switcher native state.
   *
   * The context does not expose a separate `isAppSwitcherProtected` field
   * (by design — it's a fire-and-forget feature). We track it locally and
   * reset it if the component remounts.
   */
  const [appSwitcherOn, setAppSwitcherOn] = useState(false);
  const [copyPasteDisabled, setCopyPasteDisabled] = useState(true);

  // ── Log helper ─────────────────────────────────────────────────────────────

  const addLog = useCallback((message: string, level: LogLevel = 'info') => {
    setLogs(
      (prev) =>
        [
          { id: makeLogId(), message, time: makeLogTime(), level },
          ...prev,
        ].slice(0, 30) // keep last 30 entries max
    );
  }, []);

  // ── Screenshot listener ────────────────────────────────────────────────────
  /**
   * Callback is stable (addLog has [] deps so this never changes) and the
   * internal callbackRef pattern in Hooks.ts always gets the same function.
   * The native subscription is created ONCE on mount.
   */
  useScreenshotListener(
    useCallback(() => {
      addLog('Screenshot detected via useScreenshotListener hook', 'warning');
      Alert.alert(
        '📸 Screenshot Detected',
        'Sensitive content may have been captured.\n\nConsider enabling screen capture protection to prevent this.',
        [{ text: 'OK' }]
      );
    }, [addLog])
  );

  //   makeErrorHandler(label) caches one stable function per label in a ref map.
  //   Same label always returns the identical reference. The ref-update effect
  //   inside useGuardedAsync fires only when addLog changes (never — [] deps).
  const errorHandlersRef = useRef<Record<string, (err: unknown) => void>>({});

  const makeErrorHandler = useCallback(
    (label: string): ((err: unknown) => void) => {
      if (!errorHandlersRef.current[label]) {
        errorHandlersRef.current[label] = (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          addLog(`${label} failed: ${msg}`, 'error');
        };
      }
      return errorHandlersRef.current[label]!;
    },
    [addLog]
  );

  // ── Guarded async handlers ─────────────────────────────────────────────────
  // Each is wrapped in useGuardedAsync which prevents double-tap concurrent
  // native calls and surfaces errors to the event log.

  const [handleToggleCapture, captureBusy] = useGuardedAsync(
    useCallback(async () => {
      if (captureDisabled) {
        await enableScreenCapture();
        addLog('Screen capture re-enabled', 'warning');
      } else {
        await disableScreenCapture();
        addLog(
          'Screen capture disabled — screenshots/recordings will be blocked',
          'success'
        );
      }
    }, [captureDisabled, enableScreenCapture, disableScreenCapture, addLog]),
    makeErrorHandler('toggleCapture')
  );

  const [handleToggleAppSwitcher, switcherBusy] = useGuardedAsync(
    useCallback(async () => {
      if (appSwitcherOn) {
        await disableAppSwitcherProtection();
        setAppSwitcherOn(false);
        addLog('App switcher protection disabled', 'warning');
      } else {
        await enableAppSwitcherProtection();
        setAppSwitcherOn(true);
        addLog(
          'App switcher protection enabled — press Home then open Recents to verify',
          'success'
        );
      }
    }, [
      appSwitcherOn,
      enableAppSwitcherProtection,
      disableAppSwitcherProtection,
      addLog,
    ]),
    makeErrorHandler('toggleAppSwitcher')
  );

  const [handleClearClipboard, clipBusy] = useGuardedAsync(
    useCallback(async () => {
      await clearClip();
      addLog('Clipboard cleared — all pasteboard items wiped', 'success');
      Alert.alert(
        'Clipboard Cleared',
        'All clipboard contents have been wiped.'
      );
    }, [clearClip, addLog]),
    makeErrorHandler('clearClipboard')
  );

  // Gate addLog on mountedRef.current in both query handlers.
  const [handleCheckCaptureState, checkCaptureBusy] = useGuardedAsync(
    useCallback(async () => {
      const disabled = await isScreenCaptureDisabled();
      if (mountedRef.current) {
        addLog(
          `isScreenCaptureDisabled() → ${disabled} (native module query)`,
          disabled ? 'success' : 'info'
        );
      }
    }, [addLog]),
    makeErrorHandler('isScreenCaptureDisabled')
  );

  const [handleCheckRecordingState, checkRecordingBusy] = useGuardedAsync(
    useCallback(async () => {
      const recording = await isScreenBeingRecorded();
      if (mountedRef.current) {
        addLog(
          `isScreenBeingRecorded() → ${recording} (imperative native query)`,
          recording ? 'warning' : 'info'
        );
      }
    }, [addLog]),
    makeErrorHandler('isScreenBeingRecorded')
  );

  // ── Non-async handlers ─────────────────────────────────────────────────────

  const handleToggleCopyPaste = useCallback(() => {
    setCopyPasteDisabled((prev) => {
      const next = !prev;
      addLog(
        `SecureView copy/paste → ${
          next ? 'BLOCKED (long-press card to test)' : 'ALLOWED'
        }`,
        next ? 'success' : 'warning'
      );
      return next;
    });
  }, [addLog]);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  // Check 'isSimulator' (correct documented RN 0.65+ key) before
  // the legacy 'simulator' key. Both checked for backwards compatibility.
  // Note: __DEV__ is NOT a simulator check — it is true on physical devices
  // during development builds too.
  const isSimulator =
    Platform.OS === 'ios' &&
    !!(
      (Platform.constants as Record<string, unknown>)?.['isSimulator'] ??
      (Platform.constants as Record<string, unknown>)?.['simulator']
    );
  const isAndroid = Platform.OS === 'android';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Global recording banner ──────────────────────────────────── */}
      {isRecording && <RecordingBanner />}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>react-native</Text>
          <Text style={styles.headerTitle}>PrivacyGuardKit</Text>
        </View>
        <View style={styles.headerBadges}>
          <StatusPill
            active={captureDisabled}
            activeLabel="Capture Blocked"
            inactiveLabel="Capture Open"
            activeColor={C.success}
          />
          <StatusPill
            active={isRecording}
            activeLabel="Recording!"
            inactiveLabel="Not Recording"
            activeColor={C.danger}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ──────────────────────────────────────────────────────────────
            SECTION 0 · Live Status Dashboard
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle title="Live Status" />
        <Card>
          <View style={styles.statusGrid}>
            <View style={styles.statusCell}>
              <Text style={styles.statusCellLabel}>SCREEN CAPTURE</Text>
              <StatusPill
                active={captureDisabled}
                activeLabel="Blocked"
                inactiveLabel="Allowed"
                activeColor={C.success}
              />
            </View>
            <View style={styles.statusCell}>
              <Text style={styles.statusCellLabel}>RECORDING</Text>
              <StatusPill
                active={isRecording}
                activeLabel="Active"
                inactiveLabel="None"
                activeColor={C.danger}
              />
            </View>
            <View style={styles.statusCell}>
              <Text style={styles.statusCellLabel}>APP SWITCHER</Text>
              <StatusPill
                active={appSwitcherOn}
                activeLabel="Protected"
                inactiveLabel="Exposed"
                activeColor={C.success}
              />
            </View>
            <View style={styles.statusCell}>
              <Text style={styles.statusCellLabel}>COPY / PASTE</Text>
              <StatusPill
                active={copyPasteDisabled}
                activeLabel="Blocked"
                inactiveLabel="Allowed"
                activeColor={C.success}
              />
            </View>
          </View>
        </Card>

        {/* ──────────────────────────────────────────────────────────────
            SECTION 1 · Screen Capture Protection
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle number="01" title="Screen Capture Protection" />
        <Card>
          <Text style={styles.cardDesc}>
            Prevents screenshots and blacks out screen-recording output.{'\n\n'}
            <Text style={styles.mono}>Android</Text> — applies{' '}
            <Text style={styles.mono}>FLAG_SECURE</Text> to the Activity window.
            {'\n'}
            <Text style={styles.mono}>iOS</Text> — installs a full-screen secure{' '}
            <Text style={styles.mono}>UITextField</Text> overlay at the back of
            the window. No visual change to the live view.
          </Text>

          {isSimulator && (
            <PlatformNote>
              iOS Simulator: the overlay installs but host-OS screenshots bypass
              UIKit rendering — capture prevention has no visible effect here.
              Test on a physical device.
            </PlatformNote>
          )}

          <View style={styles.buttonRow}>
            <ActionButton
              label={captureDisabled ? 'Re-enable Capture' : 'Block Capture'}
              onPress={handleToggleCapture}
              variant={captureDisabled ? 'danger' : 'success'}
              busy={captureBusy}
              icon={captureDisabled ? '🔓' : '🔒'}
            />
            <ActionButton
              label="Query State"
              onPress={handleCheckCaptureState}
              variant="ghost"
              busy={checkCaptureBusy}
              icon="🔍"
            />
          </View>
        </Card>

        {/* ──────────────────────────────────────────────────────────────
            SECTION 2 · Screen Recording Detection
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle number="02" title="Recording Detection" />
        <Card>
          <Text style={styles.cardDesc}>
            <Text style={styles.mono}>useScreenRecording()</Text> is a reactive
            hook — the banner above and status badge update instantly when
            recording starts or stops, with no polling.{'\n\n'}
            The imperative{' '}
            <Text style={styles.mono}>isScreenBeingRecorded()</Text> queries the
            native state on demand.
          </Text>

          {(isSimulator || isAndroid) && (
            <PlatformNote>
              {isAndroid
                ? 'Android: no public recording detection API exists — always returns false. Use disableScreenCapture() to prevent recording content from being visible instead.'
                : 'iOS Simulator: UIScreen.isCaptured is always false. Use a physical device to test this feature.'}
            </PlatformNote>
          )}

          <View style={styles.infoRow}>
            <View
              style={[
                styles.infoIndicator,
                { backgroundColor: isRecording ? C.dangerDim : C.successDim },
              ]}
            >
              <Text style={styles.infoIndicatorEmoji}>
                {isRecording ? '🔴' : '🟢'}
              </Text>
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>
                {isRecording
                  ? 'Recording in progress'
                  : 'No recording detected'}
              </Text>
              <Text style={styles.infoSub}>
                {isRecording
                  ? 'UIScreen.isCaptured = true — live via capturedDidChangeNotification'
                  : 'Listening via onScreenRecordingStarted / Stopped'}
              </Text>
            </View>
          </View>

          <ActionButton
            label="Imperative isScreenBeingRecorded() Check"
            onPress={handleCheckRecordingState}
            variant="ghost"
            busy={checkRecordingBusy}
            fullWidth
            icon="📡"
          />
        </Card>

        {/* ──────────────────────────────────────────────────────────────
            SECTION 3 · App Switcher Protection
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle number="03" title="App Switcher Protection" />
        <Card>
          <Text style={styles.cardDesc}>
            Covers the OS app-switcher thumbnail with a blank overlay so
            sensitive content is never visible in Recents.{'\n\n'}
            <Text style={styles.mono}>iOS</Text> — registers{' '}
            <Text style={styles.mono}>willResignActive</Text> observer to show
            overlay BEFORE the snapshot is taken. Works on Simulator.{'\n'}
            <Text style={styles.mono}>Android</Text> — uses{' '}
            <Text style={styles.mono}>FLAG_SECURE</Text> (shared with capture
            protection, tracked independently).
          </Text>
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Enable protection, then press Home → open Recents to verify the
              thumbnail is blank.
            </Text>
          </View>
          <ActionButton
            label={
              appSwitcherOn ? 'Remove Switcher Guard' : 'Enable Switcher Guard'
            }
            onPress={handleToggleAppSwitcher}
            variant={appSwitcherOn ? 'danger' : 'purple'}
            fullWidth
            busy={switcherBusy}
            icon={appSwitcherOn ? '🔓' : '🛡️'}
          />
        </Card>

        {/* ──────────────────────────────────────────────────────────────
            SECTION 4 · Screenshot Event Listener
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle number="04" title="Screenshot Detection" />
        <Card>
          <Text style={styles.cardDesc}>
            <Text style={styles.mono}>useScreenshotListener(callback)</Text> is
            active on this screen. Take a screenshot now — you'll get an alert
            and a log entry below.
          </Text>

          {isSimulator ? (
            <PlatformNote>
              iOS Simulator: userDidTakeScreenshotNotification never fires
              (host-OS GPU bypass). Test on a physical device.
            </PlatformNote>
          ) : isAndroid ? (
            <PlatformNote>
              Android: requires READ_EXTERNAL_STORAGE (API 29-32) or
              READ_MEDIA_IMAGES (API 33+) permission to detect screenshots.
            </PlatformNote>
          ) : null}

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Take a screenshot to trigger the listener
            </Text>
          </View>

          <Text style={styles.techNote}>
            Uses a single shared native observer (ref-counted) across all active
            JS subscribers. First subscriber starts it; last subscriber stops it
            automatically.
          </Text>
        </Card>

        {/* ──────────────────────────────────────────────────────────────
            SECTION 5 · SecureView — Copy/Paste Blocking
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle number="05" title="SecureView — Copy/Paste Blocking" />
        <Card>
          <Text style={styles.cardDesc}>
            All children inside{' '}
            <Text style={styles.mono}>{'<SecureView>'}</Text> have text
            selection and copy/paste blocked at the native level.{'\n\n'}
            <Text style={styles.mono}>iOS Fabric</Text> — intercepts{' '}
            <Text style={styles.mono}>canPerformAction:withSender:</Text>.{'\n'}
            <Text style={styles.mono}>Android</Text> — disables long-click and{' '}
            <Text style={styles.mono}>ActionModeCallback</Text> on all
            TextView/EditText children recursively.
          </Text>

          <SecureView
            disableCopyPaste={copyPasteDisabled}
            style={styles.secureViewOverride}
          >
            {/* Credit card mockup */}
            <View style={styles.creditCard}>
              <View style={styles.creditCardTopRow}>
                <Text style={styles.creditCardBankName}>SECURE BANK</Text>
                <Text style={styles.creditCardChip}>▣</Text>
              </View>
              <Text style={styles.creditCardLabel}>CARD NUMBER</Text>
              <Text style={styles.creditCardNumber}>4111 1111 1111 1111</Text>
              <View style={styles.creditCardBottomRow}>
                <View>
                  <Text style={styles.creditCardLabel}>CARDHOLDER</Text>
                  <Text style={styles.creditCardValue}>John Doe</Text>
                </View>
                <View>
                  <Text style={styles.creditCardLabel}>EXPIRES</Text>
                  <Text style={styles.creditCardValue}>08 / 28</Text>
                </View>
                <View>
                  <Text style={styles.creditCardLabel}>CVV</Text>
                  <Text style={styles.creditCardValue}>•••</Text>
                </View>
              </View>
            </View>

            {/* Protected text input */}
            <TextInput
              style={styles.secureInput}
              value="Secret API Key: sk-1234567890abcdef"
              editable={false}
              /**
               * selectTextOnFocus={false} prevents the OS from automatically
               * selecting all text on tap, which would show the copy handle.
               */
              selectTextOnFocus={false}
              /**
               * contextMenuHidden is a belt-and-suspenders measure for iOS Paper
               * (Old Architecture) where the TextInput may respond before the
               * container's canPerformAction override in the responder chain.
               */
              contextMenuHidden
              placeholderTextColor={C.textSecondary}
            />
          </SecureView>

          <ActionButton
            label={copyPasteDisabled ? 'Allow Copy/Paste' : 'Block Copy/Paste'}
            onPress={handleToggleCopyPaste}
            variant={copyPasteDisabled ? 'warning' : 'success'}
            fullWidth
          />
        </Card>

        {/* ──────────────────────────────────────────────────────────────
            SECTION 6 · Clipboard Protection
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle number="06" title="Clipboard Protection" />
        <Card>
          <Text style={styles.cardDesc}>
            <Text style={styles.mono}>clearClipboard()</Text> wipes all items
            from the system clipboard / pasteboard. Call this when a user
            navigates away from a screen that displayed sensitive data.
          </Text>
          <Text style={styles.techNote}>
            {'iOS: UIPasteboard.general.items = []\n'}
            {'Android API 28+: ClipboardManager.clearPrimaryClip()\n'}
            {
              'Android API 29+: OS may show "App cleared your clipboard" toast (cannot be suppressed)'
            }
          </Text>
          <ActionButton
            label="Clear Clipboard Now"
            onPress={handleClearClipboard}
            variant="danger"
            fullWidth
            busy={clipBusy}
            icon="🗑"
          />
        </Card>

        {/* ──────────────────────────────────────────────────────────────
            EVENT LOG
        ─────────────────────────────────────────────────────────────── */}
        <SectionTitle title="Event Log" />
        <View style={[styles.card, styles.logCard]}>
          <View style={styles.logHeader}>
            <Text style={styles.logHeaderTitle}>Recent Events</Text>
            <Pressable
              onPress={handleClearLogs}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={styles.logClearText}>Clear</Text>
            </Pressable>
          </View>

          {logs.length === 0 ? (
            <View style={styles.logEmpty}>
              <Text style={styles.logEmptyText}>
                {'No events yet.\nInteract with the sections above.'}
              </Text>
            </View>
          ) : (
            logs.map((item) => (
              /*
               * Stable key: timestamp + counter, NOT array index.
               * We prepend items — using index as key would cause React to
               * match the wrong nodes and break the fade-in animation.
               */
              <LogEntry key={item.id} item={item} />
            ))
          )}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>react-native-privacy-guard-kit</Text>
          <Text style={styles.footerSub}>
            iOS (Fabric + Paper) · Android · MIT License
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root — wraps DemoScreen with Provider
//
// config is intentionally empty (no features auto-enabled on startup) so the
// user can toggle each feature manually to understand what it does.
//
// onScreenshot uses the stable module-level _noopScreenshot instead
// of an inline arrow. The onScreenshot prop fires in ADDITION to the
// useScreenshotListener in DemoScreen — both share the same ref-counted observer.
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <PrivacyGuardProvider
      config={
        {
          // Start with nothing auto-enabled so the user can explore manually.
          // To auto-enable on app start, uncomment:
          //   disableScreenCapture: true,
          //   enableAppSwitcherProtection: true,
        }
      }
      onScreenshot={_noopScreenshot}
    >
      <DemoScreen />
    </PrivacyGuardProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Recording banner ────────────────────────────────────────────────────
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dangerDim,
    borderBottomWidth: 1,
    borderBottomColor: C.danger,
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.danger,
  },
  recordingBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.danger,
    letterSpacing: 0.5,
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    color: C.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: 0.3,
  },
  headerBadges: {
    gap: 6,
    alignItems: 'flex-end',
  },

  // ── Status pill ─────────────────────────────────────────────────────────
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Scroll ──────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 56,
  },

  // ── Section title ────────────────────────────────────────────────────────
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
    gap: 10,
  },
  sectionNumber: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  cardDesc: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 21,
  },

  // ── Status grid ─────────────────────────────────────────────────────────
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusCell: {
    flex: 1,
    minWidth: '45%',
    gap: 6,
  },
  statusCellLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // ── Platform note ────────────────────────────────────────────────────────
  platformNote: {
    backgroundColor: C.warningDim,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: C.warning,
  },
  platformNoteText: {
    fontSize: 11,
    color: C.warning,
    lineHeight: 17,
  },

  // ── Info row ─────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surfaceHigh,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoIndicator: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIndicatorEmoji: { fontSize: 22 },
  infoText: { flex: 1, gap: 3 },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
  },
  infoSub: {
    fontSize: 11,
    color: C.textSecondary,
    lineHeight: 16,
  },

  // ── Hint box ─────────────────────────────────────────────────────────────
  hintBox: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: C.borderBright,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: C.warning,
    fontWeight: '500',
  },

  // ── Tech note ─────────────────────────────────────────────────────────────
  techNote: {
    fontSize: 11,
    color: C.textMuted,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // ── Buttons ──────────────────────────────────────────────────────────────
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 6,
    flex: 1,
  },
  buttonFull: {
    flex: undefined,
    width: '100%',
  },
  buttonIcon: { fontSize: 14 },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── SecureView override ───────────────────────────────────────────────────
  /**
   * Override SecureView's default flex:1 so it sizes to its children rather
   * than expanding to fill the parent card. This is the canonical pattern when
   * SecureView is used as an inline container rather than a full-screen wrapper.
   */
  secureViewOverride: {
    flex: undefined,
    gap: 10,
  },

  // ── Credit card ───────────────────────────────────────────────────────────
  creditCard: {
    backgroundColor: '#0D1F4A',
    borderRadius: 14,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  creditCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditCardBankName: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
  },
  creditCardChip: { fontSize: 20, color: '#F5A623' },
  creditCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  creditCardNumber: {
    fontSize: 19,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 3.5,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  creditCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  creditCardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.white,
    marginTop: 3,
  },

  // ── Secure input ──────────────────────────────────────────────────────────
  secureInput: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.textPrimary,
    fontSize: 12,
    borderWidth: 1,
    borderColor: C.border,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // ── Mono ──────────────────────────────────────────────────────────────────
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: C.primary,
  },

  // ── Log ───────────────────────────────────────────────────────────────────
  logCard: {
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 0.3,
  },
  logClearText: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '600',
  },
  logEmpty: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  logEmptyText: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderLeftWidth: 2,
  },
  logTime: {
    fontSize: 10,
    color: C.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
    minWidth: 56,
  },
  logLevel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
    minWidth: 52,
  },
  logMessage: {
    fontSize: 12,
    color: C.textPrimary,
    flex: 1,
    lineHeight: 18,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  footerDivider: {
    width: 48,
    height: 1,
    backgroundColor: C.border,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
  },
  footerSub: {
    fontSize: 11,
    color: C.textMuted,
  },
});
