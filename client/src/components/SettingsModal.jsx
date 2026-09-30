import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Coins, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  HelpCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { useDialog } from '../context/DialogContext';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  materialSettings, 
  onSaveSettings,
  onRecalculateWeights 
}) {
  const { confirm, alert } = useDialog();
  const [settings, setSettings] = useState({
    materials: [
      { id: 'PLA', name: 'PLA', density: 1.24, price_per_kg: 19.99, color: '#38bdf8' },
      { id: 'PETG', name: 'PETG', density: 1.27, price_per_kg: 21.99, color: '#10b981' },
      { id: 'ABS', name: 'ABS', density: 1.04, price_per_kg: 22.99, color: '#f59e0b' },
      { id: 'ASA', name: 'ASA', density: 1.07, price_per_kg: 24.99, color: '#ef4444' },
      { id: 'TPU', name: 'TPU', density: 1.21, price_per_kg: 29.99, color: '#8b5cf6' }
    ],
    infill_factor: 0.35,
    currency: '€'
  });

  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [newMatName, setNewMatName] = useState('');
  const [newMatDensity, setNewMatDensity] = useState('1.24');
  const [newMatPrice, setNewMatPrice] = useState('24.99');
  const [newMatColor, setNewMatColor] = useState('#06b6d4');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (materialSettings && materialSettings.materials) {
      setSettings(materialSettings);
    }
  }, [materialSettings, isOpen]);

  if (!isOpen) return null;

  const handlePriceChange = (index, newPrice) => {
    const updated = [...settings.materials];
    updated[index] = { ...updated[index], price_per_kg: parseFloat(newPrice) || 0 };
    setSettings({ ...settings, materials: updated });
  };

  const handleDensityChange = (index, newDensity) => {
    const updated = [...settings.materials];
    updated[index] = { ...updated[index], density: parseFloat(newDensity) || 1.24 };
    setSettings({ ...settings, materials: updated });
  };

  const handleDeleteMaterial = async (index) => {
    if (settings.materials.length <= 1) {
      await alert({
        title: 'Aktion nicht möglich',
        message: 'Mindestens ein Material muss im System vorhanden bleiben.',
        type: 'warning'
      });
      return;
    }

    const mat = settings.materials[index];
    const confirmed = await confirm({
      title: 'Material löschen',
      message: `Möchtest du das Material "${mat?.name || mat?.id}" wirklich aus der Preisliste entfernen?`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!confirmed) return;

    const updated = settings.materials.filter((_, i) => i !== index);
    setSettings({ ...settings, materials: updated });
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    const cleanName = newMatName.trim().toUpperCase();
    if (!cleanName) return;

    if (settings.materials.some(m => (m.id || m.name).toUpperCase() === cleanName)) {
      await alert({
        title: 'Material existiert bereits',
        message: `Das Material "${cleanName}" ist bereits in deiner Liste vorhanden.`,
        type: 'warning'
      });
      return;
    }

    const newMaterial = {
      id: cleanName,
      name: cleanName,
      density: parseFloat(newMatDensity) || 1.24,
      price_per_kg: parseFloat(newMatPrice) || 19.99,
      color: newMatColor || '#38bdf8'
    };

    setSettings({
      ...settings,
      materials: [...settings.materials, newMaterial]
    });

    setNewMatName('');
    setShowAddForm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      await onSaveSettings(settings);
      setStatusMessage({ type: 'success', text: 'Einstellungen erfolgreich gespeichert!' });
      setTimeout(() => {
        setStatusMessage(null);
      }, 2500);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    setStatusMessage(null);
    try {
      const res = await onRecalculateWeights();
      setStatusMessage({ 
        type: 'success', 
        text: res?.message || 'Alle Modellgewichte und Preise wurden aktualisiert!' 
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Fehler bei der Neuberechnung' });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 shadow-2xl shadow-black/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Material- & Druckpreise verwalten
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Kostenrechner
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Passe Kilopreise für Filamente an. Der genaue Druckpreis wird live in der Übersicht und Detailkarte berechnet.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
          {/* Status Message */}
          {statusMessage && (
            <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-medium border ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200' 
                : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
            }`}>
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Quick Info Box */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3 text-xs leading-relaxed text-slate-300">
            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-100 font-semibold">Wie wird der Druckpreis berechnet?</strong>
              <p className="mt-0.5 text-slate-400">
                Aus der 3D-Geometrie der Datei wird das Volumen ermittelt. Anhand der Materialdichte und des eingestellten Infill-Faktors (Außenwände + Infill) entsteht das Druckgewicht. Mit deinem Kilopreis wird der Cent-genaue Preis für jedes Modell ermittelt.
              </p>
            </div>
          </div>

          {/* General Config: Currency & Infill Factor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-850/60 border border-slate-750">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>Währungssymbol</span>
                <span className="text-slate-400 font-normal font-mono text-[11px]">Aktuell: {settings.currency || '€'}</span>
              </label>
              <div className="flex items-center gap-2">
                {['€', '$', 'CHF', '£'].map(curr => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setSettings({ ...settings, currency: curr })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      (settings.currency || '€') === curr
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-200">Berechneter Füllgrad / Infill-Faktor</span>
                <span className="font-mono font-bold text-cyan-400">
                  {Math.round((settings.infill_factor || 0.35) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.05"
                value={settings.infill_factor || 0.35}
                onChange={(e) => setSettings({ ...settings, infill_factor: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1.5 bg-slate-750 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>20% (Leicht / Dünnwandig)</span>
                <span>35% (Standard)</span>
                <span>80% (Massiv)</span>
              </div>
            </div>
          </div>

          {/* Filament Pricing Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Materialien & Spulenpreise</span>
                <span className="text-xs font-normal text-slate-400 font-mono">({settings.materials.length} konfiguriert)</span>
              </h3>

              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Material hinzufügen</span>
                </button>
              )}
            </div>

            {/* Add Material Form */}
            {showAddForm && (
              <form onSubmit={handleAddMaterial} className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-3 animate-in fade-in">
                <div className="text-xs font-bold text-cyan-300 flex items-center justify-between">
                  <span>Neues Filament registrieren</span>
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white text-xs">
                    Abbrechen
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Name (z.B. PA-CF, SILK)</label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. PETG-CF"
                      value={newMatName}
                      onChange={(e) => setNewMatName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs uppercase focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Dichte (g/cm³)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newMatDensity}
                      onChange={(e) => setNewMatDensity(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Preis ({settings.currency || '€'}/kg)</label>
                    <input
                      type="number"
                      step="0.10"
                      required
                      value={newMatPrice}
                      onChange={(e) => setNewMatPrice(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* List of Material Cards */}
            <div className="space-y-2">
              {settings.materials.map((mat, idx) => {
                const sampleCost100g = ((100 / 1000) * mat.price_per_kg).toFixed(2);
                return (
                  <div 
                    key={mat.id || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-850 border border-slate-750/90 hover:border-slate-700 transition gap-3"
                  >
                    {/* Material Name & Visual Swatch */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <span 
                        className="w-4 h-4 rounded-full ring-2 ring-slate-700 shadow-sm shrink-0" 
                        style={{ backgroundColor: mat.color || '#38bdf8' }}
                      />
                      <div>
                        <span className="font-bold text-white text-sm tracking-wide">
                          {mat.name || mat.id}
                        </span>
                        <span className="block text-[11px] text-slate-400 font-mono">
                          Dichte: {mat.density || 1.24} g/cm³
                        </span>
                      </div>
                    </div>

                    {/* Inputs & Calculation Preview */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Price input */}
                      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 focus-within:border-emerald-500">
                        <span className="text-xs text-slate-400 font-medium">Preis:</span>
                        <input
                          type="number"
                          step="0.10"
                          min="1"
                          max="500"
                          value={mat.price_per_kg}
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                          className="w-20 bg-transparent text-right font-mono font-bold text-emerald-400 focus:outline-none text-sm"
                        />
                        <span className="text-xs font-semibold text-slate-400">
                          {settings.currency || '€'}/kg
                        </span>
                      </div>

                      {/* 100g Sample calculation badge */}
                      <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span>100g ≈</span>
                        <span className="text-emerald-300 font-semibold">{sampleCost100g} {settings.currency || '€'}</span>
                      </div>

                      {/* Delete button (for extra materials) */}
                      {settings.materials.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(idx)}
                          title={`${mat.name} entfernen`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition active:scale-95 disabled:opacity-50"
            title="Berechnet das 3D-Volumen und Gewicht aller gespeicherten Modelle mit den aktuellen Parametern neu"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${recalculating ? 'animate-spin' : ''}`} />
            <span>{recalculating ? 'Berechne Modelle...' : 'Alle Modellgewichte neu berechnen'}</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Schließen
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 active:scale-95 transition disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Einstellungen speichern</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
