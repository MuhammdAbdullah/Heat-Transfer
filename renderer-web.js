// Web-compatible version of renderer.js for Android tablets
// This version works in web browsers without Electron

let isConnected = false;
let packetCount = 0;

// Get references to HTML elements
const comPortSelect = document.getElementById('comPort');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const refreshPortsBtn = document.getElementById('refreshPorts');
const connectionStatus = document.getElementById('connectionStatus');
const packetCountDisplay = document.getElementById('packetCount');
const lastUpdateDisplay = document.getElementById('lastUpdate');
const connectionInfoDisplay = document.getElementById('connectionInfo');
const rawDataDisplay = document.getElementById('rawDataDisplay');
const parsedDataDisplay = document.getElementById('parsedDataDisplay');
const dataLog = document.getElementById('dataLog');
const clearLogBtn = document.getElementById('clearLogBtn');
const fanSpeedInput = document.getElementById('fanSpeed');
const fanSpeedValue = document.getElementById('fanSpeedValue');
const fanTextIcon = document.getElementById('fanTextIcon');
const fanTextPercentage = document.getElementById('fanTextPercentage');
const heaterTempInput = document.getElementById('heaterTemp');
const heaterTempValue = document.getElementById('heaterTempValue');
const heaterToggleBtn = document.getElementById('heaterToggle');
var heaterMode = 0; // 0=off,1=left,2=right

function addToLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = '[' + timestamp + '] ' + message + '\n';
    dataLog.textContent += logEntry;
    dataLog.scrollTop = dataLog.scrollHeight;
}

// Web API functions (mock implementations)
async function getAvailablePorts() {
    try {
        const response = await fetch('/api/ports');
        return await response.json();
    } catch (error) {
        console.error('Error fetching ports:', error);
        return [];
    }
}

