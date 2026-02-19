// RNSecureViewComponentView.mm
// Fabric ComponentView for RNSecureView.
//
// RN 0.76+ uses RCTAppDependencyProvider (generated in the example app
// during pod install) instead of RCTThirdPartyFabricComponentsProvider.
// That generated file calls NSClassFromString("RNSecureViewComponentView")
// to get our class — so the class name MUST match exactly.
//
// The codegenConfig.ios.componentProvider in package.json tells the
// code generator: "RNSecureView" → "RNSecureViewComponentView"

#ifdef RCT_NEW_ARCH_ENABLED

#import "RNSecureViewComponentView.h"

#import <react/renderer/components/PrivacyGuardKitViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/PrivacyGuardKitViewSpec/Props.h>
#import <react/renderer/components/PrivacyGuardKitViewSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface RNSecureViewComponentView () <RCTRNSecureViewViewProtocol>
@end

@implementation RNSecureViewComponentView

- (instancetype)initWithFrame:(CGRect)frame {
    if (self = [super initWithFrame:frame]) {
        self.backgroundColor = UIColor.clearColor;
    }
    return self;
}

- (void)updateProps:(const Props::Shared &)props
           oldProps:(const Props::Shared &)oldProps {
    const auto &newProps =
        *std::static_pointer_cast<const RNSecureViewProps>(props);
    if (newProps.isCopyPasteDisabled) {
        [self disableCopyPasteIn:self];
    } else {
        [self enableCopyPasteIn:self];
    }
    [super updateProps:props oldProps:oldProps];
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
    return concreteComponentDescriptorProvider<RNSecureViewComponentDescriptor>();
}

- (BOOL)canPerformAction:(SEL)action withSender:(id)sender {
    if (_props) {
        const auto &p = *std::static_pointer_cast<const RNSecureViewProps>(_props);
        if (p.isCopyPasteDisabled) return NO;
    }
    return [super canPerformAction:action withSender:sender];
}

- (void)disableCopyPasteIn:(UIView *)v {
    for (UIView *sub in v.subviews) {
        if ([sub isKindOfClass:UITextField.class])
            ((UITextField *)sub).userInteractionEnabled = NO;
        if ([sub isKindOfClass:UITextView.class]) {
            ((UITextView *)sub).selectable = NO;
            ((UITextView *)sub).editable = NO;
        }
        [self disableCopyPasteIn:sub];
    }
}

- (void)enableCopyPasteIn:(UIView *)v {
    for (UIView *sub in v.subviews) {
        if ([sub isKindOfClass:UITextField.class])
            ((UITextField *)sub).userInteractionEnabled = YES;
        if ([sub isKindOfClass:UITextView.class]) {
            ((UITextView *)sub).selectable = YES;
            ((UITextView *)sub).editable = YES;
        }
        [self enableCopyPasteIn:sub];
    }
}

@end

#endif // RCT_NEW_ARCH_ENABLED
