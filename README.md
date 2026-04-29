# Heat Transfer App

A comprehensive Electron.js desktop application for real-time heat transfer data monitoring, device control, and educational lab experiments. This app connects to heat transfer hardware via COM port, provides interactive controls for fans, heaters, and coolers, and includes educational curriculum modules for thermodynamics learning.

## 📥 Download & Install

**Latest Release: [v1.3.1](https://github.com/MuhammdAbdullah/Heat-Transfer/releases/latest)**

1. Go to [Releases](https://github.com/MuhammdAbdullah/Heat-Transfer/releases)
2. Download `Heat Transfer App Setup 1.3.1.exe` (Windows)
3. Run the installer and follow the setup wizard
4. The app will automatically check for updates when you start it

## ✨ Features

> **Visualize feature note**: The `Visualize` option is available in version `1.3.1`. It is planned to be removed in the next release.

### 🔌 Device Communication
- **COM Port Communication**: Automatic connection to serial devices (VID: 0x12BF, PID: 0x010C)
- **Auto-Connect**: Automatically detects and connects to target device on startup
- **Hot-Plug Detection**: Automatically reconnects when device is plugged in
- **Connection Monitoring**: Real-time connection status with automatic disconnect detection
- **Auto-Graph Reset**: Graphs automatically clear when device reconnects after disconnection, ensuring clean data collection
- **Data Validation**: Validates 56-byte data packets with proper headers (0x55 0x55) and footers (0xAA 0xAA)
- **Packet Processing**: Handles multiple packet types including 4-byte control packets

### 🌡️ Real-Time Monitoring
- **Temperature Sensors**: Display readings from 8 temperature sensors (T1-T8)
- **Heater Monitoring**: Track Radial Heater and Linear Heater temperatures
- **System Metrics**: Real-time display of Power, Air Speed, and Time
- **Status Indicator**: Visual system status (Online/Offline) with color-coded indicators
- **Last Update Timestamp**: Shows when data was last received

### 🎛️ Device Control
- **Fan Speed Control**: Adjustable slider (0-100%) with preset buttons (0%, 50%, 100%)
- **Heater Temperature Control**: Precise temperature control (20-70°C) with visual slider
- **Heater Mode Selection**: Choose between Off, Radial Heater, or Linear Heater
- **Cooler Control**: Left Cooler toggle button for active cooling
- **Real-Time Feedback**: Control values displayed instantly with visual feedback

### 📊 Data Visualization
- **Live Device Chart**: Real-time Chart.js graph showing all temperature sensors over time
- **Temperature vs Distance Graph**: Customizable distance inputs for spatial temperature analysis
- **Chart Display Modes**: Choose between Limited Points (Last 50) or All Data Points
- **Graph Window**: Pop-out graph window for better visualization
- **Print Support**: Print graphs directly from the application
- **Data Export**: CSV export with Start/Stop saving controls, 3-decimal precision, and timestamped default filenames to avoid accidental overwrite
- **Snapshot CSV Capture**: One-click `Snapshot` button saves a single moment of live data (T1-T8, heaters, power, air speed, fan %, heater mode, heater slider, cooler state) with date/time timestamp
- **Remembered Snapshot Path**: Snapshot asks save location only on first use, then reuses the same CSV path and appends rows automatically
- **Snapshot Toast Feedback**: A small bottom-right popup confirms snapshot success or shows an error
- **Auto-Clear on Reconnect**: Graphs automatically clear when hardware device disconnects and reconnects, ensuring fresh data collection

### 🎓 Educational Features
- **Lab Modules**: Five interactive lab experiments (Lab 1-5)
- **Curriculum Viewer**: Comprehensive heat transfer curriculum content
- **Multilingual Support**: Complete translations for all lab sheets in 6 languages:
  - English
  - French (Français)
  - German (Deutsch)
  - Spanish (Español)
  - Dutch (Nederlands)
  - Arabic (العربية)
- **Language Selection**: Choose your preferred language from the curriculum page - your selection is automatically applied to all lab sheets
- **Simulation Mode**: Visualize heat transfer concepts with interactive simulations
- **3D Visualization**: Three.js integration for 3D model viewing (GLTF/STEP files)

### ⚙️ Advanced Features
- **Admin Panel**: Advanced controls and system management
  - PID Control Settings (Proportional, Integral, Derivative)
  - Bootloader interface for firmware updates
  - System monitoring and diagnostics
  - Raw data display and packet analysis
- **USB HID Bootloader**: Full firmware update support
  - Load Intel HEX files
  - Erase, Program, and Verify flash memory
  - Progress indicators (Orange: Erasing, Green: Programming, Blue: Verifying)
  - CRC verification for firmware integrity
  - Run Application button to exit bootloader mode

### 🎨 User Interface
- **Modern Design**: Glassmorphism UI with gradient controls and smooth animations
- **Dark Theme**: Modern dark theme optimized for data visualization
- **Responsive Scaling**: Automatic UI scaling for different screen sizes
- **Splash Screen**: Professional splash screen on startup
- **Accessibility**: High contrast colors and clear visual feedback

### 🔄 Auto-Updates
- **Automatic Update Checking**: Checks for updates on startup
- **GitHub Releases Integration**: Downloads updates from GitHub releases
- **User-Friendly Prompts**: Clear update notifications with download progress
- **One-Click Installation**: Easy update installation process

### 🛡️ Safety Features
- **Safety Shutdown**: Automatic safety commands when closing the app:
  - Fan speed set to 0%
  - Cooler turned ON
  - Heater temperature set to 20°C
  - Heater turned OFF
- **Connection Validation**: Ensures device is connected before sending commands
- **Error Handling**: Comprehensive error handling with user-friendly messages

## 📋 Data Format

The app expects data packets with the following format:
- **Total Size**: 56 bytes
- **Header**: First 2 bytes must be `0x55 0x55`
- **Data**: Middle 52 bytes contain the actual sensor data
- **Footer**: Last 2 bytes must be `0xAA 0xAA`

The app also handles 4-byte control packets:
- Fan Speed: `[0x11, 0x11, 0x11, speed]`
- Heater Mode: `[0x22, 0x22, 0x22, mode]`
- Heater Temperature: `[0x33, 0x33, 0x33, temperature]`
- Cooler State: `[0x44, 0x44, 0x44, state]`

### Snapshot CSV Columns

When you click `Snapshot`, the app appends exactly one row to the snapshot CSV file with these columns:

- `date`: Date in `YYYY-MM-DD` format
- `time`: Time in `HH:MM:SS` format
- `timestamp_iso`: Full ISO timestamp (example: `2026-04-29T12:00:00.000Z`)
- `T1` to `T8`: Current 8 sensor temperatures
- `radial_heater_temp`: Current radial heater temperature
- `linear_heater_temp`: Current linear heater temperature
- `power_w`: Current power in watts
- `air_speed_mps`: Current air speed in meters/second
- `fan_percent`: Current fan value in percent
- `heater_off`: `true` when heater is off, otherwise `false`
- `heater_mode`: `Off`, `Linear`, or `Radial`
- `heater_slider_value`: Current heater slider setpoint
- `cooler_state`: `On` or `Off`

All numeric values in Snapshot CSV are saved with **3 decimal places**.

## 🚀 Installation

### For End Users (Recommended):

1. **Download the latest release** from [GitHub Releases](https://github.com/MuhammdAbdullah/Heat-Transfer/releases)
2. **Run the installer** - Follow the setup wizard
3. **Launch the app** - It will automatically connect to your device
4. **Start using** - All features are ready to use!

### For Developers:

1. **Install Node.js** (if not already installed):
   - Download from https://nodejs.org/
   - Choose the LTS version

2. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/MuhammdAbdullah/Heat-Transfer.git
   cd Heat-Transfer
   npm install
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

4. **Run web version** (for testing):
   ```bash
   npm run web
   ```

5. **Build for Windows**:
   ```bash
   npm run build-win
   ```

## 📖 Usage Guide

### Basic Usage

1. **Start the app** - The app will automatically attempt to connect to your device
2. **Monitor temperatures** - View real-time temperature readings from all sensors
3. **Control devices** - Use sliders and buttons to control fan, heater, and cooler
4. **View graphs** - Watch live data visualization in the charts section
5. **Export data** - Click "Start Saving" to begin CSV export with a suggested filename like `Heat Transfer Data YYYY-MM-DD HH-MM-SS.csv` (you can still rename it)
6. **Take instant snapshot** - Click `Snapshot` to append one timestamped row to `snapshot_data.csv` (first click asks where to save, next clicks reuse that path)
7. **Device reconnection** - If your device disconnects and reconnects, graphs will automatically clear and restart data collection

### Admin Panel

1. **Open Admin Panel** - Click the "🔧 Admin Panel" button or press `Ctrl+Shift+A`
2. **Configure PID Settings** - Adjust Proportional, Integral, and Derivative values
3. **Access Bootloader** - Update device firmware via USB HID bootloader
4. **View Raw Data** - Inspect raw packet data and system diagnostics

### Bootloader / Firmware Update

1. **Open Admin Panel** (click the gear icon or press Ctrl+Shift+A)
2. **Go to Bootloader Tab**
3. **Click "Connect"** to connect to the bootloader device (VID: 0x12BF, PID: 0xA1)
4. **Click "Load Hex File"** and select your firmware .hex file
5. **Click "Erase-Program-Verify"** to update the firmware
6. **Click "Run Application"** when complete to start the new firmware

### Bootloader Button Flow:

| State | Available Actions |
|-------|-------------------|
| Disconnected | Connect, Trigger Bootloader |
| Connected | Load Hex File |
| Hex File Loaded | Load Hex File, Erase-Program-Verify |
| After Update | Run Application |

### Progress Indicators:

- **Orange** - Erasing flash
- **Green** - Programming firmware
- **Blue** - Verifying CRC

### Educational Labs

1. **Open Curriculum** - Click the "📚 Curriculum" button
2. **Select Language** - Choose your preferred language from the language selector at the top of the curriculum page (English, French, German, Spanish, Dutch, or Arabic)
3. **Select Lab** - Choose from Lab 1-5 from the curriculum menu
4. **Follow Instructions** - Complete lab experiments with guided instructions in your selected language
5. **View Simulations** - Click "▶️ Visualize" to see interactive simulations (available in version 1.3.1)

**Note**: Your language preference is saved and automatically applied to all lab sheets. The language selector is only available on the curriculum page, not on individual lab sheets.
**Planned change**: The `Visualize` option is planned to be removed in the next release.

## 🔧 Troubleshooting

### Common Issues:

1. **"No ports found"**:
   - Make sure your device is connected via USB
   - Try clicking "Refresh Ports" in Admin Panel
   - Check Device Manager for COM port number
   - Verify device VID/PID matches (VID: 0x12BF, PID: 0x010C)

2. **"Connection failed"**:
   - Verify the COM port is not being used by another application
   - Check if the baud rate matches your device settings (default: 115200)
   - Ensure the device is powered on
   - Try disconnecting and reconnecting the device

3. **"Invalid packet" errors**:
   - Verify your device sends data in the expected 56-byte format
   - Check that header bytes are 0x55 0x55 and footer bytes are 0xAA 0xAA
   - Review raw data in Admin Panel to diagnose packet issues

4. **Bootloader connection issues**:
   - Ensure device is in bootloader mode (VID: 0x12BF, PID: 0xA1)
   - Check USB HID drivers are installed (see INSTALL_HID_SUPPORT.md)
   - Try disconnecting and reconnecting the device
   - Verify HEX file format is correct

5. **Update check fails**:
   - Check your internet connection
   - Portable versions may not support auto-updates - download manually from GitHub
   - Verify GitHub releases are accessible

### Development Mode:

To run with developer tools open:
```bash
npm run dev
```

## 📁 File Structure

```
Heat Transfer App/
├── main.js              # Main Electron process
├── preload.js           # Preload script for IPC
├── renderer.js          # Renderer process logic
├── index.html           # Main user interface
├── admin.html           # Admin panel interface
├── chart.html           # Graph window interface
├── curriculum.html       # Curriculum viewer
├── lab1.html            # Lab 1 experiment
├── lab2.html            # Lab 2 experiment
├── lab3.html            # Lab 3 experiment
├── lab4.html            # Lab 4 experiment
├── lab5.html            # Lab 5 experiment
├── splash.html           # Splash screen
├── server.js            # Web server (for web version)
├── package.json          # Dependencies and scripts
├── CHANGELOG.md          # Version history
├── README.md             # This file
└── assets/               # Images, icons, and 3D models
    ├── libs/             # JavaScript libraries (Three.js, Chart.js, etc.)
    └── *.png, *.ico       # Icons and images
```

## 🛠️ Customization

### Data Parsing

You can modify the data parsing in `renderer.js` in the `parseAndDisplayData()` function to match your specific device's data format.

### UI Scaling

The app includes responsive scaling that automatically adjusts to different screen sizes. You can also manually set the scale factor in the Admin Panel.

### Themes

The app uses a dark theme optimized for data visualization and extended use.

## 📦 Dependencies

### Core Dependencies:
- **Electron** (v38.2.2): Desktop app framework
- **SerialPort** (v12.0.0): COM port communication library
- **Chart.js** (v4.4.4): Data visualization and graphing
- **Express** (v4.21.2): Web server for web version
- **node-hid** (v3.1.1): USB HID device communication
- **three** (v0.181.1): 3D visualization library
- **occt-import-js** (v0.0.23): CAD file import support
- **electron-updater** (v6.6.2): Auto-update functionality

### Development Dependencies:
- **electron-builder** (v25.1.8): Application packaging
- **nodemon** (v3.1.10): Development server auto-reload

All dependencies are included in `package.json` and will be installed with `npm install`.

## 🔐 Security

- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer processes
- **Preload Scripts**: Used for secure IPC communication
- **Content Security Policy**: Implemented to prevent XSS attacks

## 📝 Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and changes.

**Current Version**: 1.3.1

### Recent Updates
- **Smart Chart Scaling**: Dynamic Y-axis step sizes and bounds for cleaner temperature (multiples of 5) and power (multiples of 5) visualization.
- **Improved UI Legibility**: Cleanly distributed X-axis ticks that prevent dates/times from overlapping or bunching up during long data collection sessions.
- **Process Management**: Automatically closes all child tabs/windows (admin, charts, labs, curriculum) when the main application window is closed to prevent hanging background tasks.
- **Hardware Accuracy**: Corrected sensor assignments in the front-end for Radial and Linear heaters to accurately match device pinouts.
- **Complete Multilingual Support**: All 5 lab sheets now fully translated in 6 languages (English, French, German, Spanish, Dutch, Arabic)
- **Language Persistence**: Language selection from curriculum page is saved and applied to all lab sheets
- **Graph Auto-Clear**: Graphs automatically clear when hardware device reconnects after disconnection
- **UI Improvements**: Updated Control section heading styling

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with Electron.js
- Uses Chart.js for data visualization
- Three.js for 3D model rendering
- Matrix Thermodynamics for hardware support

## 📞 Support

For bug reports and feature requests, please visit:
https://github.com/MuhammdAbdullah/Heat-Transfer/issues

For installation help with USB HID support, see:
[INSTALL_HID_SUPPORT.md](INSTALL_HID_SUPPORT.md)

---

**Made with ❤️ for Heat Transfer Education**
