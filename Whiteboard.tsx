
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { 
  Pencil, Eraser, Trash2, Square, Circle, Minus, 
  Undo2, Redo2, Type as TypeIcon, Eye, 
  EyeOff, Settings2, Palette, MousePointer2, PaintBucket,
  ImageIcon, Monitor, Layers as LayersIcon, AlertTriangle, 
  Move, MousePointer, ArrowUpRight, Maximize2, Grab, Menu,
  Copy, Clipboard, Files, Save, Library, History,
  Download, FileImage, FileCode, X, ChevronRight, Settings, Plus,
  Search, Maximize, Hand, Cpu, Grid3X3, CircleDot, Lock, Unlock,
  RotateCw, Hash, MousePointerClick, Spline, Divide
} from 'lucide-react';

interface WhiteboardProps {
  onCapture: (dataUrl: string) => void;
}

export interface WhiteboardHandle {
  getCanvasData: () => string;
  clear: () => void;
  toggleSidebar: () => void;
}

type Tool = 'move' | 'pencil' | 'eraser' | 'rect' | 'roundRect' | 'circle' | 'line' | 'arrow' | 'dashedLine' | 'text' | 'hand';
type Pattern = 'dots' | 'grid' | 'none';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: string;
  tool: Tool;
  points: Point[]; 
  color: string;
  size: number;
  isFilled: boolean;
  isLocked?: boolean;
  rotation?: number; 
  text?: string;
}

const MAX_HISTORY = 50;
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;

const STUDIO_THEME = {
  bg: '#020617',
  accent: '#6366f1',
  gridDots: 'rgba(255, 255, 255, 0.08)'
};

const QUICK_COLORS = ['#6366f1', '#f43f5e', '#10b981'];
const EXTENDED_COLORS = [
  '#ffffff', '#94a3b8', '#475569', '#1e293b', 
  '#f87171', '#ef4444', '#b91c1c', '#7f1d1d',
  '#fbbf24', '#f59e0b', '#d97706', '#92400e',
  '#34d399', '#10b981', '#059669', '#064e3b',
  '#60a5fa', '#3b82f6', '#2563eb', '#1e3a8a',
  '#818cf8', '#6366f1', '#4f46e5', '#312e81',
  '#c084fc', '#a855f7', '#9333ea', '#581c87',
  '#f472b6', '#ec4899', '#db2777', '#831843'
];

