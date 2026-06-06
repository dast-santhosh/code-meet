import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Minus, Maximize2, ExternalLink } from 'lucide-react';
import useAppStore from '../store';

export default function SearchPortal() {
  const { showSearch, setShowSearch } = useAppStore();
  const [query, setQuery] = useState('');
  const [searchUrl, setSearchUrl] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  if (!showSearch) return null;

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    // DuckDuckGo HTML simple layout that works inside frames if allowed, or fallback link
    setSearchUrl(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <motion.div
      initial={{ x: 100, y: 150 }}
      drag
      dragHandleClassName="search-drag-handle"
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ left: 0, right: window.innerWidth - 450, top: 50, bottom: window.innerHeight - 350 }}
      className={`fixed z-[999] w-[450px] glass-panel portal-window flex flex-col transition-all duration-150 ${
        isMinimized ? 'h-[48px]' : 'h-[500px]'
      }`}
    >
      {/* Drag Handle & Header */}
      <div className="search-drag-handle flex items-center justify-between px-4 py-3 bg-slate-950/40 border-b border-white/5 cursor-move select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          <Search className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold font-orbitron tracking-wider text-sky-400">DUCKDUCKGO SEARCH</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsMinimized(!isMinimized)} 
            className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white transition"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => setShowSearch(false)} 
            className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Content */}
      {!isMinimized && (
        <>
          {/* Search Input Bar */}
          <form onSubmit={handleSearch} className="p-3 border-b border-white/5 bg-slate-950/20 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search duckduckgo..."
              className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
            <button
              type="submit"
              className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition flex items-center justify-center glow-accent"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Search IFrame Display / Result Link */}
          <div className="flex-1 bg-slate-950/30 relative flex flex-col justify-center items-center">
            {searchUrl ? (
              <>
                <iframe
                  src={searchUrl}
                  title="DuckDuckGo Search Results"
                  className="w-full h-full border-none bg-white rounded-b-xl"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  onError={() => console.log('IFrame blocked')}
                />
                {/* Floating fallback button in case standard iFrames are blocked */}
                <div className="absolute bottom-2 right-2 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
                  <span className="text-[10px] text-slate-400">Blocked?</span>
                  <a
                    href={`https://duckduckgo.com/?q=${encodeURIComponent(query)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-sky-400 font-bold hover:underline flex items-center gap-1"
                  >
                    Open Tab <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </>
            ) : (
              <div className="text-center p-6 space-y-3">
                <Search className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">Search libraries, syntax structures, or examples.</p>
                {query.trim() && (
                  <a
                    href={`https://duckduckgo.com/?q=${encodeURIComponent(query)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-400 rounded-xl border border-sky-500/20 transition mt-2"
                  >
                    Direct DuckDuckGo Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
