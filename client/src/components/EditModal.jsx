import React, { useState, useRef } from 'react';
import { 
  X, 
  Edit3, 
  Check, 
  AlertCircle,
  Trash2,
  FileBox,
  Plus,
  Layers,
  Upload
} from 'lucide-react';
import { useDialog } from '../context/DialogContext';

export default function EditModal({ model, onClose, onUpdated }) {
  if (!model) return null;

  const { confirm, alert } = useDialog();
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
  const [files, setFiles] = useState(model.files || []);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const extraFileInputRef = useRef(null);

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

  const handleDeleteExistingFile = async (fileId) => {
    if (files.length <= 1) {
      await alert({
        title: 'Mindestens eine Datei erforderlich',
        message: 'Ein Modell muss mindestens eine 3D-Datei behalten. Lösche stattdessen bitte das gesamte Modell.',
        type: 'warning'
      });
      return;
    }

    const targetFile = files.find(f => f.id === fileId);
    const confirmed = await confirm({
      title: 'Datei entfernen',
      message: `Möchtest du die Datei "${targetFile?.original_filename || '3D-Datei'}" wirklich aus diesem Modell löschen?`,
      confirmText: 'Datei löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/models/${model.id}/files/${fileId}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
      } else {
        const data = await res.json().catch(() => ({}));
        await alert({
          title: 'Fehler beim Löschen',
          message: data.error || 'Datei konnte nicht gelöscht werden.',
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
      await alert({
        title: 'Fehler beim Löschen',
        message: 'Ein Netzwerkfehler ist beim Löschen der Datei aufgetreten.',
        type: 'error'
      });
    }
  };

  const handleUploadExtraFiles = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setNewFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
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
      // 1. Update project metadata
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

      // 2. Upload any newly added files if selected
      if (newFiles.length > 0) {
        const formData = new FormData();
        for (const file of newFiles) {
          formData.append('files', file);
        }
        await fetch(`/api/models/${model.id}/files`, {
          method: 'POST',
          body: formData
        });
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
              <h2 className="text-lg font-bold text-slate-100">Modell-Metadaten & Dateien bearbeiten</h2>
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

          {/* Files Management in Edit Mode */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Zugeordnete Modelldateien ({files.length + newFiles.length})
              </span>
              <button
                type="button"
                onClick={() => extraFileInputRef.current?.click()}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Dateien hinzufügen</span>
              </button>
              <input
                ref={extraFileInputRef}
                type="file"
                multiple
                accept=".stl,.3mf,.zip,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleUploadExtraFiles}
              />
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-2 px-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileBox className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-200 truncate">{f.original_name}</span>
                    <span className="text-slate-500 font-mono text-[10px]">({(f.file_size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteExistingFile(f.id)}
                    className="text-slate-500 hover:text-red-400 transition ml-2"
                    title="Datei aus Modell entfernen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {newFiles.map((nf, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 px-3 bg-cyan-950/30 rounded-xl border border-cyan-800/60 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Upload className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-cyan-200 truncate">{nf.name} (Neu)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-red-400 transition ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

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
