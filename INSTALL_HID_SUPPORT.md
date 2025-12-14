# How to Enable HID Bootloader Support

Your app can detect the bootloader device, but to communicate with it via HID, you need to install Visual Studio Build Tools.

## Quick Installation Steps:

### Step 1: Download Visual Studio Build Tools
1. Go to: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
2. Download "Build Tools for Visual Studio 2022"
3. Run the installer

### Step 2: Install Required Components
When the installer opens:
1. Select **"Desktop development with C++"** workload
   - This includes the Windows SDK and C++ build tools
2. Click **"Install"** (this will take 5-10 minutes)

### Step 3: Rebuild node-hid for Electron
After installation, open PowerShell in your project folder and run:

```powershell
npm run rebuild-hid
```

Or if that doesn't work:

```powershell
.\node_modules\.bin\electron-rebuild.cmd -f -w node-hid
```

### Step 4: Test the App
Restart your Electron app. The bootloader device should now connect automatically when detected!

## Alternative: Use Pre-built Binary (Advanced)

If you prefer not to install build tools, you can try using a pre-built version:
1. Check if there's a pre-built binary for your Electron version
2. Or build it on another machine with build tools and copy the files

## Current Status

✅ Bootloader device detection: **Working**
✅ HID device detection: **Working**  
⏳ HID communication: **Needs Visual Studio Build Tools**

The app will continue to work for all other features (serial communication, data logging, etc.) even without HID support.










