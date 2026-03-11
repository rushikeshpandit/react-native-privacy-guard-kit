package com.privacyguardkit

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * SecureViewManager — React Native ViewGroupManager for [SecureView].
 *
 * Bridges the JavaScript prop `isCopyPasteDisabled` to the native
 * [SecureView.setIsCopyPasteDisabled] / [SecureView.enableCopyPaste] methods.
 *
 * ── WHY ViewGroupManager (not SimpleViewManager) ──────────────────────────────
 *   1. Fabric (New Architecture):
 *      Fabric's SurfaceMountingManager casts view managers to IViewGroupManager
 *      when the managed view contains children. SimpleViewManager does NOT
 *      implement IViewGroupManager, causing a ClassCastException at runtime.
 *   2. [SecureView] extends ReactViewGroup (a ViewGroup subclass), so
 *      ViewGroupManager is the semantically correct base class.
 *
 * ── REGISTRATION ──────────────────────────────────────────────────────────────
 *   Registered in [PrivacyGuardKitPackage.createViewManagers].
 *   The JS component name "RNSecureView" must match the string returned by
 *   [getName] in both requireNativeComponent and Fabric codegen specs.
 *
 * JS usage (Old Architecture):
 *   import { requireNativeComponent } from 'react-native';
 *   const RNSecureView = requireNativeComponent('RNSecureView');
 *
 * JS usage (New Architecture / Fabric codegen):
 *   The spec name must match 'RNSecureView' in the codegenConfig.
 */
class SecureViewManager : ViewGroupManager<SecureView>() {

    /**
     * Returns the JS-facing component name used to resolve this view manager.
     *
     * Must exactly match the name passed to `requireNativeComponent('RNSecureView')`
     * on the JS side (Old Architecture) or declared in the Fabric codegen spec
     * (New Architecture).
     *
     * @return The string "RNSecureView".
     */
    override fun getName(): String = "RNSecureView"

    /**
     * Instantiates a fresh [SecureView] for each mounted component instance.
     *
     * @param reactContext The themed React context for the current surface.
     * @return A new [SecureView] instance with default (unprotected) state.
     */
    override fun createViewInstance(reactContext: ThemedReactContext): SecureView {
        return SecureView(reactContext)
    }

    /**
     * Handles the `isCopyPasteDisabled` Boolean prop sent from JavaScript.
     *
     * The prop name "isCopyPasteDisabled" matches the JS-side prop name used by
     * the native component (and the iOS Fabric spec name). [defaultBoolean] = false
     * ensures that omitting the prop is equivalent to `isCopyPasteDisabled={false}`.
     *
     * ── SIGNATURE CONTRACT ────────────────────────────────────────────────────
     *   DO NOT change parameter types, order, or the @ReactProp name attribute.
     *   The React Native bridge uses reflection to match this method.
     *
     * @param view    The [SecureView] instance to update.
     * @param disable `true` to block copy/paste; `false` to restore it.
     */
    @ReactProp(name = "isCopyPasteDisabled", defaultBoolean = false)
    fun setIsCopyPasteDisabled(view: SecureView, disable: Boolean) {
        if (disable) view.setIsCopyPasteDisabled() else view.enableCopyPaste()
    }
}
