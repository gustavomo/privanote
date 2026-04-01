const { execFile } = require('child_process');
const path = require('path');

const MEDIA_DETECTOR_PATH = path.join(__dirname, 'native', 'media_detector');
const TIMEOUT_MS = 3000;

/**
 * Detect active microphone/camera usage by external apps.
 * @param {number} [selfPid] - PID to exclude (defaults to process.pid)
 * @returns {Promise<{micActive: boolean, cameraActive: boolean, active: boolean, appName?: string, bundleId?: string, pid?: number}>}
 */
function detectActiveMedia(selfPid) {
  return new Promise((resolve) => {
    execFile(
      MEDIA_DETECTOR_PATH,
      [String(selfPid || process.pid)],
      { timeout: TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          resolve({ micActive: false, cameraActive: false, active: false });
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          resolve({
            ...result,
            active: !!(result.micActive || result.cameraActive),
          });
        } catch {
          resolve({ micActive: false, cameraActive: false, active: false });
        }
      }
    );
  });
}

module.exports = { detectActiveMedia };
