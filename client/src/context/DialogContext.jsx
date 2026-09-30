import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Trash2, X } from 'lucide-react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState(null);
  const resolveRef = useRef(null);
  const confirmButtonRef = useRef(null);

  const closeDialog = useCallback((result) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setDialogState(null);
  }, []);

  const confirm = useCallback(({
    title = 'Bestätigung erforderlich',
    message,
    confirmText = 'Bestätigen',
    cancelText = 'Abbrechen',
    type = 'danger', // 'danger' | 'warning' | 'info'
    icon = null
  }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({
        mode: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        type,
        icon
      });
    });
  }, []);

  const alert = useCallback(({
    title = 'Hinweis',
    message,
    confirmText = 'Verstanden',
    type = 'info', // 'info' | 'warning' | 'error' | 'success'
    icon = null
  }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({
        mode: 'alert',
        title,
        message,
        confirmText,
        type,
        icon
      });
    });
  }, []);

  // Keyboard navigation & Auto-focus
  useEffect(() => {
    if (!dialogState) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog(false);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        closeDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => confirmButtonRef.current?.focus(), 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [dialogState, closeDialog]);

  // Resolve icon and styling themes
  const getTheme = () => {
    if (!dialogState) return {};
    const { type, mode } = dialogState;

    if (type === 'danger' || type === 'error') {
      return {
        glow: 'from-rose-500/20 to-transparent',
        border: 'border-rose-500/30',
        iconBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        btnBg: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950/50 shadow-lg',
        defaultIcon: mode === 'confirm' ? Trash2 : AlertTriangle
      };
    }
    if (type === 'warning') {
      return {
        glow: 'from-amber-500/20 to-transparent',
        border: 'border-amber-500/30',
        iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        btnBg: 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-amber-950/50 shadow-lg',
        defaultIcon: AlertCircle
      };
    }
    if (type === 'success') {
      return {
        glow: 'from-emerald-500/20 to-transparent',
        border: 'border-emerald-500/30',
        iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        btnBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50 shadow-lg',
        defaultIcon: CheckCircle2
      };
    }
    // Default info
    return {
      glow: 'from-cyan-500/20 to-transparent',
      border: 'border-cyan-500/30',
      iconBg: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      btnBg: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/50 shadow-lg',
      defaultIcon: Info
    };
  };

  const theme = getTheme();
  const IconComponent = dialogState?.icon || theme.defaultIcon;

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      {dialogState && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => closeDialog(false)}
        >
          <div 
            className={`relative w-full max-w-md bg-slate-900/95 border ${theme.border} rounded-2xl p-6 shadow-2xl ring-1 ring-white/10 overflow-hidden transform animate-in zoom-in-95 duration-200`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Ambient Background Glow */}
            <div className={`absolute -top-20 -left-20 w-44 h-44 bg-gradient-to-br ${theme.glow} rounded-full blur-3xl pointer-events-none`} />

            {/* Close Button */}
            <button
              onClick={() => closeDialog(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header with Icon and Title */}
            <div className="flex items-start gap-4">
              {IconComponent && (
                <div className={`p-3 rounded-xl shrink-0 ${theme.iconBg}`}>
                  <IconComponent className="w-6 h-6" />
                </div>
              )}
              <div className="pr-6">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {dialogState.title}
                </h3>
                <div className="text-sm text-slate-300 leading-relaxed mt-2 whitespace-pre-wrap">
                  {dialogState.message}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800/80">
              {dialogState.mode === 'confirm' && (
                <button
                  type="button"
                  onClick={() => closeDialog(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700/80 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium transition-colors"
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => closeDialog(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${theme.btnBg}`}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
