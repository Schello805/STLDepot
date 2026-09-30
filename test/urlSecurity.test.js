import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIP, validatePublicUrl } from '../server/utils/urlSecurity.js';

describe('SSRF Protection & URL Security Engine', () => {
  it('correctly identifies private and reserved IPv4 addresses', () => {
    // Loopback
    assert.equal(isPrivateIP('127.0.0.1'), true);
    assert.equal(isPrivateIP('127.10.20.30'), true);

    // Cloud Metadata service
    assert.equal(isPrivateIP('169.254.169.254'), true);
    assert.equal(isPrivateIP('169.254.1.1'), true);

    // Private Class A (10.0.0.0/8)
    assert.equal(isPrivateIP('10.0.0.1'), true);
    assert.equal(isPrivateIP('10.254.0.1'), true);

    // Private Class B (172.16.0.0/12 - Docker default bridges)
    assert.equal(isPrivateIP('172.17.0.1'), true);
    assert.equal(isPrivateIP('172.18.0.2'), true);
    assert.equal(isPrivateIP('172.31.255.254'), true);

    // Private Class C (192.168.0.0/16 - Home LAN)
    assert.equal(isPrivateIP('192.168.1.1'), true);
    assert.equal(isPrivateIP('192.168.178.1'), true);

    // Broadcast & 0.0.0.0
    assert.equal(isPrivateIP('0.0.0.0'), true);
    assert.equal(isPrivateIP('255.255.255.255'), true);

    // Public IPv4 (should be false)
    assert.equal(isPrivateIP('8.8.8.8'), false);
    assert.equal(isPrivateIP('1.1.1.1'), false);
    assert.equal(isPrivateIP('140.82.121.4'), false); // GitHub
  });

  it('correctly identifies private and loopback IPv6 addresses', () => {
    assert.equal(isPrivateIP('::1'), true);
    assert.equal(isPrivateIP('::'), true);
    assert.equal(isPrivateIP('fe80::1'), true);
    assert.equal(isPrivateIP('fc00::1'), true);
    assert.equal(isPrivateIP('::ffff:127.0.0.1'), true);
    assert.equal(isPrivateIP('::ffff:192.168.1.1'), true);
    assert.equal(isPrivateIP('::ffff:8.8.8.8'), false);
  });

  it('rejects disallowed schemes and invalid URLs', async () => {
    const fileRes = await validatePublicUrl('file:///etc/passwd');
    assert.equal(fileRes.safe, false);

    const ftpRes = await validatePublicUrl('ftp://ftp.example.com/model.stl');
    assert.equal(ftpRes.safe, false);

    const jsRes = await validatePublicUrl('javascript:alert(1)');
    assert.equal(jsRes.safe, false);

    const emptyRes = await validatePublicUrl('');
    assert.equal(emptyRes.safe, false);
  });

  it('blocks localhost, local domains and cloud metadata URLs', async () => {
    const local1 = await validatePublicUrl('http://localhost:3000/api');
    assert.equal(local1.safe, false);

    const local2 = await validatePublicUrl('http://127.0.0.1:8080');
    assert.equal(local2.safe, false);

    const metaRes = await validatePublicUrl('http://169.254.169.254/latest/meta-data/');
    assert.equal(metaRes.safe, false);

    const dockerRes = await validatePublicUrl('http://172.17.0.1:3000');
    assert.equal(dockerRes.safe, false);

    const capRes = await validatePublicUrl('http://captain/api');
    assert.equal(capRes.safe, false);
  });

  it('allows valid public HTTPS and HTTP URLs', async () => {
    const ghRes = await validatePublicUrl('https://github.com/Schello805/STLDepot');
    assert.equal(ghRes.safe, true);
    assert.equal(ghRes.url.hostname, 'github.com');
  });
});
