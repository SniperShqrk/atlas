import React from 'react';
import { View, Text } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Quote } from '@/data/quotes';

/**
 * A quote line, always with a thin bronze rule rather than quotation marks —
 * quotation marks read as decoration once you've seen the third one; the
 * rule reads as a citation, closer to the marble/inscription aesthetic than
 * a chat bubble would.
 *
 * `inline` sits flush inside whatever surface holds it (the Home screen).
 * `card` is self-contained with its own background and border for spots
 * with no other framing (the empty workout state, the rest timer).
 */
export function StoicQuote({
  quote,
  variant = 'inline',
  compact = false,
}: {
  quote: Quote;
  variant?: 'inline' | 'card';
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.wrap, variant === 'card' && styles.card]}>
      <View style={[styles.rule, { backgroundColor: colors.bronze }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.text, compact && styles.textCompact]}>{quote.text}</Text>
        <Text style={styles.attribution}>
          {quote.author.toUpperCase()} · {quote.source}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  rule: { width: 2, borderRadius: 1, alignSelf: 'stretch' },
  text: {
    ...typography.body,
    color: c.textSecondary,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  textCompact: { fontSize: 13, lineHeight: 18 },
  attribution: {
    ...typography.micro,
    color: c.bronze,
    marginTop: spacing.sm,
  },
}));
