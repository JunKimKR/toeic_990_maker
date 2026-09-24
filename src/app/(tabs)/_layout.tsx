import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconHistory, IconSettings, IconSkills, IconToday, IconVocab } from '../../ui/icons';
import { usePalette } from '../../ui/theme';

export default function TabsLayout() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.text,
        tabBarInactiveTintColor: p.text3,
        tabBarStyle: { backgroundColor: p.bg, borderTopColor: p.border, borderTopWidth: StyleSheet.hairlineWidth, height: 64 + insets.bottom, paddingTop: 4, paddingBottom: insets.bottom + 6 },
        tabBarItemStyle: { height: 54 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <IconToday color={String(color)} /> }} />
      <Tabs.Screen name="skills" options={{ title: 'Skills', tabBarIcon: ({ color }) => <IconSkills color={String(color)} /> }} />
      <Tabs.Screen name="vocab" options={{ title: 'Vocab', tabBarIcon: ({ color }) => <IconVocab color={String(color)} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <IconHistory color={String(color)} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <IconSettings color={String(color)} /> }} />
    </Tabs>
  );
}
