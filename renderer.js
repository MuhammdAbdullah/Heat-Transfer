// This file handles the user interface and communicates with the main process
// It runs in the renderer process (the web page) and uses the secure preload script

// Global variables to store our connection state and data
let isConnected = false;
let packetCount = 0;

// Get references to HTML elements
const comPortSelect = document.getElementById('comPort');
const baudRateSelect = document.getElementById('baudRate');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const refreshPortsBtn = document.getElementById('refreshPorts');
const manualPortInput = document.getElementById('manualPort');
const useManualPortBtn = document.getElementById('useManualPort');
const connectionStatus = document.getElementById('connectionStatus');
const packetCountDisplay = document.getElementById('packetCount');
const lastUpdateDisplay = document.getElementById('lastUpdate');
const connectionInfoDisplay = document.getElementById('connectionInfo');
const rawDataDisplay = document.getElementById('rawDataDisplay');
const parsedDataDisplay = document.getElementById('parsedDataDisplay');
const dataLog = document.getElementById('dataLog');
const clearLogBtn = document.getElementById('clearLogBtn');

// Function to add messages to the log
function addToLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}\n`;
    dataLog.textContent += logEntry;
    dataLog.scrollTop = dataLog.scrollHeight;
}

// Function to update connection status
function updateConnectionStatus(connected, portInfo = '') {
    isConnected = connected;
    
    if (connected) {
        connectionStatus.textContent = 'Connected';
        connectionStatus.className = 'status-connected';
        connectionInfoDisplay.textContent = portInfo;
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
    } else {
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.className = 'status-disconnected';
        connectionInfoDisplay.textContent = 'No device connected';
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
    }
}

// Function to refresh available COM ports using the secure API
async function refreshComPorts() {
    try {
        addToLog('Refreshing available COM ports...');
        
        // Use the secure API from preload script
        const ports = await window.electronAPI.getAvailablePorts();
        
        // Clear existing options
        comPortSelect.innerHTML = '<option value="">Select COM Port...</option>';
        
        // Add available ports to the dropdown
        ports.forEach(port => {
            const option = document.createElement('option');
            option.value = port.path;
            const manufacturer = port.manufacturer || 'Unknown Device';
            const serialNumber = port.serialNumber || 'Unknown';
            option.textContent = `${port.path} - ${manufacturer} (SN: ${serialNumber})`;
            comPortSelect.appendChild(option);
        });
        
        // Log detailed port information
        addToLog(`Found ${ports.length} available ports:`);
        ports.forEach(port => {
            addToLog(`  - ${port.path}: ${port.manufacturer || 'Unknown'} (SN: ${port.serialNumber})`);
        });
        
        // If no ports found, suggest common solutions
        if (ports.length === 0) {
            addToLog('No COM ports found. Try:');
            addToLog('  1. Check if device is connected');
            addToLog('  2. Install device drivers');
            addToLog('  3. Check Device Manager for COM port number');
            addToLog('  4. Try a different USB cable/port');
        }
        
    } catch (error) {
        addToLog(`Error refreshing ports: ${error.message}`);
        addToLog('This might be a permissions issue. Try running as administrator.');
    }
}

// Function to connect to COM port using the secure API
async function connectToPort() {
    const selectedPort = comPortSelect.value;
    const selectedBaudRate = parseInt(baudRateSelect.value);
    
    if (!selectedPort) {
        addToLog('Please select a COM port first');
        return;
    }
    
    try {
        addToLog(`Attempting to connect to ${selectedPort} at ${selectedBaudRate} baud...`);
        
        // Use the secure API from preload script
        const result = await window.electronAPI.connectToPort(selectedPort, selectedBaudRate);
        
        if (result.success) {
            addToLog(`Successfully connected to ${selectedPort}`);
            updateConnectionStatus(true, `${selectedPort} @ ${selectedBaudRate} baud`);
        } else {
            addToLog(`Failed to connect: ${result.error}`);
            updateConnectionStatus(false);
        }
        
    } catch (error) {
        addToLog(`Connection error: ${error.message}`);
        updateConnectionStatus(false);
    }
}

// Function to disconnect from COM port using the secure API
async function disconnectFromPort() {
    try {
        addToLog('Disconnecting from port...');
        
        // Use the secure API from preload script
        const result = await window.electronAPI.disconnectFromPort();
        
        if (result.success) {
            addToLog('Disconnected successfully');
        } else {
            addToLog(`Error disconnecting: ${result.error}`);
        }
        
        updateConnectionStatus(false);
        
    } catch (error) {
        addToLog(`Disconnect error: ${error.message}`);
        updateConnectionStatus(false);
    }
}

// Function to handle incoming data (56 bytes with specific format)
function handleIncomingData(data) {
    // Convert buffer to array of bytes for easier handling
    const dataArray = Array.from(data);
    
    // Check if we have enough data (56 bytes)
    if (dataArray.length >= 56) {
        // Check for header bytes (first 2 bytes should be 0x55 0x55)
        if (dataArray[0] === 0x55 && dataArray[1] === 0x55) {
            // Check for footer bytes (last 2 bytes should be 0xAA 0xAA)
            if (dataArray[54] === 0xAA && dataArray[55] === 0xAA) {
                // Valid packet received!
                packetCount++;
                packetCountDisplay.textContent = packetCount;
                lastUpdateDisplay.textContent = new Date().toLocaleTimeString();
                
                // Display raw data
                displayRawData(dataArray);
                
                // Parse and display meaningful data
                parseAndDisplayData(dataArray);
                
                addToLog(`Valid packet received (${packetCount})`);
            } else {
                addToLog('Invalid packet: Wrong footer bytes');
            }
        } else {
            addToLog('Invalid packet: Wrong header bytes');
        }
    } else {
        addToLog(`Incomplete data received: ${dataArray.length} bytes (expected 56)`);
    }
}

// Function to display raw data in hex format
function displayRawData(dataArray) {
    let hexString = '';
    
    // Display data in rows of 16 bytes each
    for (let i = 0; i < dataArray.length; i += 16) {
        let row = '';
        let ascii = '';
        
        for (let j = 0; j < 16 && i + j < dataArray.length; j++) {
            const byte = dataArray[i + j];
            row += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';
            ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        }
        
        hexString += `${i.toString(16).padStart(4, '0').toUpperCase()}: ${row.padEnd(48)} ${ascii}\n`;
    }
    
    rawDataDisplay.textContent = hexString;
}

// Function to parse meaningful data from the packet
function parseAndDisplayData(dataArray) {
    let parsedInfo = '';
    
    // Extract data between header and footer (bytes 2-53, that's 52 bytes of actual data)
    const actualData = dataArray.slice(2, 54);
    
    parsedInfo += `Packet Structure:\n`;
    parsedInfo += `Header: 0x${dataArray[0].toString(16).padStart(2, '0')} 0x${dataArray[1].toString(16).padStart(2, '0')}\n`;
    parsedInfo += `Data Length: ${actualData.length} bytes\n`;
    parsedInfo += `Footer: 0x${dataArray[54].toString(16).padStart(2, '0')} 0x${dataArray[55].toString(16).padStart(2, '0')}\n\n`;
    
    // Example parsing - you can modify this based on your actual data format
    parsedInfo += `Data Interpretation:\n`;
    
    // If you know the data format, you can parse specific fields here
    // For example, if bytes 2-5 represent a temperature:
    if (actualData.length >= 4) {
        // Example: interpreting first 4 bytes as a 32-bit temperature value
        const tempBytes = actualData.slice(0, 4);
        const temperature = (tempBytes[0] << 24) | (tempBytes[1] << 16) | (tempBytes[2] << 8) | tempBytes[3];
        parsedInfo += `Temperature (example): ${temperature / 100.0}°C\n`;
    }
    
    // Show first 20 bytes of actual data in hex
    parsedInfo += `\nFirst 20 data bytes: `;
    for (let i = 0; i < Math.min(20, actualData.length); i++) {
        parsedInfo += `0x${actualData[i].toString(16).padStart(2, '0')} `;
    }
    
    parsedDataDisplay.textContent = parsedInfo;
}

// Function to clear the data log
function clearLog() {
    dataLog.textContent = 'Connection log cleared\n';
    packetCount = 0;
    packetCountDisplay.textContent = '0';
    lastUpdateDisplay.textContent = 'Never';
    rawDataDisplay.textContent = 'No data received yet';
    parsedDataDisplay.textContent = 'Data will be parsed and displayed here';
}

// Function to use manually entered COM port
function useManualPort() {
    const manualPort = manualPortInput.value.trim();
    
    if (!manualPort) {
        addToLog('Please enter a COM port (e.g., COM3)');
        return;
    }
    
    // Convert to uppercase and ensure it starts with COM
    const formattedPort = manualPort.toUpperCase();
    if (!formattedPort.startsWith('COM')) {
        addToLog('COM port should start with "COM" (e.g., COM3)');
        return;
    }
    
    // Add the manual port to the dropdown
    const option = document.createElement('option');
    option.value = formattedPort;
    option.textContent = `${formattedPort} - Manual Entry`;
    option.selected = true;
    comPortSelect.appendChild(option);
    
    addToLog(`Manual port added: ${formattedPort}`);
    addToLog('You can now click Connect to try connecting to this port');
}

// Set up event listeners for data from main process
function setupDataListeners() {
    // Listen for data received from serial port
    window.electronAPI.onDataReceived((event, data) => {
        handleIncomingData(data);
    });
    
    // Listen for connection status updates
    window.electronAPI.onConnectionStatus((event, status) => {
        if (status.connected) {
            updateConnectionStatus(true, status.port);
        } else {
            updateConnectionStatus(false);
            if (status.error) {
                addToLog(`Connection error: ${status.error}`);
            }
        }
    });
}

// Event listeners for buttons
connectBtn.addEventListener('click', connectToPort);
disconnectBtn.addEventListener('click', disconnectFromPort);
refreshPortsBtn.addEventListener('click', refreshComPorts);
useManualPortBtn.addEventListener('click', useManualPort);
clearLogBtn.addEventListener('click', clearLog);

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', function() {
    addToLog('Heat Transfer Data Reader started');
    addToLog('Click "Refresh Ports" to see available COM ports');
    
    // Set up listeners for data from main process
    setupDataListeners();
    
    // Refresh ports on startup
    refreshComPorts();
});

// Handle window close - disconnect from port
window.addEventListener('beforeunload', function() {
    if (isConnected) {
        // Try to disconnect gracefully
        window.electronAPI.disconnectFromPort().catch(error => {
            console.log('Error during disconnect:', error);
        });
    }
});