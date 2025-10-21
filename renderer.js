// --- Plotly graph state ---
var chartData = { time: [], series: Array.from({ length: 12 }, function() { return []; }), enabled: Array.from({ length: 12 }, function() { return true; }) };
var maxPoints = 50; // show last 50 points by default
var isSavingCsv = false; // flag to track if CSV saving is active
var csvData = []; // array to store data for CSV export
var csvSavePath = null; // path where CSV will be saved
var hoverInfoEl = null;
var plotlyLayout = null;
var plotlyConfig = null;
var chartInitialized = false;
var popInitialized = false;
var chartDivRef = null;
var chartJsRef = null;

function initChart() {
    // Initialize Chart.js chart if canvas exists
    var canvas = document.getElementById('testChart');
    if (canvas && window.Chart && !chartJsRef) {
        var ctx = canvas.getContext('2d');
        var colors = ['#ff4d4f','#40a9ff','#73d13d','#fa8c16','#b37feb','#36cfc9','#f759ab','#9254de','#faad14','#1f7a8c','#000000','#ff007a'];
        var labels = ['T1','T2','T3','T4','T5','T6','T7','T8','Heater Left','Heater Right','Power','Target Temp'];
        var datasets = [];
        for (var i = 0; i < 12; i++) {
            datasets.push({
                label: labels[i],
                data: [],
                borderColor: colors[i],
                backgroundColor: colors[i],
                borderWidth: 2,
                pointRadius: 2,
                tension: 0.2,
                yAxisID: i === 10 ? 'y2' : 'y'
            });
        }
        chartJsRef = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: false },
                animation: false,
                scales: {
                    x: { 
                        grid: { color: '#e0e0e0' },
                        ticks: { color: '#333' }
                    },
                    y: { 
                        type: 'linear', 
                        position: 'left', 
                        title: { display: true, text: 'Temperature (°C)', color: '#333' },
                        grid: { color: '#e0e0e0' },
                        ticks: { color: '#333' }
                    },
                    y2: { 
                        type: 'linear', 
                        position: 'right', 
                        grid: { drawOnChartArea: false, color: '#e0e0e0' }, 
                        title: { display: true, text: 'Power (W)', color: '#333' },
                        ticks: { color: '#333' }
                    }
                },
                plugins: { legend: { position: 'right' } }
            }
        });
        
        // Handle window resize for responsive chart
        window.addEventListener('resize', function() {
            if (chartJsRef) {
                chartJsRef.resize();
            }
        });
    }

    var chartDiv = document.getElementById('tempChart');
    if (!chartDiv) { return; }
    chartDivRef = chartDiv;
	
	// Define colors for each series (same as original)
	var colors = ['#ff4d4f','#40a9ff','#73d13d','#fa8c16','#b37feb','#36cfc9','#f759ab','#9254de','#faad14','#1f7a8c','#000000','#ff007a'];
	var seriesNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Heater Left', 'Heater Right', 'Power', 'Target Temp'];
	
	// Create initial empty traces
	var traces = [];
	for (var i = 0; i < 12; i++) {
		traces.push({
			x: [],
			y: [],
			type: 'scatter',
			mode: 'lines+markers',
			name: seriesNames[i],
			line: { color: colors[i], width: 2 },
			marker: { size: 4, color: colors[i] },
			visible: true,
			yaxis: i === 10 ? 'y2' : 'y' // Power uses secondary y-axis
		});
	}
	
	// Define layout
	plotlyLayout = {
		title: '',
		xaxis: {
			title: 'Time (s)',
			showgrid: true,
			gridcolor: '#eef1f7'
		},
		yaxis: {
			title: 'Temperature (°C)',
			side: 'left',
			showgrid: true,
			gridcolor: '#eef1f7'
		},
		yaxis2: {
			title: 'Power (W)',
			side: 'right',
			overlaying: 'y',
			showgrid: false
		},
		legend: {
			x: 1.02,
			y: 1,
			bgcolor: 'rgba(255,255,255,0.8)',
			bordercolor: '#ccc',
			borderwidth: 1
		},
		margin: { l: 60, r: 60, t: 40, b: 60 },
		plot_bgcolor: 'rgba(0,0,0,0)',
		paper_bgcolor: 'rgba(0,0,0,0)',
		font: { color: '#666' }
	};
	
	// Define config
	plotlyConfig = {
		responsive: true,
		displayModeBar: false,
		staticPlot: false
	};
	
    // Initialize the plot
    var PlotlyRef = window.Plotly;
    if (!PlotlyRef) { return; }
    PlotlyRef.newPlot(chartDiv, traces, plotlyLayout, plotlyConfig);
    chartInitialized = true;
	
	// Set up popout overlay handlers
	var overlay = document.getElementById('graphOverlay');
	var closeBtn = document.getElementById('closeOverlay');
	var popDiv = document.getElementById('tempChartPop');
	if (overlay && popDiv) {
		chartDiv.addEventListener('click', function(){ 
			overlay.className = ''; 
            // Copy the main plot to popout with current data
            var PlotlyRef = window.Plotly;
            if (!PlotlyRef) return;
            // Build current traces for popout
            var tracesNow = [];
            for (var i = 0; i < 12; i++) {
                tracesNow.push({ x: [], y: [], type: 'scatter' });
            }
            // If not initialized yet, create pop plot now
            if (!popInitialized) {
                PlotlyRef.newPlot(popDiv, tracesNow, plotlyLayout, plotlyConfig);
                popInitialized = true;
            }
            redrawChart();
		});
		if (closeBtn) closeBtn.addEventListener('click', function(){ overlay.className = 'overlay-hidden'; });
	}
	
	hoverInfoEl = document.getElementById('hoverInfo');
	var pauseEl = document.getElementById('pauseGraph');
	
	// Set up hover event
    chartDiv.on('plotly_hover', function(data) {
		if (hoverInfoEl && data.points.length > 0) {
			var point = data.points[0];
			var time = point.x;
			var value = point.y;
			var seriesName = point.data.name;
			hoverInfoEl.textContent = seriesName + ': ' + value.toFixed(2) + ' at ' + time.toFixed(1) + 's';
		}
	});
	
    chartDiv.on('plotly_unhover', function() {
		if (hoverInfoEl) hoverInfoEl.textContent = 'Hover for details…';
	});
}

