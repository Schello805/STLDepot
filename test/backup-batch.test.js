import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

describe('JSON Backup/Restore & Batch Download Engine', () => {
  function createTestDB() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'Allgemein',
        author TEXT,
        filament_type TEXT DEFAULT 'PLA',
        filament_color TEXT DEFAULT '#38bdf8',
        infill_percentage INTEGER DEFAULT 15,
        print_time_minutes INTEGER,
        nozzle_size REAL DEFAULT 0.4,
        supports_needed INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        volume_cm3 REAL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_tags (
        project_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (project_id, tag_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    return db;
  }

  it('exports and restores JSON backup structure accurately', () => {
    const db = createTestDB();

    // Insert sample project
    db.prepare(`
      INSERT INTO projects (id, title, category, author, filament_type)
      VALUES (?, ?, ?, ?, ?)
    `).run('p1', 'Original Model', 'Werkstatt', 'MakerMax', 'PETG');

    db.prepare('INSERT INTO tags (name) VALUES (?)').run('TestTag');
    db.prepare('INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)').run('p1', 1);

    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'material_settings',
      JSON.stringify({ currency: '€', materials: [{ id: 'PLA', price_per_kg: 25 }] })
    );

    // Create Backup JSON
    const projects = db.prepare('SELECT * FROM projects').all();
    const tags = db.prepare('SELECT name FROM tags').all().map(t => t.name);
    const settings = { material_settings: JSON.parse(db.prepare('SELECT value FROM settings WHERE key = ?').get('material_settings').value) };

    const backup = {
      backupVersion: '1.0',
      exportedAt: new Date().toISOString(),
      app: 'STLDepot',
      settings,
      tags,
      projects: projects.map(p => ({ ...p, tags }))
    };

    assert.equal(backup.projects.length, 1);
    assert.equal(backup.tags.length, 1);
    assert.equal(backup.settings.material_settings.currency, '€');

    // Restore to clean database
    const cleanDb = createTestDB();
    const insertProject = cleanDb.prepare(`
      INSERT OR REPLACE INTO projects (id, title, category, author, filament_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertTag = cleanDb.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');

    for (const p of backup.projects) {
      insertProject.run(p.id, p.title, p.category, p.author, p.filament_type);
    }
    for (const t of backup.tags) {
      insertTag.run(t);
    }

    const restoredProject = cleanDb.prepare('SELECT * FROM projects WHERE id = ?').get('p1');
    assert.ok(restoredProject);
    assert.equal(restoredProject.title, 'Original Model');
    assert.equal(restoredProject.filament_type, 'PETG');
  });
});
