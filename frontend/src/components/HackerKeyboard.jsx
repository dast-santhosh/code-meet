import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Delete, CornerDownLeft, Space, GripHorizontal, ChevronDown, Keyboard } from 'lucide-react';

export default function HackerKeyboard({ onInsert, onClose }) {
  const [activeTab, setActiveTab] = useState('keys'); // 'keys', 'symbols', 'python'

  const handleKeyClick = (char) => {
    if (onInsert) {
      onInsert(char);
    }
  };

  // Keyboard templates
  const rows = {
    keys: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm']
    ],
    symbols: [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
      ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
      ['_', '\\', '|', '~', '<', '>', '?', '!']
    ],
    python: [
      ['def ', 'class ', 'import ', 'from '],
      ['print(', 'len(', 'range(', 'enumerate('],
      ['for ', 'in ', 'if ', 'elif ', 'else:'],
      ['while ', 'return ', 'and ', 'or ', 'not ']
    ]
  };

  return (
    <motion.div
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      drag
      dragHandleClassName="kb-drag-handle"
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={{ top: 0, bottom: window.innerHeight - 150, left: -200, right: 200 }}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-[420px] bg-neutral-950/90 border border-white/10 rounded-t-3xl shadow-2xl backdrop-blur-xl flex flex-col select-none"
    >
      {/* Drag Handle Bar */}
      <div className="kb-drag-handle flex items-center justify-between px-4 py-2 border-b border-white/5 cursor-move">
        <div className="flex items-center gap-2 text-slate-400">
          <GripHorizontal className="w-4 h-4" />
          <span className="text-[10px] font-bold font-orbitron tracking-wider text-slate-300">DEVSHAALA CLI KEYBOARD</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900/40 border-b border-white/5 p-1">
        {[
          { id: 'keys', label: 'abc' },
          { id: 'symbols', label: '123 / #' },
          { id: 'python', label: 'def / print' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition ${
              activeTab === tab.id ? 'bg-white/10 text-white font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Keys Content */}
      <div className="p-2 space-y-1.5 bg-neutral-950/40">
        {rows[activeTab].map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1">
            {row.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyClick(key)}
                className={`h-9 flex-1 max-w-[42px] rounded-lg text-slate-200 font-bold bg-neutral-900 border border-white/5 active:bg-white/10 active:border-white/20 transition flex items-center justify-center cursor-pointer shadow-md ${
                  activeTab === 'python' ? 'max-w-none text-[10px] px-1 bg-neutral-900/80 font-mono text-emerald-400' : 'text-xs font-sans'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        ))}

        {/* Function Keys Row (Space, Enter, Backspace) */}
        <div className="flex gap-1 pt-1 justify-center">
          {activeTab === 'keys' && (
            <button
              onClick={() => handleKeyClick('.')}
              className="h-9 w-9 rounded-lg text-slate-200 text-xs font-bold bg-neutral-900 border border-white/5 flex items-center justify-center cursor-pointer"
            >
              .
            </button>
          )}
          <button
            onClick={() => handleKeyClick('BACKSPACE')}
            className="h-9 w-12 rounded-lg text-rose-400 bg-neutral-900 border border-white/5 flex items-center justify-center cursor-pointer active:bg-rose-950/30"
            title="Backspace"
          >
            <Delete className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleKeyClick(' ')}
            className="h-9 flex-1 rounded-lg text-slate-400 bg-neutral-900 border border-white/5 flex items-center justify-center cursor-pointer active:bg-white/5"
            title="Space"
          >
            <Space className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleKeyClick('ENTER')}
            className="h-9 w-12 rounded-lg text-emerald-400 bg-neutral-900 border border-white/5 flex items-center justify-center cursor-pointer active:bg-emerald-950/30"
            title="Enter"
          >
            <CornerDownLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
