# Heat Transfer Data Reader - Web App

This is the web version of the Heat Transfer Data Reader, designed to work on Android tablets and other mobile devices.

## Features

- **Responsive Design**: Works on Android tablets, phones, and desktop browsers
- **Progressive Web App (PWA)**: Can be installed on Android devices
- **Touch-Friendly**: Optimized for touch interactions
- **All Original Features**: Fan control, heater control, data visualization, and more

## How to Use on Android Tablet

### Method 1: Direct Browser Access
1. Start the web server: `npm run web`
2. Find your computer's IP address (e.g., 192.168.1.100)
3. On your Android tablet, open Chrome browser
4. Go to: `http://YOUR_IP_ADDRESS:3000`
5. Use the app directly in the browser

### Method 2: Install as PWA (Recommended)
1. Follow Method 1 steps 1-4
2. In Chrome on your tablet, tap the menu (3 dots)
3. Select "Add to Home screen" or "Install app"
4. The app will be installed and can be launched like a native app

## Running the Web Server

```bash
# Install dependencies
npm install

# Start the web server
npm run web

# For development with auto-restart
npm run web-dev
```

The server will start on `http://localhost:3000`

## Network Access

To access from your Android tablet:

1. **Find your computer's IP address:**
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig` or `ip addr`

2. **Make sure both devices are on the same network**

3. **Access from tablet:** `http://YOUR_IP:3000`

## Features for Mobile

- **Touch-optimized sliders**: Larger touch targets
- **Responsive layout**: Adapts to different screen sizes
- **Landscape orientation**: Optimized for tablet use
- **PWA capabilities**: Can be installed and used offline (with cached data)

## Differences from Electron Version

- **No Serial Port Access**: Currently uses mock data (can be extended with Web Serial API)
- **Web-based**: Runs in browser instead of desktop app
- **Network Access**: Requires network connection between devices
- **Touch Interface**: Optimized for touch instead of mouse

## Future Enhancements

- **Web Serial API**: For direct serial port access in supported browsers
- **Real-time Data**: WebSocket connection for live data streaming
- **Offline Mode**: Service worker for offline functionality
- **Push Notifications**: For alerts and status updates

## Troubleshooting

### Can't access from tablet?
- Check firewall settings on your computer
- Ensure both devices are on the same WiFi network
- Try accessing from computer's browser first: `http://localhost:3000`

### App not installing as PWA?
- Make sure you're using Chrome browser
- Check that the manifest.json is accessible
- Try refreshing the page and trying again

### Touch issues?
- Make sure you're using a modern browser (Chrome recommended)
- Check that JavaScript is enabled
- Try refreshing the page

## Technical Details

- **Backend**: Express.js server
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **PWA**: Service Worker, Web App Manifest
- **Responsive**: CSS Grid, Flexbox, Media Queries
- **Touch**: Touch events, larger touch targets





