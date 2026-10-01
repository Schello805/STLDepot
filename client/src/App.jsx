import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import ModelCard from './components/ModelCard';
import Footer from './components/Footer';
import { formatTitleFromFilename } from './utils/formatUtils';

// Helper to auto-reload if dynamic chunk loading fails due to app update
const safeLazy = (importFn) => lazy(async () => {
  try {
    return await importFn();
  } catch (error) {
    console.warn('Chunk load error, reloading page to get fresh assets...', error);
    window.location.reload();
    return new Promise(() => {}); // prevent render while reloading
  }
});

// Code-split heavy modals and 3D dependencies
const ViewerModal = safeLazy(() => import('./components/ViewerModal'));
const UploadModal = safeLazy(() => import('./components/UploadModal'));
const EditModal = safeLazy(() => import('./components/EditModal'));
const SlicerModal = safeLazy(() => import('./components/SlicerModal'));
const ScanModal = safeLazy(() => import('./components/ScanModal'));
const SettingsModal = safeLazy(() => import('./components/SettingsModal'));
import { 
  Box, 
  Plus, 
  Sparkles, 
  Layers, 
  Search, 
  FolderSync, 
  Printer, 
  Filter, 
  SlidersHorizontal,
  RefreshCw,
  HardDrive,
  UploadCloud,
  CheckSquare,
  Square,
  Trash2,
  FolderInput,
  X,
  Check,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useDialog } from './context/DialogContext';

