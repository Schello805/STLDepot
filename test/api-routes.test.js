import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import modelsRouter from '../server/routes/models.js';
import webImportRouter from '../server/routes/webImport.js';
import systemRouter from '../server/routes/system.js';
import { db } from '../server/db.js';

describe('API Routes Integration & Security Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    app.use('/api/models', modelsRouter);
    app.use('/api/web-import', webImportRouter);
    app.use('/api/system', systemRouter);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api/system/info returns system status, version and storage paths', async () => {
    const res = await fetch(`${baseUrl}/api/system/info`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.stats);
    assert.ok(data.version);
    assert.ok(typeof data.stats.total_projects === 'number');
  });

  it('GET /api/models returns model list with count', async () => {
    const res = await fetch(`${baseUrl}/api/models`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(typeof data.count === 'number');
  });

  it('POST /api/web-import enforces SSRF protection against private IP targets', async () => {
    // Attack 1: Attempt to access local loopback
    const localRes = await fetch(`${baseUrl}/api/web-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:8080/admin' })
    });
    assert.equal(localRes.status, 403);
    const localData = await localRes.json();
    assert.equal(localData.success, false);
    assert.match(localData.error, /SSRF-Schutz/i);

    // Attack 2: Attempt to access AWS / GCP Cloud Metadata
    const metaRes = await fetch(`${baseUrl}/api/web-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data' })
    });
    assert.equal(metaRes.status, 403);
    const metaData = await metaRes.json();
    assert.equal(metaData.success, false);
    assert.match(metaData.error, /SSRF-Schutz/i);

    // Attack 3: Disallowed protocol (file://)
    const fileRes = await fetch(`${baseUrl}/api/web-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'file:///etc/passwd' })
    });
    assert.equal(fileRes.status, 403);
    const fileData = await fileRes.json();
    assert.equal(fileData.success, false);
  });

  it('POST /api/models/batch-download handles empty selection gracefully', async () => {
    const res = await fetch(`${baseUrl}/api/models/batch-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  it('GET /api/system/backup/json exports valid backup format', async () => {
    const res = await fetch(`${baseUrl}/api/system/backup/json`);
    assert.equal(res.status, 200);

    const backup = await res.json();
    assert.equal(backup.app, 'STLDepot');
    assert.ok(backup.backupVersion);
    assert.ok(Array.isArray(backup.projects));
    assert.ok(Array.isArray(backup.tags));
  });

  it('POST /api/system/restore/json validates payload structure', async () => {
    const badRes = await fetch(`${baseUrl}/api/system/restore/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true })
    });
    assert.equal(badRes.status, 400);

    const data = await badRes.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Ungültige Backup-Datei/i);
  });
});