function addPoint(timeSec, valuesArray11) {
	chartData.time.push(timeSec);
    for (var i = 0; i < 12; i++) {
		chartData.series[i].push(valuesArray11[i]);
	}
	if (chartData.time.length > maxPoints) {
		chartData.time.shift();
        for (var j = 0; j < 12; j++) chartData.series[j].shift();
	}
	
	// If CSV saving is active, store this data point
	if (isSavingCsv) {
		var fanSpeed = fanSpeedInput ? parseInt(fanSpeedInput.value, 10) : 0;
		var dataRow = {
			time: timeSec,
			temps: valuesArray11.slice(0, 8), // T1-T8
			heaterL: valuesArray11[8],
			heaterR: valuesArray11[9],
			power: valuesArray11[10],
			target: valuesArray11[11],
			fanSpeed: fanSpeed
		};
		csvData.push(dataRow);
	}
    // Update bottom Chart.js live chart
    try {
        var lc = window.liveChartRef;
        if (lc) {
            lc.data.labels.push(timeSec.toFixed(1));
            // Map to 10 temps + power + target (indices 0..9 temps, 8..9 heaters, 10 power, 11 target)
            for (var d = 0; d < 12; d++) {
                var v = (d < 10) ? valuesArray11[d] : (d === 10 ? valuesArray11[10] : valuesArray11[11]);
                lc.data.datasets[d].data.push(typeof v === 'number' && isFinite(v) ? v : null);
                if (lc.data.datasets[d].data.length > maxPoints) lc.data.datasets[d].data.shift();
            }
            if (lc.data.labels.length > maxPoints) lc.data.labels.shift();
            lc.update('none');
        }
    } catch (e) { /* ignore */ }
    // Push into Chart.js if present
    try {
        if (chartJsRef) {
            chartJsRef.data.labels.push(timeSec.toFixed(1));
            for (var d = 0; d < 12; d++) {
                chartJsRef.data.datasets[d].data.push(valuesArray11[d]);
                if (chartJsRef.data.datasets[d].data.length > maxPoints) {
                    chartJsRef.data.datasets[d].data.shift();
                }
            }
            if (chartJsRef.data.labels.length > maxPoints) chartJsRef.data.labels.shift();
            chartJsRef.update('none');
        }
    } catch (e) { /* ignore */ }
    // Push directly into Plotly for smooth real-time drawing
    try {
        var PlotlyRef = window.Plotly;
        if (chartInitialized && PlotlyRef && chartDivRef) {
            var xArr = []; var yArr = []; var idx = [];
            for (var k = 0; k < 12; k++) {
                xArr.push([timeSec]);
                yArr.push([valuesArray11[k]]);
                idx.push(k);
            }
            PlotlyRef.extendTraces(chartDivRef, { x: xArr, y: yArr }, idx, maxPoints);
        }
    } catch (e) { /* ignore */ }
	redrawChart();
}

function redrawChart() {
	var chartDiv = document.getElementById('tempChart');
    if (!chartDiv) return; // Plotly section might be absent
    if (!window.Plotly || !chartInitialized) return;

	if (chartData.time.length === 0) return;
	
	// Define colors for each series (same as original)
	var colors = ['#ff4d4f','#40a9ff','#73d13d','#fa8c16','#b37feb','#36cfc9','#f759ab','#9254de','#faad14','#1f7a8c','#000000','#ff007a'];
	var seriesNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Heater Left', 'Heater Right', 'Power', 'Target Temp'];
	
    // Create traces with current data
    var traces = [];
    var minY = Infinity, maxY = -Infinity; // primary axis temps/heaters
    var minY2 = Infinity, maxY2 = -Infinity; // secondary axis (power)
    for (var i = 0; i < 12; i++) {
        // Use full arrays (replace invalid numbers with null so Plotly can connect gaps)
        var xData = chartData.time.slice();
        var yData = [];
        for (var j = 0; j < chartData.series[i].length; j++) {
            var v = chartData.series[i][j];
            var val = (typeof v === 'number' && isFinite(v)) ? v : null;
            // Treat unrealistic spikes as invalid (e.g., -2047.99)
            if (val !== null) {
                if (i === 10) { // power on y2
                    if (val < -1e6 || val > 1e6) { val = null; }
                    else {
                        if (val < minY2) minY2 = val;
                        if (val > maxY2) maxY2 = val;
                    }
                } else {
                    if (val < -50 || val > 200) { val = null; }
                    else {
                        if (val < minY) minY = val;
                        if (val > maxY) maxY = val;
                    }
                }
            }
            yData.push(val);
        }
		
        traces.push({
			x: xData,
			y: yData,
			type: 'scatter',
            mode: 'lines+markers',
            connectgaps: true,
			name: seriesNames[i],
			line: { color: colors[i], width: 2 },
			marker: { size: 4, color: colors[i] },
            visible: true,
			yaxis: i === 10 ? 'y2' : 'y' // Power uses secondary y-axis
		});
	}
	
    // Update the plot
    var PlotlyRef = window.Plotly;
    if (!PlotlyRef) return;
    try {
        if (!chartInitialized) {
            PlotlyRef.newPlot(chartDiv, traces, plotlyLayout, plotlyConfig);
            chartInitialized = true;
            } else {
            PlotlyRef.react(chartDiv, traces, plotlyLayout, plotlyConfig);
        }
    } catch (e) {
        // As a safe fallback, try full replot
        try {
            PlotlyRef.newPlot(chartDiv, traces, plotlyLayout, plotlyConfig);
            chartInitialized = true;
        } catch (e2) { /* ignore */ }
    }
    // Compute reasonable ranges; add 5% headroom
    var yRange = null, y2Range = null;
    if (isFinite(minY) && isFinite(maxY)) {
        var span = Math.max(1e-6, maxY - minY);
        var pad = span * 0.05;
        yRange = [minY - pad, maxY + pad];
    }
    if (isFinite(minY2) && isFinite(maxY2)) {
        var span2 = Math.max(1e-6, maxY2 - minY2);
        var pad2 = span2 * 0.05;
        y2Range = [minY2 - pad2, maxY2 + pad2];
    }
    try {
        var relayoutObj = { 'xaxis.autorange': true };
        if (yRange) { relayoutObj['yaxis.autorange'] = false; relayoutObj['yaxis.range'] = yRange; }
        else { relayoutObj['yaxis.autorange'] = true; }
        if (y2Range) { relayoutObj['yaxis2.autorange'] = false; relayoutObj['yaxis2.range'] = y2Range; }
        else { relayoutObj['yaxis2.autorange'] = true; }
        PlotlyRef.relayout(chartDiv, relayoutObj);
    } catch (e) { }
	
	// Also update popout if it's visible
	var overlay = document.getElementById('graphOverlay');
	var popDiv = document.getElementById('tempChartPop');
    if (overlay && overlay.className !== 'overlay-hidden' && popDiv && PlotlyRef) {
        if (!popInitialized) {
            PlotlyRef.newPlot(popDiv, traces, plotlyLayout, plotlyConfig);
            popInitialized = true;
            } else {
            PlotlyRef.react(popDiv, traces, plotlyLayout, plotlyConfig);
            try { PlotlyRef.relayout(popDiv, { 'xaxis.autorange': true, 'yaxis.autorange': true, 'yaxis2.autorange': true }); } catch (e) {}
        }
	}
}

// Plotly handles hover events automatically, so we don't need these functions

// Format seconds float into HH:MM:SS.mmm
function formatTimeHmsMs(totalSeconds) {
	if (typeof totalSeconds !== 'number' || !isFinite(totalSeconds)) {
		return '00:00:00.000';
	}
	var ms = Math.floor((totalSeconds % 1) * 1000);
	var whole = Math.floor(totalSeconds);
	var s = whole % 60;
	var m = Math.floor(whole / 60) % 60;
	var h = Math.floor(whole / 3600);
	function pad2(n) { return String(n).padStart(2, '0'); }
	function pad3(n) { return String(n).padStart(3, '0'); }
	return pad2(h) + ':' + pad2(m) + ':' + pad2(s) + '.' + pad3(ms);
}

// Hook up checkbox toggles
document.addEventListener('change', function(evt) {
	var target = evt.target;
	if (target && target.matches && target.matches('#seriesToggles input[type="checkbox"]')) {
		var idx = parseInt(target.getAttribute('data-series'), 10);
		var checked = target.checked;
		if (!isNaN(idx)) {
			chartData.enabled[idx] = checked;
			redrawChart();
		}
	}
});
// Renderer process script: UI and IPC communication with main process
// Runs in the renderer (web page) and uses the secure preload API

let isConnected = false;
let packetCount = 0;

