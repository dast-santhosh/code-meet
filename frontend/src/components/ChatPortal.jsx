import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, X, Minus, MessageSquare, Maximize2 } from 'lucide-react';
import useAppStore from '../store';

export default function ChatPortal({ messages, onSendMessage, userId }) {
  const { showChat, setShowChat } = useAppStore();
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  if (!showChat) return null;

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

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
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold font-orbitron tracking-wider text-emerald-400">CLASS CHAT</span>
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
                        ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30 rounded-tr-none' 
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
              className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            <button
              type="submit"
              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl font-bold transition flex items-center justify-center glow-accent"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </motion.div>
  );
}
