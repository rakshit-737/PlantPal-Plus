# PlantPal+ Design Language

| Field | Value |
| --- | --- |
| Document | `01-design-language.md` — Visual direction and core UI theme tokens |
| Version | 1.0 |
| Owner | Rakshit |

## 1. Visual Direction
PlantPal+ is a wellness and habit-tracking app that brings together plant care, fitness, and nutrition. The visual language aims to be **warm, charming, and organic**, avoiding the sterile feel of clinical health apps. 

- **Organic & Grounded:** Extensive use of soft greens, earthy tones, and off-white backgrounds.
- **Friendly Geometry:** Soft rounded corners (border-radius: 12px to 16px) for cards, buttons, and inputs.
- **Micro-interactions:** Subtle spring animations and delightful states (e.g., Lottie plant growth, confetti on achievements).
- **Legible Typography:** Clean, modern sans-serif typography with excellent readability across dense data screens.

## 2. Color Palette
The palette is derived from nature, providing a calming and motivating interface.

### Light Theme
- **Background:** `#F9FAFB` (Off-white, almost a soft canvas)
- **Surface (Cards):** `#FFFFFF` (Pure white)
- **Primary (Brand):** `#10B981` (Emerald Green - for primary actions, plant health)
- **Primary Hover:** `#059669` (Deep Emerald)
- **Secondary (Fitness):** `#3B82F6` (Ocean Blue)
- **Tertiary (Nutrition):** `#F59E0B` (Amber)
- **Accent/Warning:** `#EF4444` (Coral Red)
- **Text Primary:** `#1F2937` (Dark Slate)
- **Text Secondary:** `#6B7280` (Muted Slate)
- **Borders/Dividers:** `#E5E7EB` (Light Gray)

### Dark Theme
- **Background:** `#111827` (Deep Midnight Blue)
- **Surface (Cards):** `#1F2937` (Dark Slate)
- **Primary (Brand):** `#34D399` (Soft Mint Green)
- **Primary Hover:** `#10B981` (Emerald Green)
- **Secondary (Fitness):** `#60A5FA` (Light Blue)
- **Tertiary (Nutrition):** `#FBBF24` (Soft Amber)
- **Accent/Warning:** `#F87171` (Soft Red)
- **Text Primary:** `#F9FAFB` (Off-white)
- **Text Secondary:** `#9CA3AF` (Muted Gray)
- **Borders/Dividers:** `#374151` (Medium Slate)

## 3. Typography Scale
We use **Inter** (or **Outfit** as a charming alternative for headings) as the primary font family. The scale applies globally via Tailwind/NativeWind tokens.

- **Display:** 36px / Line Height: 1.2 / Font Weight: 700 (Bold)
- **H1:** 30px / Line Height: 1.2 / Font Weight: 700 (Bold)
- **H2:** 24px / Line Height: 1.3 / Font Weight: 600 (SemiBold)
- **H3:** 20px / Line Height: 1.4 / Font Weight: 600 (SemiBold)
- **Body Large:** 18px / Line Height: 1.5 / Font Weight: 400 (Regular)
- **Body Base:** 16px / Line Height: 1.5 / Font Weight: 400 (Regular) - *Default text size*
- **Body Small:** 14px / Line Height: 1.5 / Font Weight: 400 (Regular)
- **Caption:** 12px / Line Height: 1.5 / Font Weight: 500 (Medium)

## 4. Spacing & Layout Tokens
We utilize an 8pt grid system.

- **Spacing Base:** 8px
- **xs:** 4px (Gap between tight elements like icon and label)
- **sm:** 8px (Gap between sibling elements)
- **md:** 16px (Standard padding inside cards/buttons)
- **lg:** 24px (Section spacing)
- **xl:** 32px (Major section separation)
- **2xl:** 48px (Screen bottom padding, above tab bars)

## 5. Shared Theme Tokens (Tailwind/NativeWind)
These tokens will be declared in the monorepo's shared `tailwind.config.js`.

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        secondary: 'var(--color-secondary)',
        tertiary: 'var(--color-tertiary)',
        accent: 'var(--color-accent)',
        'text-main': 'var(--color-text-main)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
      },
      borderRadius: {
        'lg': '16px',
        'md': '12px',
        'sm': '8px',
        'full': '9999px',
      },
    },
  },
}
```
