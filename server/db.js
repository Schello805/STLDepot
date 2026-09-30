import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'stl_storage.db');
const MODELS_DIR = path.join(DATA_DIR, 'models');
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');
const WATCH_DIR = path.join(DATA_DIR, 'watch_import');

// Ensure data directories exist
[DATA_DIR, MODELS_DIR, THUMBNAILS_DIR, WATCH_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database tables
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'Sonstiges',
      author TEXT DEFAULT '',
      license TEXT DEFAULT 'CC BY-NC 4.0',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      thumbnail_url TEXT DEFAULT '',
      filament_type TEXT DEFAULT 'PLA',
      filament_color TEXT DEFAULT '#38bdf8',
      infill_percentage INTEGER DEFAULT 15,
      print_time_minutes INTEGER DEFAULT 0,
      nozzle_size REAL DEFAULT 0.4,
      supports_needed INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      source_url TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL, -- 'stl', '3mf', 'image', 'other'
      dimensions_x REAL DEFAULT 0,
      dimensions_y REAL DEFAULT 0,
      dimensions_z REAL DEFAULT 0,
      volume_cm3 REAL DEFAULT 0,
      vertex_count INTEGER DEFAULT 0,
      triangle_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_tags (
      project_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (project_id, tag_id),
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Ensure volume_cm3 and weight_grams columns exist on projects
  const projectCols = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projectCols.includes('volume_cm3')) {
    db.exec(`ALTER TABLE projects ADD COLUMN volume_cm3 REAL DEFAULT 0`);
  }
  if (!projectCols.includes('weight_grams')) {
    db.exec(`ALTER TABLE projects ADD COLUMN weight_grams REAL DEFAULT 0`);
  }

  // Seed default material settings if not set
  const existingSettings = db.prepare('SELECT value FROM settings WHERE key = ?').get('material_settings');
  if (!existingSettings) {
    const defaultMaterialSettings = {
      materials: [
        { id: 'PLA', name: 'PLA', density: 1.24, price_per_kg: 19.99, color: '#38bdf8' },
        { id: 'PETG', name: 'PETG', density: 1.27, price_per_kg: 21.99, color: '#10b981' },
        { id: 'ABS', name: 'ABS', density: 1.04, price_per_kg: 22.99, color: '#f59e0b' },
        { id: 'ASA', name: 'ASA', density: 1.07, price_per_kg: 24.99, color: '#ef4444' },
        { id: 'TPU', name: 'TPU', density: 1.21, price_per_kg: 29.99, color: '#8b5cf6' }
      ],
      infill_factor: 0.35, // effective density with ~15% infill + 3 perimeters
      currency: '€'
    };
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'material_settings',
      JSON.stringify(defaultMaterialSettings)
    );
  }

  console.log('Database initialized successfully at:', DB_PATH);
}

// Auto-initialize tables so any module or test importing db has all tables ready
initDB();

export { db, DATA_DIR, MODELS_DIR, THUMBNAILS_DIR, WATCH_DIR };
