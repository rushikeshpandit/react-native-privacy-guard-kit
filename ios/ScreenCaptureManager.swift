// ScreenCaptureManager.swift
//
// Manages the secure-overlay technique that prevents screen capture on iOS.
//
// ── HOW THE SECURE OVERLAY WORKS ─────────────────────────────────────────────
//   iOS does not expose a public API to block screenshots directly (unlike
//   Android's FLAG_SECURE). The accepted workaround is to embed a
//   UITextField with isSecureTextEntry = true inside a full-screen
//   container, then send that container to the back of the window hierarchy.
//
//   When the system's screen-capture pipeline renders a frame, UIKit
//   intentionally blacks out the content of any UITextField that has
//   isSecureTextEntry = true. Because the secure field fills the entire
//   window and sits behind all other content (sendSubviewToBack), the
//   composited output of every layer above it is replaced by black in
//   the captured image — even though the live screen looks completely
//   normal to the user.
//
// ── LAYOUT STRATEGY ───────────────────────────────────────────────────────────
//   Frame-based layout (NOT Auto Layout) is used intentionally.
//   Adding NSLayoutConstraint anchors directly to a UIWindow corrupts its
//   internal layout pass for the rootViewController — causing the RN root
//   view to shift or resize. Frame + autoresizingMask subviews are invisible
//   to Auto Layout and do not participate in the window's layout pass at all.
//
// ── SIMULATOR BEHAVIOUR ───────────────────────────────────────────────────────
//   Physical devices: system screenshot, QuickTime recording, ReplayKit → blacked out ✓
//   iOS Simulator: Simulator File > Screenshot and host-OS screenshots are NOT
//   blocked (the simulator captures the host GPU framebuffer, bypassing UIKit).
//   The overlay is still installed so isCaptureDisabled returns true consistently.
//
// ── iOS VERSION SUPPORT ───────────────────────────────────────────────────────
//   iOS 13+: UIWindowScene-based window lookup.
//   isSecureTextEntry trick has worked since iOS 7; no version gate needed.
//
// ── THREAD SAFETY ─────────────────────────────────────────────────────────────
//   All methods MUST be called from the main thread. Callers (PrivacyGuardKit)
//   dispatch to DispatchQueue.main before calling into this class.

import UIKit

/// Manages a full-screen secure overlay that blacks out screen captures.
final class ScreenCaptureManager {

    // MARK: - State

    /// Whether the secure overlay is currently installed.
    /// Updated only after the overlay is successfully added/removed.
    private(set) var isCaptureDisabled: Bool = false

    /// The full-screen container view that holds the secure UITextField.
    /// Non-nil only while capture protection is active.
    private var overlayContainer: UIView?

    // MARK: - Public API

    /// Installs the secure overlay into the key window.
    ///
    /// The overlay contains a full-screen UITextField with `isSecureTextEntry = true`,
    /// causing the system capture pipeline to render the composited window as black.
    ///
    /// Idempotent — safe to call multiple times (returns early if already installed).
    ///
    /// - Important: Must be called on the main thread.
    func enable() {
        guard overlayContainer == nil, let window = currentWindow() else { return }

        let secureField = UITextField()
        secureField.isSecureTextEntry = true
        secureField.frame = window.bounds
        secureField.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        secureField.backgroundColor = .clear
        secureField.borderStyle = .none
        secureField.isUserInteractionEnabled = false

        // Use frame + autoresizingMask ONLY — no Auto Layout constraints on UIWindow.
        // translatesAutoresizingMaskIntoConstraints must remain true (the default).
        let container = UIView(frame: window.bounds)
        container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.isUserInteractionEnabled = false
        container.backgroundColor = .clear
        container.addSubview(secureField)

        window.addSubview(container)
        window.sendSubviewToBack(container)

        overlayContainer = container
        isCaptureDisabled = true
    }

    /// Removes the secure overlay from the window, re-enabling screen capture.
    ///
    /// Idempotent — safe to call when no overlay is installed.
    ///
    /// - Important: Must be called on the main thread.
    func disable() {
        overlayContainer?.removeFromSuperview()
        overlayContainer = nil
        isCaptureDisabled = false
    }

    // MARK: - Window Resolution

    /// Returns the application's current key window using the iOS 13+ scene API.
    ///
    /// Iterates connected UIWindowScenes to find the key window. Falls back to
    /// the first available window if none is key (handles startup edge cases).
    ///
    /// - Returns: The key UIWindow, or nil if none is available yet.
    func currentWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
            ?? UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first
    }
}
