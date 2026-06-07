import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Minus, MessageSquare, Maximize2 } from 'lucide-react';
import useAppStore from '../store';

export default function ChatPortal({ messages, onSendMessage, userId }) {
  const { showChat, setShowChat } = useAppStore();
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const chatEndRef = useRef(null);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  if (window.innerWidth < 768) {
    return (
      <AnimatePresence>
        {showChat && (
          <div className="fixed inset-0 z-[99999] flex overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setShowChat(false)} 
            />
            {/* Right Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative ml-auto w-[280px] max-w-[85vw] h-full bg-[#121212] border-l border-white/10 flex flex-col p-4 shadow-2xl z-10 text-left select-none"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold font-orbitron tracking-wider text-slate-200">MEET CHAT</span>
                </div>
                <button 
                  onClick={() => setShowChat(false)}
                  className="p-1.5 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-2 overflow-y-auto space-y-3 bg-slate-950/20 border border-white/5 rounded-2xl mb-3 select-text">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-slate-500 italic">
                    No messages yet.
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isSelf = msg.senderId === userId;
                    return (
                      <div key={index} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[9px] font-bold text-slate-400 truncate max-w-[80px]">
                            {msg.senderName}
                          </span>
                          <span className={`text-[7px] font-semibold uppercase px-1 rounded ${
                            msg.senderRole === 'commandant' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {msg.senderRole === 'commandant' ? 'Inst' : 'Cad'}
                          </span>
                        </div>
                        <div className={`max-w-[90%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed ${
                          isSelf 
                            ? 'bg-neutral-800 text-slate-100 border border-neutral-700/60 rounded-tr-none' 
                            : 'bg-slate-800/60 text-slate-100 border border-white/5 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Send message..."
                  className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-white/20 transition"
                />
                <button
                  type="submit"
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  if (!showChat) return null;

  return (
    <motion.div
      initial={{ x: window.innerWidth - 420, y: 100 }}
      drag
      dragHandleClassName="chat-drag-handle"
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ left: 0, right: window.innerWidth - 380, top: 50, bottom: window.innerHeight - 300 }}
      className={`fixed z-[999] w-[360px] glass-panel portal-window flex flex-col transition-all duration-150 ${
        isMinimized ? 'h-[48px]' : 'h-[450px]'
      }`}
    >
      {/* Drag Handle & Header */}
      <div className="chat-drag-handle flex items-center justify-between px-4 py-3 bg-slate-950/40 border-b border-white/5 cursor-move select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold font-orbitron tracking-wider text-slate-200">CLASS CHAT</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsMinimized(!isMinimized)} 
            className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white transition"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => setShowChat(false)} 
            className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      {!isMinimized && (
        <>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-900/10">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                No messages yet. Say hello to the class!
              </div>
            ) : (
              messages.map((msg, index) => {
                const isSelf = msg.senderId === userId;
                return (
                  <div key={index} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-400">
                        {msg.senderName}
                      </span>
                      <span className={`text-[8px] font-semibold uppercase px-1 rounded ${
                        msg.senderRole === 'commandant' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {msg.senderRole === 'commandant' ? 'Instructor' : 'Cadet'}
                      </span>
                    </div>
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      isSelf 
                        ? 'bg-neutral-800 text-slate-100 border border-neutral-700/60 rounded-tr-none' 
                        : 'bg-slate-800/60 text-slate-100 border border-white/5 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-slate-950/20 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message here..."
              className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white transition"
            />
            <button
              type="submit"
              className="p-2 bg-neutral-850 hover:bg-neutral-800 text-white rounded-xl font-bold transition flex items-center justify-center cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </motion.div>
  );
}
