// preload.js
// This file runs in the renderer process but has access to Node.js APIs
// It acts as a secure bridge between the main process and renderer process

const { contextBridge, ipcRenderer } = require('electron');

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
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', callback);
  },
  
  // Remove listeners to prevent memory leaks
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