const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(({ onCapture }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  // App State
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>('pencil');
  const [previousTool, setPreviousTool] = useState<Tool>('pencil');
  const [color, setColor] = useState(STUDIO_THEME.accent);
  const [brushSize, setBrushSize] = useState(5);
  const [isFilled, setIsFilled] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  
  // Navigation State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState<Point>({ x: 0, y: 0 });
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  
  // UI Overlays
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSurfaceSettings, setShowSurfaceSettings] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [clipboard, setClipboard] = useState<Shape | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [gridSpacing, setGridSpacing] = useState(40);
  const [gridDotSize, setGridDotSize] = useState(1.2);
  const [pattern, setPattern] = useState<Pattern>('dots');
  const [bgColor, setBgColor] = useState(STUDIO_THEME.bg);
  const [undoStack, setUndoStack] = useState<Shape[][]>([]);
  const [redoStack, setRedoStack] = useState<Shape[][]>([]);
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: '' });

  useImperativeHandle(ref, () => ({
    getCanvasData: () => canvasRef.current?.toDataURL('image/png') || '',
    clear: () => { 
      setShapes([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedShapeId(null);
    },
    toggleSidebar: () => { setIsSidebarOpen(prev => !prev); }
  }));

  const applySnap = useCallback((val: number) => {
    if (!snapToGrid) return val;
    return Math.round(val / gridSpacing) * gridSpacing;
  }, [snapToGrid, gridSpacing]);

  const toWorldCoords = useCallback((screenX: number, screenY: number) => ({
    x: (screenX - offset.x) / scale,
    y: (screenY - offset.y) / scale
  }), [offset, scale]);

  const saveHistory = useCallback((newShapes: Shape[]) => {
    setUndoStack(prev => [...prev.slice(-MAX_HISTORY + 1), shapes]);
    setRedoStack([]);
    setShapes(newShapes);
  }, [shapes]);

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, shapes]);
    setUndoStack(u => u.slice(0, -1));
    setShapes(prev);
    setSelectedShapeId(null);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, shapes]);
    setRedoStack(r => r.slice(0, -1));
    setShapes(next);
  };

  const handleCopy = useCallback(() => {
    if (selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) setClipboard(JSON.parse(JSON.stringify(shape)));
    }
    setIsSidebarOpen(false);
  }, [selectedShapeId, shapes]);

  const handlePaste = useCallback(() => {
    if (clipboard) {
      const pastedShape = JSON.parse(JSON.stringify(clipboard)) as Shape;
      pastedShape.id = Math.random().toString(36).substr(2, 9);
      pastedShape.points = pastedShape.points.map(p => ({ x: p.x + 20, y: p.y + 20 }));
      pastedShape.isLocked = false;
      saveHistory([...shapes, pastedShape]);
      setSelectedShapeId(pastedShape.id);
    }
    setIsSidebarOpen(false);
  }, [clipboard, shapes, saveHistory]);

  const handleDuplicate = useCallback(() => {
    if (selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) {
        const clonedShape = JSON.parse(JSON.stringify(shape)) as Shape;
        clonedShape.id = Math.random().toString(36).substr(2, 9);
        clonedShape.points = clonedShape.points.map(p => ({ x: p.x + 20, y: p.y + 20 }));
        clonedShape.isLocked = false;
        saveHistory([...shapes, clonedShape]);
        setSelectedShapeId(clonedShape.id);
      }
    }
    setIsSidebarOpen(false);
  }, [selectedShapeId, shapes, saveHistory]);

  const toggleLock = useCallback(() => {
    if (!selectedShapeId) return;
    setShapes(prev => prev.map(s => s.id === selectedShapeId ? { ...s, isLocked: !s.isLocked } : s));
  }, [selectedShapeId]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);
      const newScale = Math.min(Math.max(MIN_SCALE, scale * factor), MAX_SCALE);
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - offset.x) / scale;
      const worldY = (mouseY - offset.y) / scale;

      setScale(newScale);
      setOffset({
        x: mouseX - worldX * newScale,
        y: mouseY - worldY * newScale
      });
    } else {
      if (e.shiftKey) {
        setOffset(prev => ({ ...prev, x: prev.x - e.deltaY }));
      } else {
        setOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    }
  }, [scale, offset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const nudgeSelected = useCallback((dx: number, dy: number) => {
    if (!selectedShapeId) return;
    const shape = shapes.find(s => s.id === selectedShapeId);
    if (shape?.isLocked) return;
    setShapes(prev => prev.map(s => s.id === selectedShapeId ? {
      ...s,
      points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
    } : s));
  }, [selectedShapeId, shapes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (textInput.visible) return;
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (!isSpacePressed) {
          setIsSpacePressed(true);
          setPreviousTool(tool);
          setTool('hand');
        }
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedShapeId) {
          const shape = shapes.find(s => s.id === selectedShapeId);
          if (shape?.isLocked) return;
          saveHistory(shapes.filter(s => s.id !== selectedShapeId));
          setSelectedShapeId(null);
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') handleCopy();
        if (e.key === 'v') handlePaste();
        if (e.key === 'd') { e.preventDefault(); handleDuplicate(); }
        if (e.key === 'l') { e.preventDefault(); toggleLock(); }
        if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      }
      if (selectedShapeId) {
        const amount = (e.shiftKey ? 10 : 1) / scale;
        if (e.key === 'ArrowUp') { e.preventDefault(); nudgeSelected(0, -amount); }
        if (e.key === 'ArrowDown') { e.preventDefault(); nudgeSelected(0, amount); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeSelected(-amount, 0); }
        if (e.key === 'ArrowRight') { e.preventDefault(); nudgeSelected(amount, 0); }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      if (textInput.visible) return;
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.key === ' ') {
        setIsSpacePressed(false);
        if (tool === 'hand') setTool(previousTool);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedShapeId, shapes, saveHistory, textInput.visible, tool, previousTool, isSpacePressed, scale, handleCopy, handlePaste, handleDuplicate, toggleLock, nudgeSelected]);

  const checkHit = useCallback((pos: Point, shape: Shape) => {
    const hitboxSize = 10 / scale;
    const pts = shape.points;
    const p1 = pts[0];
    const p2 = pts[1] || p1;

    // Center for rotation
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;

    // Inverse transform mouse position if shape is rotated
    let targetX = pos.x;
    let targetY = pos.y;
    if (shape.rotation) {
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const cos = Math.cos(-shape.rotation);
      const sin = Math.sin(-shape.rotation);
      targetX = cx + (dx * cos - dy * sin);
      targetY = cy + (dx * sin + dy * cos);
    }

    if (shape.tool === 'pencil' || shape.tool === 'eraser') {
      return shape.points.some(p => Math.sqrt(Math.pow(p.x - targetX, 2) + Math.pow(p.y - targetY, 2)) < hitboxSize);
    }
    
    if (shape.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const dist = Math.sqrt(Math.pow(targetX - p1.x, 2) + Math.pow(targetY - p1.y, 2));
      return dist <= radius + hitboxSize;
    }
    
    const minX = Math.min(p1.x, p2.x) - hitboxSize;
    const maxX = Math.max(p1.x, p2.x) + hitboxSize;
    const minY = Math.min(p1.y, p2.y) - hitboxSize;
    const maxY = Math.max(p1.y, p2.y) + hitboxSize;
    
    if (shape.tool === 'text') {
       const fontSize = Math.max(16, shape.size * 5);
       return targetX >= minX && targetX <= minX + 200 && targetY >= minY - fontSize && targetY <= minY;
    }

    return targetX >= minX && targetX <= maxX && targetY >= minY && targetY <= maxY;
  }, [scale]);

  const checkRotationHandleHit = useCallback((pos: Point, shape: Shape): boolean => {
    const pts = shape.points;
    if (pts.length < 2) return false;
    const p1 = pts[0];
    const p2 = pts[1];
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const minY = Math.min(p1.y, p2.y);
    const rotHandleDist = 30 / scale;
    const rotHandleSize = 12 / scale;

    const baseHandleX = cx;
    const baseHandleY = minY - rotHandleDist;

    let handleX = baseHandleX;
    let handleY = baseHandleY;
    if (shape.rotation) {
      const dx = baseHandleX - cx;
      const dy = baseHandleY - cy;
      const cos = Math.cos(shape.rotation);
      const sin = Math.sin(shape.rotation);
      handleX = cx + (dx * cos - dy * sin);
      handleY = cy + (dx * sin + dy * cos);
    }

    return Math.sqrt(Math.pow(pos.x - handleX, 2) + Math.pow(pos.y - handleY, 2)) < rotHandleSize;
  }, [scale]);

  const checkResizeHandleHit = useCallback((pos: Point, shape: Shape): ResizeHandle | null => {
    const handleSize = 12 / scale;
    const pts = shape.points;
    if (pts.length < 2) return null;
    const p1 = pts[0];
    const p2 = pts[1];
    
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const cx = midX;
    const cy = midY;

    const baseHandles: Record<ResizeHandle, Point> = {
      nw: { x: minX, y: minY },
      n: { x: midX, y: minY },
      ne: { x: maxX, y: minY },
      e: { x: maxX, y: midY },
      se: { x: maxX, y: maxY },
      s: { x: midX, y: maxY },
      sw: { x: minX, y: maxY },
      w: { x: minX, y: midY }
    };

    for (const [key, p] of Object.entries(baseHandles)) {
      let handleX = p.x;
      let handleY = p.y;
      if (shape.rotation) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const cos = Math.cos(shape.rotation);
        const sin = Math.sin(shape.rotation);
        handleX = cx + (dx * cos - dy * sin);
        handleY = cy + (dx * sin + dy * cos);
      }
      if (Math.sqrt(Math.pow(pos.x - handleX, 2) + Math.pow(pos.y - handleY, 2)) < handleSize) {
        return key as ResizeHandle;
      }
    }
    return null;
  }, [scale]);

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const headlen = 12 / scale;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    if (gridVisible && pattern !== 'none') {
      ctx.fillStyle = STUDIO_THEME.gridDots;
      ctx.strokeStyle = STUDIO_THEME.gridDots;
      const startX = Math.floor(-offset.x / scale / gridSpacing) * gridSpacing;
      const startY = Math.floor(-offset.y / scale / gridSpacing) * gridSpacing;
      const endX = startX + canvas.width / scale + gridSpacing;
      const endY = startY + canvas.height / scale + gridSpacing;

      for (let x = startX; x < endX; x += gridSpacing) {
        for (let y = startY; y < endY; y += gridSpacing) {
          if (pattern === 'dots') {
            ctx.beginPath(); ctx.arc(x, y, gridDotSize / scale, 0, Math.PI * 2); ctx.fill();
          } else if (pattern === 'grid') {
            ctx.lineWidth = 0.5 / scale;
            ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
          }
        }
      }
    }

    shapes.forEach(shape => {
      ctx.save();
      
      const pts = shape.points;
      const p1 = pts[0];
      const p2 = pts[1] || p1;
      
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      if (shape.rotation) {
        ctx.translate(centerX, centerY);
        ctx.rotate(shape.rotation);
        ctx.translate(-centerX, -centerY);
      }

      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const isSelected = shape.id === selectedShapeId;
      const isHovered = shape.id === hoveredShapeId && (tool === 'move' || tool === 'hand');

      if (isSelected || isHovered) {
        ctx.shadowBlur = isSelected ? 20 / scale : 10 / scale;
        ctx.shadowColor = shape.color;
      }

      if (shape.tool === 'dashedLine') ctx.setLineDash([10 / scale, 10 / scale]);

      if (shape.tool === 'pencil' || shape.tool === 'eraser') {
        if (shape.tool === 'eraser') ctx.strokeStyle = bgColor;
        ctx.beginPath();
        shape.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.stroke();
      } else if (shape.tool === 'rect' || shape.tool === 'roundRect') {
        const w = p2.x - p1.x; const h = p2.y - p1.y;
        if (shape.tool === 'roundRect') {
          const r = 12 / scale;
          const absW = Math.abs(w); const absH = Math.abs(h);
          const startX = w >= 0 ? p1.x : p1.x + w; const startY = h >= 0 ? p1.y : p1.y + h;
          let radius = Math.min(r, absW / 2, absH / 2);
          ctx.beginPath(); ctx.moveTo(startX + radius, startY);
          ctx.arcTo(startX + absW, startY, startX + absW, startY + absH, radius);
          ctx.arcTo(startX + absW, startY + absH, startX, startY + absH, radius);
          ctx.arcTo(startX, startY + absH, startX, startY, radius);
          ctx.arcTo(startX, startY, startX + absW, startY, radius);
          ctx.closePath();
          if (shape.isFilled) ctx.fill(); ctx.stroke();
        } else {
          if (shape.isFilled) ctx.fillRect(p1.x, p1.y, w, h);
          ctx.strokeRect(p1.x, p1.y, w, h);
        }
      } else if (shape.tool === 'circle') {
        const r = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, 2 * Math.PI);
        if (shape.isFilled) ctx.fill(); ctx.stroke();
      } else if (shape.tool === 'line' || shape.tool === 'dashedLine') {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      } else if (shape.tool === 'arrow') {
        drawArrow(ctx, p1.x, p1.y, p2.x, p2.y);
      } else if (shape.tool === 'text') {
        ctx.font = `bold ${Math.max(16, shape.size * 5)}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillText(shape.text || '', p1.x, p1.y);
      }
      
      ctx.setLineDash([]);
      ctx.restore();

      if (isSelected) {
        ctx.save();
        const pts_ = shape.points;
        const s_minX = Math.min(...pts_.map(p => p.x));
        const s_maxX = Math.max(...pts_.map(p => p.x));
        const s_minY = Math.min(...pts_.map(p => p.y));
        const s_maxY = Math.max(...pts_.map(p => p.y));
        const midX = (s_minX + s_maxX) / 2;
        const midY = (s_minY + s_maxY) / 2;
        const cx = midX;
        const cy = midY;

        if (shape.rotation) {
          ctx.translate(cx, cy);
          ctx.rotate(shape.rotation);
          ctx.translate(-cx, -cy);
        }

        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.lineWidth = 1 / scale;
        ctx.strokeStyle = STUDIO_THEME.accent;
        const b_minX = s_minX - 10 / scale;
        const b_maxX = s_maxX + 10 / scale;
        const b_minY = s_minY - 10 / scale;
        const b_maxY = s_maxY + 10 / scale;
        ctx.strokeRect(b_minX, b_minY, b_maxX - b_minX, b_maxY - b_minY);
        
        // Resize Handles
        if (!shape.isLocked && !['pencil', 'eraser', 'text'].includes(shape.tool)) {
          const handlePts: Record<ResizeHandle, Point> = {
            nw: { x: s_minX, y: s_minY },
            n: { x: midX, y: s_minY },
            ne: { x: s_maxX, y: s_minY },
            e: { x: s_maxX, y: midY },
            se: { x: s_maxX, y: s_maxY },
            s: { x: midX, y: s_maxY },
            sw: { x: s_minX, y: s_maxY },
            w: { x: s_minX, y: midY }
          };

          ctx.setLineDash([]);
          ctx.fillStyle = 'white';
          ctx.strokeStyle = STUDIO_THEME.accent;
          ctx.lineWidth = 1 / scale;
          const hSize = 8 / scale;
          for (const p of Object.values(handlePts)) {
            ctx.beginPath(); ctx.arc(p.x, p.y, hSize/2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        }
        
        // Rotation handle
        const rotHandleY = b_minY - 30 / scale;
        const rotHandleX = (b_minX + b_maxX) / 2;
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.beginPath(); ctx.moveTo(rotHandleX, b_minY); ctx.lineTo(rotHandleX, rotHandleY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(rotHandleX, rotHandleY, 6 / scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        if (shape.isLocked) {
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath(); ctx.arc(b_maxX, b_minY, 8 / scale, 0, Math.PI * 2); ctx.fill();
        }
        
        ctx.restore();
      }
    });

    if (isDrawing && !['move', 'hand'].includes(tool)) {
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.lineWidth = brushSize / scale;
      ctx.setLineDash([5 / scale, 5 / scale]);
      let endX = currentPos.x; let endY = currentPos.y;
      if (isShiftPressed && ['rect', 'circle', 'roundRect'].includes(tool)) {
        const dx = currentPos.x - startPos.x; const dy = currentPos.y - startPos.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        endX = startPos.x + (dx >= 0 ? size : -size); endY = startPos.y + (dy >= 0 ? size : -size);
      }
      if (tool === 'rect' || tool === 'roundRect') {
        if (tool === 'roundRect') {
           const w = endX - startPos.x; const h = endY - startPos.y;
           const absW = Math.abs(w); const absH = Math.abs(h);
           const r = 12 / scale;
           const sX = w >= 0 ? startPos.x : startPos.x + w; const sY = h >= 0 ? startPos.y : startPos.y + h;
           let radius = Math.min(r, absW / 2, absH / 2);
           ctx.beginPath(); ctx.moveTo(sX + radius, sY);
           ctx.arcTo(sX + absW, sY, sX + absW, sY + absH, radius);
           ctx.arcTo(sX + absW, sY + absH, sX, sY + absH, radius);
           ctx.arcTo(sX, sY + absH, sX, sY, radius);
           ctx.arcTo(sX, sY, sX + absW, sY, radius);
           ctx.closePath(); ctx.stroke();
        }
        else ctx.strokeRect(startPos.x, startPos.y, endX - startPos.x, endY - startPos.y);
      } else if (tool === 'circle') {
        const r = Math.sqrt(Math.pow(endX - startPos.x, 2) + Math.pow(endY - startPos.y, 2));
        ctx.beginPath(); ctx.arc(startPos.x, startPos.y, r, 0, 2 * Math.PI); ctx.stroke();
      } else if (tool === 'line' || tool === 'dashedLine') {
        if (tool === 'dashedLine') ctx.setLineDash([10 / scale, 10 / scale]);
        ctx.beginPath(); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(endX, endY); ctx.stroke();
      } else if (tool === 'arrow') drawArrow(ctx, startPos.x, startPos.y, endX, endY);
      ctx.restore();
    }
    ctx.restore();
  }, [shapes, selectedShapeId, hoveredShapeId, tool, bgColor, gridVisible, pattern, gridSpacing, gridDotSize, isDrawing, currentPos, startPos, color, brushSize, isShiftPressed, offset, scale, snapToGrid]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => { if (canvas.parentElement) { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; render(); } };
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [render]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = ('touches' in e) ? e.touches[0].clientX : e.clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : e.clientY;
    const rawPos = { x: clientX - rect.left, y: clientY - rect.top };
    const pos = toWorldCoords(rawPos.x, rawPos.y);
    const snappedPos = { x: applySnap(pos.x), y: applySnap(pos.y) };
    
    if (isSpacePressed || (e as React.MouseEvent).button === 1 || (e as React.MouseEvent).button === 2 || tool === 'hand') {
      setIsPanning(true);
      setStartPos({ x: clientX, y: clientY });
      return;
    }

    if (tool === 'move' && selectedShapeId) {
      const selectedShape = shapes.find(s => s.id === selectedShapeId);
      if (selectedShape && !selectedShape.isLocked) {
        if (checkRotationHandleHit(pos, selectedShape)) {
          setIsRotating(true);
          setStartPos(pos);
          return;
        }

        const handle = checkResizeHandleHit(pos, selectedShape);
        if (handle) {
          setIsResizing(true);
          setActiveResizeHandle(handle);
          setStartPos(pos);
          setCurrentPos(pos);
          return;
        }
      }
    }

    setStartPos(snappedPos); setCurrentPos(snappedPos);
    
    if (tool === 'move') {
      const hit = shapes.slice().reverse().find(s => checkHit(pos, s));
      if (hit) {
        setSelectedShapeId(hit.id);
        if (!hit.isLocked) setIsDragging(true);
      } else setSelectedShapeId(null);
      return;
    }

    if (tool === 'text') {
      if (textInput.visible) { handleTextSubmit(); return; }
      setTextInput({ visible: true, x: rawPos.x, y: rawPos.y, value: '' });
      setTimeout(() => textInputRef.current?.focus(), 10);
      return;
    }

    setIsDrawing(true); setSelectedShapeId(null);
    if (['pencil', 'eraser'].includes(tool)) {
      setShapes([...shapes, { id: Math.random().toString(36).substr(2, 9), tool, points: [snappedPos], color, size: brushSize / scale, isFilled: false }]);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = ('touches' in e) ? e.touches[0].clientX : e.clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : e.clientY;
    
    if (isPanning) {
      setOffset(prev => ({ x: prev.x + (clientX - startPos.x), y: prev.y + (clientY - startPos.y) }));
      setStartPos({ x: clientX, y: clientY });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = toWorldCoords(clientX - rect.left, clientY - rect.top);
    const snappedPos = { x: applySnap(pos.x), y: applySnap(pos.y) };

    if (tool === 'move' && !isDragging && !isResizing && !isRotating) {
      const hit = shapes.slice().reverse().find(s => checkHit(pos, s));
      setHoveredShapeId(hit?.id || null);
    }

    if (isDragging && selectedShapeId) {
      const dx = snappedPos.x - currentPos.x; const dy = snappedPos.y - currentPos.y;
      setShapes(prev => prev.map(s => s.id === selectedShapeId ? { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) } : s));
      setCurrentPos(snappedPos); return;
    }

    if (isRotating && selectedShapeId) {
      setShapes(prev => prev.map(s => {
        if (s.id !== selectedShapeId) return s;
        const pts = s.points;
        const p1 = pts[0];
        const p2 = pts[1] || p1;
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const angle = Math.atan2(pos.y - cy, pos.x - cx) + Math.PI / 2;
        return { ...s, rotation: angle };
      }));
      return;
    }

    if (isResizing && selectedShapeId && activeResizeHandle) {
      const dx = snappedPos.x - currentPos.x;
      const dy = snappedPos.y - currentPos.y;
      
      setShapes(prev => prev.map(s => {
        if (s.id !== selectedShapeId || s.points.length < 2) return s;
        const newPoints = [...s.points];
        const p1 = newPoints[0];
        const p2 = newPoints[1];
        
        const minXIdx = p1.x < p2.x ? 0 : 1;
        const maxXIdx = p1.x < p2.x ? 1 : 0;
        const minYIdx = p1.y < p2.y ? 0 : 1;
        const maxYIdx = p1.y < p2.y ? 1 : 0;

        switch (activeResizeHandle) {
          case 'nw': newPoints[minXIdx].x += dx; newPoints[minYIdx].y += dy; break;
          case 'n': newPoints[minYIdx].y += dy; break;
          case 'ne': newPoints[maxXIdx].x += dx; newPoints[minYIdx].y += dy; break;
          case 'e': newPoints[maxXIdx].x += dx; break;
          case 'se': newPoints[maxXIdx].x += dx; newPoints[maxYIdx].y += dy; break;
          case 's': newPoints[maxYIdx].y += dy; break;
          case 'sw': newPoints[minXIdx].x += dx; newPoints[maxYIdx].y += dy; break;
          case 'w': newPoints[minXIdx].x += dx; break;
        }
        return { ...s, points: newPoints };
      }));
      setCurrentPos(snappedPos);
      return;
    }

    setCurrentPos(snappedPos);
    if (!isDrawing) return;

    if (['pencil', 'eraser'].includes(tool)) {
      setShapes(prev => {
        const last = prev[prev.length - 1];
        if (last && ['pencil', 'eraser'].includes(last.tool)) return [...prev.slice(0, -1), { ...last, points: [...last.points, snappedPos] }];
        return prev;
      });
    }
  };

  const stopDrawing = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (isDragging || isResizing || isRotating) { 
      setIsDragging(false); 
      setIsResizing(false); 
      setIsRotating(false);
      setActiveResizeHandle(null);
      saveHistory(shapes); 
      return; 
    }
    if (!isDrawing) return;
    if (!['pencil', 'eraser', 'move', 'hand'].includes(tool)) {
      let endX = currentPos.x; let endY = currentPos.y;
      if (isShiftPressed && ['rect', 'circle', 'roundRect'].includes(tool)) {
        const dx = currentPos.x - startPos.x; const dy = currentPos.y - startPos.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        endX = startPos.x + (dx >= 0 ? size : -size); endY = startPos.y + (dy >= 0 ? size : -size);
      }
      saveHistory([...shapes, { id: Math.random().toString(36).substr(2, 9), tool, points: [startPos, { x: applySnap(endX), y: applySnap(endY) }], color, size: brushSize / scale, isFilled }]);
    } else saveHistory(shapes);
    setIsDrawing(false);
  };

  const handleTextSubmit = useCallback((e?: React.FormEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (textInput.value.trim()) {
      const worldPos = toWorldCoords(textInput.x, textInput.y);
      saveHistory([...shapes, { 
        id: Math.random().toString(36).substr(2, 9), 
        tool: 'text', 
        points: [{ x: applySnap(worldPos.x), y: applySnap(worldPos.y) }], 
        color, 
        size: brushSize / scale, 
        isFilled: false, 
        text: textInput.value 
      }]);
    }
    setTextInput({ ...textInput, visible: false, value: '' });
  }, [shapes, textInput, color, brushSize, scale, toWorldCoords, saveHistory, applySnap]);

  const exportAsSVG = useCallback(() => {
    if (shapes.length === 0) return;
    const pts = shapes.flatMap(s => s.points);
    const minX = Math.min(...pts.map(p => p.x)) - 20;
    const maxX = Math.max(...pts.map(p => p.x)) + 20;
    const minY = Math.min(...pts.map(p => p.y)) - 20;
    const maxY = Math.max(...pts.map(p => p.y)) + 20;
    const width = maxX - minX;
    const height = maxY - minY;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}"><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bgColor}" />`;
    shapes.forEach(shape => {
      const stroke = shape.tool === 'eraser' ? bgColor : shape.color;
      const fill = shape.isFilled ? shape.color : 'none';
      const pts_ = shape.points;
      const p1 = pts_[0];
      const p2 = pts_[1] || p1;
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rotationTransform = shape.rotation ? ` transform="rotate(${shape.rotation * 180 / Math.PI} ${cx} ${cy})"` : '';

      if (shape.tool === 'pencil' || shape.tool === 'eraser') {
        const path = shape.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        svg += `<path d="${path}" stroke="${stroke}" stroke-width="${shape.size}" fill="none" stroke-linecap="round" stroke-linejoin="round"${rotationTransform} />`;
      } else if (shape.tool === 'rect') {
        svg += `<rect x="${Math.min(p1.x, p2.x)}" y="${Math.min(p1.y, p2.y)}" width="${Math.abs(p2.x - p1.x)}" height="${Math.abs(p2.y - p1.y)}" stroke="${shape.color}" stroke-width="${shape.size}" fill="${fill}"${rotationTransform} />`;
      } else if (shape.tool === 'circle') {
        const r = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        svg += `<circle cx="${p1.x}" cy="${p1.y}" r="${r}" stroke="${shape.color}" stroke-width="${shape.size}" fill="${fill}"${rotationTransform} />`;
      } else if (shape.tool === 'text') {
        svg += `<text x="${p1.x}" y="${p1.y}" fill="${shape.color}" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold" font-size="${Math.max(16, shape.size * 5)}"${rotationTransform}>${shape.text || ''}</text>`;
      }
    });
    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sketch-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [shapes, bgColor]);

  const exportAsPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `sketch-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const currentSelected = shapes.find(s => s.id === selectedShapeId);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner group/board">
      {/* Zoom Controls */}
      <div className="absolute top-6 right-6 z-40 flex flex-col gap-2 pointer-events-none opacity-0 group-hover/board:opacity-100 transition-opacity duration-500">
        <div className="flex flex-col p-1 glass-panel-heavy rounded-2xl shadow-2xl pointer-events-auto">
           <button onClick={() => setScale(s => Math.min(s + 0.1, MAX_SCALE))} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><Plus size={14}/></button>
           <button onClick={() => { setScale(1); setOffset({x:0, y:0}); }} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all text-[8px] font-black">{Math.round(scale * 100)}%</button>
           <button onClick={() => setScale(s => Math.max(s - 0.1, MIN_SCALE))} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><Minus size={14}/></button>
           <div className="w-full h-px bg-white/5 my-1" />
           <button onClick={() => { setScale(1); setOffset({x:0,y:0}); }} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><Maximize size={14}/></button>
        </div>
      </div>

      {/* Undo/Redo Controls */}
      <div className="absolute bottom-6 right-6 z-40 flex gap-2 pointer-events-none opacity-0 group-hover/board:opacity-100 transition-opacity duration-500">
        <div className="flex p-1 glass-panel-heavy rounded-2xl shadow-2xl pointer-events-auto items-center">
          <button 
            onClick={undo} 
            disabled={undoStack.length === 0}
            className={`p-2 rounded-xl transition-all ${undoStack.length === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            title="Undo (⌘Z)"
          >
            <Undo2 size={16}/>
          </button>
          <div className="w-px h-4 bg-white/5 mx-1" />
          <button 
            onClick={redo} 
            disabled={redoStack.length === 0}
            className={`p-2 rounded-xl transition-all ${redoStack.length === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={16}/>
          </button>
        </div>
      </div>

      <div className={`absolute top-0 left-0 h-full w-72 z-50 glass-panel-heavy border-r border-white/5 transition-all duration-700 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 pt-24 space-y-10 h-full flex flex-col">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">LIBRARY CONTROL</span><button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={16} className="text-white"/></button></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-10">
            <SidebarGroup label="Clipboard Hub">
              <SidebarItem icon={<Copy size={16}/>} label="Copy Fragment" shortcut="⌘C" onClick={handleCopy}/>
              <SidebarItem icon={<Clipboard size={16}/>} label="Paste Fragment" shortcut="⌘V" onClick={handlePaste} disabled={!clipboard}/>
              <SidebarItem icon={<Files size={16}/>} label="Clone Instance" shortcut="⌘D" onClick={handleDuplicate}/>
            </SidebarGroup>
            <SidebarGroup label="Workspace Exports">
              <SidebarItem icon={<FileCode size={16}/>} label="Vector Export (SVG)" onClick={exportAsSVG}/>
              <SidebarItem icon={<FileImage size={16}/>} label="Raster Export (PNG)" onClick={exportAsPNG}/>
            </SidebarGroup>
          </div>
          <div className="p-5 border-t border-white/5 bg-white/5 rounded-2xl flex items-center gap-4"><LayersIcon size={18} className="text-indigo-400" /><div className="flex flex-col"><span className="text-[9px] font-black tracking-widest text-slate-500">Engine Core</span><span className="text-[11px] font-bold text-slate-300">Synchronized</span></div></div>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        onMouseDown={startDrawing} 
        onMouseMove={draw} 
        onMouseUp={stopDrawing} 
        onMouseLeave={stopDrawing} 
        onContextMenu={(e) => e.preventDefault()} 
        className={`w-full h-full touch-none ${isPanning ? 'cursor-grabbing' : tool === 'hand' ? 'cursor-grab' : tool === 'text' ? 'cursor-text' : tool === 'move' ? (hoveredShapeId ? 'cursor-grab' : 'cursor-default') : 'cursor-crosshair'}`} 
      />

      {showSurfaceSettings && (
        <div className="absolute bottom-24 right-6 w-60 glass-panel-heavy rounded-2xl p-5 z-40 border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Surface Config</h4>
            <button onClick={() => setShowSurfaceSettings(false)} className="text-slate-500 hover:text-white"><X size={12}/></button>
          </div>
          <div className="space-y-5">
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold text-slate-400">Grid Visibility</span><button onClick={() => setGridVisible(!gridVisible)} className={`w-8 h-4 rounded-full relative transition-colors ${gridVisible ? 'bg-indigo-600' : 'bg-slate-800'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${gridVisible ? 'left-4.5' : 'left-0.5'}`} /></button></div>
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold text-slate-400">Snap to Grid</span><button onClick={() => setSnapToGrid(!snapToGrid)} className={`w-8 h-4 rounded-full relative transition-colors ${snapToGrid ? 'bg-indigo-600' : 'bg-slate-800'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${snapToGrid ? 'left-4.5' : 'left-0.5'}`} /></button></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-[9px] font-bold text-slate-400">Pattern</span><div className="flex gap-1"><button onClick={() => setPattern('dots')} className={`p-1.5 rounded-lg border ${pattern === 'dots' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}><CircleDot size={10} /></button><button onClick={() => setPattern('grid')} className={`p-1.5 rounded-lg border ${pattern === 'grid' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}><Grid3X3 size={10} /></button></div></div>
            </div>
            <div className="space-y-1.5"><div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase">Spacing<span>{gridSpacing}px</span></div><input type="range" min="10" max="100" step="10" value={gridSpacing} onChange={(e) => setGridSpacing(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-slate-800 accent-indigo-500 rounded-lg cursor-pointer" /></div>
          </div>
        </div>
      )}

      {/* Color Palette Popover */}
      {showColorPicker && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-64 glass-panel-heavy rounded-3xl p-5 z-50 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Extended Palette</h4>
            <button onClick={() => setShowColorPicker(false)} className="text-slate-500 hover:text-white transition-colors"><X size={14}/></button>
          </div>
          <div className="grid grid-cols-8 gap-1.5 mb-5">
            {EXTENDED_COLORS.map(c => (
              <button 
                key={c} 
                onClick={() => { setColor(c); setShowColorPicker(false); }}
                className={`w-6 h-6 rounded-lg border transition-all hover:scale-110 active:scale-90 ${color === c ? 'border-white ring-2 ring-indigo-500/40' : 'border-slate-800'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="space-y-3 pt-3 border-t border-white/5">
             <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Custom HEX</span>
                <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">{color}</span>
             </div>
             <div className="flex gap-3 items-center">
                <input 
                  type="color" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-xl bg-transparent border-none cursor-pointer p-0" 
                />
                <input 
                  type="text" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#000000"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
             </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full max-w-fit pointer-events-none z-30">
        <div className="flex items-center gap-1 p-1 glass-panel-heavy rounded-[1.5rem] shadow-2xl pointer-events-auto border-white/10">
          <div className="flex items-center gap-0.5 px-1 border-r border-white/5">
            <ToolButton active={tool === 'hand'} onClick={() => { setTool('hand'); setSelectedShapeId(null); }} title="Pan (Space)"><Hand size={16} /></ToolButton>
            <ToolButton active={tool === 'move'} onClick={() => { setTool('move'); setSelectedShapeId(null); }} title="Select (V)"><MousePointer2 size={16} /></ToolButton>
          </div>
          <div className="flex items-center gap-0.5 px-1 border-r border-white/5">
            <ToolButton active={tool === 'pencil'} onClick={() => { setTool('pencil'); setSelectedShapeId(null); }} title="Sketch (P)"><Pencil size={16} /></ToolButton>
            <ToolButton active={tool === 'eraser'} onClick={() => { setTool('eraser'); setSelectedShapeId(null); }} title="Erase (E)"><Eraser size={16} /></ToolButton>
            <ToolButton active={tool === 'text'} onClick={() => { setTool('text'); setSelectedShapeId(null); }} title="Type (T)"><TypeIcon size={16} /></ToolButton>
          </div>
          <div className="flex items-center gap-0.5 px-1 border-r border-white/5">
            <ToolButton active={tool === 'rect'} onClick={() => { setTool('rect'); setSelectedShapeId(null); }} title="Rect"><Square size={16} /></ToolButton>
            <ToolButton active={tool === 'circle'} onClick={() => { setTool('circle'); setSelectedShapeId(null); }} title="Circle"><Circle size={16} /></ToolButton>
            <div className="flex flex-col gap-0.5">
              <ToolButton active={tool === 'line'} onClick={() => { setTool('line'); setSelectedShapeId(null); }} title="Line"><Minus size={14} className="rotate-45" /></ToolButton>
              <ToolButton active={tool === 'dashedLine'} onClick={() => { setTool('dashedLine'); setSelectedShapeId(null); }} title="Dashed"><Divide size={14} className="rotate-45" /></ToolButton>
            </div>
            <ToolButton active={tool === 'arrow'} onClick={() => { setTool('arrow'); setSelectedShapeId(null); }} title="Arrow"><ArrowUpRight size={16} /></ToolButton>
          </div>
          <div className="flex items-center gap-0.5 px-1 border-r border-white/5">
            <ToolButton active={isFilled} onClick={() => setIsFilled(!isFilled)} title="Fill Mode"><PaintBucket size={16} /></ToolButton>
            <ToolButton active={snapToGrid} onClick={() => setSnapToGrid(!snapToGrid)} title="Snap to Grid"><Hash size={16} /></ToolButton>
            {selectedShapeId && (
              <ToolButton onClick={toggleLock} title={currentSelected?.isLocked ? "Unlock" : "Lock"}>
                {currentSelected?.isLocked ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
              </ToolButton>
            )}
          </div>
          <div className="flex gap-1 px-2 items-center">
            {QUICK_COLORS.map(c => (
              <button 
                key={c} 
                onClick={() => setColor(c)} 
                className={`w-5 h-5 rounded-full border transition-all ${color === c ? 'border-white ring-2 ring-indigo-500/40' : 'border-slate-800'}`} 
                style={{ backgroundColor: c }} 
              />
            ))}
            <button 
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`p-1.5 rounded-xl transition-all ${showColorPicker ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
              title="Extended Palette"
            >
              <Palette size={14} />
            </button>
            <div className="w-px h-5 bg-white/5 mx-1" />
            <button onClick={() => { setShapes([]); setUndoStack([]); setRedoStack([]); setSelectedShapeId(null); }} className="p-2 rounded-xl text-slate-500 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 px-4 py-1.5 glass-panel-heavy rounded-full pointer-events-auto border-white/5 shadow-xl">
          <input type="range" min="1" max="40" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 h-1 appearance-none bg-slate-800 accent-indigo-500 rounded-lg cursor-pointer" />
          <div className="flex items-center gap-2">
             <span className="text-[8px] font-black uppercase text-slate-600">Stroke</span>
             <span className="text-[10px] font-mono font-bold w-8 text-slate-300">{brushSize}px</span>
          </div>
          <div className="w-px h-3 bg-white/5" />
          <button onClick={() => setShowSurfaceSettings(!showSurfaceSettings)} className={`p-1 transition-all ${showSurfaceSettings ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}><Settings2 size={14} /></button>
        </div>
      </div>

      {textInput.visible && (
        <div style={{ position: 'absolute', left: textInput.x, top: textInput.y - (Math.max(16, (brushSize / scale) * 5) * scale), transform: `scale(${scale})`, transformOrigin: 'bottom left', pointerEvents: 'auto' }} className="z-50" onMouseDown={(e) => e.stopPropagation()}>
          <input ref={textInputRef} type="text" value={textInput.value} onChange={(e) => setTextInput({ ...textInput, value: e.target.value })} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); handleTextSubmit(); } if (e.key === 'Escape') setTextInput({ ...textInput, visible: false, value: '' }); }} onBlur={() => handleTextSubmit()} className="bg-transparent border-none outline-none p-0 m-0 shadow-none ring-0 focus:ring-0 placeholder:opacity-20" placeholder="Label..." style={{ color, fontSize: `${Math.max(16, (brushSize / scale) * 5)}px`, lineHeight: '1', fontWeight: 'bold', fontFamily: "'Plus Jakarta Sans', sans-serif", minWidth: '10px' }} />
        </div>
      )}
    </div>
  );
});

const SidebarGroup = ({ label, children }: any) => (
  <div className="space-y-4"><label className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-800" /> {label}</label><div className="space-y-1">{children}</div></div>
);

const SidebarItem = ({ icon, label, shortcut, onClick, disabled }: any) => (
  <button onClick={onClick} disabled={disabled} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${disabled ? 'opacity-10' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}><div className="flex items-center gap-3">{icon}<span className="text-[11px] font-bold">{label}</span></div>{shortcut && <span className="text-[8px] font-mono font-black px-1 py-0.5 bg-black/40 rounded border border-white/5 opacity-40">{shortcut}</span>}</button>
);

const ToolButton = ({ active, children, onClick, title, disabled }: any) => (
  <button onClick={onClick} title={title} disabled={disabled} className={`p-2 rounded-xl transition-all duration-300 relative group ${disabled ? 'opacity-10' : active ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}>{children}{active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-0.5 bg-white rounded-full" />}</button>
);

export default Whiteboard;