// Get references to HTML elements
const comPortSelect = null; // Element doesn't exist in current HTML
const baudRateSelect = null; // Element doesn't exist in current HTML
const connectBtn = document.getElementById('webConnectBtn');
const disconnectBtn = null; // No disconnect button in current HTML
const refreshPortsBtn = null; // Element doesn't exist in current HTML
const webConnectBtn = document.getElementById('webConnectBtn');
const adminBtn = document.getElementById('adminBtn');
const connectionStatus = null; // Element doesn't exist in current HTML
const packetCountDisplay = null; // Element doesn't exist in current HTML
const lastUpdateDisplay = document.getElementById('lastUpdate');
const connectionInfoDisplay = null; // Element doesn't exist in current HTML
const rawDataDisplay = null; // Element doesn't exist in current HTML
const parsedDataDisplay = null; // Element doesn't exist in current HTML
const fanSpeedInput = document.getElementById('fanSpeed');
const fanSpeedDisplay = document.getElementById('fanSpeedDisplay');
const fanTooltip = document.getElementById('fanTooltip');
const heaterTempInput = document.getElementById('heaterTemp');
const heaterTempValue = document.getElementById('heaterTempValue');
const heaterTooltip = document.getElementById('heaterTooltip');
const heaterOffBtn = document.getElementById('heaterOff');
const heaterLeftBtn = document.getElementById('heaterLeft');
const heaterRightBtn = document.getElementById('heaterRight');
const coolerBtn = document.getElementById('coolerBtn');
var heaterMode = 0; // 0=off,1=left,2=right,3=cooler
var heaterLeftTemp = 0; // Store left heater temperature
var heaterRightTemp = 0; // Store right heater temperature

function addToLog(message) {
	const timestamp = new Date().toLocaleTimeString();
	const logEntry = '[' + timestamp + '] ' + message + '\n';
	console.log(logEntry.trim());
}

// Create a safe fallback for electronAPI if it doesn't exist
// This prevents crashes if the preload script didn't load properly
function ensureElectronAPI() {
	if (!window.electronAPI) {
		window.electronAPI = {
			getAvailablePorts: async function() { return []; },
			connectToPort: async function() { return { success: false, error: 'electronAPI unavailable' }; },
			disconnectFromPort: async function() { return { success: true }; },
			onDataReceived: function() {},
			onConnectionStatus: function() {},
			onPortsUpdate: function() {},
			removeAllListeners: function() {}
		};
		return false; // Return false to indicate API was missing
	}
	return true; // Return true to indicate API is available
}

// --- Web Serial (browser) fallback ---
let webSerialPort = null;
let webSerialReader = null;
async function tryWebSerialAutoConnect() {
    if (!('serial' in navigator)) { addToLog('Web Serial API not available in this browser.'); return; }
    try {
        // Try previously-granted ports first (no prompt). Filters help some browsers label the device
        const ports = await navigator.serial.getPorts();
        for (const p of ports) {
            const info = p.getInfo ? p.getInfo() : {};
            const vid = (info.usbVendorId || 0).toString(16).toUpperCase().padStart(4, '0');
            const pid = (info.usbProductId || 0).toString(16).toUpperCase().padStart(4, '0');
            if (vid === '12BF' && pid === '010C') {
                await openWebSerial(p);
                return;
            }
        }
        // If we reach here, no pre-authorized port exists. Browsers require a user gesture to request access.
        addToLog('Web mode: cannot auto-request serial permission without a click. Click anywhere to grant once.');
        document.body.addEventListener('click', requestWebSerialOnce, { once: true });
    } catch (e) {
        addToLog('Web Serial error: ' + e.message);
    }
}

async function requestWebSerialOnce() {
    try {
        const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x12BF, usbProductId: 0x010C }] });
        await openWebSerial(port);
    } catch (e) {
        addToLog('User denied Web Serial permission or error: ' + e.message);
    }
}

async function openWebSerial(port) {
    try {
        await port.open({ baudRate: 115200 });
        webSerialPort = port;
        updateConnectionStatus(true, 'WebSerial');
        addToLog('Web Serial connected');
        const decoder = new TextDecoder();
        const reader = port.readable.getReader();
        webSerialReader = reader;
        let buffer = new Uint8Array(0);
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.length) {
                // Forward raw bytes into existing packet assembler path by calling handleIncomingData with Uint8Array
                handleIncomingData(new Uint8Array(value));
            }
        }
    } catch (e) {
        addToLog('Web Serial open error: ' + e.message);
        updateConnectionStatus(false);
    }
}

async function closeWebSerial() {
    try { if (webSerialReader) { await webSerialReader.cancel(); } } catch {}
    try { if (webSerialPort) { await webSerialPort.close(); } } catch {}
    webSerialReader = null; webSerialPort = null;
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
			if (systemStatusIndicator) systemStatusIndicator.textContent = 'SYSTEM ONLINE';
			systemStatusIndicator.classList.remove('offline');
			systemStatusIndicator.classList.add('online');
		} else {
			if (systemStatusIndicator) systemStatusIndicator.textContent = 'SYSTEM OFFLINE';
			systemStatusIndicator.classList.remove('online');
			systemStatusIndicator.classList.add('offline');
		}
	}
	
	if (connected) {
		if (connectionStatus) {
		connectionStatus.textContent = 'Connected';
		connectionStatus.className = 'status-connected';
		}
		if (connectionInfoDisplay) connectionInfoDisplay.textContent = portInfo;
		if (connectBtn) connectBtn.disabled = true;
		if (disconnectBtn) disconnectBtn.disabled = false;
	} else {
		if (connectionStatus) {
		connectionStatus.textContent = 'Disconnected';
		connectionStatus.className = 'status-disconnected';
		}
		if (connectionInfoDisplay) connectionInfoDisplay.textContent = 'No device connected';
        if (connectBtn) connectBtn.disabled = true;
        if (disconnectBtn) disconnectBtn.disabled = true;
	}
}

async function refreshComPorts() {
	try {
		addToLog('Refreshing available COM ports...');
		const ports = await window.electronAPI.getAvailablePorts();
        if (comPortSelect) {
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
		}
		addToLog('Found ' + ports.length + ' available ports:');
		for (var j = 0; j < ports.length; j++) {
			var p = ports[j];
			addToLog('  - ' + p.path + ': ' + (p.manufacturer || 'Unknown') + ' (SN: ' + (p.serialNumber || 'Unknown') + ')');
		}
		if (ports.length === 0) {
			addToLog('No COM ports found. Try:');
			addToLog('  1. Check if device is connected');
			addToLog('  2. Install device drivers');
			addToLog('  3. Check Device Manager for COM port number');
			addToLog('  4. Try a different USB cable/port');
		}
	} catch (error) {
		addToLog('Error refreshing ports: ' + error.message);
		addToLog('This might be a permissions issue. Try running as administrator.');
	}
}

function handlePortsUpdateFromMain(event, ports) {
    if (comPortSelect) {
	var previousSelection = comPortSelect.value;
        comPortSelect.innerHTML = '<option value=\"\">Select COM Port...</option>';
	for (var i = 0; i < ports.length; i++) {
		var port = ports[i];
		var option = document.createElement('option');
		option.value = port.path;
		var manufacturer = port.manufacturer || 'Unknown Device';
		var serialNumber = port.serialNumber || 'Unknown';
		option.textContent = port.path + ' - ' + manufacturer + ' (SN: ' + serialNumber + ')';
		comPortSelect.appendChild(option);
	}
	if (previousSelection && ports.some(function(p) { return p.path === previousSelection; })) {
		comPortSelect.value = previousSelection;
		return;
        }
    }

	// Update popout plot if visible
	try {
		var overlayEl = document.getElementById('graphOverlay');
		if (overlayEl && overlayEl.className !== 'overlay-hidden') {
			redrawChart(); // This will update both main and popout plots
		}
	} catch (e) { }
}

