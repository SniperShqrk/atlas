import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card } from '@/components/ui';
import { ScreenLayout, ModalHeader } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { spacing, radius, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore } from '@/store/workoutStore';
import { PREBUILT_PROGRAMS } from '@/data/programs';
import { haptics } from '@/lib/haptics';

/**
 * Ready-made programs, full page — the free, no-generator-required, no-
 * settings-required way to start a plan. Used to be a horizontal rail buried
 * below My Plans; the product research backs this as evidence-based
 * onboarding (a proven split someone can start today beats an empty
 * builder), so it gets its own screen and equal billing with the AI Planner
 * and the manual builder on the Plan tab.
 */
export default function ProgramsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const loadPresetProgram = useWorkoutStore((s) => s.loadPresetProgram);

  const onPick = (program: (typeof PREBUILT_PROGRAMS)[number]) => {
    haptics.tap();
    loadPresetProgram(program);
    navigation.replace('PlanDetail');
  };

  return (
    <Screen>
      <ModalHeader title="Start from a Program" onBack={() => navigation.goBack()} />
      <ScreenLayout hasTabBar={false}>
        <Text style={styles.intro}>
          Proven splits, ready to train today. Pick one to open it as a normal,
          editable plan — swap exercises, adjust sets, or leave it exactly as is.
        </Text>

        {PREBUILT_PROGRAMS.map((program, i) => (
          <Pressable
            key={program.name}
            onPress={() => onPick(program)}
            style={({ pressed }) => [
              styles.card,
              pressed && { opacity: 0.9 },
              i > 0 && { marginTop: spacing.md },
            ]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.name}>{program.name}</Text>
              <Icon name="chevron" size={18} color={colors.textFaint} strokeWidth={1.8} />
            </View>
            <Text style={styles.meta}>{program.days.length}-day split</Text>
            <Text style={styles.summary}>{program.summary}</Text>
            <View style={styles.dayRow}>
              {program.days.map((d) => (
                <View key={d.label} style={styles.dayTag}>
                  <Text style={styles.dayTagText}>{d.focus}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}
      </ScreenLayout>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  intro: { ...typography.body, color: c.textDim, lineHeight: 21, marginBottom: spacing.lg },
  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.h2, color: c.text },
  meta: { ...typography.captionBold, color: c.bronze, marginTop: 2 },
  summary: { ...typography.body, color: c.textDim, marginTop: spacing.sm, lineHeight: 20 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  dayTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  dayTagText: { ...typography.caption, color: c.textSecondary, fontWeight: '600' },
}));
