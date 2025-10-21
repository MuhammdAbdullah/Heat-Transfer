// This is the main Electron process file
// It creates the app window and handles the main application logic

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { SerialPort } = require('serialport');
const { exec } = require('child_process');

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
      }
    } else {
      console.log('[AUTO] No matching device found');
    }
  } catch (error) {
    console.error('[AUTO] Error during auto-connect:', error);
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
        
        // Check for target device hot-plug
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
