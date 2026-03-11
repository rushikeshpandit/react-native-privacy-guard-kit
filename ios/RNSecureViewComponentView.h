// RNSecureViewComponentView.h
//
// Fabric (New Architecture) ComponentView for the RNSecureView component.
//
// ── ARCHITECTURE ──────────────────────────────────────────────────────────────
//   This header is only compiled when RCT_NEW_ARCH_ENABLED is defined.
//   The Old Architecture (Paper) path uses RNSecureViewManager.mm exclusively.
//
// ── CLASS NAME CONTRACT ───────────────────────────────────────────────────────
//   "RNSecureViewComponentView" is resolved at runtime by NSClassFromString()
//   inside the RN-generated RCTAppDependencyProvider. It MUST match the
//   componentProvider mapping in package.json:
//     "RNSecureView" → "RNSecureViewComponentView"
//
// ── DO NOT IMPORT C++ HEADERS HERE ────────────────────────────────────────────
//   All C++/JSI/Fabric headers belong in the .mm implementation file only.
//   This .h may be included from pure Objective-C compilation units.
//
// ── iOS VERSION SUPPORT ───────────────────────────────────────────────────────
//   iOS 13+ — RCTViewComponentView (Fabric) requires iOS 13 minimum.

#ifdef RCT_NEW_ARCH_ENABLED

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * RNSecureViewComponentView
 *
 * A Fabric-native UIView subclass that blocks copy/paste and text selection
 * for all UITextField and UITextView descendants.
 *
 * Managed by the Fabric renderer via the RNSecureView component descriptor.
 * Props are applied via updateProps:oldProps: when `isCopyPasteDisabled` changes.
 */
@interface RNSecureViewComponentView : RCTViewComponentView

@end

NS_ASSUME_NONNULL_END

#endif // RCT_NEW_ARCH_ENABLED
