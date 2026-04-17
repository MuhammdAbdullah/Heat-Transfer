// --- Plotly graph state ---
var chartData = { time: [], series: Array.from({ length: 12 }, function () { return []; }), enabled: Array.from({ length: 12 }, function () { return true; }) };
window.sharedTemperatures = {
    t1: 0,
    t2: 0,
    t3: 0,
    t4: 0,
    t5: 0,
    t6: 0,
    t7: 0,
    t8: 0
};
var maxPoints = 50; // show last 50 points by default
var chartDisplayMode = 'limited'; // 'limited' or 'all' - controls whether to limit points or show all data
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

// --- Temperature vs Distance graph state ---
var distanceChartData = { samples: [] }; // Each sample is an array of 8 {x: distance, y: temperature} points in order T1-T8
var distanceChartJsRef = null;
var lastTemperatureValues = Array.from({ length: 8 }, function () { return null; }); // Store last T1-T8 values

function initChart() {
    // Initialize Chart.js chart if canvas exists
    var canvas = document.getElementById('testChart');
    if (canvas && window.Chart && !chartJsRef) {
        var ctx = canvas.getContext('2d');
        var themeColors = getChartThemeColors();
        canvas.style.background = themeColors.background;
        canvas.style.borderColor = themeColors.border;
        var colors = ['#ff4d4f', '#40a9ff', '#73d13d', '#fa8c16', '#b37feb', '#36cfc9', '#f759ab', '#9254de', '#faad14', '#1f7a8c', '#ff0000', '#ff007a'];
        var labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Radial Heater', 'Linear Heater', 'Power', 'Target Temp'];
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
                        grid: { color: themeColors.grid },
                        ticks: {
                            color: themeColors.text,
                            maxRotation: 0,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Temperature (°C)', color: themeColors.text },
                        grid: { color: themeColors.grid },
                        ticks: { color: themeColors.text }
                    },
                    y2: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false, color: themeColors.grid },
                        title: { display: true, text: 'Power (W)', color: themeColors.text },
                        ticks: { color: themeColors.text }
                    }
                },
                plugins: { legend: { position: 'right', labels: { color: themeColors.text } } }
            }
        });

        // Handle window resize for responsive chart
        window.addEventListener('resize', function () {
            if (chartJsRef) {
                chartJsRef.resize();
            }
            // Also resize distance chart if it exists
            if (distanceChartJsRef) {
                distanceChartJsRef.resize();
            }
            // Resize live chart if it exists
            if (window.liveChartRef) {
                window.liveChartRef.resize();
            }
        });
        updateChartTheme();
    }

    var chartDiv = document.getElementById('tempChart');
    if (!chartDiv) { return; }
    chartDivRef = chartDiv;

    // Define colors for each series (same as original)
    var colors = ['#ff4d4f', '#40a9ff', '#73d13d', '#fa8c16', '#b37feb', '#36cfc9', '#f759ab', '#9254de', '#faad14', '#1f7a8c', '#ff0000', '#ff007a'];
    var seriesNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Radial Heater', 'Linear Heater', 'Power', 'Target Temp'];

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
        chartDiv.addEventListener('click', function () {
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
        if (closeBtn) closeBtn.addEventListener('click', function () { overlay.className = 'overlay-hidden'; });
    }

    hoverInfoEl = document.getElementById('hoverInfo');
    var pauseEl = document.getElementById('pauseGraph');

    // Set up hover event
    chartDiv.on('plotly_hover', function (data) {
        if (hoverInfoEl && data.points.length > 0) {
            var point = data.points[0];
            var time = point.x;
            var value = point.y;
            var seriesName = point.data.name;
            hoverInfoEl.textContent = seriesName + ': ' + value.toFixed(2) + ' at ' + time.toFixed(1) + 's';
        }
    });

    chartDiv.on('plotly_unhover', function () {
        if (hoverInfoEl) hoverInfoEl.textContent = 'Hover for details…';
    });
}

function autoScaleChartJs(chart) {
    if (!chart || !chart.data || !chart.options || !chart.options.scales) return;
    var tempValues = [];
    var powerValues = [];
    var visibleTempDatasets = 0;
    var visiblePowerDatasets = 0;

    for (var i = 0; i < chart.data.datasets.length; i++) {
        var dataset = chart.data.datasets[i];
        try {
            var meta = chart.getDatasetMeta(i);
            if (!meta.hidden && !dataset.hidden) {
                var isPower = (dataset.yAxisID === 'y2' || dataset.label === 'Power');
                for (var j = 0; j < dataset.data.length; j++) {
                    var val = dataset.data[j];
                    if (val !== null && val !== undefined && !isNaN(val)) {
                        if (isPower) {
                            powerValues.push(val);
                            visiblePowerDatasets++;
                        } else {
                            tempValues.push(val);
                            visibleTempDatasets++;
                        }
                    }
                }
            }
        } catch (e) {
            // ignore if meta fails
        }
    }

    if (tempValues.length > 0 && visibleTempDatasets > 0 && chart.options.scales.y) {
        var tempMin = Math.min.apply(null, tempValues);
        var tempMax = Math.max.apply(null, tempValues);
        var tempRange = tempMax - tempMin;
        var tempPadding = Math.max(tempRange * 0.15, 5);
        var newTempMin = tempMin - tempPadding;
        var newTempMax = tempMax + tempPadding;

        // Round to multiples of 5
        newTempMin = Math.floor(newTempMin / 5) * 5;
        newTempMax = Math.ceil(newTempMax / 5) * 5;

        // Ensure minimum 20 degree range
        if (newTempMax - newTempMin < 20) {
            var diff = 20 - (newTempMax - newTempMin);
            // adjust equally if diff is multiple of 10, else roughly equal
            var expand = Math.ceil((diff / 2) / 5) * 5;
            newTempMin -= expand;
            newTempMax += expand;
            // readjust if over-expanded
            if (newTempMax - newTempMin > 20) {
                if (newTempMax - newTempMin >= 30) {
                    newTempMax -= 5;
                }
            }
        }

        chart.options.scales.y.min = newTempMin;
        chart.options.scales.y.max = newTempMax;

        // Calculate dynamic step size for Temperature
        var newTempRange = newTempMax - newTempMin;
        var tempStepSize = 5;
        if (newTempRange > 100) tempStepSize = 25;
        else if (newTempRange >= 50) tempStepSize = 10;
        else tempStepSize = 5;
        chart.options.scales.y.ticks.stepSize = tempStepSize;
    }

    var powerAxis = chart.options.scales.y2 ? 'y2' : (chart.options.scales.y1 ? 'y1' : null);
    if (powerValues.length > 0 && visiblePowerDatasets > 0 && powerAxis && chart.options.scales[powerAxis]) {
        var powerMin = Math.min.apply(null, powerValues);
        var powerMax = Math.max.apply(null, powerValues);
        var powerRange = powerMax - powerMin;
        var powerPadding = Math.max(powerRange * 0.15, 5);
        var newPowerMin = Math.max(powerMin - powerPadding, 0); // Power can't be negative
        var newPowerMax = powerMax + powerPadding;

        // Round to multiples of 5
        newPowerMin = Math.max(Math.floor(newPowerMin / 5) * 5, 0);
        newPowerMax = Math.ceil(newPowerMax / 5) * 5;

        // Ensure minimum 10 W range
        if (newPowerMax - newPowerMin < 10) {
            var diffP = 10 - (newPowerMax - newPowerMin);
            var expandP = Math.ceil((diffP / 2) / 5) * 5;
            newPowerMin = Math.max(newPowerMin - expandP, 0);
            newPowerMax += expandP;
            // readjust if over-expanded
            if (newPowerMax - newPowerMin > 10 && newPowerMin > 0) {
                if (newPowerMax - newPowerMin >= 15) {
                    newPowerMax -= 5;
                }
            } else if (newPowerMin === 0 && newPowerMax < 10) {
                newPowerMax = 10;
            }
        }

        chart.options.scales[powerAxis].min = newPowerMin;
        chart.options.scales[powerAxis].max = newPowerMax;

        // Calculate dynamic step size for Power
        var newPowerRange = newPowerMax - newPowerMin;
        var powerStepSize = 5;
        if (newPowerRange >= 50) powerStepSize = 10;
        else powerStepSize = 5;
        chart.options.scales[powerAxis].ticks.stepSize = powerStepSize;
    }
}

function addPoint(timeSec, valuesArray13) {
    chartData.time.push(timeSec);
    // Only add first 12 values to chart (T1-T8, Radial Heater, Linear Heater, Power, Target Temp)
    // Air Speed (index 12) is excluded from charts but kept in CSV
    for (var i = 0; i < 12; i++) {
        chartData.series[i].push(valuesArray13[i]);
    }
    // Store last temperature values for T1-T8 (indices 0-7)
    for (var i = 0; i < 8; i++) {
        var tempValue = valuesArray13[i];
        if (typeof tempValue === 'number' && isFinite(tempValue)) {
            lastTemperatureValues[i] = tempValue;
        }
    }
    // Share the latest temperatures for the STEP viewer
    window.sharedTemperatures.t1 = lastTemperatureValues[0] || 0;
    window.sharedTemperatures.t2 = lastTemperatureValues[1] || 0;
    window.sharedTemperatures.t3 = lastTemperatureValues[2] || 0;
    window.sharedTemperatures.t4 = lastTemperatureValues[3] || 0;
    window.sharedTemperatures.t5 = lastTemperatureValues[4] || 0;
    window.sharedTemperatures.t6 = lastTemperatureValues[5] || 0;
    window.sharedTemperatures.t7 = lastTemperatureValues[6] || 0;
    window.sharedTemperatures.t8 = lastTemperatureValues[7] || 0;
    // Only limit points if in 'limited' mode
    if (chartDisplayMode === 'limited' && chartData.time.length > maxPoints) {
        chartData.time.shift();
        for (var j = 0; j < 12; j++) chartData.series[j].shift();
    }

    // Automatically update distance chart in real-time
    updateDistanceChartRealTime();

    // If CSV saving is active, store this data point
    if (isSavingCsv) {
        var fanSpeed = fanSpeedInput ? parseInt(fanSpeedInput.value, 10) : 0;
        var dataRow = {
            time: timeSec,
            temps: valuesArray13.slice(0, 8), // T1-T8
            heaterL: valuesArray13[8],
            heaterR: valuesArray13[9],
            power: valuesArray13[10],
            target: valuesArray13[11],
            airSpeed: valuesArray13[12],
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
            // Air Speed (index 12) is excluded from charts
            for (var d = 0; d < 12; d++) {
                var v = (d < 10) ? valuesArray13[d] : (d === 10 ? valuesArray13[10] : valuesArray13[11]);
                lc.data.datasets[d].data.push(typeof v === 'number' && isFinite(v) ? v : null);
                // Only limit points if in 'limited' mode
                if (chartDisplayMode === 'limited' && lc.data.datasets[d].data.length > maxPoints) {
                    lc.data.datasets[d].data.shift();
                }
            }
            if (chartDisplayMode === 'limited' && lc.data.labels.length > maxPoints) {
                lc.data.labels.shift();
            }
            autoScaleChartJs(lc);
            lc.update('none');
        }
    } catch (e) { /* ignore */ }
    // Push into Chart.js if present
    try {
        if (chartJsRef) {
            chartJsRef.data.labels.push(timeSec.toFixed(1));
            // Only add first 12 values to chart (exclude air speed)
            for (var d = 0; d < 12; d++) {
                chartJsRef.data.datasets[d].data.push(valuesArray13[d]);
                // Only limit points if in 'limited' mode
                if (chartDisplayMode === 'limited' && chartJsRef.data.datasets[d].data.length > maxPoints) {
                    chartJsRef.data.datasets[d].data.shift();
                }
            }
            if (chartDisplayMode === 'limited' && chartJsRef.data.labels.length > maxPoints) {
                chartJsRef.data.labels.shift();
            }
            autoScaleChartJs(chartJsRef);
            chartJsRef.update('none');
        }
    } catch (e) { /* ignore */ }
    // Push directly into Plotly for smooth real-time drawing
    try {
        var PlotlyRef = window.Plotly;
        if (chartInitialized && PlotlyRef && chartDivRef) {
            var xArr = []; var yArr = []; var idx = [];
            // Only add first 12 values to Plotly chart (exclude air speed)
            for (var k = 0; k < 12; k++) {
                xArr.push([timeSec]);
                yArr.push([valuesArray13[k]]);
                idx.push(k);
            }
            // Use maxPoints only in limited mode, otherwise use a very large number (effectively no limit)
            var plotlyMaxPoints = chartDisplayMode === 'limited' ? maxPoints : 1000000;
            PlotlyRef.extendTraces(chartDivRef, { x: xArr, y: yArr }, idx, plotlyMaxPoints);
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
    var colors = ['#ff4d4f', '#40a9ff', '#73d13d', '#fa8c16', '#b37feb', '#36cfc9', '#f759ab', '#9254de', '#faad14', '#1f7a8c', '#ff0000', '#ff007a'];
    var seriesNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Radial Heater', 'Linear Heater', 'Power', 'Target Temp'];

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
        var span = Math.max(20, maxY - minY);
        var pad = span * 0.05;
        var center = (minY + maxY) / 2;
        yRange = [center - span / 2 - pad, center + span / 2 + pad];
    }
    if (isFinite(minY2) && isFinite(maxY2)) {
        var span2 = Math.max(10, maxY2 - minY2);
        var pad2 = span2 * 0.05;
        var center2 = (minY2 + maxY2) / 2;
        y2Range = [center2 - span2 / 2 - pad2, center2 + span2 / 2 + pad2];
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
            try { PlotlyRef.relayout(popDiv, { 'xaxis.autorange': true, 'yaxis.autorange': true, 'yaxis2.autorange': true }); } catch (e) { }
        }
    }

    // Initialize Temperature vs Distance chart
    initDistanceChart();
}

