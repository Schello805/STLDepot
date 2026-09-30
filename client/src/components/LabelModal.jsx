import React, { useRef, useState } from 'react';
import { 
  X, 
  Printer, 
  QrCode, 
  Box, 
  Ruler, 
  Clock, 
  Layers, 
  Sparkles,
  Download,
  Copy,
  Check
} from 'lucide-react';

export default function LabelModal({ model, onClose }) {
  const [labelSize, setLabelSize] = useState('medium'); // 'small' (50x30mm), 'medium' (70x36mm), 'large' (100x50mm)
  const [copied, setCopied] = useState(false);
  const printAreaRef = useRef(null);

  if (!model) return null;

  const modelUrl = `${window.location.origin}/#model-${model.id}`;
  // Generate high-resolution QR code URL using standard QR server
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(modelUrl)}&color=0-0-0&bgcolor=255-255-255&margin=1`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(modelUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Werkstatt-Etikett & QR-Code</h2>
              <p className="text-xs text-slate-400">Druckfertiges Etikett für Teileboxen, Schubladen & Spulen</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          
          {/* Label Size Selector */}
          <div className="flex items-center justify-between gap-3 text-xs bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <span className="font-semibold text-slate-300">Format:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLabelSize('small')}
                className={`px-3 py-1.5 rounded-xl font-medium transition ${labelSize === 'small' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Klein (50×30 mm)
              </button>
              <button
                type="button"
                onClick={() => setLabelSize('medium')}
                className={`px-3 py-1.5 rounded-xl font-medium transition ${labelSize === 'medium' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Standard (70×36 mm)
              </button>
              <button
                type="button"
                onClick={() => setLabelSize('large')}
                className={`px-3 py-1.5 rounded-xl font-medium transition ${labelSize === 'large' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Groß (100×50 mm)
              </button>
            </div>
          </div>

          {/* PRINTABLE LABEL PREVIEW SHEET */}
          <div className="flex justify-center p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
            <div 
              ref={printAreaRef}
              id="printable-label"
              className={`bg-white text-slate-950 p-4 rounded-xl border-2 border-slate-300 shadow-2xl flex flex-col justify-between transition-all ${
                labelSize === 'small' 
                  ? 'w-[320px] min-h-[160px]' 
                  : labelSize === 'medium' 
                    ? 'w-[380px] min-h-[190px]' 
                    : 'w-[450px] min-h-[220px]'
              }`}
            >
              {/* Top Row: Title & Badge */}
              <div className="flex items-start justify-between gap-3 border-b-2 border-slate-900 pb-2">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight text-slate-950 uppercase tracking-tight line-clamp-1">
                    {model.title}
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
                    Kategorie: {model.category} • Autor: {model.author || 'Michael Schellenberger'}
                  </p>
                </div>
                <div className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] font-bold shrink-0">
                  STL-Vault
                </div>
              </div>

              {/* Middle Row: QR Code & Specs */}
              <div className="flex items-center justify-between gap-3 py-2">
                {/* QR Code */}
                <div className="p-1 bg-white border border-slate-300 rounded-lg shrink-0">
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code" 
                    className={labelSize === 'small' ? 'w-16 h-16' : labelSize === 'medium' ? 'w-20 h-20' : 'w-24 h-24'} 
                  />
                </div>

                {/* Technical Specs */}
                <div className="flex-1 text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-600">Material:</span>
                    <span className="font-bold">{model.filament_type || 'PLA'} ({model.filament_color || '#38bdf8'})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-600">Infill:</span>
                    <span className="font-bold">{model.infill_percentage || 15}%</span>
                  </div>
                  {model.print_time_minutes > 0 && (
                    <div className="flex justify-between border-b border-slate-200 pb-0.5">
                      <span className="text-slate-600">Druckzeit:</span>
                      <span className="font-bold">~{model.print_time_minutes} min</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Düse:</span>
                    <span className="font-bold">{model.nozzle_size || 0.4} mm</span>
                  </div>
                </div>
              </div>

              {/* Bottom Footer: Instructions & License */}
              <div className="border-t border-slate-300 pt-1.5 flex items-center justify-between text-[9px] text-slate-500 font-sans">
                <span>📱 Scan mit Handy öffnet 3D-Vorschau</span>
                <span>CC BY-NC 4.0</span>
              </div>
            </div>
          </div>

          {/* Quick link copy */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400 truncate flex-1 font-mono text-[11px]">{modelUrl}</span>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copied ? 'Kopiert!' : 'Link kopieren'}</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Schließen
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Etikett drucken</span>
          </button>
        </div>

      </div>

      {/* Print CSS Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-label, #printable-label * {
            visibility: visible;
          }
          #printable-label {
            position: fixed;
            left: 20mm;
            top: 20mm;
            margin: 0;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
