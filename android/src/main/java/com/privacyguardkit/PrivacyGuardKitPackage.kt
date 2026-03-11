package com.privacyguardkit

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * PrivacyGuardKitPackage — React Native [ReactPackage] registration entry point.
 *
 * Connects this library's native implementations to React Native's module and
 * view-manager registries. Must be added to the host application's package list.
 *
 * ── REGISTRATION ──────────────────────────────────────────────────────────────
 *   Old Architecture (MainApplication.kt):
 *     override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
 *         add(PrivacyGuardKitPackage())
 *     }
 *
 *   New Architecture (auto-linking):
 *     Registered automatically via react-native.config.js when auto-linking is
 *     configured. Manual registration only needed when auto-linking is disabled.
 *
 * ── MODULES PROVIDED ──────────────────────────────────────────────────────────
 *   [PrivacyGuardKitModule] — JS name: "PrivacyGuardKit"
 *     Methods: disableScreenCapture, enableScreenCapture, isScreenCaptureDisabled,
 *              isScreenBeingRecorded, enableAppSwitcherProtection,
 *              disableAppSwitcherProtection, startScreenshotListener,
 *              stopScreenshotListener, clearClipboard
 *
 * ── VIEW MANAGERS PROVIDED ────────────────────────────────────────────────────
 *   [SecureViewManager] — JS name: "RNSecureView"
 *     Props: isCopyPasteDisabled (Boolean, default false)
 */
class PrivacyGuardKitPackage : ReactPackage {

    /**
     * Creates and returns all Native Modules provided by this package.
     *
     * @param reactContext The application-scoped React Native context.
     * @return A list containing a single [PrivacyGuardKitModule] instance.
     */
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(PrivacyGuardKitModule(reactContext))

    /**
     * Creates and returns all View Managers provided by this package.
     *
     * [SecureViewManager] extends [ViewGroupManager] (not SimpleViewManager)
     * because [SecureView] extends ReactViewGroup and must satisfy Fabric's
     * IViewGroupManager contract for correct child-view mounting.
     *
     * @param reactContext The application-scoped React Native context.
     * @return A list containing a single [SecureViewManager] instance.
     */
    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = listOf(SecureViewManager())
}
