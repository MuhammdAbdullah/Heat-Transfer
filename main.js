// This is the main Electron process file
// It creates the app window and handles the main application logic

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { SerialPort } = require('serialport');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

// Keep a global reference of the window object
let mainWindow;
let splashWindow;
let serialPort = null;
let rxBuffer = Buffer.alloc(0);
let portsPollIntervalId = null;
let connectionMonitorIntervalId = null;
let lastKnownPorts = [];
let isConnected = false;
let lastDataTime = 0;
let connectionTimeout = 10000; // 10 seconds timeout for connection loss
const TARGET_VENDOR_ID = '12BF';
const TARGET_PRODUCT_ID = '010C';
const DFU_VENDOR_ID = '00A1';
const DFU_PRODUCT_ID = '12BF';

function createSplashScreen() {
  // Create the splash screen window
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,                    // Remove window frame
    alwaysOnTop: true,              // Keep on top
    transparent: true,              // Make background transparent
    resizable: false,               // Not resizable
    skipTaskbar: true,              // Don't show in taskbar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load splash screen HTML
  splashWindow.loadFile('splash.html');
  
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
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
  sendUpdateStatusToAllWindows({ 
    status: 'error', 
    message: 'Error checking for updates: ' + err.message
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

// Auto-connect to DFU mode device (bootloader mode)
async function autoConnectToDFUDevice() {
  try {
    const ports = await getPortsWithFallback();
    const dfuPort = ports.find(port => 
      port.vendorId && port.productId && 
      port.vendorId.toUpperCase() === DFU_VENDOR_ID && 
      port.productId.toUpperCase() === DFU_PRODUCT_ID
    );

    if (dfuPort) {
      console.log(`[DFU] DFU device found (VID: ${dfuPort.vendorId} PID: ${dfuPort.productId}) on ${dfuPort.path}`);
      
      // Disconnect from current port if connected
      if (serialPort && serialPort.isOpen) {
        await new Promise((resolve) => {
          serialPort.close(() => resolve());
        });
        isConnected = false;
      }
      
      // Connect to DFU device
      const result = await connectSerial(dfuPort.path, 115200);
      if (result.success) {
        console.log(`[DFU] Successfully connected to DFU device on ${dfuPort.path}`);
        isConnected = true;
        
        // Notify renderer about DFU connection
        if (mainWindow) {
          mainWindow.webContents.send('connection-status', { 
            connected: true, 
            port: dfuPort.path + ' (DFU Mode)',
            isDFU: true
          });
        }
      } else {
        console.log(`[DFU] Failed to connect to DFU device: ${result.error}`);
        // Schedule retry in 2 seconds
        setTimeout(() => {
          console.log('[DFU] Retrying DFU connection in 2 seconds...');
          autoConnectToDFUDevice();
        }, 2000);
      }
    } else {
      console.log('[DFU] DFU device not found yet - will keep checking every 2 seconds');
      // Schedule retry in 2 seconds if no DFU device found
      setTimeout(() => {
        autoConnectToDFUDevice();
      }, 2000);
    }
  } catch (error) {
    console.error('[DFU] Error during DFU auto-connect:', error);
    // Schedule retry in 2 seconds if there was an error
    setTimeout(() => {
      console.log('[DFU] Retrying DFU connection after error in 2 seconds...');
      autoConnectToDFUDevice();
    }, 2000);
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
      
      // Process complete packets
      processRxBuffer();
    });

    // Set up error handler
    serialPort.on('error', (err) => {
      console.error('Serial port error:', err);
      if (mainWindow) {
        mainWindow.webContents.send('connection-status', { connected: false, error: err.message });
      }
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
    
    // Send connection status
    if (mainWindow) {
      mainWindow.webContents.send('connection-status', { connected: true, port: portPath, baudRate: baudRate });
    }

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
        
        // Check for DFU device hot-plug (bootloader mode)
        const dfuPort = currentPorts.find(port => 
          port.vendorId && port.productId && 
          port.vendorId.toUpperCase() === DFU_VENDOR_ID && 
          port.productId.toUpperCase() === DFU_PRODUCT_ID
        );
        
        // Prioritize DFU device if both are present
        if (dfuPort && !isConnected) {
          console.log('[HOT-PLUG] DFU device detected, attempting auto-connect');
          const result = await connectSerial(dfuPort.path, 115200);
          if (result.success) {
            console.log('[HOT-PLUG] Successfully connected to DFU device on', dfuPort.path);
            isConnected = true;
            if (mainWindow) {
              mainWindow.webContents.send('connection-status', { 
                connected: true, 
                port: dfuPort.path + ' (DFU Mode)',
                isDFU: true
              });
            }
          } else {
            console.log('[HOT-PLUG] Failed to connect to DFU device:', result.error);
            setTimeout(() => {
              console.log('[HOT-PLUG] Retrying DFU connection...');
              autoConnectToDFUDevice();
            }, 2000);
          }
        } else if (targetPort && !isConnected) {
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
    if (isConnected && serialPort) {
      // Check if port is still open
      if (!serialPort.isOpen) {
        console.log('[CONNECTION MONITOR] Port closed, disconnecting');
        isConnected = false;
        if (mainWindow) {
          mainWindow.webContents.send('connection-status', { connected: false, error: 'Port closed' });
        }
        return;
      }
      
      // Check for data timeout
      const now = Date.now();
      if (now - lastDataTime > connectionTimeout) {
        console.log('[CONNECTION MONITOR] No data received for', connectionTimeout/1000, 'seconds, disconnecting');
        isConnected = false;
        if (mainWindow) {
          mainWindow.webContents.send('connection-status', { connected: false, error: 'Connection timeout' });
        }
        
        // Close the port
        try {
          await new Promise((resolve) => {
            serialPort.close(() => resolve());
          });
          serialPort = null;
        } catch (e) {
          console.error('Error closing port:', e);
        }
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
    if (serialPort && serialPort.isOpen) {
      // Safety commands are handled in before-quit event
      
      await new Promise((resolve) => {
        serialPort.close(() => resolve());
      });
      serialPort = null;
    }
    
    // Update connection state
    isConnected = false;
    
    if (mainWindow) {
      mainWindow.webContents.send('connection-status', { connected: false });
    }
    
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
ipcMain.handle('send-bootloader', async (event, value) => {
  try {
    const v = Math.max(0, Math.min(1, parseInt(value)));
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected' };
    }
    // Build byte array: [0x3A, 0x4B, value_byte, 0x3B, 0x0A]
    const bytes = [0x3A, 0x4B]; // ':' and 'K'
    bytes.push(v); // value as single byte (0 or 1)
    bytes.push(0x3B, 0x0A); // ';' and '\n'
    const payload = Buffer.from(bytes);
    
    serialPort.write(payload);
    console.log('Bootloader command sent:', payload.toString('hex'));
    
    // If entering bootloader mode (value = 1), start looking for DFU device
    if (v === 1) {
      console.log('[BOOTLOADER] Entering bootloader mode, starting DFU device detection...');
      // Wait a moment for device to switch to DFU mode, then start detection
      setTimeout(() => {
        autoConnectToDFUDevice();
      }, 1000);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error sending bootloader command:', error);
    return { success: false, error: error.message };
  }
});

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
    const result = await dialog.showSaveDialog(mainWindow, options);
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

// IPC handler for uploading HEX file to MCU
ipcMain.handle('upload-hex-file', async (event, fileContent) => {
  try {
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Not connected to serial port' };
    }

    // Parse HEX content (already read from file)
    const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
    
    let totalBytesSent = 0;
    let totalLines = lines.length;
    let currentLine = 0;

    console.log(`[HEX] Starting upload of ${totalLines} HEX lines`);

    // Parse and send each HEX line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) continue;
      
      // Check if it's a valid HEX line (starts with :)
      if (line[0] !== ':') {
        console.warn(`[HEX] Skipping invalid line ${i + 1}: ${line}`);
        continue;
      }

      // Parse Intel HEX format: :LLAAAATTDD...CC
      // LL = length, AAAA = address, TT = type, DD = data, CC = checksum
      const length = parseInt(line.substring(1, 3), 16);
      const address = parseInt(line.substring(3, 7), 16);
      const type = parseInt(line.substring(7, 9), 16);
      
      // Type 01 = End of File, skip it
      if (type === 0x01) {
        console.log('[HEX] End of File record found');
        continue;
      }

      // Extract data bytes
      const dataStart = 9;
      const dataEnd = dataStart + (length * 2);
      const dataHex = line.substring(dataStart, dataEnd);
      
      // Convert hex string to bytes
      const dataBytes = [];
      for (let j = 0; j < dataHex.length; j += 2) {
        const byteHex = dataHex.substring(j, j + 2);
        dataBytes.push(parseInt(byteHex, 16));
      }

      // Send data to MCU
      // Format: :U<address_high><address_low><length><data_bytes>;\n
      // Address is 16-bit, send as 2 bytes (high, low)
      const addressHigh = (address >> 8) & 0xFF;
      const addressLow = address & 0xFF;
      
      const uploadBytes = [0x3A, 0x55]; // ':' and 'U'
      uploadBytes.push(addressHigh);
      uploadBytes.push(addressLow);
      uploadBytes.push(length);
      uploadBytes.push(...dataBytes);
      uploadBytes.push(0x3B, 0x0A); // ';' and '\n'
      
      const payload = Buffer.from(uploadBytes);
      
      // Send with small delay between packets
      await new Promise((resolve, reject) => {
        serialPort.write(payload, (err) => {
          if (err) reject(err);
          else {
            // Small delay to allow MCU to process
            setTimeout(resolve, 10);
          }
        });
      });

      totalBytesSent += dataBytes.length;
      currentLine++;

      // Send progress update every 10 lines or at the end
      if (currentLine % 10 === 0 || currentLine === totalLines) {
        const percent = Math.round((currentLine / totalLines) * 100);
        if (mainWindow) {
          mainWindow.webContents.send('hex-upload-progress', {
            percent: percent,
            currentLine: currentLine,
            totalLines: totalLines,
            bytesSent: totalBytesSent,
            message: `Uploading line ${currentLine}/${totalLines} (${percent}%)`
          });
        }
      }
    }

    console.log(`[HEX] Upload complete. Total bytes sent: ${totalBytesSent}`);
    
    return { 
      success: true, 
      bytesSent: totalBytesSent,
      linesProcessed: currentLine
    };
  } catch (error) {
    console.error('[HEX] Error uploading HEX file:', error);
    return { success: false, error: error.message };
  }
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
    
    console.log('[UPDATE] Manual update check requested');
    const result = await autoUpdater.checkForUpdates();
    return { 
      success: true, 
      currentVersion: app.getVersion(),
      message: 'Checking for updates...'
    };
  } catch (error) {
    console.error('[UPDATE] Error checking for updates:', error);
    return { 
      success: false, 
      error: error.message 
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
    const adminWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      autoHideMenuBar: true,
      titleBarStyle: 'default'
    });

    // Load the admin.html file
    adminWindow.loadFile('admin.html');

    // Show window when ready
    adminWindow.once('ready-to-show', () => {
      adminWindow.show();
    });

    // Handle window closed
    adminWindow.on('closed', () => {
      // Window reference will be garbage collected
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
      width: 1000,
      height: 700,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      autoHideMenuBar: true,  // Hide menu bar
      titleBarStyle: 'default'
    });

    // Load the chart.html file
    graphWindow.loadFile('chart.html');

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