// Initialize Temperature vs Distance chart using Chart.js
function initDistanceChart() {
    var canvas = document.getElementById('tempDistanceChart');
    if (!canvas) return;
    if (!window.Chart) return;
    if (distanceChartJsRef) return; // Already initialized

    var ctx = canvas.getContext('2d');
    var themeColors = getChartThemeColors();
    canvas.style.background = themeColors.background;
    canvas.style.borderColor = themeColors.border;

    // Create a single dataset that will connect all points T1->T2->T3->...->T8
    var datasets = [{
        label: 'Temperature vs Distance',
        data: [],
        borderColor: '#40a9ff',
        backgroundColor: '#40a9ff',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.2,
        fill: false,
        showLine: true
    }];

    // Create Chart.js chart
    distanceChartJsRef = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            animation: false,
            resizeDelay: 0,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Distance',
                        color: themeColors.text,
                        font: {
                            size: 12,
                            weight: 'normal'
                        }
                    },
                    grid: {
                        color: themeColors.grid
                    },
                    ticks: {
                        color: themeColors.text,
                        font: {
                            size: 11,
                            weight: 'normal'
                        }
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)',
                        color: themeColors.text,
                        font: {
                            size: 12,
                            weight: 'normal'
                        }
                    },
                    grid: {
                        color: themeColors.grid
                    },
                    ticks: {
                        color: themeColors.text,
                        font: {
                            size: 11,
                            weight: 'normal'
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: themeColors.text,
                        font: {
                            size: 12,
                            weight: 'normal'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            var pointIndex = context[0].dataIndex;
                            var sensorIndex = pointIndex % 8;
                            return 'T' + (sensorIndex + 1);
                        },
                        label: function (context) {
                            return 'Distance: ' + context.parsed.x.toFixed(2) + ', Temperature: ' + context.parsed.y.toFixed(2) + '°C';
                        }
                    }
                }
            }
        }
    });

    // Handle window resize for distance chart (this is a duplicate, but kept for safety)
    // The main resize handler in initChart() will handle this
}

// Update distance chart in real-time (called automatically every second)
function updateDistanceChartRealTime() {
    // Get distance values from input boxes
    var distances = [];
    var allValid = true;

    for (var i = 1; i <= 8; i++) {
        var input = document.getElementById('distanceT' + i);
        if (input && input.value !== '') {
            var distance = parseFloat(input.value);
            if (!isNaN(distance)) {
                distances.push(distance);
            } else {
                allValid = false;
                return; // Skip if invalid distance
            }
        } else {
            allValid = false;
            return; // Skip if distance missing
        }
    }

    if (!allValid || distances.length !== 8) {
        return; // Skip if not all distances are valid
    }

    // Check if we have temperature values
    var hasTemps = false;
    for (var i = 0; i < 8; i++) {
        if (lastTemperatureValues[i] !== null) {
            hasTemps = true;
            break;
        }
    }

    if (!hasTemps) {
        return; // Skip if no temperature data
    }

    // Create a sample with all 8 points in order (T1->T2->T3->...->T8)
    // Skip points where distance is zero - connect directly to next valid point
    var sample = [];
    for (var i = 0; i < 8; i++) {
        if (lastTemperatureValues[i] !== null) {
            // Only add point if distance is not zero
            if (distances[i] !== 0) {
                sample.push({
                    x: distances[i],
                    y: lastTemperatureValues[i]
                });
            }
            // If distance is zero, skip this point (don't add it to sample)
        } else {
            return; // Skip if temperature missing
        }
    }

    // Clear previous data and set only the current sample (real-time, no history)
    distanceChartData.samples = [sample];

    // Make sure chart is initialized before redrawing
    if (!distanceChartJsRef) {
        initDistanceChart();
    }

    redrawDistanceChart();
}

