import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SlicerModal({ model, file, onClose }) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openStatus, setOpenStatus] = useState(null);

  if (!model) return null;

  const targetFile = file || model.files?.find(f => f.file_type === 'stl' || f.file_type === '3mf') || model.files?.[0];
  
  const fileDownloadUrl = targetFile ? `${window.location.origin}/api/models/files/${targetFile.id}/raw` : '';
  const zipDownloadUrl = `${window.location.origin}/api/models/${model.id}/download`;

  const slicers = [
    {
      id: 'orca',
      name: 'OrcaSlicer',
      desc: 'High Performance Open-Source Slicer für Voron, Bambu Lab, Creality & Co.',
      icon: '🐋',
      scheme: `orcaslicer://open?file=${encodeURIComponent(fileDownloadUrl)}`,
      badge: 'Empfohlen'
    },
    {
      id: 'bambu',
      name: 'Bambu Studio',
      desc: 'Offizieller Slicer für Bambu Lab X1, P1, A1 Serien',
      icon: '🎋',
      scheme: `bambustudio://open?file=${encodeURIComponent(fileDownloadUrl)}`,
      badge: 'Bambu Lab'
    },
    {
      id: 'anycubic',
      name: 'Anycubic Slicer Next',
      desc: 'Offizieller Slicer für Anycubic Kobra 2 / 3 & ACE Pro Multi-Color',
      icon: '🔷',
      scheme: `acnext://open?file=${encodeURIComponent(fileDownloadUrl)}`,
      badge: 'Anycubic FDM'
    },
    {
      id: 'anycubic_photon',
      name: 'Anycubic Photon',
      desc: 'Slicer & Support-Generator für Anycubic Photon Mono & M-Serie',
      icon: '🧪',
      scheme: `photonworkshop://open?file=${encodeURIComponent(fileDownloadUrl)}`,
      badge: 'Anycubic Resin'
    },
    {
      id: 'prusa',
      name: 'PrusaSlicer',
      desc: 'Präziser Slicer für Original Prusa, MMU & Universal-Drucker',
      icon: '🔶',
      scheme: `prusaslicer://open?file=${encodeURIComponent(fileDownloadUrl)}`,
      badge: 'Prusa'
    },
    {
      id: 'cura',
      name: 'UltiMaker Cura',
      desc: 'Klassischer Open-Source Slicer mit großer Drucker-Kompatibilität',
      icon: '⚙️',
      scheme: `cura://open?file=${encodeURIComponent(fileDownloadUrl)}`,
      badge: 'Universal'
    }
  ];

  const handleOpenSlicer = async (slicer) => {
    setOpening(true);
    setOpenStatus(null);

    // 1. Try launching the slicer directly on local host via backend API
    try {
      const res = await fetch('/api/models/open-in-slicer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slicer: slicer.id,
          fileId: targetFile?.id,
          modelId: model.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setOpenStatus({ type: 'success', text: `Erfolgreich in ${slicer.name} geöffnet!` });
        confetti({ particleCount: 35, spread: 60 });
        setOpening(false);
        return;
      }
    } catch {}

    // 2. Fallback to registered browser URL protocol scheme (acnext://, orcaslicer://, etc.)
    try {
      window.location.href = slicer.scheme;
      setOpenStatus({ type: 'info', text: `Slicer-Befehl an ${slicer.name} gesendet.` });
      confetti({ particleCount: 30, spread: 50 });
    } catch (e) {
      setOpenStatus({ type: 'error', text: 'Konnte Slicer nicht öffnen. Lade die Datei herunter.' });
    } finally {
      setOpening(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fileDownloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">In Slicer übertragen</h2>
              <p className="text-xs text-slate-400">{model.title} {targetFile ? `(${targetFile.original_name})` : ''}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Alert if triggered */}
          {openStatus && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium border ${
              openStatus.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                : 'bg-cyan-950/70 border-cyan-500/40 text-cyan-200'
            }`}>
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{openStatus.text}</span>
            </div>
          )}

          <p className="text-xs text-slate-300">
            Wähle deinen installierten Slicer für eine direkte Übergabe oder lade die Modelldatei herunter:
          </p>

          {/* Slicer Cards (3 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {slicers.map((slicer) => (
              <button
                key={slicer.name}
                onClick={() => handleOpenSlicer(slicer)}
                className="group text-left p-4 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{slicer.icon}</span>
                      <span className="font-bold text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                        {slicer.name}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                      {slicer.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {slicer.desc}
                  </p>
                </div>
                
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
                  <span>Öffnen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>

          {/* Direct File Link & Quick Download Fallback */}
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium">Direkter Modell-Downloadlink:</span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopiert!' : 'Link kopieren'}</span>
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={fileDownloadUrl}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono select-all focus:outline-none"
            />
          </div>

          {/* AIPrintStudio Promo */}
          <a
            href="https://github.com/Schello805/aiprintstudio"
            target="_blank"
            rel="noopener noreferrer"
            title="Aus Bildern (Wappen, Logos) druckfertige 3D-Dateien (auch mehrfarbig) erstellen!"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/30 border border-cyan-500/30 hover:border-cyan-400 transition group text-xs text-slate-300"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🍎</span>
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-cyan-300 transition flex items-center gap-1.5">
                  <span>AIPrintStudio für macOS</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    Bild zu 3D
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Erstelle aus 2D-Bildern (Wappen, Logos, Grafiken) direkt druckfertige 3D-Dateien – auch mehrfarbig!
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
          </a>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <span>Tipp: Falls das URL-Schema nicht öffnet, Datei herunterladen & in Slicer ziehen.</span>
          <button
            onClick={() => window.location.href = zipDownloadUrl}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Datei laden</span>
          </button>
        </div>

      </div>
    </div>
  );
}
