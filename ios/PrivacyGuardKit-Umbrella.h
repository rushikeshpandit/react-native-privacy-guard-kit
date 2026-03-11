// PrivacyGuardKit-Umbrella.h
//
// Public umbrella header for the PrivacyGuardKit CocoaPod framework.
//
// PURPOSE:
//   CocoaPods generates a module map that imports this file, which is how
//   Swift source files in the pod see Objective-C symbols without needing
//   an explicit bridging header.
//
// STRICT RULES — DO NOT VIOLATE:
//   1. Only import headers that are pure Objective-C (no C++, no Fabric/JSI).
//      Any C++ header here will break every Swift file that imports the module.
//   2. Do NOT import RNSecureViewComponentView.h — it is guarded by
//      #ifdef RCT_NEW_ARCH_ENABLED and pulls in C++ Fabric headers.
//   3. The file name MUST be "<PodName>-Umbrella.h" OR it must appear in
//      `s.public_header_files` inside your podspec. CocoaPods looks for this
//      name automatically when generating the module map.
//
// IMPORT ORDER:
//   React headers first (they define RCTBridgeModule, RCTEventEmitter, etc.),
//   then any additional public Objective-C headers from this pod.

#import <React/RCTBridgeModule.h>   // RCTBridgeModule, RCT_EXTERN_MODULE, RCT_EXTERN_METHOD
#import <React/RCTEventEmitter.h>   // RCTEventEmitter — base class for PrivacyGuardKit.swift
#import <React/RCTViewManager.h>    // RCTViewManager  — base class for RNSecureViewManager
#import <React/RCTConvert.h>        // RCTConvert      — used in RNSecureViewManager for prop conversion
