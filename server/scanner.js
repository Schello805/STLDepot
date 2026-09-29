import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import crypto from 'crypto';
import { db, MODELS_DIR, WATCH_DIR } from './db.js';

let watcher = null;

export function scanDirectory(targetDir = WATCH_DIR) {
  if (!fs.existsSync(targetDir)) return { added: 0, errors: [] };

  let addedCount = 0;
  const errors = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.stl' || ext === '.3mf') {
          try {
            const added = importSingleFileFromDisk(fullPath, entry.name, ext);
            if (added) addedCount++;
          } catch (err) {
            errors.push({ file: entry.name, error: err.message });
          }
        }
      }
    }
  }

  walk(targetDir);
  return { added: addedCount, errors };
}

function importSingleFileFromDisk(sourcePath, originalName, ext) {
  const stats = fs.statSync(sourcePath);
  const baseName = path.basename(originalName, ext);

  // Check if file is already registered by original name and size
  const existingFile = db.prepare(
    'SELECT id, project_id FROM project_files WHERE original_name = ? AND file_size = ?'
  ).get(originalName, stats.size);

  if (existingFile) {
    return false; // Already imported
  }

  const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');
  const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
  const storedName = `${fileId}${ext}`;
  const destPath = path.join(MODELS_DIR, storedName);

  // Copy file to storage directory
  fs.copyFileSync(sourcePath, destPath);

  // Insert Project
  const title = baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  db.prepare(`
    INSERT INTO projects (
      id, title, description, category, author, license,
      filament_type, filament_color, infill_percentage, print_time_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    title,
    `Automatisch importiert aus: ${path.basename(path.dirname(sourcePath))}`,
    'Importiert',
    'Unbekannt',
    'CC BY-NC 4.0',
    'PLA',
    '#38bdf8',
    15,
    0
  );

  // Insert File
  db.prepare(`
    INSERT INTO project_files (
      id, project_id, original_name, stored_name, file_path, file_size, file_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    fileId,
    projectId,
    originalName,
    storedName,
    destPath,
    stats.size,
    ext.replace('.', '')
  );

  console.log(`[Scanner] Auto-imported 3D model: ${originalName} (ID: ${projectId})`);
  return true;
}

export function startWatchService() {
  if (watcher) return;
  console.log('[Scanner] Starting watch service on directory:', WATCH_DIR);

  watcher = chokidar.watch(WATCH_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher.on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.stl' || ext === '.3mf') {
      try {
        importSingleFileFromDisk(filePath, path.basename(filePath), ext);
      } catch (e) {
        console.error('[Scanner] Error auto-importing file:', filePath, e);
      }
    }
  });
}
