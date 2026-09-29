import React, { useState, useEffect, useRef } from 'react';
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
  Printer
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { parseSTL, parse3MF, generateThumbnailSnapshot } from '../utils/threeUtils';

export default function ModelCard({ 
  model, 
  onOpenViewer, 
  onOpenSlicer, 
  onToggleFavorite, 
  onDelete,
  onEdit 
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dynamicThumb, setDynamicThumb] = useState(model.thumbnail_url || null);
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

  // Auto-render 3D thumbnail in background if missing
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

    let isMounted = true;
    const renderPreview = async () => {
      try {
        const response = await fetch(`/api/models/files/${primaryModelFile.id}/raw`);
        if (!response.ok) throw new Error('Could not fetch 3D file for thumbnail');
        const buffer = await response.arrayBuffer();

        let geom;
        if (primaryModelFile.file_type === '3mf') {
          geom = await parse3MF(buffer);
        } else {
          geom = parseSTL(buffer);
        }

        const dataUrl = await generateThumbnailSnapshot(geom, model.filament_color || '#38bdf8', 480, 360);
        if (dataUrl && isMounted) {
          setDynamicThumb(dataUrl);
          // Persist to server in background
          fetch(`/api/models/${model.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thumbnail_base64: dataUrl })
          }).catch(() => {});
        }
      } catch (err) {
        // Fallback gracefully
      } finally {
        if (isMounted) setLoadingThumb(false);
      }
    };

    renderPreview();

    return () => {
      isMounted = false;
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

  return (
    <div 
      className="group relative bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/30 flex flex-col cursor-pointer transform hover:-translate-y-1"
      onClick={() => onOpenViewer(model)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Thumbnail / 3D Preview Banner */}
      <div className="relative aspect-[4/3] w-full bg-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-800/80">
        
        {dynamicThumb ? (
          <img 
            src={dynamicThumb} 
            alt={model.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : loadingThumb ? (
          <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
            <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-[10px] font-mono text-slate-400">Erzeuge 3D-Vorschau...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 group-hover:text-cyan-400 transition-colors">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-800 shadow-inner group-hover:scale-110 transition-transform"
              style={{ backgroundColor: `${model.filament_color || '#38bdf8'}15` }}
            >
              <Box className="w-8 h-8" style={{ color: model.filament_color || '#38bdf8' }} />
            </div>
            <span className="text-[11px] font-mono mt-2 text-slate-500">3D Vorschau öffnen</span>
          </div>
        )}

        {/* Favorite Heart Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(model);
          }}
          className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md border transition-all z-10 ${
            model.is_favorite 
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 scale-105' 
              : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title={model.is_favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        >
          <Heart className={`w-4 h-4 ${model.is_favorite ? 'fill-rose-400' : ''}`} />
        </button>

        {/* Top-Left Category & Multi-Part Badge */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-900/80 backdrop-blur-md text-cyan-300 border border-slate-700/60">
            {model.category || 'Allgemein'}
          </span>
          {stlCount > 1 && (
            <span className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-cyan-950/80 backdrop-blur-md text-cyan-400 border border-cyan-700/60 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {stlCount} Teile
            </span>
          )}
        </div>

        {/* Floating Quick Action Overlay on Hover */}
        <div className={`absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center gap-3 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenViewer(model);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-lg transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            3D Viewer
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSlicer(model);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-600 shadow-lg transition"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            Slicer
          </button>
        </div>
      </div>

      {/* Card Content & Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Title & Author */}
          <h2 className="text-base font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors line-clamp-1 tracking-tight" title={model.title}>
            {model.title}
          </h2>
          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
            {model.description || model.author || 'Keine Beschreibung vorhanden'}
          </p>
        </div>

        {/* Print Settings Badges */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-mono">
          {/* Filament Color & Type */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-800">
            <span 
              className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-700" 
              style={{ backgroundColor: model.filament_color || '#38bdf8' }}
            />
            <span>{model.filament_type || 'PLA'}</span>
          </div>

          {/* Infill % */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-800 text-slate-400">
            <span>{model.infill_percentage}% Infill</span>
          </div>

          {/* Print Time */}
          {formatPrintTime(model.print_time_minutes) && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-800 text-cyan-400">
              <Clock className="w-3 h-3" />
              <span>{formatPrintTime(model.print_time_minutes)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {model.tags && model.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {model.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
                #{tag}
              </span>
            ))}
            {model.tags.length > 3 && (
              <span className="text-[10px] text-slate-500 px-1 py-0.5">
                +{model.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] font-mono">
            {formatFileSize(model.total_file_size)}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(model);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Bearbeiten"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(model);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition"
              title="Löschen"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition active:scale-95 disabled:opacity-50"
              title="Projekt als ZIP herunterladen"
            >
              <Download className={`w-3.5 h-3.5 text-cyan-400 ${downloading ? 'animate-bounce' : ''}`} />
              <span>{downloading ? 'Laden...' : 'Download'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
