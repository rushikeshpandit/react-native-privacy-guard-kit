// RNSecureViewManager.mm
// Must be .mm not .m — RCT macros expand to ObjC++ in some RN versions.

#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>
#import <UIKit/UIKit.h>

// ─────────────────────────────────────────────────────────────
// SecureView — a UIView that blocks copy/paste at the ObjC level.
// Used by the Paper (Old Architecture) path only.
// Fabric uses RNSecureViewComponentView.mm instead.
// ─────────────────────────────────────────────────────────────

@interface RNSecureUIView : UIView
@property (nonatomic, assign) BOOL isCopyPasteDisabled;
@end

@implementation RNSecureUIView

- (BOOL)canPerformAction:(SEL)action withSender:(id)sender {
    if (self.isCopyPasteDisabled) {
        return NO;
    }
    return [super canPerformAction:action withSender:sender];
}

@end

// ─────────────────────────────────────────────────────────────
// ViewManager — exposes RNSecureUIView to the Paper bridge
// ─────────────────────────────────────────────────────────────

@interface RNSecureViewManager : RCTViewManager
@end

@implementation RNSecureViewManager

RCT_EXPORT_MODULE(RNSecureView)

- (UIView *)view {
    return [RNSecureUIView new];
}

RCT_CUSTOM_VIEW_PROPERTY(isCopyPasteDisabled, BOOL, RNSecureUIView) {
    view.isCopyPasteDisabled = json ? [RCTConvert BOOL:json] : defaultView.isCopyPasteDisabled;
}

@end