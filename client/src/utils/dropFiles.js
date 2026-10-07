// Capture entries during the drop event; browsers may clear DataTransfer later.
export async function readDroppedFiles(dataTransfer) {
  const fallback = Array.from(dataTransfer.files || []);
  const entries = Array.from(dataTransfer.items || [])
    .filter(item => item.kind === 'file')
    .map(item => item.webkitGetAsEntry?.());
  if (!entries.some(Boolean)) return fallback;

  const files = [];
  async function visit(entry) {
    if (entry.isFile) {
      files.push(await new Promise((resolve, reject) => entry.file(resolve, reject)));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      // readEntries returns batches (often at most 100 entries).
      while (true) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await visit(child);
      }
    }
  }
  for (let index = 0; index < entries.length; index++) {
    if (entries[index]) await visit(entries[index]);
    else if (fallback[index]) files.push(fallback[index]);
  }
  return files.filter(file => /\.(stl|3mf|gcode|bgcode|zip|png|jpe?g|webp)$/i.test(file.name));
}
