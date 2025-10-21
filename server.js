// Simple web server for the Heat Transfer App
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files
app.use(express.static('.'));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Mock API endpoints for serial communication
app.get('/api/ports', (req, res) => {
    // Mock available ports
    res.json([
        { path: 'COM1', manufacturer: 'Mock Device 1', serialNumber: 'SN001' },
        { path: 'COM3', manufacturer: 'Mock Device 2', serialNumber: 'SN002' }
    ]);
});

app.post('/api/connect/:port', (req, res) => {
    // Mock connection
    setTimeout(() => {
        res.json({ success: true, message: `Connected to ${req.params.port}` });
    }, 1000);
});

app.post('/api/disconnect', (req, res) => {
    // Mock disconnection
    res.json({ success: true, message: 'Disconnected' });
});

app.post('/api/fan-speed', (req, res) => {
    // Mock fan speed setting
    res.json({ success: true, message: 'Fan speed updated' });
});

app.post('/api/heater-temp', (req, res) => {
    // Mock heater temperature setting
    res.json({ success: true, message: 'Heater temperature updated' });
});

app.post('/api/heater-mode', (req, res) => {
    // Mock heater mode setting
    res.json({ success: true, message: 'Heater mode updated' });
});

app.listen(port, () => {
    console.log(`Heat Transfer Web App running at http://localhost:${port}`);
    console.log('Open this URL in your Android tablet browser!');
});

