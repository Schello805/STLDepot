import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { calculateFileGeometry } from '../server/utils/geometryCalculator.js';

describe('geometryCalculator - STL & 3D Math Engine', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stl-test-'));

  /**
   * Helper to write an ASCII STL representing a simple unit cube (10x10x10 mm = 1 cm3).
   * 12 triangles (2 per cube face).
   */
  function createUnitCubeAsciiSTL(filePath) {
    const stlContent = `solid cube
facet normal 0 0 1
  outer loop
    vertex 0 0 10
    vertex 10 0 10
    vertex 10 10 10
  endloop
endfacet
facet normal 0 0 1
  outer loop
    vertex 0 0 10
    vertex 10 10 10
    vertex 0 10 10
  endloop
endfacet
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 10 10 0
    vertex 10 0 0
  endloop
endfacet
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 0 10 0
    vertex 10 10 0
  endloop
endfacet
facet normal 0 1 0
  outer loop
    vertex 0 10 0
    vertex 10 10 10
    vertex 10 10 0
  endloop
endfacet
facet normal 0 1 0
  outer loop
    vertex 0 10 0
    vertex 0 10 10
    vertex 10 10 10
  endloop
endfacet
facet normal 0 -1 0
  outer loop
    vertex 0 0 0
    vertex 10 0 0
    vertex 10 0 10
  endloop
endfacet
facet normal 0 -1 0
  outer loop
    vertex 0 0 0
    vertex 10 0 10
    vertex 0 0 10
  endloop
endfacet
facet normal 1 0 0
  outer loop
    vertex 10 0 0
    vertex 10 10 10
    vertex 10 0 10
  endloop
endfacet
facet normal 1 0 0
  outer loop
    vertex 10 0 0
    vertex 10 10 0
    vertex 10 10 10
  endloop
endfacet
facet normal -1 0 0
  outer loop
    vertex 0 0 0
    vertex 0 0 10
    vertex 0 10 10
  endloop
endfacet
facet normal -1 0 0
  outer loop
    vertex 0 0 0
    vertex 0 10 10
    vertex 0 10 0
  endloop
endfacet
endsolid cube`;

    fs.writeFileSync(filePath, stlContent, 'utf8');
  }

  it('calculates volume and triangles accurately for ASCII STL cube', async () => {
    const cubePath = path.join(tempDir, 'cube_ascii.stl');
    createUnitCubeAsciiSTL(cubePath);

    const geo = await calculateFileGeometry(cubePath, 'PLA', 1.24, 1.0); // 100% infill
    assert.ok(geo);
    assert.equal(geo.triangles, 12);
    // 10x10x10 mm = 1000 mm3 = 1 cm3
    assert.equal(Math.round(geo.volumeCm3 * 100) / 100, 1.0);
    // At 1.24 g/cm3 and 100% infill: 1.2g (rounded to 1 decimal)
    assert.equal(geo.weightGrams, 1.2);

    fs.unlinkSync(cubePath);
  });

  it('scales weight correctly with infill factor (e.g. 0.35)', async () => {
    const cubePath = path.join(tempDir, 'cube_infill.stl');
    createUnitCubeAsciiSTL(cubePath);

    const geo = await calculateFileGeometry(cubePath, 'PLA', 1.24, 0.35);
    assert.ok(geo);
    // 1 cm3 * 1.24 * 0.35 = 0.434g -> 0.4g (rounded to 1 decimal)
    assert.equal(geo.weightGrams, 0.4);

    fs.unlinkSync(cubePath);
  });

  it('handles non-existent file path safely without throwing', async () => {
    const geo = await calculateFileGeometry('/path/that/does/not/exist.stl');
    assert.deepEqual(geo, { volumeCm3: 0, weightGrams: 0, triangles: 0 });
  });

  it('handles empty or corrupt file safely', async () => {
    const emptyPath = path.join(tempDir, 'empty.stl');
    fs.writeFileSync(emptyPath, Buffer.alloc(10));

    const geo = await calculateFileGeometry(emptyPath);
    assert.deepEqual(geo, { volumeCm3: 0, weightGrams: 0, triangles: 0 });

    fs.unlinkSync(emptyPath);
  });
});
