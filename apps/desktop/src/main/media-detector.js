const { execFile } = require('child_process');
const path = require('path');

const MEDIA_DETECTOR_PATH = path.join(__dirname, 'native', 'media_detector');
const TIMEOUT_MS = 3000;

// Grace period: keep "active" state sticky for this many ms after last positive detection.
// Google Meet and similar apps toggle mic on/off with voice activity detection,
// causing rapid flicker without a grace window.
const GRACE_MS = 8000;

let lastActiveTime = 0;
let lastActiveResult = null;

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
          resolve(_applyGrace({ micActive: false, cameraActive: false, active: false }));
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          const active = !!(result.micActive || result.cameraActive);
          const enriched = { ...result, active };
          if (active) {
            lastActiveTime = Date.now();
            lastActiveResult = enriched;
          }
          resolve(_applyGrace(enriched));
        } catch {
          resolve(_applyGrace({ micActive: false, cameraActive: false, active: false }));
        }
      }
    );
  });
}

function _applyGrace(current) {
  if (current.active) return current;
  // Within grace period — return last known active result
  if (lastActiveResult && (Date.now() - lastActiveTime) < GRACE_MS) {
    return lastActiveResult;
  }
  // Grace expired — clear cache
  lastActiveResult = null;
  return current;
}

module.exports = { detectActiveMedia };
