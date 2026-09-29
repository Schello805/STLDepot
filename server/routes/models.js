import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { db, MODELS_DIR, THUMBNAILS_DIR } from '../db.js';
const router = express.Router();

// Multer storage for uploaded models and project images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MODELS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `file_${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2000 * 1024 * 1024 } // 2 GB max batch size
});

// GET /api/models - List models with search, category, tag, and sort filters
router.get('/', (req, res) => {
  try {
    const { search, category, tag, sort = 'newest', favorite } = req.query;

    let query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT t.name) as tags_list,
        COUNT(DISTINCT pf.id) as file_count,
        SUM(CASE WHEN pf.file_type IN ('stl', '3mf') THEN 1 ELSE 0 END) as model_file_count,
        SUM(pf.file_size) as total_file_size
      FROM projects p
      LEFT JOIN project_tags pt ON p.id = pt.project_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      LEFT JOIN project_files pf ON p.id = pf.project_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.notes LIKE ? OR t.name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (category && category !== 'Alle') {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    if (favorite === 'true') {
      query += ` AND p.is_favorite = 1`;
    }

    if (tag) {
      query += ` AND t.name = ?`;
      params.push(tag);
    }

    query += ` GROUP BY p.id`;

    if (sort === 'oldest') {
      query += ` ORDER BY p.created_at ASC`;
    } else if (sort === 'title_asc') {
      query += ` ORDER BY p.title ASC`;
    } else if (sort === 'title_desc') {
      query += ` ORDER BY p.title DESC`;
    } else if (sort === 'print_time') {
      query += ` ORDER BY p.print_time_minutes DESC`;
    } else {
      query += ` ORDER BY p.created_at DESC`;
    }

    const projects = db.prepare(query).all(...params);

    // Fetch primary file and all files for each project
    const projectsWithFiles = projects.map(proj => {
      const files = db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at ASC').all(proj.id);
      const tags = proj.tags_list ? proj.tags_list.split(',') : [];
      return {
        ...proj,
        tags,
        files
      };
    });

    res.json({ success: true, count: projectsWithFiles.length, data: projectsWithFiles });
  } catch (err) {
    console.error('Error fetching models:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/categories - List existing categories and count
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM projects 
      WHERE category IS NOT NULL AND category != '' 
      GROUP BY category 
      ORDER BY count DESC
    `).all();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/tags - List all tags
router.get('/tags', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.id, t.name, COUNT(pt.project_id) as count
      FROM tags t
      LEFT JOIN project_tags pt ON t.id = pt.tag_id
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
    `).all();
    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/:id - Get project detail
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Modell nicht gefunden' });
    }

    const files = db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at ASC').all(project.id);
    const tags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN project_tags pt ON t.id = pt.tag_id
      WHERE pt.project_id = ?
    `).all(project.id).map(t => t.name);

    res.json({
      success: true,
      data: {
        ...project,
        tags,
        files
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/models - Create a new model project with uploaded files
router.post('/', upload.array('files', 50), (req, res) => {
  try {
    const {
      title,
      description = '',
      category = 'Allgemein',
      author = '',
      filament_type = 'PLA',
      filament_color = '#38bdf8',
      infill_percentage = 15,
      print_time_minutes = 0,
      nozzle_size = 0.4,
      supports_needed = 0,
      source_url = '',
      notes = '',
      tags = '[]',
      thumbnail_base64 = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Titel ist erforderlich' });
    }

    const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');
    let thumbnailUrl = '';

    // Handle thumbnail saving if generated on client
    if (thumbnail_base64 && thumbnail_base64.startsWith('data:image/')) {
      try {
        const matches = thumbnail_base64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const thumbFilename = `thumb_${projectId}.${ext}`;
          const thumbPath = path.join(THUMBNAILS_DIR, thumbFilename);
          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(thumbPath, buffer);
          thumbnailUrl = `/api/thumbnails/${thumbFilename}`;
        }
      } catch (e) {
        console.error('Thumbnail save error:', e);
      }
    }

    db.prepare(`
      INSERT INTO projects (
        id, title, description, category, author, license,
        thumbnail_url, filament_type, filament_color, infill_percentage,
        print_time_minutes, nozzle_size, supports_needed, source_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      title.trim(),
      description.trim(),
      category.trim() || 'Allgemein',
      author.trim(),
      'CC BY-NC 4.0',
      thumbnailUrl,
      filament_type,
      filament_color,
      parseInt(infill_percentage, 10) || 15,
      parseInt(print_time_minutes, 10) || 0,
      parseFloat(nozzle_size) || 0.4,
      supports_needed === 'true' || supports_needed === '1' || supports_needed === 1 ? 1 : 0,
      source_url.trim(),
      notes.trim()
    );

    // Process attached files
    if (req.files && req.files.length > 0) {
      const insertFile = db.prepare(`
        INSERT INTO project_files (
          id, project_id, original_name, stored_name, file_path, file_size, file_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const file of req.files) {
        const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        let fileType = 'other';
        if (ext === 'stl' || ext === '3mf') fileType = ext;
        else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) fileType = 'image';

        insertFile.run(
          fileId,
          projectId,
          file.originalname,
          file.filename,
          file.path,
          file.size,
          fileType
        );
      }
    }

    // Process Tags
    let tagList = [];
    try {
      tagList = JSON.parse(tags);
    } catch {
      if (typeof tags === 'string') {
        tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    if (Array.isArray(tagList)) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
      const insertProjectTag = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');

      for (const t of tagList) {
        const cleanTag = t.trim();
        if (!cleanTag) continue;
        insertTag.run(cleanTag);
        const tagRecord = getTag.get(cleanTag);
        if (tagRecord) {
          insertProjectTag.run(projectId, tagRecord.id);
        }
      }
    }

    res.json({ success: true, message: 'Modell erfolgreich gespeichert', projectId });
  } catch (err) {
    console.error('Error creating model:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/models/batch - Bulk upload dozens/hundreds of 3D models at once
router.post('/batch', upload.array('files', 500), (req, res) => {
  try {
    const {
      category = 'Allgemein',
      filament_type = 'PLA',
      filament_color = '#38bdf8',
      author = '',
      tags = '[]'
    } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Keine Dateien empfangen' });
    }

    let tagList = [];
    try {
      tagList = JSON.parse(tags);
    } catch {
      if (typeof tags === 'string') {
        tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    const insertProject = db.prepare(`
      INSERT INTO projects (
        id, title, description, category, author, license,
        filament_type, filament_color, infill_percentage, print_time_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFile = db.prepare(`
      INSERT INTO project_files (
        id, project_id, original_name, stored_name, file_path, file_size, file_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
    const insertProjectTag = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');

    const createdProjects = [];

    const transaction = db.transaction((files) => {
      for (const file of files) {
        const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');
        const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext);
        const title = baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        let fileType = 'other';
        if (ext === '.stl') fileType = 'stl';
        else if (ext === '.3mf') fileType = '3mf';
        else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) fileType = 'image';

        insertProject.run(
          projectId,
          title,
          `Batch-Import: ${file.originalname}`,
          category || 'Allgemein',
          author || 'Michael Schellenberger',
          'CC BY-NC 4.0',
          filament_type || 'PLA',
          filament_color || '#38bdf8',
          15,
          0
        );

        insertFile.run(
          fileId,
          projectId,
          file.originalname,
          file.filename,
          file.path,
          file.size,
          fileType
        );

        // Tags
        if (Array.isArray(tagList)) {
          for (const t of tagList) {
            const cleanTag = t.trim();
            if (!cleanTag) continue;
            insertTag.run(cleanTag);
            const tagRecord = getTag.get(cleanTag);
            if (tagRecord) {
              insertProjectTag.run(projectId, tagRecord.id);
            }
          }
        }

        createdProjects.push({ id: projectId, title, fileId });
      }
    });

    transaction(req.files);

    res.json({
      success: true,
      message: `${createdProjects.length} 3D-Modelle erfolgreich importiert`,
      count: createdProjects.length,
      projects: createdProjects
    });
  } catch (err) {
    console.error('Error in batch upload:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/models/:id - Update project metadata & thumbnail
router.put('/:id', (req, res) => {
  try {
    const {
      title,
      description,
      category,
      author,
      filament_type,
      filament_color,
      infill_percentage,
      print_time_minutes,
      nozzle_size,
      supports_needed,
      is_favorite,
      source_url,
      notes,
      tags,
      thumbnail_base64
    } = req.body;

    const projectId = req.params.id;
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
    }

    let thumbnailUrl = existing.thumbnail_url;
    if (thumbnail_base64 && thumbnail_base64.startsWith('data:image/')) {
      const matches = thumbnail_base64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const thumbFilename = `thumb_${projectId}.${ext}`;
        const thumbPath = path.join(THUMBNAILS_DIR, thumbFilename);
        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(thumbPath, buffer);
        thumbnailUrl = `/api/thumbnails/${thumbFilename}?v=${Date.now()}`;
      }
    }

    db.prepare(`
      UPDATE projects SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        author = COALESCE(?, author),
        thumbnail_url = ?,
        filament_type = COALESCE(?, filament_type),
        filament_color = COALESCE(?, filament_color),
        infill_percentage = COALESCE(?, infill_percentage),
        print_time_minutes = COALESCE(?, print_time_minutes),
        nozzle_size = COALESCE(?, nozzle_size),
        supports_needed = COALESCE(?, supports_needed),
        is_favorite = COALESCE(?, is_favorite),
        source_url = COALESCE(?, source_url),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title,
      description,
      category,
      author,
      thumbnailUrl,
      filament_type,
      filament_color,
      infill_percentage !== undefined ? parseInt(infill_percentage, 10) : null,
      print_time_minutes !== undefined ? parseInt(print_time_minutes, 10) : null,
      nozzle_size !== undefined ? parseFloat(nozzle_size) : null,
      supports_needed !== undefined ? (supports_needed ? 1 : 0) : null,
      is_favorite !== undefined ? (is_favorite ? 1 : 0) : null,
      source_url,
      notes,
      projectId
    );

    // Update tags if provided
    if (tags !== undefined) {
      let tagList = Array.isArray(tags) ? tags : [];
      if (typeof tags === 'string') {
        try {
          tagList = JSON.parse(tags);
        } catch {
          tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
        }
      }

      db.prepare('DELETE FROM project_tags WHERE project_id = ?').run(projectId);
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
      const insertProjectTag = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');

      for (const t of tagList) {
        const cleanTag = t.trim();
        if (!cleanTag) continue;
        insertTag.run(cleanTag);
        const tagRecord = getTag.get(cleanTag);
        if (tagRecord) {
          insertProjectTag.run(projectId, tagRecord.id);
        }
      }
    }

    res.json({ success: true, message: 'Projekt aktualisiert' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/models/:id/files - Upload additional files to existing project
router.post('/:id/files', upload.array('files', 20), (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Keine Dateien hochgeladen' });
    }

    const insertFile = db.prepare(`
      INSERT INTO project_files (
        id, project_id, original_name, stored_name, file_path, file_size, file_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const file of req.files) {
      const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
      let fileType = 'other';
      if (ext === 'stl' || ext === '3mf') fileType = ext;
      else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) fileType = 'image';

      insertFile.run(
        fileId,
        projectId,
        file.originalname,
        file.filename,
        file.path,
        file.size,
        fileType
      );
    }

    res.json({ success: true, message: 'Dateien hinzugefügt' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/models/:id - Delete project and its files
router.delete('/:id', (req, res) => {
  try {
    const projectId = req.params.id;
    const files = db.prepare('SELECT * FROM project_files WHERE project_id = ?').all(projectId);

    // Remove physical files
    for (const file of files) {
      if (fs.existsSync(file.file_path)) {
        try {
          fs.unlinkSync(file.file_path);
        } catch (e) {
          console.error('Failed to unlink file:', file.file_path, e);
        }
      }
    }

    // Delete thumbnail if exists
    const project = db.prepare('SELECT thumbnail_url FROM projects WHERE id = ?').get(projectId);
    if (project && project.thumbnail_url && project.thumbnail_url.includes('/api/thumbnails/')) {
      const thumbFile = project.thumbnail_url.split('/api/thumbnails/')[1].split('?')[0];
      const thumbPath = path.join(THUMBNAILS_DIR, thumbFile);
      if (fs.existsSync(thumbPath)) {
        try { fs.unlinkSync(thumbPath); } catch (e) {}
      }
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    res.json({ success: true, message: 'Projekt gelöscht' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/models/:id/files/:fileId - Delete a single file from project
router.delete('/:id/files/:fileId', (req, res) => {
  try {
    const { id, fileId } = req.params;
    const file = db.prepare('SELECT * FROM project_files WHERE id = ? AND project_id = ?').get(fileId, id);
    if (!file) {
      return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
    }

    if (fs.existsSync(file.file_path)) {
      try { fs.unlinkSync(file.file_path); } catch (e) {}
    }

    db.prepare('DELETE FROM project_files WHERE id = ?').run(fileId);
    res.json({ success: true, message: 'Datei gelöscht' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/:id/download - Download project as ZIP
router.get('/:id/download', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projekt nicht gefunden' });
    }

    const files = db.prepare('SELECT * FROM project_files WHERE project_id = ?').all(project.id);
    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'Keine Dateien im Projekt' });
    }

    // If single file, download directly
    if (files.length === 1 && req.query.single === 'true') {
      const f = files[0];
      return res.download(f.file_path, f.original_name);
    }

    const safeTitle = project.title.replace(/[^a-zA-Z0-9-_]/g, '_');
    res.attachment(`${safeTitle}.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const file of files) {
      if (fs.existsSync(file.file_path)) {
        archive.file(file.file_path, { name: file.original_name });
      }
    }

    // Include print info summary text file in ZIP
    const infoText = `Modell: ${project.title}
Autor: ${project.author || 'Michael Schellenberger'}
Lizenz: ${project.license}
Kategorie: ${project.category}
Empfohlenes Filament: ${project.filament_type}
Infill: ${project.infill_percentage}%
Geschätzte Druckzeit: ${project.print_time_minutes} Minuten
Düsengröße: ${project.nozzle_size}mm
Stützen nötig: ${project.supports_needed ? 'Ja' : 'Nein'}
Quelle: ${project.source_url || 'Lokal'}
Notizen:
${project.notes || 'Keine Notizen'}
`;
    archive.append(infoText, { name: 'Druckhinweise.txt' });

    archive.finalize();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/files/:fileId/download - Download single file directly
router.get('/files/:fileId/download', (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM project_files WHERE id = ?').get(req.params.fileId);
    if (!file || !fs.existsSync(file.file_path)) {
      return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
    }
    res.download(file.file_path, file.original_name);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/models/files/:fileId/raw - Stream raw file for Three.js viewer
router.get('/files/:fileId/raw', (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM project_files WHERE id = ?').get(req.params.fileId);
    if (!file || !fs.existsSync(file.file_path)) {
      return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
    }

    if (file.file_type === 'stl') {
      res.setHeader('Content-Type', 'model/stl');
    } else if (file.file_type === '3mf') {
      res.setHeader('Content-Type', 'model/3mf');
    } else if (file.file_type === 'image') {
      res.setHeader('Content-Type', 'image/jpeg');
    }

    res.sendFile(file.file_path);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
