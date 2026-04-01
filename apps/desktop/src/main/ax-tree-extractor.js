const { execFile } = require('child_process');
const path = require('path');

const AX_WALKER_PATH = path.join(__dirname, 'native', 'ax_walker');
const TIMEOUT_MS = 5000;

function extractTextFromAccessibilityTree(pid) {
  return new Promise((resolve) => {
    if (!pid || pid <= 0) {
      resolve({ texts: [], success: false, method: 'ax-skipped', error: 'No PID' });
      return;
    }

    execFile(AX_WALKER_PATH, [String(pid)], { timeout: TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        resolve({ texts: [], success: false, method: 'ax-failed', error: error.message });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve({
          texts: result.texts || [],
          success: result.success === true,
          method: result.success ? 'accessibility' : 'ax-empty',
          error: result.error || null,
        });
      } catch (parseError) {
        resolve({ texts: [], success: false, method: 'ax-parse-error', error: parseError.message });
      }
    });
  });
}

module.exports = { extractTextFromAccessibilityTree };
