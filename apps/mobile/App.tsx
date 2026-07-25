/**
 * PlantPal+ mobile — root component.
 *
 * Navigation is a deliberate hand-rolled tab switcher rather than
 * react-navigation: five flat tabs and one auth gate do not justify the
 * dependency, and every screen stays mounted-on-demand with zero config.
 */

import { useState } from 'react'
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'

import { AuthProvider, useAuth } from './src/auth/AuthContext'
import { Spinner } from './src/components/ui'
import { AchievementsScreen } from './src/screens/AchievementsScreen'
import { DashboardScreen } from './src/screens/DashboardScreen'
import { FitnessScreen } from './src/screens/FitnessScreen'
import { LoginScreen } from './src/screens/LoginScreen'
import { NutritionScreen } from './src/screens/NutritionScreen'
import { PlantsScreen } from './src/screens/PlantsScreen'
import { RegisterScreen } from './src/screens/RegisterScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { usePalette } from './src/theme'

type Tab = 'home' | 'plants' | 'fitness' | 'nutrition' | 'awards' | 'settings'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'plants', icon: '🌱', label: 'Plants' },
  { key: 'fitness', icon: '💪', label: 'Fitness' },
  { key: 'nutrition', icon: '🍽️', label: 'Food' },
  { key: 'awards', icon: '🏆', label: 'Awards' },
  { key: 'settings', icon: '⚙️', label: 'More' },
]

function AppTabs() {
  const p = usePalette()
  const [tab, setTab] = useState<Tab>('home')

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <DashboardScreen />}
        {tab === 'plants' && <PlantsScreen />}
        {tab === 'fitness' && <FitnessScreen />}
        {tab === 'nutrition' && <NutritionScreen />}
        {tab === 'awards' && <AchievementsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: p.border,
          backgroundColor: p.surface,
        }}
      >
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            onPress={() => setTab(t.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 18, opacity: tab === t.key ? 1 : 0.45 }}>{t.icon}</Text>
            <Text
              style={{
                fontSize: 10,
                fontWeight: tab === t.key ? '700' : '400',
                color: tab === t.key ? p.primary : p.textMuted,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function Root() {
  const p = usePalette()
  const { isAuthenticated, isLoading } = useAuth()
  const [showRegister, setShowRegister] = useState(false)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.background }}>
      <StatusBar style="auto" />
      {isLoading ? (
        <Spinner />
      ) : isAuthenticated ? (
        <AppTabs />
      ) : showRegister ? (
        <RegisterScreen onDone={() => setShowRegister(false)} />
      ) : (
        <LoginScreen onRegister={() => setShowRegister(true)} />
      )}
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
