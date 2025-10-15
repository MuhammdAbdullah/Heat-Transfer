// This is the main Electron process file
// It creates the app window and handles the main application logic

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');

// Keep a global reference of the window object
let mainWindow;
let serialPort = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,        // Security: Disable node integration
      contextIsolation: true,        // Security: Enable context isolation
      preload: path.join(__dirname, 'preload.js')  // Load our preload script
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Optional icon
    title: 'Heat Transfer Data Reader'
  });

  // Load the HTML file
  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', function () {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On macOS, re-create a window when the dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for serial port communication
ipcMain.handle('get-available-ports', async () => {
  try {
    const ports = await SerialPort.list();
    return ports.map(port => ({
      path: port.path,
      manufacturer: port.manufacturer || 'Unknown',
      serialNumber: port.serialNumber || 'Unknown'
    }));
  } catch (error) {
    console.error('Error getting available ports:', error);
    return [];
  }
});

ipcMain.handle('connect-to-port', async (event, portPath, baudRate) => {
  try {
    // Close existing connection if any
    if (serialPort && serialPort.isOpen) {
      await serialPort.close();
    }

    // Create new serial port connection
    serialPort = new SerialPort({
      path: portPath,
      baudRate: parseInt(baudRate),
      autoOpen: false
    });

    // Open the port
    await new Promise((resolve, reject) => {
      serialPort.open((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Set up data listener
    serialPort.on('data', (data) => {
      // Send data to renderer process
      if (mainWindow) {
        mainWindow.webContents.send('data-received', data);
      }
    });

    // Set up error listener
    serialPort.on('error', (error) => {
      console.error('Serial port error:', error);
      if (mainWindow) {
        mainWindow.webContents.send('connection-status', { connected: false, error: error.message });
      }
    });

    // Send connection success
    if (mainWindow) {
      mainWindow.webContents.send('connection-status', { connected: true, port: portPath });
    }

    return { success: true, port: portPath };
  } catch (error) {
    console.error('Error connecting to port:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-from-port', async () => {
  try {
    if (serialPort && serialPort.isOpen) {
      await serialPort.close();
      serialPort = null;
      
      if (mainWindow) {
        mainWindow.webContents.send('connection-status', { connected: false });
      }
      
      return { success: true };
    }
    return { success: true, message: 'No active connection' };
  } catch (error) {
    console.error('Error disconnecting from port:', error);
    return { success: false, error: error.message };
  }
});
