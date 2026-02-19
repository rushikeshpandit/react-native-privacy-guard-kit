import { NativeModules, NativeEventEmitter } from 'react-native';

const { PrivacyGuardKit } = NativeModules;

if (!PrivacyGuardKit) {
  throw new Error(
    '[react-native-privacy-guard-kit] Native module not found. ' +
      'Make sure you have linked the library and rebuilt the app.'
  );
}

export const NativePrivacyGuardKit = PrivacyGuardKit;
export const PrivacyGuardKitEmitter = new NativeEventEmitter(PrivacyGuardKit);