// This function is no longer needed with Plotly.js

async function connectToPort() {
	var selectedPort = comPortSelect.value;
    var selectedBaudRate = 115200;
    if (baudRateSelect && typeof baudRateSelect.value === 'string' && baudRateSelect.value.trim() !== '') {
        var parsed = parseInt(baudRateSelect.value, 10);
        if (!isNaN(parsed)) {
            selectedBaudRate = parsed;
        }
    }
	if (!selectedPort) {
		addToLog('Please select a COM port first');
		return;
	}
	try {
		addToLog('Attempting to connect to ' + selectedPort + ' at ' + selectedBaudRate + ' baud...');
		var result = await window.electronAPI.connectToPort(selectedPort, selectedBaudRate);
		if (result.success) {
			addToLog('Successfully connected to ' + selectedPort);
			updateConnectionStatus(true, selectedPort + ' @ ' + selectedBaudRate + ' baud');
		} else {
			addToLog('Failed to connect: ' + result.error);
			updateConnectionStatus(false);
		}
	} catch (error) {
		addToLog('Connection error: ' + error.message);
		updateConnectionStatus(false);
	}
}

async function disconnectFromPort() {
	try {
		addToLog('Disconnecting from port...');
		var result = await window.electronAPI.disconnectFromPort();
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

function handleIncomingData(data) {
	console.log('Data received:', data); // Debug log
	var dataArray = (function(d) {
		// Convert incoming data to a plain array of bytes in a safe, simple way
		try {
			if (Array.isArray(d)) {
				return d.slice();
			}
			if (d instanceof Uint8Array) {
				return Array.from(d);
			}
			if (d && typeof d.length === 'number') {
				return Array.from(d);
			}
			// Last attempt: try to wrap in Uint8Array
			return Array.from(new Uint8Array(d));
		} catch (e) {
			addToLog('Unable to parse incoming data: ' + (e && e.message ? e.message : String(e)));
			return [];
		}
	})(data);
	console.log('Data array length:', dataArray.length); // Debug log
	if (dataArray.length >= 56) {
		if (dataArray[0] === 0x55 && dataArray[1] === 0x55) {
			if (dataArray[54] === 0xAA && dataArray[55] === 0xAA) {
                // We are receiving valid frames; ensure UI shows ONLINE
                try { updateConnectionStatus(true); } catch (e) {}
				packetCount += 1;
				if (packetCountDisplay) packetCountDisplay.textContent = String(packetCount);
				if (lastUpdateDisplay) lastUpdateDisplay.textContent = new Date().toLocaleTimeString();
				displayRawData(dataArray);
				addRawData(dataArray);
				parseAndDisplayData(dataArray);
				addToLog('Valid packet received (' + packetCount + ')');
			} else {
				addToLog('Invalid packet: Wrong footer bytes');
			}
		} else {
			addToLog('Invalid packet: Wrong header bytes');
		}
	} else {
		addToLog('Incomplete data received: ' + dataArray.length + ' bytes (expected 56)');
	}
}

function addRawData(data) {
    if (!data || data.length === 0) return;
    
    const hexString = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
    if (rawDataDisplay) {
        rawDataDisplay.textContent = hexString;
	}
}

function displayRawData(dataArray) {
	var hexString = '';
	for (var i = 0; i < dataArray.length; i += 16) {
		var row = '';
		var ascii = '';
		for (var j = 0; j < 16 && i + j < dataArray.length; j++) {
			var byte = dataArray[i + j];
			row += byte.toString(16).toUpperCase().padStart(2, '0') + ' ';
			ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
		}
		hexString += i.toString(16).toUpperCase().padStart(4, '0') + ': ' + row.padEnd(48) + ' ' + ascii + '\n';
	}
	if (rawDataDisplay) rawDataDisplay.textContent = hexString;
}

function parseAndDisplayData(dataArray) {
	var parsedInfo = '';
	var actualData = dataArray.slice(2, 54);
	parsedInfo += 'Packet Structure:\n';
	parsedInfo += 'Header: 0x' + dataArray[0].toString(16).padStart(2, '0') + ' 0x' + dataArray[1].toString(16).padStart(2, '0') + '\n';
	parsedInfo += 'Data Length: ' + actualData.length + ' bytes\n';
	parsedInfo += 'Footer: 0x' + dataArray[54].toString(16).padStart(2, '0') + ' 0x' + dataArray[55].toString(16).padStart(2, '0') + '\n\n';
	parsedInfo += 'Data Interpretation:\n';
	// Bytes 2..33 (32 bytes) are eight 4-byte float temperatures (little-endian)
	if (actualData.length >= 32) {
		for (var sensorIndex = 0; sensorIndex < 8; sensorIndex++) {
			var base = sensorIndex * 4;
			var b0 = actualData[base + 0];
			var b1 = actualData[base + 1];
			var b2 = actualData[base + 2];
			var b3 = actualData[base + 3];
			var buf = new ArrayBuffer(4);
			var dv = new DataView(buf);
			dv.setUint8(0, b0);
			dv.setUint8(1, b1);
			dv.setUint8(2, b2);
			dv.setUint8(3, b3);
			var temp = dv.getFloat32(0, true); // little-endian
			// Map Sensor8->T1, Sensor7->T2, ..., Sensor1->T8
			var labelIndex = 8 - sensorIndex; // Sensor8..1
			var tileId = 't' + (9 - labelIndex); // t1..t8
			var tileEl = document.getElementById(tileId);
			if (tileEl) {
				tileEl.textContent = 'T' + (9 - labelIndex) + ': ' + temp.toFixed(2) + '\u00B0C';
			}
			parsedInfo += 'Sensor ' + (sensorIndex + 1) + ': ' + temp.toFixed(2) + '\u00B0C\n';
		}

		// Bytes 34..37 (actualData[32..35]): time as float32 (little-endian)
		if (actualData.length >= 36) {
			var t0 = actualData[32], t1 = actualData[33], t2 = actualData[34], t3 = actualData[35];
			var tbuf = new ArrayBuffer(4);
			var tdv = new DataView(tbuf);
			tdv.setUint8(0, t0);
			tdv.setUint8(1, t1);
			tdv.setUint8(2, t2);
			tdv.setUint8(3, t3);
			var timeFloat = tdv.getFloat32(0, true);
			var timeFormattedDisplay = formatTimeHmsMs(timeFloat);
			parsedInfo += 'Time: ' + timeFormattedDisplay + '\n';
			var timeEl = document.getElementById('timeTile');
			if (timeEl) { timeEl.textContent = 'Time: ' + timeFormattedDisplay; }

			// If we have at least 8 temps and 2 heaters, push to chart
			var tempsForChart = [];
			// Reconstruct the eight temps again (simple and clear for beginners)
			for (var s2 = 0; s2 < 8; s2++) {
				var b = s2 * 4;
				var abuf = new ArrayBuffer(4);
				var adv = new DataView(abuf);
				adv.setUint8(0, actualData[b + 0]);
				adv.setUint8(1, actualData[b + 1]);
				adv.setUint8(2, actualData[b + 2]);
				adv.setUint8(3, actualData[b + 3]);
				tempsForChart.push(adv.getFloat32(0, true));
			}
			// Heaters if available
			if (actualData.length >= 44) {
				var hb0 = actualData[36], hb1 = actualData[37], hb2 = actualData[38], hb3 = actualData[39];
				var hb4 = actualData[40], hb5 = actualData[41], hb6 = actualData[42], hb7 = actualData[43];
				var hbuf1 = new ArrayBuffer(4), hbuf2 = new ArrayBuffer(4);
				var hdv1 = new DataView(hbuf1), hdv2 = new DataView(hbuf2);
				hdv1.setUint8(0, hb0); hdv1.setUint8(1, hb1); hdv1.setUint8(2, hb2); hdv1.setUint8(3, hb3);
				hdv2.setUint8(0, hb4); hdv2.setUint8(1, hb5); hdv2.setUint8(2, hb6); hdv2.setUint8(3, hb7);
				tempsForChart.push(hdv1.getFloat32(0, true));
				tempsForChart.push(hdv2.getFloat32(0, true));
			} else {
				tempsForChart.push(NaN);
				tempsForChart.push(NaN);
			}
			// Power if available
			if (actualData.length >= 48) {
				var pp0 = actualData[44], pp1 = actualData[45], pp2 = actualData[46], pp3 = actualData[47];
				var pbuf2 = new ArrayBuffer(4);
				var pdv2 = new DataView(pbuf2);
				pdv2.setUint8(0, pp0); pdv2.setUint8(1, pp1); pdv2.setUint8(2, pp2); pdv2.setUint8(3, pp3);
				tempsForChart.push(pdv2.getFloat32(0, true)); // series index 10
			} else {
				tempsForChart.push(NaN);
			}
			// Target temp from slider (use current UI value if available)
			var targetTempFromUI = heaterTempInput ? parseInt(heaterTempInput.value, 10) : NaN;
			tempsForChart.push(isNaN(targetTempFromUI) ? NaN : targetTempFromUI); // series index 11
			if (typeof addPoint === 'function') {
				addPoint(timeFloat, tempsForChart);
			}
		}

		// Bytes 38..45 (actualData[36..43]): two more temperature sensors as float32
		if (actualData.length >= 44) {
			for (var extraIndex = 0; extraIndex < 2; extraIndex++) {
				var ebase = 36 + extraIndex * 4;
				var eb0 = actualData[ebase + 0];
				var eb1 = actualData[ebase + 1];
				var eb2 = actualData[ebase + 2];
				var eb3 = actualData[ebase + 3];
				var ebuf = new ArrayBuffer(4);
				var edv = new DataView(ebuf);
				edv.setUint8(0, eb0);
				edv.setUint8(1, eb1);
				edv.setUint8(2, eb2);
				edv.setUint8(3, eb3);
				var etemp = edv.getFloat32(0, true);
				parsedInfo += 'Sensor ' + (9 + extraIndex) + ': ' + etemp.toFixed(2) + '\u00B0C\n';
				var heaterEl = document.getElementById(extraIndex === 0 ? 'heaterLeft' : 'heaterRight');
				if (heaterEl) {
					heaterEl.textContent = (extraIndex === 0 ? 'Heater Left: ' : 'Heater Right: ') + etemp.toFixed(2) + '\u00B0C';
				}
				
				// Store heater temperatures for display
				if (extraIndex === 0) {
					heaterLeftTemp = etemp;
				} else {
					heaterRightTemp = etemp;
				}
			}
		}

		// Bytes 46..49 (actualData[44..47]): Power as float32 (1 decimal place)
		if (actualData.length >= 48) {
			var p0 = actualData[44], p1 = actualData[45], p2 = actualData[46], p3 = actualData[47];
			var pbuf = new ArrayBuffer(4);
			var pdv = new DataView(pbuf);
			pdv.setUint8(0, p0); pdv.setUint8(1, p1); pdv.setUint8(2, p2); pdv.setUint8(3, p3);
			var power = pdv.getFloat32(0, true);
			parsedInfo += 'Power: ' + power.toFixed(1) + ' W\n';
			var powerEl = document.getElementById('powerTile');
			if (powerEl) { powerEl.textContent = 'Power: ' + power.toFixed(1) + ' W'; }
		}
	} else if (actualData.length >= 4) {
		// At least one sensor available
		var tb0 = actualData[0], tb1 = actualData[1], tb2 = actualData[2], tb3 = actualData[3];
		var bf = new ArrayBuffer(4);
		var dvf = new DataView(bf);
		dvf.setUint8(0, tb0);
		dvf.setUint8(1, tb1);
		dvf.setUint8(2, tb2);
		dvf.setUint8(3, tb3);
		var t = dvf.getFloat32(0, true);
		parsedInfo += 'Sensor 1: ' + t.toFixed(2) + '\u00B0C\n';
	}
	parsedInfo += '\nFirst 20 data bytes: ';
	for (var i = 0; i < Math.min(20, actualData.length); i++) {
		parsedInfo += '0x' + actualData[i].toString(16).padStart(2, '0') + ' ';
	}
	if (parsedDataDisplay) parsedDataDisplay.textContent = parsedInfo;
}

function clearLog() {
	console.log('Connection log cleared');
	packetCount = 0;
	if (packetCountDisplay) packetCountDisplay.textContent = '0';
	if (lastUpdateDisplay) lastUpdateDisplay.textContent = 'Never';
	if (rawDataDisplay) rawDataDisplay.textContent = 'No data received yet';
	if (parsedDataDisplay) parsedDataDisplay.textContent = 'Data will be parsed and displayed here';
}



function startCsvSaving() {
    // Ask user for save location
    if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
            title: 'Save Heat Transfer Data',
            defaultPath: 'Heat Transfer Data.csv',
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        }).then(result => {
            if (!result.canceled && result.filePath) {
                // Start saving to the selected path
                isSavingCsv = true;
                csvData = []; // Clear previous data
                csvSavePath = result.filePath; // Store the selected path
                startCsvBtn.style.display = 'none'; // Hide start button
                stopCsvBtn.style.display = 'inline-block'; // Show stop button
                addToLog('CSV saving started - saving to: ' + result.filePath);
            } else {
                addToLog('Save cancelled by user');
            }
        }).catch(error => {
            addToLog('Error opening save dialog: ' + error.message);
        });
    } else {
        // Fallback for web version - use default download
        isSavingCsv = true;
        csvData = []; // Clear previous data
        csvSavePath = null; // No specific path for web version
        startCsvBtn.style.display = 'none'; // Hide start button
        stopCsvBtn.style.display = 'inline-block'; // Show stop button
        addToLog('CSV saving started - will download when stopped');
    }
}

