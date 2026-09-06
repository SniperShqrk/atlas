import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Button } from '@/components/ui';
import { TopInset, BottomInset } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { InsightCard } from '@/components/Insights';
import { ShareCardView } from '@/components/ShareCardView';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, UserProfile } from '@/store/workoutStore';
import { useOnboarding } from '@/store/onboarding';
import { sampleInsight } from '@/store/insights';
import { sampleCard } from '@/share/cards';

/**
 * First run.
 *
 * Four steps, and only one of them asks for anything. The middle two exist
 * because of a specific finding: subscription purchases cluster hard on day
 * zero, but ATLAS has nothing true to say on day zero, since it reads your
 * logs and there are none. The resolution is to demonstrate rather than
 * describe — a real insight and a real card, built from example numbers and
 * labelled as examples, so a new user can see the actual output before
 * deciding. A feature list would not do that.
 */

type Step = 'welcome' | 'about' | 'proof' | 'offer';
const ORDER: Step[] = ['welcome', 'about', 'proof', 'offer'];

const GOALS: { value: UserProfile['goal']; label: string; note: string }[] = [
  { value: 'build_muscle', label: 'Build muscle', note: 'Hypertrophy rep ranges, volume-led' },
  { value: 'strength', label: 'Get stronger', note: 'Lower reps, heavier top sets' },
  { value: 'lose_fat', label: 'Lose fat', note: 'Higher reps, keep the strength you have' },
  { value: 'general_fitness', label: 'General fitness', note: 'Balanced, sustainable' },
];

const EQUIPMENT: { value: UserProfile['equipmentAccess']; label: string }[] = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'home_dumbbells', label: 'Dumbbells at home' },
  { value: 'bodyweight_only', label: 'Bodyweight only' },
];

