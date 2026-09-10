import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { Screen, Button, Card } from '@/components/ui';
import { ModalHeader } from '@/components/ScreenLayout';
import { Icon } from '@/components/Icon';
import { radius, spacing, typography } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { useWorkoutStore, CustomExerciseInput } from '@/store/workoutStore';
import { importWorkout, ImportedExercise } from '@/api/client';

/** Photos are downscaled+recompressed client-side (quality 0.5, JPEG) rather than
 *  sent at full camera resolution — keeps the request well under the backend's
 *  20mb JSON body limit and Haiku doesn't need more detail than that to read a
 *  photographed plan. */
const PICKER_OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  base64: true,
  quality: 0.5,
  allowsEditing: false,
};

const MAX_IMAGES = 3;

export default function ImportWorkoutScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);
  const setCurrentPlan = useWorkoutStore((s) => s.setCurrentPlan);

  const [text, setText] = useState('');
  const [images, setImages] = useState<{ base64: string; mimeType: string; uri: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        fromCamera ? 'Camera access needed' : 'Photos access needed',
        'Enable it in Settings to import a workout from a photo.'
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(PICKER_OPTS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTS);
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    setImages((prev) => [
      ...prev,
      // PICKER_OPTS sets quality: 0.5, which forces a JPEG re-encode
      // regardless of the source format — a screenshot is PNG, but
      // asset.mimeType still reports that original source type, not what it
      // actually got compressed to. Sending that stale mimeType to the
      // backend makes Anthropic reject the request as a media-type mismatch,
      // so always declare it as what the compression setting guarantees.
      { base64: asset.base64!, mimeType: 'image/jpeg', uri: asset.uri },
    ]);
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = (text.trim().length > 0 || images.length > 0) && !loading;

  const onImport = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const { plan, newExercises } = await importWorkout({
        text: text.trim() || undefined,
        images: images.length ? images.map(({ base64, mimeType }) => ({ base64, mimeType })) : undefined,
      });

      if (!plan.days.length) {
        setError(plan.summary || "Couldn't find a workout plan in that — try a clearer photo or paste the text instead.");
        setLoading(false);
        return;
      }

      // Create each unmatched exercise for real, then swap the model's
      // placeholder tempIds for the ids the store actually assigned.
      const idMap = new Map<string, string>();
      for (const ex of newExercises as ImportedExercise[]) {
        const { tempId, ...input } = ex;
        const created = addCustomExercise(input as CustomExerciseInput);
        idMap.set(tempId, created.id);
      }
      const remapped = {
        ...plan,
        days: plan.days.map((day) => ({
          ...day,
          exercises: day.exercises.map((e) => ({
            ...e,
            exerciseId: idMap.get(e.exerciseId) ?? e.exerciseId,
          })),
        })),
      };

      setCurrentPlan(remapped);
      navigation.navigate('Tabs', { screen: 'PlanTab' });
    } catch (err: any) {
      setError(err?.message ?? 'Import failed. Check the backend is running and reachable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ModalHeader title="Import Workout" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.blurb}>
          Paste a plan you already have, or add a photo of it — a screenshot, a printout, even your own
          handwriting. Upload up to 3 photos if your plan runs long. ATLAS matches each exercise to the
          library and builds the rest of any it doesn't recognise.
        </Text>

        <Text style={styles.label}>PASTE TEXT</Text>
        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          placeholder={'e.g.\nDay 1 - Push\nBench press 4x8\nOverhead press 3x10\n...'}
          placeholderTextColor={colors.textFaint}
          multiline
          textAlignVertical="top"
        />

        <Text style={[styles.label, { marginTop: spacing.xl }]}>
          OR ADD A PHOTO {images.length > 0 ? `(${images.length}/${MAX_IMAGES})` : ''}
        </Text>
        {images.length > 0 && (
          <View style={styles.imageThumbRow}>
            {images.map((img, i) => (
              <View key={img.uri + i} style={styles.imagePreviewWrap}>
                <Image source={{ uri: img.uri }} style={styles.imagePreview} />
                <Pressable style={styles.removeImage} onPress={() => removeImage(i)} hitSlop={10}>
                  <Icon name="close" size={16} color="#fff" strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {images.length < MAX_IMAGES && (
          <View style={styles.photoRow}>
            <Pressable style={styles.photoButton} onPress={() => pickImage(false)}>
              <Icon name="library" size={20} color={colors.textSecondary} strokeWidth={1.6} />
              <Text style={styles.photoButtonText}>Choose Photo</Text>
            </Pressable>
            <Pressable style={styles.photoButton} onPress={() => pickImage(true)}>
              <Icon name="workout" size={20} color={colors.textSecondary} strokeWidth={1.6} />
              <Text style={styles.photoButtonText}>Take Photo</Text>
            </Pressable>
          </View>
        )}

        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}

        <Button
          label={loading ? 'Reading your plan…' : 'Import'}
          onPress={onImport}
          disabled={!canSubmit}
          loading={loading}
          size="lg"
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  blurb: { ...typography.body, color: c.textDim, lineHeight: 21 },
  label: { ...typography.micro, color: c.textFaint, marginTop: spacing.xl, marginBottom: spacing.sm },
  textArea: {
    backgroundColor: c.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    padding: spacing.md,
    minHeight: 140,
    ...typography.body,
  },
  photoRow: { flexDirection: 'row', gap: spacing.md },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.cardAlt,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  photoButtonText: { ...typography.bodyMedium, color: c.textSecondary },
  imageThumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  imagePreviewWrap: { alignSelf: 'flex-start' },
  imagePreview: { width: 100, height: 100, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: { marginTop: spacing.lg, backgroundColor: c.dangerSoft },
  errorText: { ...typography.caption, color: c.danger, lineHeight: 18 },
}));
