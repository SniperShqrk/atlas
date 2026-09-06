import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.cardPressed }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'success'
      ? colors.success
      : variant === 'secondary'
      ? colors.cardAlt
      : variant === 'danger'
      ? colors.dangerSoft
      : 'transparent';

  const fg =
    variant === 'primary' || variant === 'success'
      ? colors.onAccent
      : variant === 'danger'
      ? colors.danger
      : variant === 'ghost'
      ? colors.accent
      : colors.text;

  const pad = size === 'lg' ? 16 : size === 'sm' ? 8 : 13;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, paddingVertical: pad },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        variant === 'danger' && { borderWidth: 1, borderColor: 'rgba(240,68,56,0.35)' },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.buttonLabel, { color: fg }, size === 'sm' && { fontSize: 13 }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const content = (
    <View
      style={[
        styles.chip,
        active && { backgroundColor: colors.accent, borderColor: colors.accent },
        !!color && !active && { backgroundColor: color + '1F', borderColor: color + '55' },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active && { color: colors.onAccent, fontWeight: '700' },
          !!color && !active && { color },
        ]}
      >
        {label}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export function StatTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.statTile}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Circular "i" button used throughout the exercise lists. */
export function InfoButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      <Icon name="info" size={22} color={colors.textDim} strokeWidth={1.5} />
    </Pressable>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.divider, style]} />;
}

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.emptyState}>
      {icon && <Text style={styles.emptyIcon}>{icon}</Text>}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  card: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: c.text },
  sectionAction: { ...typography.caption, color: c.accent, fontWeight: '600' },
  button: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { ...typography.bodyMedium, fontWeight: '700' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.cardAlt,
  },
  chipText: { ...typography.caption, color: c.textSecondary },
  statTile: { flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { ...typography.stat, color: c.text },
  statUnit: { ...typography.caption, color: c.textDim, marginLeft: 3 },
  statLabel: { ...typography.caption, color: c.textDim, marginTop: 2 },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textDim,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  divider: { height: 1, backgroundColor: c.border },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: c.text, textAlign: 'center' },
  emptySubtitle: {
    ...typography.body,
    color: c.textDim,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 21,
  },
}));
