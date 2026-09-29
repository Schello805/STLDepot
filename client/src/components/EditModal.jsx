import React, { useState } from 'react';
import { 
  X, 
  Edit3, 
  Check, 
  AlertCircle,
  Trash2
} from 'lucide-react';

export default function EditModal({ model, onClose, onUpdated }) {
  if (!model) return null;

  const [title, setTitle] = useState(model.title || '');
  const [description, setDescription] = useState(model.description || '');
  const [category, setCategory] = useState(model.category || 'Allgemein');
  const [author, setAuthor] = useState(model.author || '');
  const [filamentType, setFilamentType] = useState(model.filament_type || 'PLA');
  const [filamentColor, setFilamentColor] = useState(model.filament_color || '#38bdf8');
  const [infill, setInfill] = useState(model.infill_percentage || 15);
  const [printTime, setPrintTime] = useState(model.print_time_minutes || '');
  const [nozzleSize, setNozzleSize] = useState(model.nozzle_size || 0.4);
  const [supports, setSupports] = useState(Boolean(model.supports_needed));
  const [sourceUrl, setSourceUrl] = useState(model.source_url || '');
  const [notes, setNotes] = useState(model.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(model.tags || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const categories = [
    'Deko & Haushalt',
    'Werkstatt & Tools',
    '3D-Druck Zubehör',
    'Gadgets & Elektronik',
    'Tabletop & Gaming',
    'Prototypen',
    'Kalibrierung & Test',
    'Importiert',
    'Sonstiges'
  ];

  const filamentOptions = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU / Flex', 'PCTG', 'Nylon / PA', 'PC', 'Resin'];

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
      setError('Titel darf nicht leer sein.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          author: author.trim(),
          filament_type: filamentType,
          filament_color: filamentColor,
          infill_percentage: infill,
          print_time_minutes: parseInt(printTime, 10) || 0,
          nozzle_size: nozzleSize,
          supports_needed: supports,
          source_url: sourceUrl.trim(),
          notes: notes.trim(),
          tags
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Aktualisierung fehlgeschlagen');
      }

      onUpdated();
      onClose();
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Modell-Metadaten bearbeiten</h2>
              <p className="text-xs text-slate-400">{model.title}</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Titel *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

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

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Autor
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

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

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Filament-Farbe
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

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Druckzeit (Minuten)
              </label>
              <input
                type="number"
                value={printTime}
                onChange={(e) => setPrintTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Beschreibung
              </label>
              <textarea
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Tags
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
                  placeholder="Tag hinzufügen..."
                  className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none min-w-[120px]"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Drucknotizen
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

          </div>

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
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Änderungen speichern</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
