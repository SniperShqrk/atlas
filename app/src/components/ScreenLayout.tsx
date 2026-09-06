import React from 'react';
import { View, Text, StyleSheet, ViewStyle, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';

/**
 * Every screen renders through here so the notch, Dynamic Island and home
 * indicator are handled in one place rather than per screen.
 *
 * The top inset is the real device inset plus a small breathing gap, so a big
 * title never sits tight under the Dynamic Island. The bottom inset is only
 * applied on screens without the tab bar — the tab bar adds its own.
 */
export function ScreenLayout({
  children,
  scroll = true,
  hasTabBar = true,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  hasTabBar?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + spacing.sm;
  const paddingBottom = hasTabBar ? spacing.xl : insets.bottom + spacing.xl;

  if (!scroll) {
    return <View style={[styles.screen, { paddingTop }, style]}>{children}</View>;
  }

  return (
    <View style={[styles.screen, style]}>
      <ScrollView
        contentContainerStyle={[
          { paddingTop, paddingBottom, paddingHorizontal: spacing.lg },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Just the top inset, for screens that manage their own scrolling. */
export function TopInset({ extra = spacing.sm }: { extra?: number }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top + extra }} />;
}

/** Bottom inset for sticky footers that sit above the home indicator. */
export function BottomInset({ extra = 0 }: { extra?: number }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom + extra }} />;
}

/** Modal header with a back affordance, inset-aware. */
export function ModalHeader({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backRow}>
        <Icon name="back" size={20} color={colors.accent} strokeWidth={1.9} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      {title ? (
        <Text style={styles.modalTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { ...typography.bodyMedium, color: c.accent },
  modalTitle: { ...typography.h3, color: c.text, flex: 1, textAlign: 'center' },
  headerRight: { minWidth: 60, alignItems: 'flex-end' },
}));
