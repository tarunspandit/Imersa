# Imersa Design System Guide

## Overview
The Imersa React UI uses a unique, premium design system focused on lighting and smart home aesthetics. This guide documents the design system components and how to apply them consistently.

## Core Design Files

- `/src/styles/design-system.css` - Main design system styles
- `/src/components/layout/PageWrapper.tsx` - Standard page wrapper component
- `/src/components/effects/ParticleField.tsx` - Particle effects component

## Color Palette

```css
--imersa-void: #0a0a0f;        /* Background */
--imersa-midnight: #11111a;    /* Elevated background */
--imersa-dark: #15151f;        /* Surface */
--imersa-surface: #1a1a28;     /* Cards */
--imersa-elevated: #22223a;    /* Elevated elements */

/* Accent Colors */
--imersa-glow-primary: #ffd700; /* Gold */
--imersa-glow-warm: #ff9500;    /* Orange */
--imersa-glow-cool: #00d4ff;    /* Cyan */
--imersa-glow-purple: #b794f6;  /* Purple */
--imersa-glow-green: #68d391;   /* Green */
```

## Gradients

```css
--gradient-warm: linear-gradient(135deg, #ff6b6b, #ffd700, #ff9500);
--gradient-cool: linear-gradient(135deg, #667eea, #00d4ff, #48bb78);
--gradient-aurora: linear-gradient(135deg, #b794f6, #9f7aea, #667eea);
--gradient-sunset: linear-gradient(135deg, #ff6b6b, #ff9500, #ffd700);
--gradient-ocean: linear-gradient(135deg, #00d4ff, #0099ff, #0066cc);
```

## Component Classes

### Glass Effects
```html
<div className="glass-card">
  <!-- Glassmorphic card with blur -->
</div>

<div className="holo-card">
  <!-- Holographic shimmer effect -->
</div>

<div className="light-beam">
  <!-- Light beam sweep animation -->
</div>
```

### Buttons
```html
<!-- Primary button with glow -->
<button className="btn-glow">
  Action
</button>

<!-- Secondary button -->
<button className="px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all">
  Secondary
</button>

<!-- Ghost button -->
<button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-all">
  Ghost
</button>
```

### Inputs
```html
<input className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
```

### Navigation Orb
```html
<div className="nav-orb">
  <Icon className="w-8 h-8 text-imersa-dark" />
</div>
```

## Page Structure

Use the `PageWrapper` component for consistent page layout:

```jsx
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Settings } from 'lucide-react';

function MyPage() {
  return (
    <PageWrapper
      icon={<Settings className="w-8 h-8 text-imersa-dark" />}
      title="Page Title"
      subtitle="Page description"
      actions={
        <button className="btn-glow">
          Action
        </button>
      }
    >
      {/* Page content */}
      <div className="glass-card p-6">
        Content here
      </div>
    </PageWrapper>
  );
}
```

## Animations

### Ambient Background
Every page includes animated orbs:
```html
<div className="ambient-bg">
  <div className="ambient-orb ambient-orb-1"></div>
  <div className="ambient-orb ambient-orb-2"></div>
  <div className="ambient-orb ambient-orb-3"></div>
</div>
```

### Loading States
```html
<div className="loading-pulse">
  <Icon className="w-8 h-8 text-imersa-dark" />
</div>
```

### Interactive Glow
```html
<div className="interactive-glow">
  <!-- Element glows on hover -->
</div>
```

### Status Indicators
```html
<div className="status-dot active"></div>
```

## Special Effects

### Gradient Border
```html
<div className="gradient-border">
  <!-- Animated gradient border -->
</div>
```

### Energy Bar
```html
<div className="energy-bar"></div>
```

### Particle Field
```jsx
import { ParticleField } from '@/components/effects/ParticleField';

<ParticleField active={true} count={50} />
```

## Updated Pages

All pages have been updated with the new design system:

✅ **Dashboard** (`DashboardNew.tsx`)
- Room cards with 3D hover effects
- Scene cards with gradient backgrounds
- Particle effects for transitions

✅ **Lights** (`LightsComplete.tsx`)
- Glass cards for light controls
- Interactive glow on light icons
- Grid/Table view with consistent styling

✅ **Groups** (`Groups.tsx`)
- Stats cards with holographic effects
- Gradient action buttons
- Dark theme controls

✅ **Scenes** (`Scenes.tsx`)
- PageWrapper implementation
- Glass card containers
- Gradient scene previews

✅ **Entertainment** (`Entertainment.tsx`, `EntertainmentWizardNew.tsx`)
- 5-step wizard with gradient progress
- 3D light positioning
- Glassmorphic cards

✅ **Settings** (`SettingsComplete.tsx`)
- PageWrapper with settings icon
- Glass cards for configuration sections
- Dark theme form elements

## API Connectivity

All pages maintain their API connections through React hooks:
- `useGroups()` - Group management
- `useLights()` - Light control
- `useScenes()` - Scene management
- `useSchedules()` - Scheduling
- `useSensors()` - Sensor data
- `useEntertainment()` - Entertainment areas

## Best Practices

1. **Always import the design system CSS**:
   ```jsx
   import '@/styles/design-system.css';
   ```

2. **Use PageWrapper for new pages**:
   - Provides consistent header and layout
   - Handles ambient background automatically
   - Manages responsive padding

3. **Apply glass effects to cards**:
   - Use `glass-card` for standard cards
   - Add `holo-card` for important elements
   - Use `light-beam` for interactive cards

4. **Maintain dark theme consistency**:
   - Text: `text-white` for primary, `text-gray-400` for secondary
   - Backgrounds: Use `bg-white/5` for inputs
   - Borders: Use `border-white/10` for subtle borders

5. **Use gradients for emphasis**:
   - Primary actions: `btn-glow`
   - Icons: Gradient backgrounds
   - Stats: Gradient overlays

## Responsive Design

The design system is mobile-responsive:
- Cards stack on mobile
- Navigation collapses
- Touch-friendly button sizes
- Proper padding on all screen sizes

## Performance

- CSS animations use GPU acceleration
- Particle effects are conditional
- Lazy loading for heavy components
- Optimized backdrop filters

## Accessibility

- High contrast between text and backgrounds
- Focus indicators on interactive elements
- ARIA labels where appropriate
- Keyboard navigation support