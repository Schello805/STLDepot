import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

try {
  let count = '0';
  let hash = '';
  try {
    count = execSync('git rev-list --count HEAD', { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    hash = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {}

  const versionData = {
    revision: count && hash ? `${count}.${hash}` : `1.${hash || 'init'}`,
    commitCount: parseInt(count, 10) || 0,
    commitHash: hash,
    updatedAt: new Date().toISOString()
  };

  const targetPath = path.join(rootDir, 'server', 'version.json');
  fs.writeFileSync(targetPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`[Revision] Synced server/version.json: ${versionData.revision}`);
} catch (err) {
  console.error('[Revision] Error updating revision:', err);
}
