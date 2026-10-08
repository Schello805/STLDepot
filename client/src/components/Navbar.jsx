import React, { useState } from 'react';
import { 
  Box, 
  Search, 
  PlusCircle, 
  FolderSync, 
  Heart, 
  SlidersHorizontal, 
  Sparkles,
  Sun,
  Moon,
  HardDrive,
  Coins,
  Settings,
  LayoutGrid,
  List,
  Monitor,
  Filter,
  X,
  CheckSquare
} from 'lucide-react';

export default function Navbar({ 
  searchQuery, 
  setSearchQuery, 
  selectedCategory, 
  setSelectedCategory,
  categories = [],
  onlyFavorites,
  setOnlyFavorites,
  onOpenUpload,
  onOpenScanner,
  onOpenSettings,
  systemInfo,
  theme, setTheme, viewMode, setViewMode,
  sortBy,
  setSortBy,
  backgroundUpload,
  selectedFilament = 'Alle',
  setSelectedFilament,
  selectedPrintTime = 'Alle',
  setSelectedPrintTime,
  selectedMulticolor = 'Alle',
  setSelectedMulticolor,
  selectedSupports = 'Alle',
  setSelectedSupports,
  onHome,
  tags = [],
  filterOptions = { filaments: [], printTimes: [], multicolors: [], supports: [] },
  selectedTag = '',
  setSelectedTag = () => {},
  selectionMode = false,
  setSelectionMode = () => {},
  setSelectedIds = () => {},
  modelsCount = 0
}) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const hasActiveFilters = selectedFilament !== 'Alle' || selectedPrintTime !== 'Alle' || selectedMulticolor !== 'Alle' || selectedSupports !== 'Alle' || sortBy !== 'newest';

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-slate-900/90 border-b border-slate-700/70 shadow-lg shadow-black/20 transition-colors">
      <div className="w-[92%] max-w-[2000px] mx-auto px-2 sm:px-4">
        {/* Row 1: Brand + Search (Desktop) + Action Buttons */}
        <div className="flex items-center justify-between h-14 sm:h-20 gap-2 sm:gap-4">
          
          {/* Brand Logo & Title */}
          <button
            type="button"
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none shrink-0 text-left"
            onClick={onHome}
            title="Zur Startseite"
          >
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-cyan-500/30 via-slate-800 to-amber-500/30 p-0.5 shadow-lg shadow-cyan-500/20 group overflow-hidden">
              <img 
                src="/logo.png" 
                alt="STLDepot Logo" 
                className="w-full h-full object-contain rounded-xl drop-shadow group-hover:scale-105 transition-transform" 
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                  STL-Storage
                </h1>
                <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
                  Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                3D-Druck Modell-Katalog & Slicer Vault
              </p>
            </div>
          </button>

          {/* Live Search Bar – Desktop Only (Mobile search is below) */}
          <div className="flex-1 max-w-xl mx-2 sm:mx-4 hidden sm:block">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Modelle suchen (Titel, Filament, Tags, Notizen)..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 hover:bg-slate-950/80 focus:bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* View Toggle */}
            <button
              onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors shadow-sm hidden sm:block"
              title={viewMode === 'grid' ? "Zur Listenansicht" : "Zur Rasteransicht"}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </button>
            
            {/* Theme Toggle */}
            <button
              onClick={() => {
                if (theme === 'dark') setTheme('light');
                else if (theme === 'light') setTheme('oled');
                else setTheme('dark');
              }}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors shadow-sm hidden sm:block"
              title="Theme wechseln (Dark / Light / OLED)"
            >
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4 text-cyan-400" />}
            </button>
            
            {/* AIPrintStudio Mac App Link */}
            <a
              href="https://github.com/Schello805/aiprintstudio"
              target="_blank"
              rel="noopener noreferrer"
              title="AIPrintStudio: Aus Bildern (Wappen, Logos) 3D-Druckdateien erstellen (auch mehrfarbig)!"
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700/60 hover:border-cyan-500/50 transition shadow-sm group"
            >
              <span className="text-base">🍎</span>
              <div className="text-left">
                <span className="block leading-tight">Mac App: <strong className="text-cyan-400 group-hover:underline">AIPrintStudio</strong></span>
                <span className="block text-[10px] text-slate-400 font-normal">Bilder & Logos zu 3D-Druck (mehrfarbig)</span>
              </div>
            </a>

            {/* Live Upload Progress Indicator in Header */}
            {backgroundUpload?.active ? (
              <button
                onClick={onOpenScanner}
                className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-950/90 to-slate-900 border border-cyan-500/50 text-cyan-200 text-xs font-semibold shadow-lg shadow-cyan-500/10 hover:border-cyan-400 transition animate-in fade-in"
                title="Klicke, um den Import-Dialog zu öffnen"
              >
                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-mono text-cyan-300 font-bold">
                  {backgroundUpload.current}/{backgroundUpload.total}
                </span>
                <span className="text-cyan-400 font-mono text-[11px] hidden sm:inline">
                  ({backgroundUpload.progress}%)
                </span>
                <span className="hidden xl:inline text-slate-300 truncate max-w-[120px]">
                  {backgroundUpload.currentTitle}
                </span>
              </button>
            ) : backgroundUpload?.statusText ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow animate-in fade-in">
                <span>{backgroundUpload.statusText}</span>
              </div>
            ) : null}

            {/* Material Pricing & Cost Settings – Hidden on mobile (available via BottomNav) */}
            <button
              onClick={onOpenSettings}
              title="Materialpreise & Druckkosten konfigurieren"
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-emerald-300 hover:text-emerald-200 text-xs sm:text-sm font-medium border border-slate-700/60 hover:border-emerald-500/50 transition shadow-sm active:scale-95"
            >
              <Coins className="w-4 h-4 text-emerald-400" />
              <span className="hidden lg:inline">Materialpreise</span>
            </button>

            {/* Folder Scanner Trigger */}
            <button
              onClick={onOpenScanner}
              title="Ordner scannen / automatischer Import"
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-sm font-medium border border-slate-700/60 hover:border-slate-600 transition shadow-sm"
            >
              <FolderSync className="w-4 h-4 text-cyan-400" />
              <span>Ordner scannen</span>
            </button>

            {/* Upload Button – Icon-only on mobile, full on desktop */}
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-2 px-3 py-2.5 sm:px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-cyan-600/25 hover:shadow-cyan-500/35 active:scale-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Modell hinzufügen</span>
            </button>
          </div>
        </div>

        {/* Row 2 (Mobile only): Search Bar */}
        <div className="sm:hidden pb-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Modelle suchen..."
              className="w-full pl-9 pr-10 py-2.5 bg-slate-950/60 focus:bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills Bar */}
        <div className="py-2 sm:py-2.5 flex items-center justify-between overflow-x-auto no-scrollbar gap-2 sm:gap-3 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-max">
            {/* Category: Alle */}
            <button
              onClick={() => setSelectedCategory('Alle')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg font-medium transition ${
                selectedCategory === 'Alle'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Alle
            </button>

            {/* Favorite Filter */}
            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg font-medium transition ${
                onlyFavorites
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/60'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-rose-400' : ''}`} />
              <span>Favoriten</span>
            </button>

            {/* Dynamically retrieved categories */}
            {categories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                  selectedCategory === cat.category
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{cat.category}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-400">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex items-center gap-2 min-w-max text-slate-400">
            {/* Mobile: Filter toggle button */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition ${
                showMobileFilters || hasActiveFilters
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
              {hasActiveFilters && !showMobileFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>

            {/* Desktop: Inline filter dropdowns */}
            {/* Filament / Material Filter */}
            {setSelectedFilament && filterOptions.filaments.length > 0 && (
              <select
                value={selectedFilament}
                onChange={(e) => setSelectedFilament(e.target.value)}
                className="hidden sm:block bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                title="Nach Filament-Material filtern"
              >
                <option value="Alle">Material: Alle</option>
                {filterOptions.filaments.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}

            {/* Print Time Filter */}
            {setSelectedPrintTime && filterOptions.printTimes.length > 0 && (
              <select
                value={selectedPrintTime}
                onChange={(e) => setSelectedPrintTime(e.target.value)}
                className="hidden sm:block bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                title="Nach geschätzter Druckzeit filtern"
              >
                <option value="Alle">Druckzeit: Alle</option>
                {filterOptions.printTimes.includes('short') && <option value="short">&lt; 2 Std. (Schnell)</option>}
                {filterOptions.printTimes.includes('medium') && <option value="medium">2 – 6 Std. (Mittel)</option>}
                {filterOptions.printTimes.includes('long') && <option value="long">&gt; 6 Std. (Groß)</option>}
              </select>
            )}

            {/* Multicolor Filter */}
            {setSelectedMulticolor && filterOptions.multicolors.length > 0 && (
              <select
                value={selectedMulticolor}
                onChange={(e) => setSelectedMulticolor(e.target.value)}
                className="hidden sm:block bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                title="Nach Mehrfarbigkeit filtern"
              >
                <option value="Alle">Mehrfarbig: Alle</option>
                {filterOptions.multicolors.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            {/* Supports Filter */}
            {setSelectedSupports && filterOptions.supports.length > 0 && (
              <select
                value={selectedSupports}
                onChange={(e) => setSelectedSupports(e.target.value)}
                className="hidden sm:block bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                title="Nach Stützstruktur filtern"
              >
                <option value="Alle">Stützen: Alle</option>
                {filterOptions.supports.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            {/* Sort Selector */}
            <span className="text-[11px] font-medium hidden md:inline ml-1">Sortierung:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="hidden sm:block bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              <option value="newest">Neueste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
              <option value="title_asc">Name (A-Z)</option>
              <option value="title_desc">Name (Z-A)</option>
              <option value="print_time">Druckzeit (Längste)</option>
              <option value="weight_asc">Gewicht (Leichteste)</option>
              <option value="weight_desc">Gewicht (Schwerste)</option>
            </select>
          </div>
        </div>

        {/* Toolbar Bar: Tags & Selection Mode Toggle */}
        <div className="py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/60">
          {/* Tags */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
            <span className="text-slate-400 font-medium whitespace-nowrap">Tags:</span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag('')}
                className="px-3 py-2 sm:px-2.5 sm:py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm"
              >
                ✕ #{selectedTag}
              </button>
            )}
            {tags.slice(0, 10).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTag(selectedTag === t.name ? '' : t.name)}
                className={`px-3 py-2 sm:px-2.5 sm:py-1 rounded-lg transition whitespace-nowrap font-medium ${
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
          {modelsCount > 0 && (
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

        {/* Mobile Filter Drawer (expanded below filter pills) */}
        {showMobileFilters && (
          <div className="sm:hidden pb-3 flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Filter & Sortierung</span>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {setSelectedFilament && filterOptions.filaments.length > 0 && (
                <select
                  value={selectedFilament}
                  onChange={(e) => setSelectedFilament(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                >
                  <option value="Alle">Material: Alle</option>
                  {filterOptions.filaments.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              )}
              {setSelectedPrintTime && filterOptions.printTimes.length > 0 && (
                <select
                  value={selectedPrintTime}
                  onChange={(e) => setSelectedPrintTime(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                >
                  <option value="Alle">Druckzeit: Alle</option>
                  {filterOptions.printTimes.includes('short') && <option value="short">&lt; 2 Std.</option>}
                  {filterOptions.printTimes.includes('medium') && <option value="medium">2 – 6 Std.</option>}
                  {filterOptions.printTimes.includes('long') && <option value="long">&gt; 6 Std.</option>}
                </select>
              )}
              {setSelectedMulticolor && filterOptions.multicolors.length > 0 && (
                <select
                  value={selectedMulticolor}
                  onChange={(e) => setSelectedMulticolor(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                >
                  <option value="Alle">Mehrfarbig: Alle</option>
                  {filterOptions.multicolors.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
              {setSelectedSupports && filterOptions.supports.length > 0 && (
                <select
                  value={selectedSupports}
                  onChange={(e) => setSelectedSupports(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
                >
                  <option value="Alle">Stützen: Alle</option>
                  {filterOptions.supports.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              <option value="newest">Sortierung: Neueste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
              <option value="title_asc">Name (A-Z)</option>
              <option value="title_desc">Name (Z-A)</option>
              <option value="print_time">Druckzeit (Längste)</option>
              <option value="weight_asc">Gewicht (Leichteste)</option>
              <option value="weight_desc">Gewicht (Schwerste)</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSelectedFilament('Alle');
                  setSelectedPrintTime('Alle');
                  setSelectedMulticolor('Alle');
                  setSelectedSupports('Alle');
                  setSortBy('newest');
                  setShowMobileFilters(false);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium text-center py-1"
              >
                Alle Filter zurücksetzen
              </button>
            )}
          </div>
        )}

      </div>

      {/* Glowing Bottom Progress Bar when Uploading */}
      {backgroundUpload?.active && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-950 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
            style={{ width: `${backgroundUpload.progress}%` }}
          />
        </div>
      )}
    </header>
  );
}
