const express = require('express');
const path = require('path');
const { runMosaicPrediction } = require('./mosaic_bridge');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve src/js as /js to access app-molview.js
app.use('/js', express.static(path.join(__dirname, 'src/js')));

// API Endpoint to trigger MOSAIC prediction
app.post('/api/predict', async (req, res) => {
    const { args } = req.body;

    if (!args || !Array.isArray(args)) {
        return res.status(400).json({ 
            error: 'Invalid input. "args" must be an array of strings.' 
        });
    }

    try {
        console.log(`Running MOSAIC with args: ${args.join(' ')}`);
        const output = await runMosaicPrediction(args);
        res.json({ success: true, output });
    } catch (error) {
        console.error('MOSAIC execution failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.toString() 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Orbital MOSAIC App listening on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser.`);
});