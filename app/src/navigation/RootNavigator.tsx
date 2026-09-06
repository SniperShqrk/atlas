import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/palettes';
import { Icon, IconName } from '@/components/Icon';
import { useWorkoutStore } from '@/store/workoutStore';
import { useOnboarding } from '@/store/onboarding';

import HomeScreen from '@/screens/HomeScreen';
import WorkoutScreen from '@/screens/WorkoutScreen';
import ExerciseLibraryScreen from '@/screens/ExerciseLibraryScreen';
import ExerciseDetailScreen from '@/screens/ExerciseDetailScreen';
import AddCustomExerciseScreen from '@/screens/AddCustomExerciseScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import PlanScreen from '@/screens/PlanScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import AnalyticsScreen from '@/screens/AnalyticsScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import SaveRoutineScreen from '@/screens/SaveRoutineScreen';
import BodyweightScreen from '@/screens/BodyweightScreen';
import ShareCardScreen from '@/screens/ShareCardScreen';
import ThemeScreen from '@/screens/ThemeScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import AchievementsScreen from '@/screens/AchievementsScreen';
import AuthScreen from '@/screens/AuthScreen';
import SocialScreen from '@/screens/SocialScreen';
import GroupDetailScreen from '@/screens/GroupDetailScreen';
import CompareScreen from '@/screens/CompareScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONS: Record<string, IconName> = {
  HomeTab: 'home',
  PlanTab: 'plan',
  WorkoutTab: 'workout',
  ProgressTab: 'chart',
  ProfileTab: 'profile',
};

const LABELS: Record<string, string> = {
  HomeTab: 'Home',
  PlanTab: 'Plan',
  WorkoutTab: 'Workout',
  ProgressTab: 'Progress',
  ProfileTab: 'Profile',
};

function TabIcon({ route, color, focused }: { route: string; color: string; focused: boolean }) {
  const styles = useStyles();
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const showDot = route === 'WorkoutTab' && !!activeSession && !focused;
  return (
    <View style={styles.iconWrap}>
      <Icon name={ICONS[route]} color={color} size={23} strokeWidth={focused ? 1.9 : 1.6} />
      {showDot && <View style={styles.activeDot} />}
    </View>
  );
}

function Tabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: 60 + Math.max(insets.bottom, 12),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarLabel: LABELS[route.name],
        tabBarIcon: ({ color, focused }) => <TabIcon route={route.name} color={color} focused={focused} />,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="PlanTab" component={PlanScreen} />
      <Tab.Screen name="WorkoutTab" component={WorkoutScreen} />
      <Tab.Screen name="ProgressTab" component={AnalyticsScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** React Navigation needs its own theme object; derive it from the palette. */
function navThemeFor(c: Palette) {
  const base = c.isLight ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: c.bg,
      card: c.bgElevated,
      border: c.border,
      primary: c.accent,
      text: c.text,
    },
  };
}

export default function RootNavigator() {
  const { colors } = useTheme();
  const hasOnboarded = useOnboarding((s) => s.hasOnboarded);
  return (
    <NavigationContainer theme={navThemeFor(colors)}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={hasOnboarded ? 'Tabs' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen
          name="ExerciseLibrary"
          component={ExerciseLibraryScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="ExerciseDetail"
          component={ExerciseDetailScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="AddCustomExercise"
          component={AddCustomExerciseScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="SaveRoutine" component={SaveRoutineScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Bodyweight" component={BodyweightScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ShareCard" component={ShareCardScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Theme" component={ThemeScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Social" component={SocialScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Compare" component={CompareScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const useStyles = makeStyles((c) => ({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.bronze,
  },
}));
