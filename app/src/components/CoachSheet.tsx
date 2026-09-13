import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';
import { getExerciseById } from '@/data/exercises';
import { useCoach, CoachMessage } from '@/store/coach';

function exerciseName(id: string) {
  return getExerciseById(id)?.name ?? id;
}

/** The structured mutation rendered as a plain diff — this is the one place
 *  in the sheet where the model's own words don't matter; only the object
 *  the backend validated does. */
function ProposalCard({ message }: { message: CoachMessage }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const applyProposal = useCoach((s) => s.applyProposal);
  const discardProposal = useCoach((s) => s.discardProposal);
  const proposal = message.proposal;
  if (!proposal) return null;

  const decided = message.proposalStatus !== 'pending';

  return (
    <View style={styles.proposalCard}>
      {proposal.type === 'exercise_swap' ? (
        <View style={styles.swapRow}>
          <Text style={styles.swapFrom} numberOfLines={1}>
            {exerciseName(proposal.fromExerciseId)}
          </Text>
          <Icon name="chevron" size={14} color={colors.textFaint} strokeWidth={2} />
          <Text style={styles.swapTo} numberOfLines={1}>
            {exerciseName(proposal.toExerciseId)}
          </Text>
        </View>
      ) : (
        <Text style={styles.swapTo}>
          Drop {proposal.removedNames.length} exercise{proposal.removedNames.length === 1 ? '' : 's'} — down to
          ~{proposal.estimatedMinutes} min
        </Text>
      )}

      {message.proposalStatus === 'applied' && <Text style={styles.proposalStatusText}>Applied</Text>}
      {message.proposalStatus === 'discarded' && <Text style={styles.proposalStatusText}>Discarded</Text>}

      {!decided && (
        <View style={styles.proposalActions}>
          <Pressable style={styles.discardBtn} onPress={() => discardProposal(message.id)}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </Pressable>
          <Pressable style={styles.applyBtn} onPress={() => applyProposal(message.id)}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function CoachSheet() {
  const { colors } = useTheme();
  const styles = useStyles();
  const visible = useCoach((s) => s.visible);
  const messages = useCoach((s) => s.messages);
  const loading = useCoach((s) => s.loading);
  const error = useCoach((s) => s.error);
  const closeCoach = useCoach((s) => s.closeCoach);
  const sendMessage = useCoach((s) => s.sendMessage);
  const [draft, setDraft] = useState('');

  const onSend = () => {
    const text = draft;
    setDraft('');
    sendMessage(text);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeCoach}>
      <Pressable style={styles.backdrop} onPress={closeCoach}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%' }}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Coach</Text>
              <Pressable onPress={closeCoach} hitSlop={10}>
                <Icon name="close" size={18} color={colors.textDim} strokeWidth={1.7} />
              </Pressable>
            </View>

            <ScrollView style={styles.thread} contentContainerStyle={{ paddingBottom: spacing.md }}>
              {messages.length === 0 && !loading && (
                <Text style={styles.emptyHint}>
                  Ask about swapping an exercise, cutting a session short, or anything about your current plan.
                </Text>
              )}
              {messages.map((m) => (
                <View
                  key={m.id}
                  style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowCoach]}
                >
                  <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
                    <Text style={m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextCoach}>
                      {m.content}
                    </Text>
                  </View>
                  {m.role === 'assistant' && m.proposal && <ProposalCard message={m} />}
                </View>
              ))}
              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.textFaint} size="small" />
                </View>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask the coach…"
                placeholderTextColor={colors.textFaint}
                multiline
                onSubmitEditing={onSend}
              />
              <Pressable
                style={[styles.sendBtn, !draft.trim() && { opacity: 0.4 }]}
                onPress={onSend}
                disabled={!draft.trim() || loading}
              >
                <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '700' }}>↑</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    maxHeight: '82%',
    minHeight: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  title: { ...typography.h3, color: c.text },
  thread: { marginTop: spacing.md },
  emptyHint: { ...typography.body, color: c.textFaint, lineHeight: 21 },
  bubbleRow: { marginTop: spacing.sm, maxWidth: '100%' },
  bubbleRowUser: { alignItems: 'flex-end' },
  bubbleRowCoach: { alignItems: 'flex-start' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%' },
  bubbleUser: { backgroundColor: c.accent },
  bubbleCoach: { backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.border },
  bubbleTextUser: { ...typography.body, color: c.onAccent },
  bubbleTextCoach: { ...typography.body, color: c.text },
  loadingRow: { paddingVertical: spacing.md, alignItems: 'flex-start' },
  error: { ...typography.caption, color: c.recoveryFatigued, marginTop: spacing.sm },
  proposalCard: {
    marginTop: 6,
    alignSelf: 'flex-start',
    maxWidth: '90%',
    backgroundColor: c.bronzeSoft,
    borderWidth: 1,
    borderColor: 'rgba(192,138,62,0.35)',
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  swapFrom: { ...typography.caption, color: c.textDim, textDecorationLine: 'line-through', flexShrink: 1 },
  swapTo: { ...typography.captionBold, color: c.bronze, flexShrink: 1 },
  proposalStatusText: { ...typography.micro, color: c.textFaint, marginTop: 6 },
  proposalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  discardBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  discardBtnText: { ...typography.captionBold, color: c.textSecondary },
  applyBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: c.bronze },
  applyBtnText: { ...typography.captionBold, color: c.onAccent },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: c.text,
    backgroundColor: c.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
