/**
 * RNSecureViewNativeComponent.ts
 *
 * Fabric codegen spec for the RNSecureView native component.
 *
 * ── PURPOSE ───────────────────────────────────────────────────────────────────
 *   This file is the source of truth for the RNSecureView component's type
 *   contract between JavaScript and the native layer. The React Native codegen
 *   pipeline reads this file to generate:
 *     - C++ Fabric component descriptors and props structs
 *     - ObjC protocol (RCTRNSecureViewViewProtocol) used in .mm files
 *     - TypeScript types for the JS component
 *
 * ── REACT NATIVE VERSION NOTES ────────────────────────────────────────────────
 *   RN 0.73+: `codegenNativeComponent` is exported from the top-level
 *   'react-native' package. Use this form — do NOT use deep imports like:
 *     'react-native/Libraries/Utilities/codegenNativeComponent'
 *   Deep imports are deprecated since RN 0.73 and will cause a build error
 *   in RN 0.83+.
 *
 *   RN 0.76+: The New Architecture (Fabric) is enabled by default. This spec
 *   is now always required, even if you also ship a Paper fallback via
 *   RNSecureViewManager.mm.
 *
 * ── CODEGEN CONFIG (package.json) ─────────────────────────────────────────────
 *   Ensure your package.json includes:
 *   {
 *     "codegenConfig": {
 *       "name": "PrivacyGuardKitViewSpec",
 *       "type": "components",
 *       "jsSrcsDir": "src/specs",
 *       "ios": {
 *         "componentProvider": {
 *           "RNSecureView": "RNSecureViewComponentView"
 *         }
 *       }
 *     }
 *   }
 *
 *   The "name" field ("PrivacyGuardKitViewSpec") becomes the C++ namespace and
 *   the folder name under which generated headers are placed:
 *     react/renderer/components/PrivacyGuardKitViewSpec/ComponentDescriptors.h
 *     react/renderer/components/PrivacyGuardKitViewSpec/Props.h
 *     react/renderer/components/PrivacyGuardKitViewSpec/RCTComponentViewHelpers.h
 *   These are the exact paths imported in RNSecureViewComponentView.mm.
 *
 * ── CLASS NAME CONTRACT ───────────────────────────────────────────────────────
 *   The string "RNSecureView" passed to `codegenNativeComponent` MUST match:
 *     1. The iOS component provider key: "RNSecureView" → "RNSecureViewComponentView"
 *     2. The Android class name returned by SecureViewManager.getName(): "RNSecureView"
 *     3. The Paper RCT_EXPORT_MODULE macro in RNSecureViewManager.mm: RNSecureView
 *
 * ── PROP NAMING ───────────────────────────────────────────────────────────────
 *   The prop `isCopyPasteDisabled` (camelCase) maps to:
 *     - iOS Fabric:  `RNSecureViewProps.isCopyPasteDisabled` (C++ struct field,
 *       generated from the spec's camelCase field name)
 *     - iOS Paper:   `RCT_CUSTOM_VIEW_PROPERTY(isCopyPasteDisabled, ...)` in
 *       RNSecureViewManager.mm
 *     - Android:     `@ReactProp(name = "isCopyPasteDisabled")` in SecureViewManager.kt
 *
 *   The JS prop name exposed to consumers via <SecureView> is `isCopyPasteDisabled`
 *   (see SecureView.tsx), which maps to `isCopyPasteDisabled` on the native spec.
 *   This separation of concerns means the public JS API can have a different
 *   (friendlier) name from the internal native prop.
 *
 * ── FILE LOCATION ─────────────────────────────────────────────────────────────
 *   This file must be at: src/specs/RNSecureViewNativeComponent.ts
 *   The `jsSrcsDir` in codegenConfig must point to the directory containing it.
 */

import type { ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';
import type { HostComponent } from 'react-native';

/**
 * Props for the native RNSecureView component.
 *
 * Extends `ViewProps` to inherit all standard View props (style, testID,
 * accessibility props, event handlers, etc.).
 *
 * Only props listed here will be included in the Fabric codegen output.
 * Do NOT add props that are not backed by a native implementation.
 */
export interface NativeProps extends ViewProps {
  /**
   * When `true`, blocks copy, paste, cut, and text-selection for all
   * UITextField / UITextView (iOS) and TextView / EditText (Android)
   * children recursively.
   *
   * When `false` or omitted, all text interactions are restored to
   * platform defaults.
   *
   * Native implementations:
   *   - iOS Fabric:  Handled in RNSecureViewComponentView.mm via
   *                  `updateProps:oldProps:` and `canPerformAction:withSender:`.
   *   - iOS Paper:   Handled in RNSecureViewManager.mm via
   *                  `RCT_CUSTOM_VIEW_PROPERTY(isCopyPasteDisabled, BOOL, ...)`.
   *   - Android:     Handled in SecureViewManager.kt via
   *                  `@ReactProp(name = "isCopyPasteDisabled")`.
   *
   * @default false (protection off by default at the native level;
   *   SecureView.tsx defaults this to `true` for a safer consumer default)
   */
  isCopyPasteDisabled?: boolean;
}

/**
 * Codegen-registered native component for RNSecureView.
 *
 * Do not use this directly in application code. Import `SecureView` from the
 * library root instead — it provides a friendlier API with `isCopyPasteDisabled`
 * instead of `isCopyPasteDisabled` and handles all prop defaults.
 *
 * The cast to `HostComponent<NativeProps>` is required because
 * `codegenNativeComponent` returns a broader type that does not carry
 * the full HostComponent interface TypeScript needs to render it as JSX.
 */
export default codegenNativeComponent<NativeProps>(
  'RNSecureView'
) as HostComponent<NativeProps>;
