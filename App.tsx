
import React, { useState, useRef, useEffect } from 'react';
import { 
  Layout, Upload, Code, Eye, RefreshCcw, Send, 
  AlertCircle, CheckCircle2, FileJson, Palette,
  MousePointer2, Sparkles, Layers, Wand2, Camera, X, Check,
  ChevronDown, Copy, ExternalLink, Moon, Sun, Zap, Droplets, Menu
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
    <div className={`h-screen flex flex-col font-sans transition-colors duration-500 overflow-hidden ${currentTheme.bg} text-slate-200 selection:bg-indigo-500/30`}>
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse ${theme === 'midnight' ? 'bg-indigo-500/20' : theme === 'emerald' ? 'bg-emerald-500/20' : theme === 'rose' ? 'bg-rose-500/20' : 'bg-amber-500/20'}`} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse delay-700 bg-slate-800/10" />
      </div>

      <header className="h-16 flex items-center justify-between px-8 border-b backdrop-blur-3xl z-50 bg-slate-900/40 border-white/5 text-white">
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-xl transition-all ${currentTheme.primary} ${currentTheme.shadow}`}>
                <Sparkles size={20} className="animate-pulse text-white" />
             </div>
             <div className="flex flex-col">
               <h1 className="text-sm font-black tracking-[0.2em] uppercase">CODECANVAS<span className="opacity-50 font-light">.STUDIO</span></h1>
               <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500">Visual Synthesis Engine</span>
             </div>
          </div>
          
          <div className="h-8 w-px bg-white/10" />

          <div className="relative">
            <button 
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all bg-white/5 border-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
            >
              <Palette size={14} className={currentTheme.text} />
              <span>{theme}</span>
              <ChevronDown size={12} className={`transition-transform duration-300 ${showThemeMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showThemeMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 p-2 rounded-2xl border backdrop-blur-3xl bg-slate-900/95 border-white/10 shadow-2xl animate-in zoom-in-95 fade-in duration-200 z-[100]">
                <ThemeOption active={theme === 'midnight'} onClick={() => { setTheme('midnight'); setShowThemeMenu(false); }} icon={<Moon size={14} />} label="Midnight" color="bg-indigo-500" />
                <ThemeOption active={theme === 'emerald'} onClick={() => { setTheme('emerald'); setShowThemeMenu(false); }} icon={<Droplets size={14} />} label="Emerald" color="bg-emerald-500" />
                <ThemeOption active={theme === 'cyberpunk'} onClick={() => { setTheme('cyberpunk'); setShowThemeMenu(false); }} icon={<Zap size={14} />} label="Cyberpunk" color="bg-amber-500" />
                <ThemeOption active={theme === 'rose'} onClick={() => { setTheme('rose'); setShowThemeMenu(false); }} icon={<Sun size={14} />} label="Rose" color="bg-rose-500" />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-full border transition-colors bg-white/5 border-white/10">
             <div className="flex flex-col items-end">
               <span className="text-[8px] uppercase tracking-widest font-black text-slate-500">Engine_Clock</span>
               <span className={`text-[10px] font-mono font-bold ${currentTheme.text}`}>0.2ms Latency</span>
             </div>
             <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${theme === 'midnight' ? 'bg-indigo-400' : theme === 'emerald' ? 'bg-emerald-400' : theme === 'rose' ? 'bg-rose-400' : 'bg-amber-400'}`} />
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={status === AppStatus.ANALYZING}
            className={`
              px-8 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] flex items-center gap-3 transition-all
              ${status === AppStatus.ANALYZING 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-white/5' 
                : `${currentTheme.primary} text-white hover:brightness-110 hover:scale-105 active:scale-95 shadow-2xl ${currentTheme.shadow} border ${currentTheme.border}`
              }
            `}
          >
            <Wand2 size={14} />
            {status === AppStatus.ANALYZING ? 'Synthesizing...' : 'Build Application'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 lg:p-6 gap-6">
        <section className="flex-[65] flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center p-1 rounded-xl border transition-all bg-slate-900/60 border-white/5 backdrop-blur-xl gap-1">
              <button 
                onClick={() => whiteboardRef.current?.toggleSidebar()}
                className="p-2.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors flex items-center justify-center"
                title="Toggle Menu"
              >
                <Menu size={16} />
              </button>
              
              <div className="w-px h-5 bg-white/10 mx-1" />

              <ModeToggle themeClass={currentTheme.primary} active={inputMode === 'draw'} onClick={() => { setInputMode('draw'); stopCamera(); }} icon={<MousePointer2 size={14}/>} label="Canvas" />
              <ModeToggle themeClass={currentTheme.primary} active={inputMode === 'camera'} onClick={startCamera} icon={<Camera size={14}/>} label="Lens" />
              <ModeToggle themeClass={currentTheme.primary} active={inputMode === 'upload'} onClick={() => { setInputMode('upload'); stopCamera(); }} icon={<Upload size={14}/>} label="Assets" />
            </div>

            {status === AppStatus.COMPLETED && (
              <button 
                onClick={reset} 
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl border transition-all bg-white/5 border-white/5 hover:text-white hover:bg-white/10"
              >
                <RefreshCcw size={14} />
                New Build
              </button>
            )}
          </div>

          <div className="flex-1 relative flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
            <div className={`flex-1 transition-all duration-500 ${inputMode === 'draw' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute inset-0'}`}>
               <Whiteboard ref={whiteboardRef} onCapture={() => {}} />
            </div>

            <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-500 ${inputMode === 'camera' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none absolute inset-0'}`}>
              {showCamera ? (
                <div className="relative w-full h-full flex flex-col">
                  <video ref={videoRef} autoPlay playsInline className="flex-1 w-full object-cover grayscale brightness-90 transition-all duration-700" />
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-8 z-20">
                    <button onClick={stopCamera} className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all bg-rose-500 text-white hover:bg-rose-400"><X size={24}/></button>
                    <button onClick={takePhoto} className={`w-24 h-24 rounded-full shadow-2xl hover:scale-105 active:scale-90 transition-all border-[8px] bg-white ${currentTheme.border}`} />
                    <div className="w-14 h-14" />
                  </div>
                </div>
              ) : capturedImage ? (
                <div className="p-12 h-full w-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95">
                   <img src={capturedImage} alt="Captured" className="max-h-[75%] rounded-2xl shadow-2xl border border-white/10 object-contain" />
                   <div className="mt-8 flex gap-4">
                     <button onClick={startCamera} className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 border border-white/10 hover:bg-white/10">Retake Frame</button>
                     <button onClick={() => setInputMode('draw')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${currentTheme.primary} text-white ${currentTheme.shadow}`}>Confirm Design</button>
                   </div>
                </div>
              ) : (
                <button onClick={startCamera} className="group p-20 text-center">
                   <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 transition-all group-hover:scale-110 group-hover:rotate-6 border bg-white/5 border-white/10 shadow-lg`}>
                     <Camera className={`w-12 h-12 ${currentTheme.text}`} />
                   </div>
                   <h3 className="text-2xl font-black mb-3 text-white tracking-tight">Lens Interface</h3>
                   <p className="text-slate-500 text-xs font-medium max-w-[200px] mx-auto leading-relaxed">Activate optical sensor to scan physical UI wireframes</p>
                </button>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-500 ${inputMode === 'upload' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none absolute inset-0'}`}>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-8 group"
              >
                {uploadedImage ? (
                  <div className="relative group/img overflow-hidden rounded-2xl shadow-2xl border border-white/5">
                    <img src={uploadedImage} alt="Uploaded" className="max-h-[420px] transition-all duration-500 group-hover/img:scale-105 group-hover/img:brightness-50" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                       <span className="text-[10px] font-black uppercase tracking-widest px-6 py-2.5 rounded-full shadow-2xl bg-white text-slate-950">Update Source</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-8">
                    <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center mx-auto transition-all group-hover:scale-110 group-hover:-rotate-3 border bg-white/5 border-white/10 shadow-lg`}>
                      <Upload className={`w-12 h-12 ${currentTheme.text}`} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-black text-white tracking-tight">Import Asset</p>
                      <p className="text-slate-500 text-xs font-medium tracking-tight">High-fidelity PNG, JPG, or WEBP UI assets</p>
                    </div>
                    <div className="flex justify-center gap-3">
                      <AssetTag>Wireframe</AssetTag>
                      <AssetTag>Screenshot</AssetTag>
                      <AssetTag>Doodle</AssetTag>
                    </div>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>

            {error && (
              <div className="absolute bottom-8 left-8 right-8 p-5 bg-rose-500/10 border border-rose-500/20 backdrop-blur-2xl rounded-2xl flex items-center gap-4 text-rose-500 animate-in fade-in slide-in-from-bottom-8 z-[60] shadow-2xl shadow-rose-950/20">
                <div className="bg-rose-500 p-2 rounded-lg shadow-lg"><AlertCircle size={20} className="text-white" /></div>
                <div className="flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">System Exception</p>
                  <p className="text-xs font-bold leading-relaxed">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="p-2 rounded-lg transition-colors hover:bg-white/5"><X size={16}/></button>
              </div>
            )}
          </div>
        </section>

        <section className="flex-[35] flex flex-col gap-4 min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
            <div className="flex p-1.5 border-b transition-colors bg-black/20 border-white/5">
              <TabButton themeClass={currentTheme.text} active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<Layers size={14} />} label="Diagnostics" />
              <TabButton themeClass={currentTheme.text} active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Eye size={14} />} label="Live View" />
              <TabButton themeClass={currentTheme.text} active={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<Code size={14} />} label="Engine Output" />
            </div>

            <div className="flex-1 overflow-hidden relative">
              {!result ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-16 text-center opacity-30">
                  <div className="w-20 h-20 border-2 border-dashed rounded-[2rem] flex items-center justify-center mb-8 border-slate-700">
                    <Layout className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 text-slate-500">Kernel Standby</h3>
                  <p className="text-[11px] text-slate-600 max-w-[220px] leading-loose">Waiting for visual input to initialize synthesis sequence.</p>
                </div>
              ) : (
                <div className="h-full animate-in fade-in slide-in-from-right-4 duration-700 flex flex-col">
                  {activeTab === 'analysis' && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-12">
                      <div className="space-y-6">
                        <label className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${currentTheme.text}`}>
                           <div className={`w-5 h-px ${theme === 'midnight' ? 'bg-indigo-400/30' : theme === 'emerald' ? 'bg-emerald-400/30' : theme === 'rose' ? 'bg-rose-400/30' : 'bg-amber-400/30'}`} /> UI Archetype
                        </label>
                        <div className="grid grid-cols-1 gap-4">
                          <DataCard label="Structure" value={result.analysis.uiType} />
                          <DataCard label="Layout Type" value={result.analysis.layout} />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <label className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${currentTheme.text}`}>
                           <div className={`w-5 h-px ${theme === 'midnight' ? 'bg-indigo-400/30' : theme === 'emerald' ? 'bg-emerald-400/30' : theme === 'rose' ? 'bg-rose-400/30' : 'bg-amber-400/30'}`} /> Node Graph
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {result.analysis.components.map((comp, i) => (
                            <span key={i} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] border transition-colors bg-white/5 border-white/10 ${currentTheme.text}`}>
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <label className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${currentTheme.text}`}>
                           <div className={`w-5 h-px ${theme === 'midnight' ? 'bg-indigo-400/30' : theme === 'emerald' ? 'bg-emerald-400/30' : theme === 'rose' ? 'bg-rose-400/30' : 'bg-amber-400/30'}`} /> Design Tokens
                        </label>
                        <div className="p-5 rounded-2xl border font-mono text-[10px] leading-[1.8] transition-colors bg-slate-950/50 border-white/5 text-slate-400">
                           {result.analysis.colors}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'code' && (
                    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/40">
                         <div className="flex items-center gap-3">
                            <FileJson className={currentTheme.text} size={16} />
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Standalone Manifest</span>
                         </div>
                         <button 
                          onClick={copyCode}
                          className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all bg-white/5 border-white/10 hover:bg-white/10 text-white"
                        >
                          <Copy size={12} />
                          Copy Build
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-950">
                        <pre className={`p-6 font-mono text-[11px] leading-[1.6] whitespace-pre ${theme === 'midnight' ? 'text-indigo-300/80' : theme === 'emerald' ? 'text-emerald-300/80' : theme === 'rose' ? 'text-rose-300/80' : 'text-amber-300/80'}`}>
                          {result.htmlCode}
                        </pre>
                      </div>
                    </div>
                  )}

                  {activeTab === 'preview' && (
                    <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                               <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                               <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                               <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 font-mono ml-4 truncate max-w-[150px]">production-v1.local</span>
                         </div>
                         <button 
                          onClick={openPreviewInNewTab}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                          title="Open in new tab"
                         >
                            <ExternalLink size={14} />
                         </button>
                      </div>
                      <iframe
                        srcDoc={result.htmlCode}
                        title="Live Preview"
                        className="flex-1 w-full border-0"
                        sandbox="allow-scripts allow-modals allow-same-origin"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {status === AppStatus.ANALYZING && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-700 bg-slate-950/95 backdrop-blur-3xl">
          <div className="text-center space-y-12 max-w-lg px-12">
            <div className="relative inline-flex items-center justify-center">
              <div className={`w-40 h-40 border-[4px] rounded-full animate-spin transition-colors border-white/5 ${theme === 'midnight' ? 'border-t-indigo-500' : theme === 'emerald' ? 'border-t-emerald-500' : theme === 'rose' ? 'border-t-rose-500' : 'border-t-amber-500'}`}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className={`w-12 h-12 animate-pulse ${currentTheme.text}`} />
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-3xl font-black tracking-tight uppercase transition-colors text-white">Synthesizing Vision</h3>
              <div className="h-1 w-64 mx-auto rounded-full overflow-hidden transition-colors bg-slate-900 border border-white/5">
                <div className={`h-full animate-[loading_2s_ease-in-out_infinite] ${currentTheme.primary} shadow-[0_0_15px_rgba(99,102,241,0.5)]`} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.4em] leading-relaxed text-slate-500">
                Generating Pixel-Perfect Architecture
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ModeToggle = ({ active, onClick, icon, label, themeClass }: any) => (
  <button
    onClick={onClick}
    className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${
      active 
        ? `${themeClass} text-white shadow-xl border border-white/10 scale-105` 
        : 'text-slate-500 hover:text-slate-400 hover:bg-white/5'
    }`}
  >
    {icon}
    <span className="hidden lg:inline">{label}</span>
  </button>
);

const TabButton = ({ active, onClick, icon, label, themeClass }: any) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
      active 
        ? `bg-white/5 ${themeClass} border border-white/5` 
        : 'text-slate-500 hover:text-slate-300'
    }`}
  >
    {icon}
    <span className="hidden xl:inline">{label}</span>
  </button>
);

const ThemeOption = ({ active, onClick, icon, label, color }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${active ? 'bg-white/10' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}
  >
    <div className={`w-6 h-6 rounded-lg ${color} flex items-center justify-center shadow-lg`}>
      <div className="text-white scale-75">{icon}</div>
    </div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const DataCard = ({ label, value }: any) => (
  <div className="p-4 rounded-xl border transition-all group bg-slate-950/50 border-white/5 hover:border-white/10">
    <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5 transition-colors text-slate-600">{label}</label>
    <p className="text-xs font-black uppercase tracking-tight text-slate-200">{value}</p>
  </div>
);

const AssetTag = ({ children }: any) => (
  <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border bg-white/5 border-white/10 text-slate-600">
    {children}
  </span>
);
