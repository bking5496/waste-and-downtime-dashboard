# Mission Control Theme Documentation

This document defines the **Mission Control** design system used throughout the Waste & Downtime Dashboard. All new frontend development must follow these guidelines to maintain visual consistency.

## Design Philosophy

Mission Control is a **sci-fi industrial** aesthetic inspired by NASA mission control centers, cyberpunk interfaces, and premium manufacturing dashboards. The theme emphasizes:

- Dark, immersive backgrounds
- Neon accent colors with glow effects
- Industrial typography
- High contrast for readability in factory environments

---

## Color Palette

### Primary Neon Colors

| Name | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| **Neon Cyan** | `#00f5ff` | `var(--neon-cyan)` | Primary accent, labels, borders, links |
| **Neon Green** | `#00ff88` | `var(--neon-green)` | Success states, "Running" status |
| **Neon Red** | `#ff4757` | `var(--neon-red)` | Danger, errors, "Maintenance" status |
| **Neon Amber** | `#ffb800` | `var(--neon-amber)` | Warnings, caution states |
| **Neon Blue** | `#4d9fff` | `var(--neon-blue)` | Active/info states |
| **Neon Purple** | `#bf7dff` | `var(--neon-purple)` | Night shift indicator |

### Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Running | Green | `#00ff88` |
| Idle | Cyan | `#00f5ff` |
| Maintenance | Red | `#ff4757` |
| Offline | Muted Cyan | `rgba(0, 245, 255, 0.4)` |

### Background Colors

| Layer | Value | Usage |
|-------|-------|-------|
| Surface 0 | `#050810` | Page background |
| Surface 1 | `rgba(10, 25, 40, 0.95)` | Cards, panels |
| Surface 2 | `rgba(10, 25, 40, 0.8)` | Nested elements |
| Glass BG | `rgba(10, 25, 40, 0.95)` | Glassmorphism panels |

### Border Colors

Always use cyan-tinted borders:

```css
/* Standard border */
border: 1px solid rgba(0, 245, 255, 0.15);

/* Hover border */
border: 1px solid rgba(0, 245, 255, 0.3);

/* Active/Focus border */
border: 1px solid rgba(0, 245, 255, 0.5);
```

### Text Colors

| Type | Value | Usage |
|------|-------|-------|
| Primary | `#e2e8f0` | Main body text |
| Secondary | `rgba(0, 245, 255, 0.7)` | Labels, descriptions |
| Muted | `rgba(0, 245, 255, 0.5)` | Hints, timestamps |
| Disabled | `rgba(0, 245, 255, 0.3)` | Disabled text |

---

## Typography

### Font Families

| Type | Font | CSS Variable |
|------|------|--------------|
| Display/Headers | Oxanium | `var(--font-display)` |
| Body | DM Sans | `var(--font-sans)` |
| Monospace/Data | IBM Plex Mono | `var(--font-mono)` |

### Usage Guidelines

```css
/* Headers & Labels */
font-family: 'Oxanium', sans-serif;
text-transform: uppercase;
letter-spacing: 1px;
font-weight: 600;

/* Body Text */
font-family: 'DM Sans', sans-serif;
font-size: 14px;
line-height: 1.6;

/* Data & Numbers */
font-family: 'IBM Plex Mono', monospace;
font-weight: 600;
```

---

## Glow Effects

### Box Shadows

```css
/* Card glow */
box-shadow: 0 0 30px rgba(0, 245, 255, 0.05);

/* Hover glow */
box-shadow: 0 0 40px rgba(0, 245, 255, 0.15);

/* Neon accent glow */
box-shadow: 0 0 20px rgba(0, 245, 255, 0.5),
            0 0 40px rgba(0, 245, 255, 0.25);
```

### Text Shadows

```css
/* Label glow */
text-shadow: 0 0 10px rgba(0, 245, 255, 0.3);

/* Strong accent glow */
text-shadow: 0 0 15px rgba(0, 245, 255, 0.4);
```

---

## Component Patterns

### Cards

```css
.card {
  background: linear-gradient(180deg,
    rgba(10, 25, 40, 0.95) 0%,
    rgba(5, 15, 30, 0.98) 100%
  );
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 12px;
  position: relative;
}

/* Top accent line */
.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--neon-cyan) 50%,
    transparent 100%
  );
  opacity: 0.6;
}
```

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: linear-gradient(180deg,
    rgba(0, 245, 255, 0.15) 0%,
    rgba(0, 245, 255, 0.05) 100%
  );
  border: 1px solid rgba(0, 245, 255, 0.4);
  color: #00f5ff;
}

/* Success Button */
.btn-success {
  background: linear-gradient(180deg,
    rgba(0, 255, 136, 0.15) 0%,
    rgba(0, 255, 136, 0.05) 100%
  );
  border: 1px solid rgba(0, 255, 136, 0.4);
  color: #00ff88;
}

