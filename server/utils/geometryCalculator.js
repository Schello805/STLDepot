import fs from 'fs';
import path from 'path';

// Load JSZip from client's node_modules if not top-level
let JSZipModule = null;
try {
  JSZipModule = (await import('jszip')).default;
} catch (e1) {
  try {
    const localZip = await import('../../client/node_modules/jszip/dist/jszip.min.js');
    JSZipModule = localZip.default || localZip;
  } catch (e2) {
    console.warn('[geometryCalculator] JSZip could not be loaded:', e2.message);
  }
}

/**
 * Calculates volume (in cm3) and estimated filament weight (in grams)
 * for an STL or 3MF file.
 * 
 * @param {string} filePath - Absolute path to the 3D file
 * @param {string} filamentType - Filament type (default 'PLA')
 * @param {number} density - Material density in g/cm3 (default 1.24)
 * @param {number} infillFactor - Fill factor (default 0.35 = ~15% infill + 3 perimeters)
 * @returns {Promise<{ volumeCm3: number, weightGrams: number, triangles: number }>}
 */
export async function calculateFileGeometry(filePath, filamentType = 'PLA', density = 1.24, infillFactor = 0.35) {
  if (!fs.existsSync(filePath)) {
    return { volumeCm3: 0, weightGrams: 0, triangles: 0 };
  }

  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.stl') {
      return calculateSTLGeometry(filePath, density, infillFactor);
    } else if (ext === '.3mf') {
      return await calculate3MFGeometry(filePath, density, infillFactor);
    }
  } catch (err) {
    console.warn(`[geometryCalculator] Error calculating geometry for ${filePath}:`, err.message);
  }

  return { volumeCm3: 0, weightGrams: 0, triangles: 0 };
}

/**
 * Fast binary & ASCII STL volume calculation using signed tetrahedron divergence theorem.
 */
function calculateSTLGeometry(filePath, density, infillFactor) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 84) {
    return { volumeCm3: 0, weightGrams: 0, triangles: 0 };
  }

  // Check if binary or ASCII
  let isAscii = true;
  for (let i = 0; i < Math.min(buf.length, 512); i++) {
    if (buf[i] === 0) {
      isAscii = false;
      break;
    }
  }

  let totalVolume = 0;
  let triangleCount = 0;

  if (!isAscii && buf.length >= 84) {
    triangleCount = buf.readUInt32LE(80);
    let offset = 84;

    for (let i = 0; i < triangleCount; i++) {
      if (offset + 50 > buf.length) break;

      // Skip normal (offset + 0 to 12)
      const v1x = buf.readFloatLE(offset + 12);
      const v1y = buf.readFloatLE(offset + 16);
      const v1z = buf.readFloatLE(offset + 20);

      const v2x = buf.readFloatLE(offset + 24);
      const v2y = buf.readFloatLE(offset + 28);
      const v2z = buf.readFloatLE(offset + 32);

      const v3x = buf.readFloatLE(offset + 36);
      const v3y = buf.readFloatLE(offset + 40);
      const v3z = buf.readFloatLE(offset + 44);

      offset += 50;

      // Cross product v2 x v3
      const cx = v2y * v3z - v2z * v3y;
      const cy = v2z * v3x - v2x * v3z;
      const cz = v2x * v3y - v2y * v3x;

      // Dot product v1 . (v2 x v3) / 6
      totalVolume += (v1x * cx + v1y * cy + v1z * cz) / 6.0;
    }
  } else {
    // ASCII STL
    const text = buf.toString('utf8');
    const vRegex = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let match;
    const verts = [];
    while ((match = vRegex.exec(text)) !== null) {
      verts.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
    }

    triangleCount = Math.floor(verts.length / 3);
    for (let i = 0; i < verts.length - 2; i += 3) {
      const [v1x, v1y, v1z] = verts[i];
      const [v2x, v2y, v2z] = verts[i + 1];
      const [v3x, v3y, v3z] = verts[i + 2];

      const cx = v2y * v3z - v2z * v3y;
      const cy = v2z * v3x - v2x * v3z;
      const cz = v2x * v3y - v2y * v3x;

      totalVolume += (v1x * cx + v1y * cy + v1z * cz) / 6.0;
    }
  }

  const volumeCm3 = Math.max(0, Math.abs(totalVolume) / 1000.0);
  const weightGrams = volumeCm3 * density * infillFactor;

  return {
    volumeCm3: parseFloat(volumeCm3.toFixed(2)),
    weightGrams: parseFloat(weightGrams.toFixed(1)),
    triangles: triangleCount
  };
}

