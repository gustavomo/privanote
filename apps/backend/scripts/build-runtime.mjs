import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const distRoot = path.join(backendRoot, 'dist');

const runtimeEntry = `const fs = require('fs');
const path = require('path');

function resolveRuntimeEntry() {
  const resourcesPath = process.resourcesPath || process.env.PRIVANOTE_RESOURCES_PATH;
  const candidates = [
    resourcesPath
      ? path.join(resourcesPath, 'app.asar', 'node_modules', '@privanote', 'backend', 'src', 'index.js')
      : null,
    resourcesPath
      ? path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@privanote', 'backend', 'src', 'index.js')
      : null,
    path.resolve(__dirname, '..', 'src', 'index.js'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate the packaged backend runtime.');
}

const { startServer } = require(resolveRuntimeEntry());

startServer().catch((error) => {
  process.stderr.write(\`\${error.stack || error.message}\\n\`);
  process.exit(1);
});
`;

const runtimePackageJson = {
  name: '@privanote/backend-runtime',
  version: '0.1.0',
  private: true,
  main: 'index.js',
};

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });
fs.writeFileSync(path.join(distRoot, 'index.js'), runtimeEntry);
fs.writeFileSync(path.join(distRoot, 'package.json'), `${JSON.stringify(runtimePackageJson, null, 2)}\n`);
