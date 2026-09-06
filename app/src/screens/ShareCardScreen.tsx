import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, Button, EmptyState } from '@/components/ui';
import { ModalHeader, BottomInset } from '@/components/ScreenLayout';
import { ShareCardView } from '@/components/ShareCardView';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import {
  CARD_FORMATS,
  CardFormat,
  ShareCard,
  availableCards,
  sampleCard,
} from '@/share/cards';
import { shareCard } from '@/share/capture';
import { artworkCredits } from '@/share/artwork';

/**
 * Pick a moment, pick a shape, post it.
 *
 * Cards are only offered when the moment behind them actually happened, so
 * nobody is invited to share an empty week. With no history at all the screen
 * shows the sample card, clearly marked — it demonstrates what the feature
 * produces without ever passing invented numbers off as the user's own.
 */
export default function ShareCardScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();

  const sessions = useWorkoutStore((s) => s.sessions);
  const profile = useWorkoutStore((s) => s.profile);

  const offers = useMemo(
    () => availableCards(sessions, { targetDaysPerWeek: profile.daysPerWeek }),
    [sessions, profile.daysPerWeek]
  );

  // a caller can ask for one specific card, e.g. straight from a new record
  const preferred: ShareCard | undefined = route.params?.card;
  const cards = preferred ? [preferred, ...offers.map((o) => o.card)] : offers.map((o) => o.card);
  const reasons = preferred
    ? ['The moment you just hit', ...offers.map((o) => o.reason)]
    : offers.map((o) => o.reason);

  const empty = cards.length === 0;
  const list = empty ? [sampleCard()] : cards;

  const [index, setIndex] = useState(0);
  const [format, setFormat] = useState<CardFormat>('portrait');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  const card = list[Math.min(index, list.length - 1)];
  const cardWidth = Math.min(screenWidth - spacing.xl * 2, 340);

  const onShare = async () => {
    setBusy(true);
    try {
      await shareCard(cardRef, card, format);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ModalHeader
        title="Share progress"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {empty && (
          <View style={styles.emptyNote}>
            <Text style={styles.emptyText}>
              This is what a card looks like. Log a session and it fills with your own numbers.
            </Text>
          </View>
        )}

        <View style={styles.stage}>
          <ShareCardView ref={cardRef} card={card} format={format} width={cardWidth} />
        </View>

        {list.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {list.map((c, i) => (
              <Pressable
                key={`${c.kind}-${i}`}
                onPress={() => setIndex(i)}
                style={[styles.chip, i === index && styles.chipOn]}
              >
                <Text style={[styles.chipText, i === index && { color: colors.onAccent }]}>
                  {KIND_LABELS[c.kind]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {!!reasons[index] && !empty && (
          <Text style={styles.reason}>{reasons[index]}</Text>
        )}

        <Text style={styles.label}>FORMAT</Text>
        <View style={styles.formats}>
          {(Object.keys(CARD_FORMATS) as CardFormat[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFormat(f)}
              style={[styles.format, f === format && styles.formatOn]}
            >
              <Text style={[styles.formatLabel, f === format && { color: colors.text }]}>
                {CARD_FORMATS[f].label}
              </Text>
              <Text style={styles.formatNote}>{CARD_FORMATS[f].note}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.bronze} />
            </View>
          ) : (
            <Button label="Share" onPress={onShare} size="lg" />
          )}
        </View>

        <Text style={styles.footnote}>
          Cards are generated on your phone from your own logs. Nothing is uploaded.
        </Text>

        <Text style={[styles.label, { marginTop: spacing.xl }]}>ARTWORK</Text>
        <View style={styles.credits}>
          {artworkCredits().map((a) => (
            <Text key={a.shortName} style={styles.credit}>
              <Text style={{ color: colors.textSecondary }}>{a.shortName}</Text>
              {`  ${a.culture}, ${a.date} · ${a.credit}`}
            </Text>
          ))}
        </View>

        <BottomInset />
      </ScrollView>
    </Screen>
  );
}

const KIND_LABELS: Record<ShareCard['kind'], string> = {
  pr: 'Record',
  session: 'Session',
  week: 'Week',
  balance: 'Balance',
  streak: 'Streak',
};

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  stage: { alignItems: 'center', marginTop: spacing.md },
  emptyNote: { marginBottom: spacing.lg },
  emptyText: { ...typography.caption, color: c.textDim, lineHeight: 19, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.lg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipOn: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { ...typography.caption, color: c.textSecondary, fontWeight: '600' },
  reason: { ...typography.caption, color: c.textFaint, marginBottom: spacing.lg },
  label: { ...typography.micro, color: c.textDim, marginTop: spacing.sm },
  formats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  format: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  formatOn: { borderColor: c.bronze, backgroundColor: c.cardAlt },
  formatLabel: { ...typography.captionBold, color: c.textSecondary },
  formatNote: { ...typography.caption, color: c.textFaint, fontSize: 11, marginTop: 2 },
  busy: { paddingVertical: 18, alignItems: 'center' },
  credits: { marginTop: spacing.sm, gap: 6 },
  credit: { ...typography.caption, color: c.textFaint, fontSize: 11.5, lineHeight: 16 },
  footnote: {
    ...typography.caption,
    color: c.textFaint,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
}));
