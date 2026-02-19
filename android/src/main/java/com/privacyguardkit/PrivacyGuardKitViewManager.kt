package com.privacyguardkit

import android.graphics.Color
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.PrivacyGuardKitViewManagerInterface
import com.facebook.react.viewmanagers.PrivacyGuardKitViewManagerDelegate

@ReactModule(name = PrivacyGuardKitViewManager.NAME)
class PrivacyGuardKitViewManager : SimpleViewManager<PrivacyGuardKitView>(),
  PrivacyGuardKitViewManagerInterface<PrivacyGuardKitView> {
  private val mDelegate: ViewManagerDelegate<PrivacyGuardKitView>

  init {
    mDelegate = PrivacyGuardKitViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<PrivacyGuardKitView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): PrivacyGuardKitView {
    return PrivacyGuardKitView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: PrivacyGuardKitView?, color: Int?) {
    view?.setBackgroundColor(color ?: Color.TRANSPARENT)
  }

  companion object {
    const val NAME = "PrivacyGuardKitView"
  }
}
