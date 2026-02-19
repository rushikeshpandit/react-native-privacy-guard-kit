package com.privacyguardkit

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * ViewGroupManager (not SimpleViewManager) is required for:
 *  1. New Architecture (Fabric) — Fabric casts view managers to
 *     IViewGroupManager when the view has children. SimpleViewManager
 *     does NOT implement IViewGroupManager, causing the cast crash.
 *  2. SecureView extends ReactViewGroup (a ViewGroup), so it must
 *     be managed by a ViewGroupManager anyway.
 */
class SecureViewManager : ViewGroupManager<SecureView>() {

    override fun getName(): String = "RNSecureView"

    override fun createViewInstance(reactContext: ThemedReactContext): SecureView {
        return SecureView(reactContext)
    }

    @ReactProp(name = "disableCopyPaste", defaultBoolean = false)
    fun setDisableCopyPaste(view: SecureView, disable: Boolean) {
        if (disable) view.disableCopyPaste() else view.enableCopyPaste()
    }
}