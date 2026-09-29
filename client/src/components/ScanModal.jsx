import React, { useState, useRef } from 'react';
import { 
  X, 
  FolderSync, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  FolderOpen,
  FolderSearch,
  ExternalLink,
  UploadCloud,
  Layers,
  FileBox,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ScanModal({ onClose, onScanComplete, systemInfo }) {
  const defaultWatchDir = systemInfo?.watch_dir || '/Users/michael/Programmerierung/STL-Storage/data/watch_import';
  const [customPath, setCustomPath] = useState(defaultWatchDir);
  const [scanning, setScanning] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [folderOpenFeedback, setFolderOpenFeedback] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Native folder selection via browser
  const folderInputRef = useRef(null);
  const [pickedFolderInfo, setPickedFolderInfo] = useState(null);
  const [isUploadingPickedFolder, setIsUploadingPickedFolder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Open folder directly in OS Finder / Explorer
  const handleOpenInFinder = async (targetPath = customPath) => {
    setOpeningFolder(true);
    setFolderOpenFeedback('');
    try {
      const res = await fetch('/api/system/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath || defaultWatchDir })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFolderOpenFeedback('✅ Ordner im Finder / Dateimanager geöffnet!');
        setTimeout(() => setFolderOpenFeedback(''), 4000);
      } else {
        setError(data.error || 'Konnte Ordner nicht öffnen');
      }
    } catch (err) {
      setError('Verbindungsfehler beim Öffnen des Ordners');
    } finally {
      setOpeningFolder(false);
    }
  };

  // Trigger scanning server path
  const handleScan = async (e) => {
    if (e) e.preventDefault();
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

  // Handle native OS directory picker selection
  const handleFolderPickerChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    const stlFiles = selectedFiles.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.stl') || name.endsWith('.3mf');
    });

    const folderName = selectedFiles[0]?.webkitRelativePath?.split('/')[0] || 'Ausgewählter Ordner';

    setPickedFolderInfo({
      name: folderName,
      allFiles: selectedFiles,
      stlFiles: stlFiles,
      count: stlFiles.length
    });
  };

  // Upload the files selected through native directory picker
  const handleUploadPickedFolder = async () => {
    if (!pickedFolderInfo || pickedFolderInfo.stlFiles.length === 0) return;

    setIsUploadingPickedFolder(true);
    setError(null);
    setUploadProgress(10);

    try {
      // Group files or upload in batch
      for (let i = 0; i < pickedFolderInfo.stlFiles.length; i++) {
        const file = pickedFolderInfo.stlFiles[i];
        const formData = new FormData();
        const baseTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        formData.append('title', baseTitle);
        formData.append('category', 'Deko & Haushalt');
        formData.append('author', 'Michael Schellenberger');
        formData.append('files', file);

        await fetch('/api/models', {
          method: 'POST',
          body: formData
        });

        setUploadProgress(Math.round(((i + 1) / pickedFolderInfo.stlFiles.length) * 100));
      }

      confetti({ particleCount: 70, spread: 80 });
      setResult({
        message: `${pickedFolderInfo.stlFiles.length} Modelle aus "${pickedFolderInfo.name}" erfolgreich importiert!`,
        added: pickedFolderInfo.stlFiles.length,
        errors: []
      });
      setPickedFolderInfo(null);
      onScanComplete();
    } catch (err) {
      setError('Fehler beim Importieren des Ordners');
    } finally {
      setIsUploadingPickedFolder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Ordner scannen & Dateimanager</h2>
              <p className="text-xs text-slate-400">Öffne den Finder oder wähle einen Ordner mit STL- & 3MF-Dateien</p>
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
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* OPTION 1: Open in Native OS Finder / Explorer */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-cyan-400" />
                  <span>Automatischen Import-Ordner im Finder öffnen</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Öffnet den Überwachungs-Ordner direkt auf deinem System. Ziehe deine 3D-Dateien einfach per Drag & Drop hinein – sie werden automatisch sofort erfasst!
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenInFinder(customPath)}
                disabled={openingFolder}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition active:scale-95 disabled:opacity-50"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{openingFolder ? 'Öffne...' : 'Im Finder öffnen'}</span>
              </button>
            </div>

            {folderOpenFeedback && (
              <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-xl animate-in fade-in">
                {folderOpenFeedback}
              </div>
            )}
          </div>

          {/* OPTION 2: Pick any Local Folder via Native OS File Picker */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <FolderSearch className="w-4 h-4 text-amber-400" />
                  <span>Beliebigen lokalen Ordner auswählen</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Wähle über den systemeigenen Dialog einen beliebigen Ordner auf deiner Festplatte aus, um alle darin liegenden STLs auf einmal zu importieren.
                </p>
              </div>

              {/* Hidden webkitdirectory input */}
              <input 
                type="file" 
                ref={folderInputRef}
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                onChange={handleFolderPickerChange}
              />

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs border border-slate-700 transition"
              >
                <FolderSearch className="w-4 h-4 text-amber-400" />
                <span>Ordner wählen...</span>
              </button>
            </div>

            {/* If folder picked */}
            {pickedFolderInfo && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                    <FileBox className="w-4 h-4 text-amber-400" />
                    <span>Ordner: {pickedFolderInfo.name}</span>
                  </div>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    {pickedFolderInfo.count} STL/3MF {pickedFolderInfo.count === 1 ? 'Datei' : 'Dateien'} gefunden
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleUploadPickedFolder}
                  disabled={isUploadingPickedFolder || pickedFolderInfo.count === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
                >
                  {isUploadingPickedFolder ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Importiere ({uploadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{pickedFolderInfo.count} Dateien importieren</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* OPTION 3: Server Path Input (Custom Path Scanner) */}
          <form onSubmit={handleScan} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Server-Pfad direkt scannen
                </label>
                <span className="text-[10px] text-slate-500">Für NAS oder Docker</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/Pfad/zu/deinen/STL-Dateien"
                  className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={scanning}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition disabled:opacity-50"
                >
                  {scanning ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FolderSync className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>Scannen</span>
                </button>
              </div>
            </div>
          </form>

          {/* Result Alert */}
          {result && (
            <div className="p-4 rounded-2xl bg-cyan-950/60 border border-cyan-800 text-cyan-200 text-xs space-y-1 animate-in fade-in">
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

          {/* Error Alert */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Fertig
          </button>
        </div>

      </div>
    </div>
  );
}

