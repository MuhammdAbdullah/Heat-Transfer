# Heat Transfer Data Reader

A simple Electron.js desktop application that reads heat transfer data from a COM port with USB HID bootloader support for firmware updates.

## 📥 Download & Install

**Latest Release: [v1.1.0](https://github.com/MuhammdAbdullah/Heat-Transfer/releases/latest)**

1. Go to [Releases](https://github.com/MuhammdAbdullah/Heat-Transfer/releases)
2. Download `Heat Transfer App 1.1.0.exe` (Windows)
3. Run the executable - no installation required!
4. The app will automatically check for updates when you start it

## Features

- **COM Port Communication**: Connect to serial devices and read 56-byte data packets
- **Data Validation**: Automatically validates packet format (0x55 0x55 header, 0xAA 0xAA footer)
- **Real-time Display**: Shows raw hex data and parsed information
- **Simple Interface**: Clean, beginner-friendly user interface
- **Data Logging**: Keeps a log of all connection events and data received
- **USB HID Bootloader**: Full firmware update support via USB HID
  - Load Intel HEX files
  - Erase, Program, and Verify flash memory
  - Progress bar with real-time status updates
  - CRC verification to ensure firmware integrity
- **Auto-Updates**: Automatically checks for new versions from GitHub releases
- **Admin Panel**: Advanced controls including PID settings, bootloader, and system monitoring

## Data Format

The app expects data packets with the following format:
- **Total Size**: 56 bytes
- **Header**: First 2 bytes must be `0x55 0x55`
- **Data**: Middle 52 bytes contain the actual data
- **Footer**: Last 2 bytes must be `0xAA 0xAA`

## Installation

### For End Users (Recommended):

1. **Download the latest release** from [GitHub Releases](https://github.com/MuhammdAbdullah/Heat-Transfer/releases)
2. **Run the executable** - No installation needed! It's a portable application.
3. **Connect your device** and start using the app.

### For Developers:

1. **Install Node.js** (if not already installed):
   - Download from https://nodejs.org/
   - Choose the LTS version

2. **Install dependencies**:
   ```bash
   git clone https://github.com/MuhammdAbdullah/Heat-Transfer.git
   cd Heat-Transfer
   npm install
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

4. **Build for Windows**:
   ```bash
   npm run build-win
   ```

## Usage

1. **Start the app** by running `npm start`
2. **Click "Refresh Ports"** to see available COM ports
3. **Select your COM port** from the dropdown
4. **Choose baud rate** (default: 115200)
5. **Click "Connect"** to establish connection
6. **View incoming data** in the interface:
   - Raw hex data display
   - Parsed data interpretation
   - Connection log

## Bootloader / Firmware Update

The app includes a USB HID bootloader for updating device firmware:

### How to Update Firmware:

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

## Troubleshooting

### Common Issues:

1. **"No ports found"**:
   - Make sure your device is connected
   - Try clicking "Refresh Ports"
   - Check device manager for COM port number

2. **"Connection failed"**:
   - Verify the COM port is not being used by another application
   - Check if the baud rate matches your device settings
   - Ensure the device is powered on

3. **"Invalid packet" errors**:
   - Verify your device sends data in the expected 56-byte format
   - Check that header bytes are 0x55 0x55 and footer bytes are 0xAA 0xAA

### Development Mode:

To run with developer tools open:
```bash
npm run dev
```

## File Structure

```
E:\Thermo\Heat Transfer App\
├── main.js          # Main Electron process
├── index.html       # User interface
├── styles.css       # App styling
├── renderer.js      # COM port communication logic
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

## Customization

You can modify the data parsing in `renderer.js` in the `parseAndDisplayData()` function to match your specific device's data format.

## Dependencies

- **Electron**: Desktop app framework
- **SerialPort**: COM port communication library

Both dependencies are included in package.json and will be installed with `npm install`.
