import express from 'express';
import { db, DATA_DIR, WATCH_DIR, MODELS_DIR } from '../db.js';
import { scanDirectory } from '../scanner.js';
import fs from 'fs';
import { execSync } from 'child_process';

const router = express.Router();

function getGitRevision() {
  try {
    const rev = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return rev.trim();
  } catch (e) {
    return 'rev-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-b1';
  }
}

// GET /api/system/info - Dynamic project metadata, revision, author info
router.get('/info', (req, res) => {
  try {
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM project_files').get().count;
    const totalSize = db.prepare('SELECT SUM(file_size) as size FROM project_files').get().size || 0;

    const revision = getGitRevision();

    res.json({
      success: true,
      app_name: 'STL-Storage Hub',
      version: '1.0.0',
      revision: revision,
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

// POST /api/system/scan - Manually trigger background folder scan
router.post('/scan', (req, res) => {
  try {
    const customPath = req.body.path || WATCH_DIR;
    const preserveStructure = req.body.preserveStructure !== false; // default true
    const result = scanDirectory(customPath, preserveStructure);
    res.json({
      success: true,
      message: `Scan abgeschlossen: ${result.added} neue 3D-Modelle importiert.`,
      added: result.added,
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
