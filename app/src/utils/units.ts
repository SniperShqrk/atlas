import { UserProfile } from '@/store/workoutStore';

/**
 * Every weight in the store — sets, bodyweight, personal records, plate math —
 * is kept in kg. `profile.unit` only changes what a person types and reads;
 * it never touches storage, so e1RM, volume, achievement thresholds and plate
 * loading all stay correct regardless of which unit is on screen. This file
 * is the only place that converts between the two.
 *
 * Two things are deliberately left kg-only rather than converted: the plate
 * calculator (a "20kg bar + 2×20 per side" doesn't have a clean lb
 * equivalent without a separate lb plate set) and the achievement volume
 * tiers (themed around tonnes moved — "A Million Kilograms" — which doesn't
 * translate to a round lb figure). Both would need their own lb-specific
 * numbers, not just a conversion, so they're out of scope here.
 */

export type WeightUnit = UserProfile['unit'];

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** A working weight past this is never a real input — it's a typo. Covers the heaviest raw lifts on record with room to spare. */
export const WEIGHT_LIMITS = { minKg: 0, maxKg: 500 };

/** ~44–660lb. Covers every real adult bodyweight; anything outside it is a mistyped digit. */
export const BODYWEIGHT_LIMITS = { minKg: 20, maxKg: 300 };

export const REPS_LIMITS = { min: 0, max: 100 };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** kg → the number to show in the given unit, rounded to one decimal. */
export function displayWeight(kg: number, unit: WeightUnit): number {
  return round1(unit === 'lb' ? kgToLb(kg) : kg);
}

/** kg → "62.5kg" or "137.8lb" for the given unit. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${displayWeight(kg, unit)}${unit}`;
}

/** Parses a weight typed in the given unit back to a clamped kg value for storage. */
export function parseWeightInput(text: string, unit: WeightUnit): number {
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return 0;
  const kg = unit === 'lb' ? lbToKg(n) : n;
  return round1(clamp(kg, WEIGHT_LIMITS.minKg, WEIGHT_LIMITS.maxKg));
}

/** Same as parseWeightInput, with the wider bounds sensible for a bodyweight reading. */
export function parseBodyweightInput(text: string, unit: WeightUnit): number {
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return 0;
  const kg = unit === 'lb' ? lbToKg(n) : n;
  return round1(clamp(kg, BODYWEIGHT_LIMITS.minKg, BODYWEIGHT_LIMITS.maxKg));
}

/** Parses a reps field to a clamped non-negative integer. */
export function parseReps(text: string): number {
  const n = parseInt(text, 10);
  if (!Number.isFinite(n)) return 0;
  return clamp(n, REPS_LIMITS.min, REPS_LIMITS.max);
}
