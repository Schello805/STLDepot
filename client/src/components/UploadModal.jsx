import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileBox, 
  Trash2, 
  Sparkles, 
  Plus, 
  Check, 
  Layers, 
  Clock, 
  Ruler, 
  Palette,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Files,
  FolderArchive
} from 'lucide-react';
import { parseSTL, parse3MF, generateThumbnailSnapshot } from '../utils/threeUtils';
import confetti from 'canvas-confetti';

export default function UploadModal({ onClose, onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [uploadMode, setUploadMode] = useState('single'); // 'single', 'batch', 'assembly'
  
  // Basic metadata
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Deko & Haushalt');
  const [author, setAuthor] = useState('');
  
  // Collapsed advanced print parameters (closed by default!)
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced print parameters
  const [description, setDescription] = useState('');
  const [filamentType, setFilamentType] = useState('PLA');
  const [filamentColor, setFilamentColor] = useState('#38bdf8');
  const [infill, setInfill] = useState(15);
  const [printTime, setPrintTime] = useState('');
  const [nozzleSize, setNozzleSize] = useState(0.4);
  const [supports, setSupports] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);

  const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const categories = [
    'Deko & Haushalt',
    'Werkstatt & Tools',
    '3D-Druck Zubehör',
    'Gadgets & Elektronik',
    'Tabletop & Gaming',
    'Prototypen',
    'Kalibrierung & Test',
    'Sonstiges'
  ];

  const filamentOptions = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU / Flex', 'PCTG', 'Nylon / PA', 'PC', 'Resin'];

  const handleFileChange = async (newFiles) => {
    const validFiles = Array.from(newFiles);
    if (validFiles.length === 0) return;

    setFiles(prev => [...prev, ...validFiles]);

    // Automatically switch to batch mode if more than 1 file is selected and not already in assembly mode
    if (validFiles.length > 1 || files.length + validFiles.length > 1) {
      setUploadMode('batch');
    }

    // Auto set title from first file if empty
    if (!title && validFiles[0]) {
      const baseName = validFiles[0].name.replace(/\.[^/.]+$/, "");
      const formattedTitle = baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      setTitle(formattedTitle);
    }

    // Auto-generate 3D thumbnail immediately
    const first3d = validFiles.find(f => f.name.toLowerCase().endsWith('.stl') || f.name.toLowerCase().endsWith('.3mf'));
    if (first3d && !thumbnailDataUrl) {
      try {
        const buffer = await first3d.arrayBuffer();
        let geom;
        if (first3d.name.toLowerCase().endsWith('.3mf')) {
          geom = await parse3MF(buffer);
        } else {
          geom = parseSTL(buffer);
        }
        const thumbUrl = await generateThumbnailSnapshot(geom, filamentColor, 600, 450);
        if (thumbUrl) {
          setThumbnailDataUrl(thumbUrl);
        }
      } catch (err) {
        console.warn('Preview snapshot note:', err);
      }
    }
  };

  const removeFile = (index) => {
    const remaining = files.filter((_, i) => i !== index);
    setFiles(remaining);
    if (remaining.length <= 1) {
      setUploadMode('single');
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleKeyDownTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Bitte wähle mindestens eine 3D-Datei (.stl, .3mf) aus.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(10);

    try {
      // BULK MODE: Upload hundreds of files as individual models in chunks
      if (uploadMode === 'batch' && files.length > 1) {
        const CHUNK_SIZE = 25;
        const totalFiles = files.length;
        let processed = 0;

        for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
          const chunk = files.slice(i, i + CHUNK_SIZE);
          const formData = new FormData();
          formData.append('category', category);
          formData.append('author', author.trim() || 'Michael Schellenberger');
          formData.append('filament_type', filamentType);
          formData.append('filament_color', filamentColor);
          formData.append('tags', JSON.stringify(tags));

          for (const file of chunk) {
            formData.append('files', file);
          }

          const res = await fetch('/api/models/batch', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Fehler beim Massen-Upload');
          }

          processed += chunk.length;
          setUploadProgress(Math.round((processed / totalFiles) * 100));
        }

        confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
        onUploadSuccess();
        onClose();
        return;
      }

      // SINGLE or MULTI-PART ASSEMBLY PROJECT MODE
      if (!title.trim()) {
        setError('Bitte gib einen Titel für das Modell ein.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('author', author.trim() || 'Michael Schellenberger');
      formData.append('filament_type', filamentType);
      formData.append('filament_color', filamentColor);
      formData.append('infill_percentage', infill);
      formData.append('print_time_minutes', parseInt(printTime, 10) || 0);
      formData.append('nozzle_size', nozzleSize);
      formData.append('supports_needed', supports ? 1 : 0);
      formData.append('source_url', sourceUrl.trim());
      formData.append('notes', notes.trim());
      formData.append('tags', JSON.stringify(tags));

      if (thumbnailDataUrl) {
        formData.append('thumbnail_base64', thumbnailDataUrl);
      }

      for (const file of files) {
        formData.append('files', file);
      }

      setUploadProgress(60);
      const res = await fetch('/api/models', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

      setUploadProgress(100);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.7 } });
      onUploadSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Verbindungsfehler zum Server');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">3D-Modelle hinzufügen</h2>
              <p className="text-xs text-slate-400">Einzelne Modelle, Baugruppen oder Massen-Upload (auch hunderte Dateien)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileChange(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-950/60 hover:bg-slate-950/80 transition-all text-center group shadow-inner"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".stl,.3mf,.zip,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files)}
              />
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                Klicke hier oder ziehe STL- / 3MF-Dateien hinein
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Einfach Dateien oder ganze Sammlungen auswählen – auch hunderte Dateien auf einmal möglich!
              </p>
            </div>

            {/* Multiple files mode selector */}
            {files.length > 1 && (
              <div className="mt-4 p-3 bg-slate-950/70 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Files className="w-4 h-4 text-cyan-400" />
                  <span><strong>{files.length} Dateien</strong> ausgewählt</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setUploadMode('batch')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                      uploadMode === 'batch'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚡ Massen-Upload (jede Datei einzeln)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('assembly')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                      uploadMode === 'assembly'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    📦 Baugruppe (1 Projekt)
                  </button>
                </div>
              </div>
            )}

            {/* Selected Files List preview */}
            {files.length > 0 && (
              <div className="mt-3 max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {files.slice(0, 15).map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 px-3 bg-slate-950/50 rounded-xl border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileBox className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-slate-200 truncate">{file.name}</span>
                      <span className="text-slate-500 font-mono text-[10px]">({(file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-500 hover:text-red-400 transition ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {files.length > 15 && (
                  <div className="text-center text-xs text-slate-400 py-1 font-mono">
                    + {files.length - 15} weitere Dateien in der Warteschlange...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Simple Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Title only needed for single or assembly mode */}
            {uploadMode !== 'batch' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Titel des Modells *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. Hexagon Kabelhalter V2"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Kategorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filament Color (Quick Picker) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Vorschau-Farbe (Filament)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={filamentColor}
                  onChange={(e) => setFilamentColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={filamentColor}
                  onChange={(e) => setFilamentColor(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono uppercase"
                />
              </div>
            </div>

          </div>

          {/* Collapsible Advanced Print Parameters Accordion (COLLAPSED BY DEFAULT) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/60 transition"
            >
              <span className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-cyan-400" />
                <span>Erweiterte Druckinfos & Notizen (optional)</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Filament-Material
                    </label>
                    <select
                      value={filamentType}
                      onChange={(e) => setFilamentType(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      {filamentOptions.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Infill ({infill}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={infill}
                      onChange={(e) => setInfill(parseInt(e.target.value, 10))}
                      className="w-full accent-cyan-500 cursor-pointer mt-2"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Druckzeit (Minuten)
                    </label>
                    <input
                      type="number"
                      value={printTime}
                      onChange={(e) => setPrintTime(e.target.value)}
                      placeholder="z. B. 60"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Düse (Nozzle mm)
                    </label>
                    <select
                      value={nozzleSize}
                      onChange={(e) => setNozzleSize(parseFloat(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="0.2">0.2 mm</option>
                      <option value="0.4">0.4 mm (Standard)</option>
                      <option value="0.6">0.6 mm</option>
                      <option value="0.8">0.8 mm</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Schlagwörter / Tags
                    </label>
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl">
                      {tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-800 text-xs text-cyan-300">
                          #{tag}
                          <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-white">✕</button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleKeyDownTag}
                        placeholder="Tag eingeben (Enter)..."
                        className="flex-1 bg-transparent text-xs text-slate-100 focus:outline-none min-w-[120px]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Notizen & Druckhinweise
                    </label>
                    <textarea
                      rows="2"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="z. B. Mit Brim drucken für bessere Haftung..."
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Lade {files.length} Modelle hoch...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Speichere {files.length} Modelle...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{files.length > 1 && uploadMode === 'batch' ? `Alle ${files.length} Modelle speichern` : 'Im Katalog speichern'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
