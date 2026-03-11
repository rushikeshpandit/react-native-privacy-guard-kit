// PrivacyGuardKit.m
//
// Objective-C bridge file for the PrivacyGuardKit Swift module.
//
// PURPOSE:
//   React Native's bridge cannot directly discover Swift methods. This file
//   uses RCT_EXTERN_MODULE / RCT_EXTERN_METHOD macros to declare the Swift
//   class and its methods so the ObjC runtime and the RN bridge can find them.
//   At link time, the bridge connects these declarations to the Swift
//   implementations in PrivacyGuardKit.swift.
//
// STRICT RULES:
//   • Keep this file as .m (not .mm). It must be pure Objective-C.
//   • RCT_EXTERN_MODULE and RCT_EXTERN_METHOD must be inside an @interface block.
//   • The class name "PrivacyGuardKit" and every method label MUST exactly match
//     the @objc annotations in PrivacyGuardKit.swift. A mismatch causes a
//     silent runtime crash (method not found).
//   • Compatible with both Old Architecture (Paper) and New Architecture (Fabric).
//
// iOS COMPATIBILITY: iOS 13.0+

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(PrivacyGuardKit, RCTEventEmitter)

// ── Screen Capture ────────────────────────────────────────────────────────────

RCT_EXTERN_METHOD(disableScreenCapture:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(enableScreenCapture:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isScreenCaptureDisabled:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ── Screen Recording Detection ────────────────────────────────────────────────

RCT_EXTERN_METHOD(isScreenBeingRecorded:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ── Screenshot & Recording Event Listeners ────────────────────────────────────

RCT_EXTERN_METHOD(startScreenshotListener:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopScreenshotListener:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ── App-Switcher Protection ───────────────────────────────────────────────────

RCT_EXTERN_METHOD(enableAppSwitcherProtection:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(disableAppSwitcherProtection:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ── Clipboard ─────────────────────────────────────────────────────────────────

RCT_EXTERN_METHOD(clearClipboard:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
