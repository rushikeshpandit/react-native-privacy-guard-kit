// ScreenshotDetectionManager.swift
//
// Detects screenshots and screen-recording state changes on iOS.
//
// ── SCREENSHOT DETECTION ──────────────────────────────────────────────────────
//   iOS posts UIApplication.userDidTakeScreenshotNotification after the user
//   takes a screenshot. Cannot be used to prevent screenshots — only to react.
//
// ── SCREEN RECORDING DETECTION ────────────────────────────────────────────────
//   UIScreen.main.isCaptured (iOS 11+) returns true when:
//     • ReplayKit is recording
//     • AirPlay mirroring is active
//     • A wired/wireless mirror is connected (QuickTime, Xcode)
//   UIScreen.capturedDidChangeNotification fires when isCaptured changes.
//
// ── SIMULATOR BEHAVIOUR ───────────────────────────────────────────────────────
//   Screenshots: userDidTakeScreenshotNotification does NOT fire on the simulator.
//   Screen recording: isCaptured always returns false on the simulator.
//   Both are documented OS-level limitations — expected behaviour.
//
// ── iOS VERSION SUPPORT ───────────────────────────────────────────────────────
//   iOS 13+ minimum. isCaptured and capturedDidChangeNotification require iOS 11+
//   (always satisfied on iOS 13+). No @available guards needed.
//
// ── THREAD SAFETY ─────────────────────────────────────────────────────────────
//   NotificationCenter callbacks are delivered on the main thread when registered
//   without an explicit OperationQueue (the default). All UIScreen access
//   is on the main thread via these callbacks.

import UIKit

/// Callback signature for screenshot and recording events.
typealias ScreenEventCallback = (_ eventName: String, _ body: [String: Any]?) -> Void

/// Detects screenshots and screen-recording state changes, forwarding events
/// to the React Native bridge via a callback closure.
final class ScreenshotDetectionManager {

    // MARK: - Event Name Constants

    /// Emitted when the user takes a screenshot.
    static let screenshotTakenEvent  = "onScreenshotTaken"

    /// Emitted when screen recording / mirroring starts.
    static let recordingStartedEvent = "onScreenRecordingStarted"

    /// Emitted when screen recording / mirroring stops.
    static let recordingStoppedEvent = "onScreenRecordingStopped"

    // MARK: - State

    /// Whether the screenshot/recording listeners are currently active.
    private(set) var isListening: Bool = false

    /// Closure invoked with (eventName, body) when an event is detected.
    private let onEvent: ScreenEventCallback

    // MARK: - Init

    /// - Parameter onEvent: Called whenever a screenshot or recording change is detected.
    init(onEvent: @escaping ScreenEventCallback) {
        self.onEvent = onEvent
    }

    // MARK: - Public API

    /// Registers observers for screenshot and screen-recording change events.
    ///
    /// Events emitted after calling this:
    ///   • `onScreenshotTaken`        — when the user takes a screenshot.
    ///   • `onScreenRecordingStarted` — when recording/mirroring begins.
    ///   • `onScreenRecordingStopped` — when recording/mirroring ends.
    ///
    /// If recording is already active when this is called, emits
    /// `onScreenRecordingStarted` immediately so JS state is accurate from the start.
    ///
    /// Idempotent — existing observers are removed before re-registering.
    ///
    /// - Note: On the iOS Simulator, screenshot events never fire and
    ///   `isCaptured` is always false. Expected OS-level behaviour.
    ///
    /// - Important: Must be called on the main thread.
    func startListening() {
        stopListening()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleScreenshot),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRecordingChange),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )

        isListening = true

        // Sync initial recording state. capturedDidChangeNotification only
        // fires on transitions — if recording was already active before we
        // registered, JS would never know until the next state change.
        if currentScreen()?.isCaptured == true {
            onEvent(ScreenshotDetectionManager.recordingStartedEvent, ["isRecording": true])
        }
    }

    /// Removes all screenshot and screen-recording observers.
    ///
    /// Idempotent — safe to call when not listening.
    ///
    /// - Important: Must be called on the main thread.
    func stopListening() {
        NotificationCenter.default.removeObserver(
            self, name: UIApplication.userDidTakeScreenshotNotification, object: nil)
        NotificationCenter.default.removeObserver(
            self, name: UIScreen.capturedDidChangeNotification, object: nil)
        isListening = false
    }

    // MARK: - Current Recording State

    /// Returns whether the screen is currently being recorded or mirrored.
    ///
    /// Uses the scene-based screen lookup (iOS 13+) with UIScreen.main fallback.
    /// Always returns `false` on the iOS Simulator.
    ///
    /// - Important: Must be called on the main thread.
    func isScreenBeingRecorded() -> Bool {
        return currentScreen()?.isCaptured ?? false
    }

    // MARK: - Notification Handlers

    /// Fired by the OS after the user takes a screenshot.
    @objc private func handleScreenshot() {
        onEvent(ScreenshotDetectionManager.screenshotTakenEvent, nil)
    }

    /// Fired by the OS when UIScreen.isCaptured changes.
    @objc private func handleRecordingChange() {
        let isRecording = currentScreen()?.isCaptured ?? false
        let eventName = isRecording
            ? ScreenshotDetectionManager.recordingStartedEvent
            : ScreenshotDetectionManager.recordingStoppedEvent
        onEvent(eventName, ["isRecording": isRecording])
    }

    // MARK: - Screen Resolution

    /// Returns the current UIScreen, preferring the scene-based API (iOS 16+ safe).
    ///
    /// UIScreen.main is deprecated in iOS 16+. We prefer to get the screen
    /// from the active UIWindowScene. Falls back to UIScreen.main on iOS 13–15
    /// where the scene API may not always yield a screen.
    ///
    /// - Returns: The active UIScreen, or nil if none is available.
    private func currentScreen() -> UIScreen? {
        // Prefer scene-based lookup to avoid UIScreen.main deprecation warning.
        if let screen = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive })?
            .screen {
            return screen
        }
        // Fallback: UIScreen.main (deprecated iOS 16+, but still functional)
        return UIScreen.main
    }

    // MARK: - Cleanup

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
