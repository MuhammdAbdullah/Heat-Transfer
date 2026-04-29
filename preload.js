// preload.js
// This file runs in the renderer process but has access to Node.js APIs
// It acts as a secure bridge between the main process and renderer process

const { contextBridge, ipcRenderer } = require('electron');
// Load Chart.js locally and expose to renderer in a safe way
let ChartLib;
try {
  // Use UMD build to work with CommonJS require in preload
  ChartLib = require('chart.js/dist/chart.umd');
} catch (e) {
  ChartLib = null;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Serial port communication
  getAvailablePorts: () => ipcRenderer.invoke('get-available-ports'),
  connectToPort: (port, baudRate) => ipcRenderer.invoke('connect-to-port', port, baudRate),
  disconnectFromPort: () => ipcRenderer.invoke('disconnect-from-port'),
  
  // Data handling
  onDataReceived: (callback) => {
    ipcRenderer.on('data-received', callback);
  },
  onDataChunk: (callback) => {
    ipcRenderer.on('data-chunk', callback);
  },
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', callback);
  },
  onPortsUpdate: (callback) => {
    ipcRenderer.on('ports-update', callback);
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', callback);
  },
  // Fan control
  sendFanSpeed: (value) => ipcRenderer.invoke('send-fan-speed', value),
  // Heater controls
  sendHeaterTemp: (value) => ipcRenderer.invoke('send-heater-temp', value),
  setHeaterMode: (mode) => ipcRenderer.invoke('set-heater-mode', mode),
  // Cooler control
  sendCooler: (value) => ipcRenderer.invoke('send-cooler', value),
  // Calibration control
  sendCalibrationC: () => ipcRenderer.invoke('send-calibration-c'),
  
  // PID control
  sendPIDValue: (type, value) => ipcRenderer.invoke('send-pid-value', type, value),
  // Bootloader control
  sendBootloader: (value) => ipcRenderer.invoke('send-bootloader', value),
  connectToBootloaderUSB: (vid, pid) => ipcRenderer.invoke('connect-to-bootloader-usb', vid, pid),
  bootloaderReadInfo: () => ipcRenderer.invoke('bootloader-read-info'),
  bootloaderEraseFlash: () => ipcRenderer.invoke('bootloader-erase-flash'),
  bootloaderProgramFlash: () => ipcRenderer.invoke('bootloader-program-flash'),
  bootloaderReadCRC: () => ipcRenderer.invoke('bootloader-read-crc'),
  bootloaderJumpToApp: () => ipcRenderer.invoke('bootloader-jump-to-app'),
  bootloaderEraseProgramVerify: () => ipcRenderer.invoke('bootloader-erase-program-verify'),
  loadHexFile: (filePath) => ipcRenderer.invoke('load-hex-file', filePath),
  // Bootloader progress listener
  onBootloaderProgress: (callback) => {
    ipcRenderer.on('bootloader-progress', (event, data) => callback(data));
  },
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  uploadHexFile: (fileContent, progressCallback) => {
    return new Promise((resolve, reject) => {
      // Set up progress listener
      const progressListener = (event, progress) => {
        if (progressCallback) {
          progressCallback(progress);
        }
      };
      ipcRenderer.on('hex-upload-progress', progressListener);
      
      // Invoke upload with file content
      ipcRenderer.invoke('upload-hex-file', fileContent)
        .then((result) => {
          ipcRenderer.removeListener('hex-upload-progress', progressListener);
          resolve(result);
        })
        .catch((error) => {
          ipcRenderer.removeListener('hex-upload-progress', progressListener);
          reject(error);
        });
    });
  },
  
  // File operations
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  
  // Window operations
  openGraphWindow: () => ipcRenderer.invoke('open-graph-window'),
  openAdminPanel: () => ipcRenderer.invoke('open-admin-panel'),
  
  // Update operations
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Remove listeners to prevent memory leaks
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Expose Chart global for renderer usage (read-only)
if (ChartLib) {
  try {
    contextBridge.exposeInMainWorld('Chart', ChartLib);
  } catch (e) {
    // ignore
  }
}