/* Danger Button */
.btn-danger {
  background: linear-gradient(180deg,
    rgba(255, 71, 87, 0.15) 0%,
    rgba(255, 71, 87, 0.05) 100%
  );
  border: 1px solid rgba(255, 71, 87, 0.4);
  color: #ff4757;
}
```

### Form Inputs

```css
.input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(0, 245, 255, 0.2);
  color: #f8fafc;
  font-family: 'IBM Plex Mono', monospace;
}

.input:focus {
  border-color: rgba(0, 245, 255, 0.5);
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
}

.input::placeholder {
  color: rgba(0, 245, 255, 0.3);
}

.label {
  font-family: 'Oxanium', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--neon-cyan);
  text-transform: uppercase;
  letter-spacing: 1px;
  text-shadow: 0 0 10px rgba(0, 245, 255, 0.3);
}
```

### Status Badges

```css
/* Running */
.badge-running {
  color: #00ff88;
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.3);
}

/* Idle */
.badge-idle {
  color: var(--neon-cyan);
  background: rgba(0, 245, 255, 0.1);
  border: 1px solid rgba(0, 245, 255, 0.3);
}

/* Maintenance */
.badge-maintenance {
  color: #ff4757;
  background: rgba(255, 71, 87, 0.1);
  border: 1px solid rgba(255, 71, 87, 0.3);
}
```

---

## Animation Guidelines

### Transitions

```css
/* Standard transition */
transition: all 0.2s ease;

/* Smooth transitions */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

### Pulse Animation (Status Indicators)

```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.status-dot {
  animation: pulse 2s ease-in-out infinite;
}
```

### Glow Pulse (Neon Elements)

```css
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(0, 245, 255, 0.5); }
  50% { box-shadow: 0 0 20px rgba(0, 245, 255, 0.8); }
}
```

---

## DO's and DON'Ts

### DO

- Use neon cyan (`#00f5ff`) as the primary accent color
- Apply text shadows to labels and headers
- Use dark backgrounds with transparency (rgba values)
- Include top accent lines on cards
- Use IBM Plex Mono for numeric data
- Use Oxanium for headers and labels (uppercase, letter-spacing)
- Add subtle glow effects on hover states

### DON'T

- Use old slate colors (`#94a3b8`, `#64748b`, `#475569`)
- Use light backgrounds
- Mix non-Mission Control UI patterns
- Skip the neon glow effects
- Use default system fonts
- Forget text shadows on accent text

---

## CSS Variables Reference

```css
:root {
  /* Neon Colors */
  --neon-cyan: #00f5ff;
  --neon-green: #00ff88;
  --neon-amber: #ffb800;
  --neon-red: #ff4757;
  --neon-blue: #4d9fff;
  --neon-purple: #bf7dff;

  /* Status Colors */
  --status-running: #00ff88;
  --status-idle: #00f5ff;
  --status-maintenance: #ff4757;

  /* Glow Effects */
  --glow-cyan: 0 0 20px rgba(0, 245, 255, 0.5),
               0 0 40px rgba(0, 245, 255, 0.25);
  --glow-green: 0 0 20px rgba(0, 255, 136, 0.5),
                0 0 40px rgba(0, 255, 136, 0.25);

  /* Glassmorphism */
  --glass-bg: rgba(10, 25, 40, 0.95);
  --glass-border: rgba(0, 245, 255, 0.15);
  --glass-blur: blur(24px);

  /* Surface Layers */
  --surface-0: #050810;
  --surface-1: rgba(10, 25, 40, 0.95);
  --surface-2: rgba(10, 25, 40, 0.8);

  /* Typography */
  --font-display: 'Oxanium', sans-serif;
  --font-sans: 'DM Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* Text Colors */
  --text-primary: #e2e8f0;
  --text-secondary: rgba(0, 245, 255, 0.6);
  --border-color: rgba(0, 245, 255, 0.2);
}
```

---

## File Structure

Mission Control styles are organized as follows:

```
src/
├── index.css              # Main theme styles
├── mobile.css             # Mobile-specific overrides
└── components/
    └── ui/
        ├── Button.css     # Button component styles
        ├── StatCard.css   # Stat card styles
        ├── StatusBadge.css# Status badge styles
        ├── DataGrid.css   # Table/grid styles
        ├── FormField.css  # Form input styles
        ├── Modal.css      # Modal dialog styles
        ├── PageHeader.css # Page header styles
        └── AddOrderModal.css # Add order modal styles
```

---

## Contributing

When adding new components:

1. Follow the color palette defined above
2. Use CSS variables where possible
3. Include hover states with glow effects
4. Use the standard font families
5. Test on dark backgrounds
6. Ensure high contrast for accessibility
