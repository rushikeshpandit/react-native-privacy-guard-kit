/**
 * @format
 */

// RN 0.73+ exports codegenNativeComponent from the top-level package.
// Deep imports like 'react-native/Libraries/Utilities/codegenNativeComponent'
// are deprecated and broken in RN 0.83. Use the top-level export instead.

import type { ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';
import type { HostComponent } from 'react-native';

export interface NativeProps extends ViewProps {
  isCopyPasteDisabled?: boolean;
}

export default codegenNativeComponent<NativeProps>(
  'RNSecureView'
) as HostComponent<NativeProps>;
