import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import useAppStore from '../store';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import * as Y from 'yjs';

// Icons
import {
  Mic, MicOff, Video, VideoOff, MessageSquare, Users, Hand, Play,
  FolderOpen, Search, Bot, HelpCircle, FileCode, Check, BookOpen,
  Trash2, Plus, Terminal, RefreshCw, Pin, Eye, VolumeX, UserPlus, UserMinus, Lock, Unlock
} from 'lucide-react';

// Components
import CodeEditor from '../components/CodeEditor';
import { ParticipantVideo } from '../components/VideoGrid';
import ChatPortal from '../components/ChatPortal';
import AIPortal from '../components/AIPortal';
import SearchPortal from '../components/SearchPortal';
import DocumentationModal from '../components/DocumentationModal';

export default function MeetRoom() {
  const { squadronId } = useParams();
  const navigate = useNavigate();
  
  // App store states
  const {
    user, userProfile, role, activeMeetId, clearMeet,
    editorTheme, setEditorTheme, editorFontSize, setEditorFontSize,
    showChat, setShowChat, showAI, setShowAI, showSearch, setShowSearch
  } = useAppStore();

  // References
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // Structure: { userId: RTCPeerConnection }
  const yDocRef = useRef(new Y.Doc());

  // Component States
  const [activeSession, setActiveSession] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { userId: MediaStream }
  
  // Meeting client metadata state
  const [participants, setParticipants] = useState([]); // Array of { userId, name, role, isMuted, isCameraOn, isHandRaised }
  const [raisedHands, setRaisedHands] = useState({}); // { userId: boolean }
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // File system & IDE Preferences
  const [files, setFiles] = useState({
    'main.py': "# Python Collaborative Workspace\nprint('Hello DevShaala!')\n",
    'data.csv': "id,name,grade\n1,Naveera,A\n2,Santhosh,A+\n3,Cadet,B\n",
    'notes.txt': "Class notes: Read data using pandas pd.read_csv('data.csv')\n"
  });
  const [activeFile, setActiveFile] = useState('main.py');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileForm, setShowNewFileForm] = useState(false);
  const [fileType, setFileType] = useState('.py');

  // Execution States
  const [pyodideLoaded, setPyodideLoaded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [matplotlibPlot, setMatplotlibPlot] = useState(null);

  // Sidebar navigation toggles
  const [activeLeftPanel, setActiveLeftPanel] = useState('explorer'); // 'explorer', 'people', null
  const [showDocsModal, setShowDocsModal] = useState(false);
  
  // Dropdowns in upper menu
  const [activeDropdown, setActiveDropdown] = useState(null); // 'file', 'edit', 'view', 'help', null

  // Chat message stores
  const [chatMessages, setChatMessages] = useState([]);

  // Right-Dash rotation & pin states
  const [pinnedCadetId1, setPinnedCadetId1] = useState(null);
  const [pinnedCadetId2, setPinnedCadetId2] = useState(null);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [editingUserId, setEditingUserId] = useState(null);
  
  // Mobile & Audios Control States
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [editorFocused, setEditorFocused] = useState(false);
  const [privateTalkTarget, setPrivateTalkTarget] = useState(null);
  const [isMicLocked, setIsMicLocked] = useState(role === 'cadet');
  const [speakRequestPopup, setSpeakRequestPopup] = useState(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileDrawerTab, setMobileDrawerTab] = useState('explorer');

  useEffect(() => {
    if (userProfile && !editingUserId) {
      setEditingUserId(userProfile.uid);
    }
  }, [userProfile]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load Pyodide on mount
  useEffect(() => {
    const initPyodide = async () => {
      try {
        if (window.loadPyodide) {
          // Preload WASM engine
          setConsoleOutput("Initializing DevShaala Python engine (WASM)...");
          const pyInst = await window.loadPyodide();
          window.pyodideInstance = pyInst;
          
          // Load base scientific libraries
          setConsoleOutput("Loading Pandas, NumPy, Matplotlib scientific libraries...");
          await pyInst.loadPackage(['numpy', 'pandas', 'matplotlib']);
          setPyodideLoaded(true);
          setConsoleOutput("DevShaala Python engine ready.\nRun options are now active in the sidebar.");
        } else {
          setConsoleOutput("[Error] Failed to load Python runtime from CDN. Check your network.");
        }
      } catch (err) {
        setConsoleOutput(`[Boot Error]: Engine initialization error: ${err.message}`);
      }
    };
    initPyodide();
  }, []);

  // Sync Yjs doc file edits to local state
  useEffect(() => {
    const ymap = yDocRef.current.getMap('explorer_files');
    
    // Set initial files in map if empty
    if (ymap.size === 0 && role === 'commandant') {
      Object.entries(files).forEach(([name, content]) => {
        ymap.set(name, content);
      });
    }

    // Sync changes to local state
    ymap.observe(() => {
      const currentFiles = {};
      ymap.forEach((val, key) => {
        currentFiles[key] = val;
      });
      setFiles(currentFiles);
    });
  }, [role]);

  // Firestore Session Safety check
  useEffect(() => {
    if (!squadronId) return;
    const unsub = onSnapshot(doc(db, 'code_meet_sessions', squadronId), (snap) => {
      if (!snap.exists()) {
        toast.error("The meet session was ended by the Commandant.", {
          icon: <VolumeX className="w-5 h-5 text-rose-500" />
        });
        handleExitMeet();
      } else {
        setActiveSession(snap.data());
      }
    });
    return unsub;
  }, [squadronId]);

  // WebRTC Camera/Mic Stream Initialization
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Lock mic by default for Cadets
        if (role === 'cadet') {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
            setMicMuted(true);
          }
        }
      } catch (err) {
        toast.error("Failed to access camera/microphone: " + err.message);
        // Fallback to empty stream or audio only if user blocked camera
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
        } catch (_) {
          console.log("No media permissions granted");
        }
      }
    };
    startMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // WebSockets & WebRTC Signaling Logic
  useEffect(() => {
    if (!userProfile || !localStreamRef.current) return;

    let wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    
    // Normalize protocol to ensure correct WebSocket prefixes (ws:// or wss://)
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    } else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      const isSecure = window.location.protocol === 'https:';
      wsUrl = (isSecure ? 'wss://' : 'ws://') + wsUrl;
    }

    const socket = new WebSocket(
      `${wsUrl}/ws/meet/${squadronId}?user_id=${userProfile.uid}&name=${encodeURIComponent(userProfile.name)}&role=${role}`
    );
    wsRef.current = socket;

    socket.onopen = () => {
      setWsConnected(true);
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'sync-init':
          setParticipants(data.users);
          setChatMessages(data.chat_history);
          
          // Yjs document sync catch up
          if (data.yjs_updates && data.yjs_updates.length > 0) {
            data.yjs_updates.forEach(upBase64 => {
              const binary = Uint8Array.from(atob(upBase64), c => c.charCodeAt(0));
              Y.applyUpdate(yDocRef.current, binary);
            });
          }

          // Initiate WebRTC offers to everyone already in the room
          data.users.forEach(async (peer) => {
            if (peer.userId !== userProfile.uid) {
              await createPeerConnection(peer.userId, true);
            }
          });
          break;

        case 'peer-joined':
          setParticipants(prev => [...prev, { userId: data.userId, name: data.name, role: data.role }]);
          toast(`${data.name} joined class`, {
            icon: <UserPlus className="w-5 h-5 text-sky-400" />
          });
          break;

        case 'peer-left':
          setParticipants(prev => prev.filter(p => p.userId !== data.userId));
          // Clean up remote stream and RTC connections
          if (peersRef.current[data.userId]) {
            peersRef.current[data.userId].close();
            delete peersRef.current[data.userId];
          }
          setRemoteStreams(prev => {
            const copy = { ...prev };
            delete copy[data.userId];
            return copy;
          });
          break;

        case 'webrtc-signal':
          const { senderId, signal } = data;
          let pc = peersRef.current[senderId];
          if (!pc) {
            pc = await createPeerConnection(senderId, false);
          }

          if (signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            if (signal.type === 'offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.send(JSON.stringify({
                type: 'webrtc-signal',
                target: senderId,
                signal: { type: 'answer', sdp: answer }
              }));
            }
          } else if (signal.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
          break;

        case 'yjs-update':
          if (data.senderId !== userProfile.uid) {
            const binary = Uint8Array.from(atob(data.update), c => c.charCodeAt(0));
            Y.applyUpdate(yDocRef.current, binary);
          }
          break;

        case 'chat-message':
          setChatMessages(prev => [...prev, data]);
          if (!showChat) {
            toast(`Message from ${data.senderName}`, {
              icon: <MessageSquare className="w-5 h-5 text-purple-400" />
            });
          }
          break;

        case 'commandant-private-speak':
          if (role === 'cadet') {
            const cmdUser = participants.find(p => p.role === 'commandant');
            if (cmdUser) {
              // Retrieve remote stream for Commandant
              const cmdStream = remoteStreams[cmdUser.userId];
              if (cmdStream) {
                const audioTrack = cmdStream.getAudioTracks()[0];
                if (audioTrack) {
                  if (data.active && data.target !== userProfile.uid) {
                    audioTrack.enabled = false;
                    toast("Commandant is speaking privately to another Cadet.", {
                      icon: <Lock className="w-5 h-5 text-amber-500" />
                    });
                  } else {
                    audioTrack.enabled = true;
                    toast("Commandant is now speaking to the whole class.", {
                      icon: <Unlock className="w-5 h-5 text-emerald-400" />
                    });
                  }
                }
              }
            }
          }
          break;

        case 'request-speak':
          if (role === 'commandant') {
            setSpeakRequestPopup({ userId: data.senderId, name: data.senderName });
          }
          break;

        case 'grant-speak':
          if (data.target === userProfile?.uid) {
            setIsMicLocked(false);
            if (localStreamRef.current) {
              const audioTrack = localStreamRef.current.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = true;
                setMicMuted(false);
              }
            }
            toast.success("Commandant has granted you permission to speak. You are now unmuted!", {
              icon: <Mic className="w-5 h-5 text-emerald-400" />
            });
          }
          break;

        case 'revoke-speak':
          if (data.target === userProfile?.uid) {
            setIsMicLocked(true);
            if (localStreamRef.current) {
              const audioTrack = localStreamRef.current.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = false;
                setMicMuted(true);
              }
            }
            toast.error("Commandant has muted your microphone.", {
              icon: <MicOff className="w-5 h-5 text-rose-500" />
            });
          }
          break;

        case 'hand-raise':
          setRaisedHands(prev => ({ ...prev, [data.userId]: data.isRaised }));
          if (data.isRaised) {
            toast(`${data.name} raised hand!`, {
              icon: <Hand className="w-5 h-5 text-amber-400" />
            });
          }
          break;

        case 'eviction':
          toast.error("You were evicted from the classroom by the Commandant.", {
            icon: <UserMinus className="w-5 h-5 text-rose-500" />
          });
          handleExitMeet();
          break;
      }
    };

    // Keep Yjs updates synched over WebSockets
    yDocRef.current.on('update', (update) => {
      const updateBase64 = btoa(String.fromCharCode(...update));
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'yjs-update',
          update: updateBase64
        }));
      }
    });

    return () => {
      socket.close();
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [userProfile, localStream]);

  // Auto-rotating Cadet views on Right Dash (every 10 seconds)
  useEffect(() => {
    const cadets = participants.filter(p => p.role === 'cadet');
    if (cadets.length <= 2) return;

    const interval = setInterval(() => {
      setRotationIndex(prev => (prev + 1) % cadets.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [participants]);

  // Create an RTCPeerConnection for WebRTC video/audio mesh
  const createPeerConnection = async (peerId, isOfferor) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peersRef.current[peerId] = pc;

    // Attach local audio/video tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle ICE candidacy
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc-signal',
          target: peerId,
          signal: { candidate: event.candidate }
        }));
      }
    };

    // Listen for incoming remote stream tracks
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [peerId]: event.streams[0]
      }));
    };

    if (isOfferor) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc-signal',
          target: peerId,
          signal: { type: 'offer', sdp: offer }
        }));
      }
    }

    return pc;
  };

  const handleSendMessage = (text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat-message',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
    }
  };

  const handleToggleMic = () => {
    if (role === 'cadet' && isMicLocked) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'request-speak',
          senderId: userProfile.uid,
          senderName: userProfile.name
        }));
        toast.success("Sent request to speak to the Commandant");
      }
      return;
    }

    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const handleToggleHandRaise = () => {
    const newState = !handRaised;
    setHandRaised(newState);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'hand-raise',
        isRaised: newState
      }));
    }
  };

  const handleRemoveCadet = (cadetId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && role === 'commandant') {
      wsRef.current.send(JSON.stringify({
        type: 'remove-user',
        target: cadetId
      }));
      toast.success("Evicting user...");
    }
  };

  const handleExitMeet = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    clearMeet();
    navigate('/dashboard');
  };

  // Run Code in WASM Pyodide instance
  const runPythonCode = async () => {
    if (!pyodideLoaded || isRunning) return;
    setIsRunning(true);
    setConsoleOutput("Executing Python script in DevShaala console...\n");
    setMatplotlibPlot(null);

    try {
      const pyInst = window.pyodideInstance;
      
      // Redirect Pyodide stdout and stderr
      pyInst.runPython(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
      `);

      // Write all project files into Pyodide virtual file system
      Object.entries(files).forEach(([name, content]) => {
        pyInst.FS.writeFile(name, content);
      });

      // Get code from active file and execute it
      const fileCode = files[activeFile] || "";
      await pyInst.runPythonAsync(fileCode);

      // Fetch standard output and errors
      const stdout = pyInst.runPython("sys.stdout.getvalue()");
      const stderr = pyInst.runPython("sys.stderr.getvalue()");

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += `\n[Runtime Error]:\n${stderr}`;
      if (!stdout && !stderr) output += "Code ran successfully with no printed output.";

      setConsoleOutput(output);

      // Intercept Matplotlib plots if generated
      const hasPlot = pyInst.runPython(`
import sys
'matplotlib' in sys.modules and len(sys.modules['matplotlib'].pyplot.get_fignums()) > 0
      `);

      if (hasPlot) {
        const plotBase64 = pyInst.runPython(`
import io, base64
import matplotlib.pyplot as plt
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
img = base64.b64encode(buf.read()).decode('utf-8')
plt.close('all')
img
        `);
        setMatplotlibPlot(`data:image/png;base64,${plotBase64}`);
        setConsoleOutput(prev => prev + "\n\n[Matplotlib Plot Generated]: Plotted successfully below.");
      }

    } catch (err) {
      setConsoleOutput(prev => prev + `\n[Syntax/Execution Error]:\n${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Create local file in explorer
  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const fullName = newFileName.trim() + fileType;
    
    // Add to shared files map
    const ymap = yDocRef.current.getMap('explorer_files');
    ymap.set(fullName, `# Collaborative ${fullName}\n`);
    
    setNewFileName('');
    setShowNewFileForm(false);
    setActiveFile(fullName);
    if (isMobile) {
      setShowMobileSidebar(false);
    }
    toast.success(`Created file: ${fullName}`);
  };

  // Delete file in explorer
  const handleDeleteFile = (fileName) => {
    if (fileName === 'main.py') {
      toast.error("Cannot delete the core main.py file");
      return;
    }
    const ymap = yDocRef.current.getMap('explorer_files');
    ymap.delete(fileName);
    if (activeFile === fileName) {
      setActiveFile('main.py');
    }
    toast.success(`Deleted file: ${fileName}`);
  };

  // Get content updater callback for editor
  const handleUpdateFileContent = (content) => {
    const ymap = yDocRef.current.getMap('explorer_files');
    ymap.set(activeFile, content);
  };

  // Get slots for cadet grid
  const getCadetGridSlots = () => {
    const cadets = participants.filter(p => p.role === 'cadet');
    if (cadets.length === 0) return [null, null];

    let cadet1 = null;
    let cadet2 = null;

    if (pinnedCadetId1) {
      cadet1 = cadets.find(c => c.userId === pinnedCadetId1) || null;
    }
    if (pinnedCadetId2) {
      cadet2 = cadets.find(c => c.userId === pinnedCadetId2) || null;
    }

    // If slots are unpinned, auto-rotate cadets
    if (!cadet1 && cadets.length > 0) {
      cadet1 = cadets[rotationIndex % cadets.length];
    }
    if (!cadet2 && cadets.length > 1) {
      // Pick next cadet
      cadet2 = cadets[(rotationIndex + 1) % cadets.length];
    }

    return [cadet1, cadet2];
  };

  const commandant = participants.find(p => p.role === 'commandant');
  const [slotCadet1, slotCadet2] = getCadetGridSlots();

  return (
    <div className="h-screen flex flex-col bg-[#080c14] text-slate-100 overflow-hidden font-sans">
      
      {/* 1. Upper Menu Bar */}
      <header className="h-[48px] bg-slate-950/70 border-b border-white/5 flex items-center justify-between px-4 z-40 select-none glass-panel">
        <div className="flex items-center gap-6">
          <div 
            onClick={() => isMobile && setShowMobileSidebar(!showMobileSidebar)}
            className={`flex items-center gap-2 ${isMobile ? 'cursor-pointer active:opacity-75 hover:opacity-90 transition select-none' : ''}`}
          >
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center p-0.5 flex-shrink-0">
              <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="DevShaala" className="h-4.5 w-auto object-contain" />
            </div>
            <span className="font-orbitron font-black text-xs tracking-wider text-emerald-400 flex items-center gap-1">
              DEVSHAALA Meet
              {isMobile && <span className="text-[8px] font-normal text-emerald-500/85 lowercase bg-emerald-500/10 px-1 py-0.5 rounded-md">menu</span>}
            </span>
          </div>

          {/* Menu Options (IDLE Style dropdown triggers) */}
          <nav className="flex items-center gap-1">
            {['File', 'Edit', 'View', 'Help'].map((item) => (
              <div key={item} className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === item ? null : item)}
                  className={`px-3 py-1 rounded text-xs font-medium hover:bg-white/5 transition uppercase tracking-wider ${
                    activeDropdown === item ? 'bg-white/5 text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {item}
                </button>

                {/* Dropdowns */}
                {activeDropdown === item && (
                  <div className="absolute top-[32px] left-0 w-[180px] bg-slate-900 border border-white/5 rounded-xl p-1 shadow-2xl flex flex-col z-[50]">
                    {item === 'File' && (
                      <>
                        <button onClick={() => { setShowNewFileForm(true); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg font-medium transition">
                          New File...
                        </button>
                        <button onClick={() => {
                          const element = document.createElement("a");
                          const file = new Blob([files[activeFile] || ''], {type: 'text/plain'});
                          element.href = URL.createObjectURL(file);
                          element.download = activeFile;
                          document.body.appendChild(element);
                          element.click();
                          setActiveDropdown(null);
                        }} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg font-medium transition">
                          Download File
                        </button>
                      </>
                    )}
                    {item === 'Edit' && (
                      <>
                        <button onClick={() => setActiveDropdown(null)} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg font-medium transition">
                          Find & Replace
                        </button>
                        <button onClick={() => {
                          const ymap = yDocRef.current.getMap('explorer_files');
                          ymap.set(activeFile, `# Reset Collaborative Editor\n`);
                          setActiveDropdown(null);
                        }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-500/10 hover:text-red-400 rounded-lg font-medium text-red-400 transition">
                          Clear Content
                        </button>
                      </>
                    )}
                    {item === 'View' && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 border-b border-white/5 uppercase">Themes</div>
                        {['vs-dark', 'light', 'hc-black', 'violet'].map((th) => (
                          <button
                            key={th}
                            onClick={() => { setEditorTheme(th); setActiveDropdown(null); }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg font-medium transition capitalize"
                          >
                            {th.replace('vs-', '')} {editorTheme === th && '✓'}
                          </button>
                        ))}
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 border-b border-white/5 uppercase mt-1">Font Size</div>
                        <div className="flex items-center justify-between px-3 py-1 text-xs text-slate-400">
                          <button onClick={() => setEditorFontSize(Math.max(10, editorFontSize - 1))} className="hover:text-white font-bold p-1 bg-white/5 rounded">-</button>
                          <span>{editorFontSize}px</span>
                          <button onClick={() => setEditorFontSize(Math.min(24, editorFontSize + 1))} className="hover:text-white font-bold p-1 bg-white/5 rounded">+</button>
                        </div>
                      </>
                    )}
                    {item === 'Help' && (
                      <>
                        <button onClick={() => { setShowDocsModal(true); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg font-medium transition flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          Library References
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Meeting controls right aligned */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-white/5 px-3 py-1 rounded-xl text-[10px] text-slate-400 font-bold uppercase tracking-wider font-orbitron">
            <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-red-400 animate-ping'}`} />
            {wsConnected ? 'Server Connected' : 'Syncing...'}
          </div>
          <button
            onClick={handleExitMeet}
            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-slate-950 text-xs font-black uppercase rounded-xl transition"
          >
            Leave Meet
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* A. Activities Slim Sidebar (Left) */}
        <aside className="w-[56px] bg-slate-950/40 border-r border-white/5 flex flex-col justify-between items-center py-4 z-30 select-none">
          <div className="flex flex-col gap-5">
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileDrawerTab('explorer');
                  setShowMobileSidebar(true);
                } else {
                  setActiveLeftPanel(activeLeftPanel === 'explorer' ? null : 'explorer');
                }
              }}
              className={`p-3 rounded-2xl transition sidebar-icon ${
                isMobile 
                  ? (showMobileSidebar && mobileDrawerTab === 'explorer' ? 'active text-emerald-400 bg-white/5' : 'text-slate-400 hover:text-white')
                  : (activeLeftPanel === 'explorer' ? 'active text-emerald-400 bg-white/5' : 'text-slate-400 hover:text-white')
              }`}
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileDrawerTab('people');
                  setShowMobileSidebar(true);
                } else {
                  setActiveLeftPanel(activeLeftPanel === 'people' ? null : 'people');
                }
              }}
              className={`p-3 rounded-2xl transition sidebar-icon ${
                isMobile 
                  ? (showMobileSidebar && mobileDrawerTab === 'people' ? 'active text-emerald-400 bg-white/5' : 'text-slate-400 hover:text-white')
                  : (activeLeftPanel === 'people' ? 'active text-emerald-400 bg-white/5' : 'text-slate-400 hover:text-white')
              }`}
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={handleToggleHandRaise}
              className={`p-3 rounded-2xl transition sidebar-icon ${handRaised ? 'text-yellow-400 bg-yellow-500/10' : 'text-slate-400 hover:text-white'}`}
            >
              <Hand className="w-5 h-5" />
            </button>
            <button
              onClick={runPythonCode}
              disabled={!pyodideLoaded || isRunning}
              className={`p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition flex items-center justify-center glow-accent disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Play className="w-5 h-5 fill-slate-950" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-3 rounded-2xl transition sidebar-icon ${showChat ? 'text-emerald-400 bg-white/5' : 'text-slate-400 hover:text-white'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-3 rounded-2xl transition sidebar-icon ${showSearch ? 'text-sky-400 bg-white/5' : 'text-slate-400 hover:text-white'}`}
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`p-3 rounded-2xl transition sidebar-icon ${showAI ? 'text-purple-400 bg-white/5' : 'text-slate-400 hover:text-white'}`}
            >
              <Bot className="w-5 h-5" />
            </button>
            <button
              onClick={handleToggleMic}
              className={`p-3 rounded-2xl transition border ${micMuted ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-slate-900 border-white/5 text-emerald-400 hover:text-white'}`}
            >
              {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={handleToggleVideo}
              className={`p-3 rounded-2xl transition border ${videoMuted ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-slate-900 border-white/5 text-emerald-400 hover:text-white'}`}
            >
              {videoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          </div>
        </aside>

        {/* B. Slide Panel (Explorer / People lists) - Desktop only */}
        <AnimatePresence>
          {!isMobile && activeLeftPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-950/20 border-r border-white/5 overflow-hidden flex flex-col z-20"
            >
              {activeLeftPanel === 'explorer' && (
                <div className="p-4 flex-1 flex flex-col select-none">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold font-orbitron tracking-wider text-slate-400">WORKSPACE FILES</span>
                    <button onClick={() => setShowNewFileForm(!showNewFileForm)} className="p-1 hover:bg-white/5 rounded text-emerald-400 transition">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Create File Form */}
                  {showNewFileForm && (
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-2 mb-3">
                      <input
                        type="text"
                        placeholder="filename"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-lg px-2 py-1 text-xs text-white"
                      />
                      <select 
                        value={fileType} 
                        onChange={(e) => setFileType(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-lg px-2 py-1 text-xs text-slate-300"
                      >
                        <option value=".py">Python (.py)</option>
                        <option value=".csv">Dataset (.csv)</option>
                        <option value=".md">Markdown (.md)</option>
                        <option value=".txt">Text (.txt)</option>
                        <option value=".utils">Utils (.utils)</option>
                      </select>
                      <button onClick={handleCreateFile} className="w-full bg-emerald-500 text-slate-950 font-bold py-1 rounded-lg text-xs transition">
                        Create
                      </button>
                    </div>
                  )}

                  {/* File List */}
                  <div className="space-y-1 overflow-y-auto flex-1">
                    {Object.keys(files).map((name) => (
                      <div
                        key={name}
                        onClick={() => setActiveFile(name)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer group transition ${
                          activeFile === name 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className="w-3.5 h-3.5 opacity-70" />
                          <span className="truncate">{name}</span>
                        </div>
                        {name !== 'main.py' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFile(name); }}
                            className="p-0.5 hover:bg-red-500/15 rounded text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeLeftPanel === 'people' && (
                <div className="p-4 flex-1 flex flex-col">
                  <span className="text-[10px] font-bold font-orbitron tracking-wider text-slate-400 mb-4 uppercase">PARTICIPANTS ({participants.length})</span>
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {participants.map((p) => {
                      const isHandUp = raisedHands[p.userId] || false;
                      const isHost = p.role === 'commandant';

                      return (
                        <div key={p.userId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-white/5 text-xs">
                          <div className="flex flex-col truncate pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-200 truncate">{p.name}</span>
                              {isHandUp && <Hand className="w-3 h-3 text-yellow-400 fill-yellow-400 animate-bounce" />}
                            </div>
                            <span className="text-[9px] text-slate-500 uppercase font-semibold">
                              {isHost ? 'Instructor' : 'Cadet'}
                            </span>
                          </div>

                          {/* Commandant Controls: Remove/Pin/Edit Cadet */}
                          {!isHost && role === 'commandant' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  const isActive = privateTalkTarget === p.userId;
                                  const targetId = isActive ? null : p.userId;
                                  setPrivateTalkTarget(targetId);

                                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                                    wsRef.current.send(JSON.stringify({
                                      type: 'commandant-private-speak',
                                      active: !isActive,
                                      target: p.userId
                                    }));
                                  }

                                  if (!isActive) {
                                    toast.success(`Speaking privately to ${p.name}`);
                                  } else {
                                    toast.success("Returned to public speaking mode");
                                  }
                                }}
                                title="Talk privately"
                                className={`p-1 rounded transition ${
                                  privateTalkTarget === p.userId 
                                    ? 'bg-yellow-500/20 text-yellow-400' 
                                    : 'hover:bg-white/5 text-slate-400'
                                }`}
                              >
                                <Mic className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUserId(p.userId);
                                  toast.success(`Now editing ${p.name}'s code`);
                                }}
                                title="Edit code"
                                className={`p-1 rounded transition ${
                                  editingUserId === p.userId 
                                    ? 'bg-purple-500/20 text-purple-400' 
                                    : 'hover:bg-white/5 text-slate-400'
                                }`}
                              >
                                <FileCode className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  if (pinnedCadetId1 === p.userId) setPinnedCadetId1(null);
                                  else if (pinnedCadetId2 === p.userId) setPinnedCadetId2(null);
                                  else if (!pinnedCadetId1) setPinnedCadetId1(p.userId);
                                  else setPinnedCadetId2(p.userId);
                                }}
                                title="Pin stream"
                                className={`p-1 rounded transition ${
                                  pinnedCadetId1 === p.userId || pinnedCadetId2 === p.userId 
                                    ? 'bg-emerald-500/20 text-emerald-400' 
                                    : 'hover:bg-white/5 text-slate-400'
                                }`}
                              >
                                <Pin className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleRemoveCadet(p.userId)}
                                title="Kick student"
                                className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* C. Workspace Midpart (Monaco Editor & Console) */}
        <main 
          onFocusCapture={() => setEditorFocused(true)}
          onBlurCapture={() => setEditorFocused(false)}
          className="flex-1 flex flex-col overflow-hidden p-4 relative min-w-[300px]"
        >
          
          {/* Active File Header */}
          <div className="flex items-center justify-between mb-2 px-2 select-none">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>{activeFile}</span>
              {editingUserId && editingUserId !== userProfile?.uid && (
                <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg">
                  <span className="text-[10px] text-purple-400 font-semibold">
                    Editing: {participants.find(p => p.userId === editingUserId)?.name || "Cadet"}'s workspace
                  </span>
                  <button
                    onClick={() => {
                      setEditingUserId(userProfile?.uid);
                      toast.success("Returned to your own workspace");
                    }}
                    className="text-[9px] bg-purple-500 text-slate-950 font-black px-1.5 py-0.5 rounded hover:bg-purple-400 transition"
                  >
                    Reset to Self
                  </button>
                </div>
              )}
            </div>

            {/* Language indicator */}
            <div className="text-[10px] bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-slate-400 uppercase font-bold font-orbitron">
              PYTHON WASM
            </div>
          </div>

          {/* Collaborative Monaco Editor container */}
          <div className="flex-1 min-h-[150px] relative">
            <CodeEditor
              yText={yDocRef.current.getText((editingUserId || userProfile?.uid) + "_" + activeFile)}
              readOnly={role !== 'commandant' && editingUserId !== userProfile?.uid}
              onChange={(val) => {
                // Keep file dictionary updated locally in backup state
                setFiles(prev => ({
                  ...prev,
                  [activeFile]: val
                }));
              }}
            />

            {/* Floating Local Stream video player (Desktop only) */}
            {!isMobile && localStream && !videoMuted && (
              <div className="float-camera">
                <ParticipantVideo
                  stream={localStream}
                  name="You"
                  isMuted={micMuted}
                  isCameraOn={!videoMuted}
                  isHandRaised={handRaised}
                  isLocal={true}
                  className="w-full h-full"
                />
              </div>
            )}
          </div>

          {/* Mobile Bottom Commandant Video Feed (visible only on mobile when editor is not focused) */}
          {isMobile && !editorFocused && (
            <div className="h-[200px] mt-4 flex flex-col bg-slate-950 border border-white/5 rounded-xl overflow-hidden shadow-lg select-none">
              <div className="flex items-center px-4 py-2 bg-slate-900 border-b border-white/5 justify-between">
                <span className="text-[9px] font-bold font-orbitron tracking-wider text-red-400">COMMANDANT STREAM</span>
                <span className="text-[9px] text-slate-400 font-semibold">{commandant?.name || "Offline"}</span>
              </div>
              <div className="flex-1 bg-slate-950/20 relative flex items-center justify-center p-2">
                {commandant ? (
                  remoteStreams[commandant.userId] ? (
                    <ParticipantVideo
                      stream={remoteStreams[commandant.userId]}
                      name={commandant.name}
                      isMuted={false}
                      isCameraOn={true}
                      isHandRaised={false}
                      isLocal={false}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="text-[10px] text-slate-500 italic">Commandant webcam starting...</div>
                  )
                ) : (
                  <div className="text-[10px] text-slate-500 italic">Commandant offline</div>
                )}
              </div>
            </div>
          )}

          {/* Terminal Console Panel (Desktop only) */}
          {!isMobile && (
            <section className="h-[180px] mt-4 flex flex-col bg-slate-950 border border-white/5 rounded-xl overflow-hidden shadow-lg select-text">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/5 select-none">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold font-orbitron tracking-wider text-emerald-400">OUTPUT CONSOLE</span>
                </div>
                <button onClick={() => setConsoleOutput('')} className="text-[9px] font-bold text-slate-500 hover:text-white transition">
                  CLEAR
                </button>
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {/* Output log */}
                <pre className="flex-1 p-4 overflow-y-auto text-[10px] font-mono text-slate-300 whitespace-pre-wrap select-text leading-relaxed">
                  {consoleOutput}
                </pre>

                {/* Matplotlib image render view */}
                {matplotlibPlot && (
                  <div className="w-[180px] border-l border-white/5 p-2 bg-white flex items-center justify-center">
                    <img src={matplotlibPlot} alt="Plot figure output" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {/* D. Right Side Dashboard (3 Videos/Editor card) */}
        {!isMobile && (
          <aside className="w-[300px] bg-slate-950/40 border-l border-white/5 p-4 flex flex-col gap-4 overflow-y-auto select-none">
          <div className="flex items-center gap-2 pb-1 border-b border-white/5 mb-1">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold font-orbitron text-slate-400 tracking-wider">WORKSPACE PREVIEWS</span>
          </div>

          {/* Slot 1: Commandant (Permanent) */}
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex flex-col h-[180px] relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-red-400 uppercase">Commandant (Instructor)</span>
              <span className="text-[9px] text-slate-500">{commandant?.name || "Offline"}</span>
            </div>
            
            <div className="flex-1 rounded-lg overflow-hidden border border-white/5 relative">
              {commandant ? (
                <CodeEditor
                  readOnly={true}
                  value={files[activeFile] || ""} // Fallback representation of workspace progress
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-slate-500 italic bg-slate-950/20">
                  Commandant offline
                </div>
              )}

              {/* Commandant Stream Overlay (BR) */}
              {commandant && remoteStreams[commandant.userId] && (
                <ParticipantVideo
                  stream={remoteStreams[commandant.userId]}
                  name={commandant.name}
                  isMuted={false}
                  isCameraOn={true}
                  isHandRaised={false}
                  isLocal={false}
                  className="absolute bottom-1 right-1 w-[80px] h-[60px] border border-red-500"
                />
              )}
            </div>
          </div>

          {/* Slot 2: Cadet A (Rotating or pinned) */}
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex flex-col h-[180px] relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-sky-400 uppercase flex items-center gap-1">
                {pinnedCadetId1 ? (
                  <>
                    <Pin className="w-2.5 h-2.5 fill-sky-400 text-sky-400 rotate-45" />
                    <span>Pinned Cadet</span>
                  </>
                ) : (
                  <span>Rotating Cadet</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-500 truncate max-w-[100px]">
                  {slotCadet1 ? slotCadet1.name : "Waiting for cadet..."}
                </span>
                {slotCadet1 && role === 'commandant' && (
                  <button
                    onClick={() => {
                      setEditingUserId(slotCadet1.userId);
                      toast.success(`Now editing ${slotCadet1.name}'s code`);
                    }}
                    title="Edit Code"
                    className="text-slate-400 hover:text-emerald-400 p-0.5 rounded transition"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 rounded-lg overflow-hidden border border-white/5 relative">
              {slotCadet1 ? (
                <>
                  <CodeEditor
                    readOnly={true}
                    value={files[activeFile]} // Display shared status
                  />
                  {remoteStreams[slotCadet1.userId] && (
                    <ParticipantVideo
                      stream={remoteStreams[slotCadet1.userId]}
                      name={slotCadet1.name}
                      isMuted={false}
                      isCameraOn={true}
                      isHandRaised={raisedHands[slotCadet1.userId]}
                      isLocal={false}
                      className="absolute bottom-1 right-1 w-[80px] h-[60px] border border-sky-500"
                    />
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-slate-500 italic bg-slate-950/20">
                  No other cadet online
                </div>
              )}
            </div>
          </div>

          {/* Slot 3: Cadet B (Rotating or pinned) */}
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex flex-col h-[180px] relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-sky-400 uppercase flex items-center gap-1">
                {pinnedCadetId2 ? (
                  <>
                    <Pin className="w-2.5 h-2.5 fill-sky-400 text-sky-400 rotate-45" />
                    <span>Pinned Cadet</span>
                  </>
                ) : (
                  <span>Rotating Cadet</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-500 truncate max-w-[100px]">
                  {slotCadet2 ? slotCadet2.name : "Waiting for cadet..."}
                </span>
                {slotCadet2 && role === 'commandant' && (
                  <button
                    onClick={() => {
                      setEditingUserId(slotCadet2.userId);
                      toast.success(`Now editing ${slotCadet2.name}'s code`);
                    }}
                    title="Edit Code"
                    className="text-slate-400 hover:text-emerald-400 p-0.5 rounded transition"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 rounded-lg overflow-hidden border border-white/5 relative">
              {slotCadet2 ? (
                <>
                  <CodeEditor
                    readOnly={true}
                    value={files[activeFile]}
                  />
                  {remoteStreams[slotCadet2.userId] && (
                    <ParticipantVideo
                      stream={remoteStreams[slotCadet2.userId]}
                      name={slotCadet2.name}
                      isMuted={false}
                      isCameraOn={true}
                      isHandRaised={raisedHands[slotCadet2.userId]}
                      isLocal={false}
                      className="absolute bottom-1 right-1 w-[80px] h-[60px] border border-sky-500"
                    />
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-slate-500 italic bg-slate-950/20">
                  No other cadet online
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      </div>

      {/* 3. Draggable Popup Widget overlays */}
      <ChatPortal
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        userId={userProfile?.uid}
      />
      
      <AIPortal />
      <SearchPortal />

      <DocumentationModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
      />

      {/* 4. Commandant Speak Request Popup */}
      {speakRequestPopup && role === 'commandant' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-950 w-80 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <Mic className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white font-orbitron uppercase">Speak Request</h3>
              <p className="text-[11px] text-slate-400">
                Cadet <span className="text-emerald-400 font-bold">{speakRequestPopup.name}</span> wants to turn on their microphone.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                      type: 'grant-speak',
                      target: speakRequestPopup.userId
                    }));
                  }
                  setSpeakRequestPopup(null);
                  toast.success("Speak permission granted");
                }}
                className="flex-1 bg-emerald-500 text-slate-950 font-black py-2.5 rounded-xl text-xs transition active:scale-95"
              >
                Grant
              </button>
              <button
                onClick={() => setSpeakRequestPopup(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition active:scale-95"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Mobile Explorer & People Drawer overlay */}
      <AnimatePresence>
        {isMobile && showMobileSidebar && (
          <div className="fixed inset-0 z-50 flex overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[280px] max-w-[85vw] h-full bg-[#070b19] border-r border-white/10 flex flex-col p-4 shadow-2xl z-10 overflow-y-auto text-left"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-0.5">
                    <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="DevShaala" className="h-3.5 w-auto object-contain" />
                  </div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest font-orbitron">DEVSHAALA Panel</span>
                </div>
                <button 
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-slate-900/50 p-1 border border-white/5 rounded-xl mb-4">
                <button 
                  onClick={() => setMobileDrawerTab('explorer')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                    mobileDrawerTab === 'explorer' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Explorer
                </button>
                <button 
                  onClick={() => setMobileDrawerTab('people')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                    mobileDrawerTab === 'people' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  People ({participants.length})
                </button>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto pr-1">
                {mobileDrawerTab === 'explorer' && (
                  <div className="flex-1 flex flex-col select-none h-full">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold font-orbitron tracking-wider text-slate-500 uppercase">WORKSPACE FILES</span>
                      <button onClick={() => setShowNewFileForm(!showNewFileForm)} className="p-1 hover:bg-white/5 rounded text-emerald-400 transition">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Create File Form */}
                    {showNewFileForm && (
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-2 mb-3">
                        <input
                          type="text"
                          placeholder="filename"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-2 py-1 text-xs text-white"
                        />
                        <select 
                          value={fileType} 
                          onChange={(e) => setFileType(e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-2 py-1 text-xs text-slate-300"
                        >
                          <option value=".py">Python (.py)</option>
                          <option value=".csv">Dataset (.csv)</option>
                          <option value=".md">Markdown (.md)</option>
                          <option value=".txt">Text (.txt)</option>
                          <option value=".utils">Utils (.utils)</option>
                        </select>
                        <button onClick={handleCreateFile} className="w-full bg-emerald-500 text-slate-950 font-bold py-1 rounded-lg text-xs transition">
                          Create
                        </button>
                      </div>
                    )}

                    {/* File List */}
                    <div className="space-y-1">
                      {Object.keys(files).map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setActiveFile(name);
                            setShowMobileSidebar(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer group transition ${
                            activeFile === name 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileCode className="w-3.5 h-3.5 opacity-70" />
                            <span className="truncate">{name}</span>
                          </div>
                          {name !== 'main.py' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteFile(name); }}
                              className="p-0.5 hover:bg-red-500/15 rounded text-slate-500 hover:text-red-400 opacity-100 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mobileDrawerTab === 'people' && (
                  <div className="flex-1 flex flex-col h-full animate-fadeIn">
                    <span className="text-[10px] font-bold font-orbitron tracking-wider text-slate-500 mb-4 uppercase">PARTICIPANTS ({participants.length})</span>
                    <div className="space-y-2">
                      {participants.map((p) => {
                        const isHandUp = raisedHands[p.userId] || false;
                        const isHost = p.role === 'commandant';

                        return (
                          <div key={p.userId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-white/5 text-xs">
                            <div className="flex flex-col truncate pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-200 truncate">{p.name}</span>
                                {isHandUp && <Hand className="w-3 h-3 text-yellow-400 fill-yellow-400 animate-bounce" />}
                              </div>
                              <span className="text-[9px] text-slate-500 uppercase font-semibold">
                                {isHost ? 'Instructor' : 'Cadet'}
                              </span>
                            </div>

                            {/* Commandant Controls: Remove/Pin/Edit Cadet */}
                            {!isHost && role === 'commandant' && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    const isActive = privateTalkTarget === p.userId;
                                    const targetId = isActive ? null : p.userId;
                                    setPrivateTalkTarget(targetId);

                                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                                      wsRef.current.send(JSON.stringify({
                                        type: 'commandant-private-speak',
                                        active: !isActive,
                                        target: p.userId
                                      }));
                                    }

                                    if (!isActive) {
                                      toast.success(`Speaking privately to ${p.name}`);
                                    } else {
                                      toast.success("Returned to public speaking mode");
                                    }
                                  }}
                                  title="Talk privately"
                                  className={`p-1 rounded transition ${
                                    privateTalkTarget === p.userId 
                                      ? 'bg-yellow-500/20 text-yellow-400' 
                                      : 'hover:bg-white/5 text-slate-400'
                                  }`}
                                >
                                  <Mic className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUserId(p.userId);
                                    toast.success(`Now editing ${p.name}'s code`);
                                    setShowMobileSidebar(false);
                                  }}
                                  title="Edit code"
                                  className={`p-1 rounded transition ${
                                    editingUserId === p.userId 
                                      ? 'bg-purple-500/20 text-purple-400' 
                                      : 'hover:bg-white/5 text-slate-400'
                                  }`}
                                >
                                  <FileCode className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (pinnedCadetId1 === p.userId) setPinnedCadetId1(null);
                                    else if (pinnedCadetId2 === p.userId) setPinnedCadetId2(null);
                                    else if (!pinnedCadetId1) setPinnedCadetId1(p.userId);
                                    else setPinnedCadetId2(p.userId);
                                  }}
                                  title="Pin stream"
                                  className={`p-1 rounded transition ${
                                    pinnedCadetId1 === p.userId || pinnedCadetId2 === p.userId 
                                      ? 'bg-emerald-500/20 text-emerald-400' 
                                      : 'hover:bg-white/5 text-slate-400'
                                  }`}
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveCadet(p.userId)}
                                  title="Kick student"
                                  className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
