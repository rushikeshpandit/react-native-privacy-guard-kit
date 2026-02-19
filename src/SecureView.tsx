// SecureView.tsx
import { type ReactNode } from 'react';
import { StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import RNSecureViewSpec from './specs/RNSecureViewNativeComponent';

type SecureViewProps = {
  disableCopyPaste?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function SecureView({
  disableCopyPaste = true,
  style,
  children,
}: SecureViewProps) {
  return (
    <RNSecureViewSpec
      isCopyPasteDisabled={disableCopyPaste}
      style={[styles.container, style]}
    >
      {children}
    </RNSecureViewSpec>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
