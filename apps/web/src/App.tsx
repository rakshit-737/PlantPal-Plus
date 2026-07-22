import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layouts/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { RegisterPage } from './pages/RegisterPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated app */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/plants"
              element={
                <PlaceholderPage
                  title="Plants"
                  blurb="Your plants, watering reminders and growth timeline."
                />
              }
            />
            <Route
              path="/fitness"
              element={
                <PlaceholderPage title="Fitness" blurb="Workouts, steps, goals and streaks." />
              }
            />
            <Route
              path="/nutrition"
              element={
                <PlaceholderPage
                  title="Nutrition"
                  blurb="Meals, macros, daily targets and water intake."
                />
              }
            />
            <Route
              path="/achievements"
              element={
                <PlaceholderPage title="Achievements" blurb="Streaks, badges and milestones." />
              }
            />
            <Route
              path="/settings"
              element={
                <PlaceholderPage title="Settings" blurb="Preferences, modules and your account." />
              }
            />
          </Route>

          {/* Unknown paths fall back to the dashboard (or login, via the guard). */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
