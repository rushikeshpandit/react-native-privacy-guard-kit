// PrivacyGuardKit.swift
// The @objc(PrivacyGuardKit) annotation is what generates
// _OBJC_CLASS_$_PrivacyGuardKit that the linker needs.
// The class name MUST match the RCT_EXTERN_MODULE name in PrivacyGuardKit.m

import Foundation
import UIKit
import React

@objc(PrivacyGuardKit)
class PrivacyGuardKit: RCTEventEmitter {

    static let screenshotTakenEvent  = "onScreenshotTaken"
    static let recordingStartedEvent = "onScreenRecordingStarted"
    static let recordingStoppedEvent = "onScreenRecordingStopped"

    private var isCaptureDisabled    = false
    private var isAppSwitcherGuarded = false
    private var secureOverlay: UIView?
    private var appSwitcherOverlay: UIView?

    override static func moduleName() -> String! { "PrivacyGuardKit" }
    override static func requiresMainQueueSetup() -> Bool { true }

    override func supportedEvents() -> [String]! {
        [
            PrivacyGuardKit.screenshotTakenEvent,
            PrivacyGuardKit.recordingStartedEvent,
            PrivacyGuardKit.recordingStoppedEvent,
        ]
    }

    // MARK: - Screen Capture

    @objc(disableScreenCapture:reject:)
    func disableScreenCapture(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            self.addSecureOverlay()
            self.isCaptureDisabled = true
            resolve(true)
        }
    }

    @objc(enableScreenCapture:reject:)
    func enableScreenCapture(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            self.removeSecureOverlay()
            self.isCaptureDisabled = false
            resolve(true)
        }
    }

    @objc(isScreenCaptureDisabled:reject:)
    func isScreenCaptureDisabled(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(isCaptureDisabled)
    }

    private func addSecureOverlay() {
        guard let window = currentWindow(), secureOverlay == nil else { return }
        let field = UITextField()
        field.isSecureTextEntry = true
        field.translatesAutoresizingMaskIntoConstraints = false
        let container = UIView()
        container.isUserInteractionEnabled = false
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(field)
        window.addSubview(container)
        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: window.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: window.trailingAnchor),
            container.topAnchor.constraint(equalTo: window.topAnchor),
            container.bottomAnchor.constraint(equalTo: window.bottomAnchor),
            field.widthAnchor.constraint(equalTo: container.widthAnchor),
            field.heightAnchor.constraint(equalTo: container.heightAnchor),
            field.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            field.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])
        window.sendSubviewToBack(container)
        secureOverlay = container
    }

    private func removeSecureOverlay() {
        secureOverlay?.removeFromSuperview()
        secureOverlay = nil
    }

    // MARK: - Screen Recording

    @objc(isScreenBeingRecorded:reject:)
    func isScreenBeingRecorded(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(UIScreen.main.isCaptured)
    }

    @objc(startScreenshotListener:reject:)
    func startScreenshotListener(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        NotificationCenter.default.removeObserver(self)
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleScreenshot),
            name: UIApplication.userDidTakeScreenshotNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleRecordingChange),
            name: UIScreen.capturedDidChangeNotification, object: nil)
        resolve(true)
    }

    @objc(stopScreenshotListener:reject:)
    func stopScreenshotListener(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        NotificationCenter.default.removeObserver(
            self, name: UIApplication.userDidTakeScreenshotNotification, object: nil)
        NotificationCenter.default.removeObserver(
            self, name: UIScreen.capturedDidChangeNotification, object: nil)
        resolve(true)
    }

    @objc private func handleScreenshot() {
        sendEvent(withName: PrivacyGuardKit.screenshotTakenEvent, body: nil)
    }

    @objc private func handleRecordingChange() {
        let recording = UIScreen.main.isCaptured
        sendEvent(
            withName: recording
                ? PrivacyGuardKit.recordingStartedEvent
                : PrivacyGuardKit.recordingStoppedEvent,
            body: ["isRecording": recording])
    }

    // MARK: - App Switcher

    @objc(enableAppSwitcherProtection:reject:)
    func enableAppSwitcherProtection(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            NotificationCenter.default.addObserver(
                self, selector: #selector(self.appWillResignActive),
                name: UIApplication.willResignActiveNotification, object: nil)
            NotificationCenter.default.addObserver(
                self, selector: #selector(self.appDidBecomeActive),
                name: UIApplication.didBecomeActiveNotification, object: nil)
            self.isAppSwitcherGuarded = true
            resolve(true)
        }
    }

    @objc(disableAppSwitcherProtection:reject:)
    func disableAppSwitcherProtection(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            NotificationCenter.default.removeObserver(
                self, name: UIApplication.willResignActiveNotification, object: nil)
            NotificationCenter.default.removeObserver(
                self, name: UIApplication.didBecomeActiveNotification, object: nil)
            self.removeAppSwitcherOverlay()
            self.isAppSwitcherGuarded = false
            resolve(true)
        }
    }

    @objc private func appWillResignActive() {
        guard let window = currentWindow() else { return }
        let overlay = UIView(frame: window.bounds)
        overlay.backgroundColor = .systemBackground
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        window.addSubview(overlay)
        appSwitcherOverlay = overlay
    }

    @objc private func appDidBecomeActive() {
        removeAppSwitcherOverlay()
    }

    private func removeAppSwitcherOverlay() {
        appSwitcherOverlay?.removeFromSuperview()
        appSwitcherOverlay = nil
    }

    // MARK: - Clipboard

    @objc(clearClipboard:reject:)
    func clearClipboard(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        UIPasteboard.general.items = []
        resolve(true)
    }

    // MARK: - Helpers

    private func currentWindow() -> UIWindow? {
        if #available(iOS 13.0, *) {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }
        }
        return UIApplication.shared.keyWindow
    }
}
