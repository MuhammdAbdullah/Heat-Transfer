# Changelog

All notable changes to the Heat Transfer App will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- None

## [1.3.4] - 2026-04-29

### Changed
- Updated version for new release

## [1.3.1] - 2024-12-19

### Changed
- Updated version for new release

## [1.2.8] - 2024-12-19

### Changed
- Updated version for new release

## [1.2.7] - Previous Release

### Changed
- Version update

## [1.2.6] - 2024-12-10

### Fixed
- Fixed Matrix logo not displaying in main window (corrected image path)
- Fixed app icon showing as generic Electron icon (created proper 256x256 icon.ico)
- App now displays custom icon in Windows Start menu, taskbar, and installer

## [1.2.5] - 2024-12-08

### Changed
- Updated version number for new release

## [1.2.4] - 2024-12-08

### Fixed
- Changed Left Cooler button to always turn cooler ON instead of toggling between ON/OFF
- Cooler button now works properly as a cooling device - button press always activates cooling mode
- Removed toggle behavior from cooler button for more predictable operation

## [1.2.3] - 2024-12-08

### Added
- Modern UI with glassmorphism design for control cards
- Enhanced visual feedback for fan and heater controls
- Temperature vs Distance graph with customizable distance inputs
- CSV data export functionality with Start/Stop saving buttons
- Chart display modes (Limited Points vs All Data Points)
- Open Graph window feature for better data visualization
- Admin Panel with advanced controls
- PID control settings for precise temperature management
- Real-time device data chart using Chart.js
- System status indicator (Online/Offline)
- Last update timestamp display
- Dark theme support
- Visualize button for simulation mode

### Changed
- Improved control layout with 3-column grid design
- Enhanced slider controls with custom thumb icons and animations
- Better responsive design for tablets and mobile devices
- Modernized button styles with gradient backgrounds
- Updated color scheme with better contrast and accessibility

### Fixed
- Improved packet validation and data processing
- Better error handling for serial port communication
- Fixed cooler button state management
- Enhanced connection monitoring and auto-reconnect logic

## [1.1.0] - Previous Release

### Added
- USB HID Bootloader support for firmware updates
  - Load Intel HEX files
  - Erase, Program, and Verify flash memory
  - Progress bar with real-time status updates
  - CRC verification for firmware integrity
- Auto-update functionality from GitHub releases
- Bootloader progress indicators (Orange: Erasing, Green: Programming, Blue: Verifying)
- Admin Panel with bootloader controls
- Run Application button to exit bootloader mode

### Changed
- Improved bootloader protocol with DLE escaping
- Enhanced frame building and validation
- Better CRC16 calculation matching C code implementation

### Fixed
- USB HID device connection and disconnection handling
- Bootloader response processing with proper timeout handling
- Flash verification with correct address calculation

## [1.0.0] - Initial Release

### Added
- COM Port Communication for serial devices
- Real-time data reading with 56-byte packet format
- Data validation (0x55 0x55 header, 0xAA 0xAA footer)
- Raw hex data display
- Parsed data interpretation
- Connection logging
- Simple beginner-friendly interface
- Fan speed control (0-100%)
- Heater temperature control (20-70°C)
- Heater mode selection (Off, Radial Heater, Linear Heater)
- Left Cooler toggle control
- Auto-connect to target device (VID: 0x12BF, PID: 0x010C)
- Connection monitoring with automatic disconnect detection
- Safety shutdown commands on window close:
  - Fan speed set to 0%
  - Cooler turned ON
  - Heater temperature set to 20°C
  - Heater turned OFF
- Hot-plug detection for automatic reconnection
- Windows WMI fallback for port detection
- Splash screen on startup
- Temperature sensor display (T1-T8)
- Radial and Linear heater temperature monitoring
- Power and Air Speed display tiles

### Dependencies
- Electron v38.2.2
- SerialPort v12.0.0
- Chart.js v4.4.4
- Express v4.21.2
- Node-HID v3.1.1
- Three.js v0.181.1
- Electron-updater v6.6.2

---

## How to Update

### For End Users:
1. Download the latest release from [GitHub Releases](https://github.com/MuhammdAbdullah/Heat-Transfer/releases)
2. Run the new executable
3. The app will automatically check for updates on startup

### For Developers:
1. Pull the latest changes: `git pull origin main`
2. Update dependencies: `npm install`
3. Run the app: `npm start`
4. Build for Windows: `npm run build-win`

---

## Support

For bug reports and feature requests, please visit:
https://github.com/MuhammdAbdullah/Heat-Transfer/issues
