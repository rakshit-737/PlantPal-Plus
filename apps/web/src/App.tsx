import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ToastProvider } from './components/ui'
import { useTheme } from './hooks/useTheme'
import { AppShell } from './layouts/AppShell'
import { AchievementsPage } from './pages/AchievementsPage'
import { DashboardPage } from './pages/DashboardPage'
import { FitnessPage } from './pages/FitnessPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { NutritionPage } from './pages/NutritionPage'
import { PlantDetailPage } from './pages/PlantDetailPage'
import { PlantsPage } from './pages/PlantsPage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { SettingsProvider } from './settings/SettingsContext'

/**
 * Mounts the theme hook at the root so every route — including /login and
 * /register, which live outside the shell — applies the stored theme.
 * index.html's pre-paint script handles the very first frame.
 */
function ThemeBoot() {
  useTheme()
  return null
}

export function App() {
  return (
    <AuthProvider>
      <ThemeBoot />
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated app */}
          <Route
            element={
              <ProtectedRoute>
                <SettingsProvider>
                  <AppShell />
                </SettingsProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/plants" element={<PlantsPage />} />
            <Route path="/plants/:id" element={<PlantDetailPage />} />
            <Route path="/fitness" element={<FitnessPage />} />
            <Route path="/nutrition" element={<NutritionPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Unknown paths get a real 404 rather than a silent redirect. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
