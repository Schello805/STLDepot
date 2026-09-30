import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, MODELS_DIR, THUMBNAILS_DIR } from '../db.js';

const router = express.Router();

// Helper to extract clean metadata from web pages
function extractMetadataFromHtml(html, targetUrl) {
  let title = '';
  let description = '';
  let author = 'Web Import';
  let image = '';
  let source = targetUrl;

  // Title extraction
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                  html.match(/<title>(.*?)<\/title>/i);
  if (ogTitle) {
    title = ogTitle[1].replace(/(\||-).*$/, '').trim();
  }

  // Description extraction
  const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                 html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (ogDesc) {
    description = ogDesc[1].trim();
  }

  // Image extraction
  const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  if (ogImage) {
    image = ogImage[1];
  }

  // Author extraction
  if (targetUrl.includes('makerworld.com')) {
    source = 'MakerWorld';
    const authorMatch = html.match(/"author":\s*\{[^}]*"name":\s*"([^"]+)"/i) || html.match(/by\s+([A-Za-z0-9_-]+)/i);
    if (authorMatch) author = authorMatch[1];
  } else if (targetUrl.includes('printables.com')) {
    source = 'Printables';
    const authorMatch = html.match(/"userName":\s*"([^"]+)"/i) || html.match(/by\s+([A-Za-z0-9_-]+)/i);
    if (authorMatch) author = authorMatch[1];
  } else if (targetUrl.includes('thingiverse.com')) {
    source = 'Thingiverse';
    const authorMatch = html.match(/"creator":\s*\{[^}]*"name":\s*"([^"]+)"/i) || html.match(/by\s+([A-Za-z0-9_-]+)/i);
    if (authorMatch) author = authorMatch[1];
  }

  if (!title) {
    try {
      const urlObj = new URL(targetUrl);
      title = path.basename(urlObj.pathname).replace(/[_-]+/g, ' ') || 'Web Importiertes Modell';
    } catch {
      title = 'Web Import Modell';
    }
  }

  return { title, description, author, image, source };
}

// POST /api/models/web-import
router.post('/', async (req, res) => {
  try {
    const { url, category = 'Deko & Haushalt', filament_color = '#38bdf8' } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Keine URL angegeben' });
    }

    const trimmedUrl = url.trim();
    const projectId = 'proj_' + crypto.randomBytes(8).toString('hex');

    // Case 1: Direct link to an .stl or .3mf file
    const lowerUrl = trimmedUrl.toLowerCase();
    if (lowerUrl.endsWith('.stl') || lowerUrl.endsWith('.3mf')) {
      const ext = lowerUrl.endsWith('.3mf') ? '3mf' : 'stl';
      const fileId = 'file_' + crypto.randomBytes(8).toString('hex');
      const storedName = `${fileId}.${ext}`;
      const destPath = path.join(MODELS_DIR, storedName);

      const response = await fetch(trimmedUrl);
      if (!response.ok) throw new Error(`Download fehlgeschlagen (HTTP ${response.status})`);
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(destPath, Buffer.from(buffer));

      const baseName = path.basename(new URL(trimmedUrl).pathname, `.${ext}`);
      const title = decodeURIComponent(baseName).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      db.prepare(`
        INSERT INTO projects (
          id, title, description, category, author, license,
          filament_type, filament_color, infill_percentage, print_time_minutes, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        title,
        `Direkt-Import via Web von: ${trimmedUrl}`,
        category,
        'Web Import',
        'CC BY-NC 4.0',
        'PLA',
        filament_color,
        15,
        0,
        trimmedUrl
      );

      db.prepare(`
        INSERT INTO project_files (
          id, project_id, original_name, stored_name, file_path, file_size, file_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        projectId,
        `${baseName}.${ext}`,
        storedName,
        destPath,
        buffer.byteLength,
        ext
      );

      return res.json({
        success: true,
        message: `3D-Modell "${title}" erfolgreich aus Web geladen!`,
        projectId
      });
    }

    // Case 2: Platform page (MakerWorld / Printables / Thingiverse / Thangs)
    const pageResponse = await fetch(trimmedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!pageResponse.ok) {
      throw new Error(`Konnte Seite nicht laden (HTTP ${pageResponse.status})`);
    }

    const html = await pageResponse.text();
    const meta = extractMetadataFromHtml(html, trimmedUrl);

    // Save project metadata to database
    db.prepare(`
      INSERT INTO projects (
        id, title, description, category, author, license,
        filament_type, filament_color, infill_percentage, print_time_minutes, source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      meta.title || 'Web 3D Modell',
      meta.description || `Importiert von ${meta.source}: ${trimmedUrl}`,
      category,
      meta.author || 'Maker',
      'CC BY-NC 4.0',
      'PLA',
      filament_color,
      15,
      0,
      trimmedUrl
    );

    // If og:image was found, download and save as thumbnail
    if (meta.image) {
      try {
        const imgRes = await fetch(meta.image);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const thumbName = `thumb_${projectId}.jpg`;
          const thumbPath = path.join(THUMBNAILS_DIR, thumbName);
          fs.writeFileSync(thumbPath, Buffer.from(imgBuffer));
          db.prepare('UPDATE projects SET thumbnail_url = ? WHERE id = ?').run(`/api/thumbnails/${thumbName}`, projectId);
        }
      } catch (e) {
        console.error('Thumbnail download failed:', e);
      }
    }

    res.json({
      success: true,
      message: `Modell "${meta.title}" von ${meta.source} importiert!`,
      projectId,
      meta
    });
  } catch (err) {
    console.error('Web import error:', err);
    res.status(500).json({ success: false, error: err.message || 'Web Import fehlgeschlagen' });
  }
});

export default router;
