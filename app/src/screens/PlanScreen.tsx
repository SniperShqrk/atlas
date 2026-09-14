import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, Button, SectionHeader, Chip } from '@/components/ui';
import { ScreenLayout } from '@/components/ScreenLayout';
import { ProBadge } from '@/components/Pro';
import { Icon } from '@/components/Icon';
import { spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { useEntitlements } from '@/store/entitlements';
import { generatePlan } from '@/api/client';
import { haptics } from '@/lib/haptics';

const PROGRAM_SOURCE_LABEL: Record<string, string> = {
  ai: 'AI generated',
  imported: 'Imported',
  preset: 'Program',
  rule_based: 'Offline generator',
  manual: 'Built by you',
};

/** "Auto" (null) lets the backend pick a focus from recovery data rather
 *  than always defaulting to Push. */
const DAY_FOCUS_OPTIONS: (string | null)[] = [
  null, 'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body',
];

/**
 * The Plan tab is a chooser, nothing else — it always renders the same
 * "how do you want to train" options whether or not a plan is currently
 * open. Opening a plan (or building/generating a new one) pushes
 * PlanDetailScreen, which is where all day-by-day editing now lives. This
 * is the fix for "I selected into some custom plan and it shows day 1,2,3
 * and I can't exit" — that whole block used to render right here, in place
 * of everything below.
 */
export default function PlanScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const profile = useWorkoutStore((s) => s.profile);
  const sessions = useWorkoutStore((s) => s.sessions);
  const currentPlan = useWorkoutStore((s) => s.currentPlan);
  const setCurrentPlan = useWorkoutStore((s) => s.setCurrentPlan);
  const savedPlans = useWorkoutStore((s) => s.savedPlans);
  const loadSavedPlan = useWorkoutStore((s) => s.loadSavedPlan);
  const deleteSavedPlan = useWorkoutStore((s) => s.deleteSavedPlan);
  const startSession = useWorkoutStore((s) => s.startSession);
  const createBlankPlan = useWorkoutStore((s) => s.createBlankPlan);
  const isPro = useEntitlements((s) => s.isPro);
  const recordPaywallView = useEntitlements((s) => s.recordPaywallView);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planScope, setPlanScope] = useState<'week' | 'day'>('week');
  const [dayFocus, setDayFocus] = useState<string | null>(null);
  // The AI settings (scope + day focus) used to be a permanently-open card
  // regardless of whether anyone was about to generate anything. Now it's
  // tucked behind the AI Planner card itself.
  const [showAiSettings, setShowAiSettings] = useState(false);

  const currentPlanExerciseCount = currentPlan
    ? currentPlan.days.reduce((sum, d) => sum + d.exercises.length, 0)
    : 0;

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
      const plan = await generatePlan(profile, recent, {
        scope: planScope,
        focus: planScope === 'day' ? dayFocus : undefined,
      });
      setCurrentPlan(plan);
      setShowAiSettings(false);
      // A brand-new plan has nothing to look at yet in view mode — land
      // straight in the builder rather than making someone find and tap
      // "Edit Plan" first to discover it exists.
      navigation.navigate('PlanDetail', { editing: true });
    } catch {
      setError('Could not reach the planner. Check the backend is running and reachable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScreenLayout>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Plan</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('PlanSettings')}
          style={({ pressed }) => [styles.settingsLine, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.subtitle}>
            {profile.daysPerWeek} days · {profile.sessionMinutes} min · {profile.goal.replace('_', ' ')}
          </Text>
          <View style={styles.settingsLineRight}>
            <Text style={styles.settingsLineTap}>Tap to change</Text>
            <Icon name="chevron" size={14} color={colors.textFaint} strokeWidth={1.8} />
          </View>
        </Pressable>

        {/* Guarantees an open plan is never lost and never hides anything
            else on this screen — it's just one more card among the others. */}
        {currentPlan && (
          <Pressable
            onPress={() => navigation.navigate('PlanDetail')}
            style={({ pressed }) => [styles.currentPlanCard, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.currentPlanTop}>
              <Text style={styles.currentPlanLabel}>YOUR CURRENT PLAN</Text>
              <Icon name="chevron" size={16} color={colors.bronze} strokeWidth={1.8} />
            </View>
            <Text style={styles.currentPlanName} numberOfLines={1}>
              {currentPlan.name ?? 'Untitled plan'}
            </Text>
            <Text style={styles.currentPlanMeta}>
              {currentPlan.days.length} days · {currentPlanExerciseCount} exercises
            </Text>
          </Pressable>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Train Now" />
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            startSession();
            navigation.navigate('WorkoutTab');
          }}
          style={({ pressed }) => [styles.buildCard, pressed && { opacity: 0.9 }, { marginTop: spacing.sm }]}
        >
          <View style={styles.buildIconWrap}>
            <Icon name="workout" size={20} color={colors.textSecondary} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.buildTitle}>One-off workout</Text>
            <Text style={styles.buildBlurb}>
              Train from scratch — pick exercises as you go. Save it afterwards if you want to repeat it.
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textFaint} strokeWidth={1.8} />
        </Pressable>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Train On A Plan" />
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            createBlankPlan();
            navigation.navigate('PlanDetail', { editing: true });
          }}
          style={({ pressed }) => [styles.buildCard, pressed && { opacity: 0.9 }, { marginTop: spacing.sm }]}
        >
          <View style={styles.buildIconWrap}>
            <Icon name="dragHandle" size={20} color={colors.textSecondary} strokeWidth={2.6} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.buildTitle}>Build it yourself</Text>
            <Text style={styles.buildBlurb}>
              Pick your own exercises and drag them into each day — free, no limits
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textFaint} strokeWidth={1.8} />
        </Pressable>

        <Pressable
          onPress={() => {
            if (!isPro) {
              recordPaywallView('ai_planner');
              navigation.navigate('Paywall', { feature: 'ai_planner' });
              return;
            }
            haptics.tap();
            setShowAiSettings((v) => !v);
          }}
          style={({ pressed }) => [
            styles.buildCard,
            styles.aiCard,
            pressed && { opacity: 0.9 },
            { marginTop: spacing.sm },
          ]}
        >
          <View style={[styles.buildIconWrap, styles.aiIconWrap]}>
            <Icon name="sparkle" size={20} color="#fff" strokeWidth={1.7} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.buildTitleRow}>
              <Text style={styles.buildTitle}>AI Planner</Text>
              {!isPro && <ProBadge />}
            </View>
            <Text style={styles.buildBlurb}>Let ATLAS build and schedule your whole week</Text>
          </View>
          <View style={isPro && showAiSettings ? styles.chevronOpen : undefined}>
            <Icon name="chevron" size={18} color={isPro ? colors.textFaint : colors.bronze} strokeWidth={1.8} />
          </View>
        </Pressable>

        {/* AI settings — collapsed by default, generation controls only.
            Session length, split, emphasis and injuries all live in
            PlanSettings now, free for every user. */}
        {isPro && showAiSettings && (
          <Card style={{ marginTop: spacing.sm }}>
            <View style={styles.chipRow}>
              <Chip label="Plan the Week" active={planScope === 'week'} onPress={() => setPlanScope('week')} />
              <Chip label="Plan 1 Day" active={planScope === 'day'} onPress={() => setPlanScope('day')} />
            </View>

            {planScope === 'day' && (
              <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
                {DAY_FOCUS_OPTIONS.map((f) => (
                  <Chip
                    key={f ?? 'auto'}
                    label={f ?? 'Auto'}
                    active={dayFocus === f}
                    onPress={() => setDayFocus(f)}
                  />
                ))}
              </View>
            )}

            <Button
              label={
                loading
                  ? planScope === 'day'
                    ? 'Building your session…'
                    : 'Building your week…'
                  : planScope === 'day'
                  ? 'Generate Day'
                  : 'Generate Plan'
              }
              onPress={onGenerate}
              loading={loading}
              size="lg"
              style={{ marginTop: spacing.lg }}
            />
            <Button
              label="Import Workout"
              variant="secondary"
              onPress={() => navigation.navigate('ImportWorkout')}
              style={{ marginTop: spacing.sm }}
            />
            {error && <Text style={styles.error}>{error}</Text>}
          </Card>
        )}

        <Pressable
          onPress={() => navigation.navigate('Programs')}
          style={({ pressed }) => [styles.buildCard, pressed && { opacity: 0.9 }, { marginTop: spacing.sm }]}
        >
          <View style={styles.buildIconWrap}>
            <Icon name="search" size={20} color={colors.textSecondary} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.buildTitle}>Start from a program</Text>
            <Text style={styles.buildBlurb}>Proven splits, ready to train — free</Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textFaint} strokeWidth={1.8} />
        </Pressable>

        {savedPlans.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="My Plans" />
            <Card style={{ padding: 0, marginTop: spacing.sm }}>
              {savedPlans.map((p, i) => (
                <Pressable
                  key={p.id}
                  style={[styles.planRow, i > 0 && styles.exRowBorder]}
                  onPress={() => {
                    loadSavedPlan(p.id);
                    navigation.navigate('PlanDetail');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planRowName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.planRowMeta}>
                      {p.days.length} days · {PROGRAM_SOURCE_LABEL[p.source] ?? 'Offline generator'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete this plan?', p.name ?? 'Untitled plan', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteSavedPlan(p.id) },
                      ])
                    }
                    hitSlop={10}
                  >
                    <Icon name="close" size={16} color={colors.textFaint} strokeWidth={1.7} />
                  </Pressable>
                </Pressable>
              ))}
            </Card>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScreenLayout>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.hero, color: c.text },
  settingsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  settingsLineRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subtitle: { ...typography.body, color: c.textDim, textTransform: 'capitalize' },
  settingsLineTap: { ...typography.caption, color: c.textFaint },
  currentPlanCard: {
    backgroundColor: c.bronzeSoft,
    borderWidth: 1.5,
    borderColor: c.bronze,
    borderRadius: 16,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  currentPlanTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentPlanLabel: { ...typography.micro, color: c.bronze, letterSpacing: 0.5 },
  currentPlanName: { ...typography.h2, color: c.text, marginTop: spacing.sm },
  currentPlanMeta: { ...typography.caption, color: c.textDim, marginTop: 2 },
  buildCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: spacing.lg,
  },
  buildIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCard: { backgroundColor: c.bronzeSoft, borderColor: c.bronze, borderWidth: 1.5 },
  aiIconWrap: { backgroundColor: c.bronze },
  buildTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buildTitle: { ...typography.h2, color: c.text },
  buildBlurb: { ...typography.caption, color: c.textDim, marginTop: 3, lineHeight: 18 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...typography.caption, color: c.danger, marginTop: spacing.md },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  exRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  planRowName: { ...typography.bodyMedium, color: c.text },
  planRowMeta: { ...typography.caption, color: c.textDim, marginTop: 2 },
}));
