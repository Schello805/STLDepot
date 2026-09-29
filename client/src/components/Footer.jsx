import React from 'react';
import { Box, Heart, Code2, Sparkles, ShieldCheck, HardDrive } from 'lucide-react';

function GitHubIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function Footer({ systemInfo }) {
  const authorName = systemInfo?.author || 'Michael Schellenberger';
  const githubUrl = systemInfo?.github_repo || 'https://github.com/Schello805/STLDepot';
  const version = systemInfo?.version || '1.0.0';
  const revision = systemInfo?.revision || 'rev-2026.09';
  const storageFormatted = systemInfo?.stats?.storage_formatted || '0 MB';
  const totalProjects = systemInfo?.stats?.total_projects || 0;

  return (
    <footer className="mt-20 border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-md text-slate-400 py-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Project & Creator Info */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 shadow-inner">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-sm font-semibold text-slate-200">
                  STL-Storage Hub
                </span>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> CC BY-NC 4.0
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Open Source Projekt von <span className="text-slate-200 font-medium">{authorName}</span>
              </p>
            </div>
          </div>

          {/* Dynamic Revision / Version Badge */}
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Version: <strong className="text-white">v{version}</strong></span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400 font-semibold" title="Dynamische Revisionsnummer">Rev. {revision}</span>
          </div>

          {/* GitHub Link with Icon & Stats */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden lg:block text-xs text-slate-500">
              <div>{totalProjects} Modelle im Tresor</div>
              <div className="text-[11px] font-mono">{storageFormatted} belegt</div>
            </div>

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 hover:border-cyan-500/50 shadow-md hover:shadow-cyan-500/10 transition group"
            >
              <GitHubIcon className="w-4 h-4 text-slate-300 group-hover:text-cyan-400 transition-colors" />
              <span>GitHub Repository</span>
            </a>
          </div>

        </div>

        {/* Sub-footer Copyright & Disclaimer */}
        <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <p>
            Freie Nutzung für private Maker & 3D-Druck Enthusiasten. Nicht kommerziell lizenziert (CC BY-NC 4.0).
          </p>
          <p className="flex items-center gap-1">
            Entwickelt mit Three.js, React & Express
          </p>
        </div>
      </div>
    </footer>
  );
}
