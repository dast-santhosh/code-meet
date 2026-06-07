import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Mic, MicOff, Video, VideoOff, Hand, MessageSquare, FolderOpen, 
  Search, Bot, Play, Layers, Maximize, FileCode, Plus, Trash2, Eye, Award,
  Send, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ParticipantVideo } from '../components/VideoGrid';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function MobileMeetRoom({
  squadronId,
  peerCodes = {},
  userProfile,
  role,
  wsConnected,
  pyodideLoaded,
  isRunning,
  consoleOutput,
  setConsoleOutput,
  matplotlibPlot,
  setMatplotlibPlot,
  files,
  setFiles,
  activeFile,
  setActiveFile,
  presenterId,
  localScreenStream,
  remoteScreenStream,
  localStream,
  remoteStreams,
  runPythonCode,
  handleUpdateFileContent,
  micMuted,
  videoMuted,
  handRaised,
  onToggleMic,
  onToggleVideo,
  onToggleHand,
  onExitMeet,
  chatMessages,
  onSendMessage,
  showChat,
  setShowChat,
  showAI,
  setShowAI,
  showSearch,
  setShowSearch,
  participants,
  raisedHands,
  onMinimizeRoom,
  handleCreateFile,
  handleDeleteFile,
  newFileName,
  setNewFileName,
  showNewFileForm,
  setShowNewFileForm,
  fileType,
  setFileType
}) {
  const [editorInstance, setEditorInstance] = useState(null);
  const [showControlHub, setShowControlHub] = useState(false);
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [editorFontSize, setEditorFontSize] = useState(13);
  
  // Commandant Slider State: 'cam' (webcam/autocode), 'code' (full code), 'self' (own webcam)
  const [activeSlide, setActiveSlide] = useState('cam');

  // Popup tab state: 'menu', 'chat', 'ai'
  const [hubTab, setHubTab] = useState('menu');

  // Group chat and AI Tutor states
  const [chatInput, setChatInput] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your DevShaala AI Tutor. Ask me about Python concepts, algorithm architectures, or how libraries like NumPy and Pandas work. Note: I explain concepts conceptually but will not generate code."
    }
  ]);

  const groupChatEndRef = useRef(null);
  const aiChatEndRef = useRef(null);

  // Sync store showChat/showAI states with mobile control hub
  useEffect(() => {
    if (showChat) {
      setShowControlHub(true);
      setHubTab('chat');
    }
  }, [showChat]);

  useEffect(() => {
    if (showAI) {
      setShowControlHub(true);
      setHubTab('ai');
    }
  }, [showAI]);

  useEffect(() => {
    if (!showControlHub) {
      setShowChat(false);
      setShowAI(false);
      setHubTab('menu');
    }
  }, [showControlHub, setShowChat, setShowAI]);

  // Auto scroll effects for chat logs
  useEffect(() => {
    if (hubTab === 'chat' && groupChatEndRef.current) {
      groupChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, hubTab]);

  useEffect(() => {
    if (hubTab === 'ai' && aiChatEndRef.current) {
      aiChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, hubTab]);

  // Send message submit handlers
  const handleSendGroupMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleSendAiMessage = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;

    const userMessage = { role: 'user', content: aiInput.trim() };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setAiLoading(true);

    try {
      const GROQ_API_KEY = import.meta.env.VITE_GROQ_API || "";
      const apiMessages = [
        {
          role: "system",
          content: "You are the DevShaala AI Tutor. Your role is strictly to explain coding concepts, library functionalities, programming architectures, and standard logic utilizing text-based diagrams, lists, and markdown descriptions. CRITICAL RESTRICTION: You are absolutely FORBIDDEN from providing code blocks, code completions, syntax corrections, variable completions, or executable snippets in any language. Under no circumstances should you generate code."
        },
        ...aiMessages.map(m => ({ role: m.role, content: m.content })),
        userMessage
      ];

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        throw new Error(`Tutor service error (Status: ${response.status})`);
      }

      const data = await response.json();
      const botReply = data.choices[0].message.content;
      setAiMessages(prev => [...prev, { role: 'assistant', content: botReply }]);
    } catch (err) {
      setAiMessages(prev => [
        ...prev, 
        { role: 'assistant', content: `[Error] Failed to contact AI Tutor: ${err.message}` }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Monitor orientation changes
  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Full Screen Management
  const requestFullScreen = async () => {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      setShowExitAlert(false);
    } catch (err) {
      console.log("Fullscreen request rejected:", err);
    }
  };

  useEffect(() => {
    // Attempt fullscreen on join
    requestFullScreen();

    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
      if (!isFullscreen) {
        setShowExitAlert(true);
      } else {
        setShowExitAlert(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Leave meeting warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Exiting the class is restricted. Are you sure?";
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Set editor reference normally to let mobile native virtual keyboard trigger
  const handleEditorDidMount = (editor, monaco) => {
    setEditorInstance(editor);
    // Note: Visual keyboard has been removed, allowing native mobile OS keyboard to open normally on touch.
  };

  // Commandants/Mentor identification
  const commandant = participants.find(p => p.role === 'commandant');
  const commandantCode = commandant ? (peerCodes[commandant.userId] || "") : "";

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-slate-100 flex flex-col overflow-hidden relative select-none">
      
      {/* Exited Full Screen Alert Overlay */}
      {showExitAlert && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
            <Maximize className="w-8 h-8" />
          </div>
          <h2 className="text-base font-black font-orbitron text-white uppercase tracking-wider">Fullscreen Mode Exited</h2>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Exiting full-screen class mode breaks discipline and classroom focus. Please return to enter learning space.
          </p>
          <button
            onClick={requestFullScreen}
            className="px-6 py-2.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition active:scale-95 shadow-[0_4px_20px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            Re-enter Class
          </button>
        </div>
      )}

      {/* RENDER MODE A: active screen presentation - Absolute Full Screen */}
      {presenterId !== null ? (
        <div className="fixed inset-0 z-[99999] w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
          {/* Visual rotation simulation for presentation in portrait mode */}
          <div 
            className={`flex items-center justify-center shrink-0 ${
              isPortrait ? 'transform rotate-90 origin-center' : 'w-full h-full'
            }`}
            style={{
              width: isPortrait ? '100vh' : '100vw',
              height: isPortrait ? '100vw' : '100vh',
            }}
          >
            <div className="w-full h-full flex items-center justify-center bg-black relative">
              <video
                ref={(el) => {
                  if (el) {
                    const stream = presenterId === userProfile?.uid ? localScreenStream : remoteScreenStream;
                    if (stream && el.srcObject !== stream) {
                      el.srcObject = stream;
                    }
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />

              {/* Commandant Stream Overlay inside Presentation */}
              {commandant && (
                <div className="absolute bottom-4 right-4 w-[120px] h-[90px] border border-white/10 rounded-xl overflow-hidden bg-neutral-950 z-50 shadow-2xl">
                  {(() => {
                    const isSelfCmd = commandant.userId === userProfile?.uid;
                    const stream = isSelfCmd ? localStream : remoteStreams[commandant.userId];
                    const cameraOn = isSelfCmd ? !videoMuted : !commandant.videoMuted;

                    if (stream && cameraOn) {
                      return (
                        <ParticipantVideo
                          stream={stream}
                          name=""
                          isMuted={isSelfCmd ? micMuted : commandant.micMuted}
                          isCameraOn={true}
                          isHandRaised={false}
                          isLocal={isSelfCmd}
                          className="w-full h-full object-cover"
                        />
                      );
                    }
                    // If Commandant turns off camera inside presentation overlay, display his code!
                    return (
                      <div className="w-full h-full bg-black p-2 overflow-auto text-[7px] font-mono text-emerald-400 leading-snug whitespace-pre-wrap text-left select-text">
                        {commandantCode || "# No code"}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Floating presentation exit warning */}
          <div className="absolute top-4 left-4 z-[99] bg-black/60 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span>Presenting (Full View)</span>
          </div>
        </div>
      ) : (
        /* RENDER MODE B: Split view (Video top / Editor bottom) */
        <>
          {/* Upper Slide-Capable Video/Code Card */}
          <div className="h-[210px] w-full bg-[#121212] border-b border-white/5 flex flex-col flex-shrink-0 select-none">
            {/* Slide Selection Navigation Tabs */}
            <div className="flex bg-slate-950 border-b border-white/5 p-1 justify-around text-[9px] font-bold uppercase tracking-wider">
              <button 
                onClick={() => setActiveSlide('cam')} 
                className={`py-1 px-3 rounded-lg transition ${activeSlide === 'cam' ? 'bg-white/10 text-emerald-400 font-black' : 'text-slate-500'}`}
              >
                Commandant Cam
              </button>
              <button 
                onClick={() => setActiveSlide('code')} 
                className={`py-1 px-3 rounded-lg transition ${activeSlide === 'code' ? 'bg-white/10 text-emerald-400 font-black' : 'text-slate-500'}`}
              >
                Commandant's IDE Shell
              </button>
              <button 
                onClick={() => setActiveSlide('self')} 
                className={`py-1 px-3 rounded-lg transition ${activeSlide === 'self' ? 'bg-white/10 text-emerald-400 font-black' : 'text-slate-500'}`}
              >
                Own Cam Feed
              </button>
            </div>

            {/* Video Body Content */}
            <div className="flex-1 w-full bg-neutral-950/80 relative flex items-center justify-center p-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.15 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  {activeSlide === 'cam' && (
                    commandant ? (
                      (() => {
                        const isSelfCmd = commandant.userId === userProfile?.uid;
                        const stream = isSelfCmd ? localStream : remoteStreams[commandant.userId];
                        const cameraOn = isSelfCmd ? !videoMuted : !commandant.videoMuted;

                        if (stream && cameraOn) {
                          return (
                            <ParticipantVideo
                              stream={stream}
                              name={commandant.name}
                              isMuted={isSelfCmd ? micMuted : commandant.micMuted}
                              isCameraOn={true}
                              isHandRaised={false}
                              isLocal={isSelfCmd}
                              className="w-full h-full object-cover border-0 rounded-xl"
                            />
                          );
                        }
                        return (
                          // Commandant Camera Off: Automatically fall back to his code!
                          <div className="w-full h-full bg-black/60 p-3 overflow-auto text-[10px] font-mono text-emerald-400 select-text leading-relaxed whitespace-pre-wrap text-left border border-white/5 rounded-xl">
                            {commandantCode || "# Instructor workspace is empty"}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center p-4">
                        <div className="text-[10px] font-black font-orbitron tracking-wider text-rose-500 uppercase animate-pulse">
                          Commandant Offline
                        </div>
                        <div className="text-[8px] text-slate-500 mt-1 uppercase tracking-wide">
                          Waiting for instructor...
                        </div>
                      </div>
                    )
                  )}

                  {activeSlide === 'code' && (
                    <div className="w-full h-full bg-black/60 p-3 overflow-auto text-[10px] font-mono text-emerald-400 select-text leading-relaxed whitespace-pre-wrap text-left border border-white/5 rounded-xl">
                      {commandantCode || "# Instructor workspace is empty"}
                    </div>
                  )}

                  {activeSlide === 'self' && (
                    localStream ? (
                      <ParticipantVideo
                        stream={localStream}
                        name="You"
                        isMuted={micMuted}
                        isCameraOn={!videoMuted}
                        isHandRaised={handRaised}
                        isLocal={true}
                        className="w-full h-full object-cover border-0 rounded-xl"
                      />
                    ) : (
                      <div className="text-[9px] text-slate-500 uppercase font-black">Local Camera Offline</div>
                    )
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Active Badge */}
              <div className="absolute bottom-3 left-3 bg-black/50 border border-white/5 px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider text-slate-400 font-orbitron backdrop-blur-sm select-none z-10">
                {activeSlide === 'cam' ? 'Commandant Cam' : activeSlide === 'code' ? "Commandant's IDE Shell" : 'Own Cam Feed'}
              </div>
            </div>
          </div>

          {/* Active File Select Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-950 border-b border-white/5 text-[9px] text-slate-400 uppercase font-black tracking-wider flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeFile}</span>
            </div>
            <div className="font-orbitron text-[8px] text-emerald-500/85">
              WASM CLI ENGINE
            </div>
          </div>

          {/* Monaco Editor CLI block */}
          <div className="flex-1 w-full relative min-h-0">
            <MonacoEditor
              language="python"
              theme={editorTheme}
              value={files[activeFile] || ""}
              options={{
                fontSize: editorFontSize,
                fontFamily: 'Fira Code',
                minimap: { enabled: false },
                automaticLayout: true,
                lineNumbers: "on",
                lineHeight: 18,
                padding: { top: 8, bottom: 8 },
                wordWrap: "on"
              }}
              onMount={handleEditorDidMount}
              onChange={handleUpdateFileContent}
            />

            {/* Output log console overlay (Scrollable) */}
            {consoleOutput && (
              <div className="absolute bottom-0 left-0 right-0 max-h-[120px] bg-black/95 border-t border-white/10 flex flex-col z-40 select-text">
                <div className="flex items-center justify-between px-3 py-1 bg-neutral-900 border-b border-white/5 text-[8px] font-bold text-emerald-400 uppercase select-none">
                  <span>Output Console</span>
                  <button onClick={() => setConsoleOutput('')} className="text-slate-500 hover:text-white uppercase font-bold text-[7px] cursor-pointer">
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 text-[9px] font-mono text-slate-300 whitespace-pre-wrap select-text">
                  {consoleOutput}
                  {matplotlibPlot && (
                    <div className="mt-2 bg-white max-w-[140px] p-1 rounded-lg">
                      <img src={matplotlibPlot} alt="Plot Output" className="max-w-full h-auto" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Action Hub (FAB Menu Trigger) */}
      <div className="fixed bottom-4 right-4 z-[999]">
        <button
          onClick={() => {
            setShowControlHub(!showControlHub);
          }}
          className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-2xl transition cursor-pointer select-none ${
            showControlHub
              ? 'bg-red-500 border-red-400 text-slate-950 scale-110'
              : 'bg-neutral-900/80 border-white/10 text-white backdrop-blur-md hover:bg-neutral-800'
          }`}
        >
          {showControlHub ? <X className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
        </button>

        {/* Circular Radial Expanded Hub Controls */}
        <AnimatePresence>
          {showControlHub && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ 
                scale: 1, 
                opacity: 1, 
                y: 0,
                width: hubTab === 'menu' ? 180 : 320,
                height: hubTab === 'menu' ? 360 : 460
              }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute bottom-16 right-0 bg-neutral-950/95 border border-white/10 rounded-3xl p-4 shadow-[0_15px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl flex flex-col overflow-hidden max-w-[90vw]"
            >
              {/* Header with Close and Back/Tabs */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  {hubTab !== 'menu' && (
                    <button 
                      onClick={() => setHubTab('menu')}
                      className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg active:scale-95 transition"
                    >
                      &larr; Menu
                    </button>
                  )}
                  <span className="text-[9px] font-black font-orbitron tracking-widest text-slate-300 uppercase">
                    {hubTab === 'menu' ? 'MEET HUB' : hubTab === 'chat' ? 'CLASS CHAT' : 'AI TUTOR'}
                  </span>
                </div>
                <button 
                  onClick={() => setShowControlHub(false)}
                  className="p-1 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* View Rendering */}
              {hubTab === 'menu' && (
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                  <button
                    onClick={() => onToggleMic()}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-left cursor-pointer"
                  >
                    {micMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    <span>{micMuted ? 'Unmute' : 'Mute'}</span>
                  </button>
                  <button
                    onClick={() => onToggleVideo()}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-left cursor-pointer"
                  >
                    {videoMuted ? <VideoOff className="w-4 h-4 text-red-400" /> : <Video className="w-4 h-4 text-emerald-400" />}
                    <span>{videoMuted ? 'Camera On' : 'Camera Off'}</span>
                  </button>
                  <button
                    onClick={() => onToggleHand()}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-left cursor-pointer"
                  >
                    <Hand className={`w-4 h-4 ${handRaised ? 'text-yellow-400' : 'text-slate-400'}`} />
                    <span>{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                  </button>
                  <button
                    onClick={() => setHubTab('chat')}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-left cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span>Group Chat</span>
                  </button>
                  <button
                    onClick={() => setHubTab('ai')}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-left cursor-pointer"
                  >
                    <Bot className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span>AI Tutor</span>
                  </button>
                  <button
                    onClick={() => { setShowFilesDrawer(true); setShowControlHub(false); }}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-left cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4 text-slate-400" />
                    <span>Files list</span>
                  </button>
                  <button
                    onClick={() => { runPythonCode(); setShowControlHub(false); }}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-emerald-400 text-left cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-emerald-400" />
                    <span>Run Code</span>
                  </button>
                  <button
                    onClick={() => { onMinimizeRoom(); setShowControlHub(false); }}
                    className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition text-sky-400 text-left cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span>Minimize PIP</span>
                  </button>
                  <button
                    onClick={onExitMeet}
                    className="flex items-center gap-2.5 text-[10px] font-black uppercase text-red-500 hover:text-red-400 border-t border-white/5 pt-2.5 text-left cursor-pointer"
                  >
                    <X className="w-4 h-4 text-red-500" />
                    <span>Leave Meet</span>
                  </button>
                </div>
              )}

              {hubTab === 'chat' && (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-2 bg-slate-950/40 border border-white/5 rounded-2xl mb-2.5 select-text text-xs">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[9px] text-slate-500 italic">
                        No messages yet.
                      </div>
                    ) : (
                      chatMessages.map((msg, index) => {
                        const isSelf = msg.senderId === userProfile?.uid;
                        return (
                          <div key={index} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-1 mb-0.5 px-1">
                              <span className="text-[8px] font-bold text-slate-400 truncate max-w-[80px]">
                                {msg.senderName}
                              </span>
                              <span className={`text-[6px] font-semibold uppercase px-0.5 rounded ${
                                msg.senderRole === 'commandant' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {msg.senderRole === 'commandant' ? 'Inst' : 'Cad'}
                              </span>
                            </div>
                            <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[10px] leading-relaxed ${
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
                    <div ref={groupChatEndRef} />
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendGroupMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Send message..."
                      className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-2.5 py-2 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-white/20 transition"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-neutral-850 hover:bg-neutral-800 text-white rounded-xl transition flex items-center justify-center cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {hubTab === 'ai' && (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* AI Messages Area */}
                  <div className="flex-1 overflow-y-auto space-y-4 p-2 bg-slate-950/40 border border-white/5 rounded-2xl mb-2.5 text-xs select-text">
                    {aiMessages.map((msg, index) => (
                      <div key={index} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role !== 'user' && (
                          <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-2.5 h-2.5 text-slate-300" />
                          </div>
                        )}
                        <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl leading-relaxed text-[10px] ${
                          msg.role === 'user'
                            ? 'bg-neutral-800 text-slate-100 border border-neutral-700/60 rounded-tr-none whitespace-pre-line'
                            : 'bg-slate-800/70 text-slate-200 border border-white/5 rounded-tl-none'
                        }`}>
                          {msg.role === 'user' ? (
                            msg.content
                          ) : (
                            <MarkdownRenderer content={msg.content} />
                          )}
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 animate-spin">
                          <Sparkles className="w-2.5 h-2.5 text-slate-300" />
                        </div>
                        <div className="bg-slate-800/70 text-slate-400 px-2.5 py-1.5 rounded-xl border border-white/5 rounded-tl-none italic text-[10px]">
                          Tutor is thinking...
                        </div>
                      </div>
                    )}
                    <div ref={aiChatEndRef} />
                  </div>

                  {/* AI Input Form */}
                  <form onSubmit={handleSendAiMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      disabled={aiLoading}
                      placeholder="Ask AI Tutor a concept..."
                      className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-2.5 py-2 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-white/20 transition disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={aiLoading}
                      className="p-2 bg-neutral-850 hover:bg-neutral-800 text-white rounded-xl transition flex items-center justify-center disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Files list Drawer (Slide-in drawer) */}
      <AnimatePresence>
        {showFilesDrawer && (
          <div className="fixed inset-0 z-[1000] flex overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilesDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[280px] max-w-[85vw] h-full bg-[#121212] border-r border-white/10 flex flex-col p-4 shadow-2xl z-10 text-left"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-0.5">
                    <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="Logo" className="h-3.5 w-auto object-contain" />
                  </div>
                  <span className="text-[10px] font-bold font-orbitron tracking-wider text-slate-300">WORKSPACE FILES</span>
                </div>
                <button onClick={() => setShowFilesDrawer(false)} className="p-1.5 hover:bg-white/5 rounded-full text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Create File Form */}
              <button 
                onClick={() => setShowNewFileForm(!showNewFileForm)} 
                className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-slate-300 font-bold transition mb-3 select-none cursor-pointer border border-white/5"
              >
                <span>Create New File</span>
                <Plus className="w-4 h-4 text-emerald-400" />
              </button>

              {showNewFileForm && (
                <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 space-y-2 mb-3">
                  <input
                    type="text"
                    placeholder="filename"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <option value=".py">Python (.py)</option>
                    <option value=".csv">Dataset (.csv)</option>
                    <option value=".md">Markdown (.md)</option>
                    <option value=".txt">Text (.txt)</option>
                    <option value=".utils">Utils (.utils)</option>
                  </select>
                  <button
                    onClick={() => {
                      handleCreateFile();
                    }}
                    className="w-full bg-emerald-500 text-slate-950 font-black py-1.5 rounded-lg text-xs transition cursor-pointer active:scale-95"
                  >
                    Create
                  </button>
                </div>
              )}

              {/* Files Loop */}
              <div className="space-y-1 overflow-y-auto flex-1 pr-1">
                {Object.keys(files).map((name) => (
                  <div
                    key={name}
                    onClick={() => {
                      setActiveFile(name);
                      setShowFilesDrawer(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer group transition border ${
                      activeFile === name
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate">{name}</span>
                    </div>
                    {name !== 'main.py' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(name); }}
                        className="p-1 hover:bg-red-500/15 rounded text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
