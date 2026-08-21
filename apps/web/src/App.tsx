import { MotionConfig } from 'motion/react'
import { lazy, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { ToastProvider } from './components/ui'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useTheme } from './hooks/useTheme'
import { AppShell } from './layouts/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsProvider } from './settings/SettingsContext'

/*
 * Route-level code splitting. Three routes stay in the initial bundle because
 * they are the first thing someone sees: the two auth pages for a signed-out
 * visitor, and the dashboard for a signed-in one. Everything else is fetched
 * when it is first opened.
 *
 * Achievements matters most here — it is the route slated to carry the
 * heaviest visual work and the least-visited one in the app. AppShell renders
 * these inside a Suspense boundary in <main>, so the shell stays put while a
 * chunk loads.
 */
const AchievementsPage = lazy(() =>
  import('./pages/AchievementsPage').then((m) => ({ default: m.AchievementsPage })),
)
const FitnessPage = lazy(() =>
  import('./pages/FitnessPage').then((m) => ({ default: m.FitnessPage })),
)
const NutritionPage = lazy(() =>
  import('./pages/NutritionPage').then((m) => ({ default: m.NutritionPage })),
)
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
)
const PlantDetailPage = lazy(() =>
  import('./pages/PlantDetailPage').then((m) => ({ default: m.PlantDetailPage })),
)
const PlantsPage = lazy(() =>
  import('./pages/PlantsPage').then((m) => ({ default: m.PlantsPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

/**
 * Mounts the theme hook at the root so every route — including /login and
 * /register, which live outside the shell — applies the stored theme.
 * index.html's pre-paint script handles the very first frame.
 */
function ThemeBoot() {
  useTheme()
  return null
}

/**
 * Applies the reduce-motion decision to every animation in the app from one
 * place. Motion defaults to ignoring the user's preference entirely, so this
 * has to be wired explicitly: `always` suppresses animation, `user` defers to
 * the OS query. useReducedMotion already folds the in-app toggle into that
 * answer.
 *
 * It wraps `children` rather than living inside App's own return so that a
 * toggle re-renders this component alone — `children` arrives as the same
 * element and React skips the subtree. Components that need to branch on the
 * value themselves call the same hook; none should read matchMedia directly.
 */
function MotionBoot({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  return <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>
}

export function App() {
  return (
    <MotionBoot>
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
                {/*
                  Onboarding lives inside the shell and is reached by link only.
                  Nothing redirects into it: no endpoint exposes
                  profiles.onboarding_completed_at (see OnboardingPage's header),
                  so the app cannot distinguish a new account from a returning one.
                  Once the API surfaces that flag, gate the redirect here.
                */}
                <Route path="/onboarding" element={<OnboardingPage />} />
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
    </MotionBoot>
  )
}