function stopCsvSaving() {
    // Stop saving and export
    isSavingCsv = false;
    startCsvBtn.style.display = 'inline-block'; // Show start button
    stopCsvBtn.style.display = 'none'; // Hide stop button
        
    if (csvData.length === 0) {
        addToLog('No data collected during saving session');
        return;
    }
    
    // Create CSV content from collected data
    var csvContent = 'Time(s),T1,T2,T3,T4,T5,T6,T7,T8,HeaterL,HeaterR,Power,Target,FanSpeed\n';
    
    for (var i = 0; i < csvData.length; i++) {
        var data = csvData[i];
        var time = data.time.toFixed(1);
        var row = time + ',';
        
        // Add temperature data (T1-T8)
        for (var j = 0; j < 8; j++) {
            var val = data.temps[j];
            row += (typeof val === 'number' && isFinite(val) ? val.toFixed(1) : '') + ',';
        }
        
        // Add heater data
        row += (typeof data.heaterL === 'number' && isFinite(data.heaterL) ? data.heaterL.toFixed(1) : '') + ',';
        row += (typeof data.heaterR === 'number' && isFinite(data.heaterR) ? data.heaterR.toFixed(1) : '') + ',';
        
        // Add power
        row += (typeof data.power === 'number' && isFinite(data.power) ? data.power.toFixed(1) : '') + ',';
        
        // Add target
        row += (typeof data.target === 'number' && isFinite(data.target) ? data.target.toFixed(1) : '') + ',';
        
        // Add fan speed
        row += data.fanSpeed;
        
        csvContent += row + '\n';
    }
    
    // Save to the selected path if available
    if (csvSavePath && window.electronAPI && window.electronAPI.writeFile) {
        // Save to the selected file path
        window.electronAPI.writeFile(csvSavePath, csvContent).then(() => {
            addToLog('CSV file saved to: ' + csvSavePath + ' (' + csvData.length + ' points collected)');
            csvSavePath = null; // Reset the path
        }).catch(error => {
            addToLog('Error saving CSV file: ' + error.message);
            // Fallback to download
            downloadCsvFile(csvContent);
        });
    } else {
        // Fallback to download
        downloadCsvFile(csvContent);
    }
}

