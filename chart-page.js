// Live Heat Transfer Data Chart
(function(){
    var chart = null;
    var chartData = {
        time: [],
        temperatures: {
            t1: [], t2: [], t3: [], t4: [], t5: [], t6: [], t7: [], t8: [],
            heaterLeft: [], heaterRight: []
        },
        power: []
    };
    var maxPoints = 100;

    // Wait for Chart.js to load
    function startWhenReady(tries) {
        if (window.Chart) {
            init();
            return;
        }
        if (tries > 40) {
            console.error('Chart.js failed to load');
            return;
        }
        setTimeout(function(){ startWhenReady(tries + 1); }, 100);
    }
    startWhenReady(0);

    function init() {
        var canvas = document.getElementById('testChartPage');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'T1', data: [], borderColor: '#ff4d4f', backgroundColor: 'rgba(255,77,79,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'T2', data: [], borderColor: '#40a9ff', backgroundColor: 'rgba(64,169,255,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'T3', data: [], borderColor: '#73d13d', backgroundColor: 'rgba(115,209,61,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'T4', data: [], borderColor: '#fa8c16', backgroundColor: 'rgba(250,140,22,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'T5', data: [], borderColor: '#b37feb', backgroundColor: 'rgba(179,127,235,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'T6', data: [], borderColor: '#36cfc9', backgroundColor: 'rgba(54,207,201,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'T7', data: [], borderColor: '#f759ab', backgroundColor: 'rgba(247,89,171,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'T8', data: [], borderColor: '#9254de', backgroundColor: 'rgba(146,84,222,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'Heater Left', data: [], borderColor: '#faad14', backgroundColor: 'rgba(250,173,20,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'Heater Right', data: [], borderColor: '#1f7a8c', backgroundColor: 'rgba(31,122,140,0.1)', pointRadius: 0, borderWidth: 2 },
                    { label: 'Target Temp', data: [], borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', pointRadius: 0, borderWidth: 3, borderDash: [5, 5] },
                    { label: 'Power', data: [], borderColor: '#1e90ff', backgroundColor: 'rgba(30,144,255,0.1)', pointRadius: 0, borderWidth: 2, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { 
                        display: true,
                        labels: { 
                            color: '#ddd',
                            usePointStyle: true,
                            pointStyle: 'line',
                            padding: 10
                        },
                        position: 'top'
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#333',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: { 
                        ticks: { 
                            color: '#ddd',
                            maxTicksLimit: 10,
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        },
                        grid: { 
                            color: '#333',
                            drawBorder: true
                        },
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#ddd'
                        }
                    },
                    y: { 
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { 
                            color: '#ddd',
                            callback: function(value) {
                                return value.toFixed(1) + '°C';
                            }
                        },
                        grid: { 
                            color: '#333',
                            drawBorder: true
                        },
                        title: {
                            display: true,
                            text: 'Temperature (°C)',
                            color: '#ddd'
                        },
                        beginAtZero: false,
                        min: 0,
                        max: 50
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        ticks: { 
                            color: '#1e90ff',
                            callback: function(value) {
                                return value.toFixed(1) + 'W';
                            }
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: '#1e90ff',
                            drawBorder: true
                        },
                        title: {
                            display: true,
                            text: 'Power (W)',
                            color: '#1e90ff'
                        },
                        beginAtZero: true
                    }
                }
            }
        });

        // Make chart responsive to window resize
        window.addEventListener('resize', function() {
            if (chart) {
                chart.resize();
                // Re-scale Y-axis after resize
                setTimeout(function() {
                    autoScaleYAxis();
                }, 100);
            }
        });

        // Add click event listener to legend to detect show/hide
        setTimeout(function() {
            if (chart && chart.legend) {
                // Listen for legend clicks to auto-scale when datasets are hidden/shown
                chart.legend.onClick = function(e, legendItem, legend) {
                    // Call the default legend click behavior
                    var index = legendItem.datasetIndex;
                    var ci = chart;
                    var meta = ci.getDatasetMeta(index);
                    
                    meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                    ci.update();
                    
                    // Auto-scale after hiding/showing
                    setTimeout(function() {
                        autoScaleYAxis();
                    }, 100);
                };
            }
        }, 1000);

        // Request data from parent window
        requestDataFromParent();
        
        // Initial auto-scale after a short delay
        setTimeout(function() {
            autoScaleYAxis();
        }, 500);

        // Auto-scale button removed - chart auto-scales automatically
    }

    function requestDataFromParent() {
        // Try to get data from parent window
        if (window.chartData) {
            // Copy data from parent window
            var parentData = window.chartData;
            if (parentData && parentData.time && parentData.series) {
                console.log('Received data from parent:', parentData.series.length, 'series');
                console.log('Target temp series (11):', parentData.series[11] ? parentData.series[11].slice(-3) : 'undefined');
                updateChartWithData(parentData);
            }
        }
        
        // Set up periodic data requests
        setInterval(function() {
            if (window.chartData) {
                var parentData = window.chartData;
                if (parentData && parentData.time && parentData.series) {
                    updateChartWithData(parentData);
                }
            }
        }, 1000); // Update every second
    }

    function updateChartWithData(data) {
        if (!chart) return;

        // Update chart data
        chart.data.labels = data.time.slice(-maxPoints);
        
        // Update temperature data (T1-T8)
        for (var i = 0; i < 8; i++) {
            chart.data.datasets[i].data = data.series[i].slice(-maxPoints);
        }
        
        // Update heater data (indices 8-9)
        if (data.series[8]) chart.data.datasets[8].data = data.series[8].slice(-maxPoints);
        if (data.series[9]) chart.data.datasets[9].data = data.series[9].slice(-maxPoints);
        
        // Update target temperature data (index 11)
        if (data.series[11]) {
            chart.data.datasets[10].data = data.series[11].slice(-maxPoints);
            console.log('Target temp data:', data.series[11].slice(-5)); // Debug log
        }
        
        // Update power data (index 10)
        if (data.series[10]) chart.data.datasets[11].data = data.series[10].slice(-maxPoints);
        
        // Auto-scale Y-axis based on current data
        autoScaleYAxis();
        
        chart.update('none');
    }

    function autoScaleYAxis() {
        if (!chart) return;
        
        // Auto-scale temperature axis (left Y-axis)
        var tempValues = [];
        var powerValues = [];
        var visibleTempDatasets = 0;
        var visiblePowerDatasets = 0;
        
        for (var i = 0; i < chart.data.datasets.length; i++) {
            var dataset = chart.data.datasets[i];
            var meta = chart.getDatasetMeta(i);
            
            // Only include data from visible datasets
            if (!meta.hidden && !dataset.hidden) {
                for (var j = 0; j < dataset.data.length; j++) {
                    if (dataset.data[j] !== null && dataset.data[j] !== undefined && !isNaN(dataset.data[j])) {
                        // Check if this is power data (yAxisID: 'y1')
                        if (dataset.yAxisID === 'y1') {
                            powerValues.push(dataset.data[j]);
                            visiblePowerDatasets++;
                        } else {
                            tempValues.push(dataset.data[j]);
                            visibleTempDatasets++;
                        }
                    }
                }
            }
        }
        
        // Auto-scale temperature axis (left)
        if (tempValues.length > 0 && visibleTempDatasets > 0) {
            var tempMin = Math.min(...tempValues);
            var tempMax = Math.max(...tempValues);
            var tempRange = tempMax - tempMin;
            
            var tempPadding = Math.max(tempRange * 0.15, 5);
            var newTempMin = tempMin - tempPadding;
            var newTempMax = tempMax + tempPadding;
            
            if (newTempMax - newTempMin < 10) {
                var center = (newTempMin + newTempMax) / 2;
                newTempMin = center - 5;
                newTempMax = center + 5;
            }
            
            chart.options.scales.y.min = newTempMin;
            chart.options.scales.y.max = newTempMax;
            
            console.log('Auto-scaled temperature axis to:', newTempMin.toFixed(1), 'to', newTempMax.toFixed(1), '°C');
        }
        
        // Auto-scale power axis (right)
        if (powerValues.length > 0 && visiblePowerDatasets > 0) {
            var powerMin = Math.min(...powerValues);
            var powerMax = Math.max(...powerValues);
            var powerRange = powerMax - powerMin;
            
            var powerPadding = Math.max(powerRange * 0.15, 5);
            var newPowerMin = Math.max(powerMin - powerPadding, 0); // Power can't be negative
            var newPowerMax = powerMax + powerPadding;
            
            if (newPowerMax - newPowerMin < 10) {
                var center = (newPowerMin + newPowerMax) / 2;
                newPowerMin = Math.max(center - 5, 0);
                newPowerMax = center + 5;
            }
            
            chart.options.scales.y1.min = newPowerMin;
            chart.options.scales.y1.max = newPowerMax;
            
            console.log('Auto-scaled power axis to:', newPowerMin.toFixed(1), 'to', newPowerMax.toFixed(1), 'W');
        }
        
        // Force chart to update with new scales
        chart.update('none');
    }

    // Fallback: Create some sample data if no parent data is available
    function createSampleData() {
        var t = 0;
        setInterval(function() {
            if (!chart) return;
            
            t += 0.25;
            chart.data.labels.push(t.toFixed(1));
            
            // Add sample temperature data
            for (var i = 0; i < 8; i++) {
                var temp = 25 + Math.sin(t + i) * 2 + (Math.random() - 0.5) * 0.5;
                chart.data.datasets[i].data.push(temp);
            }
            
            // Add sample heater data
            chart.data.datasets[8].data.push(30 + Math.sin(t) * 5);
            chart.data.datasets[9].data.push(28 + Math.cos(t) * 3);
            
            // Add sample power data
            chart.data.datasets[10].data.push(50 + Math.sin(t * 0.5) * 10);
            
            // Keep only last maxPoints
            if (chart.data.labels.length > maxPoints) {
                chart.data.labels.shift();
                for (var j = 0; j < chart.data.datasets.length; j++) {
                    chart.data.datasets[j].data.shift();
                }
            }
            
            chart.update('none');
        }, 250);
    }

    // Don't create sample data - wait for real data from main app
    // The chart will show empty until real data is received
})();