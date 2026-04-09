const spawn = require('cross-spawn');
const path = require('path');

const MOSAIC_PATH = path.join(__dirname, 'MOSAIC');

/**
 * Runs the MOSAIC prediction script.
 * This assumes the MOSAIC repo is cloned into the root directory.
 * 
 * @param {string[]} args Arguments to pass to the prediction script.
 * @returns {Promise<string>} Output from the script.
 */
function runMosaicPrediction(args = []) {
  return new Promise((resolve, reject) => {
    // Pointing to the bash execution script mentioned in the MOSAIC structure
    const scriptPath = path.join(MOSAIC_PATH, 'PredictionUtils', 'run_prediction.sh');
    
    // Spawn the process
    const child = spawn('bash', [scriptPath, ...args], {
      cwd: path.join(MOSAIC_PATH, 'PredictionUtils'), // Set CWD to where the script expects to be
      env: process.env // Inherit environment variables (like PATH for python)
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`MOSAIC process exited with code ${code}\nStderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

module.exports = { runMosaicPrediction };