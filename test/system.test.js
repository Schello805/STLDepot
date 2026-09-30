import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('System, Revision & Version Sync', () => {
  it('reads server/version.json if present and validates revision format', () => {
    const versionPath = path.resolve('server/version.json');
    assert.ok(fs.existsSync(versionPath), 'server/version.json should exist');

    const content = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    assert.ok(content.revision, 'Should have a revision field');
    assert.ok(typeof content.commitCount === 'number', 'commitCount should be a number');
    assert.ok(content.commitHash, 'Should have commitHash');

    // Revision should follow count.hash (e.g. 26.dfadbf8)
    const parts = content.revision.split('.');
    assert.ok(parts.length >= 2, 'Revision should contain count and hash parts');
    assert.ok(!isNaN(parseInt(parts[0], 10)), 'First part should be a numeric count');
  });

  it('validates package.json scripts contain automated build and prebuild hooks', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.ok(pkg.scripts.prebuild, 'package.json must contain prebuild script');
    assert.ok(pkg.scripts.build, 'package.json must contain build script');
    assert.ok(pkg.scripts.test, 'package.json must contain test script');
  });
});
