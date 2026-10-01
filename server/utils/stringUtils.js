/**
 * String and filename utility functions for robust Unicode/Umlaut support
 */

/**
 * Fixes filenames coming from Multer / Busboy where UTF-8 bytes were decoded as Latin-1 (binary).
 * e.g. "GehÃ¤use.stl" -> "Gehäuse.stl"
 * If the string is already clean UTF-8 or ASCII, it is returned untouched.
 *
 * @param {string} name - Raw filename from req.file.originalname
 * @returns {string} - Clean UTF-8 filename
 */
export function fixMulterFilename(name) {
  if (!name || typeof name !== 'string') return '';
  try {
    // If name contains bytes >= 0xC0 (typical start of UTF-8 multibyte sequences encoded as Latin-1/binary)
    if (/[\xC0-\xFF]/.test(name)) {
      const decoded = Buffer.from(name, 'binary').toString('utf8');
      // If decoding produces a valid UTF-8 string without replacement characters (\uFFFD)
      if (!decoded.includes('\uFFFD')) {
        return decoded;
      }
    }
  } catch {}
  return name;
}

/**
 * Formats a clean, readable project title from a filename or folder name.
 * Full Unicode support for German umlauts (ä, ö, ü, Ä, Ö, Ü, ß) and international characters.
 *
 * Examples:
 *   "gehäuse_lüfter_überdachung.stl" -> "Gehäuse Lüfter Überdachung"
 *   "überraschung_für_alle.3mf"     -> "Überraschung Für Alle"
 *   "größe_und_maße"                -> "Größe Und Maße"
 *   "äpfel_box"                     -> "Äpfel Box"
 *
 * @param {string} rawName - Filename or folder name
 * @returns {string} - Formatted title
 */
export function formatTitleFromFilename(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Modell';
  // Strip known file extensions
  const baseName = rawName.replace(/\.[a-zA-Z0-9]+$/, '');
  const cleaned = baseName
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!cleaned) return 'Modell';

  return cleaned
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Sanitizes a title for safe use in filenames and archive paths without stripping umlauts.
 * Replaces illegal filesystem characters (/ \ ? % * : | " < >) with underscores.
 *
 * @param {string} title
 * @returns {string} Safe filename
 */
export function sanitizeZipFilename(title) {
  if (!title || typeof title !== 'string') return 'Modell';
  const clean = title.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return clean || 'Modell';
}

/**
 * Sets an RFC 6266 / RFC 5987 compliant Content-Disposition header with UTF-8 support.
 * Modern browsers will use filename*=UTF-8'', while legacy clients fall back to filename="...".
 *
 * @param {import('express').Response} res
 * @param {string} filename
 * @param {'attachment' | 'inline'} type
 */
export function setContentDisposition(res, filename, type = 'attachment') {
  const safeName = sanitizeZipFilename(filename);
  const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(safeName);
  res.setHeader('Content-Disposition', `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`);
}
