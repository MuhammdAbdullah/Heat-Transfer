// This is the main Electron process file
// It creates the app window and handles the main application logic

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { SerialPort } = require('serialport');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');
const HID = require('node-hid');


// Keep a global reference of the window object
let mainWindow;
let splashWindow;
let splashStartTime = 0; // Track when splash screen was shown
let adminWindow = null; // Track admin panel window to prevent multiple windows
let serialPort = null;
let usbHidDevice = null; // Track USB HID device for bootloader
let rxBuffer = Buffer.alloc(0);
let bootloaderRxBuffer = Buffer.alloc(0); // Buffer for bootloader responses
let bootloaderResponsePromise = null; // Promise to resolve when response is received
let bootloaderResponseData = null; // Store the response data
let portsPollIntervalId = null;
let connectionMonitorIntervalId = null;
let lastKnownPorts = [];
let isConnected = false;
let lastDataTime = 0;
let connectionTimeout = 10000; // 10 seconds timeout for connection loss
const TARGET_VENDOR_ID = '12BF';
const TARGET_PRODUCT_ID = '010C';

function createSplashScreen() {
  // Create the splash screen window
  splashWindow = new BrowserWindow({
    width: 800,
    height: 400,
    frame: false,                    // Remove window frame
    alwaysOnTop: true,              // Keep on top
    transparent: true,              // Make background transparent
    resizable: false,               // Not resizable
    skipTaskbar: true,              // Don't show in taskbar
    icon: path.join(__dirname, 'assets', 'favicon.ico'),  // Window icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load splash screen HTML
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  
  // Show splash screen immediately and track start time
  splashWindow.show();
  splashStartTime = Date.now();
  
  // Center the splash screen
  splashWindow.center();
  
  return splashWindow;
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,                     // Don't show until ready
    autoHideMenuBar: true,           // Hide menu bar
    icon: path.join(__dirname, 'assets', 'favicon.ico'),  // Window icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Handle child windows opened with window.open() (Curriculum, Lab windows, etc.)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Check if this is the simulation window (needs specific size)
    const isSimulationWindow = url.includes('simulation.html');
    
    // Default window options for most windows
    let windowOptions = {
      width: 1500,
      height: 850,
      resizable: true,
      icon: path.join(__dirname, 'assets', 'favicon.ico'),
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    };
    
    // Special configuration for simulation window (maximized)
    if (isSimulationWindow) {
      windowOptions = {
        width: 1920,
        height: 1080,
        resizable: true,
        icon: path.join(__dirname, 'assets', 'favicon.ico'),
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      };
    }
    
    return {
      action: 'allow',
      overrideBrowserWindowOptions: windowOptions
    };
  });
  
  // Maximize simulation window when it's created
  mainWindow.webContents.on('did-create-window', (childWindow, details) => {
    if (details.url && details.url.includes('simulation.html')) {
      childWindow.once('ready-to-show', () => {
        childWindow.maximize();
      });
    }
  });

  // Show window when ready (with minimum splash screen display time)
  const minSplashTime = 3000; // Show splash for at least 3 seconds
  
  mainWindow.once('ready-to-show', () => {
    const elapsedTime = Date.now() - splashStartTime;
    const remainingTime = Math.max(0, minSplashTime - elapsedTime);
    
    // Wait for remaining time before showing main window
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      // Maximize the window (full window, not fullscreen)
      mainWindow.maximize();
    }, remainingTime);
  });

  // Handle window closed
  mainWindow.on('close', async (event) => {
    // Prevent immediate closing to allow safety commands to complete
    event.preventDefault();
    
    // Safety: Send shutdown commands before window closes
    try {
      if (serialPort && serialPort.isOpen) {
        console.log('Safety: Sending shutdown commands before window close...');
        
        // 1. Fan speed 0
        const fanBytes = [0x3A, 0x46, 0x00, 0x3B, 0x0A]; // :F0;\n
        console.log('Sending fan stop bytes:', fanBytes);
        const fanPayload = Buffer.from(fanBytes);
        await new Promise((resolve, reject) => {
          serialPort.write(fanPayload, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        console.log('Fan stop command sent');
        
        // Delay between commands
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 2. Left cooler value 1 (turn on cooler)
        const coolerBytes = [0x3A, 0x50, 0x01, 0x3B, 0x0A]; // :P1;\n
        console.log('Sending cooler on bytes:', coolerBytes);
        const coolerPayload = Buffer.from(coolerBytes);
        await new Promise((resolve, reject) => {
          serialPort.write(coolerPayload, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        console.log('Cooler on command sent');
        
        // Delay between commands
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 3. Heater temperature to 20°C
        const heaterTempBytes = [0x3A, 0x54, 0x14, 0x3B, 0x0A]; // :T20;\n
        console.log('Sending heater temp 20°C bytes:', heaterTempBytes);
        const heaterTempPayload = Buffer.from(heaterTempBytes);
        await new Promise((resolve, reject) => {
          serialPort.write(heaterTempPayload, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        console.log('Heater temp 20°C command sent');
        
        // Delay between commands
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 4. Heater off
        const heaterOffBytes = [0x3A, 0x48, 0x00, 0x3B, 0x0A]; // :H0;\n
        console.log('Sending heater off bytes:', heaterOffBytes);
        const heaterOffPayload = Buffer.from(heaterOffBytes);
        await new Promise((resolve, reject) => {
          serialPort.write(heaterOffPayload, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        console.log('Heater off command sent');
        
        console.log('All safety shutdown commands sent successfully');
      } else {
        console.log('Serial port not available during window close');
      }
    } catch (error) {
      console.error('Error sending safety shutdown commands:', error);
    }
    
    // Now allow the window to close
    mainWindow.destroy();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, let user choose
autoUpdater.autoInstallOnAppQuit = false; // Don't auto-install

// For electron-updater v6+, GitHub provider is automatically detected from package.json publish config
// No manual configuration needed - it will use GitHub releases automatically
if (app.isPackaged) {
  console.log('[UPDATE] Updater initialized - will use GitHub releases from package.json config');
}

// Helper function to send update status to all windows
function sendUpdateStatusToAllWindows(updateInfo) {
  // Send to all open windows (including main window and admin panel)
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(window => {
    if (window && !window.isDestroyed() && window.webContents) {
      try {
        window.webContents.send('update-status', updateInfo);
      } catch (error) {
        console.error('[UPDATE] Error sending update status to window:', error);
      }
    }
  });
}

// Helper function to send connection status to all windows
function sendConnectionStatusToAllWindows(status) {
  // Send to all open windows (including main window and admin panel)
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(window => {
    if (window && !window.isDestroyed() && window.webContents) {
      try {
        window.webContents.send('connection-status', status);
      } catch (error) {
        console.error('[CONNECTION] Error sending connection status to window:', error);
      }
    }
  });
}

// Helper function to send bootloader progress to all windows
function sendBootloaderProgressToAllWindows(progressData) {
  // progressData: { step: 'erase'|'program'|'verify', progress: 0-100, label: 'description' }
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(window => {
    if (window && !window.isDestroyed() && window.webContents) {
      try {
        window.webContents.send('bootloader-progress', progressData);
      } catch (error) {
        console.error('[BOOTLOADER] Error sending progress to window:', error);
      }
    }
  });
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('[UPDATE] Checking for updates...');
  sendUpdateStatusToAllWindows({ 
    status: 'checking', 
    message: 'Checking for updates...' 
  });
});

autoUpdater.on('update-available', (info) => {
  console.log('[UPDATE] Update available:', info.version);
  
  // Send to all windows
  sendUpdateStatusToAllWindows({ 
    status: 'available', 
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
    message: `Version ${info.version} is available!`
  });
  
  // Show update dialog to user (use main window or first available window)
  const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getAllWindows()[0];
  if (targetWindow) {
    dialog.showMessageBox(targetWindow, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version is available!',
      detail: `Version ${info.version} is now available. Would you like to download and install it?`,
      buttons: ['Yes', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // User clicked "Yes" - download update
        autoUpdater.downloadUpdate();
        sendUpdateStatusToAllWindows({ 
          status: 'downloading', 
          message: 'Downloading update...' 
        });
      }
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[UPDATE] Update not available. Current version is latest.');
  sendUpdateStatusToAllWindows({ 
    status: 'not-available', 
    message: 'You are using the latest version.',
    currentVersion: app.getVersion()
  });
});

autoUpdater.on('error', (err) => {
  console.error('[UPDATE] Error in auto-updater:', err);
  
  // Provide user-friendly error message
  let errorMessage = 'Error checking for updates: ' + err.message;
  
  // If it's looking for local files (common with portable apps), give helpful message
  if (err.message && (err.message.includes('app-update.yml') || err.message.includes('ENOENT'))) {
    errorMessage = 'Auto-updates not supported for portable version. Please download the latest version from GitHub releases.';
  }
  
  sendUpdateStatusToAllWindows({ 
    status: 'error', 
    message: errorMessage,
    githubUrl: 'https://github.com/MuhammdAbdullah/Heat-Transfer/releases'
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  const message = `Downloading: ${percent}% (${Math.round(progressObj.bytesPerSecond / 1024)} KB/s)`;
  console.log('[UPDATE]', message);
  
  // Send progress to all windows
  sendUpdateStatusToAllWindows({ 
    status: 'downloading', 
    percent: percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total,
    message: message
  });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[UPDATE] Update downloaded');
  
  // Send to all windows
  sendUpdateStatusToAllWindows({ 
    status: 'downloaded', 
    version: info.version,
    message: 'Update downloaded successfully! Ready to install.'
  });
  
  // Show dialog asking user to restart (use main window or first available window)
  const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getAllWindows()[0];
  if (targetWindow) {
    dialog.showMessageBox(targetWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: 'The application will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // User clicked "Restart Now"
        autoUpdater.quitAndInstall();
      }
    });
  }
});

// Global handler to set icon for all windows (including child windows)
app.on('browser-window-created', (event, window) => {
  // Set icon for any new window that gets created
  window.setIcon(path.join(__dirname, 'assets', 'favicon.ico'));
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Create splash screen first
  createSplashScreen();
  
  // Create main window
  createWindow();

  // Auto-detect and connect to target device
  setTimeout(() => {
    autoConnectToTargetDevice();
    // Start port polling for hot-plug detection
    startPortPolling();
    // Start connection monitoring
    startConnectionMonitoring();
  }, 2000); // Wait 2 seconds for splash screen

  // Check for updates after app is ready (only in production)
  setTimeout(() => {
    if (app.isPackaged) {
      console.log('[UPDATE] Checking for updates on startup...');
      autoUpdater.checkForUpdatesAndNotify();
    } else {
      console.log('[UPDATE] Running in development mode - skipping update check');
    }
  }, 5000); // Wait 5 seconds after app starts

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});



// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Clean up monitoring
    stopPortPolling();
    stopConnectionMonitoring();
    
    app.quit();
  }
});

// Auto-connect to target device
async function autoConnectToTargetDevice() {
  try {
    const ports = await getPortsWithFallback();
    const targetPort = ports.find(port => 
      port.vendorId && port.productId && 
      port.vendorId.toUpperCase() === TARGET_VENDOR_ID && 
      port.productId.toUpperCase() === TARGET_PRODUCT_ID
    );

    if (targetPort) {
      console.log(`[AUTO] Matching device found (VID: ${targetPort.vendorId} PID: ${targetPort.productId}) on ${targetPort.path}`);
      console.log(`[AUTO/IPC] connect requested: ${targetPort.path} 115200`);
      
      const result = await connectSerial(targetPort.path, 115200);
      if (result.success) {
        console.log(`[AUTO] Successfully connected to ${targetPort.path}`);
        isConnected = true;
      } else {
        console.log(`[AUTO] Failed to connect to ${targetPort.path}: ${result.error}`);
        // Schedule retry in 5 seconds if connection failed
        setTimeout(() => {
          console.log('[AUTO] Retrying connection in 5 seconds...');
          autoConnectToTargetDevice();
        }, 5000);
      }
    } else {
      console.log('[AUTO] No matching device found - will keep checking every 10 seconds');
      // Schedule retry in 10 seconds if no device found
      setTimeout(() => {
        console.log('[AUTO] Checking for device again...');
        autoConnectToTargetDevice();
      }, 10000);
    }
  } catch (error) {
    console.error('[AUTO] Error during auto-connect:', error);
    // Schedule retry in 10 seconds if there was an error
    setTimeout(() => {
      console.log('[AUTO] Retrying after error in 10 seconds...');
      autoConnectToTargetDevice();
    }, 10000);
  }
}


// Get available ports with fallback methods
async function getPortsWithFallback() {
  try {
    // Try the standard method first
    const ports = await SerialPort.list();
    if (ports && ports.length > 0) {
      return ports;
    }
  } catch (e) {
    console.warn('Standard port listing failed:', e && e.message ? e.message : e);
  }

  // Fallback to WMI on Windows
  if (process.platform === 'win32') {
    try {
      const results = await getPortsFromWMI();
      if (results.length > 0) {
        return results;
      }
    } catch (e) {
      console.warn('WMI fallback failed:', e && e.message ? e.message : e);
    }
  }

  return [];
}


// Windows WMI fallback for port detection
function getPortsFromWMI() {
  return new Promise((resolve, reject) => {
    exec('wmic path Win32_SerialPort get DeviceID,Description,PNPDeviceID /format:csv', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      const results = [];

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 4) {
          const deviceId = parts[1]?.trim();
          const description = parts[2]?.trim();
          const pnpDeviceId = parts[3]?.trim();

          if (deviceId && deviceId.startsWith('COM')) {
            results.push({
              path: deviceId,
              manufacturer: 'Unknown',
              serialNumber: 'Unknown',
              pnpId: pnpDeviceId,
              locationId: 'Unknown',
              vendorId: 'Unknown',
              productId: 'Unknown'
            });
          }
        }
      }

      resolve(results);
    });
  });
}

// Connect to serial port
async function connectSerial(portPath, baudRate) {
  try {
    // Close existing connection if any
    if (serialPort && serialPort.isOpen) {
      await new Promise((resolve) => {
        serialPort.close(() => resolve());
      });
    }

    // Create new serial port connection
    serialPort = new SerialPort({
      path: portPath,
      baudRate: parseInt(baudRate),
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false
    });

    // Set up data handler
    serialPort.on('data', (data) => {
      lastDataTime = Date.now(); // Update last data time
      rxBuffer = Buffer.concat([rxBuffer, data]);
      
      // Send raw data to renderer
      if (mainWindow) {
        mainWindow.webContents.send('data-chunk', data.toString('hex'));
      }
      
      // Process complete packets (for normal data)
      processRxBuffer();
    });

    // Set up error handler
    serialPort.on('error', (err) => {
      console.error('Serial port error:', err);
      sendConnectionStatusToAllWindows({ connected: false, error: err.message });
    });

    // Open the port
    await new Promise((resolve, reject) => {
      serialPort.open((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Update connection state
    isConnected = true;
    lastDataTime = Date.now();
    
    // Send connection status to all windows
    sendConnectionStatusToAllWindows({ connected: true, port: portPath, baudRate: baudRate });

    return { success: true, port: portPath, baudRate: baudRate };
  } catch (error) {
    console.error('Error connecting to serial port:', error);
    return { success: false, error: error.message };
  }
}

// Process received data buffer
function processRxBuffer() {
  // First, check for 4-byte packets [0x11, 0x11, 0x11, data] or [0x22, 0x22, 0x22, data]
  while (rxBuffer.length >= 4) {
    // Check if this is a 4-byte fan speed packet
    if (rxBuffer[0] === 0x11 && rxBuffer[1] === 0x11 && rxBuffer[2] === 0x11) {
      const fanSpeedPacket = rxBuffer.slice(0, 4);
      console.log('4-byte fan speed packet received:', fanSpeedPacket.toString('hex'));
      
      // Send to renderer
      if (mainWindow) {
        mainWindow.webContents.send('data-received', fanSpeedPacket);
      }
      
      // Remove the 4-byte packet from buffer
      rxBuffer = rxBuffer.slice(4);
      continue;
    }
    // Check if this is a 4-byte heater mode packet
    else if (rxBuffer[0] === 0x22 && rxBuffer[1] === 0x22 && rxBuffer[2] === 0x22) {
      const heaterModePacket = rxBuffer.slice(0, 4);
      console.log('4-byte heater mode packet received:', heaterModePacket.toString('hex'));
      
      // Send to renderer
      if (mainWindow) {
        mainWindow.webContents.send('data-received', heaterModePacket);
      }
      
      // Remove the 4-byte packet from buffer
      rxBuffer = rxBuffer.slice(4);
      continue;
    }
    // Check if this is a 4-byte heater temperature packet
    else if (rxBuffer[0] === 0x33 && rxBuffer[1] === 0x33 && rxBuffer[2] === 0x33) {
      const heaterTempPacket = rxBuffer.slice(0, 4);
      console.log('4-byte heater temperature packet received:', heaterTempPacket.toString('hex'));
      
      // Send to renderer
      if (mainWindow) {
        mainWindow.webContents.send('data-received', heaterTempPacket);
      }
      
      // Remove the 4-byte packet from buffer
      rxBuffer = rxBuffer.slice(4);
      continue;
    }
    // Check if this is a 4-byte cooler state packet
    else if (rxBuffer[0] === 0x44 && rxBuffer[1] === 0x44 && rxBuffer[2] === 0x44) {
      const coolerStatePacket = rxBuffer.slice(0, 4);
      console.log('4-byte cooler state packet received:', coolerStatePacket.toString('hex'));
      
      // Send to renderer
      if (mainWindow) {
        mainWindow.webContents.send('data-received', coolerStatePacket);
      }
      
      // Remove the 4-byte packet from buffer
      rxBuffer = rxBuffer.slice(4);
      continue;
    } else {
      // Not a 4-byte packet, break to check for 56-byte packets
      break;
    }
  }
  
  // Look for complete 56-byte packets with proper headers and footers
  while (rxBuffer.length >= 56) {
    // Find sync header 0x55 0x55
    let startIdx = -1;
    for (let i = 0; i <= rxBuffer.length - 2; i++) {
      if (rxBuffer[i] === 0x55 && rxBuffer[i + 1] === 0x55) {
        startIdx = i;
        break;
      }
    }
    
    if (startIdx < 0) {
      // No header found; discard all but last byte to avoid unbounded growth
      rxBuffer = rxBuffer.slice(rxBuffer.length - 1);
      break;
    }
    
    // If not enough bytes after header for a full 56-byte frame, wait for more
    if (rxBuffer.length < startIdx + 56) {
      // Keep buffer from header onwards
      rxBuffer = rxBuffer.slice(startIdx);
      break;
    }
    
    // Candidate frame
    const frame = rxBuffer.slice(startIdx, startIdx + 56);
    
    // Validate footer 0xAA 0xAA at bytes 54..55
    if (frame[54] === 0xAA && frame[55] === 0xAA) {
      // Send binary data to renderer
      if (mainWindow) {
        mainWindow.webContents.send('data-received', frame);
      }
      // Remove consumed bytes
      rxBuffer = rxBuffer.slice(startIdx + 56);
      // Continue to look for more frames
      continue;
    } else {
      // Bad footer; skip this header and continue scanning
      rxBuffer = rxBuffer.slice(startIdx + 1);
    }
  }
}

// Start polling for port changes
function startPortPolling() {
  if (portsPollIntervalId) {
    clearInterval(portsPollIntervalId);
  }
  
  portsPollIntervalId = setInterval(async () => {
    try {
      const currentPorts = await getPortsWithFallback();
      const currentPaths = currentPorts.map(p => p.path).sort();
      const lastPaths = lastKnownPorts.map(p => p.path).sort();
      
      // Check if port list changed
      if (JSON.stringify(currentPaths) !== JSON.stringify(lastPaths)) {
        console.log('[PORT POLL] Port list changed');
        lastKnownPorts = currentPorts;
        if (mainWindow) {
          mainWindow.webContents.send('ports-update', currentPorts);
        }
        
        // Check for target device hot-plug (normal mode)
        const targetPort = currentPorts.find(port => 
          port.vendorId && port.productId && 
          port.vendorId.toUpperCase() === TARGET_VENDOR_ID && 
          port.productId.toUpperCase() === TARGET_PRODUCT_ID
        );
        
        if (targetPort && !isConnected) {
          console.log('[HOT-PLUG] Target device detected, attempting auto-connect');
          const result = await connectSerial(targetPort.path, 115200);
          if (result.success) {
            console.log('[HOT-PLUG] Successfully connected to', targetPort.path);
            isConnected = true;
          } else {
            console.log('[HOT-PLUG] Failed to connect:', result.error);
            // Schedule retry in 3 seconds for hot-plug attempts
            setTimeout(() => {
              console.log('[HOT-PLUG] Retrying hot-plug connection...');
              autoConnectToTargetDevice();
            }, 3000);
          }
        }
      }
    } catch (error) {
      console.error('Error polling ports:', error);
    }
  }, 2000); // Poll every 2 seconds
}

// Stop polling for port changes
function stopPortPolling() {
  if (portsPollIntervalId) {
    clearInterval(portsPollIntervalId);
    portsPollIntervalId = null;
  }
}

// Start connection monitoring
function startConnectionMonitoring() {
  if (connectionMonitorIntervalId) {
    clearInterval(connectionMonitorIntervalId);
  }
  
  connectionMonitorIntervalId = setInterval(async () => {
    if (!isConnected) {
      return; // Not connected, nothing to monitor
    }
    
    // Handle Serial Port monitoring
    if (serialPort) {
      // Check if port is still open
      if (!serialPort.isOpen) {
        console.log('[CONNECTION MONITOR] Serial port closed, disconnecting');
        isConnected = false;
        sendConnectionStatusToAllWindows({ connected: false, error: 'Port closed' });
        return;
      }
    }
  }, 1000); // Check every second
}

// Stop connection monitoring
function stopConnectionMonitoring() {
  if (connectionMonitorIntervalId) {
    clearInterval(connectionMonitorIntervalId);
    connectionMonitorIntervalId = null;
  }
}

// Process bootloader response data from USB HID (matching C code BuildRxFrame)
// Handles DLE escaping: DLE before SOH, EOT, or DLE means treat next byte as data
// Note: Device responses may or may not include SOH - handle both cases
function processBootloaderResponse(data) {
  // USB HID sends fixed 64-byte packets with zero padding after EOT
  // Find the actual data by looking for EOT and trimming padding
  // Each USB packet contains exactly ONE complete frame
  
  // Trim trailing zeros (padding) from the incoming data
  let trimmedLength = data.length;
  while (trimmedLength > 0 && data[trimmedLength - 1] === 0x00) {
    trimmedLength--;
  }
  
  // If the last non-zero byte is EOT, include it
  if (trimmedLength > 0 && trimmedLength < data.length) {
    // Keep the actual frame data only
    data = data.slice(0, trimmedLength);
  }
  
  // Clear previous buffer and use fresh data for each USB packet
  // USB HID always sends complete frames in one packet
  bootloaderRxBuffer = data;
  
  console.log(`[BOOTLOADER] Processing response data: ${bootloaderRxBuffer.toString('hex')} (${bootloaderRxBuffer.length} bytes)`);
  
  // Process frames - device may send with or without SOH
  while (bootloaderRxBuffer.length > 0) {
    // Find EOT (0x04) - end of frame marker (not escaped)
    let eotIndex = -1;
    let escape = false;
    
    for (let i = 0; i < bootloaderRxBuffer.length; i++) {
      const byte = bootloaderRxBuffer[i];
      
      if (byte === DLE && !escape) {
        escape = true;
        continue;
      }
      
      if (byte === EOT && !escape) {
        eotIndex = i;
        break;
      }
      
      escape = false;
    }
    
    if (eotIndex < 0) {
      // No EOT found yet, wait for more data
      break;
    }
    
    // Check if frame starts with SOH
    let frameStart = 0;
    if (bootloaderRxBuffer[0] === SOH) {
      frameStart = 1; // Skip SOH
    }
    
    // Need at least: CMD(1) + CRC(2) + EOT(1) = 4 bytes minimum (after SOH if present)
    if (eotIndex - frameStart < 3) {
      // Frame too short, discard and continue
      bootloaderRxBuffer = bootloaderRxBuffer.slice(eotIndex + 1);
      continue;
    }
    
    // Decode the frame data (handle DLE escaping)
    const decodedData = [];
    escape = false;
    
    for (let i = frameStart; i < eotIndex; i++) {
      const byte = bootloaderRxBuffer[i];
      
      if (byte === DLE && !escape) {
        // Escape character - next byte is data, not control
        escape = true;
        continue;
      }
      
      if (byte === SOH && !escape) {
        // Start of new frame (not escaped) - restart decoding from here
        decodedData.length = 0;
        escape = false;
        continue;
      }
      
      // This byte is data (either regular data or escaped special byte)
      decodedData.push(byte);
      escape = false;
    }
    
    // We have a complete frame, decodedData contains: CMD + DATA + CRC(2)
    if (decodedData.length < 3) {
      // Frame too short (need at least CMD + CRC)
      console.log(`[BOOTLOADER] Frame too short: ${decodedData.length} bytes`);
      bootloaderRxBuffer = bootloaderRxBuffer.slice(eotIndex + 1);
      continue;
    }
    
    const cmd = decodedData[0];
    const frameData = decodedData.slice(1, decodedData.length - 2); // DATA portion
    const crcReceived = decodedData[decodedData.length - 2] | (decodedData[decodedData.length - 1] << 8);
    
    // Calculate CRC for received data (CMD + DATA) - same as C code
    const crcPayload = Buffer.from([cmd, ...frameData]);
    const crcCalculated = calculateBootloaderCRC(crcPayload);
    
    console.log(`[BOOTLOADER] Frame: CMD=0x${cmd.toString(16)}, DATA=${Buffer.from(frameData).toString('hex') || '(empty)'}, CRC_recv=0x${crcReceived.toString(16).padStart(4, '0')}, CRC_calc=0x${crcCalculated.toString(16).padStart(4, '0')}`);
    
    if (crcCalculated === crcReceived) {
      const responseData = Buffer.from(frameData);
      console.log(`[BOOTLOADER] ✓ Valid response received for command ${cmd}, data length: ${responseData.length}`);
      if (responseData.length > 0) {
        console.log(`[BOOTLOADER] Response data: ${responseData.toString('hex')}`);
      }
      
      // Store response data and resolve waiting promise
      bootloaderResponseData = { cmd, data: responseData, success: true, responseData };
      if (bootloaderResponsePromise && bootloaderResponsePromise.resolve) {
        // Check if this is the command we're waiting for
        if (bootloaderResponsePromise.expectedCmd === cmd) {
          // Clear timeout if it exists
          if (bootloaderResponsePromise.timeoutId) {
            clearTimeout(bootloaderResponsePromise.timeoutId);
            console.log(`[BOOTLOADER] Cleared timeout for command ${cmd}`);
          }
          console.log(`[BOOTLOADER] Resolving promise for command ${cmd} with data length ${responseData.length}`);
          bootloaderResponsePromise.resolve(bootloaderResponseData);
          bootloaderResponsePromise = null;
        } else {
          console.log(`[BOOTLOADER] ⚠ Received response for command ${cmd} but waiting for command ${bootloaderResponsePromise.expectedCmd} - ignoring`);
        }
      } else {
        console.log(`[BOOTLOADER] ⚠ No promise waiting for command ${cmd} response`);
      }
      
      // For PROGRAM_FLASH responses, we need to continue sending more batches
      if (cmd === PROGRAM_FLASH) {
        if (typeof global.bootloaderProgramContinue === 'function') {
          global.bootloaderProgramContinue();
        }
      }
    } else {
      console.log(`[BOOTLOADER] ✗ Invalid CRC: calculated=0x${crcCalculated.toString(16).padStart(4, '0')}, received=0x${crcReceived.toString(16).padStart(4, '0')}`);
      console.log(`[BOOTLOADER] Decoded frame data: ${Buffer.from(decodedData).toString('hex')}`);
      // Store error response
      bootloaderResponseData = { cmd, data: null, success: false, error: 'Invalid CRC' };
      if (bootloaderResponsePromise && bootloaderResponsePromise.resolve) {
        if (bootloaderResponsePromise.timeoutId) {
          clearTimeout(bootloaderResponsePromise.timeoutId);
        }
        bootloaderResponsePromise.resolve(bootloaderResponseData);
        bootloaderResponsePromise = null;
      }
    }
    
    // Remove processed frame from buffer
    bootloaderRxBuffer = bootloaderRxBuffer.slice(eotIndex + 1);
  }
}

// IPC handlers for serial port communication
ipcMain.handle('get-available-ports', async () => {
  try {
    return await getPortsWithFallback();
  } catch (error) {
    console.error('Error getting available ports:', error);
    return [];
  }
});


ipcMain.handle('connect-to-port', async (event, portPath, baudRate) => {
  try {
    return await connectSerial(portPath, baudRate);
  } catch (error) {
    console.error('Error connecting to port:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-from-port', async () => {
  try {
    // Disconnect Serial Port
    if (serialPort && serialPort.isOpen) {
      // Safety commands are handled in before-quit event
      await new Promise((resolve) => {
        serialPort.close(() => resolve());
      });
      serialPort = null;
    }
    
    // Update connection state
    isConnected = false;
    
    sendConnectionStatusToAllWindows({ connected: false });
    
    return { success: true };
  } catch (error) {
    console.error('Error disconnecting from port:', error);
    return { success: false, error: error.message };
  }
});

// Send fan speed command over serial: format ':F<value>;\n' as individual bytes
ipcMain.handle('send-fan-speed', async (event, value) => {
  try {
    const v = Math.max(0, Math.min(100, parseInt(value)));
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected' };
    }
    // Build byte array: [0x3A, 0x46, value_byte, 0x3B, 0x0A]
    const bytes = [0x3A, 0x46]; // ':' and 'F'
    bytes.push(v); // value as single byte (0-100)
    bytes.push(0x3B, 0x0A); // ';' and '\n'
    const payload = Buffer.from(bytes);
    await new Promise((resolve, reject) => {
      serialPort.write(payload, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Send heater temperature: format ':T<value>;\n' value 20..70
ipcMain.handle('send-heater-temp', async (event, value) => {
  try {
    const v = Math.max(20, Math.min(70, parseInt(value)));
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected' };
    }
    // Build byte array: [0x3A, 0x54, value_byte, 0x3B, 0x0A]
    const bytes = [0x3A, 0x54]; // ':' and 'T'
    bytes.push(v); // value as single byte (20-70)
    bytes.push(0x3B, 0x0A); // ';' and '\n'
    const payload = Buffer.from(bytes);
    await new Promise((resolve, reject) => {
      serialPort.write(payload, (err) => { if (err) reject(err); else resolve(); });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Set heater mode: ':H<mode>;\n' where 0=off,1=left,2=right
ipcMain.handle('set-heater-mode', async (event, mode) => {
  try {
    const m = Math.max(0, Math.min(2, parseInt(mode)));
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected' };
    }
    // Build byte array: [0x3A, 0x48, mode_byte, 0x3B, 0x0A]
    const bytes = [0x3A, 0x48]; // ':' and 'H'
    bytes.push(m); // mode as single byte (0-2)
    bytes.push(0x3B, 0x0A); // ';' and '\n'
    const payload = Buffer.from(bytes);
    await new Promise((resolve, reject) => {
      serialPort.write(payload, (err) => { if (err) reject(err); else resolve(); });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Send cooler command: ':P<value>;\n' where value is 0 or 1
ipcMain.handle('send-cooler', async (event, value) => {
  try {
    const v = Math.max(0, Math.min(1, parseInt(value)));
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected' };
    }
    // Build byte array: [0x3A, 0x50, value_byte, 0x3B, 0x0A]
    const bytes = [0x3A, 0x50]; // ':' and 'P'
    bytes.push(v); // value as single byte (0 or 1)
    bytes.push(0x3B, 0x0A); // ';' and '\n'
    const payload = Buffer.from(bytes);
    await new Promise((resolve, reject) => {
      serialPort.write(payload, (err) => { if (err) reject(err); else resolve(); });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Send PID value: format ':X<4_bytes_float>;\n' for Proportional (X), ':Y<4_bytes_float>;\n' for Integral (Y), ':Z<4_bytes_float>;\n' for Differential (Z)
// Total: 8 bytes (':X' + 4 bytes float + ';\n')
ipcMain.handle('send-pid-value', async (event, type, value) => {
  try {
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected' };
    }
    
    // Determine command letter based on type
    let commandLetter;
    if (type === 'P') {
      commandLetter = 0x58; // 'X' for Proportional
    } else if (type === 'I') {
      commandLetter = 0x59; // 'Y' for Integral
    } else if (type === 'D') {
      commandLetter = 0x5A; // 'Z' for Differential
    } else {
      return { success: false, error: 'Invalid PID type' };
    }
    
    // Parse value as float
    let floatValue;
    if (typeof value === 'string') {
      value = value.trim();
      // Try to parse as float
      floatValue = parseFloat(value);
      if (isNaN(floatValue)) {
        return { success: false, error: 'Invalid value format - must be a number' };
      }
    } else {
      // If it's already a number, convert to float
      floatValue = parseFloat(value);
      if (isNaN(floatValue)) {
        return { success: false, error: 'Invalid value format - must be a number' };
      }
    }
    
    // Create a buffer to hold the float value (4 bytes)
    const floatBuffer = Buffer.allocUnsafe(4);
    floatBuffer.writeFloatLE(floatValue, 0); // Write float as little-endian (4 bytes)
    
    // Build byte array: [0x3A, commandLetter, float_byte1, float_byte2, float_byte3, float_byte4, 0x3B, 0x0A]
    const bytes = [0x3A, commandLetter]; // ':' and command letter (X, Y, or Z)
    bytes.push(floatBuffer[0], floatBuffer[1], floatBuffer[2], floatBuffer[3]); // 4 bytes of float value
    bytes.push(0x3B, 0x0A); // ';' and '\n'
    const payload = Buffer.from(bytes);
    
    await new Promise((resolve, reject) => {
      serialPort.write(payload, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    
    console.log(`PID ${type} value sent: ${floatValue} (4-byte float: ${floatBuffer.toString('hex')})`);
    return { success: true };
  } catch (e) {
    console.error(`Error sending PID ${type}:`, e);
    return { success: false, error: e.message };
  }
});

// IPC handler for showing save dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  try {
    // Get the window that made the request (could be main window or admin panel)
    const callerWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(callerWindow || mainWindow, options);
    return result;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    return { canceled: true, error: error.message };
  }
});

// IPC handler for writing file
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing file:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// BOOTLOADER PROTOCOL IMPLEMENTATION
// ============================================================================

// Bootloader protocol constants (matching C code)
const SOH = 0x01;  // Start of Header
const EOT = 0x04;  // End of Transmission
const DLE = 0x10;  // Data Link Escape

// Bootloader commands (matching C code)
const READ_BOOT_INFO = 0x01;
const ERASE_FLASH = 0x02;
const PROGRAM_FLASH = 0x03;
const READ_CRC = 0x04;
const JMP_TO_APP = 0x05;

// Bootloader state
let bootloaderHexRecords = [];
let bootloaderExpectedCRC = 0;
let bootloaderEraseProgVerify = false;
// Flash verification data (matching C code)
let bootloaderFlashStartAddress = 0;
let bootloaderFlashLength = 0;

// Constants for flash verification (matching C code)
const BOOT_SECTOR_BEGIN = 0x7FC000; // Do not write to boot sector

// Calculate CRC16 for bootloader protocol (matching C code table-driven algorithm)
const crcTable = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7,
  0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef
];

function calculateBootloaderCRC(data) {
  let crc = 0;
  let i;
  
  for (let idx = 0; idx < data.length; idx++) {
    const byte = data[idx];
    
    // Process high nibble
    i = ((crc >> 12) ^ (byte >> 4)) & 0x0F;
    crc = (crcTable[i] ^ (crc << 4)) & 0xFFFF;
    
    // Process low nibble
    i = ((crc >> 12) ^ (byte & 0x0F)) & 0x0F;
    crc = (crcTable[i] ^ (crc << 4)) & 0xFFFF;
  }
  
  return crc & 0xFFFF;
}

// Build bootloader frame: SOH + escaped(CMD + DATA + CRC) + EOT
// Matching C code: escapes SOH(0x01), EOT(0x04), DLE(0x10) by prefixing with DLE
function buildBootloaderFrame(cmd, data = Buffer.alloc(0)) {
  // First, build the payload (CMD + DATA) and calculate CRC
  const payload = Buffer.concat([Buffer.from([cmd]), data]);
  const crc = calculateBootloaderCRC(payload);
  
  // Add CRC bytes to payload
  const payloadWithCrc = Buffer.concat([
    payload, 
    Buffer.from([crc & 0xFF, (crc >> 8) & 0xFF])
  ]);
  
  // Now build the frame with escaping (matching C code exactly)
  // Worst case: every byte needs escaping, so frame could be 2x payload + 2 (SOH + EOT)
  const frame = Buffer.alloc(2 + payloadWithCrc.length * 2);
  let offset = 0;
  
  // SOH: Start of header (not escaped)
  frame[offset++] = SOH;
  
  // Insert DLE escape character before SOH, EOT, and DLE in the data
  for (let i = 0; i < payloadWithCrc.length; i++) {
    const byte = payloadWithCrc[i];
    if (byte === SOH || byte === EOT || byte === DLE) {
      frame[offset++] = DLE; // Escape character
    }
    frame[offset++] = byte;
  }
  
  // EOT: End of transmission (not escaped)
  frame[offset++] = EOT;
  
  // Return only the used portion of the buffer
  return frame.slice(0, offset);
}

// Parse Intel HEX file
// Returns ALL records in the format expected by the C code bootloader:
// Each record is the raw hex record bytes: [length, addr_high, addr_low, type, data..., checksum]
// IMPORTANT: Must include ALL record types (data, extended address, etc.) - not just data records!
function parseHexFile(hexContent) {
  const lines = hexContent.split('\n').filter(line => line.trim().length > 0);
  const records = [];
  
  for (const line of lines) {
    if (line[0] !== ':') continue; // Skip invalid lines
    
    // Convert the entire hex record (after ':') to bytes
    // Format: length(1) + address(2) + type(1) + data(N) + checksum(1)
    const hexData = line.substr(1).trim(); // Remove ':' and whitespace
    const matches = hexData.match(/.{1,2}/g);
    if (!matches) continue;
    
    const recordBytes = Buffer.from(matches.map(b => parseInt(b, 16)));
    
    if (recordBytes.length < 5) continue; // Invalid record (minimum: length + addr + type + checksum)
    
    const byteCount = recordBytes[0];
    const address = (recordBytes[1] << 8) | recordBytes[2];
    const recordType = recordBytes[3];
    
    // Record type 0x01 = End of File - stop parsing
    if (recordType === 0x01) {
      console.log(`[BOOTLOADER] Hex file parsing complete: ${records.length} records`);
      break;
    }
    
    // Include ALL record types for bootloader (not just data records!)
    // Type 0x00 = Data Record
    // Type 0x02 = Extended Segment Address Record (sets upper 16 bits of address)
    // Type 0x04 = Extended Linear Address Record (sets upper 16 bits of address)
    // The bootloader needs these address records to know WHERE to write data!
    
    // Extract data bytes (if any)
    const dataBytes = byteCount > 0 ? recordBytes.slice(4, 4 + byteCount) : Buffer.alloc(0);
    
    // Store record for bootloader
    records.push({ 
      address, 
      rawRecord: recordBytes, // Raw hex record bytes sent to bootloader
      data: dataBytes,        // Just the data portion
      type: recordType 
    });
    
    // Log extended address records for debugging
    if (recordType === 0x02) {
      const extSegAddr = ((dataBytes[0] << 8) | dataBytes[1]) << 4;
      console.log(`[BOOTLOADER] Extended Segment Address: 0x${extSegAddr.toString(16).padStart(8, '0')}`);
    } else if (recordType === 0x04) {
      const extLinAddr = ((dataBytes[0] << 8) | dataBytes[1]) << 16;
      console.log(`[BOOTLOADER] Extended Linear Address: 0x${extLinAddr.toString(16).padStart(8, '0')}`);
    }
  }
  
  console.log(`[BOOTLOADER] Parsed ${records.length} hex records (including address records)`);
  return records;
}

// Calculate flash CRC from HEX file (matching C code logic exactly)
// This creates a "virtual flash" and calculates CRC16 over the programmed region
function calculateFlashCRCFromHexFile(hexContent) {
  // Create virtual flash (matching C code: 5 MB)
  // Initialize with pattern 0x00FFFFFF (every 4th byte is 0x00, others are 0xFF)
  const FLASH_SIZE = 5 * 1024 * 1024; // 5 MB
  const virtualFlash = Buffer.alloc(FLASH_SIZE);
  
  // Fill with pattern: 0xFF, 0xFF, 0xFF, 0x00, 0xFF, 0xFF, 0xFF, 0x00, ...
  for (let i = 0; i < FLASH_SIZE; i++) {
    if ((i + 1) % 4 === 0) {
      virtualFlash[i] = 0x00;
    } else {
      virtualFlash[i] = 0xFF;
    }
  }
  
  // Parse hex file and write to virtual flash
  const lines = hexContent.split('\n').filter(line => line.trim().length > 0);
  
  let extLinAddress = 0;  // Extended linear address (record type 04)
  let extSegAddress = 0;  // Extended segment address (record type 02)
  let minAddress = 0xFFFFFFFF;
  let maxAddress = 0;
  
  for (const line of lines) {
    if (line[0] !== ':') continue;
    
    // Parse hex record: :LLAAAATT[DD...]CC
    const hexData = line.substr(1);
    const bytes = [];
    for (let i = 0; i < hexData.length - 1; i += 2) {
      const byteStr = hexData.substr(i, 2);
      if (byteStr.match(/[0-9A-Fa-f]{2}/)) {
        bytes.push(parseInt(byteStr, 16));
      }
    }
    
    if (bytes.length < 5) continue;
    
    const recDataLen = bytes[0];
    const recAddress = (bytes[1] << 8) | bytes[2];
    const recType = bytes[3];
    const data = bytes.slice(4, 4 + recDataLen);
    
    switch (recType) {
      case 0x00: // DATA_RECORD
        // Calculate full address
        let progAddress = (recAddress + extLinAddress + extSegAddress) & 0xFFFFFFFF;
        
        // Make sure we are not writing boot sector
        if (progAddress < BOOT_SECTOR_BEGIN) {
          // Update max/min addresses
          if (maxAddress < (progAddress + recDataLen)) {
            maxAddress = progAddress + recDataLen;
          }
          if (minAddress > progAddress) {
            minAddress = progAddress;
          }
          
          // Write to virtual flash
          for (let i = 0; i < data.length && (progAddress + i) < FLASH_SIZE; i++) {
            virtualFlash[progAddress + i] = data[i];
          }
        }
        break;
        
      case 0x02: // EXT_SEG_ADRS_RECORD
        extSegAddress = ((data[0] << 16) & 0x00FF0000) | ((data[1] << 8) & 0x0000FF00);
        extLinAddress = 0;
        break;
        
      case 0x04: // EXT_LIN_ADRS_RECORD
        extLinAddress = ((data[0] << 24) & 0xFF000000) | ((data[1] << 16) & 0x00FF0000);
        extSegAddress = 0;
        break;
        
      case 0x01: // END_OF_FILE_RECORD
      default:
        extSegAddress = 0;
        extLinAddress = 0;
        break;
    }
  }
  
  // Align addresses to 4-byte boundary (matching C code)
  minAddress -= minAddress % 4;
  maxAddress += maxAddress % 4;
  
  // Calculate program length and start address (matching C code)
  const progLen = maxAddress - minAddress;
  const startAddress = Math.floor(minAddress / 2); // C code divides by 2
  
  // Calculate CRC16 over the virtual flash region
  const flashRegion = virtualFlash.slice(minAddress, minAddress + progLen);
  const crc = calculateBootloaderCRC(flashRegion);
  
  console.log(`[BOOTLOADER] Flash verification:`);
  console.log(`[BOOTLOADER]   MinAddress=0x${minAddress.toString(16)}, MaxAddress=0x${maxAddress.toString(16)}`);
  console.log(`[BOOTLOADER]   StartAddress=0x${startAddress.toString(16)} (MinAddress/2)`);
  console.log(`[BOOTLOADER]   Length=${progLen} bytes (0x${progLen.toString(16)})`);
  console.log(`[BOOTLOADER]   Calculated CRC=0x${crc.toString(16).padStart(4, '0')}`);
  
  // Log first few bytes of virtual flash to verify data
  const sampleStart = minAddress;
  const sampleBytes = virtualFlash.slice(sampleStart, Math.min(sampleStart + 32, sampleStart + progLen));
  console.log(`[BOOTLOADER]   First 32 bytes at 0x${sampleStart.toString(16)}: ${sampleBytes.toString('hex')}`);
  
  // Store for use in READ_CRC command
  bootloaderFlashStartAddress = startAddress;
  bootloaderFlashLength = progLen;
  bootloaderExpectedCRC = crc;
  
  return { startAddress, progLen, crc };
}

// Wait for bootloader response
function waitForBootloaderResponse(expectedCommand, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for bootloader response'));
      }
      // Response handling will be done in processRxBuffer
      // For now, this is a placeholder
    }, 100);
  });
}

// Send bootloader command and wait for response
async function sendBootloaderCommand(cmd, data = Buffer.alloc(0), retries = 3, delayMs = 500) {
  // Check if connected via USB HID or Serial Port
  const isUsbHid = usbHidDevice !== null;
  const isSerial = serialPort && serialPort.isOpen;
  
  if (!isUsbHid && !isSerial) {
    throw new Error('Not connected - please connect via COM or USB');
  }
  
  const frame = buildBootloaderFrame(cmd, data);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[BOOTLOADER] Sending command ${cmd}, attempt ${attempt}/${retries} via ${isUsbHid ? 'USB HID' : 'Serial'}`);
      
      if (isUsbHid) {
        // Send via USB HID - matching C code's WriteUSBDevice() function
        // C code sends data in MULTIPLE 64-byte USB packets if frame is larger than 64 bytes
        // Each packet: UsbReport[0] = 0 (report ID), UsbReport[1..64] = data, padded with 0xFF
        const USB_BUFFER_SIZE = 64;
        
        try {
          // Check if device is still connected before writing
          if (!usbHidDevice) {
            throw new Error('USB HID device not connected');
          }
          
          // Send the frame in chunks of 64 bytes (matching C code's while loop)
          let bytesRemaining = frame.length;
          let frameOffset = 0;
          let packetCount = 0;
          
          while (bytesRemaining > 0) {
            // Create a new HID packet for each chunk
            const hidPacket = Buffer.alloc(USB_BUFFER_SIZE + 1); // 65 bytes total
            hidPacket.fill(0xFF); // Fill with 0xFF like C code does
            hidPacket[0] = 0; // Report ID at position 0
            
            // Copy up to 64 bytes of frame data starting at position 1
            const bytesToCopy = Math.min(bytesRemaining, USB_BUFFER_SIZE);
            frame.copy(hidPacket, 1, frameOffset, frameOffset + bytesToCopy);
            
            // Convert buffer to array of numbers for node-hid
            const packetArray = Array.from(hidPacket);
            usbHidDevice.write(packetArray);
            
            frameOffset += USB_BUFFER_SIZE;
            bytesRemaining -= USB_BUFFER_SIZE;
            packetCount++;
          }
          
          // Log packet info
          if (cmd !== PROGRAM_FLASH) {
            console.log(`[BOOTLOADER] USB HID sent ${packetCount} packet(s) for ${frame.length} bytes frame`);
            if (frame.length <= 64) {
              console.log(`[BOOTLOADER] Frame data: ${frame.toString('hex')}`);
            }
          } else {
            // For PROGRAM_FLASH, just log that it was sent
            console.log(`[BOOTLOADER] PROGRAM_FLASH sent via USB HID (${frame.length} bytes frame, ${packetCount} packets)`);
          }
        } catch (error) {
          // If device disconnected (e.g., after jumping to app), this is expected
          if (error.message.includes('Cannot write') || error.message.includes('not connected')) {
            console.log(`[BOOTLOADER] USB HID device disconnected (this is normal after jumping to application)`);
            usbHidDevice = null; // Clear the device reference
          }
          throw new Error(`USB HID write failed: ${error.message}`);
        }
      } else {
        // Send via Serial Port
        await new Promise((resolve, reject) => {
          serialPort.write(frame, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      // For PROGRAM_FLASH, don't wait for response (non-blocking like C code)
      // But we still log that it was sent
      if (cmd === PROGRAM_FLASH) {
        console.log(`[BOOTLOADER] PROGRAM_FLASH command sent (${data.length} bytes of hex data)`);
        return { success: true };
      }
      
      // Wait for response for other commands
      // For USB HID, responses are handled asynchronously via the 'data' event
      // For Serial, responses are in rxBuffer
      if (isUsbHid) {
        // Create a promise that will be resolved when response is received
        bootloaderResponseData = null;
        bootloaderResponsePromise = {
          resolve: null,
          reject: null,
          expectedCmd: cmd  // Track which command we're waiting for
        };
        
        const responsePromise = new Promise((resolve, reject) => {
          bootloaderResponsePromise.resolve = resolve;
          bootloaderResponsePromise.reject = reject;
          
          // Set timeout - increase significantly for READ_CRC which may take longer to calculate
          const timeoutMs = (cmd === READ_CRC) ? delayMs + 10000 : delayMs + 2000; // 10 seconds for READ_CRC
          const timeoutId = setTimeout(() => {
            if (bootloaderResponsePromise && bootloaderResponsePromise.expectedCmd === cmd) {
              console.log(`[BOOTLOADER] ⚠ Timeout waiting for response to command ${cmd} after ${timeoutMs}ms`);
              bootloaderResponsePromise = null;
              reject(new Error('Timeout waiting for response'));
            }
          }, timeoutMs);
          
          // Store timeout ID so we can clear it if response arrives
          if (bootloaderResponsePromise) {
            bootloaderResponsePromise.timeoutId = timeoutId;
          }
        });
        
        console.log(`[BOOTLOADER] Command ${cmd} sent via USB HID, waiting for response...`);
        
        try {
          const response = await responsePromise;
          if (response && response.success) {
            console.log(`[BOOTLOADER] ✓ Response received for command ${cmd}`);
            return { success: true, responseData: response.data };
          } else {
            console.log(`[BOOTLOADER] ✗ Response error for command ${cmd}: ${response?.error || 'Unknown error'}`);
            return { success: false, error: response?.error || 'Response error' };
          }
        } catch (error) {
          console.log(`[BOOTLOADER] ✗ Timeout or error waiting for response: ${error.message}`);
          return { success: false, error: error.message };
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        // TODO: Parse response from rxBuffer for serial port
        return { success: true };
      }
      
    } catch (error) {
      console.error(`[BOOTLOADER] Command ${cmd} attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================================================
// BOOTLOADER IPC HANDLERS
// ============================================================================

// IPC handler for sending bootloader command (:K1;\n to enter bootloader mode)
ipcMain.handle('send-bootloader', async (event, value) => {
  try {
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected' };
    }
    
    // Build byte array: [0x3A, 0x4B, value_byte, 0x3B, 0x0A]
    // This sends ':K1;\n' to enter bootloader mode
    const bytes = [0x3A, 0x4B]; // ':' and 'K'
    bytes.push(parseInt(value)); // value as single byte (0 or 1)
    bytes.push(0x3B, 0x0A); // ';' and '\n'
    const payload = Buffer.from(bytes);
    
    await new Promise((resolve, reject) => {
      serialPort.write(payload, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('Bootloader command sent:', payload.toString('hex'));
    return { success: true };
  } catch (error) {
    console.error('Error sending bootloader command:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for connecting to bootloader via USB
ipcMain.handle('connect-to-bootloader-usb', async (event, vid, pid) => {
  try {
    // Parse VID and PID (handle both hex strings like "0x12BF" and numbers)
    let vendorId, productId;
    
    if (typeof vid === 'string') {
      // Remove 0x prefix if present and convert to number
      vendorId = parseInt(vid.replace(/^0x/i, ''), 16);
    } else {
      vendorId = parseInt(vid);
    }
    
    if (typeof pid === 'string') {
      // Remove 0x prefix if present and convert to number
      productId = parseInt(pid.replace(/^0x/i, ''), 16);
    } else {
      productId = parseInt(pid);
    }
    
    // Validate VID and PID
    if (isNaN(vendorId) || isNaN(productId)) {
      return { success: false, error: 'Invalid VID or PID format' };
    }
    
    // Close existing USB HID device if open
    if (usbHidDevice) {
      try {
        usbHidDevice.close();
      } catch (e) {
        // Ignore errors when closing
      }
      usbHidDevice = null;
    }
    
    // Get list of all HID devices
    const devices = HID.devices();
    
    // Find device matching VID and PID
    const deviceInfo = devices.find(device => 
      device.vendorId === vendorId && device.productId === productId
    );
    
    if (!deviceInfo) {
      return { 
        success: false, 
        error: `USB HID device with VID=0x${vendorId.toString(16).toUpperCase().padStart(4, '0')} and PID=0x${productId.toString(16).toUpperCase().padStart(4, '0')} not found` 
      };
    }
    
    // Open the USB HID device
    try {
      usbHidDevice = new HID.HID(vendorId, productId);
      console.log(`[USB HID] Successfully connected to device VID=0x${vendorId.toString(16).toUpperCase().padStart(4, '0')} PID=0x${productId.toString(16).toUpperCase().padStart(4, '0')}`);
      
      // Set up USB HID data handler for receiving bootloader responses
      // node-hid returns data as Buffer, first byte is report ID (skip it)
      usbHidDevice.on('data', (data) => {
        // data is a Buffer from node-hid
        // First byte is report ID (usually 0), actual data starts at byte 1
        if (data.length > 1) {
          const actualData = data.slice(1); // Skip report ID
          console.log(`[USB HID] Received data (${actualData.length} bytes): ${actualData.toString('hex')}`);
          // Process bootloader response frames immediately
          processBootloaderResponse(actualData);
        } else if (data.length === 1) {
          // Sometimes node-hid might return just the report ID
          console.log(`[USB HID] Received only report ID: ${data[0].toString(16)}`);
        } else {
          console.log(`[USB HID] Received empty data`);
        }
      });
      
      usbHidDevice.on('error', (error) => {
        // If device disconnected (e.g., after jumping to app), this is expected
        if (error.message.includes('could not read') || error.message.includes('not connected')) {
          console.log(`[USB HID] Device disconnected (this is normal after jumping to application)`);
        } else {
          console.error('[USB HID] Device error:', error);
        }
        usbHidDevice = null; // Clear the device reference
        sendConnectionStatusToAllWindows({ connected: false, error: error.message });
      });
      
      // Send connection status to all windows
      sendConnectionStatusToAllWindows({ 
        connected: true, 
        port: `USB HID (VID:0x${vendorId.toString(16).toUpperCase().padStart(4, '0')} PID:0x${productId.toString(16).toUpperCase().padStart(4, '0')})`,
        isBootloader: true 
      });
      
      return { success: true };
    } catch (error) {
      console.error('[USB HID] Error opening device:', error);
      return { success: false, error: `Failed to open USB HID device: ${error.message}` };
    }
  } catch (error) {
    console.error('[USB HID] Connection error:', error);
    return { success: false, error: error.message || 'Unknown error connecting to USB HID device' };
  }
});

// IPC handler for reading bootloader info
ipcMain.handle('bootloader-read-info', async (event) => {
  try {
    const result = await sendBootloaderCommand(READ_BOOT_INFO, Buffer.alloc(0), 3, 200);
    // TODO: Parse response to get version
    return { success: true, majorVersion: 1, minorVersion: 0 };
  } catch (error) {
    console.error('[BOOTLOADER] Read info failed:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for erasing flash
ipcMain.handle('bootloader-erase-flash', async (event) => {
  try {
    console.log('[BOOTLOADER] Erasing flash...');
    
    // Send progress: erasing started
    sendBootloaderProgressToAllWindows({ step: 'erase', progress: 0, label: 'Erasing flash...' });
    
    const result = await sendBootloaderCommand(ERASE_FLASH, Buffer.alloc(0), 3, 5000);
    
    if (!result.success) {
      sendBootloaderProgressToAllWindows({ step: 'erase', progress: 0, label: 'Erase failed!' });
      bootloaderEraseProgVerify = false; // Reset flag on error
      return { success: false, error: result.error || 'Erase failed' };
    }
    
    // Send progress: erase complete
    sendBootloaderProgressToAllWindows({ step: 'erase', progress: 100, label: 'Erase completed!' });
    
    console.log('[BOOTLOADER] ✓ Flash erased successfully');
    
    // Note: Automatic sequencing is handled by the UI's eraseProgramVerify function
    // which calls the handlers sequentially (Erase -> Program -> Verify)
    
    return { success: true };
  } catch (error) {
    console.error('[BOOTLOADER] Erase failed:', error);
    bootloaderEraseProgVerify = false;
    return { success: false, error: error.message };
  }
});

// IPC handler for programming flash
ipcMain.handle('bootloader-program-flash', async (event) => {
  console.log('[BOOTLOADER] bootloader-program-flash handler called');
  try {
    if (bootloaderHexRecords.length === 0) {
      console.log('[BOOTLOADER] ERROR: No hex file loaded - bootloaderHexRecords.length = 0');
      return { success: false, error: 'No hex file loaded' };
    }
    
    console.log(`[BOOTLOADER] Starting programming: ${bootloaderHexRecords.length} hex records to program`);
    
    // Send initial progress
    sendBootloaderProgressToAllWindows({ step: 'program', progress: 0, label: 'Starting programming...' });
    
    // C code sends up to 10 hex records per PROGRAM_FLASH command
    // Each record is the raw hex record bytes: [length, addr_high, addr_low, type, data..., checksum]
    const RECORDS_PER_COMMAND = 10;
    const totalBatches = Math.ceil(bootloaderHexRecords.length / RECORDS_PER_COMMAND);
    
    // Group records into batches of 10 (like C code does)
    for (let i = 0; i < bootloaderHexRecords.length; i += RECORDS_PER_COMMAND) {
      const batch = bootloaderHexRecords.slice(i, i + RECORDS_PER_COMMAND);
      const batchNumber = Math.floor(i / RECORDS_PER_COMMAND) + 1;
      
      // Calculate and send progress
      const progressPercent = Math.round((batchNumber / totalBatches) * 100);
      sendBootloaderProgressToAllWindows({ 
        step: 'program', 
        progress: progressPercent, 
        label: `Programming ${batchNumber}/${totalBatches}...` 
      });
      
      console.log(`[BOOTLOADER] Programming batch ${batchNumber}/${totalBatches} (${batch.length} records)`);
      
      // Build command data: all hex record bytes (CMD byte is added by buildBootloaderFrame)
      const commandData = Buffer.alloc(1000); // Large enough buffer
      let offset = 0;
      
      // Add all hex records in this batch
      for (const record of batch) {
        if (record.rawRecord) {
          // Use raw hex record bytes (as C code expects)
          record.rawRecord.copy(commandData, offset);
          offset += record.rawRecord.length;
        } else if (record.data) {
          // Fallback: if rawRecord not available, construct it from parsed data
          // Format: [length, addr_high, addr_low, type, data..., checksum]
          const length = record.data.length;
          const addrHigh = (record.address >> 8) & 0xFF;
          const addrLow = record.address & 0xFF;
          const type = record.type || 0x00;
          const checksum = 0; // Will be calculated by hex file parser
          
          commandData[offset++] = length;
          commandData[offset++] = addrHigh;
          commandData[offset++] = addrLow;
          commandData[offset++] = type;
          record.data.copy(commandData, offset);
          offset += length;
          commandData[offset++] = checksum;
        }
      }
      
      // Send the command with all records in this batch
      const actualData = commandData.slice(0, offset);
      console.log(`[BOOTLOADER] Sending PROGRAM_FLASH batch ${batchNumber}/${totalBatches} with ${actualData.length} bytes of hex data`);
      try {
        await sendBootloaderCommand(PROGRAM_FLASH, actualData, 1, 0); // No retries, no delay for speed
        console.log(`[BOOTLOADER] ✓ PROGRAM_FLASH batch ${batchNumber}/${totalBatches} sent successfully`);
      } catch (error) {
        console.error(`[BOOTLOADER] ✗ PROGRAM_FLASH batch ${batchNumber}/${totalBatches} failed:`, error);
        throw error; // Re-throw to stop programming
      }
      
      // Wait between batches to allow device to process
      // Increase delay significantly to ensure device can process each batch
      if (i + RECORDS_PER_COMMAND < bootloaderHexRecords.length) {
        // Wait longer between batches - device needs time to write to flash
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between batches
      }
    }
    
    console.log(`[BOOTLOADER] Programming completed: ${bootloaderHexRecords.length} records programmed`);
    
    // Send final progress
    sendBootloaderProgressToAllWindows({ step: 'program', progress: 100, label: 'Programming completed!' });
    
    if (bootloaderEraseProgVerify) {
      // Automatically start verification after programming
      // Wait longer for programming to complete before verifying
      setTimeout(async () => {
        console.log('[BOOTLOADER] Auto-starting verification after programming...');
        await sendBootloaderCommand(READ_CRC, Buffer.alloc(0), 5, 10000);
      }, 2000); // Wait 2 seconds for programming to complete
    }
    
    return { success: true };
  } catch (error) {
    console.error('[BOOTLOADER] Program failed:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for reading CRC and verifying
ipcMain.handle('bootloader-read-crc', async (event) => {
  try {
    console.log('[BOOTLOADER] Reading CRC from device...');
    
    // Send progress: verify started
    sendBootloaderProgressToAllWindows({ step: 'verify', progress: 0, label: 'Verifying flash...' });
    
    // Build READ_CRC command data (matching C code exactly)
    // Data format: StartAddress (4 bytes LE) + Length (4 bytes LE) + CRC (2 bytes LE)
    const crcCommandData = Buffer.alloc(10);
    
    // StartAddress (4 bytes, little-endian) - from hex file parsing
    crcCommandData[0] = bootloaderFlashStartAddress & 0xFF;
    crcCommandData[1] = (bootloaderFlashStartAddress >> 8) & 0xFF;
    crcCommandData[2] = (bootloaderFlashStartAddress >> 16) & 0xFF;
    crcCommandData[3] = (bootloaderFlashStartAddress >> 24) & 0xFF;
    
    // Length (4 bytes, little-endian)
    crcCommandData[4] = bootloaderFlashLength & 0xFF;
    crcCommandData[5] = (bootloaderFlashLength >> 8) & 0xFF;
    crcCommandData[6] = (bootloaderFlashLength >> 16) & 0xFF;
    crcCommandData[7] = (bootloaderFlashLength >> 24) & 0xFF;
    
    // Expected CRC (2 bytes, little-endian)
    crcCommandData[8] = bootloaderExpectedCRC & 0xFF;
    crcCommandData[9] = (bootloaderExpectedCRC >> 8) & 0xFF;
    
    console.log(`[BOOTLOADER] Sending READ_CRC with: StartAddr=0x${bootloaderFlashStartAddress.toString(16)}, Len=${bootloaderFlashLength}, CRC=0x${bootloaderExpectedCRC.toString(16).padStart(4, '0')}`);
    console.log(`[BOOTLOADER] READ_CRC command data: ${crcCommandData.toString('hex')}`);
    
    // Send READ_CRC with the proper data (5 retries, 8 second delay)
    const result = await sendBootloaderCommand(READ_CRC, crcCommandData, 5, 8000);
    
    if (!result.success) {
      bootloaderEraseProgVerify = false;
      return { success: false, error: result.error || 'Failed to read CRC' };
    }
    
    // Parse CRC from response
    // Response format: CRC_LOW (1 byte) + CRC_HIGH (1 byte)
    // The C code handler reads: crc = ((RxData[1] << 8) | RxData[0])
    let crcMatch = false;
    if (result.responseData) {
      console.log(`[BOOTLOADER] READ_CRC response data: ${result.responseData.toString('hex')} (${result.responseData.length} bytes)`);
      
      let crcReceived;
      if (result.responseData.length >= 2) {
        // CRC bytes: low byte first, then high byte
        crcReceived = (result.responseData[0]) | (result.responseData[1] << 8);
      } else {
        console.log(`[BOOTLOADER] ⚠ Response data too short: ${result.responseData.length} bytes`);
        bootloaderEraseProgVerify = false;
        return { success: false, error: 'Invalid response data length' };
      }
      
      const crcExpected = bootloaderExpectedCRC;
      
      console.log(`[BOOTLOADER] CRC received: 0x${crcReceived.toString(16).padStart(4, '0')}, expected: 0x${crcExpected.toString(16).padStart(4, '0')}`);
      
      crcMatch = (crcReceived === crcExpected);
      
      if (crcMatch) {
        console.log('[BOOTLOADER] ✓ CRC verification successful - firmware matches');
        sendBootloaderProgressToAllWindows({ step: 'verify', progress: 100, label: 'Verification successful!' });
      } else {
        console.log('[BOOTLOADER] ✗ CRC verification failed - firmware mismatch');
        sendBootloaderProgressToAllWindows({ step: 'verify', progress: 100, label: 'Verification failed - CRC mismatch' });
      }
    } else {
      console.log('[BOOTLOADER] ⚠ No response data received');
      sendBootloaderProgressToAllWindows({ step: 'verify', progress: 0, label: 'No response data received' });
    }
    
    bootloaderEraseProgVerify = false; // Reset flag
    return { success: true, crcMatch };
  } catch (error) {
    console.error('[BOOTLOADER] Read CRC failed:', error);
    bootloaderEraseProgVerify = false;
    return { success: false, error: error.message };
  }
});

// IPC handler for jumping to application
ipcMain.handle('bootloader-jump-to-app', async (event) => {
  try {
    await sendBootloaderCommand(JMP_TO_APP, Buffer.alloc(0), 1, 10);
    // After jumping, device will disconnect from bootloader (this is expected)
    console.log('[BOOTLOADER] Device jumped to application - bootloader connection closed');
    usbHidDevice = null;
    return { success: true, message: 'Device jumped to application successfully' };
  } catch (error) {
    // If device already disconnected, that's actually success (it means it jumped)
    if (error.message.includes('Cannot write') || error.message.includes('not connected') || error.message.includes('HID write failed')) {
      console.log('[BOOTLOADER] Device disconnected after jump (expected behavior)');
      usbHidDevice = null;
      return { success: true, message: 'Device jumped to application (disconnected from bootloader)' };
    }
    console.error('[BOOTLOADER] Jump to app failed:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for erase-program-verify sequence
ipcMain.handle('bootloader-erase-program-verify', async (event) => {
  try {
    if (bootloaderHexRecords.length === 0) {
      return { success: false, error: 'No hex file loaded' };
    }
    
    bootloaderEraseProgVerify = true;
    
    // Start with erase - rest is automatic
    const result = await sendBootloaderCommand(ERASE_FLASH, Buffer.alloc(0), 3, 5000);
    return { success: true };
  } catch (error) {
    console.error('[BOOTLOADER] Erase-Program-Verify failed:', error);
    bootloaderEraseProgVerify = false;
    return { success: false, error: error.message };
  }
});

// IPC handler for loading hex file
ipcMain.handle('load-hex-file', async (event, filePath) => {
  try {
    const hexContent = await fs.readFile(filePath, 'utf8');
    
    // Parse hex file for programming
    bootloaderHexRecords = parseHexFile(hexContent);
    
    // Calculate flash verification data (StartAddress, Length, CRC) - matching C code
    const flashInfo = calculateFlashCRCFromHexFile(hexContent);
    
    console.log(`[BOOTLOADER] Loaded ${bootloaderHexRecords.length} hex records`);
    console.log(`[BOOTLOADER] Flash info: StartAddress=0x${flashInfo.startAddress.toString(16)}, Length=${flashInfo.progLen}, CRC=0x${flashInfo.crc.toString(16).padStart(4, '0')}`);
    
    return { success: true, recordCount: bootloaderHexRecords.length };
  } catch (error) {
    console.error('[BOOTLOADER] Load hex file failed:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for showing open dialog
ipcMain.handle('show-open-dialog', async (event, options) => {
  try {
    // Get the window that made the request (could be main window or admin panel)
    const callerWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(callerWindow || mainWindow, options);
    return result;
  } catch (error) {
    console.error('Error showing open dialog:', error);
    return { canceled: true, error: error.message };
  }
});

// Placeholder handler for upload-hex-file (functionality removed)
ipcMain.handle('upload-hex-file', async (event, fileContent) => {
  return { success: false, error: 'HEX file upload functionality has been removed. Only Connect button is available.' };
});

// IPC handler for checking updates
ipcMain.handle('check-for-updates', async () => {
  try {
    if (!app.isPackaged) {
      return { 
        success: false, 
        error: 'Update checking is only available in the packaged application.',
        isDev: true
      };
    }
    
    // For electron-updater v6+, GitHub provider is read from package.json
    // No need to setFeedURL - it automatically uses GitHub from package.json publish config
    // But ensure it's configured correctly
    console.log('[UPDATE] Manual update check requested (using GitHub provider from package.json)');
    
    // Use checkForUpdatesAndNotify - this works better with GitHub releases
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return { 
      success: true, 
      currentVersion: app.getVersion(),
      message: 'Checking for updates...'
    };
  } catch (error) {
    console.error('[UPDATE] Error checking for updates:', error);
    // Provide a user-friendly error message
    let errorMessage = error.message;
    if (error.message && (error.message.includes('app-update.yml') || error.message.includes('ENOENT'))) {
      errorMessage = 'Auto-updates not supported for portable version. Please download the latest version from: https://github.com/MuhammdAbdullah/Heat-Transfer/releases';
    }
    return { 
      success: false, 
      error: errorMessage 
    };
  }
});

// IPC handler for getting current version
ipcMain.handle('get-app-version', async () => {
  return {
    version: app.getVersion(),
    isPackaged: app.isPackaged
  };
});

// IPC handler for opening admin panel window
ipcMain.handle('open-admin-panel', async () => {
  try {
    // Check if admin window already exists and is not destroyed
    if (adminWindow && !adminWindow.isDestroyed()) {
      // Window already exists, just focus it
      adminWindow.focus();
      return { success: true, alreadyOpen: true };
    }
    
    // Create new admin window
    adminWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      resizable: true,  // Allow resizing
      icon: path.join(__dirname, 'assets', 'favicon.ico'),  // Window icon
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      autoHideMenuBar: true,
      titleBarStyle: 'default'
    });

    // Load the admin.html file
    adminWindow.loadFile(path.join(__dirname, 'admin.html'));

    // Handle child windows opened from admin panel
    adminWindow.webContents.setWindowOpenHandler(({ url }) => {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1500,
          height: 850,
          resizable: true,  // Allow resizing
          icon: path.join(__dirname, 'assets', 'favicon.ico'),  // Set icon for child windows
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    });

    // Show window when ready
    adminWindow.once('ready-to-show', () => {
      adminWindow.show();
    });

    // Handle window closed - clear the reference
    adminWindow.on('closed', () => {
      adminWindow = null;
    });

    return { success: true };
  } catch (error) {
    console.error('Error opening admin panel:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for opening graph window
ipcMain.handle('open-graph-window', async () => {
  try {
    const graphWindow = new BrowserWindow({
      width: 1500,
      height: 750,
      show: false,
      icon: path.join(__dirname, 'assets', 'favicon.ico'),  // Window icon
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      autoHideMenuBar: true,  // Hide menu bar
      titleBarStyle: 'default'
    });

    // Load the chart.html file
    graphWindow.loadFile(path.join(__dirname, 'chart.html'));

    // Show window when ready
    graphWindow.once('ready-to-show', () => {
      graphWindow.show();
      
      // Set up data communication after window is ready
      setTimeout(() => {
        if (mainWindow && mainWindow.webContents) {
          // Send initial data to graph window
          mainWindow.webContents.send('share-data-to-graph', graphWindow.id);
        }
      }, 1000);
    });

    // Handle window closed
    graphWindow.on('closed', () => {
      // Window reference will be garbage collected
    });

    return { success: true };
  } catch (error) {
    console.error('Error opening graph window:', error);
    return { success: false, error: error.message };
  }
});


