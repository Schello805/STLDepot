import React, { useState, useEffect } from 'react';
import ThreeCanvas from './ThreeCanvas';
import LabelModal from './LabelModal';
import { 
  X, 
  Download, 
  Printer, 
  Layers, 
  Clock, 
  Ruler, 
  Info, 
  Camera, 
  Trash2, 
  Edit3, 
  ExternalLink,
  Check,
  FileText,
  Weight,
  Sparkles,
  Heart,
  QrCode,
  Coins,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateThumbnailSnapshot } from '../utils/threeUtils';
import { calculateModelCost } from '../utils/costCalculator';

export default function ViewerModal({ 
  model, 
  onClose, 
  onOpenSlicer, 
  onDelete, 
  onEdit, 
  onToggleFavorite,
  onModelUpdated,
  materialSettings,
  onOpenSettings
}) {
  const modelFiles = model?.files?.filter(f => f.file_type === 'stl' || f.file_type === '3mf') || [];
  const imageFiles = model?.files?.filter(f => f.file_type === 'image') || [];
  const otherFiles = model?.files?.filter(f => f.file_type !== 'stl' && f.file_type !== '3mf' && f.file_type !== 'image') || [];
  const isViewerOpen = Boolean(model);

  const [selectedFile, setSelectedFile] = useState(modelFiles[0] || null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewOptions, setPreviewOptions] = useState([]);
  const [activeTab, setActiveTab] = useState('3d'); // '3d', 'gallery', 'files', 'notes'
  const [meshStats, setMeshStats] = useState(null);
  const [currentGeometry, setCurrentGeometry] = useState(null);
  const [savingThumb, setSavingThumb] = useState(false);
  const [thumbSavedSuccess, setThumbSavedSuccess] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);

  useEffect(() => {
    if (modelFiles.length > 0 && !selectedFile) {
      setSelectedFile(modelFiles[0]);
    }
  }, [model, modelFiles.length, selectedFile]);

  useEffect(() => {
    if (!isViewerOpen) return;

    const bodyOverflow = document.body.style.overflow;
    const documentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = documentOverflow;
    };
  }, [isViewerOpen]);

  if (!model) return null;

  const modelWithStats = meshStats ? {
    ...model,
    volume_cm3: meshStats.volumeCm3 || model.volume_cm3,
    weight_grams: parseFloat(meshStats.estimatedWeightGrams) || model.weight_grams
  } : model;
  const costInfo = calculateModelCost(modelWithStats, materialSettings);

  // Handle saving new thumbnail from current geometry
  const handleCaptureThumbnail = async () => {
    if (!currentGeometry) return;
    setSavingThumb(true);
    try {
      const dataUrl = await generateThumbnailSnapshot(currentGeometry, model.filament_color || '#38bdf8', 600, 450);
      if (dataUrl) {
        const res = await fetch(`/api/models/${model.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbnail_base64: dataUrl })
        });
        if (res.ok) {
          setThumbSavedSuccess(true);
          if (onModelUpdated) onModelUpdated();
          setTimeout(() => setThumbSavedSuccess(false), 2500);
        }
      }
    } catch (e) {
      console.error('Thumbnail save failed:', e);
    } finally {
      setSavingThumb(false);
    }
  };

  const handleDownloadZip = () => {
    window.location.href = `/api/models/${model.id}/download`;
    confetti({ particleCount: 30, spread: 60 });
  };

  const handleDownloadSingle = (fileId, fileName) => {
    window.location.href = `/api/models/files/${fileId}/download`;
  };

  const selectAdjacentFile = (direction) => {
    if (previewOptions.length > 1) {
      setPreviewIndex(index => (index + direction + previewOptions.length) % previewOptions.length);
      return;
    }
    if (modelFiles.length < 2) return;
    const currentIndex = modelFiles.findIndex(file => file.id === selectedFile?.id);
    const nextIndex = (currentIndex + direction + modelFiles.length) % modelFiles.length;
    setSelectedFile(modelFiles[nextIndex]);
    setPreviewIndex(0);
    setPreviewOptions([]);
  };

  const selectFile = (file) => {
    setSelectedFile(file);
    setPreviewIndex(0);
    setPreviewOptions([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overscroll-contain animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: model.filament_color || '#38bdf8' }}
            />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>{model.title}</span>
                <button
                  onClick={() => onToggleFavorite(model)}
                  className="p-1 rounded-lg hover:bg-slate-800 transition text-slate-400"
                >
                  <Heart className={`w-4 h-4 ${model.is_favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                </button>
              </h2>
              <p className="text-xs text-slate-400">
                Kategorie: <span className="text-cyan-400 font-medium">{model.category}</span> • Autor: {model.author || 'Michael Schellenberger'}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenSlicer(model, selectedFile)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-lg transition"
            >
              <Printer className="w-4 h-4" />
              <span>In Slicer öffnen</span>
            </button>
            <button
              onClick={() => setShowLabelModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              title="Druckfertiges Werkstatt-Etikett mit QR-Code für Boxen & Spulen generieren"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">QR-Etikett</span>
            </button>
            <button
              onClick={handleDownloadZip}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition"
              title="Alle Dateien als ZIP herunterladen"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>ZIP Download</span>
            </button>
            <button
              onClick={() => onEdit(model)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Projekt bearbeiten"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(model)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 transition"
              title="Projekt löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto">
          
          {/* Left / Center 3D Viewport & Part Selector */}
          <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col gap-4 bg-slate-950/30 border-r border-slate-800/80">
            
            {/* Multi-part tabs if more than 1 3D model */}
            {modelFiles.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" /> Baugruppe:
                </span>
                {modelFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => selectFile(file)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                      selectedFile?.id === file.id
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {file.original_name}
                  </button>
                ))}
              </div>
            )}

            {/* 3D Canvas Area */}
            <div className="relative flex-1 min-h-[380px] lg:min-h-[460px]">
              {selectedFile ? (
                <ThreeCanvas
                  fileUrl={`/api/models/files/${selectedFile.id}/raw`}
                  fileType={selectedFile.file_type}
                  previewIndex={previewIndex}
                  initialColor={model.filament_color || '#38bdf8'}
                  height="100%"
                  onGeometryLoaded={(stats, geom) => {
                    setMeshStats(stats);
                    setCurrentGeometry(geom);
                    setPreviewOptions(geom.userData?.previewOptions || []);
                    setPreviewIndex(geom.userData?.activePreviewIndex || 0);
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
                  Keine STL/3MF Datei zum Anzeigen ausgewählt.
                </div>
              )}
              {(modelFiles.length > 1 || previewOptions.length > 1) && (
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between p-3">
                  <button
                    type="button"
                    onClick={() => selectAdjacentFile(-1)}
                    aria-label={previewOptions.length > 1 ? 'Vorherige Platte oder Objekt' : 'Vorherige Datei'}
                    title={previewOptions.length > 1 ? 'Vorherige Platte oder Objekt' : 'Vorherige Datei'}
                    className="pointer-events-auto grid size-10 place-items-center rounded-full border border-slate-600/80 bg-slate-950/80 text-slate-100 shadow-lg backdrop-blur hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAdjacentFile(1)}
                    aria-label={previewOptions.length > 1 ? 'Nächste Platte oder Objekt' : 'Nächste Datei'}
                    title={previewOptions.length > 1 ? 'Nächste Platte oder Objekt' : 'Nächste Datei'}
                    className="pointer-events-auto grid size-10 place-items-center rounded-full border border-slate-600/80 bg-slate-950/80 text-slate-100 shadow-lg backdrop-blur hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              )}
              {previewOptions.length > 1 && previewOptions[previewIndex] && (
                <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-600/80 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-100 shadow-lg backdrop-blur">
                  {previewOptions[previewIndex].name}
                </div>
              )}
            </div>

            {/* Viewport Action Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCaptureThumbnail}
                  disabled={savingThumb || !currentGeometry}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-50"
                  title="Aktuelles 3D-Bild als neues Vorschaubild für die Karte speichern"
                >
                  {thumbSavedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Vorschaubild aktualisiert!</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{savingThumb ? 'Speichere...' : 'Als Vorschaubild festlegen'}</span>
                    </>
                  )}
                </button>
              </div>

              {selectedFile && (
                <button
                  onClick={() => handleDownloadSingle(selectedFile.id, selectedFile.original_name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{selectedFile.original_name} laden</span>
                </button>
              )}
            </div>

          </div>

          {/* Right Sidebar: Details, Specs, Print Settings, Notes */}
          <div className="lg:col-span-4 p-5 sm:p-6 space-y-6 overflow-y-auto bg-slate-900">
            
            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Beschreibung
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
                {model.description || 'Keine Beschreibung vorhanden.'}
              </p>
            </div>

            {/* Material & Print Cost Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-lg shadow-emerald-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  Geschätzte Druckkosten
                </span>
                {onOpenSettings && (
                  <button 
                    onClick={onOpenSettings}
                    className="text-[11px] text-slate-400 hover:text-emerald-300 transition flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/80 hover:border-emerald-500/40"
                    title="Kilopreise der Filamente in den Einstellungen anpassen"
                  >
                    <Settings className="w-3 h-3 text-emerald-400" />
                    <span>Preise verwalten</span>
                  </button>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl font-black font-mono tracking-tight text-emerald-300">
                    {costInfo?.price || '-- €'}
                  </span>
                  {costInfo?.weight > 0 && (
                    <span className="text-xs text-slate-300 font-mono ml-2">
                      (~{costInfo.weight} g {costInfo.materialName})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Basis: {costInfo?.pricePerKg} {costInfo?.currency}/kg
                </span>
              </div>
            </div>

            {/* 3D Geometry Specifications */}
            {meshStats && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                  3D-Bemaßung & Geometrie
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Breite (X)</span>
                    <span className="font-mono font-semibold text-slate-100">{meshStats.dimensions.x} mm</span>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Tiefe (Y)</span>
                    <span className="font-mono font-semibold text-slate-100">{meshStats.dimensions.y} mm</span>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Höhe (Z)</span>
                    <span className="font-mono font-semibold text-slate-100">{meshStats.dimensions.z} mm</span>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Volumen</span>
                    <span className="font-mono font-semibold text-slate-100">{meshStats.volumeCm3} cm³</span>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Dreiecke</span>
                    <span className="font-mono font-semibold text-slate-100">{meshStats.triangles.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Gewicht (~{costInfo?.materialName || 'PLA'})</span>
                    <span className="font-mono font-semibold text-cyan-400">~{costInfo?.weight || meshStats.estimatedWeightGrams} g</span>
                  </div>
                </div>
              </div>
            )}

            {/* Print Parameters */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-cyan-400" />
                Druck-Parameter & Profil
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-slate-400">Filament</span>
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: model.filament_color || '#38bdf8' }} />
                    {model.filament_type || 'PLA'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-slate-400">Materialkosten</span>
                  <span className="font-mono font-bold text-emerald-400">{costInfo?.price}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-slate-400">Druckzeit</span>
                  <span className="font-medium text-cyan-400">{model.print_time_minutes > 0 ? `${model.print_time_minutes} Minuten` : 'Nicht angegeben'}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-slate-400">Düse</span>
                  <span className="font-medium text-slate-200">{model.nozzle_size || 0.4} mm</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-slate-400">Stützen (Supports)</span>
                  <span className="font-medium text-slate-200">{model.supports_needed ? 'Erforderlich' : 'Keine'}</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {model.tags && model.tags.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {model.tags.map((tag, idx) => (
                    <span key={idx} className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes & Source */}
            {model.notes && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Druckhinweise / Notizen
                </h3>
                <div className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950/60 p-3 rounded-xl border border-slate-800 font-sans">
                  {model.notes}
                </div>
              </div>
            )}

            {model.source_url && (
              <div>
                <a
                  href={model.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Original-Quelle öffnen ({model.source_url})</span>
                </a>
              </div>
            )}

          </div>

        </div>

      </div>

      {showLabelModal && (
        <LabelModal 
          model={model} 
          onClose={() => setShowLabelModal(false)} 
        />
      )}
    </div>
  );
}
