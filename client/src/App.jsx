import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import ModelCard from './components/ModelCard';
import ViewerModal from './components/ViewerModal';
import UploadModal from './components/UploadModal';
import EditModal from './components/EditModal';
import SlicerModal from './components/SlicerModal';
import ScanModal from './components/ScanModal';
import Footer from './components/Footer';
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
  UploadCloud
} from 'lucide-react';

export default function App() {
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [selectedTag, setSelectedTag] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [darkMode, setDarkMode] = useState(true);

  // Modal States
  const [activeViewerModel, setActiveViewerModel] = useState(null);
  const [activeSlicerModel, setActiveSlicerModel] = useState(null);
  const [activeSlicerFile, setActiveSlicerFile] = useState(null);
  const [activeEditModel, setActiveEditModel] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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

  // Fetch Models
  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'Alle') params.append('category', selectedCategory);
      if (selectedTag) params.append('tag', selectedTag);
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
  }, [searchQuery, selectedCategory, selectedTag, onlyFavorites, sortBy]);

  useEffect(() => {
    fetchSystemInfo();
    fetchMetadata();
  }, [fetchSystemInfo, fetchMetadata]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchModels();
    }, 200);
    return () => clearTimeout(timeout);
  }, [fetchModels]);

  // Global Keyboard Shortcuts (Escape closes modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveViewerModel(null);
        setActiveSlicerModel(null);
        setActiveEditModel(null);
        setIsUploadOpen(false);
        setIsScannerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleDeleteModel = async (model) => {
    if (!window.confirm(`Möchtest du das Modell "${model.title}" wirklich unwiderruflich löschen?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/models/${model.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeViewerModel?.id === model.id) setActiveViewerModel(null);
        fetchModels();
        fetchMetadata();
        fetchSystemInfo();
      }
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-grid-pattern selection:bg-cyan-500 selection:text-slate-950"
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
        systemInfo={systemInfo}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Hero Banner with Quick Stats */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-cyan-950/40 border border-slate-800/80 shadow-2xl overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>3D Printing Storage Vault</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Dein persönlicher 3D-Modell Katalog
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Verwalte, visualisiere und öffne deine STL- & 3MF-Dateien direkt im Slicer (Bambu Studio, OrcaSlicer, PrusaSlicer).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto">
            <div className="flex-1 sm:flex-initial p-4 rounded-2xl bg-slate-950/60 border border-slate-800 backdrop-blur-md text-center min-w-[110px]">
              <div className="text-2xl font-black text-cyan-400 font-mono">{systemInfo?.stats?.total_projects || models.length}</div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Modelle</div>
            </div>
            <div className="flex-1 sm:flex-initial p-4 rounded-2xl bg-slate-950/60 border border-slate-800 backdrop-blur-md text-center min-w-[110px]">
              <div className="text-2xl font-black text-slate-100 font-mono">{categories.length}</div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Kategorien</div>
            </div>
            <div className="flex-1 sm:flex-initial p-4 rounded-2xl bg-slate-950/60 border border-slate-800 backdrop-blur-md text-center min-w-[110px]">
              <div className="text-2xl font-black text-slate-200 font-mono">{systemInfo?.stats?.storage_formatted || '0 MB'}</div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Speicher</div>
            </div>
          </div>

          {/* Decorative glowing gradient sphere in background */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Popular Tags Filter Bar if available */}
        {tags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-slate-500 font-medium whitespace-nowrap">Tags:</span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag('')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700 font-semibold"
              >
                ✕ #{selectedTag}
              </button>
            )}
            {tags.slice(0, 10).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTag(selectedTag === t.name ? '' : t.name)}
                className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                  selectedTag === t.name
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                #{t.name} <span className="text-[10px] text-slate-500">({t.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Model Catalog Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-sm font-medium">Modelle werden geladen...</p>
          </div>
        ) : models.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onOpenViewer={(m) => setActiveViewerModel(m)}
                onOpenSlicer={(m, f) => {
                  setActiveSlicerModel(m);
                  setActiveSlicerFile(f);
                }}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeleteModel}
                onEdit={(m) => setActiveEditModel(m)}
              />
            ))}
          </div>
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

      {/* Global Modals */}
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
          onClose={() => setIsUploadOpen(false)}
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
        />
      )}

      {/* Footer with Dynamic Rev & Open Source info */}
      <Footer systemInfo={systemInfo} />

    </div>
  );
}