const UNITS: { value: UserProfile['unit']; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

  const profile = useWorkoutStore((s) => s.profile);
  const setProfile = useWorkoutStore((s) => s.setProfile);
  const begin = useOnboarding((s) => s.begin);
  const complete = useOnboarding((s) => s.complete);

  const [stepIndex, setStepIndex] = useState(0);
  const step = ORDER[stepIndex];

  React.useEffect(begin, [begin]);

  const next = () => setStepIndex((i) => Math.min(i + 1, ORDER.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  const finish = () => {
    complete();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  const toOffer = () => {
    complete();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    navigation.navigate('Paywall', { feature: 'atlas_insights', source: 'onboarding' });
  };

  return (
    <Screen>
      <TopInset extra={spacing.md} />

      <View style={styles.progress}>
        {ORDER.map((s, i) => (
          <View
            key={s}
            style={[
              styles.pip,
              { backgroundColor: i <= stepIndex ? colors.bronze : colors.border },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'welcome' && (
          <View style={styles.welcome}>
            <Text style={styles.wordmark}>
              ATL<Text style={{ color: colors.bronze }}>A</Text>S
            </Text>
            <Text style={styles.tagline}>
              A training log that tells you what your training is actually doing.
            </Text>
            <View style={styles.bullets}>
              {[
                'Log every session. No caps, no limits, free forever.',
                'A recovery map of what is ready to train today.',
                'And a read on what your programme is quietly getting wrong.',
              ].map((line) => (
                <View key={line} style={styles.bullet}>
                  <Icon name="check" size={16} color={colors.bronze} strokeWidth={2.2} />
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {step === 'about' && (
          <View>
            <Text style={styles.stepTitle}>What are you training for?</Text>
            <Text style={styles.stepNote}>
              This sets your rep ranges and shapes the plan. You can change it any time.
            </Text>

            <View style={styles.options}>
              {GOALS.map((g) => {
                const on = profile.goal === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => setProfile({ goal: g.value })}
                    style={[styles.option, on && { borderColor: colors.bronze }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>{g.label}</Text>
                      <Text style={styles.optionNote}>{g.note}</Text>
                    </View>
                    {on && <Icon name="check" size={18} color={colors.bronze} strokeWidth={2.2} />}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>DAYS PER WEEK</Text>
            <View style={styles.row}>
              {[2, 3, 4, 5, 6].map((d) => {
                const on = profile.daysPerWeek === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setProfile({ daysPerWeek: d })}
                    style={[styles.pill, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  >
                    <Text style={[styles.pillText, on && { color: colors.onAccent }]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>EQUIPMENT</Text>
            <View style={[styles.row, styles.equipmentRow]}>
              {EQUIPMENT.map((e) => {
                const on = profile.equipmentAccess === e.value;
                return (
                  <Pressable
                    key={e.value}
                    onPress={() => setProfile({ equipmentAccess: e.value })}
                    style={[
                      styles.pill,
                      on && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[styles.pillText, on && { color: colors.onAccent }]}>
                      {e.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>UNITS</Text>
            <View style={styles.row}>
              {UNITS.map((u) => {
                const on = profile.unit === u.value;
                return (
                  <Pressable
                    key={u.value}
                    onPress={() => setProfile({ unit: u.value })}
                    style={[
                      styles.pill,
                      { flex: 1 },
                      on && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[styles.pillText, on && { color: colors.onAccent }]}>
                      {u.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 'proof' && (
          <View>
            <Text style={styles.stepTitle}>What ATLAS will tell you</Text>
            <Text style={styles.stepNote}>
              After about three logged sessions, ATLAS starts reading your training. This is a
              real insight, built from example numbers — yours will be about your lifts.
            </Text>

            <View style={{ marginTop: spacing.lg }}>
              <View style={styles.exampleTag}>
                <Text style={styles.exampleTagText}>EXAMPLE</Text>
              </View>
              <InsightCard insight={sampleInsight()} unlocked onUnlock={() => {}} />
            </View>

            <Text style={[styles.label, { marginTop: spacing.xl }]}>AND WHAT YOU CAN POST</Text>
            <View style={styles.cardStage}>
              <ShareCardView
                card={sampleCard()}
                format="portrait"
                width={Math.min(width - spacing.xl * 2, 260)}
              />
            </View>
          </View>
        )}

        {step === 'offer' && (
          <View>
            <Text style={styles.stepTitle}>Everything you need to train is free</Text>
            <Text style={styles.stepNote}>
              Unlimited logging, the full exercise library, your history, the recovery map and
              progression suggestions. No session caps, ever.
            </Text>

            <View style={styles.offerCard}>
              <View style={styles.offerHead}>
                <Icon name="sparkle" size={18} color={colors.bronze} strokeWidth={1.5} />
                <Text style={styles.offerTitle}>Premium adds the thinking</Text>
              </View>
              {[
                'The full diagnosis behind every insight, and what to change',
                'AI workout plans built around your recovery and equipment',
                'Strength trends, weekly volume against growth targets',
              ].map((line) => (
                <View key={line} style={styles.bullet}>
                  <Icon name="check" size={15} color={colors.bronze} strokeWidth={2.2} />
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
              <Text style={styles.trial}>Monthly, yearly or one-off. Cancel any time.</Text>
            </View>

            <Text style={styles.honest}>
              Worth knowing: ATLAS gets more useful the more you log. If you would rather see it
              work on your own numbers first, start free — the offer is in Settings whenever you
              want it.
            </Text>
          </View>
        )}

        <BottomInset extra={spacing.xxl} />
      </ScrollView>

      <View style={styles.footer}>
        {step === 'offer' ? (
          <>
            <Button label="See Premium" onPress={toOffer} size="lg" />
            <Pressable onPress={finish} style={styles.skip} hitSlop={8}>
              <Text style={styles.skipText}>Continue with the free tier</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Button
              label={step === 'welcome' ? 'Get started' : 'Continue'}
              onPress={next}
              size="lg"
            />
            <Pressable
              onPress={stepIndex === 0 ? finish : back}
              style={styles.skip}
              hitSlop={8}
            >
              <Text style={styles.skipText}>{stepIndex === 0 ? 'Skip' : 'Back'}</Text>
            </Pressable>
          </>
        )}
        <BottomInset extra={spacing.sm} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  pip: { flex: 1, height: 3, borderRadius: 2 },
  content: { paddingHorizontal: spacing.xl },

  welcome: { paddingTop: spacing.xxl },
  wordmark: { fontSize: 40, fontWeight: '700', letterSpacing: 12, color: c.text },
  tagline: {
    ...typography.h2,
    color: c.textSecondary,
    marginTop: spacing.xl,
    lineHeight: 28,
    fontWeight: '400',
  },
  bullets: { marginTop: spacing.xxl, gap: spacing.md },
  bullet: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginTop: spacing.sm },
  bulletText: { ...typography.body, color: c.textSecondary, flex: 1, lineHeight: 22 },

  stepTitle: { ...typography.hero, color: c.text, fontSize: 28, lineHeight: 34 },
  stepNote: { ...typography.body, color: c.textDim, marginTop: spacing.md, lineHeight: 22 },
  label: { ...typography.micro, color: c.textDim, marginTop: spacing.xl },

  options: { marginTop: spacing.lg, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  optionLabel: { ...typography.h3, color: c.text },
  optionNote: { ...typography.caption, color: c.textDim, marginTop: 3 },

  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  equipmentRow: { flexWrap: 'wrap' },
  pill: {
    minWidth: 48,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  pillText: { ...typography.captionBold, color: c.textSecondary },

  exampleTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: c.bronze,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  exampleTagText: { ...typography.micro, color: c.bronze, fontSize: 9 },
  cardStage: { alignItems: 'center', marginTop: spacing.md },

  offerCard: {
    marginTop: spacing.xl,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.32)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerTitle: { ...typography.h3, color: c.text },
  trial: {
    ...typography.caption,
    color: c.bronze,
    marginTop: spacing.lg,
    fontWeight: '700',
  },

  honest: {
    ...typography.caption,
    color: c.textFaint,
    lineHeight: 19,
    marginTop: spacing.lg,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bg,
  },
  skip: { alignSelf: 'center', paddingVertical: spacing.md },
  skipText: { ...typography.caption, color: c.textDim, fontWeight: '600' },
}));
