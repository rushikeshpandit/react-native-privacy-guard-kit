// PrivacyGuardKit.swift
//
// React Native Native Module — privacy protection for iOS.
// Provides APIs for app-switcher protection, screen capture prevention, and
// screenshot detection. Also handles iOS 13+ privacy features.
//
import Foundation
import UIKit
import React

@objc(PrivacyGuardKit)
final class PrivacyGuardKit: RCTEventEmitter {

    // MARK: - Feature Managers
    //
    // Implicitly-unwrapped optionals initialised eagerly in override init().
    // This avoids Swift lazy-var thread-safety issues
    private var captureManager: ScreenCaptureManager!
    private var appSwitcherManager: AppSwitcherProtectionManager!
    private var detectionManager: ScreenshotDetectionManager!

    // MARK: - Listener Guard
    //
    // Prevents sendEvent(withName:body:) from being called before JS has any
    // active subscribers, which causes a fatal RN assertion.
    private var hasListeners = false

    // MARK: - Init 

    override init() {
        super.init()
        captureManager     = ScreenCaptureManager()
        appSwitcherManager = AppSwitcherProtectionManager(captureManager: captureManager)
        detectionManager   = ScreenshotDetectionManager { [weak self] eventName, body in
            // Only forward events when JS has active listeners.
            guard let self = self, self.hasListeners else { return }
            self.sendEvent(withName: eventName, body: body)
        }
    }

    // MARK: - RCTEventEmitter Overrides

    override static func moduleName() -> String! { "PrivacyGuardKit" }

    override static func requiresMainQueueSetup() -> Bool { true }

    override func supportedEvents() -> [String]! {
        [
            ScreenshotDetectionManager.screenshotTakenEvent,    // "onScreenshotTaken"
            ScreenshotDetectionManager.recordingStartedEvent,   // "onScreenRecordingStarted"
            ScreenshotDetectionManager.recordingStoppedEvent,   // "onScreenRecordingStopped"
        ]
    }

    // MARK: - Listener Lifecycle

    override func startObserving() { hasListeners = true  }
    override func stopObserving()  { hasListeners = false }

    // MARK: - Lifecycle

    /// Cleans up all managers when the module is torn down by React Native.
    ///
    /// Called on hot-reload, app kill, or bridge teardown. Stops the detection
    /// manager's NotificationCenter observers and removes any active overlays to
    /// prevent ghost events and memory leaks after the bridge is gone.
    override func invalidate() {
        DispatchQueue.main.async { [weak self] in
            self?.detectionManager.stopListening()
            self?.captureManager.disable()
            self?.appSwitcherManager.disable()
        }
        super.invalidate()
    }

    // MARK: - Screen Capture

    @objc(disableScreenCapture:reject:)
    func disableScreenCapture(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            // Guard self and resolve with safe fallback if deallocated.
            guard let self = self else { resolve(false); return }
            self.captureManager.enable()
            resolve(true)
        }
    }

    @objc(enableScreenCapture:reject:)
    func enableScreenCapture(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { resolve(false); return }
            self.captureManager.disable()
            resolve(true)
        }
    }

    /// isCaptureDisabled is written on the main thread; read it there too.
    @objc(isScreenCaptureDisabled:reject:)
    func isScreenCaptureDisabled(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            resolve(self?.captureManager.isCaptureDisabled ?? false)
        }
    }

    // MARK: - Screen Recording Detection

    /// UIScreen access must be on the main thread.
    @objc(isScreenBeingRecorded:reject:)
    func isScreenBeingRecorded(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            resolve(self?.detectionManager.isScreenBeingRecorded() ?? false)
        }
    }

    // MARK: - Screenshot & Recording Listeners

    @objc(startScreenshotListener:reject:)
    func startScreenshotListener(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { resolve(false); return }
            self.detectionManager.startListening()
            resolve(true)
        }
    }

    @objc(stopScreenshotListener:reject:)
    func stopScreenshotListener(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { resolve(false); return }
            self.detectionManager.stopListening()
            resolve(true)
        }
    }

    // MARK: - App-Switcher Protection

    @objc(enableAppSwitcherProtection:reject:)
    func enableAppSwitcherProtection(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { resolve(false); return }
            self.appSwitcherManager.enable()
            resolve(true)
        }
    }

    @objc(disableAppSwitcherProtection:reject:)
    func disableAppSwitcherProtection(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { resolve(false); return }
            self.appSwitcherManager.disable()
            resolve(true)
        }
    }

    // MARK: - Clipboard

    @objc(clearClipboard:reject:)
    func clearClipboard(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            UIPasteboard.general.items = []
            resolve(true)
        }
    }
}
