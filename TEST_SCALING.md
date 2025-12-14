# Testing the Responsive Scaling

## Quick Test Steps

1. **Open Developer Console** (Press F12 or Ctrl+Shift+I)
2. **Run the app:** `npm start`
3. **Look for these messages in the console:**
   ```
   [Responsive Scaling] Initializing with base: 1200 x 800
   [Responsive Scaling] Window: 1200x800 | Base: 1200x800 | Scale: 1.00 | Font size: 16.0px
   [Responsive Scaling] ✓ Initialized successfully
   ```

4. **Resize the window** - You should see:
   ```
   [Responsive Scaling] Window: 800x600 | Base: 1200x800 | Scale: 0.67 | Font size: 10.7px
   ```

5. **Check what's scaling:**
   - ✅ Button text should get smaller
   - ✅ All text should resize
   - ✅ Spacing should adjust
   - ✅ Everything should scale proportionally

## If It's NOT Working

### Check 1: Is the script loading?
Open Console and type:
```javascript
window.applyResponsiveScaling
```
If it says `undefined`, the script isn't loading. Check that `responsive-scaling.js` is in the same folder as `index.html`.

### Check 2: Is the font size changing?
Open Console and type:
```javascript
document.documentElement.style.fontSize
```
It should show something like `"16px"` or `"10px"` depending on window size.

### Check 3: Force a resize
Open Console and type:
```javascript
applyResponsiveScaling()
```
This manually triggers the scaling. Look for the log message.

### Check 4: Verify rem units are working
Open Console and type:
```javascript
// Get any button
const button = document.querySelector('.heater-btn');
const fontSize = window.getComputedStyle(button).fontSize;
console.log('Button font size:', fontSize);
```
The font size should change when you resize the window.

## Common Issues

### Issue: Nothing scales
**Solution:** Clear browser cache and reload (Ctrl+Shift+R)

### Issue: Only some things scale
**Solution:** Some elements might still use `px` instead of `rem`. Check the element in DevTools.

### Issue: Scaling is too aggressive
**Solution:** Edit `responsive-scaling.js` and adjust the limits:
```javascript
const minScale = 0.7;  // Change from 0.5 to 0.7
const maxScale = 1.5;  // Change from 2.0 to 1.5
```

### Issue: Console shows errors
**Solution:** Look at the error message and share it - we can fix it quickly!

## Debug Command

Copy and paste this into the console to see all the scaling info:
```javascript
console.log('=== SCALING DEBUG INFO ===');
console.log('Window size:', window.innerWidth, 'x', window.innerHeight);
console.log('Root font size:', document.documentElement.style.fontSize);
console.log('Computed font size:', window.getComputedStyle(document.documentElement).fontSize);
console.log('Scale factor CSS var:', document.documentElement.style.getPropertyValue('--scale-factor'));

// Test a button
const btn = document.querySelector('.heater-btn');
if (btn) {
    console.log('Button computed font:', window.getComputedStyle(btn).fontSize);
    console.log('Button computed padding:', window.getComputedStyle(btn).padding);
}
```

This will show you exactly what's happening!






