const { execFile } = require('child_process');

const PRESET_APPS = {
  slack: {
    id: 'slack',
    label: 'Slack',
    description: 'Desktop app',
    match: (info) => info.bundleId === 'com.tinyspeck.slackmacgap' || info.appName === 'Slack',
  },
  gmail: {
    id: 'gmail',
    label: 'Gmail',
    description: 'mail.google.com',
    matchUrl: (url) => url.includes('mail.google.com'),
    matchTitle: (title) => /gmail/i.test(title),
  },
  notion: {
    id: 'notion',
    label: 'Notion',
    description: 'Desktop or browser',
    match: (info) => info.bundleId === 'notion.id' || info.appName === 'Notion',
    matchUrl: (url) => url.includes('notion.so'),
    matchTitle: (title) => /notion/i.test(title),
  },
  jira: {
    id: 'jira',
    label: 'Jira',
    description: 'atlassian.net',
    matchUrl: (url) => url.includes('atlassian.net'),
    matchTitle: (title) => /jira/i.test(title),
  },
  github: {
    id: 'github',
    label: 'GitHub',
    description: 'github.com',
    matchUrl: (url) => url.includes('github.com'),
    matchTitle: (title) => /github/i.test(title),
  },
};

const BROWSER_BUNDLE_IDS = new Set([
  'com.google.Chrome',
  'com.apple.Safari',
]);

/**
 * Get the current tab URL from Chrome or Safari using AppleScript.
 * Only call when the browser is already the frontmost app — AppleScript
 * would launch the browser otherwise (Pitfall 2).
 */
function getBrowserTabUrl(bundleId) {
  return new Promise((resolve) => {
    let script;

    if (bundleId === 'com.google.Chrome') {
      script = 'tell application "Google Chrome" to get URL of active tab of front window';
    } else if (bundleId === 'com.apple.Safari') {
      script = 'tell application "Safari" to get URL of current tab of front window';
    } else {
      resolve('');
      return;
    }

    execFile('osascript', ['-e', script], { timeout: 1000 }, (error, stdout) => {
      if (error) {
        resolve('');
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}

/**
 * Determine whether the capture overlay should be visible based on
 * the active window info and the user's whitelist.
 *
 * Returns true when any enabled whitelist app matches the foreground window.
 * Returns false when whitelist is empty, has no enabled entries, or no match.
 */
async function shouldShowOverlay(windowInfo, whitelist) {
  if (!windowInfo || !whitelist) return false;

  // Collect enabled app IDs
  const enabledIds = Object.keys(whitelist).filter((id) => whitelist[id] && PRESET_APPS[id]);
  if (enabledIds.length === 0) return false;

  const isBrowser = BROWSER_BUNDLE_IDS.has(windowInfo.bundleId);

  // 1. Check native-app matchers first
  for (const id of enabledIds) {
    const preset = PRESET_APPS[id];
    if (preset.match && preset.match(windowInfo)) {
      return true;
    }
  }

  // 2. If active window is a browser, try URL matching then title fallback
  if (isBrowser) {
    const url = await getBrowserTabUrl(windowInfo.bundleId);

    if (url) {
      for (const id of enabledIds) {
        const preset = PRESET_APPS[id];
        if (preset.matchUrl && preset.matchUrl(url)) {
          return true;
        }
      }
    }

    // URL extraction returned empty — fall back to title matching
    if (!url) {
      for (const id of enabledIds) {
        const preset = PRESET_APPS[id];
        if (preset.matchTitle && preset.matchTitle(windowInfo.windowTitle || '')) {
          return true;
        }
      }
    }

    return false;
  }

  // 3. Non-browser window — check title matchers (e.g. Notion desktop)
  for (const id of enabledIds) {
    const preset = PRESET_APPS[id];
    if (preset.matchTitle && preset.matchTitle(windowInfo.windowTitle || '')) {
      return true;
    }
  }

  return false;
}

module.exports = { PRESET_APPS, shouldShowOverlay, getBrowserTabUrl };
