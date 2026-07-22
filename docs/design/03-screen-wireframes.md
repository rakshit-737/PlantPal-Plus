# PlantPal+ Screen Wireframes & Layouts

| Field | Value |
| --- | --- |
| Document | `03-screen-wireframes.md` — Screen-by-screen layouts and UX flow |
| Version | 1.0 |
| Owner | Rakshit |

## 1. Onboarding
**Purpose:** Collect baseline data for the modules within 90 seconds. Skippable.
**Layout:** 
- Progress bar at the top (e.g., Step 1 of 4).
- **Screen 1 (Welcome):** unDraw illustration, greeting, "Let's personalize your experience."
- **Screen 2 (Modules):** Three large toggle cards (Plants, Fitness, Nutrition). User must select at least one.
- **Screen 3 (Profile - if Fitness/Nutrition selected):** Inputs for Height, Weight, Activity Level.
- **Screen 4 (Theme & Reminders):** Prompt to allow push notifications (mobile), set preferred reminder time.
- **Actions:** "Next" button fixed at the bottom. "Skip" button ghosted at the top right.

## 2. Login & Registration
**Layout:**
- Clean, distraction-free centered card (web) or full screen (mobile).
- Logo / App Name at the top.
- Email and Password fields.
- Primary CTA: "Log In" / "Sign Up".
- Text link: "Forgot Password?".
- (Future v1.1) OAuth buttons: "Continue with Google / Apple" separated by a "OR" divider.

## 3. Daily Dashboard (The Unified View)
**Purpose:** The single most important screen interleaving tasks from all enabled modules.
**Layout (Mobile: Single Column | Web: 2-3 Column Grid):**
- **Header:** "Good morning, Rakshit" + Current Date + Global Streak Flame icon (top right).
- **At-a-Glance Summary (Horizontal Scroll or Grid):**
  - Card 1: Plants (e.g., "3 Due Today")
  - Card 2: Fitness (e.g., "Workout Planned" or "4,200 / 10k Steps")
  - Card 3: Nutrition (e.g., "1,200 kcal remaining")
- **The "Today" List:** A unified vertical list of actionable items sorted by priority.
  - E.g., `[Droplet Icon] Water Monstera (Due)` -> Tapping waters it instantly or opens details.
  - E.g., `[Utensils Icon] Log Lunch` -> Tapping opens meal logger sheet.
  - E.g., `[Dumbbell Icon] Log Workout`
- **FAB (Mobile):** "+" button that expands into three mini-FABs: Add Plant, Log Workout, Log Meal.

## 4. Plant Care Module
### 4.1 Plant List
- **Header:** "My Plants" + Search bar + Filter button.
- **Layout Toggle:** Grid view (photos prominent) vs. List view (details prominent).
- **Cards:** Display plant photo (or placeholder), Nickname, Species, and a status chip (e.g., "Water in 2 days", "Overdue!").

### 4.2 Plant Detail & Growth Timeline
- **Hero:** Large cover photo with gradient overlay, Nickname, and Species.
- **Quick Actions Row:** Water, Add Photo, Settings.
- **Tabs:**
  - **Overview:** Care profile summary (Light, Soil, Watering frequency).
  - **History/Timeline:** Vertical timeline of watering events, care tasks, and growth logs (with photos).

### 4.3 Add/Edit Plant (Sheet/Modal)
- Multi-step form or long scrolling form.
- Search species (typeahead dropdown).
- Capture photo (camera integration on mobile).
- Inputs: Nickname, Location, Pot size.

## 5. Fitness Module
### 5.1 Fitness Home
- **Hero:** Weekly activity rings/bars (Steps, Active Minutes).
- **Recent Workouts:** Horizontal scrolling list of cards showing Activity type, Duration, and Calories burned.
- **Body Metrics:** Mini chart showing weight trend over the last 30 days.

### 5.2 Log Workout (Sheet/Modal)
- Activity Type selector (grid of icons for Walk, Run, Cycle, Yoga, etc.).
- Duration (minutes) and Intensity (slider: Low, Mod, Vig).
- For Strength: Dynamic list for adding Sets (Reps x Weight).

## 6. Calorie Tracker Module
### 6.1 Nutrition Home
- **Hero:** Large circular progress ring for Calories (Consumed / Target). Underneath, three linear progress bars for Macros (Carbs, Protein, Fat).
- **Meals Section:** Grouped by Breakfast, Lunch, Dinner, Snack. Each group shows total calories and a "+" button.
- **Water Log:** A row of glass icons. Tapping one fills it up (quick-add).

### 6.2 Food Search & Log
- **Search Bar:** Real-time search against DB.
- **Scanner (Mobile):** Barcode icon in search bar opens camera.
- **Food Detail:** Shows Macros per 100g. Input for Quantity and Unit dropdown (g, cup, slice).

## 7. Streaks & Achievements (Gamification)
- **Trophy Room:** Grid of badges (locked in greyscale, unlocked in full color).
- **Streak Details:** Calendar view highlighting continuous days met across enabled modules. "Freezes" available shown as ice cube icons.

## 8. Settings
- **List Layout:** Grouped by Account, Modules, Preferences, Support, Legal.
- **Toggles:** Theme (Dark/Light/System), Module Enable/Disable.
- **Inputs:** Daily goals (Steps, Calories).
- **Destructive Actions:** "Log Out", "Delete Account" (red text).
