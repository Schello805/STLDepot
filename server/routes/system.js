import express from 'express';
import { db, DATA_DIR, WATCH_DIR, MODELS_DIR } from '../db.js';
import { scanDirectory } from '../scanner.js';
import fs from 'fs';
import { execSync } from 'child_process';

const router = express.Router();

let cachedGitRevision = null;

function getGitRevision() {
  if (cachedGitRevision) return cachedGitRevision;

  let result = null;
  try {
    const rev = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    let count = '';
    try {
      count = execSync('git rev-list --count HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
    if (count && rev) result = `${count}.${rev}`;
    else if (rev) result = rev;
  } catch (e) {}

  if (!result) {
    // Fallback to pre-generated version.json (essential for Docker and standalone bundles)
    try {
      const versionFile = new URL('../version.json', import.meta.url);
      if (fs.existsSync(versionFile)) {
        const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        if (parsed.revision) result = parsed.revision;
      }
    } catch {}
  }

  if (!result) {
    result = '1.0.' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  cachedGitRevision = result;
  return result;
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
      headers: { 'User-Agent': 'STL-Storage-Hub-Update-Checker' },
      signal: AbortSignal.timeout(2000) // max 2s timeout to prevent page hangs
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

// GET /api/system/info - Dynamic project metadata, revision, author info & update status (instant < 2ms)
router.get('/info', (req, res) => {
  try {
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM project_files').get().count;
    const totalSize = db.prepare('SELECT SUM(file_size) as size FROM project_files').get().size || 0;

    const revision = getGitRevision();

    // Trigger update check in background without blocking this response
    if (Date.now() - updateCache.checkedAt > 120000) {
      checkGitUpdate().catch(() => {});
    }

    res.json({
      success: true,
      app_name: 'STL-Storage Hub',
      version: '1.0.0',
      revision: revision,
      update_info: updateCache,
      author: 'Michael Schellenberger',
      license: 'CC BY-NC 4.0 (Creative Commons Non-Commercial)',
      github_repo: process.env.GITHUB_REPO_URL || 'https://github.com/Schello805/STLDepot',
      stats: {
        total_projects: projectCount,
        total_files: fileCount,
        total_storage_bytes: totalSize,
        storage_formatted: totalSize >= 1024 * 1024 * 1024
          ? (totalSize / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',') + ' GB'
          : (totalSize / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB'
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

// POST /api/system/pull-update - Pull latest changes without overwriting local work
router.post('/pull-update', (req, res) => {
  try {
    const localChanges = execSync('git status --porcelain', {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();

    if (localChanges) {
      return res.status(409).json({
        success: false,
        error: 'Lokale Änderungen gefunden. Update abgebrochen, damit keine Dateien überschrieben werden.'
      });
    }

    const output = execSync('git pull --ff-only origin main', {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    updateCache.checkedAt = 0;
    const newRev = getGitRevision();
    res.json({
      success: true,
      message: 'Quellcode aktualisiert. Falls Abhängigkeiten geändert wurden, führe „stldepot update“ aus.',
      output,
      revision: newRev
    });
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

// GET /api/system/settings - Retrieve material pricing and configuration
router.get('/settings', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('material_settings');
    let settings = null;
    if (row && row.value) {
      try { settings = JSON.parse(row.value); } catch {}
    }
    if (!settings) {
      settings = {
        materials: [
          { id: 'PLA', name: 'PLA', density: 1.24, price_per_kg: 19.99, color: '#38bdf8' },
          { id: 'PETG', name: 'PETG', density: 1.27, price_per_kg: 21.99, color: '#10b981' },
          { id: 'ABS', name: 'ABS', density: 1.04, price_per_kg: 22.99, color: '#f59e0b' },
          { id: 'ASA', name: 'ASA', density: 1.07, price_per_kg: 24.99, color: '#ef4444' },
          { id: 'TPU', name: 'TPU', density: 1.21, price_per_kg: 29.99, color: '#8b5cf6' }
        ],
        infill_factor: 0.35,
        multicolor_waste_percent: 10,
        currency: '€'
      };
    } else if (typeof settings.multicolor_waste_percent !== 'number') {
      settings.multicolor_waste_percent = 10;
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/system/settings - Save material pricing and configuration
router.put('/settings', (req, res) => {
  try {
    const newSettings = req.body;
    if (!newSettings || !Array.isArray(newSettings.materials)) {
      return res.status(400).json({ success: false, error: 'Ungültiges Einstellungsformat' });
    }

    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run('material_settings', JSON.stringify(newSettings));

    // Update weights of existing projects based on new densities/infill factor
    try {
      const infillFactor = typeof newSettings.infill_factor === 'number' ? newSettings.infill_factor : 0.35;
      const matMap = new Map();
      for (const m of newSettings.materials) {
        matMap.set((m.id || m.name).toUpperCase(), m.density || 1.24);
      }

      const projects = db.prepare('SELECT id, filament_type, volume_cm3 FROM projects WHERE volume_cm3 > 0').all();
      const updateStmt = db.prepare('UPDATE projects SET weight_grams = ? WHERE id = ?');
      for (const p of projects) {
        const density = matMap.get((p.filament_type || 'PLA').toUpperCase()) || 1.24;
        const newWeight = parseFloat((p.volume_cm3 * density * infillFactor).toFixed(1));
        updateStmt.run(newWeight, p.id);
      }
    } catch (e) {
      console.warn('Could not update project weights on settings save:', e.message);
    }

    res.json({ success: true, message: 'Einstellungen erfolgreich gespeichert', settings: newSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/system/backup/json - Export database metadata & settings as clean JSON
router.get('/backup/json', (req, res) => {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    res.attachment(`stldepot-backup-${dateStr}.json`);
    res.setHeader('Content-Type', 'application/json');

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of settingsRows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    const tags = db.prepare('SELECT id, name FROM tags').all();
    const projects = db.prepare('SELECT * FROM projects').all();
    const getFiles = db.prepare('SELECT id, stored_name, original_name, file_size, file_type, volume_cm3, triangle_count FROM project_files WHERE project_id = ?');
    const getTags = db.prepare('SELECT t.name FROM tags t INNER JOIN project_tags pt ON t.id = pt.tag_id WHERE pt.project_id = ?');

    const enrichedProjects = projects.map(p => ({
      ...p,
      files: getFiles.all(p.id),
      tags: getTags.all(p.id).map(t => t.name)
    }));

    const backupData = {
      backupVersion: '1.0',
      exportedAt: new Date().toISOString(),
      app: 'STLDepot',
      settings,
      tags: tags.map(t => t.name),
      projectCount: enrichedProjects.length,
      projects: enrichedProjects
    };

    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    console.error('JSON Backup failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/restore/json - Restore database metadata & settings from JSON
router.post('/restore/json', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const backup = req.body;
    if (!backup || (!Array.isArray(backup.projects) && !backup.settings)) {
      return res.status(400).json({ success: false, error: 'Ungültige Backup-Datei' });
    }

    let restoredSettings = 0;
    let restoredProjects = 0;
    let restoredTags = 0;

    const transaction = db.transaction(() => {
      // 1. Restore Settings
      if (backup.settings && typeof backup.settings === 'object') {
        const insertSetting = db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        for (const [key, val] of Object.entries(backup.settings)) {
          insertSetting.run(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
          restoredSettings++;
        }
      }

      // 2. Restore Tags
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
      if (Array.isArray(backup.tags)) {
        for (const tagName of backup.tags) {
          if (tagName && typeof tagName === 'string') {
            insertTag.run(tagName.trim());
            restoredTags++;
          }
        }
      }

      // 3. Restore Projects metadata
      if (Array.isArray(backup.projects)) {
        const updateProject = db.prepare(`
          UPDATE projects SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            category = COALESCE(?, category),
            author = COALESCE(?, author),
            filament_type = COALESCE(?, filament_type),
            filament_color = COALESCE(?, filament_color),
            infill_percentage = COALESCE(?, infill_percentage),
            print_time_minutes = COALESCE(?, print_time_minutes),
            nozzle_size = COALESCE(?, nozzle_size),
            supports_needed = COALESCE(?, supports_needed),
            is_favorite = COALESCE(?, is_favorite),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

        const insertProject = db.prepare(`
          INSERT OR IGNORE INTO projects (
            id, title, description, category, author, filament_type, filament_color,
            infill_percentage, print_time_minutes, nozzle_size, supports_needed, is_favorite, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertProjectTag = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');

        for (const p of backup.projects) {
          if (!p.id || !p.title) continue;

          // Try updating existing project
          const result = updateProject.run(
            p.title, p.description, p.category, p.author, p.filament_type, p.filament_color,
            p.infill_percentage, p.print_time_minutes, p.nozzle_size, p.supports_needed, p.is_favorite, p.notes,
            p.id
          );

          if (result.changes === 0) {
            // Insert new metadata
            insertProject.run(
              p.id, p.title, p.description || '', p.category || 'Allgemein', p.author || '',
              p.filament_type || 'PLA', p.filament_color || '#38bdf8',
              p.infill_percentage || 15, p.print_time_minutes || null, p.nozzle_size || 0.4,
              p.supports_needed ? 1 : 0, p.is_favorite ? 1 : 0, p.notes || ''
            );
          }

          // Restore Tags
          if (Array.isArray(p.tags)) {
            for (const t of p.tags) {
              insertTag.run(t);
              const tagRow = getTagId.get(t);
              if (tagRow) {
                insertProjectTag.run(p.id, tagRow.id);
              }
            }
          }

          restoredProjects++;
        }
      }
    });

    transaction();

    res.json({
      success: true,
      message: `Backup erfolgreich wiederhergestellt! (${restoredProjects} Modelle, ${restoredSettings} Einstellungen synchronisiert)`,
      stats: { restoredProjects, restoredSettings, restoredTags }
    });
  } catch (err) {
    console.error('JSON Restore failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/recalculate-weights - Calculate/refresh weights for all models
router.post('/recalculate-weights', async (req, res) => {
  try {
    const { calculateFileGeometry } = await import('../utils/geometryCalculator.js');

    // Get current material settings
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('material_settings');
    let settings = { materials: [{ id: 'PLA', density: 1.24 }], infill_factor: 0.35 };
    if (row && row.value) {
      try { settings = JSON.parse(row.value); } catch {}
    }

    const matMap = new Map();
    for (const m of settings.materials || []) {
      matMap.set((m.id || m.name).toUpperCase(), m.density || 1.24);
    }
    const infillFactor = typeof settings.infill_factor === 'number' ? settings.infill_factor : 0.35;

    const projects = db.prepare('SELECT id, filament_type, volume_cm3, weight_grams FROM projects').all();
    let updatedCount = 0;

    for (const proj of projects) {
      const files = db.prepare('SELECT * FROM project_files WHERE project_id = ?').all(proj.id);
      let totalVolume = 0;
      let totalWeight = 0;

      const density = matMap.get((proj.filament_type || 'PLA').toUpperCase()) || 1.24;

      for (const f of files) {
        if (!f.file_path || !fs.existsSync(f.file_path)) continue;
        const geo = await calculateFileGeometry(f.file_path, proj.filament_type || 'PLA', density, infillFactor);
        
        if (geo.volumeCm3 > 0 || geo.weightGrams > 0) {
          totalVolume += geo.volumeCm3;
          totalWeight += geo.weightGrams;

          db.prepare(`
            UPDATE project_files 
            SET volume_cm3 = ?, triangle_count = ? 
            WHERE id = ?
          `).run(geo.volumeCm3, geo.triangles, f.id);
        }
      }

      if (totalVolume > 0 || totalWeight > 0) {
        db.prepare(`
          UPDATE projects 
          SET volume_cm3 = ?, weight_grams = ? 
          WHERE id = ?
        `).run(parseFloat(totalVolume.toFixed(2)), parseFloat(totalWeight.toFixed(1)), proj.id);
        updatedCount++;
      }
    }

    res.json({ success: true, message: `Berechnung abgeschlossen für ${updatedCount} Modelle.`, updated: updatedCount });
  } catch (err) {
    console.error('Error recalculating weights:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
