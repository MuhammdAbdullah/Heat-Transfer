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
  // Fan control
  sendFanSpeed: (value) => ipcRenderer.invoke('send-fan-speed', value),
  // Heater controls
  sendHeaterTemp: (value) => ipcRenderer.invoke('send-heater-temp', value),
  setHeaterMode: (mode) => ipcRenderer.invoke('set-heater-mode', mode),
  // Cooler control
  sendCooler: (value) => ipcRenderer.invoke('send-cooler', value),
  
  // File operations
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  
  // Window operations
  openGraphWindow: () => ipcRenderer.invoke('open-graph-window'),
  
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
