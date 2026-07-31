/**
 * PlantPal+ mobile — root component.
 *
 * Navigation is a deliberate hand-rolled tab switcher rather than
 * react-navigation: five flat tabs and one auth gate do not justify the
 * dependency, and every screen stays mounted-on-demand with zero config.
 *
 * Safe areas come from react-native-safe-area-context insets (not the
 * iOS-only SafeAreaView) so Android edge-to-edge gets the same treatment.
 */

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from './src/auth/AuthContext'
import { Spinner } from './src/components/ui'
import { OutboxIndicator, OutboxProvider } from './src/offline'
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

/** Short uppercase labels, styled as eyebrows — no emoji in the ledger. */
const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'plants', label: 'Plants' },
  { key: 'fitness', label: 'Fit' },
  { key: 'nutrition', label: 'Food' },
  { key: 'awards', label: 'Awards' },
  { key: 'settings', label: 'Set' },
]

function AppTabs() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
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
      {/* Unsynced-log count, directly above the tab bar and only when there is
          something waiting. It rides the tab bar's hairline rule. */}
      <OutboxIndicator />
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: p.border,
          backgroundColor: p.surface,
          paddingBottom: insets.bottom,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                // The active tab carries its own primary rule on top of the
                // bar's hairline — a ledger underline, flipped.
                borderTopWidth: active ? 2 : 0,
                borderTopColor: active ? p.primary : 'transparent',
                marginTop: active ? -StyleSheet.hairlineWidth : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: active ? '700' : '500',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: active ? p.primary : p.textMuted,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function Root() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const { isAuthenticated, isLoading } = useAuth()
  const [showRegister, setShowRegister] = useState(false)

  // Top/side insets apply here; the tab bar owns the bottom inset so its
  // surface colour runs under the home indicator. Auth screens (no tab bar)
  // pad the bottom themselves.
  const authed = !isLoading && isAuthenticated
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: p.background,
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: authed ? 0 : insets.bottom,
      }}
    >
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
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Inside AuthProvider: the outbox drains on sign-in and is cleared on
            sign-out, so it has to see the auth state. */}
        <OutboxProvider>
          <Root />
        </OutboxProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
