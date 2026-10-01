/**
 * Utility functions for formatting strings and titles with full Unicode / Umlaut support.
 */

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
  if (!rawName || typeof rawName !== 'string') return '';
  // Strip known file extensions
  const baseName = rawName.replace(/\.[a-zA-Z0-9]+$/, '');
  const cleaned = baseName
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!cleaned) return '';

  return cleaned
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
