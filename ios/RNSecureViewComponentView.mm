// RNSecureViewComponentView.mm
//
// Fabric (New Architecture) ComponentView for RNSecureView.
//
// ── ARCHITECTURE ──────────────────────────────────────────────────────────────
//   Used exclusively by the New Architecture (Fabric / RCT_NEW_ARCH_ENABLED).
//   Old Architecture (Paper) uses RNSecureViewManager.mm instead.
//
//   The Fabric renderer calls:
//     • initWithFrame:        — on component mount
//     • updateProps:oldProps: — on any prop change (including first render)
//     • componentDescriptorProvider — for the Fabric type system
//
// ── COPY/PASTE BLOCKING STRATEGY ─────────────────────────────────────────────
//   Two complementary layers:
//
//   1. canPerformAction:withSender: (UIResponder override on this view)
//      Returns NO for all actions when isCopyPasteDisabled, preventing the
//      context menu from appearing for touches within this view's bounds.
//
//   2. Recursive subview traversal (disableCopyPasteIn: / enableCopyPasteIn:)
//      Walks all UITextField and UITextView descendants:
//        • UITextField: userInteractionEnabled = NO
//        • UITextView:  selectable = NO, editable = NO
//
// ── SIMULATOR BEHAVIOUR ───────────────────────────────────────────────────────
//   Works identically on the iOS Simulator. Long-press context menus are
//   suppressed on the Simulator as on a real device.
//
// ── iOS VERSION SUPPORT ───────────────────────────────────────────────────────
//   iOS 13+ — RCTViewComponentView requires iOS 13+.

#ifdef RCT_NEW_ARCH_ENABLED

#import "RNSecureViewComponentView.h"

#import <react/renderer/components/PrivacyGuardKitViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/PrivacyGuardKitViewSpec/Props.h>
#import <react/renderer/components/PrivacyGuardKitViewSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface RNSecureViewComponentView () <RCTRNSecureViewViewProtocol>
@end

@implementation RNSecureViewComponentView

// MARK: - Initialization

/**
 * Initialises the view with a frame.
 *
 * Sets a transparent background — this is a container view and should not
 * draw anything itself.
 */
- (instancetype)initWithFrame:(CGRect)frame {
    if (self = [super initWithFrame:frame]) {
        self.backgroundColor = UIColor.clearColor;
    }
    return self;
}

// MARK: - Prop Updates

/**
 * Called by the Fabric renderer whenever any prop changes.
 *
 * ── ORDERING ─────────────────────────────────────────────────────────────────
 *   Apply custom prop logic BEFORE calling [super updateProps:oldProps:] so
 *   our traversal runs while the props struct is still the "new" one we just
 *   received, then super stores it as _props for future canPerformAction: reads.
 */
- (void)updateProps:(const Props::Shared &)props
           oldProps:(const Props::Shared &)oldProps {
    const auto &newProps = *std::static_pointer_cast<const RNSecureViewProps>(props);

    // Guard: oldProps is nullptr on first mount — treat prev as default (false).
    const bool prevDisabled = oldProps
        ? std::static_pointer_cast<const RNSecureViewProps>(oldProps)->isCopyPasteDisabled
        : false;

    if (newProps.isCopyPasteDisabled != prevDisabled) {
        if (newProps.isCopyPasteDisabled) {
            [self disableCopyPasteIn:self];
        } else {
            [self enableCopyPasteIn:self];
        }
    }

    [super updateProps:props oldProps:oldProps];
}

// MARK: - didMoveToWindow

/**
 * Re-applies the current copy/paste protection state after the view has been
 * fully inserted into the window hierarchy.
 *
 * Fabric's deferred commit pipeline can call updateProps:oldProps: before
 * all child views are mounted (especially for deeply nested trees). By re-running
 * the traversal here — after all children are present — we ensure every
 * UITextField and UITextView descendant is covered, even those mounted late.
 *
 * Only acts when the view is entering a window (window != nil).
 * Does nothing on removal (window == nil).
 */
- (void)didMoveToWindow {
    [super didMoveToWindow];

    if (self.window == nil) return; // View is being removed — no action needed.

    // Re-apply the current protection state (as recorded in _props) to cover
    // any children that were not yet present when updateProps:oldProps: ran.
    if (_props) {
        const auto &p = *std::static_pointer_cast<const RNSecureViewProps>(_props);
        if (p.isCopyPasteDisabled) {
            [self disableCopyPasteIn:self];
        } else {
            [self enableCopyPasteIn:self];
        }
    }
}

// MARK: - Fabric Component Descriptor

/**
 * Returns the Fabric component descriptor for this view.
 */
+ (ComponentDescriptorProvider)componentDescriptorProvider {
    return concreteComponentDescriptorProvider<RNSecureViewComponentDescriptor>();
}

// MARK: - Copy/Paste Blocking (UIResponder)

/**
 * Intercepts UIKit's action-availability query at the view level.
 *
 * Returns NO for all actions when isCopyPasteDisabled, preventing the
 * context menu from appearing. Delegates to super otherwise.
 *
 * _props is the C++ Props::Shared owned by RCTViewComponentView. It is
 * non-null after initWithFrame: and always updated before user interaction.
 */
- (BOOL)canPerformAction:(SEL)action withSender:(id)sender {
    if (_props) {
        const auto &p = *std::static_pointer_cast<const RNSecureViewProps>(_props);
        if (p.isCopyPasteDisabled) {
            return NO;
        }
    }
    return [super canPerformAction:action withSender:sender];
}

// MARK: - Recursive Subview Traversal

/**
 * Recursively disables copy/paste on all UITextField and UITextView descendants.
 *
 * UITextField: sets userInteractionEnabled = NO (prevents all interaction).
 * UITextView:  sets selectable = NO then editable = NO. Order matters —
 *              selectable must be cleared before editable on some iOS versions.
 *
 * @param v The root view to traverse.
 */
- (void)disableCopyPasteIn:(UIView *)v {
    for (UIView *sub in v.subviews) {
        if ([sub isKindOfClass:[UITextField class]]) {
            ((UITextField *)sub).userInteractionEnabled = NO;
        } else if ([sub isKindOfClass:[UITextView class]]) {
            // NOTE: Order matters!
            UITextView *tv = (UITextView *)sub;
            tv.selectable = NO;
            tv.editable   = NO;
        }
        [self disableCopyPasteIn:sub];
    }
}

/**
 * Recursively re-enables copy/paste on all UITextField and UITextView descendants.
 *
 * Mirrors disableCopyPasteIn: exactly, restoring UIKit defaults.
 *
 * NOTE: Restores UITextView.selectable and UITextView.editable to YES.
 * If the host app set these to NO independently, they will be overwritten.
 *
 * @param v The root view to traverse.
 */
- (void)enableCopyPasteIn:(UIView *)v {
    for (UIView *sub in v.subviews) {
        if ([sub isKindOfClass:[UITextField class]]) {
            ((UITextField *)sub).userInteractionEnabled = YES;
        } else if ([sub isKindOfClass:[UITextView class]]) {
            UITextView *tv = (UITextView *)sub;
            tv.editable   = YES;
            tv.selectable = YES;
        }
        [self enableCopyPasteIn:sub];
    }
}

@end

#endif // RCT_NEW_ARCH_ENABLED
