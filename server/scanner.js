import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import crypto from 'crypto';
import { db, MODELS_DIR, WATCH_DIR } from './db.js';
import { updateProjectGeometry } from './utils/geometryCalculator.js';

let watcher = null;

export function scanDirectory(targetDir = WATCH_DIR, preserveStructure = true, duplicateAction = 'skip') {
  if (!fs.existsSync(targetDir)) return { added: 0, skipped: 0, overwritten: 0, errors: [] };

  let addedCount = 0;
  let skippedCount = 0;
  let overwrittenCount = 0;
  const errors = [];

  const handleResult = (res, filename) => {
    if (res === 'added') addedCount++;
    else if (res === 'skipped') skippedCount++;
    else if (res === 'overwritten') overwrittenCount++;
  };

  if (preserveStructure) {
    // Group files by their immediate parent subfolder
    const folderGroups = new Map(); // groupKey -> [files]

    function collectFiles(currentDir) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.stl' || ext === '.3mf') {
            const relDir = path.relative(targetDir, currentDir);
            const groupKey = relDir === '' ? '__root__' : relDir;
            if (!folderGroups.has(groupKey)) {
              folderGroups.set(groupKey, []);
            }
            folderGroups.get(groupKey).push({ fullPath, name: entry.name, ext });
          }
        }
      }
    }

    collectFiles(targetDir);

    for (const [groupKey, fileList] of folderGroups.entries()) {
      if (groupKey === '__root__') {
        for (const f of fileList) {
          try {
            const res = importSingleFileFromDisk(f.fullPath, f.name, f.ext, duplicateAction);
            handleResult(res, f.name);
          } catch (err) {
            errors.push({ file: f.name, error: err.message });
          }
        }
      } else {
        try {
          const folderTitle = path.basename(groupKey).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const res = importMultiPartProjectFromDisk(fileList, folderTitle, groupKey, duplicateAction);
          handleResult(res, groupKey);
        } catch (err) {
          errors.push({ file: groupKey, error: err.message });
        }
      }
    }
  } else {
    // Flat: Every STL/3MF becomes an individual project in the catalog
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
              const res = importSingleFileFromDisk(fullPath, entry.name, ext, duplicateAction);
              handleResult(res, entry.name);
            } catch (err) {
              errors.push({ file: entry.name, error: err.message });
            }
          }
        }
      }
    }
    walk(targetDir);
  }

  return { added: addedCount, skipped: skippedCount, overwritten: overwrittenCount, errors };
}

