package com.privacyguardkit

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * PrivacyGuardKitModule — React Native Native Module for privacy protection.
 *
 * Exposes the following feature groups to JavaScript via the bridge:
 *   • Screen capture prevention  (FLAG_SECURE on the Window)
 *   • Screen recording detection (limited on Android — see [isScreenBeingRecorded])
 *   • App-switcher thumbnail blurring (also uses FLAG_SECURE)
 *   • Screenshot event listener  (MediaStore ContentObserver)
 *   • Clipboard clearing
 *
 * ── EMULATOR NOTES ────────────────────────────────────────────────────────────
 *   FLAG_SECURE behaves identically on emulators and real devices: screenshots
 *   taken from within the emulator (via adb or Android Studio) are blocked and
 *   the screen appears black. Host-OS screen-capture tools that record the
 *   emulator window directly bypass FLAG_SECURE — this is expected and cannot
 *   be prevented at the Android layer.
 *
 *   The MediaStore ContentObserver (screenshot listener) works on emulators
 *   when screenshots are taken using the emulator's own screenshot button or
 *   `adb shell screencap`. It will NOT fire when the host OS captures the
 *   emulator window directly, because no image is written to the device's
 *   MediaStore in that case.
 *
 * ── API VERSION SUPPORT ───────────────────────────────────────────────────────
 *   Minimum supported: API 29 (Android 10, Q)
 *   Tested up to:      API 34 (Android 14, U)
 *
 * ── THREADING ─────────────────────────────────────────────────────────────────
 *   All Window flag mutations MUST run on the UI thread. Methods that touch
 *   the Window use [Activity.runOnUiThread]. State flags are updated inside
 *   the UI-thread lambda so they always reflect the committed window state.
 *   @Volatile ensures visibility of those flags to bridge threads without
 *   requiring a full lock.
 *
 *   Promise.resolve / Promise.reject are safe to call from any thread.
 *
 * ── LIFECYCLE ─────────────────────────────────────────────────────────────────
 *   [invalidate] is called by React Native when the module is torn down
 *   (e.g. activity destroy). It stops the screenshot observer to prevent
 *   a ContentObserver leak.
 *
 * JS module name: "PrivacyGuardKit"
 */
class PrivacyGuardKitModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        /** The name exposed to JavaScript: NativeModules.PrivacyGuardKit */
        const val MODULE_NAME = "PrivacyGuardKit"

        /** Emitted to JS when the user takes a screenshot. */
        const val EVENT_SCREENSHOT_TAKEN = "onScreenshotTaken"

        /**
         * Reserved event name for future screen-recording start detection.
         * Not currently emitted on Android (no public API available as of API 34).
         */
        const val EVENT_SCREEN_RECORDING_STARTED = "onScreenRecordingStarted"

        /**
         * Reserved event name for future screen-recording stop detection.
         * Not currently emitted on Android (no public API available as of API 34).
         */
        const val EVENT_SCREEN_RECORDING_STOPPED = "onScreenRecordingStopped"
    }

    /**
     * Whether FLAG_SECURE was set via [disableScreenCapture].
     * Written on the UI thread; read from bridge threads.
     * @Volatile ensures cross-thread visibility without a lock.
     */
    @Volatile
    private var isScreenCaptureDisabledState = false

    /**
     * Whether FLAG_SECURE was set via [enableAppSwitcherProtection].
     * Tracked independently from [isScreenCaptureDisabledState] so the two
     * features can be toggled without accidentally clearing each other's flag.
     * @Volatile for the same cross-thread visibility guarantee.
     */
    @Volatile
    private var isAppSwitcherProtected = false

    /** Active screenshot observer. Null when the listener is not running. */
    private var screenshotObserver: ScreenshotObserver? = null

    /**
     * Convenience property: returns the currently foregrounded Activity, or
     * null during cold-start, after an Activity destroy, or on the emulator
     * when the app is in the background.
     */
    private val activity: Activity?
        get() = reactContext.currentActivity

    /** Returns the module's JS-facing name ("PrivacyGuardKit"). */
    override fun getName(): String = MODULE_NAME

    // ─────────────────────────────────────────────────────────────
    // SCREEN CAPTURE PROTECTION
    // ─────────────────────────────────────────────────────────────

    /**
     * Adds [WindowManager.LayoutParams.FLAG_SECURE] to the current Activity's
     * Window, preventing the screen content from appearing in:
     *   • Device or emulator screenshots (taken via the OS or adb)
     *   • Screen recordings (content appears black in the recording)
     *   • App-switcher (recent-tasks) thumbnails
     *
     * ── PROMISE OUTCOMES ──────────────────────────────────────────────────────
     *   Resolves with `true`              — flag applied successfully.
     *   Rejects  "NO_ACTIVITY"            — no foregrounded Activity.
     *   Rejects  "NO_WINDOW"              — Activity window is null.
     *   Rejects  "DISABLE_CAPTURE_ERROR"  — unexpected exception.
     *
     * @param promise Fulfilled by the bridge to resolve/reject the JS Promise.
     */
    @ReactMethod
    fun disableScreenCapture(promise: Promise) {
        val act = activity ?: run {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        act.runOnUiThread {
            try {
                val window = act.window ?: run {
                    promise.reject("NO_WINDOW", "Activity window is null")
                    return@runOnUiThread
                }
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                isScreenCaptureDisabledState = true
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DISABLE_CAPTURE_ERROR", e.message, e)
            }
        }
    }

    /**
     * Removes [WindowManager.LayoutParams.FLAG_SECURE] from the Activity's
     * Window, re-enabling screenshots and screen recordings.
     *
     * ── GUARD LOGIC ───────────────────────────────────────────────────────────
     *   FLAG_SECURE is only cleared when [isAppSwitcherProtected] is also false.
     *   This prevents accidentally exposing app-switcher thumbnails when the
     *   caller only intended to re-enable screenshots.
     *
     * ── PROMISE OUTCOMES ──────────────────────────────────────────────────────
     *   Resolves with `true`            — flag cleared or intentionally retained.
     *   Rejects  "NO_ACTIVITY"          — no foregrounded Activity.
     *   Rejects  "NO_WINDOW"            — Activity window is null.
     *   Rejects  "ENABLE_CAPTURE_ERROR" — unexpected exception.
     *
     * @param promise Fulfilled by the bridge to resolve/reject the JS Promise.
     */
    @ReactMethod
    fun enableScreenCapture(promise: Promise) {
        val act = activity ?: run {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        act.runOnUiThread {
            try {
                val window = act.window ?: run {
                    promise.reject("NO_WINDOW", "Activity window is null")
                    return@runOnUiThread
                }
                if (!isAppSwitcherProtected) {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
                isScreenCaptureDisabledState = false
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("ENABLE_CAPTURE_ERROR", e.message, e)
            }
        }
    }

    /**
     * Returns whether screen-capture protection is currently active.
     *
     * Queries the actual Window flags instead of relying solely on the in-memory
     * state, so this reflects the true state even if FLAG_SECURE was set/cleared
     * by another component.
     *
     * Falls back to the in-memory state if no Activity/Window is available
     * (e.g. during cold-start).
     *
     * Resolves with a Boolean. Never rejects.
     *
     * @param promise Resolved with `true` if FLAG_SECURE is active, `false` otherwise.
     */
    @ReactMethod
    fun isScreenCaptureDisabled(promise: Promise) {
        val win = activity?.window
        if (win != null) {
            val flags = win.attributes?.flags ?: 0
            val isFlagSet = (flags and WindowManager.LayoutParams.FLAG_SECURE) != 0
            promise.resolve(isFlagSet)
        } else {
            // Fallback: return in-memory state if window is unavailable
            promise.resolve(isScreenCaptureDisabledState)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SCREEN RECORDING DETECTION
    // ─────────────────────────────────────────────────────────────

    /**
     * Checks whether the screen is currently being recorded.
     *
     * ── ANDROID LIMITATION ────────────────────────────────────────────────────
     *   No public Android API exposes active screen-recording status from within
     *   the app process on API 29–34+. Always resolves with `false`.
     *   Use [disableScreenCapture] as the mitigation strategy.
     *
     * @param promise Always resolved with `false`.
     */
    @ReactMethod
    fun isScreenBeingRecorded(promise: Promise) {
        promise.resolve(false)
    }

    // ─────────────────────────────────────────────────────────────
    // APP-SWITCHER PROTECTION
    // ─────────────────────────────────────────────────────────────

    /**
     * Prevents the app's content from appearing in the recent-tasks
     * (app-switcher) thumbnail by applying FLAG_SECURE to the Window.
     *
     * ── PROMISE OUTCOMES ──────────────────────────────────────────────────────
     *   Resolves with `true`           — flag applied successfully.
     *   Rejects  "NO_ACTIVITY"         — no foregrounded Activity.
     *   Rejects  "NO_WINDOW"           — Activity window is null.
     *   Rejects  "APP_SWITCHER_ERROR"  — unexpected exception.
     *
     * @param promise Fulfilled by the bridge to resolve/reject the JS Promise.
     */
    @ReactMethod
    fun enableAppSwitcherProtection(promise: Promise) {
        val act = activity ?: run {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        act.runOnUiThread {
            try {
                val window = act.window ?: run {
                    promise.reject("NO_WINDOW", "Activity window is null")
                    return@runOnUiThread
                }
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                isAppSwitcherProtected = true
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("APP_SWITCHER_ERROR", e.message, e)
            }
        }
    }

    /**
     * Removes app-switcher thumbnail protection.
     *
     * ── GUARD LOGIC ───────────────────────────────────────────────────────────
     *   FLAG_SECURE is only cleared when [isScreenCaptureDisabledState] is also false.
     *   This prevents accidentally re-enabling screenshots when the caller only
     *   intended to stop hiding the app-switcher thumbnail.
     *
     * ── PROMISE OUTCOMES ──────────────────────────────────────────────────────
     *   Resolves with `true`                  — protection removed or flag retained.
     *   Rejects  "NO_ACTIVITY"                — no foregrounded Activity.
     *   Rejects  "NO_WINDOW"                  — Activity window is null.
     *   Rejects  "APP_SWITCHER_DISABLE_ERROR" — unexpected exception.
     *
     * @param promise Fulfilled by the bridge to resolve/reject the JS Promise.
     */
    @ReactMethod
    fun disableAppSwitcherProtection(promise: Promise) {
        val act = activity ?: run {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        act.runOnUiThread {
            try {
                val window = act.window ?: run {
                    promise.reject("NO_WINDOW", "Activity window is null")
                    return@runOnUiThread
                }
                if (!isScreenCaptureDisabledState) {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
                isAppSwitcherProtected = false
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("APP_SWITCHER_DISABLE_ERROR", e.message, e)
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SCREENSHOT EVENT LISTENER
    // ─────────────────────────────────────────────────────────────

    /**
     * Starts listening for screenshots taken on the device or emulator.
     *
     * Registers a [ScreenshotObserver] (ContentObserver on
     * MediaStore.Images.Media.EXTERNAL_CONTENT_URI) that emits
     * [EVENT_SCREENSHOT_TAKEN] to JS when a new screenshot is detected.
     *
     * ── API / PERMISSION REQUIREMENTS ────────────────────────────────────────
     *   API 29-32: READ_EXTERNAL_STORAGE permission required.
     *   API 33+  : READ_MEDIA_IMAGES required.
     *   The JS layer must request the appropriate permission before calling this.
     *
     * ── DUPLICATE START GUARD ─────────────────────────────────────────────────
     *   If called while a listener is already active, the old observer is stopped
     *   before a new one is registered, preventing a ContentObserver leak.
     *
     * ── PROMISE OUTCOMES ──────────────────────────────────────────────────────
     *   Resolves with `true`                 — observer registered.
     *   Rejects  "SCREENSHOT_LISTENER_ERROR" — unexpected exception.
     *
     * @param promise Fulfilled by the bridge to resolve/reject the JS Promise.
     */
    @ReactMethod
    fun startScreenshotListener(promise: Promise) {
        try {
            screenshotObserver?.stop()
            screenshotObserver = ScreenshotObserver(reactContext) {
                sendEvent(EVENT_SCREENSHOT_TAKEN, null)
            }
            screenshotObserver?.start()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCREENSHOT_LISTENER_ERROR", e.message, e)
        }
    }

    /**
     * Stops the active screenshot listener and unregisters the ContentObserver.
     *
     * Safe to call when no listener is active (no-op in that case).
     *
     * ── PROMISE OUTCOMES ──────────────────────────────────────────────────────
     *   Resolves with `true`                      — observer unregistered.
     *   Rejects  "SCREENSHOT_LISTENER_STOP_ERROR" — unexpected exception.
     *
     * @param promise Fulfilled by the bridge to resolve/reject the JS Promise.
     */
    @ReactMethod
    fun stopScreenshotListener(promise: Promise) {
        try {
            screenshotObserver?.stop()
            screenshotObserver = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCREENSHOT_LISTENER_STOP_ERROR", e.message, e)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // CLIPBOARD PROTECTION
    // ─────────────────────────────────────────────────────────────

    /**
     * Clears all content from the system clipboard.
     *
     * ── API BEHAVIOUR BY VERSION ──────────────────────────────────────────────
     *   API 28+: Uses [ClipboardManager.clearPrimaryClip].
     *   API < 28 (fallback): Overwrites the primary clip with empty ClipData.
     *
     * ── PROMISE OUTCOMES ──────────────────────────────────────────────────────
     *   Resolves with `true`             — clipboard cleared.
     *   Rejects  "CLIPBOARD_CLEAR_ERROR" — unexpected exception.
     *
     * @param promise Fulfilled by the bridge to resolve/reject the JS Promise.
     */
    @ReactMethod
    fun clearClipboard(promise: Promise) {
        try {
            val clipboard = reactContext
                .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                clipboard.clearPrimaryClip()
            } else {
                clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLIPBOARD_CLEAR_ERROR", e.message, e)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT EMITTER SUPPORT
    // ─────────────────────────────────────────────────────────────

    /**
     * Required stub for React Native's NativeEventEmitter.
     * DO NOT REMOVE — its absence causes "addListener is not a function" in JS.
     *
     * @param eventName The event being subscribed to (unused here).
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // No-op: required by NativeEventEmitter contract.
    }

    /**
     * Required stub for React Native's NativeEventEmitter.
     * DO NOT REMOVE — its absence causes "removeListeners is not a function" in JS.
     *
     * @param count Number of listeners being removed (unused here).
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op: required by NativeEventEmitter contract.
    }

    /**
     * Emits a named event with an optional payload to all active JS subscribers.
     *
     * Uses [DeviceEventManagerModule.RCTDeviceEventEmitter].
     * Guards against null JS module reference and bridge-teardown races.
     * Compatible with both older and newer React Native versions by catching
     * any exception thrown if [hasActiveReactInstance] is unavailable.
     *
     * @param eventName The event name JS listeners subscribe to.
     * @param params    Optional WritableMap payload; pass null for no-payload events.
     */
    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            // hasActiveReactInstance() is available in RN 0.65+.
            // On older RN versions it may not exist — the catch block handles that.
            if (!reactContext.hasActiveReactInstance()) return
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        } catch (_: Exception) {
            // Bridge is tearing down or not yet initialised — events are best-effort.
        }
    }

    // ─────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ─────────────────────────────────────────────────────────────

    /**
     * Called by React Native when the module is invalidated.
     *
     * Cleans up [ScreenshotObserver] BEFORE calling super to avoid using
     * an invalidated ReactApplicationContext inside the observer's stop().
     */
    override fun invalidate() {
        screenshotObserver?.stop()
        screenshotObserver = null
        super.invalidate()
    }
}
