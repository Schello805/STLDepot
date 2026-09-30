import express from 'express';
import { db, DATA_DIR, WATCH_DIR, MODELS_DIR } from '../db.js';
import { scanDirectory } from '../scanner.js';
import fs from 'fs';
import { execSync } from 'child_process';

const router = express.Router();

function getGitRevision() {
  try {
    const rev = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    let count = '';
    try {
      count = execSync('git rev-list --count HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
    return count ? `r${count}.${rev}` : `r.${rev}`;
  } catch (e) {
    return 'rev-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-b1';
  }
}

// GitHub Update Cache
let updateCache = {
  checkedAt: 0,
  updateAvailable: false,
  localRevision: null,
  remoteRevision: null,
  remoteCommitUrl: null,
  commitMessage: ''
};

async function checkGitUpdate() {
  const now = Date.now();
  // Cache for 2 minutes to respect rate limits
  if (now - updateCache.checkedAt < 120000 && updateCache.checkedAt > 0) {
    return updateCache;
  }

  try {
    let localSha = '';
    try {
      localSha = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
    const localShort = localSha ? localSha.slice(0, 7) : '';

    const response = await fetch('https://api.github.com/repos/Schello805/STLDepot/commits/main', {
      headers: { 'User-Agent': 'STL-Storage-Hub-Update-Checker' }
    });

    if (response.ok) {
      const data = await response.json();
      const remoteSha = data.sha || '';
      const remoteShort = remoteSha ? remoteSha.slice(0, 7) : '';
      const isDifferent = Boolean(remoteSha && localSha && remoteSha !== localSha);

      updateCache = {
        checkedAt: now,
        updateAvailable: isDifferent,
        localRevision: localShort,
        remoteRevision: remoteShort,
        remoteCommitUrl: data.html_url || 'https://github.com/Schello805/STLDepot',
        commitMessage: data.commit?.message?.split('\n')[0] || ''
      };
      return updateCache;
    }
  } catch (err) {
    // Graceful fallback
  }

  updateCache.checkedAt = now;
  return updateCache;
}

// GET /api/system/info - Dynamic project metadata, revision, author info & update status
router.get('/info', async (req, res) => {
  try {
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM project_files').get().count;
    const totalSize = db.prepare('SELECT SUM(file_size) as size FROM project_files').get().size || 0;

    const revision = getGitRevision();
    const updateInfo = await checkGitUpdate();

    res.json({
      success: true,
      app_name: 'STL-Storage Hub',
      version: '1.0.0',
      revision: revision,
      update_info: updateInfo,
      author: 'Michael Schellenberger',
      license: 'CC BY-NC 4.0 (Creative Commons Non-Commercial)',
      github_repo: process.env.GITHUB_REPO_URL || 'https://github.com/Schello805/STLDepot',
      stats: {
        total_projects: projectCount,
        total_files: fileCount,
        total_storage_bytes: totalSize,
        storage_formatted: (totalSize / (1024 * 1024)).toFixed(2) + ' MB'
      },
      watch_dir: WATCH_DIR,
      models_dir: MODELS_DIR
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/system/check-update - Force manual update check
router.get('/check-update', async (req, res) => {
  try {
    updateCache.checkedAt = 0; // invalidate cache
    const updateInfo = await checkGitUpdate();
    res.json({ success: true, update_info: updateInfo, revision: getGitRevision() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/pull-update - Pull latest changes from git origin
router.post('/pull-update', (req, res) => {
  try {
    const output = execSync('git pull origin main', { encoding: 'utf8', timeout: 30000 });
    updateCache.checkedAt = 0;
    const newRev = getGitRevision();
    res.json({ success: true, message: 'Update erfolgreich eingespielt!', output, revision: newRev });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/scan - Manually trigger background folder scan with duplicate handling
router.post('/scan', (req, res) => {
  try {
    const customPath = req.body.path || WATCH_DIR;
    const preserveStructure = req.body.preserveStructure !== false; // default true
    const duplicateAction = req.body.duplicateAction || 'skip'; // 'skip' | 'overwrite'
    const result = scanDirectory(customPath, preserveStructure, duplicateAction);
    res.json({
      success: true,
      message: `Scan abgeschlossen: ${result.added} neue Modelle importiert, ${result.skipped || 0} Duplikate übersprungen, ${result.overwritten || 0} aktualisiert.`,
      added: result.added,
      skipped: result.skipped || 0,
      overwritten: result.overwritten || 0,
      errors: result.errors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/open-folder - Opens folder in Finder / File Explorer
router.post('/open-folder', (req, res) => {
  try {
    const folderPath = req.body.path || WATCH_DIR;
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    let command = '';
    const platform = process.platform;
    if (platform === 'darwin') {
      command = `open "${folderPath}"`;
    } else if (platform === 'win32') {
      command = `explorer "${folderPath.replace(/\//g, '\\')}"`;
    } else {
      command = `xdg-open "${folderPath}"`;
    }

    execSync(command);
    res.json({ success: true, message: 'Ordner im Dateimanager geöffnet.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
