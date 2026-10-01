import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

describe('Database & CRUD Cascade Integrity', () => {
  function createTestDB() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Create schema matching server/db.js
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'Allgemein',
        author TEXT,
        thumbnail_url TEXT,
        filament_type TEXT DEFAULT 'PLA',
        filament_color TEXT DEFAULT '#38bdf8',
        infill_percentage INTEGER DEFAULT 15,
        volume_cm3 REAL DEFAULT 0,
        weight_grams REAL DEFAULT 0,
        print_time_minutes INTEGER,
        is_favorite INTEGER DEFAULT 0,
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

  it('enforces foreign_keys and cascades project deletion to project_files and project_tags', () => {
    const db = createTestDB();

    // 1. Insert Project
    const projId = 'proj-123';
    db.prepare(`
      INSERT INTO projects (id, title, category, filament_type) 
      VALUES (?, ?, ?, ?)
    `).run(projId, 'Test Model', 'Deko', 'PLA');

    // 2. Insert File
    const fileId = 'file-456';
    db.prepare(`
      INSERT INTO project_files (id, project_id, filename, original_name, file_path, file_size, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, projId, 'model.stl', 'model.stl', '/data/models/model.stl', 1024, 'stl');

    // 3. Insert Tag and Link
    const tagRes = db.prepare('INSERT INTO tags (name) VALUES (?)').run('DekoTag');
    const tagId = tagRes.lastInsertRowid;
    db.prepare('INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)').run(projId, tagId);

    // Verify insertion
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM projects').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM project_files').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM project_tags').get().count, 1);

    // 4. Delete Project
    db.prepare('DELETE FROM projects WHERE id = ?').run(projId);

    // 5. Verify cascading cleanup
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM projects').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM project_files WHERE project_id = ?').get(projId).count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM project_tags WHERE project_id = ?').get(projId).count, 0);

    // Verify active tag filter query excludes orphan tags without models
    const activeTags = db.prepare(`
      SELECT t.id, t.name, COUNT(pt.project_id) as count
      FROM tags t
      INNER JOIN project_tags pt ON t.id = pt.tag_id
      GROUP BY t.id
      HAVING count > 0
    `).all();

    assert.equal(activeTags.length, 0, 'Orphaned tag should not appear in active tags query');
  });

  it('persists and parses material settings in settings table', () => {
    const db = createTestDB();

    const sampleSettings = {
      materials: [
        { id: 'PLA', name: 'PLA', density: 1.24, price_per_kg: 21.50 },
        { id: 'PETG', name: 'PETG', density: 1.27, price_per_kg: 24.99 }
      ],
      infill_factor: 0.35,
      currency: '€'
    };

    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    `).run('material_settings', JSON.stringify(sampleSettings));

    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('material_settings');
    assert.ok(row);

    const parsed = JSON.parse(row.value);
    assert.equal(parsed.materials.length, 2);
    assert.equal(parsed.materials[0].price_per_kg, 21.50);
    assert.equal(parsed.currency, '€');
  });

  it('updates and renames original_name in project_files table correctly', () => {
    const db = createTestDB();
    const projId = 'proj-rename-1';
    const fileId = 'file-rename-1';

    db.prepare('INSERT INTO projects (id, title) VALUES (?, ?)').run(projId, 'Test Projekt');
    db.prepare(`
      INSERT INTO project_files (id, project_id, filename, original_name, file_path, file_size, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, projId, 'hash123.stl', 'alter_name.stl', '/path/hash123.stl', 1024, 'stl');

    // Rename file
    const updateResult = db.prepare('UPDATE project_files SET original_name = ? WHERE id = ? AND project_id = ?')
      .run('neuer_schöner_name.stl', fileId, projId);
    assert.equal(updateResult.changes, 1);

    const updated = db.prepare('SELECT original_name FROM project_files WHERE id = ?').get(fileId);
    assert.equal(updated.original_name, 'neuer_schöner_name.stl');
  });
});