async function connectToPort(port, baudRate) {
    try {
        const response = await fetch(`/api/connect/${port}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baudRate })
        });
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function disconnectFromPort() {
    try {
        const response = await fetch('/api/disconnect', { method: 'POST' });
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendFanSpeed(speed) {
    try {
        const response = await fetch('/api/fan-speed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed })
        });
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendHeaterTemp(temp) {
    try {
        const response = await fetch('/api/heater-temp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temp })
        });
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function setHeaterMode(mode) {
    try {
        const response = await fetch('/api/heater-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        return await response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function updateConnectionStatus(connected, portInfo) {
    if (portInfo === undefined) {
        portInfo = '';
    }
    isConnected = connected;
    
    // Update system status indicator
    var systemStatusIndicator = document.getElementById('systemStatusIndicator');
    if (systemStatusIndicator) {
        if (connected) {
            systemStatusIndicator.textContent = 'SYSTEM ONLINE';
            systemStatusIndicator.classList.remove('offline');
            systemStatusIndicator.classList.add('online');
        } else {
            systemStatusIndicator.textContent = 'SYSTEM OFFLINE';
            systemStatusIndicator.classList.remove('online');
            systemStatusIndicator.classList.add('offline');
        }
    }
    
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

async function refreshComPorts() {
    try {
        addToLog('Refreshing available COM ports...');
        const ports = await getAvailablePorts();
        comPortSelect.innerHTML = '<option value="">Select COM Port...</option>';
        for (var i = 0; i < ports.length; i++) {
            var port = ports[i];
            var option = document.createElement('option');
            option.value = port.path;
            var manufacturer = port.manufacturer || 'Unknown Device';
            var serialNumber = port.serialNumber || 'Unknown';
            option.textContent = port.path + ' - ' + manufacturer + ' (SN: ' + serialNumber + ')';
            comPortSelect.appendChild(option);
        }
        addToLog('Found ' + ports.length + ' available ports');
    } catch (error) {
        addToLog('Error refreshing ports: ' + error.message);
    }
}

async function connectToPortHandler() {
    var selectedPort = comPortSelect.value;
    if (!selectedPort) {
        addToLog('Please select a COM port first');
        return;
    }
    try {
        addToLog('Attempting to connect to ' + selectedPort + '...');
        var result = await connectToPort(selectedPort, 9600);
        if (result.success) {
            addToLog('Successfully connected to ' + selectedPort);
            updateConnectionStatus(true, selectedPort + ' @ 9600 baud');
        } else {
            addToLog('Failed to connect: ' + result.error);
            updateConnectionStatus(false);
        }
    } catch (error) {
        addToLog('Connection error: ' + error.message);
        updateConnectionStatus(false);
    }
}

async function disconnectFromPortHandler() {
    try {
        addToLog('Disconnecting from port...');
        var result = await disconnectFromPort();
        if (result.success) {
            addToLog('Disconnected successfully');
        } else {
            addToLog('Error disconnecting: ' + result.error);
        }
        updateConnectionStatus(false);
    } catch (error) {
        addToLog('Disconnect error: ' + error.message);
        updateConnectionStatus(false);
    }
}

function clearLog() {
    dataLog.textContent = 'Connection log cleared\n';
    packetCount = 0;
    packetCountDisplay.textContent = '0';
    lastUpdateDisplay.textContent = 'Never';
    rawDataDisplay.textContent = 'No data received yet';
    parsedDataDisplay.textContent = 'Data will be parsed and displayed here';
}

// Include all the chart and slider functionality from the original renderer.js
// (Copy the chart initialization, fan slider, heater slider code here)

// Fan speed UI events
if (fanSpeedInput && fanSpeedValue) {
    function updateSliderFill(value) {
        var percentage = parseInt(value, 10);
        var fillElement = document.getElementById('fanSliderFill');
        if (fillElement) {
            fillElement.style.setProperty('--fill-percent', percentage + '%');
            fillElement.style.width = percentage + '%';
        }
    }
    
    function updateFanIcon(value) {
        var percentage = parseInt(value, 10);
        var fanIcon = document.getElementById('fanThumbIcon');
        var sliderWrapper = document.querySelector('.slider-wrapper');
        
        if (fanIcon && sliderWrapper) {
            var sliderWidth = sliderWrapper.offsetWidth;
            var thumbWidth = 24;
            var thumbRadius = thumbWidth / 2;
            var maxPosition = sliderWidth - thumbWidth;
            var thumbCenterPosition = (percentage / 100) * maxPosition + thumbRadius;
            fanIcon.style.left = thumbCenterPosition + 'px';
        }
    }
    
    function updateFanTextIcon(value) {
        var percentage = parseInt(value, 10);
        
        if (fanTextIcon && fanTextPercentage) {
            fanTextPercentage.textContent = percentage + '%';
            
            if (percentage === 0) {
                fanTextIcon.style.animation = 'none';
                fanTextIcon.style.transform = 'rotate(0deg)';
            } else {
                var animationDuration = 3 - (percentage / 100) * 2;
                fanTextIcon.style.animation = 'fanTextSpin ' + animationDuration + 's linear infinite';
            }
        }
    }
    
    fanSpeedInput.addEventListener('input', function() {
        var percentage = parseInt(fanSpeedInput.value, 10);
        updateSliderFill(fanSpeedInput.value);
        updateFanIcon(fanSpeedInput.value);
        updateFanTextIcon(fanSpeedInput.value);
    });
    
    fanSpeedInput.addEventListener('change', async function() {
        try {
            var v = parseInt(fanSpeedInput.value, 10);
            var result = await sendFanSpeed(v);
            if (!result || !result.success) {
                addToLog('Failed to send fan speed: ' + (result && result.error ? result.error : 'Unknown error'));
            } else {
                addToLog('Fan speed sent: ' + v);
            }
        } catch (e) {
            addToLog('Error sending fan speed: ' + e.message);
        }
    });
    
    // Initialize slider fill and fan icons
    updateSliderFill(fanSpeedInput.value);
    updateFanIcon(fanSpeedInput.value);
    updateFanTextIcon(fanSpeedInput.value);
}

// Heater controls
if (heaterTempInput && heaterTempValue) {
    function updateHeaterSliderFill(value) {
        var temp = parseInt(value, 10);
        var tempPercentage = ((temp - 20) / (70 - 20)) * 100;
        var fillElement = document.getElementById('heaterSliderFill');
        if (fillElement) {
            fillElement.style.setProperty('--fill-percent', tempPercentage + '%');
            fillElement.style.width = tempPercentage + '%';
        }
    }
    
    function updateHeaterIcon(value) {
        var temp = parseInt(value, 10);
        var heaterIcon = document.getElementById('heaterThumbIcon');
        var sliderWrapper = document.querySelector('.heater-slider-wrapper');
        
        if (heaterIcon && sliderWrapper) {
            var sliderWidth = sliderWrapper.offsetWidth;
            var thumbWidth = 24;
            var thumbRadius = thumbWidth / 2;
            var maxPosition = sliderWidth - thumbWidth;
            var tempPercentage = ((temp - 20) / (70 - 20)) * 100;
            var thumbCenterPosition = (tempPercentage / 100) * maxPosition + thumbRadius;
            heaterIcon.style.left = thumbCenterPosition + 'px';
        }
    }
    
    heaterTempInput.addEventListener('input', function() {
        var temp = parseInt(heaterTempInput.value, 10);
        heaterTempValue.textContent = String(temp) + '\u00B0C';
        updateHeaterSliderFill(heaterTempInput.value);
        updateHeaterIcon(heaterTempInput.value);
    });
    
    heaterTempInput.addEventListener('change', async function() {
        try {
            var v = parseInt(heaterTempInput.value, 10);
            var result = await sendHeaterTemp(v);
            if (!result || !result.success) {
                addToLog('Failed to send heater temp: ' + (result && result.error ? result.error : 'Unknown error'));
            } else {
                addToLog('Heater temp sent: ' + v + '\u00B0C');
            }
        } catch (e) {
            addToLog('Error sending heater temp: ' + e.message);
        }
    });
    
    // Initialize heater slider fill and icon
    updateHeaterSliderFill(heaterTempInput.value);
    updateHeaterIcon(heaterTempInput.value);
}

if (heaterToggleBtn) {
    heaterToggleBtn.addEventListener('click', async function() {
        heaterMode = (heaterMode + 1) % 3;
        try {
            var res = await setHeaterMode(heaterMode);
            if (!res || !res.success) {
                addToLog('Failed to set heater: ' + (res && res.error ? res.error : 'Unknown error'));
            }
        } catch (e) {
            addToLog('Error setting heater: ' + e.message);
        }
        if (heaterMode === 0) {
            heaterToggleBtn.textContent = '🔥 Heater: Off';
            heaterToggleBtn.classList.remove('active');
        } else if (heaterMode === 1) {
            heaterToggleBtn.textContent = '🔥 Heater: Left';
            heaterToggleBtn.classList.add('active');
        } else {
            heaterToggleBtn.textContent = '🔥 Heater: Right';
            heaterToggleBtn.classList.add('active');
        }
    });
}

// Event listeners
connectBtn.addEventListener('click', connectToPortHandler);
disconnectBtn.addEventListener('click', disconnectFromPortHandler);
refreshPortsBtn.addEventListener('click', refreshComPorts);
clearLogBtn.addEventListener('click', clearLog);

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    addToLog('Heat Transfer Web App started');
    addToLog('Click "Refresh Ports" to see available COM ports');
    refreshComPorts();
});


