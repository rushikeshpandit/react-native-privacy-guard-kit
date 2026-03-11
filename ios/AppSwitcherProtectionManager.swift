// AppSwitcherProtectionManager.swift
//
// Manages a privacy overlay that hides app content in the iOS app-switcher
// (multitasking / recent apps view).
//
// ── HOW IT WORKS ──────────────────────────────────────────────────────────────
//   iOS captures a snapshot just before the app transitions to the background.
//   We observe willResignActive (NOT didEnterBackground — that fires too late,
//   after the snapshot is already taken) and place a full-screen overlay on
//   the window. When the app returns to the foreground (didBecomeActive), we
//   remove the overlay so normal content is visible again.
//
// ── WINDOW ACCESS STRATEGY ────────────────────────────────────────────────────
//   AppSwitcherProtectionManager now resolves the key window directly via
//   ScreenCaptureManager.currentWindow() at the moment willResignActive fires,
//   rather than capturing the window at enable() time. This correctly handles:
//     • Apps that create their window after enable() is called.
//     • Scene lifecycle events that swap the key window.
//     • Multiple UIWindowScene configurations.
//
// ── OVERLAY SIZING FIX ────────────────────────────────────────────────────────
//   The overlay now uses UIScreen.main.bounds instead of window.bounds at
//   insertion time. During willResignActive the window may not yet have its
//   final post-rotation bounds. UIScreen.main.bounds reflects the current
//   physical screen size in all orientations, giving correct full coverage.
//   autoresizingMask handles any resize that occurs while in the background.
//
// ── SIMULATOR BEHAVIOUR ───────────────────────────────────────────────────────
//   Works on the iOS Simulator. The overlay is visible as the app-switcher
//   thumbnail when you press Home / swipe up inside the simulator.
//
// ── iOS VERSION SUPPORT ───────────────────────────────────────────────────────
//   iOS 13+: UIWindowScene-based window lookup via ScreenCaptureManager.
//   willResignActive / didBecomeActive notifications available since iOS 4.
//
// ── THREAD SAFETY ─────────────────────────────────────────────────────────────
//   All methods must be called from the main thread.
//   NotificationCenter callbacks are delivered on the main thread automatically
//   when registered without a specific queue parameter.

import UIKit

/// Manages a privacy overlay shown in the app-switcher thumbnail.
final class AppSwitcherProtectionManager {

    // MARK: - Configuration

    /// Background colour of the privacy overlay shown in the app-switcher.
    /// Defaults to UIColor.systemBackground (adapts to light/dark mode).
    var overlayColor: UIColor = .systemBackground

    // MARK: - State

    /// Whether app-switcher protection is currently enabled.
    private(set) var isProtectionEnabled: Bool = false

    /// The overlay view currently covering the screen.
    /// Non-nil only while the app is resigning active with protection enabled.
    private var privacyOverlay: UIView?

    /// Shared ScreenCaptureManager used for window resolution.
    private let captureManager: ScreenCaptureManager

    // MARK: - Init

    /// - Parameter captureManager: Shared ScreenCaptureManager for window access.
    init(captureManager: ScreenCaptureManager) {
        self.captureManager = captureManager
    }

    // MARK: - Public API

    /// Enables app-switcher privacy protection.
    ///
    /// Registers observers for willResignActive and didBecomeActive.
    /// Idempotent — existing observers are removed before re-registering.
    ///
    /// - Important: Must be called on the main thread.
    func enable() {
        removeNotificationObservers()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        isProtectionEnabled = true
    }

    /// Disables app-switcher privacy protection.
    ///
    /// Removes observers and dismisses any visible overlay.
    /// Safe to call when protection is not active (no-op).
    ///
    /// - Important: Must be called on the main thread.
    func disable() {
        removeNotificationObservers()
        removePrivacyOverlay()
        isProtectionEnabled = false
    }

    // MARK: - Notification Handlers

    /// Called just before iOS takes the app-switcher snapshot.
    ///
    /// Resolves the key window at fire-time (not at enable() time) so this
    /// works correctly regardless of when enable() was called relative to window
    /// creation. Uses UIScreen.main.bounds for reliable full-screen sizing.
    @objc private func appWillResignActive() {
        guard isProtectionEnabled,
              let window = captureManager.currentWindow(),
              privacyOverlay == nil else { return }

        // Use UIScreen.main.bounds for correct sizing during willResignActive,
        // where window.bounds may lag if a rotation just occurred.
        let frame = UIScreen.main.bounds
        let overlay = UIView(frame: frame)
        overlay.backgroundColor = overlayColor
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        // High z-order so the overlay sits above all content including modals.
        overlay.layer.zPosition = CGFloat(Float.greatestFiniteMagnitude)
        window.addSubview(overlay)
        privacyOverlay = overlay
    }

    /// Called when the app returns to the foreground.
    @objc private func appDidBecomeActive() {
        removePrivacyOverlay()
    }

    // MARK: - Helpers

    private func removeNotificationObservers() {
        NotificationCenter.default.removeObserver(
            self, name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.removeObserver(
            self, name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    private func removePrivacyOverlay() {
        privacyOverlay?.removeFromSuperview()
        privacyOverlay = nil
    }

    deinit {
        removeNotificationObservers()
        removePrivacyOverlay()
    }
}
