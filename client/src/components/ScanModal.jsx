import React, { useState } from 'react';
import { 
  X, 
  FolderSync, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ScanModal({ onClose, onScanComplete, systemInfo }) {
  const [customPath, setCustomPath] = useState(systemInfo?.watch_dir || './data/watch_import');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    setScanning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/system/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: customPath })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Scan fehlgeschlagen');
      }

      setResult(data);
      if (data.added > 0) {
        confetti({ particleCount: 50, spread: 70 });
        onScanComplete();
      }
    } catch (err) {
      setError(err.message || 'Verbindungsfehler beim Scannen');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Ordner scannen & indizieren</h2>
              <p className="text-xs text-slate-400">Automatische Erfassung bestehender STL- & 3MF-Sammlungen</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleScan} className="p-6 space-y-5">
          
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              Automatischer Watcher & Ordner-Import:
            </p>
            <p>
              Dateien, die in den Ordner <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">{systemInfo?.watch_dir || 'data/watch_import'}</code> gelegt werden, werden automatisch im Hintergrund überwacht und importiert.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Zu scannender Pfad
            </label>
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="/Pfad/zu/deinen/STL-Dateien"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {result && (
            <div className="p-4 rounded-2xl bg-cyan-950/50 border border-cyan-800 text-cyan-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>{result.message}</span>
              </div>
              {result.errors?.length > 0 && (
                <p className="text-red-300 text-[11px] pt-1">
                  {result.errors.length} Dateien konnten nicht gelesen werden.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              Schließen
            </button>
            <button
              type="submit"
              disabled={scanning}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Scanne Verzeichnis...</span>
                </>
              ) : (
                <>
                  <FolderSync className="w-4 h-4" />
                  <span>Jetzt scannen</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
