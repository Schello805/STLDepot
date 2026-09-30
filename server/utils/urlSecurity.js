import dns from 'dns/promises';
import net from 'net';

/**
 * Checks whether an IP address belongs to private, loopback, link-local, or reserved ranges.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateIP(ip) {
  if (!ip) return true;

  // Handle IPv4
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true; // Malformed IPv4
    }

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;

    // 10.0.0.0/8 (Private network)
    if (parts[0] === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;

    // 169.254.0.0/16 (Link-local / Cloud Metadata like 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;

    // 172.16.0.0/12 (Private network / Docker default subnets)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16 (Private LAN)
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;

    // 255.255.255.255 (Broadcast)
    if (ip === '255.255.255.255') return true;

    return false;
  }

  // Handle IPv6
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    // Loopback (::1) & Unspecified (::)
    if (norm === '::1' || norm === '::') return true;

    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (norm.startsWith('::ffff:')) {
      const ipv4Part = norm.substring(7);
      return isPrivateIP(ipv4Part);
    }

    // Unique Local Addresses (fc00::/7)
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;

    // Link-Local Unicast (fe80::/10)
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;

    return false;
  }

  return true; // Unknown format
}

/**
 * Validates a URL for SSRF security.
 * Rejects non-HTTP(S) protocols, local hostnames, and IP resolutions to private networks.
 *
 * @param {string} urlString
 * @returns {Promise<{ safe: boolean, error?: string, url?: URL }>}
 */
export async function validatePublicUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, error: 'Ungültige oder leere URL angegeben' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlString.trim());
  } catch {
    return { safe: false, error: 'URL-Format ist ungültig' };
  }

  // Enforce HTTP / HTTPS only
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { safe: false, error: `Protokoll "${parsedUrl.protocol}" ist nicht erlaubt. Nur http:// und https:// sind zulässig.` };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block obvious localhost / internal hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'caprover' ||
    hostname === 'captain'
  ) {
    return { safe: false, error: 'Zugriff auf lokale und interne Hostnamen ist nicht gestattet (SSRF-Schutz).' };
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { safe: false, error: 'Zugriff auf private IP-Adressen und Cloud-Metadaten ist gesperrt (SSRF-Schutz).' };
    }
  } else {
    // Resolve hostname to check destination IP
    try {
      const lookupResult = await dns.lookup(hostname, { all: true });
      for (const address of lookupResult) {
        if (isPrivateIP(address.address)) {
          return { safe: false, error: `Hostname "${hostname}" löst zu interner IP ${address.address} auf (SSRF-Schutz).` };
        }
      }
    } catch (dnsErr) {
      return { safe: false, error: `Hostname "${hostname}" konnte nicht im DNS aufgelöst werden: ${dnsErr.message}` };
    }
  }

  return { safe: true, url: parsedUrl };
}