function downloadCsvFile(csvContent) {
    // Generate filename with current date and time
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    
    var filename = 'Heat Transfer ' + year + '-' + month + '-' + day + ' ' + hours + '-' + minutes + '-' + seconds + '.csv';
    
    // Create and download the file
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    
    if (link.download !== undefined) {
        var url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addToLog('CSV file downloaded: ' + filename + ' (' + csvData.length + ' points collected)');
    } else {
        addToLog('CSV download not supported in this browser');
    }
}

function applyTheme(themeKey) {
	var body = document.body;
	// Keep default only; remove other theme classes if present
	body.classList.remove('theme-dark');
	body.classList.remove('theme-contrast');
	body.classList.remove('theme-monitor');
}

function applyLayout(layoutKey) {
	// Keep standard layout only; remove other layout classes if present
	var body = document.body;
	body.classList.remove('layout-compact');
	body.classList.remove('layout-stacked');
	body.classList.add('layout-standard');
}
function setupDataListeners() {
	window.electronAPI.onDataReceived(function(event, data) {
		handleIncomingData(data);
	});
  // Also display raw incoming chunks for debugging when framing fails
  if (window.electronAPI.onDataChunk) {
    window.electronAPI.onDataChunk(function(event, chunk) {
      try {
        var arr = (chunk instanceof Uint8Array) ? Array.from(chunk) : (Array.isArray(chunk) ? chunk.slice() : Array.from(new Uint8Array(chunk)));
        // Show last ~128 bytes of raw stream in Raw Data panel if no valid packet shown yet
        if (rawDataDisplay && (!rawDataDisplay.textContent || rawDataDisplay.textContent.indexOf('No data received yet') !== -1)) {
          var hex = '';
          var start = Math.max(0, arr.length - 128);
          for (var i = start; i < arr.length; i++) {
            hex += arr[i].toString(16).toUpperCase().padStart(2, '0') + ' ';
          }
          if (rawDataDisplay) rawDataDisplay.textContent = hex.trim();
        }
      } catch (e) {
        // ignore
      }
    });
  }
	window.electronAPI.onConnectionStatus(function(event, status) {
		if (status.connected) {
			updateConnectionStatus(true, status.port);
		} else {
			updateConnectionStatus(false);
			if (status.error) {
				addToLog('Connection error: ' + status.error);
			}
		}
	});
}

if (connectBtn) connectBtn.addEventListener('click', connectToPort);
if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectFromPort);
if (refreshPortsBtn) refreshPortsBtn.addEventListener('click', refreshComPorts);

