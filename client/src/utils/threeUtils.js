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

/**
 * Parses 3MF XML model package from buffer using JSZip with multi-object & namespace support
 */
export async function parse3MF(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  
  // Find all .model XML files in the 3MF package
  const modelFiles = zip.file(/.*\.model$/i);
  if (!modelFiles || modelFiles.length === 0) {
    throw new Error('Keine 3D-Modelldatei (.model) im 3MF Paket gefunden');
  }

  const positions = [];

  for (const modelFile of modelFiles) {
    const modelXmlText = await modelFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(modelXmlText, 'text/xml');

    const allElements = Array.from(xmlDoc.getElementsByTagName('*'));
    const meshes = allElements.filter(el => el.localName.toLowerCase() === 'mesh');

    if (meshes.length > 0) {
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
          if (v1 && v2 && v3) {
            positions.push(v1.x, v1.y, v1.z);
            positions.push(v2.x, v2.y, v2.z);
            positions.push(v3.x, v3.y, v3.z);
          }
        }
      }
    } else {
      // Fallback: search all vertex and triangle nodes directly
      const verticesEls = allElements.filter(el => el.localName.toLowerCase() === 'vertex');
      const trianglesEls = allElements.filter(el => el.localName.toLowerCase() === 'triangle');

      const rawVertices = verticesEls.map(v => ({
        x: parseFloat(v.getAttribute('x') || 0),
        y: parseFloat(v.getAttribute('y') || 0),
        z: parseFloat(v.getAttribute('z') || 0)
      }));

      for (const t of trianglesEls) {
        const v1 = rawVertices[parseInt(t.getAttribute('v1'), 10)];
        const v2 = rawVertices[parseInt(t.getAttribute('v2'), 10)];
        const v3 = rawVertices[parseInt(t.getAttribute('v3'), 10)];
        if (v1 && v2 && v3) {
          positions.push(v1.x, v1.y, v1.z);
          positions.push(v2.x, v2.y, v2.z);
          positions.push(v3.x, v3.y, v3.z);
        }
      }
    }
  }

  // Fast regex fallback if XML DOM parser didn't match
  if (positions.length === 0) {
    for (const modelFile of modelFiles) {
      const xml = await modelFile.async('text');
      const vertexRegex = /<(?:\w+:)?vertex\b[^>]*\bx=["']([^"']+)["'][^>]*\by=["']([^"']+)["'][^>]*\bz=["']([^"']+)["'][^>]*\/?>/gi;
      const triangleRegex = /<(?:\w+:)?triangle\b[^>]*\bv1=["']([^"']+)["'][^>]*\bv2=["']([^"']+)["'][^>]*\bv3=["']([^"']+)["'][^>]*\/?>/gi;

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
        if (v1 && v2 && v3) {
          positions.push(v1.x, v1.y, v1.z);
          positions.push(v2.x, v2.y, v2.z);
          positions.push(v3.x, v3.y, v3.z);
        }
      }
    }
  }

  if (positions.length === 0) {
    throw new Error('Keine 3D-Polygon-Daten im 3MF Paket gefunden');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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

/**
 * Generate a snapshot thumbnail PNG as Data URL from a geometry
 */
export function generateThumbnailSnapshot(geometry, color = '#38bdf8', width = 400, height = 300) {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

      const geomClone = geometry.clone();
      centerAndAlignGeometry(geomClone);
      geomClone.computeBoundingBox();
      const box = geomClone.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 20;

      // Create model mesh
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
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

      renderer.render(scene, camera);
      const dataUrl = canvas.toDataURL('image/png');

      renderer.dispose();
      geomClone.dispose();
      material.dispose();

      resolve(dataUrl);
    } catch (e) {
      console.error('Failed to generate thumbnail:', e);
      resolve(null);
    }
  });
}
