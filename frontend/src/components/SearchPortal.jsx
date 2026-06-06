import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Minus, Maximize2, ExternalLink } from 'lucide-react';
import useAppStore from '../store';

export default function SearchPortal() {
  const { showSearch, setShowSearch } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!showSearch) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
          query.trim()
        )}&limit=10&namespace=0&format=json&origin=*`
      );
      if (!res.ok) throw new Error("Search service error");
      const data = await res.json();
      
      const formatted = [];
      if (data && data[1]) {
        for (let i = 0; i < data[1].length; i++) {
          formatted.push({
            title: data[1][i],
            description: data[2][i] || 'View full article details.',
            link: data[3][i]
          });
        }
      }
      setResults(formatted);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
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
          <Search className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold font-orbitron tracking-wider text-slate-200">CONCEPT & WEB SEARCH</span>
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
              placeholder="Search library concepts, math logic..."
              className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white transition"
            />
            <button
              type="submit"
              disabled={loading}
              className="p-2 bg-neutral-850 hover:bg-neutral-800 text-white rounded-xl font-bold transition flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Results List */}
          <div className="flex-1 bg-slate-950/30 overflow-y-auto p-3 flex flex-col gap-2">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                <span className="text-[10px] text-slate-400 font-medium">Searching documentation...</span>
              </div>
            ) : searched ? (
              results.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Concept Results</span>
                    <a
                      href={`https://duckduckgo.com/?q=${encodeURIComponent(query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-white hover:underline flex items-center gap-1 font-bold"
                    >
                      Search DuckDuckGo <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  {results.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-neutral-900/40 border border-white/5 hover:border-neutral-700 transition duration-150 flex flex-col text-left group"
                    >
                      <span className="text-xs font-bold text-white group-hover:text-white transition flex items-center justify-between">
                        {item.title}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-slate-400" />
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </a>
                  ))}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <Search className="w-8 h-8 text-slate-600" />
                  <p className="text-xs text-slate-400">No matching concepts found in library.</p>
                  <a
                    href={`https://duckduckgo.com/?q=${encodeURIComponent(query)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white rounded-xl border border-white/10 transition mt-2"
                  >
                    Search DuckDuckGo (New Tab) <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 select-none">
                <Search className="w-8 h-8 text-slate-700" />
                <p className="text-xs text-slate-500 font-medium">Search Python libraries, math structures, or terms.</p>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