document.addEventListener('DOMContentLoaded', function() {
	// Check if electronAPI is available and create fallback if needed
	var apiAvailable = ensureElectronAPI();

	addToLog('Heat Transfer Data Reader started');

	if (!apiAvailable) {
		addToLog('Warning: electronAPI bridge not found. Running in limited mode.');
		addToLog('Make sure preload.js is loading correctly.');
	}

	addToLog('Click "Refresh Ports" to see available COM ports');
    // Initialize charts (Chart.js)
	initChart();
	setupDataListeners();
    
    // Setup clear/save controls
    var clearDataBtn = document.getElementById('clearDataBtn');
    var startCsvBtn = document.getElementById('startCsvBtn');
    var stopCsvBtn = document.getElementById('stopCsvBtn');
    
    
    
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function() {
            // Clear all chart data
            chartData.time = [];
            for (var i = 0; i < 12; i++) {
                chartData.series[i] = [];
            }
            
            // Clear Chart.js data
            if (window.liveChartRef) {
                window.liveChartRef.data.labels = [];
                for (var j = 0; j < window.liveChartRef.data.datasets.length; j++) {
                    window.liveChartRef.data.datasets[j].data = [];
                }
                window.liveChartRef.update('none');
            }
            
            if (chartJsRef) {
                chartJsRef.data.labels = [];
                for (var k = 0; k < chartJsRef.data.datasets.length; k++) {
                    chartJsRef.data.datasets[k].data = [];
                }
                chartJsRef.update('none');
            }
            
            redrawChart();
            addToLog('All chart data cleared');
        });
    }
    
    
    if (startCsvBtn) {
        startCsvBtn.addEventListener('click', function() {
            startCsvSaving();
        });
    }
    
    if (stopCsvBtn) {
        stopCsvBtn.addEventListener('click', function() {
            stopCsvSaving();
        });
    }
    // Initialize Chart.js test chart for live data (10 temps + power + target)
    try {
        var testCanvas = document.getElementById('testChart');
        if (testCanvas && window.Chart) {
            var ctx = testCanvas.getContext('2d');
            var colors = ['#ff4d4f','#40a9ff','#73d13d','#fa8c16','#b37feb','#36cfc9','#f759ab','#9254de','#faad14','#1f7a8c','#000000','#ff007a'];
            var labels = ['T1','T2','T3','T4','T5','T6','T7','T8','Heater Left','Heater Right','Power','Target'];
            var ds = [];
            for (var i = 0; i < 12; i++) {
                ds.push({ label: labels[i], data: [], borderColor: colors[i], backgroundColor: colors[i], pointRadius: 0, borderWidth: 2, tension: 0.2, yAxisID: i === 10 ? 'y2' : 'y' });
            }
            window.liveChartRef = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: ds },
                options: {
                    responsive: true,
                    animation: false,
                    interaction: { mode: 'nearest', intersect: false },
                    plugins: { legend: { position: 'right' } },
                    scales: {
                        x: { 
                            grid: { color: '#e0e0e0' },
                            ticks: { color: '#333' }
                        },
                        y: { 
                            type: 'linear', 
                            position: 'left', 
                            title: { display: true, text: 'Temperature (°C)', color: '#333' },
                            grid: { color: '#e0e0e0' },
                            ticks: { color: '#333' }
                        },
                        y2: { 
                            type: 'linear', 
                            position: 'right', 
                            grid: { drawOnChartArea: false, color: '#e0e0e0' }, 
                            title: { display: true, text: 'Power (W)', color: '#333' },
                            ticks: { color: '#333' }
                        }
                    }
                }
            });
        }
    } catch (e) { /* ignore */ }
	window.electronAPI.onPortsUpdate(handlePortsUpdateFromMain);
	refreshComPorts();
    // Web Serial: show connect button and try auto-connect to previously authorized port
    if (!apiAvailable) {
        if (webConnectBtn) {
            webConnectBtn.style.display = 'inline-block';
            webConnectBtn.addEventListener('click', requestWebSerialOnce);
        }
        tryWebSerialAutoConnect();
    }

    // Admin panel functionality
    if (adminBtn) {
        adminBtn.addEventListener('click', function() {
            openAdminPanel();
        });
    }

    // Remove the automatic graph popup on chart click
    // Users can use a dedicated button instead
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
        // Remove the click handler that was opening the graph window
        chartContainer.style.cursor = 'default';
        chartContainer.title = 'Chart - Use legend to hide/show data series';
    }

    // Add event listener for the dedicated "Open Graph" button
    const openGraphBtn = document.getElementById('openGraphBtn');
    if (openGraphBtn) {
        openGraphBtn.addEventListener('click', function() {
            openGraphWindow();
        });
    }

	// Apply saved theme/layout
	try {
		var savedTheme = localStorage.getItem('appTheme') || 'default';
		var savedLayout = localStorage.getItem('appLayout') || 'standard';
		applyTheme(savedTheme);
		applyLayout(savedLayout);
		var themeSel = document.getElementById('themeSelect');
		var layoutSel = document.getElementById('layoutSelect');
		if (themeSel) themeSel.value = savedTheme === 'default' ? 'default' : savedTheme;
		if (layoutSel) layoutSel.value = savedLayout;
		if (themeSel) themeSel.addEventListener('change', function(){ applyTheme(themeSel.value); localStorage.setItem('appTheme', themeSel.value); });
		if (layoutSel) layoutSel.addEventListener('change', function(){ applyLayout(layoutSel.value); localStorage.setItem('appLayout', layoutSel.value); });
	} catch (e) { /* ignore */ }

    // Simulated data generation when user clicks the button
    var simulateBtn = document.getElementById('simulateBtn');
    if (simulateBtn) {
        simulateBtn.addEventListener('click', function() {
            addToLog('Starting simulated data for 30 seconds...');
            var start = Date.now();
            var simTimer = setInterval(function(){
                var t = (Date.now() - start) / 1000; // seconds
                // Generate smooth test data
                var temps = [];
                for (var i = 0; i < 8; i++) {
                    var base = 25 + i * 0.5;
                    var val = base + Math.sin(t / 5 + i) * 2 + (Math.random() - 0.5) * 0.2;
                    temps.push(val);
                }
                var heaterL = 22 + Math.sin(t / 8) * 1.0;
                var heaterR = 22 + Math.cos(t / 8) * 1.0;
                var power = 50 + Math.sin(t / 3) * 10;
                var target = 30; // flat line
                var values = temps.concat([heaterL, heaterR, power, target]);
                addPoint(t, values);
                if ((Date.now() - start) > 30000) { clearInterval(simTimer); addToLog('Simulated data ended.'); }
            }, 250);
        });
    }
});
// Fan speed UI events
if (fanSpeedInput) {
    function updateSliderFill(value) {
        var percentage = parseInt(value, 10);
        var fillElement = document.getElementById('fanSliderFill');
        if (fillElement) {
            // Simple fill calculation - just use the percentage directly
            fillElement.style.setProperty('--fill-percent', percentage + '%');
            fillElement.style.width = percentage + '%';
        }
        console.log('Setting fill-percent to:', percentage + '%');
    }
    
    function updateFanIcon(value) {
        var percentage = parseInt(value, 10);
        var fanIcon = document.getElementById('fanThumbIcon');
        var sliderWrapper = document.querySelector('.slider-wrapper');
        
        if (fanIcon && sliderWrapper) {
            // Calculate position of the fan icon based on slider value
            var sliderWidth = sliderWrapper.offsetWidth;
            var thumbWidth = 24; // Same as thumb size
            var thumbRadius = thumbWidth / 2; // Half the thumb width for centering
            
            // Calculate the center position of the thumb
            var maxPosition = sliderWidth - thumbWidth;
            var thumbCenterPosition = (percentage / 100) * maxPosition + thumbRadius;
            
            // Position the fan icon at the center of the thumb
            fanIcon.style.left = thumbCenterPosition + 'px';
            
            // Rotate the fan icon based on speed (faster speed = faster rotation)
            var rotationSpeed = (percentage / 100) * 360; // 0 to 360 degrees
            fanIcon.style.transform = 'translate(-50%, -50%) rotate(' + rotationSpeed + 'deg)';
            
            // Add a subtle animation for continuous rotation when speed > 0
            if (percentage > 0) {
                fanIcon.style.animation = 'fanSpin ' + (2 - (percentage / 100)) + 's linear infinite';
            } else {
                fanIcon.style.animation = 'none';
            }
        }
    }
    
    function updateFanTextIcon(value) {
        var percentage = parseInt(value, 10);
        
        if (fanTextIcon && fanTextPercentage) {
            // Update the percentage text
            if (fanTextPercentage) fanTextPercentage.textContent = percentage + '%';
            
            // Control the fan icon animation based on speed
            if (percentage === 0) {
                // Stop animation and reset rotation when speed is 0
                fanTextIcon.style.animation = 'none';
                fanTextIcon.style.transform = 'rotate(0deg)';
            } else {
                // Start continuous spinning animation
                // Faster speed = faster animation (shorter duration)
                var animationDuration = 3 - (percentage / 100) * 2; // 3s at 0% to 1s at 100%
                fanTextIcon.style.animation = 'fanTextSpin ' + animationDuration + 's linear infinite';
            }
        }
    }
    
    fanSpeedInput.addEventListener('input', function() {
        var percentage = parseInt(fanSpeedInput.value, 10);
        if (fanSpeedDisplay) fanSpeedDisplay.textContent = percentage + '%';
        updateSliderFill(fanSpeedInput.value);
        updateFanIcon(fanSpeedInput.value);
    });
    
    // Fan slider hover tooltip
    fanSpeedInput.addEventListener('mousemove', function(e) {
        if (fanTooltip) {
            var rect = fanSpeedInput.getBoundingClientRect();
            var percentage = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            percentage = Math.max(0, Math.min(100, percentage));
            fanTooltip.textContent = percentage + '%';
            fanTooltip.style.left = e.clientX - rect.left + 'px';
        }
    });
    
    fanSpeedInput.addEventListener('change', async function() {
        try {
            var v = parseInt(fanSpeedInput.value, 10);
            var result = await window.electronAPI.sendFanSpeed(v);
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
    if (fanSpeedDisplay) fanSpeedDisplay.textContent = parseInt(fanSpeedInput.value, 10) + '%';
}

// Heater controls
if (heaterTempInput && heaterTempValue) {
    function updateHeaterSliderFill(value) {
        var temp = parseInt(value, 10);
        // Convert temperature range (20-70) to percentage (0-100)
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
            // Calculate position of the heater icon based on slider value
            var sliderWidth = sliderWrapper.offsetWidth;
            var thumbWidth = 24; // Same as thumb size
            var thumbRadius = thumbWidth / 2; // Half the thumb width for centering
            
            // Calculate the center position of the thumb
            var maxPosition = sliderWidth - thumbWidth;
            var tempPercentage = ((temp - 20) / (70 - 20)) * 100;
            var thumbCenterPosition = (tempPercentage / 100) * maxPosition + thumbRadius;
            
            // Position the heater icon at the center of the thumb
            heaterIcon.style.left = thumbCenterPosition + 'px';
        }
    }
    
    heaterTempInput.addEventListener('input', function() {
        var temp = parseInt(heaterTempInput.value, 10);
        if (heaterTempValue) heaterTempValue.textContent = String(temp) + '\u00B0C';
        updateHeaterSliderFill(heaterTempInput.value);
        updateHeaterIcon(heaterTempInput.value);
    });
    
    // Heater slider hover tooltip
    heaterTempInput.addEventListener('mousemove', function(e) {
        if (heaterTooltip) {
            var rect = heaterTempInput.getBoundingClientRect();
            var temp = Math.round(20 + ((e.clientX - rect.left) / rect.width) * 50);
            temp = Math.max(20, Math.min(70, temp));
            heaterTooltip.textContent = temp + '°C';
            heaterTooltip.style.left = e.clientX - rect.left + 'px';
        }
    });
    
    heaterTempInput.addEventListener('change', async function() {
        try {
            var v = parseInt(heaterTempInput.value, 10);
            var result = await window.electronAPI.sendHeaterTemp(v);
            if (!result || !result.success) {
                addToLog('Failed to send heater temp: ' + (result && result.error ? result.error : 'Unknown error'));
            } else {
                addToLog('Heater temp sent: ' + v + '\u00B0C');
            }
        } catch (e) {
            addToLog('Error sending heater temp: ' + e.message);
        }
        // Update target temp series to a flat line across current window
        var target = parseInt(heaterTempInput.value, 10);
        // Ensure series[11] exists to length xCount
        var xCount = chartData.time.length;
        chartData.series[11] = [];
        for (var i = 0; i < xCount; i++) {
            chartData.series[11].push(target);
        }
        if (chartData.enabled.length < 12) chartData.enabled[11] = true;
        redrawChart();
    });
    
    // Initialize heater slider fill and icon
    updateHeaterSliderFill(heaterTempInput.value);
    updateHeaterIcon(heaterTempInput.value);
}

// Heater mode buttons - only one can be active at a time
function updateHeaterButtons() {
    // Remove active class from heater buttons only (cooler is independent)
    if (heaterOffBtn) heaterOffBtn.classList.remove('active');
    if (heaterLeftBtn) heaterLeftBtn.classList.remove('active');
    if (heaterRightBtn) heaterRightBtn.classList.remove('active');
    
    // Add active class to current heater mode
    if (heaterMode === 0 && heaterOffBtn) {
        heaterOffBtn.classList.add('active');
    } else if (heaterMode === 1 && heaterLeftBtn) {
        heaterLeftBtn.classList.add('active');
    } else if (heaterMode === 2 && heaterRightBtn) {
        heaterRightBtn.classList.add('active');
    }
}

async function setHeaterMode(mode) {
    heaterMode = mode;
    updateHeaterButtons();
        try {
            var res = await window.electronAPI.setHeaterMode(heaterMode);
            if (!res || !res.success) {
                addToLog('Failed to set heater: ' + (res && res.error ? res.error : 'Unknown error'));
        } else {
            var modeText = mode === 0 ? 'Off' : (mode === 1 ? 'Left' : (mode === 2 ? 'Right' : 'Cooler'));
            addToLog('Heater set to: ' + modeText);
            }
        } catch (e) {
            addToLog('Error setting heater: ' + e.message);
        }
}

async function setCoolerMode(enabled) {
    try {
        var res = await window.electronAPI.sendCooler(enabled ? 1 : 0);
        if (!res || !res.success) {
            addToLog('Failed to set cooler: ' + (res && res.error ? res.error : 'Unknown error'));
        } else {
            addToLog('Cooler set to: ' + (enabled ? 'ON' : 'OFF'));
        }
    } catch (e) {
        addToLog('Error setting cooler: ' + e.message);
    }
}

if (heaterOffBtn) {
    heaterOffBtn.addEventListener('click', function() {
        setHeaterMode(0);
    });
}

if (heaterLeftBtn) {
    heaterLeftBtn.addEventListener('click', function() {
        setHeaterMode(1);
    });
}

if (heaterRightBtn) {
    heaterRightBtn.addEventListener('click', function() {
        setHeaterMode(2);
    });
}

if (coolerBtn) {
    coolerBtn.addEventListener('click', function() {
        // Toggle cooler on/off
        var isActive = coolerBtn.classList.contains('active');
        if (isActive) {
            // Turn off cooler
            coolerBtn.classList.remove('active');
            setCoolerMode(false);
        } else {
            // Turn on cooler
            coolerBtn.classList.add('active');
            setCoolerMode(true);
        }
    });
}

// Admin panel functionality
function openAdminPanel() {
    // Open admin panel in a new window
    const adminWindow = window.open('admin.html', 'adminPanel', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    
    if (adminWindow) {
        // Wait for admin window to load, then set up communication
        adminWindow.addEventListener('load', function() {
            setupAdminCommunication(adminWindow);
        });
        
        addToLog('Admin panel opened');
    } else {
        addToLog('Failed to open admin panel - popup blocked?');
    }
}

function openGraphWindow() {
    // Open graph in a new window with data sharing
    const graphWindow = window.open('chart.html', 'graphWindow', 'width=1000,height=700,scrollbars=yes,resizable=yes');
    
    if (graphWindow) {
        addToLog('Graph window opened');
        
        // Wait for the window to load, then share data
        graphWindow.addEventListener('load', function() {
            setupGraphCommunication(graphWindow);
        });
    } else {
        addToLog('Failed to open graph window - popup blocked?');
    }
}

function setupGraphCommunication(graphWindow) {
    // Make chartData available to the graph window
    if (graphWindow) {
        // Share the chart data object with current heater slider value
        var currentHeaterValue = heaterTempInput ? parseInt(heaterTempInput.value, 10) : 20;
        graphWindow.chartData = chartData;
        graphWindow.currentHeaterValue = currentHeaterValue;
        
        // Set up periodic data updates
        setInterval(function() {
            if (graphWindow && !graphWindow.closed) {
                graphWindow.chartData = chartData;
                // Update the current heater value from the slider
                var currentHeaterValue = heaterTempInput ? parseInt(heaterTempInput.value, 10) : 20;
                graphWindow.currentHeaterValue = currentHeaterValue;
            }
        }, 1000);
    }
}


function setupAdminCommunication(adminWindow) {
    // Send initial data to admin panel
    if (adminWindow.setConnectionStartTime) {
        adminWindow.setConnectionStartTime();
    }
    
    // Forward logs to admin panel
    const originalAddToLog = addToLog;
    addToLog = function(message, type = 'info') {
        originalAddToLog(message, type);
        
        // Also send to admin panel if it's open
        if (adminWindow && !adminWindow.closed && adminWindow.addAdminLog) {
            adminWindow.addAdminLog(message, type);
        }
    };
    
    // Forward raw data to admin panel
    const originalAddRawData = addRawData;
    addRawData = function(data) {
        originalAddRawData(data);
        
        // Also send to admin panel if it's open
        if (adminWindow && !adminWindow.closed && adminWindow.addRawDataEntry) {
            adminWindow.addRawDataEntry(data, 'hex');
        }
    };
}

window.addEventListener('beforeunload', function() {
	if (isConnected) {
		window.electronAPI.disconnectFromPort().catch(function(error) {
			console.log('Error during disconnect:', error);
		});
	}
});