export default function App() {
  const { confirm, alert } = useDialog();
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Lazy Loading States (Progressive Infinite Scroll without pagination pages)
  useEffect(() => {
    document.body.className = 'theme-' + theme;
  }, [theme]);
  const INITIAL_BATCH = 24;
  const BATCH_INCREMENT = 18;
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedFilament, setSelectedFilament] = useState('Alle');
  const [selectedPrintTime, setSelectedPrintTime] = useState('Alle');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [theme, setTheme] = useState('dark');
  const [viewMode, setViewMode] = useState('grid');
  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState([]);

  // Batch Selection States
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchCategory, setBatchCategory] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Modal States
  const [activeViewerModel, setActiveViewerModel] = useState(null);
  const [activeSlicerModel, setActiveSlicerModel] = useState(null);
  const [activeSlicerFile, setActiveSlicerFile] = useState(null);
  const [activeEditModel, setActiveEditModel] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Material & Pricing Settings
  const [materialSettings, setMaterialSettings] = useState({
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

  // Background Upload State
  const [backgroundUpload, setBackgroundUpload] = useState({
    active: false,
    progress: 0,
    current: 0,
    total: 0,
    currentTitle: '',
    successCount: 0,
    statusText: ''
  });

  // Prevent accidental tab close or page leave while background upload is in progress
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (backgroundUpload.active) {
        e.preventDefault();
        e.returnValue = 'Upload läuft noch. Möchtest du die Seite wirklich verlassen?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [backgroundUpload.active]);

  // Drag over window state
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Fetch System Info & Dynamic Revision
  const fetchSystemInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/system/info');
      const data = await res.json();
      if (data.success) {
        setSystemInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch system info:', err);
    }
  }, []);

  // Fetch Categories & Tags
  const fetchMetadata = useCallback(async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/models/categories'),
        fetch('/api/models/tags')
      ]);
      const catData = await catRes.json();
      const tagData = await tagRes.json();
      if (catData.success) setCategories(catData.data);
      if (tagData.success) setTags(tagData.data);
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  }, []);

  // Global Drag & Drop
  const handleGlobalDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setGlobalDragActive(true);
    }
  }, []);

  const handleGlobalDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setGlobalDragActive(false);
  }, []);

  const handleGlobalDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setGlobalDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter(f => 
        f.name.toLowerCase().endsWith('.stl') || 
        f.name.toLowerCase().endsWith('.3mf') ||
        f.name.toLowerCase().endsWith('.gcode') ||
        f.name.toLowerCase().endsWith('.bgcode')
      );
      
      if (validFiles.length > 0) {
        setDroppedFiles(validFiles);
        setIsUploadOpen(true);
      }
    }
  }, []);

  // Fetch Models
  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'Alle') params.append('category', selectedCategory);
      if (selectedTag) params.append('tag', selectedTag);
      if (selectedFilament && selectedFilament !== 'Alle') params.append('filament', selectedFilament);
      if (selectedPrintTime && selectedPrintTime !== 'Alle') params.append('printTime', selectedPrintTime);
      if (onlyFavorites) params.append('favorite', 'true');
      if (sortBy) params.append('sort', sortBy);

      const res = await fetch(`/api/models?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setModels(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedTag, selectedFilament, selectedPrintTime, onlyFavorites, sortBy]);

  // Fetch Material Pricing Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/system/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setMaterialSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  const handleSaveSettings = async (newSettings) => {
    const res = await fetch('/api/system/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Fehler beim Speichern');
    }
    setMaterialSettings(newSettings);
    fetchModels();
    fetchSystemInfo();
  };

  const handleRecalculateWeights = async () => {
    const res = await fetch('/api/system/recalculate-weights', { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Fehler bei der Neuberechnung');
    }
    fetchModels();
    return data;
  };

  useEffect(() => {
    fetchSystemInfo();
    fetchMetadata();
    fetchSettings();
  }, [fetchSystemInfo, fetchMetadata, fetchSettings]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchModels();
    }, 200);
    return () => clearTimeout(timeout);
  }, [fetchModels]);

  // Reset lazy load counter when filters or sort change
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [searchQuery, selectedCategory, selectedTag, onlyFavorites, sortBy]);

  // Sliced models for progressive lazy loading
  const visibleModels = useMemo(() => {
    return models.slice(0, visibleCount);
  }, [models, visibleCount]);

  // IntersectionObserver for progressive infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => {
          if (prev < models.length) {
            return Math.min(prev + BATCH_INCREMENT, models.length);
          }
          return prev;
        });
      }
    }, { rootMargin: '350px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [models.length, visibleCount]);

  // Concurrent Background Folder Upload Runner (4 parallel workers) with Duplicate Detection
  const startFolderUpload = useCallback(async ({ items, isPreserve, folderName, duplicateAction = 'skip' }) => {
    if (!items || items.length === 0) return;
    const total = items.length;
    let completed = 0;
    let added = 0;
    let skipped = 0;
    let overwritten = 0;
    let lastRefreshTime = Date.now();

    setBackgroundUpload({
      active: true,
      progress: 1,
      current: 0,
      total,
      currentTitle: items[0]?.name || '',
      successCount: 0,
      statusText: `Starte Import (${total} Einträge, Modus: ${duplicateAction === 'skip' ? 'Duplikate überspringen' : 'Duplikate überschreiben'})...`
    });

    const CONCURRENCY = 4;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < total) {
        const i = nextIndex++;
        const item = items[i];
        const formattedTitle = formatTitleFromFilename(item.name || 'Modell');

        setBackgroundUpload(prev => ({
          ...prev,
          current: completed + 1,
          currentTitle: formattedTitle,
          statusText: `(${completed + 1}/${total}) ${formattedTitle}...`
        }));

        const formData = new FormData();
        formData.append('title', formattedTitle);
        formData.append('author', 'Michael Schellenberger');
        formData.append('filament_color', '#38bdf8');
        formData.append('filament_type', 'PLA');
        formData.append('duplicate_action', duplicateAction || 'skip');

        if (isPreserve) {
          formData.append('category', item.isSubfolder ? 'Baugruppen' : 'Deko & Haushalt');
          formData.append('description', item.isSubfolder 
            ? `Baugruppe aus Ordner "${item.name}" (${item.files.length} Teile)` 
            : `Einzelmodell aus "${folderName}"`);
          for (const file of item.files) {
            formData.append('files', file);
          }
        } else {
          formData.append('category', 'Deko & Haushalt');
          formData.append('files', item.file);
        }

        try {
          const res = await fetch('/api/models', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (res.ok && data.success) {
            if (data.action === 'skipped') {
              skipped++;
            } else if (data.action === 'overwritten') {
              overwritten++;
            } else {
              added++;
            }
          }
        } catch (err) {
          console.error('Upload error for', formattedTitle, err);
        }

        completed++;
        const pct = Math.round((completed / total) * 100);

        setBackgroundUpload(prev => ({
          ...prev,
          progress: pct,
          current: completed,
          successCount: added + overwritten
        }));

        // Dynamically refresh models while growing (every 2.5s or on finish)
        if (Date.now() - lastRefreshTime > 2500 || completed === total) {
          lastRefreshTime = Date.now();
          fetchModels();
          fetchMetadata();
          fetchSystemInfo();
        }
      }
    };

    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, total); w++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    // Final refresh
    fetchModels();
    fetchMetadata();
    fetchSystemInfo();
    confetti({ particleCount: 70, spread: 80 });

    let finalSummary = `✅ ${added} neu importiert`;
    if (skipped > 0) finalSummary += `, ${skipped} Duplikate übersprungen`;
    if (overwritten > 0) finalSummary += `, ${overwritten} aktualisiert`;

    setBackgroundUpload(prev => ({
      ...prev,
      active: false,
      progress: 100,
      statusText: finalSummary
    }));

    setTimeout(() => {
      setBackgroundUpload(prev => {
        if (!prev.active) return { ...prev, progress: 0, statusText: '' };
        return prev;
      });
    }, 7000);
  }, [fetchModels, fetchMetadata, fetchSystemInfo]);

  // Global Keyboard Shortcuts (Escape closes modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveViewerModel(null);
        setActiveSlicerModel(null);
        setActiveEditModel(null);
        setIsUploadOpen(false);
        setIsScannerOpen(false);
        if (selectionMode) {
          setSelectionMode(false);
          setSelectedIds([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionMode]);

  // Window-wide Drag & Drop handling
  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsWindowDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsWindowDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsWindowDragOver(false);
    setIsUploadOpen(true);
  };

  const handleToggleFavorite = async (model) => {
    try {
      const newFavStatus = !model.is_favorite;
      const res = await fetch(`/api/models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newFavStatus })
      });
      if (res.ok) {
        setModels(prev => prev.map(m => m.id === model.id ? { ...m, is_favorite: newFavStatus ? 1 : 0 } : m));
        if (activeViewerModel && activeViewerModel.id === model.id) {
          setActiveViewerModel(prev => ({ ...prev, is_favorite: newFavStatus ? 1 : 0 }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleToggleMulticolor = async (model) => {
    try {
      const nextStatus = !model.is_multicolor;
      const res = await fetch(`/api/models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_multicolor: nextStatus ? 1 : 0 })
      });
      if (res.ok) {
        setModels(prev => prev.map(m => m.id === model.id ? { ...m, is_multicolor: nextStatus ? 1 : 0 } : m));
        if (activeViewerModel && activeViewerModel.id === model.id) {
          setActiveViewerModel(prev => ({ ...prev, is_multicolor: nextStatus ? 1 : 0 }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle multicolor:', err);
    }
  };

  const handleDeleteModel = async (model) => {
    const confirmed = await confirm({
      title: 'Modell löschen',
      message: `Möchtest du das Modell "${model.title}" wirklich unwiderruflich löschen?\nAlle zugehörigen Dateien werden von der Festplatte entfernt.`,
      confirmText: 'Modell löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/models/${model.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeViewerModel?.id === model.id) setActiveViewerModel(null);
        fetchModels();
        fetchMetadata();
        fetchSystemInfo();
      } else {
        const data = await res.json().catch(() => ({}));
        await alert({
          title: 'Fehler beim Löschen',
          message: data.error || 'Das Modell konnte nicht gelöscht werden.',
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Failed to delete model:', err);
      await alert({
        title: 'Fehler beim Löschen',
        message: 'Ein Netzwerkfehler ist beim Löschen des Modells aufgetreten.',
        type: 'error'
      });
    }
  };

  // Batch Selection Handlers
  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === models.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(models.map(m => m.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm({
      title: 'Ausgewählte Modelle löschen',
      message: `Möchtest du wirklich alle ${selectedIds.length} ausgewählten Modelle unwiderruflich löschen?`,
      confirmText: `${selectedIds.length} Modelle löschen`,
      cancelText: 'Abbrechen',
      type: 'danger'
    });
    if (!confirmed) return;

    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/models/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        setSelectionMode(false);
        fetchModels();
        fetchMetadata();
        fetchSystemInfo();
      } else {
        const data = await res.json().catch(() => ({}));
        await alert({
          title: 'Fehler beim Löschen',
          message: data.error || 'Fehler beim Löschen der Modelle',
          type: 'error'
        });
      }
    } catch (err) {
      await alert({
        title: 'Fehler beim Löschen',
        message: 'Ein Netzwerkfehler ist beim Löschen aufgetreten.',
        type: 'error'
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/models/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (!res.ok) {
        throw new Error('Sammel-Download fehlgeschlagen');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stldepot-sammlung-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      confetti({ particleCount: 50, spread: 70 });
    } catch (err) {
      console.error('Batch download error:', err);
      await alert({
        title: 'Fehler beim Herunterladen',
        message: 'Die ausgewählten Modelle konnten nicht als ZIP exportiert werden.',
        type: 'error'
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchMoveCategory = async (cat) => {
    if (selectedIds.length === 0 || !cat) return;
    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/models/batch-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, category: cat })
      });
      if (res.ok) {
        confetti({ particleCount: 40, spread: 60 });
        setSelectedIds([]);
        setSelectionMode(false);
        fetchModels();
        fetchMetadata();
      } else {
        const data = await res.json().catch(() => ({}));
        await alert({
          title: 'Fehler beim Verschieben',
          message: data.error || 'Fehler beim Verschieben der Modelle.',
          type: 'error'
        });
      }
    } catch (err) {
      await alert({
        title: 'Fehler beim Verschieben',
        message: 'Ein Netzwerkfehler ist beim Verschieben aufgetreten.',
        type: 'error'
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-950/20 text-slate-100 flex flex-col bg-grid-pattern selection:bg-cyan-500 selection:text-slate-950 pb-20"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* Full-screen Drag Overlay */}
      {isWindowDragOver && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md border-4 border-dashed border-cyan-500 flex flex-col items-center justify-center p-8 pointer-events-none animate-in fade-in duration-150">
          <div className="w-20 h-20 rounded-3xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 animate-bounce">
            <UploadCloud className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">3D-Dateien hier ablegen!</h2>
          <p className="text-sm text-cyan-300 mt-1">Öffnet den Upload-Dialog mit automatischer 3D-Vorschau</p>
        </div>
      )}

      {/* Sticky Header Navbar */}
      {/* Global Drag Overlay */}
      {globalDragActive && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-sky-900/40 backdrop-blur-sm border-4 border-dashed border-sky-400 m-4 rounded-3xl pointer-events-none transition-all">
          <UploadCloud className="w-24 h-24 text-sky-400 animate-bounce" />
          <h2 className="text-3xl font-bold text-white mt-4 tracking-wide shadow-black drop-shadow-md">Dateien hier ablegen</h2>
          <p className="text-sky-200 mt-2 font-medium">STL, 3MF, G-Code & .bgcode</p>
        </div>
      )}
      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        onlyFavorites={onlyFavorites}
        setOnlyFavorites={setOnlyFavorites}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        systemInfo={systemInfo}
        theme={theme} setTheme={setTheme} viewMode={viewMode} setViewMode={setViewMode}
        setDarkMode={setDarkMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        backgroundUpload={backgroundUpload}
        selectedFilament={selectedFilament}
        setSelectedFilament={setSelectedFilament}
        selectedPrintTime={selectedPrintTime}
        setSelectedPrintTime={setSelectedPrintTime}
      />

      {/* Main Container - 92% Width for Modern Widescreen */}
      <main className="flex-1 w-[92%] max-w-[2400px] mx-auto px-2 sm:px-4 lg:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* Hero Banner with Quick Stats */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900/95 via-slate-850/90 to-cyan-950/40 border border-slate-700/80 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D Printing Storage Vault</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Dein persönlicher 3D-Modell Katalog
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Verwalte, visualisiere und öffne deine STL- & 3MF-Dateien direkt im Slicer (Bambu Studio, OrcaSlicer, Anycubic Slicer, PrusaSlicer).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 z-10 w-full md:w-auto">
            <div className="flex-1 sm:flex-initial p-3.5 sm:p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md text-center min-w-[105px] shadow-lg hover:border-cyan-500/40 transition">
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono tracking-tight">{systemInfo?.stats?.total_projects || models.length}</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">Modelle</div>
            </div>
            <div className="flex-1 sm:flex-initial p-3.5 sm:p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md text-center min-w-[105px] shadow-lg hover:border-cyan-500/40 transition">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">{categories.length}</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">Kategorien</div>
            </div>
            <div className="flex-1 sm:flex-initial p-3.5 sm:p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md text-center min-w-[105px] shadow-lg hover:border-cyan-500/40 transition">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">{systemInfo?.stats?.storage_formatted || '0 MB'}</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">Speicher</div>
            </div>
          </div>

          {/* Decorative ambient light orbs */}
          <div className="absolute -right-16 -top-16 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Toolbar Bar: Tags & Selection Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tags */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
            <span className="text-slate-400 font-medium whitespace-nowrap">Tags:</span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag('')}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm"
              >
                ✕ #{selectedTag}
              </button>
            )}
            {tags.slice(0, 10).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTag(selectedTag === t.name ? '' : t.name)}
                className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap font-medium ${
                  selectedTag === t.name
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm'
                    : 'bg-slate-800/70 text-slate-300 border border-slate-700/70 hover:text-white hover:bg-slate-750 hover:border-slate-600'
                }`}
              >
                #{t.name} <span className="text-[10px] text-slate-400 font-mono">({t.count})</span>
              </button>
            ))}
          </div>

          {/* Selection Mode Button */}
          {models.length > 0 && (
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) setSelectedIds([]);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                selectionMode 
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20 font-bold' 
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 hover:border-slate-600 shadow-sm'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectionMode ? 'Auswahl beenden' : 'Auswahl-Modus'}</span>
            </button>
          )}
        </div>

        {/* Model Catalog Grid - Responsive Wide Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-sm font-medium">Modelle werden geladen...</p>
          </div>
        ) : models.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
              {visibleModels.map((model) => (
                <ModelCard
                  key={model.id}
                viewMode={viewMode}
                  model={model}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.includes(model.id)}
                  onToggleSelect={handleToggleSelect}
                  onOpenViewer={(m) => setActiveViewerModel(m)}
                  onOpenSlicer={(m, f) => {
                    setActiveSlicerModel(m);
                    setActiveSlicerFile(f);
                  }}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDeleteModel}
                  onEdit={(m) => setActiveEditModel(m)}
                  materialSettings={materialSettings}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onToggleMulticolor={handleToggleMulticolor}
                />
              ))}
            </div>

            {/* Lazy Load Sentinel & Smooth Infinite Scroll Status */}
            <div className="pt-8 pb-4 flex flex-col items-center justify-center">
              {visibleModels.length < models.length ? (
                <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200 bg-slate-900/90 px-4 py-2 rounded-full border border-slate-700/80 shadow-lg">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Lade weitere Modelle ({visibleModels.length} von {models.length} sichtbar)...</span>
                  </div>
                  <button
                    onClick={() => setVisibleCount(prev => Math.min(prev + BATCH_INCREMENT, models.length))}
                    className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline font-mono mt-1"
                  >
                    + Mehr Modelle laden
                  </button>
                </div>
              ) : models.length > INITIAL_BATCH ? (
                <div className="text-center py-4">
                  <span className="text-xs font-mono text-slate-400 bg-slate-900/70 px-4 py-1.5 rounded-full border border-slate-800">
                    ✓ Alle {models.length} Modelle geladen
                  </span>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="py-20 px-6 rounded-3xl bg-slate-900/40 border border-slate-800 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Box className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-200">Keine 3D-Modelle gefunden</h3>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery || selectedCategory !== 'Alle' || onlyFavorites || selectedTag
                  ? 'Keine Treffer für deine aktuellen Filterkriterien. Versuche die Filter zurückzusetzen.'
                  : 'Dein Katalog ist noch leer. Lade dein erstes Modell hoch oder scanne einen Ordner.'}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              {(searchQuery || selectedCategory !== 'Alle' || onlyFavorites || selectedTag) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('Alle');
                    setSelectedTag('');
                    setOnlyFavorites(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  Filter zurücksetzen
                </button>
              )}
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold shadow-lg transition"
              >
                <Plus className="w-4 h-4" />
                <span>Modell hinzufügen</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* FLOATING BATCH ACTIONS TOOLBAR (WHEN MODELS ARE SELECTED) */}
      {selectionMode && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-cyan-950/60 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold">
              {selectedIds.length} {selectedIds.length === 1 ? 'Modell' : 'Modelle'}
            </span>
            <button
              onClick={handleSelectAll}
              className="text-xs text-slate-300 hover:text-white underline font-medium"
            >
              {selectedIds.length === models.length ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Category Dropdown mover */}
            <select
              onChange={(e) => {
                if (e.target.value) handleBatchMoveCategory(e.target.value);
              }}
              defaultValue=""
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="" disabled>📁 Kategorie zuweisen...</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
              <option value="Deko & Haushalt">Deko & Haushalt</option>
              <option value="Werkstatt & Tools">Werkstatt & Tools</option>
              <option value="3D-Druck Zubehör">3D-Druck Zubehör</option>
              <option value="Gadgets & Elektronik">Gadgets & Elektronik</option>
              <option value="Gaming & Tabletop">Gaming & Tabletop</option>
            </select>

            {/* Batch Download ZIP */}
            <button
              onClick={handleBatchDownload}
              disabled={isProcessingBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-xs font-bold border border-cyan-700/80 transition shadow-sm"
              title="Alle ausgewählten Modelle als gemeinsame ZIP herunterladen"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sammel-ZIP</span>
            </button>

            {/* Batch Delete */}
            <button
              onClick={handleBatchDelete}
              disabled={isProcessingBatch}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 text-xs font-bold border border-red-800 transition shadow-sm"
              title="Ausgewählte Modelle löschen"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Löschen</span>
            </button>

            {/* Close Selection */}
            <button
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds([]);
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Auswahl beenden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Global Modals (Code-split & lazy loaded on demand) */}
      <Suspense fallback={null}>
        {activeViewerModel && (
          <ViewerModal
            model={activeViewerModel}
            onClose={() => setActiveViewerModel(null)}
            onOpenSlicer={(m, f) => {
              setActiveSlicerModel(m);
              setActiveSlicerFile(f);
            }}
            onDelete={handleDeleteModel}
            onEdit={(m) => {
              setActiveViewerModel(null);
              setActiveEditModel(m);
            }}
            onToggleFavorite={handleToggleFavorite}
            onModelUpdated={() => {
              fetchModels();
              fetchMetadata();
              fetchSystemInfo();
            }}
            materialSettings={materialSettings}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeSlicerModel && (
          <SlicerModal
            model={activeSlicerModel}
            file={activeSlicerFile}
            onClose={() => {
              setActiveSlicerModel(null);
              setActiveSlicerFile(null);
            }}
          />
        )}

        {activeEditModel && (
          <EditModal
            model={activeEditModel}
            onClose={() => setActiveEditModel(null)}
            onUpdated={() => {
              fetchModels();
              fetchMetadata();
              fetchSystemInfo();
            }}
          />
        )}

        {isUploadOpen && (
          <UploadModal 
          onClose={() => { setIsUploadOpen(false); setDroppedFiles([]); }}
          initialFiles={droppedFiles}
            onUploadSuccess={() => {
              fetchModels();
              fetchMetadata();
              fetchSystemInfo();
            }}
          />
        )}

        {isScannerOpen && (
          <ScanModal
            onClose={() => setIsScannerOpen(false)}
            onScanComplete={() => {
              fetchModels();
              fetchMetadata();
              fetchSystemInfo();
            }}
            systemInfo={systemInfo}
            backgroundUpload={backgroundUpload}
            onStartBackgroundUpload={startFolderUpload}
          />
        )}

        {/* Material Pricing & Cost Settings Modal */}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            materialSettings={materialSettings}
            onSaveSettings={handleSaveSettings}
            onRecalculateWeights={handleRecalculateWeights}
          />
        )}
      </Suspense>

      {/* Footer with Dynamic Rev & Open Source info */}
      <BottomNav 
        onHome={() => { setSearchQuery(''); setSelectedCategory('Alle'); setOnlyFavorites(false); window.scrollTo(0,0); }}
        onUpload={() => setIsUploadOpen(true)}
        onScan={() => setIsScannerOpen(true)}
        onSettings={() => setIsSettingsOpen(true)}
      />
      <Footer systemInfo={systemInfo} />

    </div>
  );
}