function importMultiPartProjectFromDisk(fileList, folderTitle, groupKey, duplicateAction = 'skip') {
  if (fileList.length === 0) return 'skipped';

  // Check if project with same title already exists
  const existingProject = db.prepare('SELECT id FROM projects WHERE LOWER(title) = LOWER(?)').get(folderTitle);

  if (existingProject) {
    if (duplicateAction === 'skip') {
      return 'skipped';
    }

    if (duplicateAction === 'overwrite') {
      const projectId = existingProject.id;

      // Delete old files from disk
      const oldFiles = db.prepare('SELECT file_path FROM project_files WHERE project_id = ?').all(projectId);
      for (const of of oldFiles) {
        if (of.file_path && fs.existsSync(of.file_path)) {
          try { fs.unlinkSync(of.file_path); } catch {}
        }
      }
      db.prepare('DELETE FROM project_files WHERE project_id = ?').run(projectId);

      // Copy new files
      for (const f of fileList) {
        const stats = fs.statSync(f.fullPath);
        const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
        const storedName = `${fileId}${f.ext}`;
        const destPath = path.join(MODELS_DIR, storedName);

        fs.copyFileSync(f.fullPath, destPath);

        db.prepare(`
          INSERT INTO project_files (
            id, project_id, original_name, stored_name, file_path, file_size, file_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          fileId,
          projectId,
          f.name,
          storedName,
          destPath,
          stats.size,
          f.ext.replace('.', '')
        );
      }

      db.prepare(`UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(projectId);
      updateProjectGeometry(projectId).catch(() => {});
      return 'overwritten';
    }
  }

  const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');
  
  db.prepare(`
    INSERT INTO projects (
      id, title, description, category, author, license,
      filament_type, filament_color, infill_percentage, print_time_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    folderTitle,
    `Baugruppe aus Ordner "${groupKey}" mit ${fileList.length} Teilen`,
    'Baugruppen',
    'Michael Schellenberger',
    'CC BY-NC 4.0',
    'PLA',
    '#38bdf8',
    15,
    0
  );

  for (const f of fileList) {
    const stats = fs.statSync(f.fullPath);
    const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
    const storedName = `${fileId}${f.ext}`;
    const destPath = path.join(MODELS_DIR, storedName);

    fs.copyFileSync(f.fullPath, destPath);

    db.prepare(`
      INSERT INTO project_files (
        id, project_id, original_name, stored_name, file_path, file_size, file_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      projectId,
      f.name,
      storedName,
      destPath,
      stats.size,
      f.ext.replace('.', '')
    );
  }

  updateProjectGeometry(projectId).catch(() => {});
  console.log(`[Scanner] Auto-imported multi-part project "${folderTitle}" with ${fileList.length} files`);
  return 'added';
}

function importSingleFileFromDisk(sourcePath, originalName, ext, duplicateAction = 'skip') {
  const stats = fs.statSync(sourcePath);
  const baseName = path.basename(originalName, ext);
  const title = baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Check if file is already registered by original name and size or project title
  let existingProject = db.prepare('SELECT id FROM projects WHERE LOWER(title) = LOWER(?)').get(title);
  if (!existingProject) {
    const existingFile = db.prepare(
      'SELECT project_id FROM project_files WHERE original_name = ? AND file_size = ?'
    ).get(originalName, stats.size);
    if (existingFile) {
      existingProject = { id: existingFile.project_id };
    }
  }

  if (existingProject) {
    if (duplicateAction === 'skip') {
      return 'skipped';
    }

    if (duplicateAction === 'overwrite') {
      const projectId = existingProject.id;

      // Delete old files from disk
      const oldFiles = db.prepare('SELECT file_path FROM project_files WHERE project_id = ?').all(projectId);
      for (const of of oldFiles) {
        if (of.file_path && fs.existsSync(of.file_path)) {
          try { fs.unlinkSync(of.file_path); } catch {}
        }
      }
      db.prepare('DELETE FROM project_files WHERE project_id = ?').run(projectId);

      // Copy fresh file
      const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
      const storedName = `${fileId}${ext}`;
      const destPath = path.join(MODELS_DIR, storedName);

      fs.copyFileSync(sourcePath, destPath);

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

      db.prepare(`UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(projectId);
      updateProjectGeometry(projectId).catch(() => {});
      return 'overwritten';
    }
  }

  const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');
  const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
  const storedName = `${fileId}${ext}`;
  const destPath = path.join(MODELS_DIR, storedName);

  // Copy file to storage directory
  fs.copyFileSync(sourcePath, destPath);

  db.prepare(`
    INSERT INTO projects (
      id, title, description, category, author, license,
      filament_type, filament_color, infill_percentage, print_time_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    title,
    `Automatisch importiert aus: ${path.basename(path.dirname(sourcePath))}`,
    'Deko & Haushalt',
    'Michael Schellenberger',
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

  updateProjectGeometry(projectId).catch(() => {});
  console.log(`[Scanner] Auto-imported 3D model: ${originalName} (ID: ${projectId})`);
  return 'added';
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
        importSingleFileFromDisk(filePath, path.basename(filePath), ext, 'skip');
      } catch (e) {
        console.error('[Scanner] Error auto-importing file:', filePath, e);
      }
    }
  });
}
