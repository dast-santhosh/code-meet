import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, X, Minus, Sparkles, Maximize2, Bot } from 'lucide-react';
import useAppStore from '../store';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const GROQ_MODEL = "llama3-8b-8192";

export default function AIPortal() {
  const { showAI, setShowAI } = useAppStore();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your DevShaala AI Tutor. Ask me about Python concepts, algorithm architectures, or how libraries like NumPy and Pandas work. Note: I explain concepts conceptually but will not generate code."
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  if (!showAI) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMessage = { role: 'user', content: inputText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Build messages array with system prompt
      const apiMessages = [
        {
          role: "system",
          content: "You are the DevShaala AI Tutor. Your role is strictly to explain coding concepts, library functionalities, programming architectures, and standard logic utilizing text-based diagrams, lists, and markdown descriptions. CRITICAL RESTRICTION: You are absolutely FORBIDDEN from providing code blocks, code completions, syntax corrections, variable completions, or executable snippets in any language (such as Python, JS, C++, etc.). Under no circumstances should you generate code. If asked for code, politely say: 'I am sorry, but I am configured to only explain concepts conceptually without providing direct code. Here is how it works...'"
        },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        userMessage
      ];

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid or unauthorized Groq API Key (401). Please verify your VITE_GROQ_API_KEY environment variable in settings.");
        }
        throw new Error(`Failed to contact tutor service (Status: ${response.status})`);
      }

      const data = await response.json();
      const botReply = data.choices[0].message.content;
      setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);
    } catch (err) {
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: `[Error] Failed to contact AI Tutor: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ x: window.innerWidth - 440, y: 150 }}
      drag
      dragHandleClassName="ai-drag-handle"
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ left: 0, right: window.innerWidth - 400, top: 50, bottom: window.innerHeight - 300 }}
      className={`fixed z-[999] w-[380px] glass-panel portal-window flex flex-col transition-all duration-150 ${
        isMinimized ? 'h-[48px]' : 'h-[500px]'
      }`}
    >
      {/* Drag Handle & Header */}
      <div className="ai-drag-handle flex items-center justify-between px-4 py-3 bg-slate-950/40 border-b border-white/5 cursor-move select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          <Bot className="w-4 h-4 text-slate-400 animate-pulse" />
          <span className="text-xs font-bold font-orbitron tracking-wider text-slate-200">DEVSHAALA AI TUTOR</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsMinimized(!isMinimized)} 
            className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white transition"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => setShowAI(false)} 
            className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Chat Area */}
      {!isMinimized && (
        <>
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/10 text-xs">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'user' && (
                  <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-slate-300" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl whitespace-pre-line leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-neutral-800 text-slate-100 border border-neutral-700/60 rounded-tr-none'
                    : 'bg-slate-800/70 text-slate-200 border border-white/5 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 animate-spin">
                  <Sparkles className="w-3 h-3 text-slate-300" />
                </div>
                <div className="bg-slate-800/70 text-slate-400 px-3 py-2 rounded-2xl border border-white/5 rounded-tl-none italic">
                  Tutor is thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-slate-950/20 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              placeholder="Ask a concept (e.g. What is pandas series?)..."
              className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition flex items-center justify-center disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </motion.div>
  );
}
