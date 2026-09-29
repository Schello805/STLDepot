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
  AlertCircle
} from 'lucide-react';
import { parseSTL, parse3MF, generateThumbnailSnapshot } from '../utils/threeUtils';
import confetti from 'canvas-confetti';

export default function UploadModal({ onClose, onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Deko & Haushalt');
  const [author, setAuthor] = useState('');
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

    // Auto set title if not set
    if (!title && validFiles[0]) {
      const baseName = validFiles[0].name.replace(/\.[^/.]+$/, "");
      const formattedTitle = baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      setTitle(formattedTitle);
    }

    // Attempt to generate 3D thumbnail automatically from first STL/3MF file
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
        console.warn('Could not pre-render thumbnail:', err);
      }
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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
    if (!title.trim()) {
      setError('Bitte gib einen Titel für das Modell ein.');
      return;
    }
    if (files.length === 0) {
      setError('Bitte wähle mindestens eine 3D-Datei (.stl, .3mf) aus.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('author', author.trim());
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

      const res = await fetch('/api/models', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Neues 3D-Modell hinzufügen</h2>
              <p className="text-xs text-slate-400">STL, 3MF oder ZIP-Baugruppen in deinen Katalog laden</p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Dateien auswählen oder ablegen *
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileChange(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition-all text-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".stl,.3mf,.zip,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files)}
              />
              <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-cyan-500/20 text-slate-400 group-hover:text-cyan-400 flex items-center justify-center mb-3 transition-colors">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200 group-hover:text-white">
                Klicke hier oder ziehe .STL / .3MF Dateien hinein
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Unterstützt Einzelteile, mehrteilige Baugruppen und Projekt-Bilder
              </p>
            </div>

            {/* Selected Files List */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 px-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileBox className="w-4 h-4 text-cyan-400" />
                      <span className="text-slate-200 font-medium">{file.name}</span>
                      <span className="text-slate-500 font-mono text-[11px]">({(file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model Meta Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Title */}
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
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

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

            {/* Author */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Autor / Ersteller
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Michael Schellenberger"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Filament Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Filament-Typ
              </label>
              <select
                value={filamentType}
                onChange={(e) => setFilamentType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {filamentOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Filament Color */}
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

            {/* Infill % */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Infill ({infill}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={infill}
                onChange={(e) => setInfill(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Print Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Geschätzte Druckzeit (Minuten)
              </label>
              <input
                type="number"
                value={printTime}
                onChange={(e) => setPrintTime(e.target.value)}
                placeholder="z. B. 120"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Nozzle Size */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Düsengröße (mm)
              </label>
              <select
                value={nozzleSize}
                onChange={(e) => setNozzleSize(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="0.2">0.2 mm</option>
                <option value="0.4">0.4 mm (Standard)</option>
                <option value="0.6">0.6 mm</option>
                <option value="0.8">0.8 mm</option>
              </select>
            </div>

            {/* Supports Toggle */}
            <div className="flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={supports}
                  onChange={(e) => setSupports(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                <span className="ml-3 text-sm font-medium text-slate-300">Stützen (Supports) erforderlich</span>
              </label>
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Beschreibung
              </label>
              <textarea
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung des 3D-Modells..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Tags Input */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Schlagwörter / Tags (mit Enter hinzufügen)
              </label>
              <div className="flex flex-wrap gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-cyan-300">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-white">✕</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDownTag}
                  placeholder="Tag eingeben..."
                  className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none min-w-[120px]"
                />
              </div>
            </div>

            {/* Notes & Source URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Quelle URL (z. B. Printables, MakerWorld, Thingiverse)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://makerworld.com/..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Drucknotizen & Tipps
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="z. B. 4 Wandlinien für Stabilität"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

          </div>

          {/* Submit Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Speichere Modell...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Modell im Katalog speichern</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
