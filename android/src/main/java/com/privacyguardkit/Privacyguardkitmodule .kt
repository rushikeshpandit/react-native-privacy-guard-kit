package com.privacyguardkit

import android.app.Activity
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

class PrivacyGuardKitModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "PrivacyGuardKit"
        const val EVENT_SCREENSHOT_TAKEN       = "onScreenshotTaken"
        const val EVENT_SCREEN_RECORDING_STARTED = "onScreenRecordingStarted"
        const val EVENT_SCREEN_RECORDING_STOPPED = "onScreenRecordingStopped"
    }

    private var isScreenCaptureDisabled = false
    private var isAppSwitcherProtected  = false
    private var screenshotObserver: ScreenshotObserver? = null

    // Helper — safely get the current Activity from the stored context
    private val activity: Activity?
        get() = reactContext.currentActivity

    override fun getName(): String = MODULE_NAME

    // ─────────────────────────────────────────────
    // SCREEN CAPTURE
    // ─────────────────────────────────────────────

    @ReactMethod
    fun disableScreenCapture(promise: Promise) {
        val act = activity
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        try {
            act.runOnUiThread {
                act.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                isScreenCaptureDisabled = true
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISABLE_CAPTURE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun enableScreenCapture(promise: Promise) {
        val act = activity
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        try {
            act.runOnUiThread {
                act.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                isScreenCaptureDisabled = false
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ENABLE_CAPTURE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isScreenCaptureDisabled(promise: Promise) {
        promise.resolve(isScreenCaptureDisabled)
    }

    // ─────────────────────────────────────────────
    // SCREEN RECORDING DETECTION
    // ─────────────────────────────────────────────

    @ReactMethod
    fun isScreenBeingRecorded(promise: Promise) {
        // Android does not expose a direct public API for this.
        // FLAG_SECURE prevents recording content from being visible.
        // Full detection requires a foreground service with MediaProjection.
        promise.resolve(false)
    }

    // ─────────────────────────────────────────────
    // APP SWITCHER PROTECTION
    // FLAG_SECURE covers app-switcher thumbnails on Android
    // ─────────────────────────────────────────────

    @ReactMethod
    fun enableAppSwitcherProtection(promise: Promise) {
        val act = activity
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        try {
            act.runOnUiThread {
                act.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                isAppSwitcherProtected = true
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("APP_SWITCHER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun disableAppSwitcherProtection(promise: Promise) {
        val act = activity
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        try {
            act.runOnUiThread {
                // Only clear the flag if screen capture protection is also off
                if (!isScreenCaptureDisabled) {
                    act.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
                isAppSwitcherProtected = false
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("APP_SWITCHER_DISABLE_ERROR", e.message, e)
        }
    }

    // ─────────────────────────────────────────────
    // SCREENSHOT EVENT LISTENER
    // ─────────────────────────────────────────────

    @ReactMethod
    fun startScreenshotListener(promise: Promise) {
        try {
            screenshotObserver = ScreenshotObserver(reactContext) {
                sendEvent(EVENT_SCREENSHOT_TAKEN, null)
            }
            screenshotObserver?.start()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCREENSHOT_LISTENER_ERROR", e.message, e)
        }
    }

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

    // ─────────────────────────────────────────────
    // CLIPBOARD PROTECTION
    // ─────────────────────────────────────────────

    @ReactMethod
    fun clearClipboard(promise: Promise) {
        try {
            val clipboard = reactContext
                .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                clipboard.clearPrimaryClip()
            } else {
                @Suppress("DEPRECATION")
                clipboard.text = ""
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLIPBOARD_CLEAR_ERROR", e.message, e)
        }
    }

    // ─────────────────────────────────────────────
    // EVENT EMITTER SUPPORT
    // Required stubs for RN's NativeEventEmitter
    // ─────────────────────────────────────────────

    @ReactMethod
    fun addListener(eventName: String) { /* Required by RN */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* Required by RN */ }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun invalidate() {
        super.invalidate()
        screenshotObserver?.stop()
        screenshotObserver = null
    }
}