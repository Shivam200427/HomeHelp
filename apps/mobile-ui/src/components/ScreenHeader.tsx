import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme';

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: ViewStyle;
}

export function ScreenHeader({ title, subtitle, right, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  left: { flex: 1 },
  title: { fontFamily: 'Newsreader', fontSize: 28, fontWeight: '700', color: '#1A2C2B', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
});