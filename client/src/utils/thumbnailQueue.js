/**
 * Thumbnail Rendering Queue
 * Limits concurrent 3D file parsing and WebGL canvas snapshots to 1 at a time.
 * Prevents network congestion (browser 6-connection limit) and CPU starvation during page load.
 */

class ThumbnailQueue {
  constructor() {
    this.queue = [];
    this.active = false;
    this.processedIds = new Set();
  }

  /**
   * Enqueue a model for background 3D thumbnail generation
   * @param {Object} model - Project object
   * @param {Object} primaryFile - Main STL or 3MF file object
   * @param {Function} callback - Called with generated dataUrl
   * @returns {Function} - Cancel/unsubscribe function
   */
  enqueue(model, primaryFile, callback) {
    if (!model || !primaryFile || model.thumbnail_url) return () => {};

    // Don't queue the same model multiple times if already processed
    if (this.processedIds.has(model.id)) return () => {};

    const task = {
      modelId: model.id,
      fileId: primaryFile.id,
      fileType: primaryFile.file_type,
      filamentColor: model.filament_color || '#38bdf8',
      callback,
      cancelled: false
    };

    this.queue.push(task);
    this.processNext();

    return () => {
      task.cancelled = true;
    };
  }

  async processNext() {
    if (this.active || this.queue.length === 0) return;

    this.active = true;
    const task = this.queue.shift();

    if (task.cancelled) {
      this.active = false;
      this.processNext();
      return;
    }

    try {
      const response = await fetch(`/api/models/files/${task.fileId}/raw`, {
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('Fetch failed');

      const buffer = await response.arrayBuffer();

      const { parseSTL, parse3MF, generateThumbnailSnapshot, extract3MFThumbnail } = await import('./threeUtils');

      let dataUrl = null;
      if (task.fileType === '3mf') {
        dataUrl = await extract3MFThumbnail(buffer);
        if (!dataUrl) {
          const geom = await parse3MF(buffer);
          dataUrl = await generateThumbnailSnapshot(geom, task.filamentColor, 480, 360);
        }
      } else {
        const geom = parseSTL(buffer);
        dataUrl = await generateThumbnailSnapshot(geom, task.filamentColor, 480, 360);
      }

      if (dataUrl && !task.cancelled) {
        this.processedIds.add(task.modelId);
        task.callback(dataUrl);

        // Save thumbnail to backend in background
        fetch(`/api/models/${task.modelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbnail_base64: dataUrl })
        }).catch(() => {});
      }
    } catch (err) {
      // Ignore generation failure gracefully
    } finally {
      this.active = false;
      // Small pause to yield main thread event loop
      setTimeout(() => this.processNext(), 50);
    }
  }
}

export const thumbnailQueue = new ThumbnailQueue();
