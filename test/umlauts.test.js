import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { fixMulterFilename, formatTitleFromFilename, sanitizeZipFilename, setContentDisposition } from '../server/utils/stringUtils.js';
import modelsRouter from '../server/routes/models.js';
import { initDB, db } from '../server/db.js';

describe('Unicode & Umlauts Support Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    initDB();

    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    app.use('/api/models', modelsRouter);

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

  describe('stringUtils unit tests', () => {
    it('fixMulterFilename decodes busboy latin1-encoded UTF-8 strings', () => {
      const original = 'Gehäuse_Größe_Überprüfung_Äpfel_Öffner_Schließer.stl';
      // Simulate Multer/Busboy behavior where UTF-8 bytes are read as binary/latin1
      const busboyEncoded = Buffer.from(original, 'utf8').toString('binary');
      assert.notEqual(busboyEncoded, original, 'Busboy encoding should produce Mojibake initially');

      const fixed = fixMulterFilename(busboyEncoded);
      assert.equal(fixed, original);
    });

    it('fixMulterFilename preserves pure ASCII strings untouched', () => {
      const ascii = 'standard_cube_v2_100mm.stl';
      assert.equal(fixMulterFilename(ascii), ascii);
    });

    it('fixMulterFilename preserves already clean UTF-8 strings untouched', () => {
      const utf8 = 'Gehäuse_Größe_Überprüfung_Äpfel_Öffner_Schließer.stl';
      assert.equal(fixMulterFilename(utf8), utf8);
    });

    it('formatTitleFromFilename cleanly formats German umlauts in title case', () => {
      assert.equal(
        formatTitleFromFilename('gehäuse_lüfter_überdachung.stl'),
        'Gehäuse Lüfter Überdachung'
      );
      assert.equal(
        formatTitleFromFilename('überraschung_für_alle.3mf'),
        'Überraschung Für Alle'
      );
      assert.equal(
        formatTitleFromFilename('größe_des_rahmens'),
        'Größe Des Rahmens'
      );
      assert.equal(
        formatTitleFromFilename('äpfel_schale.stl'),
        'Äpfel Schale'
      );
      assert.equal(
        formatTitleFromFilename('öffner_v2.stl'),
        'Öffner V2'
      );
    });

    it('sanitizeZipFilename strips dangerous filesystem characters while preserving umlauts', () => {
      const sanitized = sanitizeZipFilename('Gehäuse: Modell / Teil * 1 ? (Übergröße)');
      assert.equal(sanitized, 'Gehäuse_ Modell _ Teil _ 1 _ (Übergröße)');
    });

    it('setContentDisposition sets RFC 6266 / RFC 5987 UTF-8 header', () => {
      let headerValue = '';
      const mockRes = {
        setHeader: (name, val) => {
          if (name === 'Content-Disposition') headerValue = val;
        }
      };
      setContentDisposition(mockRes, 'Gehäuse für Arduino.zip');
      assert.ok(headerValue.includes('filename="Geh_use f_r Arduino.zip"'));
      assert.ok(headerValue.includes("filename*=UTF-8''Geh%C3%A4use%20f%C3%BCr%20Arduino.zip"));
    });
  });

  describe('Upload & Download HTTP Integration with Umlauts', () => {
    it('POST /api/models stores correct UTF-8 original filename in database', async () => {
      const form = new FormData();
      form.append('title', 'Test Gehäuse Projekt');
      form.append('category', 'Allgemein');
      const dummyFile = new Blob(['solid test\nendsolid test'], { type: 'model/stl' });
      form.append('files', dummyFile, 'Gehäuse_Größe.stl');

      const res = await fetch(`${baseUrl}/api/models`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.ok(data.projectId);

      // Verify database record
      const fileRecord = db.prepare('SELECT original_name FROM project_files WHERE project_id = ?').get(data.projectId);
      assert.ok(fileRecord, 'File record should exist in database');
      assert.equal(fileRecord.original_name, 'Gehäuse_Größe.stl');
    });

    it('POST /api/models/batch formats titles with umlauts correctly and preserves filenames', async () => {
      const form = new FormData();
      form.append('category', 'Allgemein');
      const dummyFile = new Blob(['solid test2\nendsolid test2'], { type: 'model/stl' });
      form.append('files', dummyFile, 'überraschung_für_alle.stl');

      const res = await fetch(`${baseUrl}/api/models/batch`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.equal(data.count, 1);

      const created = data.projects[0];
      assert.equal(created.title, 'Überraschung Für Alle');

      // Verify file record in database
      const fileRecord = db.prepare('SELECT original_name FROM project_files WHERE project_id = ?').get(created.id);
      assert.equal(fileRecord.original_name, 'überraschung_für_alle.stl');
    });

    it('GET /api/models/:id/download provides RFC-compliant UTF-8 Content-Disposition header', async () => {
      // Create project with umlauts in title
      const form = new FormData();
      form.append('title', 'Lüfter Düse');
      const dummyFile = new Blob(['solid d\nendsolid d'], { type: 'model/stl' });
      form.append('files', dummyFile, 'luefter.stl');

      const createRes = await fetch(`${baseUrl}/api/models`, {
        method: 'POST',
        body: form
      });
      const createData = await createRes.json();
      const projId = createData.projectId;

      const dlRes = await fetch(`${baseUrl}/api/models/${projId}/download`);
      assert.equal(dlRes.status, 200);
      const disposition = dlRes.headers.get('content-disposition');
      assert.ok(disposition, 'Content-Disposition header must be present');
      assert.ok(disposition.includes("filename*=UTF-8''L%C3%BCfter%20D%C3%BCse.zip"));
    });
  });
});
