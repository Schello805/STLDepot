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
    assert.match(content.version, /^\d+\.\d+\.\d+$/, 'Should have a semantic app version');
    assert.ok(typeof content.commitCount === 'number', 'commitCount should be a number');
    assert.ok(content.commitHash, 'Should have commitHash');

    const packageVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
    const [major, minor] = packageVersion.split('.');
    assert.equal(content.version, `${major}.${minor}.${content.commitCount}`);

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

  it('sanitizes titles with umlauts and symbols without regex range syntax error', () => {
    const testTitle = 'Gehäuse für Lötkolben & Zubehör_1 - äöüÄÖÜß';
    const safeBatchTitle = testTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß_\- ]/g, '_').trim();
    assert.equal(safeBatchTitle, 'Gehäuse für Lötkolben _ Zubehör_1 - äöüÄÖÜß');

    const safeDownloadTitle = testTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
    assert.equal(safeDownloadTitle, 'Geh_use_f_r_L_tkolben___Zubeh_r_1_-________');
  });
});
