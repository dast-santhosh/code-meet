import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, FolderOpen, Trash2, Plus, Terminal, RefreshCw, 
  HelpCircle, FileCode, Check, BookOpen, Settings, Layout, Download, ChevronRight, X
} from 'lucide-react';
import CodeEditor from '../components/CodeEditor';
import useAppStore from '../store';
import toast from 'react-hot-toast';

export default function MobileIDE() {
  // App store theme configs
  const { 
    editorTheme, setEditorTheme, editorFontSize, setEditorFontSize,
    editorFontFamily, setEditorFontFamily 
  } = useAppStore();

  // Component states
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem('devshaala_ide_files');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading saved files:", e);
      }
    }
    return {
      'main.py': "# Standalone Python IDE\nimport numpy as np\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\nprint('Welcome to DevShaala Mobile IDE!')\nprint('Pandas version:', pd.__version__)\n\n# 1. Print arithmetic computations\na = np.array([10, 20, 30])\nprint('Vector Sum:', a.sum())\n\n# 2. Read from CSV file in explorer\ntry:\n    df = pd.read_csv('dataset.csv')\n    print('\\nLoaded CSV Dataset:\\n', df)\nexcept Exception as e:\n    print('CSV Error:', e)\n\n# 3. Render a Matplotlib line graph\nplt.figure(figsize=(6, 4))\nplt.plot([1, 2, 3, 4], [10, 25, 12, 40], marker='o', color='#10b981')\nplt.title('Sample Growth Plot')\nplt.grid(True)\nplt.show()\n",
      'dataset.csv': "id,month,revenue\n1,Jan,45000\n2,Feb,61000\n3,Mar,72000\n4,Apr,90000\n",
      'readme.md': "# DevShaala Mobile Python IDE\n\nRun full Python modules inside your browser sandboxed environment using WebAssembly (Pyodide WASM).\n\n### Scientific Packages Included:\n- NumPy\n- Pandas\n- Matplotlib (canvas outputs render in the Output tab)\n\n### File System:\nFeel free to add `.csv`, `.txt`, `.py`, or `.md` files. You can load and read files inside Python scripts using operations like `open()` or `pd.read_csv('filename')`!\n"
    };
  });

  const [activeFile, setActiveFile] = useState(() => {
    const saved = localStorage.getItem('devshaala_ide_active_file');
    return saved && files[saved] ? saved : 'main.py';
  });

  const [newFileName, setNewFileName] = useState('');
  const [showNewFileForm, setShowNewFileForm] = useState(false);
  const [fileExtension, setFileType] = useState('.py');
  
  // Execution states
  const [pyodideLoaded, setPyodideLoaded] = useState(false);
  const [pyodideLoadingProgress, setPyodideLoadingProgress] = useState('Initializing DevShaala Python engine (WASM)...');
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [matplotlibPlot, setMatplotlibPlot] = useState(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [terminalInputVal, setTerminalInputVal] = useState('');
  const workerRef = useRef(null);

  // Tab View for Mobile screens
  // Options: 'editor', 'explorer', 'console', 'output'
  const [activeMobileTab, setActiveMobileTab] = useState('editor');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSettings, setShowSettings] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Load state and listen to layout shifts
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('devshaala_ide_files', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem('devshaala_ide_active_file', activeFile);
  }, [activeFile]);

  // Boot Pyodide WASM Runtime in a Web Worker on load
  const initWorker = () => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    const backendUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');

    const workerCode = `
      importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

      let pyodideInstance = null;

      self.syncStdout = (text) => {
        postMessage({ type: 'stdout', text });
      };

      async function initPyodide() {
        try {
          pyodideInstance = await loadPyodide();
          await pyodideInstance.loadPackage(['numpy', 'pandas', 'matplotlib']);
          postMessage({ type: 'ready' });
        } catch (e) {
          postMessage({ type: 'error_init', message: e.message });
        }
      }

      onmessage = async (e) => {
        const { type, code, files, activeFile } = e.data;
        if (type === 'init') {
          await initPyodide();
        } else if (type === 'run') {
          if (!pyodideInstance) {
            postMessage({ type: 'error', message: 'Python WASM Engine is not loaded yet.' });
            return;
          }

          try {
            // Write all project files to worker's virtual filesystem
            Object.entries(files).forEach(([name, content]) => {
              pyodideInstance.FS.writeFile(name, content);
            });

            // Set up stdout, stderr redirection and override builtins.input
            pyodideInstance.runPython(\`
import sys
import io
import builtins
import js
import json

sys.stdout = io.StringIO()
sys.stderr = io.StringIO()

def custom_input(prompt_str=""):
    if prompt_str:
        sys.stdout.write(prompt_str)
    sys.stdout.flush()
    if hasattr(js, "syncStdout"):
        js.syncStdout(sys.stdout.getvalue())
    
    # Notify main thread that we are waiting for input
    js.postMessage(js.JSON.parse(json.dumps({"type": "waiting_for_input", "prompt": prompt_str})))

    # Synchronous XHR to block the worker thread and wait for input from FastAPI
    xhr = js.XMLHttpRequest.new()
    xhr.open("GET", "${backendUrl}/api/input/get/${sessionId}", False)
    xhr.send()
    
    if xhr.status == 200:
        res = json.loads(xhr.responseText)
        val = res.get("value", "")
        if val is None:
            raise KeyboardInterrupt("Execution cancelled by user.")
        
        sys.stdout.write(val + "\\\\n")
        sys.stdout.flush()
        if hasattr(js, "syncStdout"):
            js.syncStdout(sys.stdout.getvalue())
        return val
    else:
        raise OSError("Failed to fetch input from backend: " + str(xhr.status))

builtins.input = custom_input
            \`);

            // Run active Python code
            await pyodideInstance.runPythonAsync(code);

            const stdout = pyodideInstance.runPython("sys.stdout.getvalue()");
            const stderr = pyodideInstance.runPython("sys.stderr.getvalue()");

            // Check matplotlib plot
            const hasPlot = pyodideInstance.runPython(\`
import sys
'matplotlib' in sys.modules and len(sys.modules['matplotlib'].pyplot.get_fignums()) > 0
            \`);

            let plotBase64 = null;
            if (hasPlot) {
              plotBase64 = pyodideInstance.runPython(\`
import io, base64
import matplotlib.pyplot as plt
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
img = base64.b64encode(buf.read()).decode('utf-8')
plt.close('all')
img
              \`);
            }

            postMessage({ type: 'complete', stdout, stderr, plotBase64 });
          } catch (err) {
            let stdout = "";
            try {
              stdout = pyodideInstance.runPython("sys.stdout.getvalue()");
            } catch (e) {}
            postMessage({ type: 'error', message: err.message, stdout });
          }
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, text, stdout, stderr, plotBase64, message } = e.data;
      if (type === 'ready') {
        setPyodideLoaded(true);
      } else if (type === 'error_init') {
        setPyodideLoadingProgress(`[Engine Error]: ${message}`);
      } else if (type === 'stdout') {
        setConsoleOutput(text);
        if (window.updateTerminalOutput) {
          window.updateTerminalOutput(text);
        }
      } else if (type === 'waiting_for_input') {
        setIsWaitingForInput(true);
      } else if (type === 'complete') {
        setIsWaitingForInput(false);
        setIsRunning(false);
        
        let output = "";
        if (stdout) output += stdout;
        if (stderr) output += `\n[Runtime Error]:\n${stderr}`;
        if (!stdout && !stderr) output += "Script completed execution with no output logs.";

        setConsoleOutput(output);
        if (window.updateTerminalOutput) {
          window.updateTerminalOutput(output);
        }

        if (plotBase64) {
          setMatplotlibPlot(`data:image/png;base64,${plotBase64}`);
          const finalOutput = output + "\n\n[Matplotlib Plot Generated]: Plotted successfully.";
          setConsoleOutput(finalOutput);
          if (window.updateTerminalOutput) {
            window.updateTerminalOutput(finalOutput);
          }
        }
      } else if (type === 'error') {
        setIsWaitingForInput(false);
        setIsRunning(false);
        
        let errorMsg = "";
        if (stdout) errorMsg += stdout;
        errorMsg += `\n[System Error]:\n${message}`;
        
        setConsoleOutput(errorMsg);
        if (window.updateTerminalOutput) {
          window.updateTerminalOutput(errorMsg);
        }
      }
    };

    worker.postMessage({ type: 'init' });
  };

  useEffect(() => {
    initWorker();
    
    // Set up global terminal updating function
    window.updateTerminalOutput = (text) => {
      const el = document.getElementById('terminal-logs');
      if (el) {
        el.textContent = text;
        el.scrollTop = el.scrollHeight;
      }
      setConsoleOutput(text);
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      delete window.updateTerminalOutput;
    };
  }, []);

  // Run script
  const runPythonCode = async () => {
    if (!pyodideLoaded || isRunning) {
      if (!pyodideLoaded) toast.error("Python engine is still starting up...");
      return;
    }

    if (!isMobile) {
      setIsTerminalOpen(true);
    } else {
      setActiveMobileTab('console');
    }

    setIsRunning(true);
    setIsWaitingForInput(false);
    setConsoleOutput("Executing Python script in DevShaala console...\n");
    setMatplotlibPlot(null);

    // Defer execution slightly to let UI paint before running
    setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'run',
          code: files[activeFile] || "",
          files: files,
          activeFile: activeFile
        });
      } else {
        setIsRunning(false);
        toast.error("Web Worker is not active.");
      }
    }, 100);
  };

  const submitTerminalInput = async () => {
    const val = terminalInputVal;
    setTerminalInputVal('');
    setIsWaitingForInput(false);
    
    // Append the user's input to the logs locally to simulate a real terminal
    const nextLogs = consoleOutput + val + "\n";
    setConsoleOutput(nextLogs);
    const el = document.getElementById('terminal-logs');
    if (el) {
      el.textContent = nextLogs;
      el.scrollTop = el.scrollHeight;
    }

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
      const backendUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      await fetch(`${backendUrl}/api/input/submit/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val })
      });
    } catch (e) {
      toast.error("Failed to submit input: " + e.message);
    }
  };

  const terminateWorker = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    setIsRunning(false);
    setIsWaitingForInput(false);
    initWorker();
    toast.success("Python execution terminated.");
  };

  const handleCloseTerminal = () => {
    setIsTerminalOpen(false);
    if (isRunning) {
      terminateWorker();
    }
  };

  // Create local file in explorer
  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    const fullName = newFileName.trim().replace(/\s+/g, '_') + fileExtension;
    
    if (files[fullName] !== undefined) {
      toast.error("File already exists in workspace");
      return;
    }

    setFiles(prev => ({
      ...prev,
      [fullName]: fullName.endsWith('.py') 
        ? `# ${fullName}\nprint('Hello from ${fullName}!')\n` 
        : fullName.endsWith('.csv') 
        ? 'id,label,value\n1,Alpha,100\n' 
        : fullName.endsWith('.md') 
        ? `# ${fullName}\nWrite notes here...\n` 
        : 'New text file\n'
    }));

    setNewFileName('');
    setShowNewFileForm(false);
    setActiveFile(fullName);
    if (isMobile) {
      setShowMobileSidebar(false);
      setActiveMobileTab('editor');
    }
    toast.success(`Created file: ${fullName}`);
  };

  // Delete file in explorer
  const handleDeleteFile = (fileName) => {
    if (fileName === 'main.py') {
      toast.error("Cannot delete the core main.py file");
      return;
    }
    
    const confirmDelete = window.confirm(`Are you sure you want to delete ${fileName}?`);
    if (!confirmDelete) return;

    setFiles(prev => {
      const copy = { ...prev };
      delete copy[fileName];
      return copy;
    });

    if (activeFile === fileName) {
      setActiveFile('main.py');
    }
    toast.success(`Deleted: ${fileName}`);
  };

  const handleUpdateFileContent = (content) => {
    setFiles(prev => ({
      ...prev,
      [activeFile]: content
    }));
  };

  // File icons helper
  const getFileIcon = (name) => {
    if (name.endsWith('.py')) return <FileCode className="w-4 h-4 text-emerald-400" />;
    if (name.endsWith('.csv')) return <Layout className="w-4 h-4 text-sky-400" />;
    if (name.endsWith('.md')) return <BookOpen className="w-4 h-4 text-purple-400" />;
    return <Terminal className="w-4 h-4 text-slate-400" />;
  };

  // Download code file
  const handleDownloadFile = () => {
    const element = document.createElement("a");
    const file = new Blob([files[activeFile] || ''], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = activeFile;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(`Downloaded: ${activeFile}`);
  };

  // Clear code in active file
  const handleClearActiveFile = () => {
    const confirmClear = window.confirm(`Are you sure you want to clear the content of ${activeFile}?`);
    if (!confirmClear) return;
    setFiles(prev => ({
      ...prev,
      [activeFile]: ""
    }));
    toast.success(`Cleared content of ${activeFile}`);
  };

  // Reset workspace
  const handleResetWorkspace = () => {
    const confirmReset = window.confirm("Are you sure you want to reset all files to defaults?");
    if (!confirmReset) return;
    localStorage.removeItem('devshaala_ide_files');
    localStorage.removeItem('devshaala_ide_active_file');
    window.location.reload();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] text-slate-100 overflow-hidden font-sans select-text">
      
      {/* 1. Header Navigation Bar */}
      <header className="h-[52px] bg-slate-950/80 border-b border-white/5 flex items-center justify-between px-4 z-40 select-none glass-panel shrink-0">
        <div 
          onClick={() => isMobile && setShowMobileSidebar(!showMobileSidebar)}
          className={`flex items-center gap-3 ${isMobile ? 'cursor-pointer active:opacity-75 hover:opacity-90 transition select-none' : ''}`}
        >
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 flex-shrink-0">
            <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="DevShaala" className="h-5 w-auto object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-orbitron font-black text-xs tracking-wider text-emerald-400 flex items-center gap-1">
              DEVSHAALA
              {isMobile && <span className="text-[9px] font-normal text-emerald-500/85 lowercase bg-emerald-500/10 px-1 py-0.5 rounded-md">menu</span>}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Python Mobile IDE</span>
          </div>
        </div>

        {/* Action button triggers */}
        <div className="flex items-center gap-2">
          {/* Status Dot */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-white/5 px-2.5 py-1 rounded-lg text-[9px] text-slate-400 font-bold uppercase font-orbitron">
            <div className={`w-1.5 h-1.5 rounded-full ${pyodideLoaded ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
            {pyodideLoaded ? 'WASM Ready' : 'Loading Engine'}
          </div>

          <button 
            onClick={runPythonCode}
            disabled={!pyodideLoaded || isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase rounded-xl transition glow-accent disabled:opacity-40"
            title="Execute script"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Run</span>
          </button>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-slate-900 border border-white/5 hover:bg-slate-800 rounded-xl transition"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
          
          <button 
            onClick={() => setShowDocumentation(!showDocumentation)}
            className="p-2 bg-slate-900 border border-white/5 hover:bg-slate-800 rounded-xl transition"
            title="Help Docs"
          >
            <BookOpen className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* DESKTOP SPLIT VIEW LAYOUT */}
        {!isMobile ? (
          <>
            {/* Explorer sidebar panel */}
            <aside className="w-[240px] bg-slate-950/20 border-r border-white/5 flex flex-col p-4 z-30 select-none overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FILES EXPLORER</span>
                <button 
                  onClick={() => setShowNewFileForm(!showNewFileForm)}
                  className="p-1 hover:bg-white/5 rounded text-emerald-400"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Create new file form */}
              {showNewFileForm && (
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5 mb-3 flex flex-col gap-2">
                  <div className="flex gap-1 bg-slate-900 rounded-lg p-0.5 border border-white/5">
                    {['.py', '.csv', '.txt', '.md'].map(ext => (
                      <button
                        key={ext}
                        onClick={() => setFileType(ext)}
                        className={`flex-1 text-[10px] font-bold py-1 rounded-md transition ${fileExtension === ext ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                      >
                        {ext}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="filename"
                    className="bg-slate-900 border border-white/5 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                  />
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setShowNewFileForm(false)} className="text-[9px] px-2 py-1 text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={handleCreateFile} className="text-[9px] px-2 py-1 bg-emerald-500 text-slate-950 font-bold rounded">Create</button>
                  </div>
                </div>
              )}

              {/* File list */}
              <div className="space-y-1">
                {Object.keys(files).map((name) => (
                  <div 
                    key={name}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition ${
                      activeFile === name ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <button 
                      onClick={() => setActiveFile(name)}
                      className="flex-1 flex items-center gap-2 text-left truncate text-xs font-medium"
                    >
                      {getFileIcon(name)}
                      <span className="truncate">{name}</span>
                    </button>
                    {name !== 'main.py' && (
                      <button 
                        onClick={() => handleDeleteFile(name)}
                        className="text-slate-500 hover:text-red-400 transition p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom reset actions */}
              <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
                <button 
                  onClick={handleResetWorkspace}
                  className="w-full text-center py-2 bg-slate-900 border border-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-[10px] font-bold text-slate-400 transition"
                >
                  Reset IDE Workspace
                </button>
              </div>
            </aside>

            {/* Editor + Console split layout */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                {/* Active file indicator tabs */}
                <div className="flex items-center justify-between bg-slate-950/40 p-1.5 border border-white/5 rounded-xl mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 px-2.5 truncate">
                    {getFileIcon(activeFile)}
                    <span className="truncate">{activeFile}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleClearActiveFile}
                      className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-red-400 transition"
                      title="Clear program"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleDownloadFile}
                      className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-emerald-400 transition"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 relative overflow-hidden">
                  <CodeEditor
                    value={files[activeFile]}
                    onChange={handleUpdateFileContent}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* MOBILE TABBED VIEW LAYOUT (Mobile screens) */
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Viewport content based on active bottom tab */}
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {activeMobileTab === 'editor' && (
                  <motion.div
                    key="editor"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 p-3"
                  >
                    {/* Active file indicator tabs */}
                    <div className="flex items-center justify-between bg-slate-950/40 p-1 border border-white/5 rounded-xl mb-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 px-2 truncate">
                        {getFileIcon(activeFile)}
                        <span className="truncate">{activeFile}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={handleClearActiveFile}
                          className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-red-400 transition"
                          title="Clear program"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={handleDownloadFile}
                          className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-emerald-400 transition"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="h-[calc(100%-36px)] relative">
                      <CodeEditor
                        value={files[activeFile]}
                        onChange={handleUpdateFileContent}
                      />
                    </div>
                  </motion.div>
                )}

                {activeMobileTab === 'console' && (
                  <motion.div
                    key="console"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-slate-950 flex flex-col"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-slate-950/80">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold font-orbitron tracking-wider text-slate-400">OUTPUT CONSOLE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRunning && (
                          <button 
                            onClick={terminateWorker}
                            className="text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-0.5 rounded border border-red-500/20 font-bold transition"
                          >
                            Stop
                          </button>
                        )}
                        <button 
                          onClick={() => setConsoleOutput('')}
                          className="text-[10px] text-slate-400 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/5"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 p-4 overflow-hidden flex flex-col bg-[#03050a]/90">
                      <pre className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text pr-2 scrollbar-thin scrollbar-thumb-white/10">
                        {!pyodideLoaded ? pyodideLoadingProgress : consoleOutput || "Console is empty. Run your code to display logs."}
                      </pre>
                      
                      {isWaitingForInput && (
                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2 font-mono text-xs select-none animate-fadeIn shrink-0">
                          <span className="text-emerald-400 font-bold shrink-0">&gt;_ INPUT:</span>
                          <input
                            type="text"
                            value={terminalInputVal}
                            onChange={(e) => setTerminalInputVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                submitTerminalInput();
                              }
                            }}
                            autoFocus
                            placeholder="Type response and press Enter..."
                            className="flex-1 bg-transparent border-0 outline-none text-slate-200 caret-emerald-400 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeMobileTab === 'output' && (
                  <motion.div
                    key="output"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-[#0a0a0a] flex flex-col p-4 overflow-y-auto"
                  >
                    <span className="text-[10px] font-bold text-slate-500 mb-3 block">MATPLOTLIB GRAPH CANVAS</span>
                    {matplotlibPlot ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-2 rounded-2xl border border-white/5 bg-slate-950/40">
                        <img src={matplotlibPlot} alt="Plot Output" className="max-w-full rounded-xl border border-white/10 shadow-2xl bg-white p-1" />
                        <span className="text-[10px] text-slate-500 italic mt-3">Visual plots saved dynamically</span>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic text-xs bg-slate-950/20 rounded-2xl border border-dashed border-white/5">
                        No active plots detected. 
                        <div className="text-[10px] text-slate-600 mt-1 not-italic">Run code containing matplotlib.pyplot.show() to render graphs here.</div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Menu Navigation Tabs for mobile screens */}
            <nav className="h-[56px] bg-slate-950 border-t border-white/5 flex items-center justify-around z-30 select-none shrink-0">
              <button 
                onClick={() => setActiveMobileTab('editor')}
                className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
                  activeMobileTab === 'editor' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>Editor</span>
              </button>

              <button 
                onClick={() => setActiveMobileTab('console')}
                className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
                  activeMobileTab === 'console' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Console</span>
              </button>

              <button 
                onClick={() => setActiveMobileTab('output')}
                className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
                  activeMobileTab === 'output' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <Layout className="w-4 h-4" />
                <span>Output {matplotlibPlot && <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />}</span>
              </button>
            </nav>
          </div>
        )}

      </div>

      {/* 3. Settings Drawer overlay */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-sm rounded-3xl border border-white/5 bg-slate-950 p-6 flex flex-col gap-4 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-sm font-black font-orbitron tracking-wider text-emerald-400 uppercase">IDE Settings</h3>
              
              {/* Theme Settings */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Editor Theme</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'vs-dark', label: 'Dark Mode' },
                    { key: 'light', label: 'Light Mode' },
                    { key: 'hc-black', label: 'High Contrast' },
                    { key: 'violet', label: 'Violet theme' }
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setEditorTheme(item.key)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition ${
                        editorTheme === item.key 
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black' 
                          : 'bg-slate-900 border-white/5 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Settings */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Editor Font Size</span>
                <div className="flex items-center justify-between bg-slate-900 border border-white/5 rounded-xl px-4 py-2 text-xs">
                  <button 
                    onClick={() => setEditorFontSize(Math.max(10, editorFontSize - 1))}
                    className="p-1 hover:text-emerald-400 font-black text-sm"
                  >
                    -
                  </button>
                  <span>{editorFontSize}px</span>
                  <button 
                    onClick={() => setEditorFontSize(Math.min(24, editorFontSize + 1))}
                    className="p-1 hover:text-emerald-400 font-black text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Reset Environment */}
              <div className="flex flex-col gap-2 mt-2">
                <button 
                  onClick={() => {
                    handleResetWorkspace();
                    setShowSettings(false);
                  }}
                  className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition border border-red-500/20"
                >
                  Clear all Local Files
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Help Documentation Drawer Overlay */}
      <AnimatePresence>
        {showDocumentation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-md h-[500px] rounded-3xl border border-white/5 bg-slate-950 p-6 flex flex-col shadow-2xl relative"
            >
              <button 
                onClick={() => setShowDocumentation(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-sm font-black font-orbitron tracking-wider text-emerald-400 uppercase mb-4">WASM Scientific Reference</h3>
              
              <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
                {/* Intro */}
                <div className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-white/5">
                  <span className="font-bold text-slate-200">How to use modules:</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    This IDE runs entirely inside WebAssembly sandbox. You can import modules locally, create files, write data, and plot figures. All changes are saved automatically.
                  </p>
                </div>

                {/* Pandas Section */}
                <div className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-white/5">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5" /> Pandas Library
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Read and parse custom csv data files:
                  </p>
                  <pre className="p-2 bg-slate-950 rounded-lg text-[10px] text-slate-300 font-mono">
{`import pandas as pd
df = pd.read_csv('dataset.csv')
print(df.head())`}
                  </pre>
                </div>

                {/* NumPy Section */}
                <div className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-white/5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" /> NumPy Library
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Scientific array computations:
                  </p>
                  <pre className="p-2 bg-slate-950 rounded-lg text-[10px] text-slate-300 font-mono">
{`import numpy as np
a = np.array([[1, 2], [3, 4]])
print('Mean:', np.mean(a))`}
                  </pre>
                </div>

                {/* Matplotlib Section */}
                <div className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-white/5">
                  <span className="font-bold text-purple-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Matplotlib Lineplots
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Draw graphs. Plotted figures render in the output canvas view.
                  </p>
                  <pre className="p-2 bg-slate-950 rounded-lg text-[10px] text-slate-300 font-mono">
{`import matplotlib.pyplot as plt
plt.plot([1, 2, 3], [5, 10, 8])
plt.show()`}
                  </pre>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Popup Terminal Modal */}
      <AnimatePresence>
        {isTerminalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-4xl h-[75vh] min-h-[400px] rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl flex flex-col overflow-hidden relative"
            >
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-white/5 select-none shrink-0">
                {/* Mac style control dots */}
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition cursor-pointer" onClick={handleCloseTerminal} />
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div className="flex items-center gap-2 ml-4">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black font-orbitron tracking-wider text-slate-300 uppercase">Interactive Terminal</span>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-white/5 px-2.5 py-1 rounded-lg text-[9px] text-slate-400 font-bold uppercase font-orbitron">
                    <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    {isRunning ? 'Running' : 'Idle'}
                  </div>

                  <button
                    onClick={() => {
                      setConsoleOutput('');
                      const el = document.getElementById('terminal-logs');
                      if (el) el.textContent = '';
                    }}
                    className="text-[10px] text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-white/5 transition"
                  >
                    Clear Logs
                  </button>

                  <button
                    onClick={handleCloseTerminal}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#03050a]/95">
                {/* Console Logs */}
                <div className="flex-1 p-4 overflow-hidden flex flex-col bg-[#03050a]/30">
                  <pre
                    id="terminal-logs"
                    className="flex-1 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10"
                  >
                    {!pyodideLoaded ? pyodideLoadingProgress : consoleOutput || "Console output idle. Click Run to execute."}
                  </pre>
                  
                  {isWaitingForInput && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2 font-mono text-xs select-none animate-fadeIn shrink-0">
                      <span className="text-emerald-400 font-bold shrink-0">&gt;_ INPUT:</span>
                      <input
                        type="text"
                        value={terminalInputVal}
                        onChange={(e) => setTerminalInputVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            submitTerminalInput();
                          }
                        }}
                        autoFocus
                        placeholder="Type response and press Enter..."
                        className="flex-1 bg-transparent border-0 outline-none text-slate-200 caret-emerald-400 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Plots visualizer pane */}
                {matplotlibPlot && (
                  <div className="w-full md:w-[320px] border-t md:border-t-0 md:border-l border-white/5 bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden shrink-0">
                    <div className="absolute top-2 left-3 text-[9px] font-bold text-slate-500 font-orbitron">MATPLOTLIB OUTPUT</div>
                    <img src={matplotlibPlot} alt="Matplotlib Plot" className="max-w-full max-h-[90%] rounded-xl border border-white/10 shadow-lg object-contain bg-white p-1.5" />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Mobile Explorer Drawer overlay */}
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
              className="relative w-[280px] max-w-[85vw] h-full bg-[#171717] border-r border-white/10 flex flex-col p-4 shadow-2xl z-10 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-0.5">
                    <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="DevShaala" className="h-3.5 w-auto object-contain" />
                  </div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">FILES EXPLORER</span>
                </div>
                <button 
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workspace Files</span>
                <button 
                  onClick={() => setShowNewFileForm(!showNewFileForm)}
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-600 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> File
                </button>
              </div>

              {/* Create file popup in Mobile Sidebar */}
              {showNewFileForm && (
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-emerald-500/20 mb-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-400">Create New File</span>
                    <button onClick={() => setShowNewFileForm(false)} className="text-slate-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex gap-1 bg-slate-900 rounded-lg p-0.5 border border-white/5">
                    {['.py', '.csv', '.txt', '.md'].map(ext => (
                      <button
                        key={ext}
                        onClick={() => setFileType(ext)}
                        className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition ${fileExtension === ext ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                      >
                        {ext}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="file_name"
                    className="bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                  />
                  <button onClick={handleCreateFile} className="w-full py-2 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl">
                    Create File
                  </button>
                </div>
              )}

              {/* File list */}
              <div className="space-y-1 flex-1 overflow-y-auto pr-1">
                {Object.keys(files).map((name) => (
                  <div 
                    key={name}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition ${
                      activeFile === name ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950/20 border-white/5 text-slate-300'
                    }`}
                  >
                    <button 
                      onClick={() => {
                        setActiveFile(name);
                        setShowMobileSidebar(false);
                        setActiveMobileTab('editor'); // Auto swap to editor on selection
                      }}
                      className="flex-1 flex items-center gap-2.5 text-left truncate text-xs font-medium"
                    >
                      {getFileIcon(name)}
                      <span className="truncate">{name}</span>
                    </button>
                    {name !== 'main.py' && (
                      <button 
                        onClick={() => handleDeleteFile(name)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5 flex flex-col gap-2 mt-4">
                <button 
                  onClick={handleResetWorkspace}
                  className="w-full text-center py-2.5 bg-red-500/10 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 transition"
                >
                  Reset Workspace Files
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
