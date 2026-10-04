import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ZipArchive } from 'archiver';
import { db, MODELS_DIR, THUMBNAILS_DIR } from '../db.js';
import { updateProjectGeometry } from '../utils/geometryCalculator.js';
import { fixMulterFilename, formatTitleFromFilename, sanitizeZipFilename, setContentDisposition } from '../utils/stringUtils.js';
const router = express.Router();

// Multer storage for uploaded models and project images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MODELS_DIR);
  },
  filename: (req, file, cb) => {
    file.originalname = fixMulterFilename(file.originalname);
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
    const { search, category, tag, sort = 'newest', favorite, filament, printTime } = req.query;

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

    if (filament && filament !== 'Alle') {
      query += ` AND UPPER(p.filament_type) = ?`;
      params.push(filament.toUpperCase());
    }

    if (printTime === 'short') {
      query += ` AND p.print_time_minutes > 0 AND p.print_time_minutes <= 120`;
    } else if (printTime === 'medium') {
      query += ` AND p.print_time_minutes > 120 AND p.print_time_minutes <= 360`;
    } else if (printTime === 'long') {
      query += ` AND p.print_time_minutes > 360`;
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
    } else if (sort === 'weight_asc') {
      query += ` ORDER BY p.weight_grams ASC`;
    } else if (sort === 'weight_desc') {
      query += ` ORDER BY p.weight_grams DESC`;
    } else {
      query += ` ORDER BY p.created_at DESC`;
    }

    const projects = db.prepare(query).all(...params);

    if (projects.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    // Fetch all files in a single batch query instead of N individual queries
    const projectIds = projects.map(p => p.id);
    const placeholders = projectIds.map(() => '?').join(',');
    const allFiles = db.prepare(`SELECT * FROM project_files WHERE project_id IN (${placeholders}) ORDER BY created_at ASC`).all(...projectIds);

    const filesByProjectId = new Map();
    for (const f of allFiles) {
      if (!filesByProjectId.has(f.project_id)) {
        filesByProjectId.set(f.project_id, []);
      }
      filesByProjectId.get(f.project_id).push(f);
    }

    const projectsWithFiles = projects.map(proj => {
      const files = filesByProjectId.get(proj.id) || [];
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
      INNER JOIN project_tags pt ON t.id = pt.tag_id
      GROUP BY t.id
      HAVING count > 0
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
      thumbnail_base64 = '',
      is_multicolor = 0,
      duplicate_action = 'keep_both' // 'skip' | 'overwrite' | 'keep_both'
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Titel ist erforderlich' });
    }

    const cleanTitle = title.trim();

    // Sanitize uploaded filenames for UTF-8 / umlaut consistency
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        file.originalname = fixMulterFilename(file.originalname);
      }
    }

    // DUPLICATE DETECTION: Check if exact file already exists (by original filename & exact byte size)
    let fileMatch = null;
    if (req.files && req.files.length > 0) {
      const firstFile = req.files[0];
      fileMatch = db.prepare(`
        SELECT p.* FROM projects p
        JOIN project_files pf ON p.id = pf.project_id
        WHERE pf.original_name = ? AND pf.file_size = ?
        LIMIT 1
      `).get(firstFile.originalname, firstFile.size);
    }

    let existingProject = null;
    if (fileMatch) {
      existingProject = fileMatch;
    } else if (duplicate_action === 'overwrite') {
      // In overwrite mode, also match by title if user wants to replace project by title
      existingProject = db.prepare('SELECT * FROM projects WHERE LOWER(title) = LOWER(?)').get(cleanTitle);
    }

    // CASE A: Exact file duplicate detected & User chose "skip" (Do not import again)
    if (existingProject && duplicate_action === 'skip') {
      // Remove freshly uploaded temp files from disk to prevent orphaned files
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          if (file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch {}
          }
        }
      }
      return res.json({
        success: true,
        action: 'skipped',
        message: `Modell "${cleanTitle}" existiert bereits und wurde übersprungen.`,
        projectId: existingProject.id
      });
    }

    // If a different model shares the same title, disambiguate title (e.g. "Titel (2)") instead of dropping it
    let finalTitle = cleanTitle;
    if (!existingProject) {
      let counter = 2;
      while (db.prepare('SELECT id FROM projects WHERE LOWER(title) = LOWER(?)').get(finalTitle)) {
        finalTitle = `${cleanTitle} (${counter++})`;
      }
    }

    // CASE B: Duplicate detected & User chose "overwrite" (Update existing project)
    if (existingProject && duplicate_action === 'overwrite') {
      const projectId = existingProject.id;

      // 1. Delete previous physical files from disk
      const oldFiles = db.prepare('SELECT file_path FROM project_files WHERE project_id = ?').all(projectId);
      for (const of of oldFiles) {
        if (of.file_path && fs.existsSync(of.file_path)) {
          try { fs.unlinkSync(of.file_path); } catch {}
        }
      }
      db.prepare('DELETE FROM project_files WHERE project_id = ?').run(projectId);

      // 2. Optional thumbnail replacement
      let thumbnailUrl = existingProject.thumbnail_url;
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

      // 3. Update project metadata
      db.prepare(`
        UPDATE projects SET
          description = ?, category = ?, author = ?,
          thumbnail_url = ?, filament_type = ?, filament_color = ?,
          infill_percentage = ?, print_time_minutes = ?, nozzle_size = ?,
          supports_needed = ?, source_url = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        description.trim() || existingProject.description,
        category.trim() || existingProject.category,
        author.trim() || existingProject.author,
        thumbnailUrl,
        filament_type,
        filament_color,
        parseInt(infill_percentage, 10) || existingProject.infill_percentage,
        parseInt(print_time_minutes, 10) || existingProject.print_time_minutes,
        parseFloat(nozzle_size) || existingProject.nozzle_size,
        supports_needed === 'true' || supports_needed === '1' || supports_needed === 1 ? 1 : 0,
        source_url.trim() || existingProject.source_url,
        notes.trim() || existingProject.notes,
        projectId
      );

      // 4. Insert new files
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

      return res.json({
        success: true,
        action: 'overwritten',
        message: `Modell "${cleanTitle}" wurde erfolgreich aktualisiert / überschrieben.`,
        projectId
      });
    }

    // CASE C: New Model Project (Normal Insert)
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

    const multiColorVal = (is_multicolor === 'true' || is_multicolor === '1' || is_multicolor === 1 || is_multicolor === true) ? 1 : 0;

    db.prepare(`
      INSERT INTO projects (
        id, title, description, category, author, license,
        thumbnail_url, filament_type, filament_color, infill_percentage,
        print_time_minutes, nozzle_size, supports_needed, is_multicolor, source_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      finalTitle,
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
      multiColorVal,
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

    updateProjectGeometry(projectId).catch(() => {});

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
      tags = '[]',
      is_multicolor = 0,
      duplicate_action = 'keep_both' // 'skip' | 'overwrite' | 'keep_both'
    } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Keine Dateien empfangen' });
    }

    const multiColorVal = (is_multicolor === 'true' || is_multicolor === '1' || is_multicolor === 1 || is_multicolor === true) ? 1 : 0;

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
        filament_type, filament_color, infill_percentage, print_time_minutes, is_multicolor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        file.originalname = fixMulterFilename(file.originalname);

        if (duplicate_action === 'skip') {
          const match = db.prepare(`
            SELECT project_id FROM project_files
            WHERE original_name = ? AND file_size = ?
            LIMIT 1
          `).get(file.originalname, file.size);

          if (match) {
            if (file.path && fs.existsSync(file.path)) {
              try { fs.unlinkSync(file.path); } catch {}
            }
            continue;
          }
        }

        const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');
        const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        const title = formatTitleFromFilename(file.originalname);

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
          0,
          multiColorVal
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

    for (const p of createdProjects) {
      updateProjectGeometry(p.id).catch(() => {});
    }

    res.json({
      success: true,
      message: `${createdProjects.length} 3D-Modelle erfolgreich importiert`,
      count: createdProjects.length,
      projects: createdProjects
    });
  } catch (err) {
    console.error('Error in batch upload:', err);
    // Cleanup freshly uploaded temp files from disk to prevent orphaned files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.path && fs.existsSync(file.path)) {
          try { fs.unlinkSync(file.path); } catch {}
        }
      }
    }
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
      is_multicolor,
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

    const multiColorVal = is_multicolor !== undefined 
      ? ((is_multicolor === 'true' || is_multicolor === '1' || is_multicolor === 1 || is_multicolor === true) ? 1 : 0)
      : null;

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
        is_multicolor = COALESCE(?, is_multicolor),
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
      multiColorVal,
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

    if (filament_type) {
      updateProjectGeometry(projectId).catch(() => {});
    }

    res.json({ success: true, message: 'Projekt aktualisiert' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/models/:id/geometry - Save calculated volume and weight
router.patch('/:id/geometry', (req, res) => {
  try {
    const { volume_cm3, weight_grams } = req.body;
    db.prepare(`
      UPDATE projects 
      SET volume_cm3 = COALESCE(?, volume_cm3), 
          weight_grams = COALESCE(?, weight_grams) 
      WHERE id = ?
    `).run(volume_cm3, weight_grams, req.params.id);
    res.json({ success: true });
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
      file.originalname = fixMulterFilename(file.originalname);
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

// PATCH /api/models/:id/files/:fileId - Rename a single file in project
router.patch('/:id/files/:fileId', (req, res) => {
  try {
    const { id, fileId } = req.params;
    const { original_name } = req.body;
    if (!original_name || typeof original_name !== 'string' || !original_name.trim()) {
      return res.status(400).json({ success: false, error: 'Ungültiger Dateiname' });
    }

    const file = db.prepare('SELECT * FROM project_files WHERE id = ? AND project_id = ?').get(fileId, id);
    if (!file) {
      return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
    }

    let cleanName = sanitizeZipFilename(original_name.trim());
    // Auto-preserve original extension if user removed it
    const originalExt = path.extname(file.original_name);
    if (originalExt && !cleanName.toLowerCase().endsWith(originalExt.toLowerCase())) {
      cleanName += originalExt;
    }

    db.prepare('UPDATE project_files SET original_name = ? WHERE id = ? AND project_id = ?').run(cleanName, fileId, id);
    res.json({ success: true, original_name: cleanName, message: 'Dateiname erfolgreich geändert' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/models/batch-delete - Delete multiple models at once
router.post('/batch-delete', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Keine Modell-IDs angegeben' });
    }

    const deleteFiles = db.prepare('SELECT file_path FROM project_files WHERE project_id = ?');
    const getProject = db.prepare('SELECT thumbnail_url FROM projects WHERE id = ?');
    const deleteProject = db.prepare('DELETE FROM projects WHERE id = ?');

    const transaction = db.transaction((idList) => {
      for (const id of idList) {
        const files = deleteFiles.all(id);
        for (const file of files) {
          if (fs.existsSync(file.file_path)) {
            try { fs.unlinkSync(file.file_path); } catch (e) {}
          }
        }
        const proj = getProject.get(id);
        if (proj && proj.thumbnail_url && proj.thumbnail_url.includes('/api/thumbnails/')) {
          const thumbFile = proj.thumbnail_url.split('/api/thumbnails/')[1].split('?')[0];
          const thumbPath = path.join(THUMBNAILS_DIR, thumbFile);
          if (fs.existsSync(thumbPath)) {
            try { fs.unlinkSync(thumbPath); } catch (e) {}
          }
        }
        deleteProject.run(id);
      }
    });

    transaction(ids);
    res.json({ success: true, message: `${ids.length} Modelle erfolgreich gelöscht` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/models/batch-category - Move multiple models to a category
router.post('/batch-category', (req, res) => {
  try {
    const { ids, category } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !category) {
      return res.status(400).json({ success: false, error: 'Ungültige Parameter' });
    }

    const updateCategory = db.prepare('UPDATE projects SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const transaction = db.transaction((idList, cat) => {
      for (const id of idList) {
        updateCategory.run(cat, id);
      }
    });

    transaction(ids, category);
    res.json({ success: true, message: `${ids.length} Modelle in "${category}" verschoben` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/models/batch-rename - Apply ordered literal search-and-replace rules to project titles
router.post('/batch-rename', (req, res) => {
  try {
    const { ids, rules } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ success: false, error: 'Modelle und mindestens eine Ersetzungsregel sind erforderlich.' });
    }

    const validRules = rules
      .filter(rule => rule && typeof rule.find === 'string' && rule.find.length > 0 && typeof rule.replace === 'string')
      .slice(0, 25);

    if (validRules.length === 0) {
      return res.status(400).json({ success: false, error: 'Die Suchbegriffe dürfen nicht leer sein.' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const projects = db.prepare(`SELECT id, title FROM projects WHERE id IN (${placeholders})`).all(...ids);
    const updateTitle = db.prepare('UPDATE projects SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const changed = [];

    const applyRules = (title) => validRules.reduce(
      (result, rule) => result.split(rule.find).join(rule.replace),
      title
    ).replace(/\s{2,}/g, ' ').trim();

    const transaction = db.transaction(() => {
      for (const project of projects) {
        const nextTitle = applyRules(project.title || '');
        if (nextTitle && nextTitle !== project.title) {
          updateTitle.run(nextTitle, project.id);
          changed.push({ id: project.id, oldTitle: project.title, title: nextTitle });
        }
      }
    });

    transaction();
    res.json({ success: true, changedCount: changed.length, changed });
  } catch (err) {
    console.error('Batch rename failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/models/batch-download - Download multiple selected models as a single ZIP archive
router.post('/batch-download', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Keine Modell-IDs angegeben' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const projects = db.prepare(`SELECT * FROM projects WHERE id IN (${placeholders})`).all(...ids);
    if (projects.length === 0) {
      return res.status(404).json({ success: false, error: 'Keine Modelle gefunden' });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const zipName = `stldepot-sammlung-${dateStr}.zip`;
    res.type('application/zip');
    setContentDisposition(res, zipName);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(res);

    for (const project of projects) {
      const safeTitle = sanitizeZipFilename(project.title || 'Modell');
      const files = db.prepare('SELECT * FROM project_files WHERE project_id = ?').all(project.id);

      for (const file of files) {
        if (fs.existsSync(file.file_path)) {
          archive.file(file.file_path, { name: `${safeTitle}/${file.original_name}` });
        }
      }
    }

    archive.finalize();
  } catch (err) {
    console.error('Batch download failed:', err);
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

    const safeTitle = sanitizeZipFilename(project.title || 'Modell');
    res.type('application/zip');
    setContentDisposition(res, `${safeTitle}.zip`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
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

// POST /api/models/open-in-slicer - Directly launches local slicer application with model file
router.post('/open-in-slicer', (req, res) => {
  try {
    const { slicer, fileId, modelId } = req.body;
    let file = null;

    if (fileId) {
      file = db.prepare('SELECT * FROM project_files WHERE id = ?').get(fileId);
    } else if (modelId) {
      file = db.prepare("SELECT * FROM project_files WHERE project_id = ? AND file_type IN ('stl', '3mf') LIMIT 1").get(modelId);
    }

    if (!file || !fs.existsSync(file.file_path)) {
      return res.status(404).json({ success: false, error: 'Datei nicht auf dem Server gefunden' });
    }

    const { execSync } = require('child_process');
    const platform = process.platform;
    let opened = false;

    if (platform === 'darwin') {
      const macApps = {
        anycubic: ['AnycubicSlicerNext', 'Anycubic Slicer Next', 'AnycubicSlicer', 'Photon_Workshop'],
        bambu: ['BambuStudio', 'Bambu Studio'],
        orca: ['OrcaSlicer', 'OrcaSlicer-macos', 'Orca Slicer'],
        prusa: ['PrusaSlicer', 'Original Prusa Drivers/PrusaSlicer'],
        cura: ['UltiMaker Cura', 'Cura']
      };

      const candidates = macApps[slicer] || [];
      for (const app of candidates) {
        try {
          execSync(`open -a "${app}" "${file.file_path}"`, { timeout: 5000, stdio: 'ignore' });
          opened = true;
          break;
        } catch {}
      }

      // If specific app not found, try acnext protocol for anycubic
      if (!opened && slicer === 'anycubic') {
        try {
          execSync(`open "acnext://open?file=${encodeURIComponent(file.file_path)}"`, { timeout: 5000, stdio: 'ignore' });
          opened = true;
        } catch {}
      }
    } else if (platform === 'win32') {
      try {
        execSync(`explorer "${file.file_path.replace(/\//g, '\\')}"`, { timeout: 5000, stdio: 'ignore' });
        opened = true;
      } catch {}
    } else {
      // Linux
      try {
        execSync(`xdg-open "${file.file_path}"`, { timeout: 5000, stdio: 'ignore' });
        opened = true;
      } catch {}
    }

    if (opened) {
      return res.json({ success: true, message: `Datei direkt in Slicer geöffnet!` });
    } else {
      return res.json({ success: false, message: `Lokaler Slicer konnte nicht direkt gestartet werden.` });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
