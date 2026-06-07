import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Mic, MicOff, Video, VideoOff, Hand, MessageSquare, FolderOpen, 
  Search, Bot, Play, Layers, Maximize, Keyboard, Eye, HelpCircle, FileCode, Plus, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ParticipantVideo } from '../components/VideoGrid';
import HackerKeyboard from '../components/HackerKeyboard';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function MobileMeetRoom({
  squadronId,
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
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showControlHub, setShowControlHub] = useState(false);
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [editorFontSize, setEditorFontSize] = useState(13);

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

  // Intercept Editor Focus to prevent native keyboard and trigger Hacker Keyboard
  const handleEditorDidMount = (editor, monaco) => {
    setEditorInstance(editor);

    // Disable mobile virtual keyboard completely by setting inputmode to none on Monaco's internal textarea
    const textarea = editor.getDomNode().querySelector('textarea');
    if (textarea) {
      textarea.setAttribute('inputmode', 'none');
    }

    // Bind event listeners to show custom keyboard when editor body is tapped
    editor.onDidFocusEditorText(() => {
      setShowKeyboard(true);
      setShowControlHub(false); // Collapse controls when coding
    });
  };

  // Keyboard character insertion callback
  const handleInsertKey = (key) => {
    if (!editorInstance) return;

    const editor = editorInstance;
    const selection = editor.getSelection();
    const range = new window.monaco.Range(
      selection.startLineNumber,
      selection.startColumn,
      selection.endLineNumber,
      selection.endColumn
    );

    let textToInsert = key;
    let forceMove = true;

    if (key === 'ENTER') {
      textToInsert = '\n';
    } else if (key === 'SPACE') {
      textToInsert = ' ';
    } else if (key === 'BACKSPACE') {
      // If nothing is selected, delete one character behind the cursor
      if (selection.isEmpty()) {
        const startColumn = Math.max(1, selection.startColumn - 1);
        const deleteRange = new window.monaco.Range(
          selection.startLineNumber,
          startColumn,
          selection.endLineNumber,
          selection.endColumn
        );
        editor.executeEdits('keyboard-delete', [{
          range: deleteRange,
          text: '',
          forceMoveMarkers: true
        }]);
        editor.focus();
        return;
      } else {
        textToInsert = '';
      }
    }

    editor.executeEdits('keyboard-insert', [{
      range: range,
      text: textToInsert,
      forceMoveMarkers: forceMove
    }]);

    editor.focus();
  };

  // Commandants/Mentor identification
  const commandant = participants.find(p => p.role === 'commandant');

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

      {/* RENDER MODE A: active screen presentation */}
      {presenterId !== null ? (
        <div className="flex-1 w-full h-full bg-black relative flex items-center justify-center overflow-hidden">
          {/* Visual rotation simulation for presentation in portrait mode */}
          <div 
            className={`w-full h-full flex items-center justify-center ${
              isPortrait ? 'transform rotate-90 scale-95 origin-center' : ''
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
                <div className="absolute bottom-4 right-4 w-[110px] h-[82px] border border-white/10 rounded-xl overflow-hidden bg-neutral-950 z-50">
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
                    return (
                      <div className="w-full h-full flex items-center justify-center text-[7px] text-slate-500 uppercase font-black font-orbitron select-none">
                        CAM OFF
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Floating presentation exit warning */}
          <div className="absolute top-4 left-4 z-[99] bg-black/60 border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span>Presenting Landscape Mode</span>
          </div>
        </div>
      ) : (
        /* RENDER MODE B: Split view (Video top / Editor bottom) */
        <>
          {/* Upper Commandant Live Feed */}
          <div className="h-[180px] w-full bg-neutral-950/80 border-b border-white/5 relative flex items-center justify-center flex-shrink-0 select-none">
            {commandant ? (
              remoteStreams[commandant.userId] && !commandant.videoMuted ? (
                <ParticipantVideo
                  stream={remoteStreams[commandant.userId]}
                  name={commandant.name}
                  isMuted={commandant.micMuted}
                  isCameraOn={true}
                  isHandRaised={false}
                  isLocal={false}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="text-[10px] font-bold font-orbitron tracking-wider text-slate-400 uppercase">
                    Commandant Feed Online
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 italic">Camera disabled by Mentor</div>
                </div>
              )
            ) : (
              <div className="text-center p-4">
                <div className="text-[10px] font-black font-orbitron tracking-wider text-rose-500 uppercase animate-pulse">
                  Commandant Offline
                </div>
                <div className="text-[8px] text-slate-500 mt-1 uppercase tracking-wide">
                  Waiting for instructor to join...
                </div>
              </div>
            )}

            {/* Active Class Header Badge */}
            <div className="absolute top-3 left-3 bg-black/40 border border-white/5 px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider text-slate-300 font-orbitron backdrop-blur-sm select-none">
              DevShaala Live Meet
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

      {/* Visual Keyboard Wrapper */}
      <AnimatePresence>
        {showKeyboard && !presenterId && (
          <HackerKeyboard
            onInsert={handleInsertKey}
            onClose={() => setShowKeyboard(false)}
          />
        )}
      </AnimatePresence>

      {/* Floating Action Hub (FAB Menu Trigger) */}
      <div className="fixed bottom-4 right-4 z-[999]">
        <button
          onClick={() => {
            setShowControlHub(!showControlHub);
            setShowKeyboard(false); // Close keyboard when opening control hub
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
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute bottom-16 right-0 bg-neutral-950/95 border border-white/10 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col gap-3.5 w-[160px]"
            >
              <div className="text-[8px] font-bold text-slate-500 font-orbitron uppercase border-b border-white/5 pb-1 select-none">
                Meeting Hub
              </div>
              <button
                onClick={() => { onToggleMic(); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-left cursor-pointer"
              >
                {micMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span>{micMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button
                onClick={() => { onToggleVideo(); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-left cursor-pointer"
              >
                {videoMuted ? <VideoOff className="w-4 h-4 text-red-400" /> : <Video className="w-4 h-4 text-emerald-400" />}
                <span>{videoMuted ? 'Camera On' : 'Camera Off'}</span>
              </button>
              <button
                onClick={() => { onToggleHand(); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-left cursor-pointer"
              >
                <Hand className={`w-4 h-4 ${handRaised ? 'text-yellow-400' : 'text-slate-400'}`} />
                <span>{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
              </button>
              <button
                onClick={() => { setShowChat(true); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-left cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <span>Group Chat</span>
              </button>
              <button
                onClick={() => { setShowAI(true); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-left cursor-pointer"
              >
                <Bot className="w-4 h-4 text-purple-400" />
                <span>AI Tutor</span>
              </button>
              <button
                onClick={() => { setShowFilesDrawer(true); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-left cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-slate-400" />
                <span>Files list</span>
              </button>
              <button
                onClick={() => { runPythonCode(); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-emerald-400 text-left cursor-pointer"
              >
                <Play className="w-4 h-4 text-emerald-400" />
                <span>Run Code</span>
              </button>
              <button
                onClick={() => { onMinimizeRoom(); setShowControlHub(false); }}
                className="flex items-center gap-2.5 text-[10px] font-bold uppercase transition hover:text-white text-sky-400 text-left cursor-pointer"
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
