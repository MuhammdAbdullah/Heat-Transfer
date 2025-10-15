# Heat Transfer Data Reader

A simple Electron.js desktop application that reads heat transfer data from a COM port.

## Features

- **COM Port Communication**: Connect to serial devices and read 56-byte data packets
- **Data Validation**: Automatically validates packet format (0x55 0x55 header, 0xAA 0xAA footer)
- **Real-time Display**: Shows raw hex data and parsed information
- **Simple Interface**: Clean, beginner-friendly user interface
- **Data Logging**: Keeps a log of all connection events and data received

## Data Format

The app expects data packets with the following format:
- **Total Size**: 56 bytes
- **Header**: First 2 bytes must be `0x55 0x55`
- **Data**: Middle 52 bytes contain the actual data
- **Footer**: Last 2 bytes must be `0xAA 0xAA`

## Installation

1. **Install Node.js** (if not already installed):
   - Download from https://nodejs.org/
   - Choose the LTS version

2. **Install dependencies**:
   ```bash
   cd "E:\Thermo\Heat Transfer App"
   npm install
   ```

3. **Run the application**:
   ```bash
   npm start
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
