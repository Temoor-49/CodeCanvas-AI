
import React, { useState, useRef, useEffect } from 'react';
import { 
  Layout, Upload, Code, Eye, RefreshCcw, Send, 
  AlertCircle, CheckCircle2, FileJson, Palette,
  MousePointer2, Sparkles, Layers, Wand2, Camera, X, Check,
  ChevronDown, Copy, ExternalLink, Moon, Sun, Zap, Droplets, Menu,
  Terminal, Monitor, Box, Rocket
} from 'lucide-react';
import { transformSketchToCode } from './services/gemini';
import { AppStatus, TransformationResult } from './types';
import Whiteboard, { WhiteboardHandle } from './Whiteboard';

type AppTheme = 'midnight' | 'emerald' | 'cyberpunk' | 'rose';

const THEME_CONFIG = {
  midnight: {
    accent: 'indigo',
    bg: 'bg-slate-950',
    primary: 'bg-indigo-600',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    shadow: 'shadow-indigo-600/30'
  },
  emerald: {
    accent: 'emerald',
    bg: 'bg-slate-950',
    primary: 'bg-emerald-600',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    shadow: 'shadow-emerald-600/30'
  },
  cyberpunk: {
    accent: 'amber',
    bg: 'bg-zinc-950',
    primary: 'bg-amber-500',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    shadow: 'shadow-amber-500/30'
  },
  rose: {
    accent: 'rose',
    bg: 'bg-slate-950',
    primary: 'bg-rose-600',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    shadow: 'shadow-rose-600/30'
  }
};

