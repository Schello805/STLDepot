import * as THREE from 'three';
import JSZip from 'jszip';

/**
 * Parses STL data (both binary and ASCII formats) into THREE.BufferGeometry
 */
export function parseSTL(buffer) {
  const isBinary = (function () {
    const reader = new DataView(buffer);
    const face_size = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
    const n_faces = reader.getUint32(80, true);
    const expect_size = 80 + (32 / 8) + (n_faces * face_size);

    if (expect_size === reader.byteLength) {
      return true;
    }

    // Check if starts with solid and contains no binary-like characters
    const textDecoder = new TextDecoder();
    const str = textDecoder.decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 128)));
    return !str.startsWith('solid');
  })();

  if (isBinary) {
    return parseBinarySTL(buffer);
  } else {
    const textDecoder = new TextDecoder();
    return parseASCIISTL(textDecoder.decode(buffer));
  }
}

function parseBinarySTL(buffer) {
  const reader = new DataView(buffer);
  const faces = reader.getUint32(80, true);

  const dataOffset = 84;
  const faceLength = 12 * 4 + 2;

  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(faces * 3 * 3);
  const normals = new Float32Array(faces * 3 * 3);

  let offset = dataOffset;
  let vIndex = 0;

  for (let face = 0; face < faces; face++) {
    const normalX = reader.getFloat32(offset, true);
    const normalY = reader.getFloat32(offset + 4, true);
    const normalZ = reader.getFloat32(offset + 8, true);

    for (let i = 1; i <= 3; i++) {
      const vertexOffset = offset + i * 12;
      const vx = reader.getFloat32(vertexOffset, true);
      const vy = reader.getFloat32(vertexOffset + 4, true);
      const vz = reader.getFloat32(vertexOffset + 8, true);

      vertices[vIndex] = vx;
      vertices[vIndex + 1] = vy;
      vertices[vIndex + 2] = vz;

      normals[vIndex] = normalX;
      normals[vIndex + 1] = normalY;
      normals[vIndex + 2] = normalZ;

      vIndex += 3;
    }

    offset += faceLength;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function parseASCIISTL(data) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const normals = [];

  const normalPattern = /facet\s+normal\s+([-+]?\b(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\b)\s+([-+]?\b(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\b)\s+([-+]?\b(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\b)/g;
  const vertexPattern = /vertex\s+([-+]?\b(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\b)\s+([-+]?\b(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\b)\s+([-+]?\b(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\b)/g;

  let normal = [0, 0, 0];
  const lines = data.split('\n');

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('facet normal')) {
      const parts = line.split(/\s+/);
      normal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
    } else if (line.startsWith('vertex')) {
      const parts = line.split(/\s+/);
      vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      normals.push(normal[0], normal[1], normal[2]);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function hexToRgb(hex) {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  if (isNaN(num)) return null;
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

export function decodeSlotFromPaintColor(str) {
  if (!str) return null;
  const s = str.trim().toUpperCase();
  const codeMap = [
    { code: 'FC', slot: 16 }, { code: 'EC', slot: 15 }, { code: 'DC', slot: 14 },
    { code: 'CC', slot: 13 }, { code: 'BC', slot: 12 }, { code: 'AC', slot: 11 },
    { code: '9C', slot: 10 }, { code: '8C', slot: 9 },  { code: '5C', slot: 8 },
    { code: '4C', slot: 7 },  { code: '3C', slot: 6 },  { code: '2C', slot: 5 },
    { code: '1C', slot: 4 },  { code: '0C', slot: 3 },  { code: '8',  slot: 2 },
    { code: '4',  slot: 1 }
  ];
  for (const item of codeMap) {
    if (s.includes(item.code)) return item.slot;
  }
  const num = parseInt(s, 16);
  if (!isNaN(num) && num > 0 && num <= 16) return num;
  return null;
}

/**
 * Extract embedded slicer preview thumbnail (plate_1.png etc.) from 3MF package if available
 */
export async function extract3MFThumbnail(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const plateImg = zip.file(/Metadata\/(plate_1|top_1|plate_1_small)\.png$/i);
    if (plateImg && plateImg.length > 0) {
      const base64 = await plateImg[0].async('base64');
      return `data:image/png;base64,${base64}`;
    }
    const genericThumbs = zip.file(/thumbnail\.(png|jpg|jpeg)$/i);
    if (genericThumbs && genericThumbs.length > 0) {
      const ext = genericThumbs[0].name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      const base64 = await genericThumbs[0].async('base64');
      return `data:image/${ext};base64,${base64}`;
    }
  } catch (e) {
    console.warn('Could not extract embedded 3MF thumbnail:', e);
  }
  return null;
}

/**
 * Parses 3MF XML model package from buffer using JSZip with multi-object, Bambu/OrcaSlicer color & 3MF material support
 */
export async function parse3MF(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // 1. Extract filament colors from Bambu / OrcaSlicer project config if present
  let filamentColours = [];
  const projSettingsFile = zip.file(/Metadata\/project_settings\.config$/i)?.[0];
  if (projSettingsFile) {
    try {
      const text = await projSettingsFile.async('text');
      const m = text.match(/\"filament_colour\":\s*\[(.*?)\]/s);
      if (m) {
        filamentColours = JSON.parse('[' + m[1] + ']').map(c => c.trim());
      }
    } catch (e) {
      console.warn('Could not parse project_settings.config in 3MF:', e);
    }
  }

  // 2. Extract object/part extruders from model_settings.config
  const objectExtruders = {};
  const partExtruders = {};
  const modelSettingsFile = zip.file(/Metadata\/model_settings\.config$/i)?.[0];
  if (modelSettingsFile) {
    try {
      const text = await modelSettingsFile.async('text');
      const objMatches = text.matchAll(/<object\s+id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/object>/gi);
      for (const match of objMatches) {
        const objId = match[1];
        const objBlock = match[2];
        const extMatch = objBlock.match(/<metadata\s+key=["']extruder["']\s+value=["'](\d+)["']/i);
        if (extMatch) objectExtruders[objId] = parseInt(extMatch[1], 10);

        const partMatches = objBlock.matchAll(/<part\s+id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/part>/gi);
        for (const pMatch of partMatches) {
          const pId = pMatch[1];
          const pBlock = pMatch[2];
          const pExt = pBlock.match(/<metadata\s+key=["']extruder["']\s+value=["'](\d+)["']/i);
          if (pExt) partExtruders[pId] = parseInt(pExt[1], 10);
        }
      }
    } catch (e) {
      console.warn('Could not parse model_settings.config in 3MF:', e);
    }
  }

  // 3. Map component paths in 3dmodel.model to object extruders
  const mainModel = zip.file('3D/3dmodel.model');
  const compExtruders = {};
  if (mainModel) {
    try {
      const text = await mainModel.async('text');
      const objMatches = text.matchAll(/<object\s+id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/object>/gi);
      for (const match of objMatches) {
        const rootObjId = match[1];
        const rootExtruder = objectExtruders[rootObjId];
        if (rootExtruder) {
          const compMatches = match[2].matchAll(/<component\s+[^>]*p:path=["']([^"']+)["'][^>]*objectid=["']([^"']+)["']/gi);
          for (const c of compMatches) {
            const compPath = c[1].replace(/^\//, '');
            compExtruders[compPath + '#' + c[2]] = rootExtruder;
          }
        }
      }
    } catch (e) {}
  }

  // 4. Find all .model XML files in the 3MF package
  const modelFiles = zip.file(/.*\.model$/i);
  if (!modelFiles || modelFiles.length === 0) {
    throw new Error('Keine 3D-Modelldatei (.model) im 3MF Paket gefunden');
  }

  const positions = [];
  const colors = [];
  let hasAnyColor = false;

  for (const modelFile of modelFiles) {
    const modelXmlText = await modelFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(modelXmlText, 'text/xml');
    const relName = modelFile.name.replace(/^\//, '');

    // Parse Standard 3MF Color Groups & Base Materials
    const colorGroups = {};
    const colorGroupEls = Array.from(xmlDoc.getElementsByTagName('*')).filter(el => 
      el.localName.toLowerCase() === 'colorgroup' || el.localName.toLowerCase() === 'basematerials'
    );
    for (const cg of colorGroupEls) {
      const id = cg.getAttribute('id');
      const list = [];
      const children = Array.from(cg.getElementsByTagName('*'));
      for (const ch of children) {
        const cHex = ch.getAttribute('color') || ch.getAttribute('displaycolor');
        if (cHex) list.push(cHex);
      }
      if (id && list.length > 0) colorGroups[id] = list;
    }

    const objectEls = Array.from(xmlDoc.getElementsByTagName('*')).filter(el => el.localName.toLowerCase() === 'object');
    const objectsToProcess = objectEls.length > 0 ? objectEls : [xmlDoc.documentElement];

    for (const objEl of objectsToProcess) {
      const objId = objEl.getAttribute('id') || '1';
      const objExtruder = compExtruders[relName + '#' + objId] || objectExtruders[objId] || 1;
      const defaultHex = filamentColours[objExtruder - 1] || null;

      const meshes = Array.from(objEl.getElementsByTagName('*')).filter(el => el.localName.toLowerCase() === 'mesh');
      for (const mesh of meshes) {
        const meshChildren = Array.from(mesh.getElementsByTagName('*'));
        const verticesEls = meshChildren.filter(el => el.localName.toLowerCase() === 'vertex');
        const trianglesEls = meshChildren.filter(el => el.localName.toLowerCase() === 'triangle');

        const rawVertices = verticesEls.map(v => ({
          x: parseFloat(v.getAttribute('x') || 0),
          y: parseFloat(v.getAttribute('y') || 0),
          z: parseFloat(v.getAttribute('z') || 0)
        }));

        for (const t of trianglesEls) {
          const v1 = rawVertices[parseInt(t.getAttribute('v1'), 10)];
          const v2 = rawVertices[parseInt(t.getAttribute('v2'), 10)];
          const v3 = rawVertices[parseInt(t.getAttribute('v3'), 10)];
          if (!v1 || !v2 || !v3) continue;

          positions.push(v1.x, v1.y, v1.z);
          positions.push(v2.x, v2.y, v2.z);
          positions.push(v3.x, v3.y, v3.z);

          // Resolve color
          let triHex = defaultHex;
          const paintColorAttr = t.getAttribute('paint_color');
          if (paintColorAttr) {
            const slot = decodeSlotFromPaintColor(paintColorAttr);
            if (slot && filamentColours[slot - 1]) {
              triHex = filamentColours[slot - 1];
            }
          } else {
            const pid = t.getAttribute('pid');
            const p1 = parseInt(t.getAttribute('p1'), 10);
            if (pid && !isNaN(p1) && colorGroups[pid]?.[p1]) {
              triHex = colorGroups[pid][p1];
            }
          }

          const rgb = hexToRgb(triHex);
          if (rgb) {
            hasAnyColor = true;
            colors.push(...rgb, ...rgb, ...rgb);
          } else {
            colors.push(0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7);
          }
        }
      }
    }
  }

  // Regex fallback if DOM parser didn't find triangles
  if (positions.length === 0) {
    for (const modelFile of modelFiles) {
      const xml = await modelFile.async('text');
      const vertexRegex = /<(?:\w+:)?vertex\b[^>]*\bx=["']([^"']+)["'][^>]*\by=["']([^"']+)["'][^>]*\bz=["']([^"']+)["'][^>]*\/?>/gi;
      const triangleRegex = /<(?:\w+:)?triangle\b[^>]*\bv1=["']([^"']+)["'][^>]*\bv2=["']([^"']+)["'][^>]*\bv3=["']([^"']+)["']([^>]*)\/?>/gi;

      const rawVertices = [];
      let match;
      while ((match = vertexRegex.exec(xml)) !== null) {
        rawVertices.push({
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3])
        });
      }

      while ((match = triangleRegex.exec(xml)) !== null) {
        const v1 = rawVertices[parseInt(match[1], 10)];
        const v2 = rawVertices[parseInt(match[2], 10)];
        const v3 = rawVertices[parseInt(match[3], 10)];
        if (!v1 || !v2 || !v3) continue;

        positions.push(v1.x, v1.y, v1.z);
        positions.push(v2.x, v2.y, v2.z);
        positions.push(v3.x, v3.y, v3.z);

        const restAttr = match[4] || '';
        const paintMatch = restAttr.match(/paint_color=["']([^"']+)["']/i);
        let rgb = null;
        if (paintMatch) {
          const slot = decodeSlotFromPaintColor(paintMatch[1]);
          if (slot && filamentColours[slot - 1]) {
            rgb = hexToRgb(filamentColours[slot - 1]);
          }
        }
        if (!rgb && filamentColours.length > 0) {
          rgb = hexToRgb(filamentColours[0]);
        }

        if (rgb) {
          hasAnyColor = true;
          colors.push(...rgb, ...rgb, ...rgb);
        } else {
          colors.push(0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7);
        }
      }
    }
  }

  if (positions.length === 0) {
    throw new Error('Keine 3D-Polygon-Daten im 3MF Paket gefunden');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (hasAnyColor && colors.length === positions.length) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.userData.hasVertexColors = true;
  }
  geometry.userData.filamentColors = filamentColours;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Calculate geometry dimensions, bounding box & volume in cm3
 */
export function analyzeGeometry(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  
  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);

  // Approximate volume in cm3 (from mm3)
  const pos = geometry.attributes.position;
  let volume = 0;
  if (pos) {
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      p1.fromBufferAttribute(pos, i);
      p2.fromBufferAttribute(pos, i + 1);
      p3.fromBufferAttribute(pos, i + 2);
      volume += p1.dot(p2.cross(p3)) / 6.0;
    }
  }
  const volumeCm3 = Math.max(0, Math.abs(volume) / 1000); // 1 cm3 = 1000 mm3

  // Estimated filament weight in grams (PLA density ~1.24 g/cm3, with infill factor)
  const estimatedWeightGrams = (volumeCm3 * 1.24 * 0.35).toFixed(1);

  return {
    dimensions: {
      x: parseFloat(size.x.toFixed(2)),
      y: parseFloat(size.y.toFixed(2)),
      z: parseFloat(size.z.toFixed(2))
    },
    center,
    volumeCm3: parseFloat(volumeCm3.toFixed(2)),
    estimatedWeightGrams,
    triangles: pos ? pos.count / 3 : 0,
    vertices: pos ? pos.count : 0
  };
}

/**
 * Center geometry and place directly on the build bed (Z=0 / Y=0 depending on orientation)
 */
export function centerAndAlignGeometry(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Center X and Y, and set min Z to 0 so it sits on the print plate
  geometry.translate(-center.x, -box.min.y, -center.z);
  geometry.computeBoundingBox();
  return geometry;
}

// Shared off-screen WebGL context & render queue to prevent "Too many active WebGL contexts"
let sharedSnapshotRenderer = null;
let sharedSnapshotCanvas = null;
let snapshotQueue = Promise.resolve();

function getSharedSnapshotRenderer(width, height) {
  if (!sharedSnapshotCanvas) {
    sharedSnapshotCanvas = document.createElement('canvas');
  }
  if (!sharedSnapshotRenderer) {
    sharedSnapshotRenderer = new THREE.WebGLRenderer({
      canvas: sharedSnapshotCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power'
    });
    sharedSnapshotRenderer.setPixelRatio(1);

    // Gracefully handle context loss and restore
    sharedSnapshotCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('Snapshot WebGL context lost, will restore automatically...');
    }, false);

    sharedSnapshotCanvas.addEventListener('webglcontextrestored', () => {
      console.info('Snapshot WebGL context restored successfully');
    }, false);
  }

  if (sharedSnapshotCanvas.width !== width || sharedSnapshotCanvas.height !== height) {
    sharedSnapshotCanvas.width = width;
    sharedSnapshotCanvas.height = height;
    sharedSnapshotRenderer.setSize(width, height, false);
  }

  return { renderer: sharedSnapshotRenderer, canvas: sharedSnapshotCanvas };
}

/**
 * Generate a snapshot thumbnail PNG as Data URL from a geometry
 * Uses a single shared off-screen WebGL context with a mutex queue
 * to strictly prevent the "Too many active WebGL contexts" browser limit.
 */
export function generateThumbnailSnapshot(geometry, color = '#38bdf8', width = 400, height = 300) {
  if (!geometry) return Promise.resolve(null);

  const task = snapshotQueue.then(() => {
    return new Promise((resolve) => {
      try {
        const { renderer, canvas } = getSharedSnapshotRenderer(width, height);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

        const geomClone = geometry.clone();
        centerAndAlignGeometry(geomClone);
        geomClone.computeBoundingBox();
        const box = geomClone.boundingBox;
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 20;

        // Create model mesh (supports 3MF multi-color vertex colors)
        const hasColors = geomClone.hasAttribute('color');
        const material = new THREE.MeshStandardMaterial({
          color: hasColors ? 0xffffff : new THREE.Color(color),
          vertexColors: hasColors,
          metalness: 0.2,
          roughness: 0.4
        });
        const mesh = new THREE.Mesh(geomClone, material);
        scene.add(mesh);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
        dirLight1.position.set(maxDim * 2, maxDim * 3, maxDim * 2.5);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6);
        dirLight2.position.set(-maxDim * 2, maxDim * 1.5, -maxDim * 2);
        scene.add(dirLight2);

        // Camera position
        const distance = maxDim * 2.2;
        camera.position.set(distance * 0.9, distance * 0.8, distance * 1.1);
        camera.lookAt(0, size.y / 2, 0);

        renderer.clear();
        renderer.render(scene, camera);
        const dataUrl = canvas.toDataURL('image/png');

        // Cleanup only scene items, leaving shared renderer & canvas alive
        scene.remove(mesh);
        scene.remove(ambientLight);
        scene.remove(dirLight1);
        scene.remove(dirLight2);
        geomClone.dispose();
        material.dispose();

        resolve(dataUrl);
      } catch (e) {
        console.error('Failed to generate thumbnail:', e);
        resolve(null);
      }
    });
  });

  snapshotQueue = task.catch(() => null);
  return task;
}
