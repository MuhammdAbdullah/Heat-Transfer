# Responsive Scaling System - Simple Guide

## What I've Done

I've made your Electron app **dynamically resize everything** when you change the window size. This includes:

✅ **All text (fonts) scale automatically**  
✅ **Buttons, margins, and padding scale proportionally**  
✅ **Works in the main app AND all sub-windows** (Lab 1-5, Curriculum, Admin Panel, etc.)  
✅ **Simple, beginner-friendly code** - easy to understand and modify

---

## How It Works

### 1. **The Scaling Script** (`responsive-scaling.js`)

This file does all the magic:

- **Measures your window size** when it opens
- **Calculates a scale factor** based on how much you resize
- **Applies the scale to everything** by changing the base font size
- **Updates automatically** whenever you resize the window

**How it calculates scale:**
```javascript
// Example: If your window opens at 1200px wide, that's the "base" size
// If you resize to 600px wide, the scale factor is 0.5 (half size)
// Everything becomes 50% smaller - fonts, buttons, spacing, etc.
```

### 2. **Updated CSS** (uses `rem` units)

I changed all the CSS from **fixed pixels** (like `16px`) to **rem units** (like `1rem`).

**Why rem units?**
- `rem` means "relative to the root font size"
- When the script changes the root font size, everything else scales automatically
- **1rem = 16px by default** (but scales with window size)

**Example:**
```css
/* OLD (fixed size - doesn't scale) */
font-size: 36px;
padding: 20px;

/* NEW (scales with window) */
font-size: 2.25rem;  /* 36px at normal size */
padding: 1.25rem;    /* 20px at normal size */
```

### 3. **Applied to All Windows**

I added the script to every HTML file:
- ✅ `index.html` (main app)
- ✅ `lab1.html`, `lab2.html`, `lab3.html`, `lab4.html`, `lab5.html`
- ✅ `curriculum.html`
- ✅ `chart.html`
- ✅ `admin.html`

---

## How to Test

1. **Run your app**: `npm start`
2. **Resize the main window** - everything should scale proportionally
3. **Open a lab window** (e.g., Lab 1) and resize it - same behavior
4. **Try different sizes** - small, medium, large

---

## How to Customize

### Change the Base Window Size

If you want a different starting size, edit `responsive-scaling.js`:

```javascript
// At the top of the file
let baseWidth = 1200;  // Change this (default: 1200)
let baseHeight = 800;  // Change this (default: 800)
```

### Adjust Minimum/Maximum Scale

To prevent things from getting too small or too big, add limits:

```javascript
// In the applyResponsiveScaling() function
function applyResponsiveScaling() {
    const scaleFactor = calculateScaleFactor();
    
    // Add limits (optional)
    const minScale = 0.5;   // Don't go below 50%
    const maxScale = 1.5;   // Don't go above 150%
    const limitedScale = Math.max(minScale, Math.min(maxScale, scaleFactor));
    
    // Apply the limited scale
    document.documentElement.style.fontSize = (16 * limitedScale) + 'px';
}
```

### Turn Off Scaling for Specific Elements

If you want certain elements to NOT scale, use fixed units:

```css
/* This will NOT scale with window size */
.no-scaling-element {
    font-size: 16px !important;  /* Fixed size */
    width: 200px !important;     /* Fixed width */
}
```

---

## Understanding the Code

### The Main Function

```javascript
function applyResponsiveScaling() {
    // Step 1: Calculate how much to scale
    const scaleFactor = calculateScaleFactor();
    
    // Step 2: Change the root font size
    // Everything that uses rem units will scale automatically
    document.documentElement.style.fontSize = (16 * scaleFactor) + 'px';
}
```

**Example:**
- Window opens at 1200px → `scaleFactor = 1.0` → Font size = `16px`
- Window resized to 600px → `scaleFactor = 0.5` → Font size = `8px`
- All elements using rem units become 50% smaller

### The Resize Listener

```javascript
// This listens for window resize events
window.addEventListener('resize', function() {
    applyResponsiveScaling();  // Recalculate and apply new scale
});
```

---

## Tips

1. **Use rem for most things** - fonts, padding, margins, button sizes
2. **Use percentage for widths** - like `width: 100%` for containers
3. **Use viewport units (vw, vh) for special cases** - like full-screen elements
4. **Avoid mixing fixed pixels and rem** - it can look inconsistent

---

## Troubleshooting

### Problem: Some elements don't scale

**Solution:** Make sure they use `rem` units, not `px`:
```css
/* Change this: */
font-size: 20px;

/* To this: */
font-size: 1.25rem;  /* 20px ÷ 16 = 1.25rem */
```

### Problem: Text too small on small windows

**Solution:** Add a minimum scale factor in `responsive-scaling.js`:
```javascript
const minScale = 0.7;  // Don't go below 70%
const limitedScale = Math.max(minScale, scaleFactor);
```

### Problem: Scaling feels too sensitive

**Solution:** Adjust the calculation to be less aggressive:
```javascript
// Instead of direct scaling, use a dampened version
const scaleFactor = calculateScaleFactor();
const dampenedScale = 0.5 + (scaleFactor * 0.5);  // Less aggressive
```

---

## Summary

✅ **Simple JavaScript** scales the root font size  
✅ **CSS rem units** make everything scale automatically  
✅ **Works everywhere** in your app  
✅ **Easy to customize** - just edit one file

That's it! Everything now scales proportionally when you resize. 🎉






