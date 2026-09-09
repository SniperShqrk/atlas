import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_THEME,
  Palette,
  ThemeName,
  getPalette,
} from '@/theme/palettes';

/**
 * ATLAS — theming.
 *
 * React Native evaluates a module-scope `StyleSheet.create` once, at import,
 * which is why a themeable app cannot keep its styles there: whatever colour
 * was current at import time is baked in for the life of the process. The
 * pattern below moves style creation behind a hook and memoises the result per
 * theme, so switching themes is instant, styles are still built exactly once
 * per theme, and nothing is recomputed on every render.
 *
 *   const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.card } }));
 *   function Thing() {
 *     const styles = useStyles();
 *     const { colors } = useTheme();
 *   }
 */

/* ------------------------------------------------------------------ */
/* The stored choice                                                   */
/* ------------------------------------------------------------------ */

interface ThemeState {
  theme: ThemeName;
  /** false until AsyncStorage has been read — see the note in store/onboarding */
  hydrated: boolean;
  setTheme: (name: ThemeName) => void;
  setHydrated: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      hydrated: false,
      setTheme: (name) => set({ theme: name }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'atlas-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

const ThemeContext = createContext<Palette>(getPalette(DEFAULT_THEME));

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const name = useThemeStore((s) => s.theme);
  const palette = useMemo(() => getPalette(name), [name]);
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

/** The active palette, plus the bits of the theme that never vary. */
export function useTheme(): { colors: Palette; name: ThemeName; isLight: boolean } {
  const colors = useContext(ThemeContext);
  return { colors, name: colors.name, isLight: colors.isLight };
}

/** Just the colours — the common case. */
export function useColors(): Palette {
  return useContext(ThemeContext);
}

/* ------------------------------------------------------------------ */
/* Themed styles                                                       */
/* ------------------------------------------------------------------ */

/**
 * Builds a `useStyles()` hook from a factory. The factory runs at most once
 * per theme and the result is cached for the life of the process, so a screen
 * that renders a hundred times builds its stylesheet once.
 */
export function makeStyles<
  T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>
>(factory: (c: Palette) => T): () => T {
  const cache = new Map<ThemeName, T>();
  return function useStyles(): T {
    const colors = useContext(ThemeContext);
    let styles = cache.get(colors.name);
    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors.name, styles);
    }
    return styles;
  };
}

export type { Palette, ThemeName };
export { getPalette };