export default function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransformationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'preview' | 'analysis'>('analysis');
  const [inputMode, setInputMode] = useState<'draw' | 'upload' | 'camera'>('draw');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>('midnight');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  
  const currentTheme = THEME_CONFIG[theme];

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    setShowCamera(true);
    setInputMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Failed to access camera. Please check permissions.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const data = canvas.toDataURL('image/png');
      setCapturedImage(data);
      stopCamera();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setStatus(AppStatus.IDLE);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setStatus(AppStatus.ANALYZING);
    setError(null);
    
    try {
      let imageData: string;
      if (inputMode === 'draw') {
        imageData = whiteboardRef.current?.getCanvasData() || '';
      } else if (inputMode === 'camera') {
        imageData = capturedImage || '';
      } else {
        imageData = uploadedImage || '';
      }

      if (!imageData || imageData.length < 100) {
        throw new Error("Missing input. Please draw, snap, or upload your UI design.");
      }

      const base64Data = imageData.split(',')[1];
      const data = await transformSketchToCode(base64Data);
      setResult(data);
      setStatus(AppStatus.COMPLETED);
      setActiveTab('preview');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Transformation failed. Check your connection or sketch clarity.');
      setStatus(AppStatus.ERROR);
    }
  };

  const reset = () => {
    setUploadedImage(null);
    setCapturedImage(null);
    setResult(null);
    setStatus(AppStatus.IDLE);
    setError(null);
    whiteboardRef.current?.clear();
  };

  const copyCode = () => {
    if (result) {
      navigator.clipboard.writeText(result.htmlCode);
    }
  };

  const openPreviewInNewTab = () => {
    if (result) {
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(result.htmlCode);
        newTab.document.close();
      }
    }
  };

  return (
    <div className={`h-screen flex flex-col font-sans transition-all duration-700 overflow-hidden ${currentTheme.bg} text-slate-200 selection:bg-indigo-500/30`}>
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-3xl z-50">
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-3 group cursor-pointer">
             <div className={`p-2 rounded-xl transition-all duration-500 group-hover:rotate-12 ${currentTheme.primary} ${currentTheme.shadow}`}>
                <Sparkles size={16} className="text-white" />
             </div>
             <div className="flex flex-col">
               <h1 className="text-xs font-black tracking-[0.25em] uppercase text-white">CODECANVAS<span className="opacity-30 font-medium">.STUDIO</span></h1>
               <span className="text-[7px] font-bold tracking-[0.3em] uppercase text-slate-500">Visual synthesis protocol v4.2</span>
             </div>
          </div>
          
          <div className="h-6 w-px bg-white/10" />

          <div className="relative">
            <button 
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white"
            >
              <Palette size={12} className={currentTheme.text} />
              <span>{theme}</span>
            </button>
            
            {showThemeMenu && (
              <div className="absolute top-full left-0 mt-2 w-56 p-2 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-3xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 z-[100]">
                <ThemeOption active={theme === 'midnight'} onClick={() => { setTheme('midnight'); setShowThemeMenu(false); }} icon={<Moon size={14} />} label="Midnight" color="bg-indigo-500" />
                <ThemeOption active={theme === 'emerald'} onClick={() => { setTheme('emerald'); setShowThemeMenu(false); }} icon={<Droplets size={14} />} label="Emerald" color="bg-emerald-500" />
                <ThemeOption active={theme === 'cyberpunk'} onClick={() => { setTheme('cyberpunk'); setShowThemeMenu(false); }} icon={<Zap size={14} />} label="Cyberpunk" color="bg-amber-500" />
                <ThemeOption active={theme === 'rose'} onClick={() => { setTheme('rose'); setShowThemeMenu(false); }} icon={<Sun size={14} />} label="Rose" color="bg-rose-500" />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-800/30 border border-white/5">
             <div className="flex flex-col items-end">
               <span className="text-[7px] font-black tracking-widest text-slate-500 uppercase">Core Status</span>
               <span className="text-[9px] font-mono font-bold text-emerald-400">READY</span>
             </div>
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <button
            onClick={handleGenerate}
            disabled={status === AppStatus.ANALYZING}
            className={`
              px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all
              ${status === AppStatus.ANALYZING 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-white/5' 
                : `${currentTheme.primary} text-white hover:brightness-110 hover:scale-[1.02] shadow-2xl ${currentTheme.shadow} border ${currentTheme.border}`
              }
            `}
          >
            <Wand2 size={12} />
            {status === AppStatus.ANALYZING ? 'Processing...' : 'Build Protocol'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-2 gap-2 bg-black/10">
        {/* Left: Input Interface (65%) */}
        <section className="flex-[65] flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-900/60 border border-white/5 backdrop-blur-xl shadow-lg gap-1">
              <button 
                onClick={() => whiteboardRef.current?.toggleSidebar()}
                className="p-2.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Library"
              >
                <Menu size={16} />
              </button>
              <div className="w-px h-5 bg-white/10 mx-1" />
              <ModeToggle themeClass={currentTheme.primary} active={inputMode === 'draw'} onClick={() => { setInputMode('draw'); stopCamera(); }} icon={<MousePointer2 size={14}/>} label="Studio Canvas" />
              <ModeToggle themeClass={currentTheme.primary} active={inputMode === 'camera'} onClick={startCamera} icon={<Camera size={14}/>} label="Optical Scan" />
              <ModeToggle themeClass={currentTheme.primary} active={inputMode === 'upload'} onClick={() => { setInputMode('upload'); stopCamera(); }} icon={<Upload size={14}/>} label="Asset Import" />
            </div>

            {status === AppStatus.COMPLETED && (
              <button 
                onClick={reset} 
                className="flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                <RefreshCcw size={12} />
                Clear Workspace
              </button>
            )}
          </div>

          <div className="flex-1 relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/20 backdrop-blur-md shadow-2xl">
            <div className={`flex-1 transition-all duration-500 ${inputMode === 'draw' ? 'opacity-100 scale-100' : 'opacity-0 scale-98 pointer-events-none absolute inset-0'}`}>
               <Whiteboard ref={whiteboardRef} onCapture={() => {}} />
            </div>

            <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-500 ${inputMode === 'camera' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none absolute inset-0'}`}>
              {showCamera ? (
                <div className="relative w-full h-full flex flex-col overflow-hidden">
                  <div className="absolute inset-0 z-10 scanning-line opacity-50"></div>
                  <video ref={videoRef} autoPlay playsInline className="flex-1 w-full object-cover grayscale brightness-110 contrast-125 transition-all" />
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8 z-20">
                    <button onClick={stopCamera} className="w-12 h-12 rounded-full flex items-center justify-center bg-rose-500 text-white shadow-xl hover:scale-105 transition-transform"><X size={20}/></button>
                    <button onClick={takePhoto} className={`w-20 h-20 rounded-full border-[8px] bg-white shadow-2xl hover:scale-105 active:scale-90 transition-all ${currentTheme.border}`} />
                    <div className="w-12" />
                  </div>
                </div>
              ) : capturedImage ? (
                <div className="p-10 h-full w-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95">
                   <img src={capturedImage} alt="Captured" className="max-h-[75%] rounded-2xl shadow-2xl border border-white/10 object-contain ring-1 ring-white/10" />
                   <div className="mt-8 flex gap-4">
                     <button onClick={startCamera} className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all">Retry Frame</button>
                     <button onClick={() => setInputMode('draw')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all ${currentTheme.primary} text-white`}>Accept Protocol</button>
                   </div>
                </div>
              ) : (
                <div className="text-center group">
                   <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 border border-white/5 bg-slate-900/50`}>
                     <Camera className={`w-10 h-10 ${currentTheme.text} opacity-50 group-hover:opacity-100 transition-opacity`} />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 group-hover:text-slate-400 transition-colors">Optical sensor standby</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-500 ${inputMode === 'upload' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none absolute inset-0'}`}>
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-8 group">
                {uploadedImage ? (
                  <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/10">
                    <img src={uploadedImage} alt="Uploaded" className="max-h-[400px] transition-all group-hover:scale-105 duration-700" />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <span className="px-5 py-2 rounded-lg bg-white text-slate-950 text-[10px] font-black uppercase tracking-widest">Update Asset</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 border border-white/5 bg-slate-900/50`}>
                      <Upload className={`w-10 h-10 ${currentTheme.text} opacity-50 group-hover:opacity-100 transition-opacity`} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600">Asset injection portal</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>

            {error && (
              <div className="absolute bottom-6 left-6 right-6 p-4 bg-rose-500/10 border border-rose-500/20 backdrop-blur-3xl rounded-xl flex items-center gap-4 text-rose-500 z-[60] animate-in slide-in-from-bottom-4">
                <div className="p-2 rounded-lg bg-rose-500 text-white shadow-lg"><AlertCircle size={18} /></div>
                <div className="flex-1">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-60">System Malfunction</p>
                  <p className="text-[11px] font-bold">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="p-2 hover:bg-white/5 rounded-lg"><X size={14}/></button>
              </div>
            )}
          </div>
        </section>

        {/* Right: Output Interface (35%) */}
        <section className="flex-[35] flex flex-col gap-2 min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur-xl shadow-2xl">
            <div className="flex p-1 border-b border-white/5 bg-black/40">
              <TabButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<Layers size={14} />} label="DIAGNOSTICS" />
              <TabButton active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Eye size={14} />} label="LIVE VIEW" />
              <TabButton active={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<Code size={14} />} label="CODEGEN" />
            </div>

            <div className="flex-1 overflow-hidden relative">
              {!result ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-30">
                  <Box className="w-12 h-12 text-slate-700 mb-6 animate-pulse" />
                  <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 mb-2">Interface Engine</h3>
                  <p className="text-[10px] font-medium text-slate-700">Awaiting visual synchronization</p>
                </div>
              ) : (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                  {activeTab === 'analysis' && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                        <AnalysisBlock label="System Archetype" value={result.analysis.uiType} themeClass={currentTheme.text} />
                        <AnalysisBlock label="Spatial Layout" value={result.analysis.layout} themeClass={currentTheme.text} />
                      </div>
                      <div className="space-y-3">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 block flex items-center gap-2">
                           <Monitor size={10} /> Neural Map (Nodes)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {result.analysis.components.map((c, i) => (
                            <span key={i} className="px-2 py-1 rounded-md text-[8px] font-black border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 transition-colors uppercase tracking-widest">{c}</span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 block flex items-center gap-2">
                           <Terminal size={10} /> Style Primitives
                        </span>
                        <div className="p-4 rounded-xl border border-white/5 bg-black/40 font-mono text-[9px] leading-relaxed text-slate-500 italic">
                           {result.analysis.colors}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'code' && (
                    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-slate-900/60">
                         <div className="flex items-center gap-2">
                            <FileJson size={12} className={currentTheme.text} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">manifest.json</span>
                         </div>
                         <button onClick={copyCode} className="px-3 py-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all flex items-center gap-1.5 text-[10px] font-bold">
                            <Copy size={12} /> Copy
                         </button>
                      </div>
                      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-950">
                        <pre className="p-5 font-mono text-[10px] leading-relaxed text-indigo-300/60 whitespace-pre">
                          {result.htmlCode}
                        </pre>
                      </div>
                    </div>
                  )}

                  {activeTab === 'preview' && (
                    <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
                      <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
                         <div className="flex gap-1.5">
                           <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                           <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                           <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                         </div>
                         <div className="flex-1 mx-4 h-5 bg-white rounded border border-slate-200 flex items-center px-3">
                            <span className="text-[8px] font-mono text-slate-400">localhost:3000/render/v1</span>
                         </div>
                      </div>
                      <iframe srcDoc={result.htmlCode} title="Preview" className="flex-1 w-full border-0" sandbox="allow-scripts allow-modals allow-same-origin" />
                      <button onClick={openPreviewInNewTab} className="absolute bottom-6 right-6 p-3 bg-indigo-600 text-white rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all">
                        <ExternalLink size={16}/>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {status === AppStatus.ANALYZING && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl">
          <div className="text-center space-y-10 max-w-sm px-10">
            <div className="relative inline-flex items-center justify-center">
              <div className={`w-32 h-32 border-[2px] rounded-full animate-[spin_3s_linear_infinite] border-white/5 ${theme === 'midnight' ? 'border-t-indigo-500' : 'border-t-emerald-500'}`}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Rocket className={`w-10 h-10 animate-pulse ${currentTheme.text}`} />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-black tracking-[0.2em] uppercase text-white">Synthesizing Core</h3>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 leading-relaxed">Deconstructing visual primitives and remapping to neural component graph...</p>
            </div>
            <div className="w-48 h-1 mx-auto bg-slate-900 rounded-full overflow-hidden border border-white/5">
               <div className={`h-full animate-[loading_2s_infinite] ${currentTheme.primary}`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ModeToggle = ({ active, onClick, icon, label, themeClass }: any) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all duration-300 ${active ? `${themeClass} text-white shadow-xl scale-105` : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
    {icon} <span>{label}</span>
  </button>
);

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2.5 transition-all ${active ? 'bg-white/5 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-600 hover:text-slate-400'}`}>
    {icon} <span>{label}</span>
  </button>
);

const ThemeOption = ({ active, onClick, icon, label, color }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${active ? 'bg-white/10' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}>
    <div className={`w-6 h-6 rounded-lg ${color} flex items-center justify-center shadow-lg text-white scale-75`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const AnalysisBlock = ({ label, value, themeClass }: any) => (
  <div className="p-4 rounded-xl border border-white/5 bg-black/20 space-y-1.5 group hover:border-white/10 transition-colors">
    <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 block">{label}</span>
    <p className={`text-[11px] font-black uppercase tracking-tight text-white ${themeClass}`}>{value}</p>
  </div>
);
