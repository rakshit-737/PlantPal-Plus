# PlantPal+ Component Inventory

| Field | Value |
| --- | --- |
| Document | `02-component-inventory.md` — Component mapping and animation strategy |
| Version | 1.0 |
| Owner | Rakshit |

## 1. Web Components (shadcn/ui + Tailwind)
For the React + Vite web application, we use **shadcn/ui** to build accessible, unstyled components that we can heavily customize with Tailwind CSS to match our design language.

| Component | Usage & Customization |
| --- | --- |
| **Button** | Primary (solid Emerald), Secondary (outline), Ghost (text-only). Rounded corners `rounded-lg` (16px). |
| **Card** | Used for daily summary items, plant profiles, workout logs. Styled with `bg-surface`, soft shadow `shadow-sm`, and `rounded-lg`. |
| **Input & Textarea** | `bg-white` (or dark equivalent), subtle border, `focus:ring-primary`. |
| **Select / Combobox** | Crucial for picking plant species or food items. |
| **Progress / Rings** | Custom implementation using SVG or Recharts for circular progress (calories, steps) and shadcn Progress for linear bars (macros). |
| **Tabs** | For switching views (e.g. Dashboard / Plants / Fitness / Nutrition). |
| **Dialog / Sheet** | Used for "Add Plant" or "Log Workout" flows on desktop without navigating away. |
| **Toast** | For success messages (e.g. "Plant watered!", "Meal logged!"). |

## 2. Mobile Components (NativeWind + React Native Paper)
For the React Native (Expo) app, we use **NativeWind** to share the exact same Tailwind utility classes and theme tokens as the web. We pull in **React Native Paper** exclusively for complex interactive components that are hard to build from scratch.

| Component | Usage & Customization |
| --- | --- |
| **Button / Pressable** | Built via NativeWind to match web. Use `TouchableOpacity` or `Pressable` with scale-down animation on press. |
| **Card** | Built via NativeWind `View`. |
| **Bottom Sheet** | (via `@gorhom/bottom-sheet`) Essential for mobile data entry (logging water, adding food) to keep users in context. |
| **FAB (Floating Action Button)** | React Native Paper FAB, fixed at bottom-right for primary actions (e.g., "+" Add Log). |
| **Snackbars** | React Native Paper Snackbar, mirroring the web Toasts. |

## 3. Icons
**Lucide Icons** are used across both platforms (`lucide-react` for web, `lucide-react-native` for mobile) ensuring a consistent, clean, and stroke-based icon set.
- Common icons: `Sprout` (Plants), `Activity` or `Dumbbell` (Fitness), `Utensils` or `Apple` (Nutrition), `Droplet` (Water), `CheckCircle` (Achievements).

## 4. Illustrations
**unDraw** illustrations are used for empty states and onboarding. 
- Colors in unDraw SVGs will be overridden to match our Primary (`#10B981`) brand color.
- Use cases: "No plants yet", "No workouts logged", Onboarding welcome screen.

## 5. Animations & Motion
Motion is a core part of the "charming" aesthetic. 

### Lottie (Cross-platform)
- **Plant Growth/Celebration:** A beautiful Lottie animation plays when unlocking an achievement or reaching a daily goal.
- **Empty States:** Subtle animated empty states instead of static illustrations where appropriate.

### Reanimated (Mobile) / Framer Motion (Web)
- **Spring Physics:** All layout transitions and tap-interactions use spring physics (bouncy, not rigid timing curves).
- **List Items:** New entries (e.g. logging a meal) slide and fade in.
- **Progress Rings:** Circular progress rings animate from 0 to their current value on screen load.

## 6. Charts
- **Web (Recharts):** Responsive, SVG-based. Used for 7/30/90-day progress, macro distribution pie charts, and plant growth line charts.
- **Mobile (Victory Native):** React Native optimized charts that share visual similarity with Recharts (customized via theme props to use our color palette).