/**
 * 3MF volume calculation via JSZip & 3D model XML / slicer metadata.
 */
async function calculate3MFGeometry(filePath, density, infillFactor) {
  if (!JSZipModule) {
    return { volumeCm3: 0, weightGrams: 0, triangles: 0 };
  }

  const buf = fs.readFileSync(filePath);
  const zip = await JSZipModule.loadAsync(buf);

  let isMultiColor = false;

  // 1. Check if Bambu / Orca / Prusa slicer metadata already has exact sliced weight!
  for (const name of Object.keys(zip.files)) {
    if (
      name.toLowerCase().includes('slice_info') ||
      name.toLowerCase().includes('model_settings') ||
      name.toLowerCase().includes('project_settings')
    ) {
      try {
        const text = await zip.files[name].async('text');

        // Check for multiple filament colors or multiple extruders in metadata
        const colorMatches = text.match(/\"filament_colour\":\s*\[(.*?)\]/s);
        if (colorMatches) {
          try {
            const parsedColors = JSON.parse('[' + colorMatches[1] + ']');
            if (Array.isArray(parsedColors) && parsedColors.length > 1) {
              isMultiColor = true;
            }
          } catch {}
        }
        if (!isMultiColor && text.match(/<metadata\s+key=["']extruder["']\s+value=["']([2-9]|\d{2,})["']/i)) {
          isMultiColor = true;
        }

        // Check for sliced weight e.g. weight="42.5" or used_filament_g="42.5" or "weight": 42.5
        const wMatch = text.match(/used_filament_g[":=\s]+([0-9.]+)/i) || 
                       text.match(/weight[":=\s]+([0-9.]+)/i);
        if (wMatch && parseFloat(wMatch[1]) > 0.05) {
          const directWeight = parseFloat(wMatch[1]);
          const approxVol = directWeight / (density * infillFactor);
          return {
            volumeCm3: parseFloat(approxVol.toFixed(2)),
            weightGrams: parseFloat(directWeight.toFixed(1)),
            triangles: 0,
            isMultiColor
          };
        }
      } catch {}
    }
  }

  // 2. Parse all *.model files in zip (e.g. 3D/3dmodel.model, 3D/Objects/*.model)
  const modelFiles = Object.values(zip.files).filter(f => f.name.toLowerCase().endsWith('.model'));

  let totalVolume = 0;
  let totalTriangles = 0;

  for (const modelFile of modelFiles) {
    try {
      const xml = await modelFile.async('text');

      if (!isMultiColor && (
        xml.includes('<m:colorgroup') || 
        xml.includes('<basematerials') || 
        xml.includes('<m:multiproperties') ||
        (xml.match(/<color\s+color=/g) || []).length > 1 ||
        (xml.match(/pid=["'][^"']+["']/g) || []).length > 1
      )) {
        isMultiColor = true;
      }

      const vMatches = [...xml.matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g)];
      const tMatches = [...xml.matchAll(/<triangle\s+v1="([^"]+)"\s+v2="([^"]+)"\s+v3="([^"]+)"/g)];

      if (tMatches.length > 0 && vMatches.length > 0) {
        totalTriangles += tMatches.length;
        for (const t of tMatches) {
          const i1 = parseInt(t[1], 10);
          const i2 = parseInt(t[2], 10);
          const i3 = parseInt(t[3], 10);

          if (vMatches[i1] && vMatches[i2] && vMatches[i3]) {
            const v1x = parseFloat(vMatches[i1][1]), v1y = parseFloat(vMatches[i1][2]), v1z = parseFloat(vMatches[i1][3]);
            const v2x = parseFloat(vMatches[i2][1]), v2y = parseFloat(vMatches[i2][2]), v2z = parseFloat(vMatches[i2][3]);
            const v3x = parseFloat(vMatches[i3][1]), v3y = parseFloat(vMatches[i3][2]), v3z = parseFloat(vMatches[i3][3]);

            const cx = v2y * v3z - v2z * v3y;
            const cy = v2z * v3x - v2x * v3z;
            const cz = v2x * v3y - v2y * v3x;

            totalVolume += (v1x * cx + v1y * cy + v1z * cz) / 6.0;
          }
        }
      }
    } catch (e) {
      console.warn('[geometryCalculator] Error reading model file in 3MF:', modelFile.name, e.message);
    }
  }

  if (totalTriangles > 0) {
    const volumeCm3 = Math.max(0, Math.abs(totalVolume) / 1000.0);
    const weightGrams = volumeCm3 * density * infillFactor;

    return {
      volumeCm3: parseFloat(volumeCm3.toFixed(2)),
      weightGrams: parseFloat(weightGrams.toFixed(1)),
      triangles: totalTriangles,
      isMultiColor
    };
  }

  return { volumeCm3: 0, weightGrams: 0, triangles: 0, isMultiColor };
}

/**
 * Updates geometry and weight for a specific project in SQLite.
 */
export async function updateProjectGeometry(projectId) {
  try {
    const { db } = await import('../db.js');
    const project = db.prepare('SELECT id, filament_type, is_multicolor FROM projects WHERE id = ?').get(projectId);
    if (!project) return;

    // Load material settings
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('material_settings');
    let settings = { materials: [{ id: 'PLA', density: 1.24 }], infill_factor: 0.35 };
    if (row && row.value) {
      try { settings = JSON.parse(row.value); } catch {}
    }

    const mat = (settings.materials || []).find(m => (m.id || m.name).toUpperCase() === (project.filament_type || 'PLA').toUpperCase());
    const density = mat?.density || 1.24;
    const infillFactor = typeof settings.infill_factor === 'number' ? settings.infill_factor : 0.35;

    const files = db.prepare('SELECT * FROM project_files WHERE project_id = ?').all(projectId);
    let totalVolume = 0;
    let totalWeight = 0;
    let detectedMultiColor = false;

    for (const f of files) {
      if (!f.file_path || !fs.existsSync(f.file_path)) continue;
      const geo = await calculateFileGeometry(f.file_path, project.filament_type, density, infillFactor);
      if (geo.isMultiColor) {
        detectedMultiColor = true;
      }
      if (geo.volumeCm3 > 0 || geo.weightGrams > 0) {
        totalVolume += geo.volumeCm3;
        totalWeight += geo.weightGrams;
        db.prepare('UPDATE project_files SET volume_cm3 = ?, triangle_count = ? WHERE id = ?')
          .run(geo.volumeCm3, geo.triangles, f.id);
      }
    }

    const updates = [];
    const params = [];

    if (totalVolume > 0 || totalWeight > 0) {
      updates.push('volume_cm3 = ?', 'weight_grams = ?');
      params.push(parseFloat(totalVolume.toFixed(2)), parseFloat(totalWeight.toFixed(1)));
    }

    // If multi-color was detected in 3MF files and project is not already set to multicolor
    if (detectedMultiColor && !project.is_multicolor) {
      updates.push('is_multicolor = 1');
    }

    if (updates.length > 0) {
      params.push(projectId);
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
  } catch (err) {
    console.warn(`[geometryCalculator] Could not update project ${projectId}:`, err.message);
  }
}

/**
 * Updates all projects that have 0 volume.
 */
export async function updateAllProjectGeometries() {
  try {
    const { db } = await import('../db.js');
    const projects = db.prepare('SELECT id FROM projects WHERE volume_cm3 = 0 OR volume_cm3 IS NULL').all();
    console.log(`[geometryCalculator] Recalculating geometry for ${projects.length} models...`);
    for (const p of projects) {
      await updateProjectGeometry(p.id);
    }
    console.log(`[geometryCalculator] Completed geometry calculation.`);
  } catch (err) {
    console.warn('[geometryCalculator] Error during batch update:', err.message);
  }
}

