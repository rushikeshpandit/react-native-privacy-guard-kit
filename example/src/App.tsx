import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  PrivacyGuardProvider,
  SecureView,
  isScreenBeingRecorded,
  isScreenCaptureDisabled,
  usePrivacyGuardContext,
  useScreenRecording,
  useScreenshotListener,
} from 'react-native-privacy-guard-kit';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────
// Colour tokens
// ─────────────────────────────────────────────────────────────

const C = {
  bg: '#0F1117',
  surface: '#1A1D27',
  surfaceHigh: '#22263A',
  border: '#2E3250',
  primary: '#6C63FF',
  primaryDark: '#4B44CC',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  textPrimary: '#F1F1F5',
  textSecondary: '#8B8FA8',
  white: '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────
// Small reusable components
// ─────────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Badge({ active, label }: { active: boolean; label: string }) {
  return (
    <View
      style={[styles.badge, { backgroundColor: active ? C.success : C.danger }]}
    >
      <Text style={styles.badgeText}>
        {active ? '● ' : '○ '}
        {label}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = 'primary',
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'success' | 'ghost';
  fullWidth?: boolean;
}) {
  const bg = {
    primary: C.primary,
    danger: C.danger,
    success: C.success,
    ghost: 'transparent',
  }[variant];

  const borderColor = variant === 'ghost' ? C.border : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor, borderWidth: 1 },
        fullWidth && { width: '100%' },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'ghost' && { color: C.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LogEntry({ message, time }: { message: string; time: string }) {
  return (
    <View style={styles.logEntry}>
      <Text style={styles.logTime}>{time}</Text>
      <Text style={styles.logMessage}>{message}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Main demo screen — consumes the Provider context
// ─────────────────────────────────────────────────────────────

type LogItem = { message: string; time: string };

function DemoScreen() {
  // ── Context (from PrivacyGuardProvider) ───────────────────
  const {
    isScreenCaptureDisabled: captureDisabled,
    disableScreenCapture,
    enableScreenCapture,
    enableAppSwitcherProtection,
    disableAppSwitcherProtection,
    clearClipboard: clearClip,
  } = usePrivacyGuardContext();

  // ── Standalone hooks ──────────────────────────────────────
  const isRecording = useScreenRecording();

  // ── Local state ───────────────────────────────────────────
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [appSwitcherOn, setAppSwitcherOn] = useState(false);
  const [copyPasteDisabled, setCopyPasteDisabled] = useState(true);
  const [secretText] = useState('4111 1111 1111 1111');

  // ── Helpers ───────────────────────────────────────────────
  const addLog = useCallback((message: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs((prev) => [{ message, time }, ...prev].slice(0, 20));
  }, []);

  // ── Screenshot listener (standalone hook) ─────────────────
  useScreenshotListener(
    useCallback(() => {
      addLog('Screenshot detected via useScreenshotListener!');
      Alert.alert(
        'Screenshot Detected',
        'Sensitive content may have been captured.',
        [{ text: 'OK' }]
      );
    }, [addLog])
  );

  // ── Handlers ──────────────────────────────────────────────

  async function handleToggleCapture() {
    if (captureDisabled) {
      await enableScreenCapture();
      addLog('Screen capture ENABLED');
    } else {
      await disableScreenCapture();
      addLog('Screen capture DISABLED');
    }
  }

  async function handleToggleAppSwitcher() {
    if (appSwitcherOn) {
      await disableAppSwitcherProtection();
      setAppSwitcherOn(false);
      addLog('App switcher protection DISABLED');
    } else {
      await enableAppSwitcherProtection();
      setAppSwitcherOn(true);
      addLog('App switcher protection ENABLED — go to home & check switcher!');
    }
  }

  async function handleClearClipboard() {
    await clearClip();
    addLog('Clipboard cleared');
    Alert.alert('Done', 'Clipboard has been wiped.');
  }

  async function handleCheckCaptureState() {
    const disabled = await isScreenCaptureDisabled();
    addLog(`isScreenCaptureDisabled() → ${disabled}`);
  }

  async function handleCheckRecordingState() {
    const recording = await isScreenBeingRecorded();
    addLog(`isScreenBeingRecorded() → ${recording}`);
  }

  function handleToggleCopyPaste() {
    const next = !copyPasteDisabled;
    setCopyPasteDisabled(next);
    addLog(`Copy/paste inside SecureView → ${next ? 'DISABLED' : 'ENABLED'}`);
  }

  function handleClearLogs() {
    setLogs([]);
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PrivacyGuardKit</Text>
        <Text style={styles.headerSub}>Full Feature Demo</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Live Status ── */}
        <SectionTitle title="Live Status" />
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Badge active={captureDisabled} label="Capture Blocked" />
            <Badge active={appSwitcherOn} label="Switcher Guard" />
            <Badge active={isRecording} label="Recording" />
          </View>
          {isRecording && (
            <View style={styles.recordingBanner}>
              <Text style={styles.recordingBannerText}>
                Screen recording is active — sensitive content may be visible to
                the recorder.
              </Text>
            </View>
          )}
        </View>

        {/* ── Screen Capture ── */}
        <SectionTitle title="1 · Screen Capture" />
        <View style={styles.card}>
          <Text style={styles.cardDescription}>
            Uses <Text style={styles.mono}>FLAG_SECURE</Text> on Android and a{' '}
            <Text style={styles.mono}>UITextField.isSecureTextEntry</Text>{' '}
            overlay on iOS to prevent screenshots and blur screen-recording
            output.
          </Text>
          <View style={styles.buttonRow}>
            <ActionButton
              label={captureDisabled ? 'Enable Capture' : 'Disable Capture'}
              onPress={handleToggleCapture}
              variant={captureDisabled ? 'danger' : 'primary'}
            />
            <ActionButton
              label="Check State"
              onPress={handleCheckCaptureState}
              variant="ghost"
            />
          </View>
        </View>

        {/* ── Screen Recording ── */}
        <SectionTitle title="2 · Screen Recording Detection" />
        <View style={styles.card}>
          <Text style={styles.cardDescription}>
            Reactively detects screen recording via{' '}
            <Text style={styles.mono}>useScreenRecording()</Text> hook. Also
            exposes an imperative check via{' '}
            <Text style={styles.mono}>isScreenBeingRecorded()</Text>.
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isRecording ? C.danger : C.success },
              ]}
            />
            <Text style={styles.statusLabel}>
              {isRecording ? 'Recording in progress' : 'Not being recorded'}
            </Text>
          </View>
          <ActionButton
            label="Check Recording (imperative)"
            onPress={handleCheckRecordingState}
            variant="ghost"
            fullWidth
          />
        </View>

        {/* ── App Switcher ── */}
        <SectionTitle title="3 · App Switcher Protection" />
        <View style={styles.card}>
          <Text style={styles.cardDescription}>
            Covers the app thumbnail in the OS task switcher with a blank
            overlay. Enable it, then press your device's Home/Recents button to
            verify.
          </Text>
          <ActionButton
            label={
              appSwitcherOn
                ? 'Disable App Switcher Guard'
                : 'Enable App Switcher Guard'
            }
            onPress={handleToggleAppSwitcher}
            variant={appSwitcherOn ? 'danger' : 'success'}
            fullWidth
          />
        </View>

        {/* ── Screenshot Listener ── */}
        <SectionTitle title="4 · Screenshot Event Listener" />
        <View style={styles.card}>
          <Text style={styles.cardDescription}>
            <Text style={styles.mono}>useScreenshotListener(callback)</Text> is
            active on this screen. Take a screenshot now — you'll get an alert
            and a log entry below.{'\n'}
            On Android this uses a{' '}
            <Text style={styles.mono}>ContentObserver</Text> watching
            MediaStore. On iOS it uses{' '}
            <Text style={styles.mono}>
              UIApplication.userDidTakeScreenshotNotification
            </Text>
            .
          </Text>
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              📸 Take a screenshot to test this feature
            </Text>
          </View>
        </View>

        {/* ── SecureView ── */}
        <SectionTitle title="5 · SecureView — Copy/Paste Protection" />
        <View style={styles.card}>
          <Text style={styles.cardDescription}>
            All children inside{' '}
            <Text style={styles.mono}>{'<SecureView>'}</Text> have text
            selection and copy/paste disabled at the native level. Long-press
            the card number below to verify.
          </Text>

          <SecureView
            disableCopyPaste={copyPasteDisabled}
            style={styles.secureViewContainer}
          >
            <View style={styles.creditCard}>
              <Text style={styles.creditCardLabel}>CARD NUMBER</Text>
              <Text style={styles.creditCardNumber}>{secretText}</Text>
              <View style={styles.creditCardRow}>
                <View>
                  <Text style={styles.creditCardLabel}>HOLDER</Text>
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

            <TextInput
              style={styles.secureInput}
              value="Secret API Key: sk-1234567890abcdef"
              editable={false}
              selectTextOnFocus={false}
              placeholder="Protected input"
              placeholderTextColor={C.textSecondary}
            />
          </SecureView>

          <ActionButton
            label={
              copyPasteDisabled ? 'Enable Copy/Paste' : 'Disable Copy/Paste'
            }
            onPress={handleToggleCopyPaste}
            variant={copyPasteDisabled ? 'success' : 'danger'}
            fullWidth
          />
        </View>

        {/* ── Clipboard ── */}
        <SectionTitle title="6 · Clipboard Protection" />
        <View style={styles.card}>
          <Text style={styles.cardDescription}>
            Call <Text style={styles.mono}>clearClipboard()</Text> to wipe
            sensitive data that may have been copied earlier in the session.
          </Text>
          <ActionButton
            label="Clear Clipboard Now"
            onPress={handleClearClipboard}
            variant="danger"
            fullWidth
          />
        </View>

        {/* ── Event Log ── */}
        <SectionTitle title="Event Log" />
        <View style={[styles.card, styles.logCard]}>
          <View style={styles.logHeader}>
            <Text style={styles.logHeaderText}>Recent Events</Text>
            <TouchableOpacity onPress={handleClearLogs}>
              <Text style={styles.logClearText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {logs.length === 0 ? (
            <Text style={styles.logEmpty}>
              No events yet. Interact with the features above.
            </Text>
          ) : (
            logs.map((log, i) => (
              <LogEntry key={i} message={log.message} time={log.time} />
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            react-native-privacy-guard-kit · MIT · Open Source Forever
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Root — wraps DemoScreen with the Provider
// ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <PrivacyGuardProvider
      config={{
        // We start with capture enabled so the user can toggle it manually
        disableScreenCapture: false,
        enableAppSwitcherProtection: false,
      }}
      onScreenshot={() => {
        // onScreenshot from Provider fires too — both Provider & hook work together
      }}
    >
      <DemoScreen />
    </PrivacyGuardProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },

  // Section titles
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitleBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.primary,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  cardDescription: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 20,
  },

  // Badges
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.3,
  },

  // Recording banner
  recordingBanner: {
    backgroundColor: '#3B0000',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: C.danger,
  },
  recordingBannerText: {
    fontSize: 12,
    color: '#FCA5A5',
    lineHeight: 18,
  },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: '500',
  },

  // Hint box
  hintBox: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: C.warning,
    fontWeight: '500',
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.2,
  },

  // SecureView demo
  secureViewContainer: {
    flex: undefined,
    gap: 10,
  },
  creditCard: {
    backgroundColor: C.primaryDark,
    borderRadius: 12,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: C.primary,
  },
  creditCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  creditCardNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  creditCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  creditCardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.white,
    marginTop: 2,
  },
  secureInput: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 8,
    padding: 12,
    color: C.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: C.border,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Mono text
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: C.primary,
    backgroundColor: C.surfaceHigh,
  },

  // Log
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
  },
  logClearText: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '600',
  },
  logEmpty: {
    textAlign: 'center',
    color: C.textSecondary,
    fontSize: 13,
    padding: 20,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logTime: {
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
    minWidth: 54,
  },
  logMessage: {
    fontSize: 12,
    color: C.textPrimary,
    flex: 1,
    lineHeight: 18,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 11,
    color: C.textSecondary,
  },
});
