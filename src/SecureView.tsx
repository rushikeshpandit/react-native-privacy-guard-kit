/**
 * SecureView.tsx
 *
 * A cross-platform React Native component that blocks copy/paste and text
 * selection for all text child components at the native level.
 *
 * ── PROP NAME CONTRACT ────────────────────────────────────────────────────────
 *   The JS prop exposed to consumers is `disableCopyPaste` (SecureViewProps).
 *   Internally it maps to the native prop `isCopyPasteDisabled`, which is the
 *   name registered on ALL native platforms:
 *
 *     iOS Paper:   RCT_CUSTOM_VIEW_PROPERTY(isCopyPasteDisabled, ...)  ✓
 *     iOS Fabric:  newProps.isCopyPasteDisabled                         ✓
 *     Android:     @ReactProp(name = "isCopyPasteDisabled", ...)        ✓
 *
 */

import React, { forwardRef } from 'react';
import { StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import RNSecureViewSpec from './specs/RNSecureViewNativeComponent';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface SecureViewProps {
  /**
   * Whether to block copy, paste, cut, and text-selection interactions.
   *
   * When `true` (default), the native layer:
   *   - Android: Disables long-click + selection on all TextView/EditText children.
   *   - iOS Fabric: Sets `selectable = NO` / `editable = NO` on UITextView
   *     children; blocks `canPerformAction:withSender:` at the container level.
   *   - iOS Paper: Blocks `canPerformAction:withSender:` at the container level.
   *
   * When `false`, all text interactions are restored to platform defaults.
   *
   * @default true
   */
  disableCopyPaste?: boolean;

  /**
   * Style for the native container view.
   *
   * When omitted, defaults to `{ flex: 1 }` so the SecureView fills its parent.
   * Provide an explicit `style` to override layout.
   */
  style?: StyleProp<ViewStyle>;

  /** Child components to render inside the secure container. */
  children?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SecureView — blocks copy/paste for all text children at the native level.
 *
 * Supports `ref` forwarding to the underlying native view for imperative access.
 *
 * @see SecureViewProps for all available props.
 *
 * @example
 * <SecureView disableCopyPaste style={{ flex: 1 }}>
 *   <Text>Protected content</Text>
 * </SecureView>
 */
export const SecureView = forwardRef<
  React.ElementRef<typeof RNSecureViewSpec>,
  SecureViewProps
>(({ disableCopyPaste = true, style, children }, ref) => {
  return (
    <RNSecureViewSpec
      ref={ref}
      isCopyPasteDisabled={disableCopyPaste}
      // Only wrap in array when consumer provides a style, avoiding
      // unnecessary array allocations when style is omitted.
      style={style !== undefined ? [styles.container, style] : styles.container}
    >
      {children}
    </RNSecureViewSpec>
  );
});

SecureView.displayName = 'SecureView';

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
