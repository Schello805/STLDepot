import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Download, 
  Clock, 
  Layers, 
  Heart, 
  Sparkles, 
  ExternalLink, 
  FileBox, 
  MoreVertical,
  Maximize2,
  Trash2,
  Tag,
  Share2,
  Printer,
  Check,
  Coins,
  Palette
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateModelCost } from '../utils/costCalculator';
import { thumbnailQueue } from '../utils/thumbnailQueue';

export default function ModelCard({ 
  model, 
  onOpenViewer, 
  onOpenSlicer, 
  onToggleFavorite, 
  onDelete,
  onEdit,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  materialSettings,
  onOpenSettings,
  onToggleMulticolor
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dynamicThumb, setDynamicThumb] = useState(model.thumbnail_url || null);
  const costInfo = calculateModelCost(model, materialSettings);
  const [loadingThumb, setLoadingThumb] = useState(!model.thumbnail_url);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  // Format print time in hours & minutes
  const formatPrintTime = (minutes) => {
    if (!minutes || minutes <= 0) return null;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) return `${hrs}h ${mins > 0 ? mins + 'm' : ''}`;
    return `${mins}m`;
  };

  const primaryModelFile = model.files?.find(f => f.file_type === 'stl' || f.file_type === '3mf');

  // Auto-render 3D thumbnail in background if missing (queued, non-blocking)
  useEffect(() => {
    if (model.thumbnail_url) {
      setDynamicThumb(model.thumbnail_url);
      setLoadingThumb(false);
      return;
    }

    if (!primaryModelFile) {
      setLoadingThumb(false);
      return;
    }

    const cancel = thumbnailQueue.enqueue(model, primaryModelFile, (dataUrl) => {
      setDynamicThumb(dataUrl);
      setLoadingThumb(false);
    });

    return () => {
      cancel();
    };
  }, [model.id, model.thumbnail_url, primaryModelFile]);

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      window.location.href = `/api/models/${model.id}/download`;
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.85 }
      });
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  };

  const stlCount = model.files?.filter(f => f.file_type === 'stl' || f.file_type === '3mf').length || 0;

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(model.id);
    } else {
      onOpenViewer(model);
    }
  };

  return (
    <div 
      className={`group relative bg-slate-900/90 hover:bg-slate-850/95 border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-950/40 flex flex-col cursor-pointer transform hover:-translate-y-1 ${
        isSelected 
          ? 'border-cyan-400 ring-2 ring-cyan-500/50 bg-slate-850' 
          : 'border-slate-700/80 hover:border-cyan-400/70'
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Thumbnail / 3D Preview Banner with Studio Pedestal Lighting */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-800/95 via-slate-850 to-slate-900 overflow-hidden flex items-center justify-center border-b border-slate-700/80">
        
        {/* Studio Pedestal Radial Light Spotlight */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.16),_transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />

        {dynamicThumb ? (
          <img 
            src={dynamicThumb} 
            alt={model.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 relative z-0"
            loading="lazy"
          />
        ) : loadingThumb ? (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-2 relative z-10">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-[10px] font-mono text-slate-300">Erzeuge 3D-Vorschau...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-cyan-400 transition-colors relative z-10">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-700 shadow-inner group-hover:scale-110 transition-transform bg-slate-850"
            >
              <Box className="w-8 h-8" style={{ color: model.filament_color || '#38bdf8' }} />
            </div>
            <span className="text-[11px] font-mono mt-2 text-slate-300 font-medium">3D Vorschau öffnen</span>
          </div>
        )}

        {/* Selection Checkbox on Top Right or Favorite Heart */}
        {selectionMode ? (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(model.id);
            }}
            className={`absolute top-3 right-3 w-6 h-6 rounded-lg border flex items-center justify-center transition-all z-20 ${
              isSelected 
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md scale-110' 
                : 'bg-slate-900/90 border-slate-600 text-transparent hover:border-cyan-400'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(model);
            }}
            className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md border transition-all z-10 ${
              model.is_favorite 
                ? 'bg-rose-500/25 border-rose-500/50 text-rose-300 scale-105 shadow-md' 
                : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={model.is_favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          >
            <Heart className={`w-4 h-4 ${model.is_favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
          </button>
        )}

        {/* Top-Left Category, Multi-Part & Multi-Color Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-900/90 backdrop-blur-md text-cyan-300 border border-slate-700/80 shadow-sm">
            {model.category || 'Allgemein'}
          </span>
          {stlCount > 1 && (
            <span className="px-2 py-1 text-[11px] font-bold rounded-lg bg-cyan-950/90 backdrop-blur-md text-cyan-300 border border-cyan-600/60 shadow-sm flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-400" />
              {stlCount} Teile
            </span>
          )}
          {Boolean(model.is_multicolor) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleMulticolor) onToggleMulticolor(model);
              }}
              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-amber-950/90 hover:bg-amber-900/90 backdrop-blur-md text-amber-300 border border-amber-600/60 shadow-sm flex items-center gap-1 transition cursor-pointer"
              title={`Mehrfarbdruck (+${costInfo?.wastePercent || 10}% Farbwechsel-Zuschlag für Filamentwechsel). Klicke zum Deaktivieren.`}
            >
              <Palette className="w-3 h-3 text-amber-400" />
              +{costInfo?.wastePercent || 10}% Farbwechsel
            </button>
          )}
        </div>

        {/* Floating Quick Action Overlay on Hover (Hidden in selection mode) */}
        {!selectionMode && (
          <div className={`absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center gap-2.5 transition-opacity duration-200 z-10 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewer(model);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              3D Viewer
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSlicer(model);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-600 shadow-lg transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              Slicer
            </button>
          </div>
        )}
      </div>

      {/* Card Content & Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-slate-900/60">
        <div>
          {/* Title & Author */}
          <h2 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1 tracking-tight" title={model.title}>
            {model.title}
          </h2>
          <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">
            {model.description || model.author || 'Keine Beschreibung vorhanden'}
          </p>
        </div>

        {/* 3 Infos: Material, Gewicht, Preis (ohne Icons, kein Zeilenumbruch) */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-200 font-mono flex-nowrap overflow-hidden">
          {/* 1. Material */}
          <span 
            className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-slate-200 font-semibold shadow-sm shrink-0"
            title={`Material: ${model.filament_type || 'PLA'}`}
          >
            {model.filament_type || 'PLA'}
          </span>

          {/* 2. Gewicht */}
          <span 
            className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-slate-300 font-medium shadow-sm shrink-0"
            title={costInfo?.weight > 0 ? (
              costInfo?.isMultiColor
                ? `Berechnetes Gewicht: ${costInfo.weightFormatted} (Basis: ~${costInfo.baseWeight}g + ~${costInfo.wasteGrams}g Spülverlust / Purge Tower)`
                : `Berechnetes Modellgewicht: ${costInfo.weightFormatted}`
            ) : 'Gewicht'}
          >
            {costInfo?.weightFormatted || '-- g'}
          </span>

          {/* 3. Preis */}
          <span 
            onClick={(e) => {
              if (onOpenSettings) {
                e.stopPropagation();
                onOpenSettings();
              }
            }}
            title={costInfo?.weight > 0 ? (
              costInfo?.isMultiColor
                ? `Materialkosten: ${costInfo.price} (~${costInfo.baseWeight}g Modell + ~${costInfo.wasteGrams}g Spülverlust [+${costInfo.wastePercent}%] @ ${costInfo.pricePerKg} ${costInfo.currency}/kg). Klicke zum Anpassen.`
                : `Materialkosten: ${costInfo.price} (~${costInfo.weight}g ${costInfo.materialName} @ ${costInfo.pricePerKg} ${costInfo.currency}/kg). Klicke zum Anpassen der Preise.`
            ) : 'Druckkosten (Klicke für Einstellungen)'}
            className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold shadow-sm hover:bg-emerald-900/80 hover:border-emerald-400 transition cursor-pointer shrink-0"
          >
            {costInfo?.price || '-- €'}
          </span>

          {/* Druckzeit (falls vorhanden) */}
          {formatPrintTime(model.print_time_minutes) && (
            <span 
              className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-cyan-400 font-semibold shadow-sm shrink-0"
              title={`Druckzeit: ${formatPrintTime(model.print_time_minutes)}`}
            >
              {formatPrintTime(model.print_time_minutes)}
            </span>
          )}
        </div>

        {/* Tags */}
        {model.tags && model.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {model.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700/80 font-medium">
                #{tag}
              </span>
            ))}
            {model.tags.length > 3 && (
              <span className="text-[10px] text-slate-400 px-1 py-0.5 font-medium">
                +{model.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="pt-2 border-t border-slate-750/80 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] font-mono font-medium text-slate-300">
            {formatFileSize(model.total_file_size)}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(model);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-750 transition shadow-sm"
              title="Bearbeiten"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(model);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-750 transition shadow-sm"
              title="Löschen"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-100 font-semibold border border-slate-750 hover:border-cyan-500/40 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Projekt als ZIP herunterladen"
            >
              <Download className={`w-3.5 h-3.5 text-cyan-400 ${downloading ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{downloading ? 'Laden...' : 'Download'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
