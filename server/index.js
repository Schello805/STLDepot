import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB, THUMBNAILS_DIR, MODELS_DIR } from './db.js';
import { startWatchService } from './scanner.js';
import modelsRouter from './routes/models.js';
import systemRouter from './routes/system.js';
import webImportRouter from './routes/webImport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Database & Watcher
initDB();
startWatchService();

// Seed initial sample demo model if empty so user has immediate visual wow effect
import crypto from 'crypto';
import { db } from './db.js';

function seedSampleIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  if (count === 0) {
    const projId = 'proj_demo_calibration_cube';
    const fileId = 'file_demo_cube';
    const fileName = `${fileId}.stl`;
    const filePath = path.join(MODELS_DIR, fileName);

    // Generate a clean ASCII STL calibration cube (20x20x20 mm)
    const cubeSTL = `solid CalibrationCube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 20 20 0
      vertex 20 0 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 20 0
      vertex 20 20 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 20
      vertex 20 0 20
      vertex 20 20 20
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 20
      vertex 20 20 20
      vertex 0 20 20
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 20 0 0
      vertex 20 0 20
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 20 0 20
      vertex 0 0 20
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 20 0
      vertex 20 20 20
      vertex 20 20 0
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 20 0
      vertex 0 20 20
      vertex 20 20 20
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 0 20
      vertex 0 20 20
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 20 20
      vertex 0 20 0
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 20 0 0
      vertex 20 20 0
      vertex 20 20 20
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 20 0 0
      vertex 20 20 20
      vertex 20 0 20
    endloop
  endfacet
endsolid CalibrationCube`;

    fs.writeFileSync(filePath, cubeSTL);

    db.prepare(`
      INSERT INTO projects (
        id, title, description, category, author, license,
        filament_type, filament_color, infill_percentage, print_time_minutes,
        nozzle_size, supports_needed, is_favorite, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projId,
      '20mm XYZ Calibration Cube',
      'Klassischer 20mm Kalibrierungs-Würfel zum Überprüfen von Massgenauigkeit, Schichthaftung und Ghosting auf deinem 3D-Drucker.',
      'Kalibrierung & Tools',
      'Michael Schellenberger',
      'CC BY-NC 4.0',
      'PLA',
      '#06b6d4',
      20,
      35,
      0.4,
      0,
      1,
      'Gedruckt mit 0.20mm Layer Height, 20% Gyroid Infill, 210°C Nozzle / 60°C Bed.'
    );

    db.prepare(`
      INSERT INTO project_files (
        id, project_id, original_name, stored_name, file_path, file_size, file_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      projId,
      'xyz_calibration_cube_20mm.stl',
      fileName,
      filePath,
      Buffer.byteLength(cubeSTL),
      'stl'
    );

    // Insert Tags
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run('Kalibrierung');
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run('Test');
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run('Standard');
    const tag1 = db.prepare('SELECT id FROM tags WHERE name = ?').get('Kalibrierung');
    const tag2 = db.prepare('SELECT id FROM tags WHERE name = ?').get('Test');
    if (tag1) db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)').run(projId, tag1.id);
    if (tag2) db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)').run(projId, tag2.id);

    console.log('[Seed] Sample 3D Model created for initial demo');
  }
}

seedSampleIfEmpty();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Thumbnails with 1-day browser cache
app.use('/api/thumbnails', express.static(THUMBNAILS_DIR, { maxAge: '1d' }));

// API Routes
app.use('/api/models', modelsRouter);
app.use('/api/system', systemRouter);
app.use('/api/web-import', webImportRouter);

// Serve Client in production with browser caching (assets 1y, index.html no-cache)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  app.use((req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const envPort = parseInt(process.env.PORT, 10);
const portsToListen = new Set([
  80,
  3001,
  3000,
  isNaN(envPort) ? 80 : envPort
]);

console.log(`===========================================`);
console.log(`🚀 STL-Storage Server startet...`);
console.log(`📦 Speichere 3D-Dateien in: ${MODELS_DIR}`);
console.log(`===========================================`);

for (const p of portsToListen) {
  try {
    const s = app.listen(p, '0.0.0.0', () => {
      console.log(`🚀 STL-Storage Server hört auf http://0.0.0.0:${p}`);
    });
    s.on('error', (err) => {
      console.log(`[Port Info] Port ${p} nicht gebunden: ${err.message}`);
    });
  } catch (err) {
    // Ignore
  }
}
