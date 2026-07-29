import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layouts/AppShell'
import { AchievementsPage } from './pages/AchievementsPage'
import { DashboardPage } from './pages/DashboardPage'
import { FitnessPage } from './pages/FitnessPage'
import { LoginPage } from './pages/LoginPage'
import { NutritionPage } from './pages/NutritionPage'
import { PlantDetailPage } from './pages/PlantDetailPage'
import { PlantsPage } from './pages/PlantsPage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { SettingsProvider } from './settings/SettingsContext'

export function App() {
  return (
    <AuthProvider>
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

          {/* Unknown paths fall back to the dashboard (or login, via the guard). */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