// Redraw Temperature vs Distance chart using Chart.js
function redrawDistanceChart() {
    if (!distanceChartJsRef) {
        // Try to initialize if not already done
        initDistanceChart();
        if (!distanceChartJsRef) return;
    }

    // Build a single data array that connects all samples
    // Each sample is 8 points (T1->T2->T3->...->T8), and we connect them all
    var allDataPoints = [];

    for (var sampleIdx = 0; sampleIdx < distanceChartData.samples.length; sampleIdx++) {
        var sample = distanceChartData.samples[sampleIdx];
        // Add all 8 points from this sample in order
        for (var pointIdx = 0; pointIdx < sample.length; pointIdx++) {
            var point = sample[pointIdx];
            if (typeof point.x === 'number' && isFinite(point.x) && typeof point.y === 'number' && isFinite(point.y)) {
                allDataPoints.push({ x: point.x, y: point.y });
            }
        }
    }

    // Update the single dataset with all connected points
    if (distanceChartJsRef.data.datasets[0]) {
        distanceChartJsRef.data.datasets[0].data = allDataPoints;
    }

    // Update the chart
    distanceChartJsRef.update('none');
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
document.addEventListener('change', function (evt) {
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
const fanOffBtn = document.getElementById('fanOff');
const fan50Btn = document.getElementById('fan50');
const fan100Btn = document.getElementById('fan100');
var heaterMode = 0; // 0=off,1=left,2=right,3=cooler
var coolerEnabled = false; // Track cooler state: false=off, true=on
var simulationWindow = null; // Track simulation window reference
var curriculumWindow = null; // Track curriculum window reference
var graphWindow = null; // Track graph window reference
var heaterLeftTemp = 0; // Store left heater temperature
var heaterRightTemp = 0; // Store right heater temperature
var safetyCommandsSent = false; // Track if safety commands were sent after reconnection
var wasInUnsafeState = false; // Track if system was in unsafe state when disconnected

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
            getAvailablePorts: async function () { return []; },
            connectToPort: async function () { return { success: false, error: 'electronAPI unavailable' }; },
            disconnectFromPort: async function () { return { success: true }; },
            onDataReceived: function () { },
            onConnectionStatus: function () { },
            onPortsUpdate: function () { },
            removeAllListeners: function () { }
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
    try { if (webSerialReader) { await webSerialReader.cancel(); } } catch { }
    try { if (webSerialPort) { await webSerialPort.close(); } } catch { }
    webSerialReader = null; webSerialPort = null;
}

// Safety function: Set safe values when hardware goes offline
function setSafeValuesOffline() {
    addToLog('Hardware offline - Setting safe values...');

    // Check if system was in unsafe state (heater on or high fan speed)
    var currentFanSpeed = fanSpeedInput ? parseInt(fanSpeedInput.value, 10) : 0;
    var currentHeaterTemp = heaterTempInput ? parseInt(heaterTempInput.value, 10) : 20;

    wasInUnsafeState = (heaterMode !== 0 || currentFanSpeed > 30 || currentHeaterTemp > 30);

    if (wasInUnsafeState) {
        addToLog('System was in unsafe state - will send shutdown commands on reconnection');
    } else {
        addToLog('System was in safe state - no shutdown commands needed on reconnection');
    }

    // Reset safety commands flag for next reconnection
    safetyCommandsSent = false;

    // Set fan speed to 0
    if (fanSpeedInput) {
        fanSpeedInput.value = 0;
        if (fanSpeedDisplay) fanSpeedDisplay.value = '0';
        updateSliderFill(0);
        updateFanIcon(0);
    }

    // Set heater temperature to 20°C (safe room temperature)
    if (heaterTempInput) {
        heaterTempInput.value = 20;
        addToLog('Setting heater temp to 20°C (minimum safe temperature)');
        updateHeaterSliderFill(20);
        updateHeaterIcon(20);
        // Also update the display value
        var heaterTempValue = document.getElementById('heaterTempValue');
        if (heaterTempValue) heaterTempValue.value = '20';
        addToLog('Heater slider set to 20°C (minimum position)');
    }

    // Turn heater off (mode 0)
    heaterMode = 0;
    updateHeaterButtons();

    // Keep cooler off at startup
    coolerEnabled = false;
    if (coolerBtn) {
        coolerBtn.classList.remove('active');
        coolerBtn.textContent = 'Cooler Off';
    }

    addToLog('Safe values set: Fan=0%, Heater=20°C, Heater=OFF, Cooler=OFF');
}

// Safety function: Send shutdown commands when hardware reconnects (only if system was unsafe)
async function sendShutdownCommandsOnReconnect() {
    if (!isConnected || safetyCommandsSent) {
        if (safetyCommandsSent) {
            addToLog('Safety commands already sent, skipping...');
        }
        return;
    }

    // Only send shutdown commands if system was in unsafe state
    if (!wasInUnsafeState) {
        addToLog('System was in safe state - no shutdown commands needed');
        safetyCommandsSent = true; // Mark as sent so we don't try again
        return;
    }

    addToLog('Hardware reconnected - System was unsafe, sending shutdown commands...');
    safetyCommandsSent = true; // Set flag immediately to prevent multiple calls

    try {
        // Send fan stop command
        var fanResult = await window.electronAPI.sendFanSpeed(0);
        if (fanResult && fanResult.success) {
            addToLog('Fan stop command sent');
        }

        // Send cooler on command
        var coolerResult = await window.electronAPI.sendCooler(1);
        if (coolerResult && coolerResult.success) {
            addToLog('Cooler on command sent');
        }

        // Send heater temperature to 20°C
        var heaterTempResult = await window.electronAPI.sendHeaterTemp(20);
        if (heaterTempResult && heaterTempResult.success) {
            addToLog('Heater temp 20°C command sent');
        }

        // Send heater off command
        var heaterOffResult = await window.electronAPI.setHeaterMode(0);
        if (heaterOffResult && heaterOffResult.success) {
            addToLog('Heater off command sent');
        }

        addToLog('All safety shutdown commands sent successfully');

    } catch (error) {
        addToLog('Error sending shutdown commands: ' + error.message);
        safetyCommandsSent = false; // Reset flag if there was an error
    }
}

function updateConnectionStatus(connected, portInfo) {
    if (portInfo === undefined) {
        portInfo = '';
    }

    // Check if connection status actually changed
    var wasConnected = isConnected;
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

        // When hardware reconnects (was offline, now online), clear graphs and restart plotting
        if (!wasConnected && connected) {
            // Clear all graphs when device reconnects
            clearAllGraphs();
            addToLog('Device reconnected - graphs cleared, restarting data collection');

            // Send safety shutdown commands only when hardware actually reconnects (not on every packet)
            setTimeout(() => {
                sendShutdownCommandsOnReconnect();
            }, 1000); // Wait 1 second before sending safety commands
        }
    } else {
        if (connectionStatus) {
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.className = 'status-disconnected';
        }
        if (connectionInfoDisplay) connectionInfoDisplay.textContent = 'No device connected';
        if (connectBtn) connectBtn.disabled = true;
        if (disconnectBtn) disconnectBtn.disabled = true;

        // Set safe values only when hardware actually goes offline (not on every disconnection check)
        if (wasConnected && !connected) {
            setSafeValuesOffline();
        }
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
        if (previousSelection && ports.some(function (p) { return p.path === previousSelection; })) {
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
    var dataArray = (function (d) {
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

    // Debug: Log all incoming data to see what's being received
    if (dataArray.length > 0) {
        var hexString = dataArray.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        addToLog('DEBUG: All incoming data (length: ' + dataArray.length + '): ' + hexString);

        // Check if this looks like a 4-byte packet
        if (dataArray.length === 4) {
            addToLog('DEBUG: This is a 4-byte packet!');
            addToLog('DEBUG: First byte: 0x' + dataArray[0].toString(16).padStart(2, '0'));
            addToLog('DEBUG: Second byte: 0x' + dataArray[1].toString(16).padStart(2, '0'));
            addToLog('DEBUG: Third byte: 0x' + dataArray[2].toString(16).padStart(2, '0'));
            addToLog('DEBUG: Fourth byte: 0x' + dataArray[3].toString(16).padStart(2, '0'));

            if (dataArray[0] === 0x11 && dataArray[1] === 0x11 && dataArray[2] === 0x11) {
                addToLog('DEBUG: This matches the 11 11 11 pattern (fan speed)!');
            } else if (dataArray[0] === 0x22 && dataArray[1] === 0x22 && dataArray[2] === 0x22) {
                addToLog('DEBUG: This matches the 22 22 22 pattern (heater mode)!');
            } else if (dataArray[0] === 0x33 && dataArray[1] === 0x33 && dataArray[2] === 0x33) {
                addToLog('DEBUG: This matches the 33 33 33 pattern (heater temperature)!');
            } else if (dataArray[0] === 0x44 && dataArray[1] === 0x44 && dataArray[2] === 0x44) {
                addToLog('DEBUG: This matches the 44 44 44 pattern (cooler state)!');
            } else {
                addToLog('DEBUG: This does NOT match any known 4-byte pattern');
                addToLog('DEBUG: Looking for: 0x11 0x11 0x11 (fan) or 0x22 0x22 0x22 (heater mode) or 0x33 0x33 0x33 (heater temp) or 0x44 0x44 0x44 (cooler)');
            }
        } else {
            addToLog('DEBUG: Not a 4-byte packet, length is: ' + dataArray.length);
        }
    }

    // Check for fan speed data - format: [0x11, 0x11, 0x11, data] (exactly 4 bytes)
    if (dataArray.length === 4 && dataArray[0] === 0x11 && dataArray[1] === 0x11 && dataArray[2] === 0x11) {
        var fanSpeed = dataArray[3]; // Fan speed value (0-100)

        // Debug: Print the received data
        var hexString = dataArray.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        addToLog('DEBUG: Received 4-byte fan speed data: ' + hexString);
        addToLog('DEBUG: Fan speed value: ' + fanSpeed);

        // Validate fan speed range
        if (fanSpeed >= 0 && fanSpeed <= 100) {
            updateFanSliderFromHardware(fanSpeed);
            addToLog('Fan speed received from hardware: ' + fanSpeed + '%');
        } else {
            addToLog('Invalid fan speed value: ' + fanSpeed);
        }
        return; // Exit early since this is a 4-byte packet
    }

    // Check for heater mode data - format: [0x22, 0x22, 0x22, mode] (exactly 4 bytes)
    if (dataArray.length === 4 && dataArray[0] === 0x22 && dataArray[1] === 0x22 && dataArray[2] === 0x22) {
        var heaterMode = dataArray[3]; // Heater mode value (0=off, 1=left, 2=right)

        // Debug: Print the received data
        var hexString = dataArray.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        addToLog('DEBUG: Received 4-byte heater mode data: ' + hexString);
        addToLog('DEBUG: Heater mode value: ' + heaterMode);
        addToLog('DEBUG: About to call updateHeaterButtonsFromHardware with mode: ' + heaterMode);

        // Validate heater mode range
        if (heaterMode >= 0 && heaterMode <= 2) {
            addToLog('DEBUG: Heater mode is valid, calling updateHeaterButtonsFromHardware...');
            updateHeaterButtonsFromHardware(heaterMode);
            var modeText = heaterMode === 0 ? 'Off' : (heaterMode === 1 ? 'Left' : 'Right');
            addToLog('Heater mode received from hardware: ' + modeText);
        } else {
            addToLog('Invalid heater mode value: ' + heaterMode);
        }
        return; // Exit early since this is a 4-byte packet
    }

    // Check for heater temperature data - format: [0x33, 0x33, 0x33, temp] (exactly 4 bytes)
    if (dataArray.length === 4 && dataArray[0] === 0x33 && dataArray[1] === 0x33 && dataArray[2] === 0x33) {
        var heaterTemp = dataArray[3]; // Heater temperature value (20-70°C)

        // Debug: Print the received data
        var hexString = dataArray.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        addToLog('DEBUG: Received 4-byte heater temperature data: ' + hexString);
        addToLog('DEBUG: Heater temperature value: ' + heaterTemp);
        addToLog('DEBUG: About to call updateHeaterSliderFromHardware with temp: ' + heaterTemp);

        // Validate heater temperature range (20-70°C)
        if (heaterTemp >= 20 && heaterTemp <= 70) {
            addToLog('DEBUG: Heater temperature is valid, calling updateHeaterSliderFromHardware...');
            updateHeaterSliderFromHardware(heaterTemp);
            addToLog('Heater temperature received from hardware: ' + heaterTemp + '°C');
        } else {
            addToLog('Invalid heater temperature value: ' + heaterTemp + ' (expected 20-70)');
        }
        return; // Exit early since this is a 4-byte packet
    }

    // Check for cooler state data - format: [0x44, 0x44, 0x44, state] (exactly 4 bytes)
    if (dataArray.length === 4 && dataArray[0] === 0x44 && dataArray[1] === 0x44 && dataArray[2] === 0x44) {
        var coolerState = dataArray[3]; // Cooler state value (0=off, 1=on)

        // Debug: Print the received data
        var hexString = dataArray.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        addToLog('DEBUG: Received 4-byte cooler state data: ' + hexString);
        addToLog('DEBUG: Cooler state value: ' + coolerState);
        addToLog('DEBUG: About to call updateCoolerButtonFromHardware with state: ' + coolerState);

        // Validate cooler state range (0-1)
        if (coolerState === 0 || coolerState === 1) {
            addToLog('DEBUG: Cooler state is valid, calling updateCoolerButtonFromHardware...');
            updateCoolerButtonFromHardware(coolerState);
            var stateText = coolerState === 0 ? 'OFF' : 'ON';
            addToLog('Cooler state received from hardware: ' + stateText);
        } else {
            addToLog('Invalid cooler state value: ' + coolerState + ' (expected 0 or 1)');
        }
        return; // Exit early since this is a 4-byte packet
    }

    if (dataArray.length >= 56) {
        if (dataArray[0] === 0x55 && dataArray[1] === 0x55) {
            if (dataArray[54] === 0xAA && dataArray[55] === 0xAA) {
                // We are receiving valid frames; ensure UI shows ONLINE
                try { updateConnectionStatus(true); } catch (e) { }
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

// Function to update fan button states
function updateFanButtons(currentSpeed) {
    // Remove active class from all fan buttons
    if (fanOffBtn) {
        fanOffBtn.classList.remove('active');
    }
    if (fan50Btn) {
        fan50Btn.classList.remove('active');
    }
    if (fan100Btn) {
        fan100Btn.classList.remove('active');
    }

    // Add active class to the button matching current speed
    if (currentSpeed === 0 && fanOffBtn) {
        fanOffBtn.classList.add('active');
    } else if (currentSpeed === 50 && fan50Btn) {
        fan50Btn.classList.add('active');
    } else if (currentSpeed === 100 && fan100Btn) {
        fan100Btn.classList.add('active');
    }
}

// Function to update fan slider when receiving data from hardware
function updateFanSliderFromHardware(fanSpeed) {
    // Ensure fan speed is within valid range (0-100)
    fanSpeed = Math.max(0, Math.min(100, fanSpeed));

    addToLog('DEBUG: Updating fan slider to: ' + fanSpeed + '%');
    addToLog('DEBUG: fanSpeedInput element found: ' + (fanSpeedInput ? 'YES' : 'NO'));
    addToLog('DEBUG: fanSpeedDisplay element found: ' + (fanSpeedDisplay ? 'YES' : 'NO'));

    // Update the fan speed input slider
    if (fanSpeedInput) {
        fanSpeedInput.value = fanSpeed;
        addToLog('DEBUG: Set fanSpeedInput.value to: ' + fanSpeedInput.value);

        // Update the display text
        if (fanSpeedDisplay) {
            fanSpeedDisplay.value = fanSpeed;
            addToLog('DEBUG: Set fanSpeedDisplay.value to: ' + fanSpeedDisplay.value);
        }

        // Update the visual slider fill
        updateSliderFill(fanSpeed);
        addToLog('DEBUG: Called updateSliderFill with: ' + fanSpeed);

        // Update the fan icon animation
        updateFanIcon(fanSpeed);
        addToLog('DEBUG: Called updateFanIcon with: ' + fanSpeed);

        // Update button states
        updateFanButtons(fanSpeed);

        addToLog('Fan slider updated from hardware: ' + fanSpeed + '%');
    } else {
        addToLog('ERROR: fanSpeedInput element not found!');
    }
}

// Function to update heater buttons when receiving data from hardware
function updateHeaterButtonsFromHardware(mode) {
    addToLog('DEBUG: updateHeaterButtonsFromHardware called with mode: ' + mode);

    // Ensure heater mode is within valid range (0-2)
    mode = Math.max(0, Math.min(2, mode));

    addToLog('DEBUG: Updating heater buttons to mode: ' + mode);
    addToLog('DEBUG: heaterOffBtn element found: ' + (heaterOffBtn ? 'YES' : 'NO'));
    addToLog('DEBUG: heaterLeftBtn element found: ' + (heaterLeftBtn ? 'YES' : 'NO'));
    addToLog('DEBUG: heaterRightBtn element found: ' + (heaterRightBtn ? 'YES' : 'NO'));

    // Update the global heater mode variable
    addToLog('DEBUG: Setting heaterMode from ' + heaterMode + ' to ' + mode);
    heaterMode = mode;

    // Update the button states
    addToLog('DEBUG: Calling updateHeaterButtons()...');
    updateHeaterButtons();

    addToLog('DEBUG: updateHeaterButtons() completed');
    addToLog('Heater buttons updated from hardware: mode ' + mode);
}

// Function to update heater slider when receiving data from hardware
function updateHeaterSliderFromHardware(temperature) {
    // Ensure heater temperature is within valid range (20-70°C)
    temperature = Math.max(20, Math.min(70, temperature));

    addToLog('DEBUG: Updating heater slider to: ' + temperature + '°C');
    addToLog('DEBUG: heaterTempInput element found: ' + (heaterTempInput ? 'YES' : 'NO'));
    addToLog('DEBUG: heaterTempValue element found: ' + (heaterTempValue ? 'YES' : 'NO'));

    // Update the heater temperature input slider
    if (heaterTempInput) {
        heaterTempInput.value = temperature;
        addToLog('DEBUG: Set heaterTempInput.value to: ' + heaterTempInput.value);

        // Update the display text
        if (heaterTempValue) {
            heaterTempValue.value = temperature;
            addToLog('DEBUG: Set heaterTempValue.value to: ' + heaterTempValue.value);
        }

        // Update the visual slider fill
        updateHeaterSliderFill(temperature);
        addToLog('DEBUG: Called updateHeaterSliderFill with: ' + temperature);

        // Update the heater icon position
        updateHeaterIcon(temperature);
        addToLog('DEBUG: Called updateHeaterIcon with: ' + temperature);

        addToLog('Heater slider updated from hardware: ' + temperature + '°C');
    } else {
        addToLog('ERROR: heaterTempInput element not found!');
    }
}

// Function to update cooler button when receiving data from hardware
function updateCoolerButtonFromHardware(state) {
    // Ensure cooler state is valid (0 or 1)
    state = state === 1 ? 1 : 0;

    // Update global state
    coolerEnabled = state === 1;

    addToLog('DEBUG: Updating cooler button to state: ' + (state ? 'ON' : 'OFF'));
    addToLog('DEBUG: coolerBtn element found: ' + (coolerBtn ? 'YES' : 'NO'));

    // Update the cooler button state
    if (coolerBtn) {
        if (state === 1) {
            // Cooler is ON
            coolerBtn.classList.add('active');
            coolerBtn.textContent = 'Cooler On';
            addToLog('DEBUG: Added active class to coolerBtn (ON)');
        } else {
            // Cooler is OFF
            coolerBtn.classList.remove('active');
            coolerBtn.textContent = 'Cooler Off';
            addToLog('DEBUG: Removed active class from coolerBtn (OFF)');
        }

        addToLog('Cooler button updated from hardware: ' + (state ? 'ON' : 'OFF'));
    } else {
        addToLog('ERROR: coolerBtn element not found!');
    }
}

// Test function to manually test heater button updates
function testHeaterButtons() {
    addToLog('TEST: Testing heater button updates...');

    // Test mode 0 (off)
    addToLog('TEST: Setting heater mode to 0 (off)');
    updateHeaterButtonsFromHardware(0);

    setTimeout(() => {
        addToLog('TEST: Setting heater mode to 1 (left)');
        updateHeaterButtonsFromHardware(1);
    }, 1000);

    setTimeout(() => {
        addToLog('TEST: Setting heater mode to 2 (right)');
        updateHeaterButtonsFromHardware(2);
    }, 2000);

    setTimeout(() => {
        addToLog('TEST: Setting heater mode to 0 (off) again');
        updateHeaterButtonsFromHardware(0);
    }, 3000);
}

// Test function to simulate 4-byte heater mode data
function testHeaterModeData() {
    addToLog('TEST: Simulating 4-byte heater mode data...');

    // Simulate [0x22, 0x22, 0x22, 1] for left heater
    var testData = [0x22, 0x22, 0x22, 1];
    addToLog('TEST: Sending test data: ' + testData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    handleIncomingData(testData);

    setTimeout(() => {
        // Simulate [0x22, 0x22, 0x22, 2] for right heater
        var testData2 = [0x22, 0x22, 0x22, 2];
        addToLog('TEST: Sending test data: ' + testData2.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        handleIncomingData(testData2);
    }, 2000);

    setTimeout(() => {
        // Simulate [0x22, 0x22, 0x22, 0] for off
        var testData3 = [0x22, 0x22, 0x22, 0];
        addToLog('TEST: Sending test data: ' + testData3.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        handleIncomingData(testData3);
    }, 4000);
}

// Test function to simulate 4-byte heater temperature data
function testHeaterTempData() {
    addToLog('TEST: Simulating 4-byte heater temperature data...');

    // Simulate [0x33, 0x33, 0x33, 30] for 30°C
    var testData = [0x33, 0x33, 0x33, 30];
    addToLog('TEST: Sending test data: ' + testData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    handleIncomingData(testData);

    setTimeout(() => {
        // Simulate [0x33, 0x33, 0x33, 50] for 50°C
        var testData2 = [0x33, 0x33, 0x33, 50];
        addToLog('TEST: Sending test data: ' + testData2.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        handleIncomingData(testData2);
    }, 2000);

    setTimeout(() => {
        // Simulate [0x33, 0x33, 0x33, 25] for 25°C
        var testData3 = [0x33, 0x33, 0x33, 25];
        addToLog('TEST: Sending test data: ' + testData3.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        handleIncomingData(testData3);
    }, 4000);
}

// Test function to simulate 4-byte cooler state data
function testCoolerStateData() {
    addToLog('TEST: Simulating 4-byte cooler state data...');

    // Simulate [0x44, 0x44, 0x44, 1] for cooler ON
    var testData = [0x44, 0x44, 0x44, 1];
    addToLog('TEST: Sending test data: ' + testData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    handleIncomingData(testData);

    setTimeout(() => {
        // Simulate [0x44, 0x44, 0x44, 0] for cooler OFF
        var testData2 = [0x44, 0x44, 0x44, 0];
        addToLog('TEST: Sending test data: ' + testData2.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        handleIncomingData(testData2);
    }, 2000);

    setTimeout(() => {
        // Simulate [0x44, 0x44, 0x44, 1] for cooler ON again
        var testData3 = [0x44, 0x44, 0x44, 1];
        addToLog('TEST: Sending test data: ' + testData3.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        handleIncomingData(testData3);
    }, 4000);
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

// Helper function to convert RGB to hex color
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (x) {
        var hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Function to get color for temperature: Blue at 1.0°C, Red at 75°C
function getTemperatureColor(temp) {
    // Clamp temperature between 1.0 and 75.0
    var clampedTemp = Math.max(1.0, Math.min(75.0, temp));
    // Calculate ratio from 0 (1.0°C) to 1 (75°C)
    var ratio = (clampedTemp - 1.0) / (75.0 - 1.0);
    // Blue: RGB(0, 0, 255), Red: RGB(255, 0, 0)
    var red = Math.round(ratio * 255);
    var green = 0;
    var blue = Math.round((1.0 - ratio) * 255);
    return rgbToHex(red, green, blue);
}

// Function to get color for power: Green at 0W, Red at 36W
function getPowerColor(power) {
    // Clamp power between 0 and 36
    var clampedPower = Math.max(0, Math.min(36, power));
    // Calculate ratio from 0 (0W) to 1 (36W)
    var ratio = clampedPower / 36.0;
    // Green: RGB(0, 255, 0), Red: RGB(255, 0, 0)
    var red = Math.round(ratio * 255);
    var green = Math.round((1.0 - ratio) * 255);
    var blue = 0;
    return rgbToHex(red, green, blue);
}

// Function to get color for wind speed: Green at 0 m/s, Red at 2.1 m/s
function getWindSpeedColor(speed) {
    // Clamp speed between 0 and 2.1
    var clampedSpeed = Math.max(0, Math.min(2.1, speed));
    // Calculate ratio from 0 (0 m/s) to 1 (2.1 m/s)
    var ratio = clampedSpeed / 2.1;
    // Green: RGB(0, 255, 0), Red: RGB(255, 0, 0)
    var red = Math.round(ratio * 255);
    var green = Math.round((1.0 - ratio) * 255);
    var blue = 0;
    return rgbToHex(red, green, blue);
}

// Function to validate temperature: if > 200 or < -10, return 0.00
function validateTemperature(temp) {
    if (temp > 200 || temp < -10) {
        return 0.00;
    }
    return temp;
}

function parseAndDisplayData(dataArray) {
    var parsedInfo = '';
    var actualData = dataArray.slice(2, 54);
    console.log('Full data array length:', dataArray.length);
    console.log('Actual data length:', actualData.length);
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
            // Validate temperature: if > 200 or < -10, set to 0.00
            var validatedTemp = validateTemperature(temp);
            // Map Sensor8->T1, Sensor7->T2, ..., Sensor1->T8
            var labelIndex = 8 - sensorIndex; // Sensor8..1
            var tileId = 't' + (9 - labelIndex); // t1..t8
            var tileEl = document.getElementById(tileId);
            if (tileEl) {
                tileEl.textContent = 'T' + (9 - labelIndex) + ': ' + validatedTemp.toFixed(2) + '\u00B0C';
                // Keep text white, add border glow: Blue at 1.0°C, Red at 75°C
                var color = getTemperatureColor(validatedTemp);
                tileEl.style.color = '#ffffff';
                tileEl.style.boxShadow = '0 0 10px ' + color + ', 0 0 20px ' + color;
            }
            parsedInfo += 'Sensor ' + (sensorIndex + 1) + ': ' + validatedTemp.toFixed(2) + '\u00B0C\n';
        }

        // Display heater temperatures in tiles (bytes 36-43)
        if (actualData.length >= 44) {
            console.log('Parsing heater data, actualData length:', actualData.length);
            // Radial Heater (bytes 36-39)
            var hb0 = actualData[36], hb1 = actualData[37], hb2 = actualData[38], hb3 = actualData[39];
            var hbuf1 = new ArrayBuffer(4);
            var hdv1 = new DataView(hbuf1);
            hdv1.setUint8(0, hb0); hdv1.setUint8(1, hb1); hdv1.setUint8(2, hb2); hdv1.setUint8(3, hb3);
            var rawHeaterLeftTemp = hdv1.getFloat32(0, true);
            // Validate temperature: if > 200 or < -10, set to 0.00
            heaterLeftTemp = validateTemperature(rawHeaterLeftTemp);
            console.log('Radial Heater temp:', heaterLeftTemp);
            var heaterRightEl = document.getElementById('heaterRightTile');
            console.log('Radial Heater element found:', !!heaterRightEl);
            if (heaterRightEl) {
                heaterRightEl.textContent = 'Radial Heater: ' + heaterLeftTemp.toFixed(2) + '°C';
                // Keep text white, add border glow: Blue at 1.0°C, Red at 75°C
                var color = getTemperatureColor(heaterLeftTemp);
                heaterRightEl.style.color = '#ffffff';
                heaterRightEl.style.boxShadow = '0 0 10px ' + color + ', 0 0 20px ' + color;
                console.log('Updated radial heater tile:', heaterRightEl.textContent);
            }

            // Linear Heater (bytes 40-43)
            var hb4 = actualData[40], hb5 = actualData[41], hb6 = actualData[42], hb7 = actualData[43];
            var hbuf2 = new ArrayBuffer(4);
            var hdv2 = new DataView(hbuf2);
            hdv2.setUint8(0, hb4); hdv2.setUint8(1, hb5); hdv2.setUint8(2, hb6); hdv2.setUint8(3, hb7);
            var rawHeaterRightTemp = hdv2.getFloat32(0, true);
            // Validate temperature: if > 200 or < -10, set to 0.00
            heaterRightTemp = validateTemperature(rawHeaterRightTemp);
            console.log('Linear Heater temp:', heaterRightTemp);
            var heaterLeftEl = document.getElementById('heaterLeftTile');
            console.log('Linear Heater element found:', !!heaterLeftEl);
            if (heaterLeftEl) {
                heaterLeftEl.textContent = 'Linear Heater: ' + heaterRightTemp.toFixed(2) + '°C';
                // Keep text white, add border glow: Blue at 1.0°C, Red at 75°C
                var color = getTemperatureColor(heaterRightTemp);
                heaterLeftEl.style.color = '#ffffff';
                heaterLeftEl.style.boxShadow = '0 0 10px ' + color + ', 0 0 20px ' + color;
                console.log('Updated linear heater tile:', heaterLeftEl.textContent);
            }

            // Update button text with temperatures
            updateHeaterButtons();
        } else {
            console.log('Not enough data for heaters, length:', actualData.length);
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
                var rawTemp = adv.getFloat32(0, true);
                // Validate temperature before adding to chart
                var validatedTemp = validateTemperature(rawTemp);
                tempsForChart.push(validatedTemp);
            }
            // Heaters if available
            if (actualData.length >= 44) {
                var hb0 = actualData[36], hb1 = actualData[37], hb2 = actualData[38], hb3 = actualData[39];
                var hb4 = actualData[40], hb5 = actualData[41], hb6 = actualData[42], hb7 = actualData[43];
                var hbuf1 = new ArrayBuffer(4), hbuf2 = new ArrayBuffer(4);
                var hdv1 = new DataView(hbuf1), hdv2 = new DataView(hbuf2);
                hdv1.setUint8(0, hb0); hdv1.setUint8(1, hb1); hdv1.setUint8(2, hb2); hdv1.setUint8(3, hb3);
                hdv2.setUint8(0, hb4); hdv2.setUint8(1, hb5); hdv2.setUint8(2, hb6); hdv2.setUint8(3, hb7);
                var rawHeaterLeft = hdv1.getFloat32(0, true);
                var rawHeaterRight = hdv2.getFloat32(0, true);
                // Validate heater temperatures before adding to chart
                tempsForChart.push(validateTemperature(rawHeaterLeft));
                tempsForChart.push(validateTemperature(rawHeaterRight));
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
            // Air Speed if available (bytes 50-53, actualData[48-51])
            if (actualData.length >= 52) {
                var a0 = actualData[48], a1 = actualData[49], a2 = actualData[50], a3 = actualData[51];
                var abuf2 = new ArrayBuffer(4);
                var adv2 = new DataView(abuf2);
                adv2.setUint8(0, a0); adv2.setUint8(1, a1); adv2.setUint8(2, a2); adv2.setUint8(3, a3);
                tempsForChart.push(adv2.getFloat32(0, true)); // series index 12
            } else {
                tempsForChart.push(NaN);
            }
            if (typeof addPoint === 'function') {
                addPoint(timeFloat, tempsForChart);
            }
        }

        // Bytes 38..45 (actualData[36..43]): two more temperature sensors as float32
        // Note: This section is redundant - heaters are already handled above, but keeping for compatibility
        if (actualData.length >= 44) {
            console.log('Parsing heater sensor data, data length: ' + actualData.length);
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
                var rawEtemp = edv.getFloat32(0, true);
                // Validate temperature: if > 200 or < -10, set to 0.00
                var etemp = validateTemperature(rawEtemp);
                parsedInfo += 'Sensor ' + (9 + extraIndex) + ': ' + etemp.toFixed(2) + '\u00B0C\n';
                console.log('Heater sensor ' + extraIndex + ' temperature: ' + etemp.toFixed(2) + '°C');
                // Heater elements are now handled in the main parsing section

                // Store heater temperatures for display (already validated above, but update here too)
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
            parsedInfo += 'Power: ' + power.toFixed(2) + ' W\n';
            var powerEl = document.getElementById('powerTile');
            if (powerEl) {
                powerEl.textContent = 'Power: ' + power.toFixed(2) + ' W';
                // Keep text white, add border glow: Green at 0W, Red at 36W
                var color = getPowerColor(power);
                powerEl.style.color = '#ffffff';
                powerEl.style.boxShadow = '0 0 10px ' + color + ', 0 0 20px ' + color;
            }
        }

        // Bytes 50..53 (actualData[48..51]): Air Speed as float32
        if (actualData.length >= 52) {
            var a0 = actualData[48], a1 = actualData[49], a2 = actualData[50], a3 = actualData[51];
            var abuf = new ArrayBuffer(4);
            var adv = new DataView(abuf);
            adv.setUint8(0, a0); adv.setUint8(1, a1); adv.setUint8(2, a2); adv.setUint8(3, a3);
            var airSpeed = adv.getFloat32(0, true);
            parsedInfo += 'Air Speed: ' + airSpeed.toFixed(2) + ' m/s\n';
            var airSpeedEl = document.getElementById('airSpeedTile');
            if (airSpeedEl) {
                airSpeedEl.textContent = 'Air Speed: ' + airSpeed.toFixed(2) + ' m/s';
                // Keep text white, add border glow: Green at 0 m/s, Red at 2.1 m/s
                var color = getWindSpeedColor(airSpeed);
                airSpeedEl.style.color = '#ffffff';
                airSpeedEl.style.boxShadow = '0 0 10px ' + color + ', 0 0 20px ' + color;
            }
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
    var csvContent = 'Time(s),T1,T2,T3,T4,T5,T6,T7,T8,HeaterL,HeaterR,Power,Target,AirSpeed,FanSpeed\n';

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
        row += (typeof data.power === 'number' && isFinite(data.power) ? data.power.toFixed(2) : '') + ',';

        // Add target
        row += (typeof data.target === 'number' && isFinite(data.target) ? data.target.toFixed(1) : '') + ',';

        // Add air speed
        row += (typeof data.airSpeed === 'number' && isFinite(data.airSpeed) ? data.airSpeed.toFixed(2) : '') + ',';

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

function getChartThemeColors() {
    return {
        background: '#1a1a1a',
        border: '#444444',
        grid: '#444444',
        text: '#eeeeee'
    };
}

function applyTheme(themeKey) {
    var body = document.body;
    body.classList.remove('theme-light');
    body.classList.remove('theme-dark');
    body.classList.add('theme-dark');
    updateChartTheme();
}

function applyLayout(layoutKey) {
    // Keep standard layout only; remove other layout classes if present
    var body = document.body;
    body.classList.remove('layout-compact');
    body.classList.remove('layout-stacked');
    body.classList.add('layout-standard');
}

function updateChartTheme() {
    var colors = getChartThemeColors();
    var canvas = document.getElementById('testChart');
    if (canvas) {
        canvas.style.background = colors.background;
        canvas.style.borderColor = colors.border;
    }
    if (chartJsRef) {
        try {
            if (chartJsRef.data && chartJsRef.data.datasets && chartJsRef.data.datasets.length > 10) {
                // Power line is always pure red for visibility
                chartJsRef.data.datasets[10].borderColor = '#ff0000';
                chartJsRef.data.datasets[10].backgroundColor = '#ff0000';
            }
            chartJsRef.options.scales.x.grid.color = colors.grid;
            chartJsRef.options.scales.x.ticks.color = colors.text;
            chartJsRef.options.scales.y.grid.color = colors.grid;
            chartJsRef.options.scales.y.ticks.color = colors.text;
            chartJsRef.options.scales.y.title.color = colors.text;
            chartJsRef.options.scales.y2.grid.color = colors.grid;
            chartJsRef.options.scales.y2.ticks.color = colors.text;
            chartJsRef.options.scales.y2.title.color = colors.text;
            if (chartJsRef.options.plugins && chartJsRef.options.plugins.legend && chartJsRef.options.plugins.legend.labels) {
                chartJsRef.options.plugins.legend.labels.color = colors.text;
            }
            chartJsRef.update('none');
        } catch (e) { /* ignore */ }
    }
    if (window.liveChartRef) {
        try {
            var liveChart = window.liveChartRef;
            if (liveChart.data && liveChart.data.datasets && liveChart.data.datasets.length > 10) {
                // Power line is always pure red for visibility
                liveChart.data.datasets[10].borderColor = '#ff0000';
                liveChart.data.datasets[10].backgroundColor = '#ff0000';
            }
            liveChart.options.scales.x.grid.color = colors.grid;
            liveChart.options.scales.x.ticks.color = colors.text;
            liveChart.options.scales.y.grid.color = colors.grid;
            liveChart.options.scales.y.ticks.color = colors.text;
            liveChart.options.scales.y.title.color = colors.text;
            liveChart.options.scales.y2.grid.color = colors.grid;
            liveChart.options.scales.y2.ticks.color = colors.text;
            liveChart.options.scales.y2.title.color = colors.text;
            if (liveChart.options.plugins && liveChart.options.plugins.legend && liveChart.options.plugins.legend.labels) {
                liveChart.options.plugins.legend.labels.color = colors.text;
            }
            liveChart.update('none');
        } catch (e) { /* ignore */ }
    }
    // Update distance chart theme
    if (distanceChartJsRef) {
        try {
            var distanceCanvas = document.getElementById('tempDistanceChart');
            if (distanceCanvas) {
                distanceCanvas.style.background = colors.background;
                distanceCanvas.style.borderColor = colors.border;
            }
            distanceChartJsRef.options.scales.x.grid.color = colors.grid;
            distanceChartJsRef.options.scales.x.ticks.color = colors.text;
            distanceChartJsRef.options.scales.x.title.color = colors.text;
            distanceChartJsRef.options.scales.y.grid.color = colors.grid;
            distanceChartJsRef.options.scales.y.ticks.color = colors.text;
            distanceChartJsRef.options.scales.y.title.color = colors.text;
            if (distanceChartJsRef.options.plugins && distanceChartJsRef.options.plugins.legend && distanceChartJsRef.options.plugins.legend.labels) {
                distanceChartJsRef.options.plugins.legend.labels.color = colors.text;
            }
            // Maintain font sizes during resize
            if (distanceChartJsRef.options.scales.x.title.font) {
                distanceChartJsRef.options.scales.x.title.font.size = 12;
            }
            if (distanceChartJsRef.options.scales.x.ticks.font) {
                distanceChartJsRef.options.scales.x.ticks.font.size = 11;
            }
            if (distanceChartJsRef.options.scales.y.title.font) {
                distanceChartJsRef.options.scales.y.title.font.size = 12;
            }
            if (distanceChartJsRef.options.scales.y.ticks.font) {
                distanceChartJsRef.options.scales.y.ticks.font.size = 11;
            }
            if (distanceChartJsRef.options.plugins && distanceChartJsRef.options.plugins.legend && distanceChartJsRef.options.plugins.legend.labels && distanceChartJsRef.options.plugins.legend.labels.font) {
                distanceChartJsRef.options.plugins.legend.labels.font.size = 12;
            }
            distanceChartJsRef.update('none');
        } catch (e) { /* ignore */ }
    }
}
function setupDataListeners() {
    window.electronAPI.onDataReceived(function (event, data) {
        handleIncomingData(data);
    });
    // Also display raw incoming chunks for debugging when framing fails
    if (window.electronAPI.onDataChunk) {
        window.electronAPI.onDataChunk(function (event, chunk) {
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
    window.electronAPI.onConnectionStatus(function (event, status) {
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

document.addEventListener('DOMContentLoaded', function () {
    // Check if electronAPI is available and create fallback if needed
    var apiAvailable = ensureElectronAPI();

    addToLog('Heat Transfer Data Reader started');

    // Initialize heater buttons with temperature display
    updateHeaterButtons();

    if (!apiAvailable) {
        addToLog('Warning: electronAPI bridge not found. Running in limited mode.');
        addToLog('Make sure preload.js is loading correctly.');
    }

    addToLog('Click "Refresh Ports" to see available COM ports');
    // Initialize charts (Chart.js)
    initChart();

    // Initialize distance chart - wait for Chart.js to be available
    function tryInitDistanceChart(attempts) {
        if (window.Chart) {
            initDistanceChart();
        } else if (attempts < 20) {
            // Try again after 100ms if Chart.js isn't loaded yet
            setTimeout(function () {
                tryInitDistanceChart(attempts + 1);
            }, 100);
        }
    }
    tryInitDistanceChart(0);

    setupDataListeners();

    // Setup clear/save controls
    var clearDataBtn = document.getElementById('clearDataBtn');
    var startCsvBtn = document.getElementById('startCsvBtn');
    var stopCsvBtn = document.getElementById('stopCsvBtn');
    var captureDistanceBtn = document.getElementById('captureDistanceBtn');



    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function () {
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

    // Handle chart display mode dropdown
    var chartDisplayModeSelect = document.getElementById('chartDisplayMode');
    if (chartDisplayModeSelect) {
        chartDisplayModeSelect.addEventListener('change', function () {
            var newMode = this.value;
            if (newMode !== chartDisplayMode) {
                chartDisplayMode = newMode;
                addToLog('Chart display mode changed to: ' + (newMode === 'limited' ? 'Last 50 Points' : 'All Data Points'));

                // Clear all chart data when switching modes (start fresh)
                chartData.time = [];
                for (var i = 0; i < 12; i++) {
                    chartData.series[i] = [];
                }

                // Clear Chart.js charts
                if (window.liveChartRef) {
                    window.liveChartRef.data.labels = [];
                    for (var j = 0; j < window.liveChartRef.data.datasets.length; j++) {
                        window.liveChartRef.data.datasets[j].data = [];
                    }
                    window.liveChartRef.update('none');
                }

                if (chartJsRef) {
                    chartJsRef.data.labels = [];
                    for (var j = 0; j < chartJsRef.data.datasets.length; j++) {
                        chartJsRef.data.datasets[j].data = [];
                    }
                    chartJsRef.update('none');
                }

                // Clear Plotly chart
                if (chartInitialized && window.Plotly && chartDivRef) {
                    try {
                        window.Plotly.newPlot(chartDivRef, [], plotlyLayout, plotlyConfig);
                    } catch (e) { /* ignore */ }
                }

                addToLog('Chart cleared - new data will be displayed in ' + (newMode === 'limited' ? 'limited' : 'all data') + ' mode');
            }
        });
    }


    if (startCsvBtn) {
        startCsvBtn.addEventListener('click', function () {
            startCsvSaving();
        });
    }

    if (stopCsvBtn) {
        stopCsvBtn.addEventListener('click', function () {
            stopCsvSaving();
        });
    }

    // Function to resize distance input boxes based on content
    function resizeDistanceInput(input) {
        if (!input) return;

        // Get the current value or use placeholder
        var textToMeasure = input.value || input.placeholder || '0';
        if (!textToMeasure) textToMeasure = '0';

        var computedStyle = window.getComputedStyle(input);
        var fontSize = parseFloat(computedStyle.fontSize) || 16;

        // Use canvas for accurate text measurement
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');

        // Build font string: weight size family
        var fontFamily = computedStyle.fontFamily || 'Arial';
        var fontWeight = computedStyle.fontWeight || 'normal';
        var fontString = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
        context.font = fontString;

        // Measure text width
        var textWidth = context.measureText(textToMeasure).width;

        // Get padding and border values
        var paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        var paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        var borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        var borderRight = parseFloat(computedStyle.borderRightWidth) || 0;

        // Calculate total width needed
        // With box-sizing: border-box, width includes padding and border
        var totalWidth = textWidth + paddingLeft + paddingRight + borderLeft + borderRight;

        // Add generous buffer (at least 30px or 2 character widths)
        var charWidth = textWidth / Math.max(textToMeasure.length, 1);
        var buffer = Math.max(charWidth * 2.5, 30);
        totalWidth += buffer;

        // Set min and max constraints
        var rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
        var minWidth = 4 * rootFontSize; // 4rem minimum
        var maxWidth = 40 * rootFontSize; // 40rem maximum (very large for long numbers like 10000)
        totalWidth = Math.max(minWidth, Math.min(maxWidth, totalWidth));

        // Set the width
        input.style.width = totalWidth + 'px';

        // Force a reflow to ensure the width is applied
        input.offsetHeight;
    }

    // Apply resize function to all distance inputs
    for (var i = 1; i <= 8; i++) {
        (function (index) {
            var distanceInput = document.getElementById('distanceT' + index);
            if (distanceInput) {
                // Resize function wrapper
                var resizeHandler = function () {
                    resizeDistanceInput(distanceInput);
                };

                // Resize on input change (as user types) - use requestAnimationFrame for better performance
                distanceInput.addEventListener('input', function () {
                    requestAnimationFrame(resizeHandler);
                });

                // Resize on change (when user finishes editing)
                distanceInput.addEventListener('change', resizeHandler);

                // Resize on focus (in case value was changed programmatically)
                distanceInput.addEventListener('focus', resizeHandler);

                // Resize on blur (when user clicks away)
                distanceInput.addEventListener('blur', resizeHandler);

                // Initial resize after a short delay to ensure DOM is ready
                setTimeout(function () {
                    resizeDistanceInput(distanceInput);
                }, 200);
            }
        })(i);
    }

    // Initialize Chart.js test chart for live data (10 temps + power + target)
    try {
        var testCanvas = document.getElementById('testChart');
        if (testCanvas && window.Chart) {
            var ctx = testCanvas.getContext('2d');
            var themeColors = getChartThemeColors();
            testCanvas.style.background = themeColors.background;
            testCanvas.style.borderColor = themeColors.border;
            var colors = ['#ff4d4f', '#40a9ff', '#73d13d', '#fa8c16', '#b37feb', '#36cfc9', '#f759ab', '#9254de', '#faad14', '#1f7a8c', '#ff0000', '#ff007a'];
            var labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Radial Heater', 'Linear Heater', 'Power', 'Target'];
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
                    plugins: { legend: { position: 'right', labels: { color: themeColors.text } } },
                    scales: {
                        x: {
                            grid: { color: themeColors.grid },
                            ticks: {
                                color: themeColors.text,
                                maxRotation: 0,
                                maxTicksLimit: 10
                            }
                        },
                        y: {
                            type: 'linear',
                            position: 'left',
                            title: { display: true, text: 'Temperature (°C)', color: themeColors.text },
                            grid: { color: themeColors.grid },
                            ticks: { color: themeColors.text }
                        },
                        y2: {
                            type: 'linear',
                            position: 'right',
                            grid: { drawOnChartArea: false, color: themeColors.grid },
                            title: { display: true, text: 'Power (W)', color: themeColors.text },
                            ticks: { color: themeColors.text }
                        }
                    }
                }
            });
        }
    } catch (e) { /* ignore */ }
    updateChartTheme();
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
        adminBtn.addEventListener('click', function () {
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
        openGraphBtn.addEventListener('click', function () {
            // Check if window is already open
            if (graphWindow && !graphWindow.closed) {
                // Window is open - close it first
                graphWindow.close();
                graphWindow = null;
                addToLog('Graph window closed.');
                // Small delay before reopening to ensure it's fully closed
                setTimeout(function () {
                    openGraphWindow();
                }, 100);
            } else {
                // Window is not open - just open it
                openGraphWindow();
            }
        });
    }

    // Add event listener for the "Print Graph" button (Time Chart)
    const printChartBtn = document.getElementById('printChartBtn');
    if (printChartBtn) {
        printChartBtn.addEventListener('click', function () {
            printChart();
        });
    }

    // Add event listener for the "Print Graph" button (Distance Chart)
    const printDistanceChartBtn = document.getElementById('printDistanceChartBtn');
    if (printDistanceChartBtn) {
        printDistanceChartBtn.addEventListener('click', function () {
            printDistanceChart();
        });
    }

    // Helper function to prepare chart for printing (invert colors for visibility)
    function prepareChartForPrint(chart) {
        if (!chart || !chart.options) return null;

        // Store original colors
        var originalColors = {
            scales: {},
            datasets: []
        };

        // Store original scale colors
        if (chart.options.scales) {
            if (chart.options.scales.x) {
                originalColors.scales.x = {
                    grid: chart.options.scales.x.grid ? chart.options.scales.x.grid.color : null,
                    ticks: chart.options.scales.x.ticks ? chart.options.scales.x.ticks.color : null,
                    title: chart.options.scales.x.title ? chart.options.scales.x.title.color : null
                };
                if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = '#000000';
                if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = '#000000';
                if (chart.options.scales.x.title) chart.options.scales.x.title.color = '#000000';
            }
            if (chart.options.scales.y) {
                originalColors.scales.y = {
                    grid: chart.options.scales.y.grid ? chart.options.scales.y.grid.color : null,
                    ticks: chart.options.scales.y.ticks ? chart.options.scales.y.ticks.color : null,
                    title: chart.options.scales.y.title ? chart.options.scales.y.title.color : null
                };
                if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = '#000000';
                if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = '#000000';
                if (chart.options.scales.y.title) chart.options.scales.y.title.color = '#000000';
            }
            if (chart.options.scales.y2) {
                originalColors.scales.y2 = {
                    grid: chart.options.scales.y2.grid ? chart.options.scales.y2.grid.color : null,
                    ticks: chart.options.scales.y2.ticks ? chart.options.scales.y2.ticks.color : null,
                    title: chart.options.scales.y2.title ? chart.options.scales.y2.title.color : null
                };
                if (chart.options.scales.y2.grid) chart.options.scales.y2.grid.color = '#000000';
                if (chart.options.scales.y2.ticks) chart.options.scales.y2.ticks.color = '#000000';
                if (chart.options.scales.y2.title) chart.options.scales.y2.title.color = '#000000';
            }
        }

        // Store and change dataset colors (especially Power line to black)
        if (chart.data && chart.data.datasets) {
            for (var i = 0; i < chart.data.datasets.length; i++) {
                originalColors.datasets[i] = {
                    borderColor: chart.data.datasets[i].borderColor,
                    backgroundColor: chart.data.datasets[i].backgroundColor
                };
                // Power line (index 10) is already red, no need to change
            }
        }

        // Store and change legend colors
        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
            originalColors.legend = chart.options.plugins.legend.labels.color;
            chart.options.plugins.legend.labels.color = '#000000';
        }

        return originalColors;
    }

    // Helper function to restore chart colors after printing
    function restoreChartColors(chart, originalColors) {
        if (!chart || !originalColors) return;

        // Restore scale colors
        if (originalColors.scales && chart.options.scales) {
            if (originalColors.scales.x && chart.options.scales.x) {
                if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = originalColors.scales.x.grid;
                if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = originalColors.scales.x.ticks;
                if (chart.options.scales.x.title) chart.options.scales.x.title.color = originalColors.scales.x.title;
            }
            if (originalColors.scales.y && chart.options.scales.y) {
                if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = originalColors.scales.y.grid;
                if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = originalColors.scales.y.ticks;
                if (chart.options.scales.y.title) chart.options.scales.y.title.color = originalColors.scales.y.title;
            }
            if (originalColors.scales.y2 && chart.options.scales.y2) {
                if (chart.options.scales.y2.grid) chart.options.scales.y2.grid.color = originalColors.scales.y2.grid;
                if (chart.options.scales.y2.ticks) chart.options.scales.y2.ticks.color = originalColors.scales.y2.ticks;
                if (chart.options.scales.y2.title) chart.options.scales.y2.title.color = originalColors.scales.y2.title;
            }
        }

        // Restore dataset colors
        if (originalColors.datasets && chart.data && chart.data.datasets) {
            for (var i = 0; i < originalColors.datasets.length && i < chart.data.datasets.length; i++) {
                if (originalColors.datasets[i]) {
                    chart.data.datasets[i].borderColor = originalColors.datasets[i].borderColor;
                    chart.data.datasets[i].backgroundColor = originalColors.datasets[i].backgroundColor;
                }
            }
        }

        // Restore legend colors
        if (originalColors.legend && chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
            chart.options.plugins.legend.labels.color = originalColors.legend;
        }
    }

    // Function to print the Time chart
    function printChart() {
        // Try to initialize chart if it doesn't exist
        if (!window.liveChartRef) {
            // Try to initialize the live chart
            try {
                var testCanvas = document.getElementById('testChart');
                if (testCanvas && window.Chart) {
                    var ctx = testCanvas.getContext('2d');
                    var themeColors = getChartThemeColors();
                    testCanvas.style.background = themeColors.background;
                    testCanvas.style.borderColor = themeColors.border;
                    var colors = ['#ff4d4f', '#40a9ff', '#73d13d', '#fa8c16', '#b37feb', '#36cfc9', '#f759ab', '#9254de', '#faad14', '#1f7a8c', '#ff0000', '#ff007a'];
                    var labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Radial Heater', 'Linear Heater', 'Power', 'Target'];
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
                            plugins: { legend: { position: 'right', labels: { color: themeColors.text } } },
                            scales: {
                                x: {
                                    grid: { color: themeColors.grid },
                                    ticks: { color: themeColors.text }
                                },
                                y: {
                                    type: 'linear',
                                    position: 'left',
                                    title: { display: true, text: 'Temperature (°C)', color: themeColors.text },
                                    grid: { color: themeColors.grid },
                                    ticks: { color: themeColors.text }
                                },
                                y2: {
                                    type: 'linear',
                                    position: 'right',
                                    grid: { drawOnChartArea: false, color: themeColors.grid },
                                    title: { display: true, text: 'Power (W)', color: themeColors.text },
                                    ticks: { color: themeColors.text }
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                console.error('Error initializing chart:', e);
            }
        }

        // Check if chart exists after trying to initialize
        var chart = null;
        var canvas = null;

        if (window.liveChartRef && window.liveChartRef.canvas) {
            chart = window.liveChartRef;
            canvas = chart.canvas;
        } else if (chartJsRef && chartJsRef.canvas) {
            // Fallback: try to use chartJsRef if available
            chart = chartJsRef;
            canvas = chart.canvas;
        } else {
            alert('Chart is not initialized yet. Please wait for the chart to load or refresh the page.');
            return;
        }

        if (!canvas) {
            alert('Chart canvas not found!');
            return;
        }

        // Check if chart has any data
        var hasData = false;
        if (chart.data && chart.data.datasets) {
            for (var i = 0; i < chart.data.datasets.length; i++) {
                if (chart.data.datasets[i].data && chart.data.datasets[i].data.length > 0) {
                    hasData = true;
                    break;
                }
            }
        }

        if (!hasData) {
            alert('Chart has no data to print! Please make sure data is being received.');
            return;
        }

        // Prepare chart for printing (invert colors)
        var originalColors = prepareChartForPrint(chart);

        // Force chart to resize and update to ensure it's fully rendered
        chart.resize();
        chart.update('none');

        // Wait for chart to fully render, then export
        setTimeout(function () {
            try {
                // Check if canvas has content
                if (canvas.width === 0 || canvas.height === 0) {
                    restoreChartColors(chart, originalColors);
                    chart.update('none');
                    alert('Chart canvas is empty. Please wait for data to load.');
                    return;
                }

                // Convert canvas to image - use higher quality
                var imageData = canvas.toDataURL('image/png', 1.0);

                // Restore original colors immediately after export
                restoreChartColors(chart, originalColors);
                chart.update('none');

                // Check if we got valid image data
                if (!imageData || imageData === 'data:,' || imageData.length < 100) {
                    alert('Chart export failed. Please try again.');
                    console.error('Image data length:', imageData ? imageData.length : 0);
                    return;
                }

                // Print directly using hidden iframe - completely invisible
                var iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.left = '-9999px';
                iframe.style.top = '-9999px';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = 'none';
                iframe.style.visibility = 'hidden';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write('<!DOCTYPE html><html><head><title>Print Chart</title>');
                iframeDoc.write('<meta http-equiv="Content-Security-Policy" content="img-src data: \'self\'; style-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\'; default-src \'self\' data:;">');
                iframeDoc.write('<style>');
                iframeDoc.write('body { margin: 0; padding: 20px; text-align: center; }');
                iframeDoc.write('img { max-width: 100%; height: auto; display: block; margin: 0 auto; }');
                iframeDoc.write('h2 { font-family: Arial, sans-serif; color: #333; }');
                iframeDoc.write('@media print { body { margin: 0; padding: 0; } }');
                iframeDoc.write('</style>');
                iframeDoc.write('</head><body>');
                iframeDoc.write('<h2>Device Data Chart - Temperature vs Time</h2>');
                iframeDoc.write('<img src="' + imageData + '" id="chartImage" />');
                iframeDoc.write('</body></html>');
                iframeDoc.close();

                // Wait for image to load before printing
                setTimeout(function () {
                    var img = iframeDoc.getElementById('chartImage');
                    if (img && img.complete) {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                        setTimeout(function () {
                            if (iframe.parentNode) {
                                document.body.removeChild(iframe);
                            }
                        }, 500);
                    } else if (img) {
                        img.onload = function () {
                            iframe.contentWindow.focus();
                            iframe.contentWindow.print();
                            setTimeout(function () {
                                if (iframe.parentNode) {
                                    document.body.removeChild(iframe);
                                }
                            }, 500);
                        };
                    }
                }, 100);
            } catch (error) {
                alert('Error printing chart: ' + error.message);
                console.error('Print error:', error);
            }
        }, 500);
    }

    // Function to print the Distance chart
    function printDistanceChart() {
        // Try to initialize chart if it doesn't exist
        if (!distanceChartJsRef) {
            initDistanceChart();
        }

        // Check if chart exists after trying to initialize
        if (!distanceChartJsRef) {
            alert('Distance chart could not be initialized. Please make sure Chart.js is loaded.');
            return;
        }

        var chart = distanceChartJsRef;
        var canvas = chart.canvas;

        if (!canvas) {
            alert('Distance chart canvas not found!');
            return;
        }

        // Check if chart has any data
        var hasData = false;
        if (chart.data && chart.data.datasets) {
            for (var i = 0; i < chart.data.datasets.length; i++) {
                if (chart.data.datasets[i].data && chart.data.datasets[i].data.length > 0) {
                    hasData = true;
                    break;
                }
            }
        }

        if (!hasData) {
            alert('Chart has no data to print! Please make sure data is being received.');
            return;
        }

        // Prepare chart for printing (invert colors)
        var originalColors = prepareChartForPrint(chart);

        // Force chart to resize and update to ensure it's fully rendered
        chart.resize();
        chart.update('none');

        // Wait for chart to fully render, then export
        setTimeout(function () {
            try {
                // Check if canvas has content
                if (canvas.width === 0 || canvas.height === 0) {
                    restoreChartColors(chart, originalColors);
                    chart.update('none');
                    alert('Distance chart canvas is empty. Please wait for data to load.');
                    return;
                }

                // Convert canvas to image - use higher quality
                var imageData = canvas.toDataURL('image/png', 1.0);

                // Restore original colors immediately after export
                restoreChartColors(chart, originalColors);
                chart.update('none');

                // Check if we got valid image data
                if (!imageData || imageData === 'data:,' || imageData.length < 100) {
                    alert('Distance chart has no data to print! Please make sure the chart has data points.');
                    return;
                }

                // Print directly using hidden iframe - completely invisible
                var iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.left = '-9999px';
                iframe.style.top = '-9999px';
                iframe.style.width = '1px';
                iframe.style.height = '1px';
                iframe.style.border = 'none';
                iframe.style.visibility = 'hidden';
                iframe.style.opacity = '0';
                iframe.style.pointerEvents = 'none';
                document.body.appendChild(iframe);

                var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write('<!DOCTYPE html><html><head><title>Print Chart</title>');
                iframeDoc.write('<meta http-equiv="Content-Security-Policy" content="img-src data: \'self\'; style-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\'; default-src \'self\' data:;">');
                iframeDoc.write('<style>');
                iframeDoc.write('body { margin: 0; padding: 20px; text-align: center; }');
                iframeDoc.write('img { max-width: 100%; height: auto; display: block; margin: 0 auto; }');
                iframeDoc.write('h2 { font-family: Arial, sans-serif; color: #333; }');
                iframeDoc.write('@media print { body { margin: 0; padding: 0; } }');
                iframeDoc.write('</style>');
                iframeDoc.write('</head><body>');
                iframeDoc.write('<h2>Temperature vs Distance Graph</h2>');
                iframeDoc.write('<img src="' + imageData + '" id="chartImage" />');
                iframeDoc.write('</body></html>');
                iframeDoc.close();

                // Wait for image to load before printing
                setTimeout(function () {
                    var img = iframeDoc.getElementById('chartImage');
                    if (img && img.complete) {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                        setTimeout(function () {
                            if (iframe.parentNode) {
                                document.body.removeChild(iframe);
                            }
                        }, 500);
                    } else if (img) {
                        img.onload = function () {
                            iframe.contentWindow.focus();
                            iframe.contentWindow.print();
                            setTimeout(function () {
                                if (iframe.parentNode) {
                                    document.body.removeChild(iframe);
                                }
                            }, 500);
                        };
                    }
                }, 100);
            } catch (error) {
                alert('Error printing distance chart: ' + error.message);
                console.error('Print error:', error);
            }
        }, 500);
    }

    // Function to print both charts together on separate pages
    function printBothCharts() {
        // Try to initialize time chart if it doesn't exist
        if (!window.liveChartRef) {
            try {
                var testCanvas = document.getElementById('testChart');
                if (testCanvas && window.Chart) {
                    var ctx = testCanvas.getContext('2d');
                    var themeColors = getChartThemeColors();
                    testCanvas.style.background = themeColors.background;
                    testCanvas.style.borderColor = themeColors.border;
                    var colors = ['#ff4d4f', '#40a9ff', '#73d13d', '#fa8c16', '#b37feb', '#36cfc9', '#f759ab', '#9254de', '#faad14', '#1f7a8c', '#ff0000', '#ff007a'];
                    var labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Radial Heater', 'Linear Heater', 'Power', 'Target'];
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
                            plugins: { legend: { position: 'right', labels: { color: themeColors.text } } },
                            scales: {
                                x: {
                                    grid: { color: themeColors.grid },
                                    ticks: { color: themeColors.text }
                                },
                                y: {
                                    type: 'linear',
                                    position: 'left',
                                    title: { display: true, text: 'Temperature (°C)', color: themeColors.text },
                                    grid: { color: themeColors.grid },
                                    ticks: { color: themeColors.text }
                                },
                                y2: {
                                    type: 'linear',
                                    position: 'right',
                                    grid: { drawOnChartArea: false, color: themeColors.grid },
                                    title: { display: true, text: 'Power (W)', color: themeColors.text },
                                    ticks: { color: themeColors.text }
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                console.error('Error initializing time chart:', e);
            }
        }

        // Try to initialize distance chart if it doesn't exist
        if (!distanceChartJsRef) {
            initDistanceChart();
        }

        // Check if at least one chart exists
        if (!window.liveChartRef && !distanceChartJsRef) {
            alert('Charts are not initialized yet. Please wait for the charts to load.');
            return;
        }

        var timeChart = window.liveChartRef;
        var distanceChart = distanceChartJsRef;
        var timeCanvas = null;
        var distanceCanvas = null;

        // Check if at least one chart has data
        var timeHasData = false;
        var distanceHasData = false;

        // Check time chart data (try liveChartRef first, then chartJsRef as fallback)
        var chartToCheck = timeChart;
        if (!chartToCheck && chartJsRef) {
            chartToCheck = chartJsRef;
        }

        if (chartToCheck && chartToCheck.data && chartToCheck.data.datasets) {
            for (var i = 0; i < chartToCheck.data.datasets.length; i++) {
                if (chartToCheck.data.datasets[i].data && chartToCheck.data.datasets[i].data.length > 0) {
                    timeHasData = true;
                    break;
                }
            }
        }

        // Check distance chart data
        if (distanceChart && distanceChart.data && distanceChart.data.datasets) {
            for (var j = 0; j < distanceChart.data.datasets.length; j++) {
                if (distanceChart.data.datasets[j].data && distanceChart.data.datasets[j].data.length > 0) {
                    distanceHasData = true;
                    break;
                }
            }
        }

        // If neither chart has data, show error message
        if (!timeHasData && !distanceHasData) {
            alert('Chart has no data to print! Please make sure data is being received.');
            return;
        }

        // Get canvases from chart instances and prepare for printing
        var timeOriginalColors = null;
        var distanceOriginalColors = null;

        if (timeChart && timeChart.canvas) {
            timeCanvas = timeChart.canvas;
            timeOriginalColors = prepareChartForPrint(timeChart);
            timeChart.resize();
            timeChart.update('none');
        } else if (chartJsRef && chartJsRef.canvas) {
            // Fallback to chartJsRef
            timeChart = chartJsRef;
            timeCanvas = chartJsRef.canvas;
            timeOriginalColors = prepareChartForPrint(timeChart);
            timeChart.resize();
            timeChart.update('none');
        }
        if (distanceChart && distanceChart.canvas) {
            distanceCanvas = distanceChart.canvas;
            distanceOriginalColors = prepareChartForPrint(distanceChart);
            distanceChart.resize();
            distanceChart.update('none');
        }

        if (!timeCanvas && !distanceCanvas) {
            alert('One or both chart canvases not found!');
            return;
        }

        // Wait for charts to fully render, then convert canvases to images
        setTimeout(function () {
            try {
                var timeImageData = null;
                var distanceImageData = null;

                // Export time chart
                if (timeCanvas && timeCanvas.width > 0 && timeCanvas.height > 0) {
                    timeImageData = timeCanvas.toDataURL('image/png', 1.0);
                    if (!timeImageData || timeImageData === 'data:,' || timeImageData.length < 100) {
                        timeImageData = null;
                    } else {
                        // Restore original colors after export
                        if (timeChart && timeOriginalColors) {
                            restoreChartColors(timeChart, timeOriginalColors);
                            timeChart.update('none');
                        }
                    }
                }

                // Export distance chart
                if (distanceCanvas && distanceCanvas.width > 0 && distanceCanvas.height > 0) {
                    distanceImageData = distanceCanvas.toDataURL('image/png', 1.0);
                    if (!distanceImageData || distanceImageData === 'data:,' || distanceImageData.length < 100) {
                        distanceImageData = null;
                    } else {
                        // Restore original colors after export
                        if (distanceChart && distanceOriginalColors) {
                            restoreChartColors(distanceChart, distanceOriginalColors);
                            distanceChart.update('none');
                        }
                    }
                }

                if (!timeImageData && !distanceImageData) {
                    alert('Charts have no data to print! Please make sure the charts have data points.');
                    return;
                }

                // Print directly using hidden iframe - completely invisible
                var iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.left = '-9999px';
                iframe.style.top = '-9999px';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = 'none';
                iframe.style.visibility = 'hidden';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write('<!DOCTYPE html><html><head><title>Print Both Charts</title>');
                iframeDoc.write('<meta http-equiv="Content-Security-Policy" content="img-src data: \'self\'; style-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\'; default-src \'self\' data:;">');
                iframeDoc.write('<style>');
                iframeDoc.write('body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: white; }');
                iframeDoc.write('.chart-page { width: 100%; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-after: always; page-break-inside: avoid; background: white; }');
                iframeDoc.write('.chart-page:last-child { page-break-after: auto; }');
                iframeDoc.write('img { max-width: 90%; height: auto; display: block; margin: 20px auto; }');
                iframeDoc.write('h2 { color: #333; margin: 20px 0; }');
                iframeDoc.write('@media print {');
                iframeDoc.write('  body { margin: 0; padding: 0; background: white !important; }');
                iframeDoc.write('  .chart-page { page-break-after: always; page-break-inside: avoid; background: white !important; }');
                iframeDoc.write('  .chart-page:last-child { page-break-after: auto; }');
                iframeDoc.write('}');
                iframeDoc.write('</style>');
                iframeDoc.write('</head><body>');

                var totalImages = 0;
                if (timeImageData) totalImages++;
                if (distanceImageData) totalImages++;

                // First chart - Temperature vs Time
                if (timeImageData) {
                    iframeDoc.write('<div class="chart-page">');
                    iframeDoc.write('<h2>Device Data Chart - Temperature vs Time</h2>');
                    iframeDoc.write('<img src="' + timeImageData + '" id="img1" />');
                    iframeDoc.write('</div>');
                }

                // Second chart - Temperature vs Distance
                if (distanceImageData) {
                    iframeDoc.write('<div class="chart-page">');
                    iframeDoc.write('<h2>Temperature vs Distance Graph</h2>');
                    iframeDoc.write('<img src="' + distanceImageData + '" id="img2" />');
                    iframeDoc.write('</div>');
                }

                iframeDoc.write('<script>');
                iframeDoc.write('var imagesLoaded = 0;');
                iframeDoc.write('var totalImages = ' + totalImages + ';');
                iframeDoc.write('function checkAndPrint() {');
                iframeDoc.write('  imagesLoaded++;');
                iframeDoc.write('  if (imagesLoaded >= totalImages) {');
                iframeDoc.write('    window.focus();');
                iframeDoc.write('    setTimeout(function(){ window.print(); }, 200);');
                iframeDoc.write('  }');
                iframeDoc.write('}');
                iframeDoc.write('window.onload = function() {');
                if (timeImageData) {
                    iframeDoc.write('  var img1 = document.getElementById("img1");');
                    iframeDoc.write('  if (img1) { img1.onload = checkAndPrint; if (img1.complete) checkAndPrint(); }');
                }
                if (distanceImageData) {
                    iframeDoc.write('  var img2 = document.getElementById("img2");');
                    iframeDoc.write('  if (img2) { img2.onload = checkAndPrint; if (img2.complete) checkAndPrint(); }');
                }
                iframeDoc.write('};');
                iframeDoc.write('</script>');
                iframeDoc.write('</body></html>');
                iframeDoc.close();

                iframe.onload = function () {
                    setTimeout(function () {
                        iframe.contentWindow.focus();
                        setTimeout(function () {
                            document.body.removeChild(iframe);
                        }, 1000);
                    }, 200);
                };
            } catch (error) {
                alert('Error printing charts: ' + error.message);
                console.error('Print error:', error);
            }
        }, 500);
    }

    // Add keyboard shortcut Ctrl+P to print both charts
    document.addEventListener('keydown', function (event) {
        // Check if Ctrl+P is pressed (or Cmd+P on Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
            // Prevent the default browser print behavior
            event.preventDefault();

            // Print both charts
            printBothCharts();
        }
    });

    // Apply saved theme/layout
    try {
        var savedLayout = localStorage.getItem('appLayout') || 'standard';
        applyTheme('dark');
        applyLayout(savedLayout);
        var layoutSel = document.getElementById('layoutSelect');
        if (layoutSel) layoutSel.addEventListener('change', function () { applyLayout(layoutSel.value); localStorage.setItem('appLayout', layoutSel.value); });
    } catch (e) { /* ignore */ }

    // Simulation window button (no chart data changes)
    var simulateBtn = document.getElementById('simulateBtn');
    if (simulateBtn) {
        simulateBtn.addEventListener('click', function () {
            // Check if window is already open
            if (simulationWindow && !simulationWindow.closed) {
                // Window is open - close it first
                simulationWindow.close();
                simulationWindow = null;
                addToLog('Simulation window closed.');
                // Small delay before reopening to ensure it's fully closed
                setTimeout(function () {
                    openSimulationWindow();
                }, 100);
            } else {
                // Window is not open - just open it
                openSimulationWindow();
            }
        });
    }

    // Helper function to open simulation window
    function openSimulationWindow() {
        // Only open the STEP viewer window
        simulationWindow = window.open('simulation.html', 'simulationWindow', 'width=450,height=320,resizable=yes');
        if (simulationWindow) {
            simulationWindow.focus();
            // Track when window is closed
            var checkClosed = setInterval(function () {
                if (simulationWindow.closed) {
                    clearInterval(checkClosed);
                    simulationWindow = null;
                }
            }, 500);
            addToLog('Simulation window opened (STEP preview only).');
        }
    }

    // Curriculum button - opens Curriculum menu
    var curriculumBtn = document.getElementById('curriculumBtn');
    if (curriculumBtn) {
        curriculumBtn.addEventListener('click', function () {
            // Check if window is already open
            if (curriculumWindow && !curriculumWindow.closed) {
                // Window is open - close it first
                curriculumWindow.close();
                curriculumWindow = null;
                addToLog('Curriculum window closed.');
                // Small delay before reopening to ensure it's fully closed
                setTimeout(function () {
                    openCurriculumWindow();
                }, 100);
            } else {
                // Window is not open - just open it
                openCurriculumWindow();
            }
        });
    }

    // Helper function to open curriculum window
    function openCurriculumWindow() {
        // Open Curriculum menu window
        curriculumWindow = window.open('curriculum.html', 'curriculumWindow', 'width=1100,height=900,resizable=yes,scrollbars=yes');
        if (curriculumWindow) {
            curriculumWindow.focus();
            // Track when window is closed
            var checkClosed = setInterval(function () {
                if (curriculumWindow.closed) {
                    clearInterval(checkClosed);
                    curriculumWindow = null;
                }
            }, 500);
            addToLog('Heat Transfer Curriculum opened.');
        }
    }

    // Comprehensive window resize handler to fix layout issues
    function handleWindowResize() {
        // Resize all charts
        if (chartJsRef) {
            chartJsRef.resize();
        }
        if (distanceChartJsRef) {
            distanceChartJsRef.resize();
        }
        if (window.liveChartRef) {
            window.liveChartRef.resize();
        }

        // Ensure container doesn't overflow
        var container = document.querySelector('.container');
        if (container) {
            container.style.maxWidth = '100%';
        }

        // Ensure header doesn't overflow
        var headerContainer = document.querySelector('.header-container');
        if (headerContainer) {
            headerContainer.style.overflowX = 'hidden';
        }

        // Ensure controls layout doesn't overflow
        var controlsLayout = document.querySelector('.controls-layout');
        if (controlsLayout) {
            controlsLayout.style.overflowX = 'hidden';
        }
    }

    // Function to sync Print Graph button sizes
    function syncPrintButtonSizes() {
        var printChartBtn = document.getElementById('printChartBtn');
        var printDistanceChartBtn = document.getElementById('printDistanceChartBtn');

        if (printChartBtn && printDistanceChartBtn) {
            // Temporarily remove width constraints to measure natural size
            printChartBtn.style.width = 'auto';
            printDistanceChartBtn.style.width = 'auto';

            // Force a reflow to get accurate measurements
            void printChartBtn.offsetWidth;
            void printDistanceChartBtn.offsetWidth;

            // Get the natural width of the source button (with full text visible)
            var sourceWidth = printChartBtn.scrollWidth;
            var sourceHeight = printChartBtn.offsetHeight;

            // Apply the exact same size to both buttons
            printChartBtn.style.width = sourceWidth + 'px';
            printDistanceChartBtn.style.width = sourceWidth + 'px';
            printDistanceChartBtn.style.height = sourceHeight + 'px';
        }
    }

    // Sync button sizes on load with multiple attempts to ensure it works
    setTimeout(function () {
        syncPrintButtonSizes();
    }, 100);
    setTimeout(function () {
        syncPrintButtonSizes();
    }, 500);
    setTimeout(function () {
        syncPrintButtonSizes();
    }, 1000);

    // Add resize event listener with debouncing for better performance
    var resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function () {
            handleWindowResize();
            syncPrintButtonSizes(); // Sync button sizes after resize
        }, 100);
    });

    // Call once on load to ensure initial layout is correct
    handleWindowResize();
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
        // Fan emoji removed - no animation needed
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

    fanSpeedInput.addEventListener('input', function () {
        var percentage = parseInt(fanSpeedInput.value, 10);
        if (fanSpeedDisplay) fanSpeedDisplay.value = percentage;
        updateSliderFill(fanSpeedInput.value);
        updateFanIcon(fanSpeedInput.value);
        // Update button states in real-time
        updateFanButtons(percentage);
    });

    // Handle user typing in fan speed input field
    if (fanSpeedDisplay) {
        // Function to validate and send fan speed data
        async function validateAndSendFanSpeed() {
            var value = parseInt(fanSpeedDisplay.value, 10);
            if (isNaN(value)) {
                // Reset to current slider value if invalid
                if (fanSpeedInput) {
                    fanSpeedDisplay.value = parseInt(fanSpeedInput.value, 10);
                }
            } else {
                // Clamp value to valid range
                value = Math.max(0, Math.min(100, value));
                fanSpeedDisplay.value = value;
                // Update slider and send to hardware
                if (fanSpeedInput) {
                    fanSpeedInput.value = value;
                    updateSliderFill(value);
                    updateFanIcon(value);
                    updateFanButtons(value);
                    // Send to hardware
                    try {
                        var result = await window.electronAPI.sendFanSpeed(value);
                        if (!result || !result.success) {
                            addToLog('Failed to send fan speed: ' + (result && result.error ? result.error : 'Unknown error'));
                        }
                    } catch (error) {
                        addToLog('Error sending fan speed: ' + error.message);
                    }
                }
            }
        }

        fanSpeedDisplay.addEventListener('input', function () {
            var value = parseInt(fanSpeedDisplay.value, 10);
            if (!isNaN(value)) {
                // Clamp value to valid range
                value = Math.max(0, Math.min(100, value));
                fanSpeedDisplay.value = value;
                // Update slider
                if (fanSpeedInput) {
                    fanSpeedInput.value = value;
                    updateSliderFill(value);
                    updateFanIcon(value);
                    updateFanButtons(value);
                }
            }
        });

        // Send data when user clicks outside (blur)
        fanSpeedDisplay.addEventListener('blur', validateAndSendFanSpeed);

        // Send data when user presses Enter
        fanSpeedDisplay.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.keyCode === 13) {
                event.preventDefault();
                validateAndSendFanSpeed();
                fanSpeedDisplay.blur(); // Remove focus after sending
            }
        });
    }

    // Fan slider hover tooltip
    fanSpeedInput.addEventListener('mousemove', function (e) {
        if (fanTooltip) {
            var rect = fanSpeedInput.getBoundingClientRect();
            var percentage = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            percentage = Math.max(0, Math.min(100, percentage));
            fanTooltip.textContent = percentage + '%';
            fanTooltip.style.left = e.clientX - rect.left + 'px';
        }
    });

    fanSpeedInput.addEventListener('change', async function () {
        try {
            var v = parseInt(fanSpeedInput.value, 10);
            // Update button states when slider changes
            updateFanButtons(v);
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
    if (fanSpeedDisplay) fanSpeedDisplay.value = parseInt(fanSpeedInput.value, 10);
    // Initialize button states
    var initialSpeed = parseInt(fanSpeedInput.value, 10);
    updateFanButtons(initialSpeed);
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

    heaterTempInput.addEventListener('input', function () {
        var temp = parseInt(heaterTempInput.value, 10);
        if (heaterTempValue) heaterTempValue.value = temp;
        updateHeaterSliderFill(heaterTempInput.value);
        updateHeaterIcon(heaterTempInput.value);
    });

    // Handle user typing in heater temperature input field
    if (heaterTempValue) {
        // Function to validate and send heater temperature data
        async function validateAndSendHeaterTemp() {
            var value = parseInt(heaterTempValue.value, 10);
            if (isNaN(value)) {
                // Reset to current slider value if invalid
                if (heaterTempInput) {
                    heaterTempValue.value = parseInt(heaterTempInput.value, 10);
                }
            } else {
                // Clamp value to valid range
                value = Math.max(20, Math.min(70, value));
                heaterTempValue.value = value;
                // Update slider and send to hardware
                if (heaterTempInput) {
                    heaterTempInput.value = value;
                    updateHeaterSliderFill(value);
                    updateHeaterIcon(value);
                    // Send to hardware
                    try {
                        var result = await window.electronAPI.sendHeaterTemp(value);
                        if (!result || !result.success) {
                            addToLog('Failed to send heater temp: ' + (result && result.error ? result.error : 'Unknown error'));
                        }
                    } catch (error) {
                        addToLog('Error sending heater temp: ' + error.message);
                    }
                }
            }
        }

        heaterTempValue.addEventListener('input', function () {
            // Allow user to type freely without updating slider
            // Slider will update only when user presses Enter or clicks outside
        });

        // Send data when user clicks outside (blur)
        heaterTempValue.addEventListener('blur', validateAndSendHeaterTemp);

        // Send data when user presses Enter
        heaterTempValue.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.keyCode === 13) {
                event.preventDefault();
                validateAndSendHeaterTemp();
                heaterTempValue.blur(); // Remove focus after sending
            }
        });
    }

    // Heater slider hover tooltip
    heaterTempInput.addEventListener('mousemove', function (e) {
        if (heaterTooltip) {
            var rect = heaterTempInput.getBoundingClientRect();
            var temp = Math.round(20 + ((e.clientX - rect.left) / rect.width) * 50);
            temp = Math.max(20, Math.min(70, temp));
            heaterTooltip.textContent = temp + '°C';
            heaterTooltip.style.left = e.clientX - rect.left + 'px';
        }
    });

    heaterTempInput.addEventListener('change', async function () {
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
    addToLog('DEBUG: updateHeaterButtons called with heaterMode: ' + heaterMode);

    // Remove active class from heater buttons only (cooler is independent)
    if (heaterOffBtn) {
        heaterOffBtn.classList.remove('active');
        addToLog('DEBUG: Removed active class from heaterOffBtn');
    }
    if (heaterLeftBtn) {
        heaterLeftBtn.classList.remove('active');
        heaterLeftBtn.textContent = 'Linear Heater';
        addToLog('DEBUG: Removed active class from heaterLeftBtn, set text: ' + heaterLeftBtn.textContent);
    }
    if (heaterRightBtn) {
        heaterRightBtn.classList.remove('active');
        heaterRightBtn.textContent = 'Radial Heater';
        addToLog('DEBUG: Removed active class from heaterRightBtn, set text: ' + heaterRightBtn.textContent);
    }

    // Add active class to current heater mode
    if (heaterMode === 0 && heaterOffBtn) {
        heaterOffBtn.classList.add('active');
        addToLog('DEBUG: Added active class to heaterOffBtn (mode 0)');
    } else if (heaterMode === 1 && heaterLeftBtn) {
        heaterLeftBtn.classList.add('active');
        addToLog('DEBUG: Added active class to heaterLeftBtn (mode 1)');
    } else if (heaterMode === 2 && heaterRightBtn) {
        heaterRightBtn.classList.add('active');
        addToLog('DEBUG: Added active class to heaterRightBtn (mode 2)');
    } else {
        addToLog('DEBUG: No button was activated - heaterMode: ' + heaterMode + ', buttons found: off=' + !!heaterOffBtn + ', left=' + !!heaterLeftBtn + ', right=' + !!heaterRightBtn);
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
            // Update global state
            coolerEnabled = enabled;
            // Update button text and style
            if (coolerBtn) {
                if (enabled) {
                    // Cooler is ON
                    coolerBtn.classList.add('active');
                    coolerBtn.textContent = 'Cooler On';
                } else {
                    // Cooler is OFF
                    coolerBtn.classList.remove('active');
                    coolerBtn.textContent = 'Cooler Off';
                }
            }
            addToLog('Cooler set to: ' + (enabled ? 'ON' : 'OFF'));
        }
    } catch (e) {
        addToLog('Error setting cooler: ' + e.message);
    }
}

if (heaterOffBtn) {
    heaterOffBtn.addEventListener('click', function () {
        setHeaterMode(0);
    });
}

if (heaterLeftBtn) {
    heaterLeftBtn.addEventListener('click', function () {
        setHeaterMode(1);
    });
}

if (heaterRightBtn) {
    heaterRightBtn.addEventListener('click', function () {
        setHeaterMode(2);
    });
}

if (coolerBtn) {
    // Initialize button text based on current state
    coolerBtn.textContent = coolerEnabled ? 'Cooler On' : 'Cooler Off';

    coolerBtn.addEventListener('click', function () {
        // Toggle cooler state
        var newState = !coolerEnabled;
        setCoolerMode(newState);
    });
}

// Fan speed button functions
async function setFanSpeed(speed) {
    // Make sure speed is valid (0, 50, or 100)
    if (speed !== 0 && speed !== 50 && speed !== 100) {
        addToLog('Invalid fan speed: ' + speed + '. Must be 0, 50, or 100.');
        return;
    }

    // Update the slider value
    if (fanSpeedInput) {
        fanSpeedInput.value = speed;
    }

    // Update the display
    if (fanSpeedDisplay) {
        fanSpeedDisplay.value = speed;
    }

    // Update slider fill and icon
    updateSliderFill(speed);
    updateFanIcon(speed);

    // Update button states
    updateFanButtons(speed);

    // Send the command to hardware
    try {
        var result = await window.electronAPI.sendFanSpeed(speed);
        if (!result || !result.success) {
            addToLog('Failed to send fan speed: ' + (result && result.error ? result.error : 'Unknown error'));
        } else {
            addToLog('Fan speed set to: ' + speed + '%');
        }
    } catch (e) {
        addToLog('Error sending fan speed: ' + e.message);
    }
}

// Fan button event listeners
if (fanOffBtn) {
    fanOffBtn.addEventListener('click', function () {
        setFanSpeed(0);
    });
}

if (fan50Btn) {
    fan50Btn.addEventListener('click', function () {
        setFanSpeed(50);
    });
}

if (fan100Btn) {
    fan100Btn.addEventListener('click', function () {
        setFanSpeed(100);
    });
}

// Admin panel functionality
async function openAdminPanel() {
    // Open admin panel using IPC to ensure preload script access
    if (window.electronAPI && window.electronAPI.openAdminPanel) {
        try {
            const result = await window.electronAPI.openAdminPanel();
            if (result.success) {
                if (result.alreadyOpen) {
                    addToLog('Admin panel already open - focused existing window');
                } else {
                    addToLog('Admin panel opened');
                }
            } else {
                addToLog('Failed to open admin panel: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            addToLog('Error opening admin panel: ' + error.message);
            // Fallback to window.open if IPC fails
            // Use window name to reuse same window if already open
            var fallbackWindow = window.open('admin.html', 'adminPanel', 'width=1200,height=800,scrollbars=yes,resizable=yes');
            if (fallbackWindow) {
                // Check if window was already open (window.open returns existing window)
                if (fallbackWindow.location.href && fallbackWindow.location.href.includes('admin.html')) {
                    fallbackWindow.focus();
                    addToLog('Admin panel already open - focused existing window (fallback)');
                } else {
                    addToLog('Admin panel opened (fallback method)');
                }
            } else {
                addToLog('Failed to open admin panel - popup blocked?');
            }
        }
    } else {
        // Fallback to window.open if electronAPI not available
        // Use window name to reuse same window if already open
        var fallbackWindow = window.open('admin.html', 'adminPanel', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        if (fallbackWindow) {
            // Check if window was already open (window.open returns existing window)
            try {
                if (fallbackWindow.location.href && fallbackWindow.location.href.includes('admin.html')) {
                    fallbackWindow.focus();
                    addToLog('Admin panel already open - focused existing window (fallback)');
                } else {
                    addToLog('Admin panel opened (fallback method)');
                }
            } catch (e) {
                // Cross-origin error means window is new, which is fine
                addToLog('Admin panel opened (fallback method)');
            }
        } else {
            addToLog('Failed to open admin panel - popup blocked?');
        }
    }
}

function openGraphWindow() {
    // Open graph in a new window with data sharing
    graphWindow = window.open('chart.html', 'graphWindow', 'width=1000,height=700,scrollbars=yes,resizable=yes');

    if (graphWindow) {
        graphWindow.focus();
        // Track when window is closed
        var checkClosed = setInterval(function () {
            if (graphWindow.closed) {
                clearInterval(checkClosed);
                graphWindow = null;
            }
        }, 500);

        addToLog('Graph window opened');

        // Wait for the window to load, then share data
        graphWindow.addEventListener('load', function () {
            setupGraphCommunication(graphWindow);
        });
    } else {
        addToLog('Failed to open graph window - popup blocked?');
    }
}

function setupGraphCommunication(windowRef) {
    // Make chartData available to the graph window
    if (windowRef) {
        // Share the chart data object with current heater slider value
        var currentHeaterValue = heaterTempInput ? parseInt(heaterTempInput.value, 10) : 20;
        windowRef.chartData = chartData;
        windowRef.currentHeaterValue = currentHeaterValue;

        // Set up periodic data updates
        setInterval(function () {
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
    addToLog = function (message, type = 'info') {
        originalAddToLog(message, type);

        // Also send to admin panel if it's open
        if (adminWindow && !adminWindow.closed && adminWindow.addAdminLog) {
            adminWindow.addAdminLog(message, type);
        }
    };

    // Forward raw data to admin panel
    const originalAddRawData = addRawData;
    addRawData = function (data) {
        originalAddRawData(data);

        // Also send to admin panel if it's open
        if (adminWindow && !adminWindow.closed && adminWindow.addRawDataEntry) {
            adminWindow.addRawDataEntry(data, 'hex');
        }
    };
}

// Function to clear all graph data (used when hardware device reconnects)
function clearAllGraphs() {
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

    // Clear distance chart data
    if (distanceChartData && distanceChartData.samples) {
        distanceChartData.samples = [];
    }
    if (distanceChartJsRef) {
        distanceChartJsRef.data.datasets[0].data = [];
        distanceChartJsRef.update('none');
    }

    // Clear Plotly chart
    if (chartInitialized && window.Plotly && chartDivRef) {
        try {
            window.Plotly.newPlot(chartDivRef, [], plotlyLayout, plotlyConfig);
        } catch (e) { /* ignore */ }
    }

    redrawChart();
    console.log('All graphs cleared after hardware device reconnected');
}

window.addEventListener('beforeunload', function () {
    if (isConnected) {
        window.electronAPI.disconnectFromPort().catch(function (error) {
            console.log('Error during disconnect:', error);
        });
    }
});


