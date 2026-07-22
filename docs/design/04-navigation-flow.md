# PlantPal+ Navigation Flow

| Field | Value |
| --- | --- |
| Document | `04-navigation-flow.md` — App routing and navigation structure |
| Version | 1.0 |
| Owner | Rakshit |

## 1. Overview
The navigation architecture must accommodate a unified dashboard and three independent trackers. The presence of tabs is dynamic based on user preferences (if a user disables "Fitness", the Fitness tab disappears).

## 2. Mobile App (React Navigation / Expo Router)
We use a **Bottom Tab Navigator** as the root, with **Native Stack Navigators** inside each tab to handle drill-downs.

### Root Navigation
- **Auth Stack:** Login -> Register -> Onboarding (hidden once authenticated and onboarded).
- **Main App:** Bottom Tab Navigator.

### Bottom Tabs
1. **Home (Dashboard):** 
   - `Dashboard` (Index) -> `Notifications` (Modal)
2. **Plants:**
   - `PlantList` (Index) -> `PlantDetail` -> `GrowthTimeline`
   - `AddPlant` (Modal presentation)
3. **Fitness:** (Hidden if disabled)
   - `FitnessHome` (Index) -> `WorkoutDetail` -> `ExerciseList`
   - `LogWorkout` (Bottom Sheet)
4. **Nutrition:** (Hidden if disabled)
   - `NutritionHome` (Index) -> `MealDetail` 
   - `FoodSearch` (Modal presentation)
5. **Me:** 
   - `Profile/Settings` (Index) -> `Achievements` -> `EditProfile`

### Modals & Overlays
Actions that interrupt the user's flow without needing deep linking are presented as Modals or Bottom Sheets:
- Quick log a meal (Bottom Sheet).
- Quick water a plant (Bottom Sheet or immediate action).
- Add a custom food (Modal).

## 3. Web App (React Router)
On the web, we use a responsive layout that adapts to screen size.

### Desktop Layout (> 1024px)
- **Persistent Left Sidebar:** Contains all the top-level navigation items (Dashboard, Plants, Fitness, Nutrition, Achievements, Settings).
- **Main Content Area:** Renders the active route.
- **Contextual Right Sidebar (Optional):** Used on the Dashboard to show upcoming reminders or a mini-calendar.

### Mobile Web (< 1024px)
- Mirrors the mobile app with a **Bottom Navigation Bar**.
- Replaces stack transitions with fast standard web page routing.

### Web Routing Structure
```
/login
/register
/onboarding
/                 (Dashboard)
/plants           (Plant List)
/plants/:id       (Plant Detail)
/plants/add       (Add Plant Form)
/fitness          (Fitness Home)
/fitness/log      (Log Workout Form)
/nutrition        (Nutrition Home)
/nutrition/log    (Food Search/Log)
/achievements     (Trophy Room)
/settings         (Preferences)
```

## 4. Deep Linking & Notifications
Push notifications must route directly to the relevant entity.
- Prefix: `plantpal://`
- E.g., `plantpal://plants/123` opens the Plant Detail screen for plant ID 123.
- E.g., `plantpal://nutrition/log?meal=lunch` opens the food search modal pre-filled for Lunch.
