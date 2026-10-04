import React, { useMemo, useState } from 'react';
import { Plus, Replace, Trash2, X } from 'lucide-react';

const emptyRule = () => ({ find: '', replace: '' });

export default function BatchRenameModal({ models = [], onClose, onCompleted }) {
  const [rules, setRules] = useState([{ find: '_', replace: ' ' }, { find: 'ae', replace: 'ä' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeRules = useMemo(
    () => rules.filter(rule => rule.find.length > 0),
    [rules]
  );

  const preview = useMemo(
    () => models.map(model => ({
      id: model.id,
      oldTitle: model.title,
      newTitle: activeRules.reduce(
        (result, rule) => result.split(rule.find).join(rule.replace),
        model.title
      ).replace(/\s{2,}/g, ' ').trim()
    })).filter(item => item.oldTitle !== item.newTitle),
    [models, activeRules]
  );

  const updateRule = (index, key, value) => {
    setRules(previous => previous.map((rule, ruleIndex) => (
      ruleIndex === index ? { ...rule, [key]: value } : rule
    )));
  };

  const removeRule = (index) => {
    setRules(previous => previous.length === 1 ? previous : previous.filter((_, ruleIndex) => ruleIndex !== index));
  };

  const handleSave = async () => {
    if (activeRules.length === 0) {
      setError('Gib mindestens einen Suchbegriff ein.');
      return;
    }
    if (preview.some(item => !item.newTitle)) {
      setError('Eine Regel würde einen Modellnamen leeren. Passe die Regeln an.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/models/batch-rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: models.map(model => model.id), rules: activeRules })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Umbenennen fehlgeschlagen');
      onCompleted(data.changedCount);
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'Der Server konnte die Namen nicht ändern.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="batch-rename-title">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-500/30 bg-slate-900 shadow-2xl shadow-cyan-950/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300"><Replace className="h-5 w-5" /></div>
            <div>
              <h2 id="batch-rename-title" className="font-bold text-white">Namen suchen & ersetzen</h2>
              <p className="text-xs text-slate-400">Für {models.length} ausgewählte Modelle; Dateinamen bleiben unverändert.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" title="Schließen"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Regeln werden von oben nach unten und überall im Namen angewendet.</p>
            {rules.map((rule, index) => (
              <div key={index} className="flex items-center gap-2">
                <input value={rule.find} onChange={(event) => updateRule(index, 'find', event.target.value)} placeholder="Suchen, z. B. _" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                <Replace className="h-4 w-4 shrink-0 text-slate-500" />
                <input value={rule.replace} onChange={(event) => updateRule(index, 'replace', event.target.value)} placeholder="Ersetzen durch, z. B. Leerzeichen" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
                <button onClick={() => removeRule(index)} disabled={rules.length === 1} className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30" title="Regel entfernen"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => setRules(previous => [...previous, emptyRule()])} className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200"><Plus className="h-4 w-4" /> Weitere Regel</button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-slate-200">Vorschau</span><span className="text-slate-500">{preview.length} Änderung{preview.length === 1 ? '' : 'en'}</span></div>
            {preview.length > 0 ? (
              <div className="max-h-44 space-y-1 overflow-y-auto text-xs">
                {preview.slice(0, 50).map(item => <div key={item.id} className="grid grid-cols-[1fr_auto_1fr] gap-2 rounded-lg px-2 py-1.5 text-slate-400"><span className="truncate" title={item.oldTitle}>{item.oldTitle}</span><span className="text-cyan-500">→</span><span className="truncate text-cyan-200" title={item.newTitle}>{item.newTitle}</span></div>)}
                {preview.length > 50 && <p className="px-2 pt-1 text-slate-500">… und {preview.length - 50} weitere</p>}
              </div>
            ) : <p className="text-xs text-slate-500">Die Regeln ändern keinen der ausgewählten Namen.</p>}
          </div>
          {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/40 px-5 py-4">
          <button onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || preview.length === 0} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"><Replace className="h-4 w-4" />{saving ? 'Speichert…' : `${preview.length} Namen ändern`}</button>
        </div>
      </div>
    </div>
  );
}
