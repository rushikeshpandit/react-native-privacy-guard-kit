// PrivacyGuardKit-Umbrella.h
// Public umbrella header for the PrivacyGuardKit framework.
// CocoaPods generates a module map that imports this file,
// which is how Swift sees ObjC symbols — no bridging header needed.
//
// RULES:
//  - Only list headers that are safe for Swift to import
//  - Do NOT include C++ or Fabric headers here (they break Swift)
//  - The file name must be: <PodName>-Umbrella.h  OR listed in s.public_header_files

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTViewManager.h>

