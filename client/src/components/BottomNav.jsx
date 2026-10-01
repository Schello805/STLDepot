import React from 'react';
import { Home, PlusCircle, ScanLine, Settings } from 'lucide-react';

export default function BottomNav({ 
  onHome, 
  onUpload, 
  onScan, 
  onSettings 
}) {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 pb-safe shadow-[0_-4px_15px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-around h-16">
        <button onClick={onHome} className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-cyan-400 active:text-cyan-500 transition-colors">
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={onUpload} className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-emerald-400 active:text-emerald-500 transition-colors">
          <PlusCircle className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Upload</span>
        </button>
        <button onClick={onScan} className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-amber-400 active:text-amber-500 transition-colors">
          <ScanLine className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Scanner</span>
        </button>
        <button onClick={onSettings} className="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-purple-400 active:text-purple-500 transition-colors">
          <Settings className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Setup</span>
        </button>
      </div>
    </div>
  );
}
