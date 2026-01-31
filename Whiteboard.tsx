
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { 
  Pencil, Eraser, Trash2, Square, Circle, Minus, 
  Undo2, Redo2, Type as TypeIcon, Eye, 
  EyeOff, Settings2, Palette, MousePointer2, PaintBucket,
  ImageIcon, Monitor, Layers as LayersIcon, AlertTriangle, 
  Move, MousePointer, ArrowUpRight, Maximize2, Grab, Menu,
  Copy, Clipboard, Files, Save, Library, History,
  Download, FileImage, FileCode, X, ChevronRight, Settings, Plus,
  Search, Maximize, Hand
} from 'lucide-react';

interface WhiteboardProps {
  onCapture: (dataUrl: string) => void;
}

export interface WhiteboardHandle {
  getCanvasData: () => string;
  clear: () => void;
  toggleSidebar: () => void;
}

type Tool = 'move' | 'pencil' | 'eraser' | 'rect' | 'roundRect' | 'circle' | 'line' | 'arrow' | 'text' | 'hand';
type Pattern = 'dots' | 'grid' | 'lines' | 'none';

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
  text?: string;
}

const MAX_HISTORY = 50;
const ZOOM_SENSITIVITY = 0.001;
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;

const STUDIO_THEME = {
  bg: '#0f172a',
  accent: '#6366f1',
  gridDots: '#ffffff0a'
};

const PRIMARY_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#ffffff'];
const PALETTE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', 
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', 
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', 
  '#ec4899', '#f43f5e', '#000000', '#71717a', '#ffffff'
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
  
  // Navigation State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState<Point>({ x: 0, y: 0 });
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  
  // UI Overlays
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSurfaceSettings, setShowSurfaceSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [clipboard, setClipboard] = useState<Shape | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [gridSpacing, setGridSpacing] = useState(25);
  const [gridDotSize, setGridDotSize] = useState(0.8);
  const [pattern, setPattern] = useState('dots');
  const [bgColor, setBgColor] = useState(STUDIO_THEME.bg);
  const [undoStack, setUndoStack] = useState<Shape[][]>([]);
  const [redoStack, setRedoStack] = useState<Shape[][]>([]);
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: '' });

  useImperativeHandle(ref, () => ({
    getCanvasData: () => canvasRef.current?.toDataURL('image/png') || '',
    clear: () => { setShowClearConfirm(true); },
    toggleSidebar: () => { setIsSidebarOpen(prev => !prev); }
  }));

  const toWorldCoords = useCallback((screenX: number, screenY: number) => ({
    x: (screenX - offset.x) / scale,
    y: (screenY - offset.y) / scale
  }), [offset, scale]);

  const toScreenCoords = useCallback((worldX: number, worldY: number) => ({
    x: worldX * scale + offset.x,
    y: worldY * scale + offset.y
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
      saveHistory([...shapes, pastedShape]);
      setSelectedShapeId(pastedShape.id);
    }
    setIsSidebarOpen(false);
  }, [clipboard, shapes, saveHistory]);

  const handleDuplicate = useCallback(() => {
    if (selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) {
        const duplicated = JSON.parse(JSON.stringify(shape)) as Shape;
        duplicated.id = Math.random().toString(36).substr(2, 9);
        duplicated.points = duplicated.points.map(p => ({ x: p.x + 20, y: p.y + 20 }));
        saveHistory([...shapes, duplicated]);
        setSelectedShapeId(duplicated.id);
      }
    }
    setIsSidebarOpen(false);
  }, [selectedShapeId, shapes, saveHistory]);

  const nudgeSelected = useCallback((dx: number, dy: number) => {
    if (!selectedShapeId) return;
    setShapes(prev => prev.map(s => s.id === selectedShapeId ? {
      ...s,
      points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
    } : s));
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
      // Natural trackpad or scroll-pan
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === ' ' && !textInput.visible && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (!isSpacePressed) {
          setIsSpacePressed(true);
          setPreviousTool(tool);
          setTool('hand');
        }
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedShapeId && !textInput.visible) {
          saveHistory(shapes.filter(s => s.id !== selectedShapeId));
          setSelectedShapeId(null);
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') handleCopy();
        if (e.key === 'v') handlePaste();
        if (e.key === 'd') { e.preventDefault(); handleDuplicate(); }
        if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      }
      if (selectedShapeId && !textInput.visible) {
        const amount = (e.shiftKey ? 10 : 1) / scale;
        if (e.key === 'ArrowUp') { e.preventDefault(); nudgeSelected(0, -amount); }
        if (e.key === 'ArrowDown') { e.preventDefault(); nudgeSelected(0, amount); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeSelected(-amount, 0); }
        if (e.key === 'ArrowRight') { e.preventDefault(); nudgeSelected(amount, 0); }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.key === ' ') {
        setIsSpacePressed(false);
        if (tool === 'hand') setTool(previousTool);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedShapeId) {
        saveHistory(shapes);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedShapeId, shapes, saveHistory, textInput.visible, tool, previousTool, isSpacePressed, scale, handleCopy, handlePaste, handleDuplicate, nudgeSelected]);

  const checkHit = useCallback((pos: Point, shape: Shape) => {
    const hitboxSize = 10 / scale;
    if (shape.tool === 'pencil' || shape.tool === 'eraser') {
      return shape.points.some(p => Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2)) < hitboxSize);
    }
    const pts = shape.points;
    const p1 = pts[0];
    const p2 = pts[1] || p1;
    
    if (shape.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const dist = Math.sqrt(Math.pow(pos.x - p1.x, 2) + Math.pow(pos.y - p1.y, 2));
      return dist <= radius + hitboxSize;
    }
    
    const minX = Math.min(p1.x, p2.x) - hitboxSize;
    const maxX = Math.max(p1.x, p2.x) + hitboxSize;
    const minY = Math.min(p1.y, p2.y) - hitboxSize;
    const maxY = Math.max(p1.y, p2.y) + hitboxSize;
    
    if (shape.tool === 'text') {
       return pos.x >= minX && pos.x <= minX + 150 && pos.y >= minY - 20 && pos.y <= minY + 20;
    }

    return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
  }, [scale]);

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const headlen = 10 / scale;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
  };

  const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const absW = Math.abs(w); const absH = Math.abs(h);
    const startX = w >= 0 ? x : x + w; const startY = h >= 0 ? y : y + h;
    let radius = Math.min(r, absW / 2, absH / 2);
    ctx.beginPath(); ctx.moveTo(startX + radius, startY);
    ctx.arcTo(startX + absW, startY, startX + absW, startY + absH, radius);
    ctx.arcTo(startX + absW, startY + absH, startX, startY + absH, radius);
    ctx.arcTo(startX, startY + absH, startX, startY, radius);
    ctx.arcTo(startX, startY, startX + absW, startY, radius);
    ctx.closePath();
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
      } else { ctx.shadowBlur = 0; }

      if (shape.tool === 'pencil' || shape.tool === 'eraser') {
        if (shape.tool === 'eraser') ctx.strokeStyle = bgColor;
        ctx.beginPath();
        shape.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.stroke();
      } else if (shape.tool === 'rect' || shape.tool === 'roundRect') {
        const [p1, p2] = shape.points;
        const w = p2.x - p1.x; const h = p2.y - p1.y;
        if (shape.tool === 'roundRect') {
          drawRoundRect(ctx, p1.x, p1.y, w, h, 12);
          if (shape.isFilled) ctx.fill(); ctx.stroke();
        } else {
          if (shape.isFilled) ctx.fillRect(p1.x, p1.y, w, h);
          ctx.strokeRect(p1.x, p1.y, w, h);
        }
      } else if (shape.tool === 'circle') {
        const [p1, p2] = shape.points;
        const r = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, 2 * Math.PI);
        if (shape.isFilled) ctx.fill(); ctx.stroke();
      } else if (shape.tool === 'line') {
        const [p1, p2] = shape.points;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      } else if (shape.tool === 'arrow') {
        const [p1, p2] = shape.points;
        drawArrow(ctx, p1.x, p1.y, p2.x, p2.y);
      } else if (shape.tool === 'text') {
        const [p1] = shape.points;
        ctx.font = `bold ${Math.max(16, shape.size * 5)}px Inter, sans-serif`;
        ctx.fillText(shape.text || '', p1.x, p1.y);
      }
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.lineWidth = 1 / scale;
        ctx.strokeStyle = STUDIO_THEME.accent;
        const pts = (shape.tool === 'pencil' || shape.tool === 'eraser') ? shape.points : [shape.points[0], shape.points[1] || shape.points[0]];
        const minX = Math.min(...pts.map(p => p.x)) - 10 / scale;
        const maxX = Math.max(...pts.map(p => p.x)) + 10 / scale;
        const minY = Math.min(...pts.map(p => p.y)) - 10 / scale;
        const maxY = Math.max(...pts.map(p => p.y)) + 10 / scale;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        ctx.setLineDash([]);
        ctx.fillStyle = STUDIO_THEME.accent;
        const hSize = 8 / scale;
        const handles = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: minX, y: maxY }, { x: maxX, y: maxY }, { x: (minX + maxX) / 2, y: minY }, { x: (minX + maxX) / 2, y: maxY }, { x: minX, y: (minY + maxY) / 2 }, { x: maxX, y: (minY + maxY) / 2 }];
        handles.forEach(h => { ctx.beginPath(); ctx.arc(h.x, h.y, hSize/2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      }
    });

    if (isDrawing && !['move', 'hand'].includes(tool)) {
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
        if (tool === 'roundRect') drawRoundRect(ctx, startPos.x, startPos.y, endX - startPos.x, endY - startPos.y, 12);
        else ctx.strokeRect(startPos.x, startPos.y, endX - startPos.x, endY - startPos.y);
        ctx.stroke();
      } else if (tool === 'circle') {
        const r = Math.sqrt(Math.pow(endX - startPos.x, 2) + Math.pow(endY - startPos.y, 2));
        ctx.beginPath(); ctx.arc(startPos.x, startPos.y, r, 0, 2 * Math.PI); ctx.stroke();
      } else if (tool === 'line') {
        ctx.beginPath(); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(endX, endY); ctx.stroke();
      } else if (tool === 'arrow') drawArrow(ctx, startPos.x, startPos.y, endX, endY);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }, [shapes, selectedShapeId, hoveredShapeId, tool, bgColor, gridVisible, pattern, gridSpacing, gridDotSize, isDrawing, currentPos, startPos, color, brushSize, isShiftPressed, offset, scale]);

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
    const pos = toWorldCoords(clientX - rect.left, clientY - rect.top);
    
    if (isSpacePressed || (e as React.MouseEvent).button === 1 || (e as React.MouseEvent).button === 2 || tool === 'hand') {
      setIsPanning(true);
      setStartPos({ x: clientX, y: clientY });
      return;
    }

    setStartPos(pos); setCurrentPos(pos);
    if (tool === 'move') {
      const hit = shapes.slice().reverse().find(s => checkHit(pos, s));
      if (hit) { setSelectedShapeId(hit.id); setIsDragging(true); }
      else setSelectedShapeId(null);
      return;
    }

    if (tool === 'text') {
      const screenPos = toScreenCoords(pos.x, pos.y);
      setTextInput({ visible: true, x: screenPos.x, y: screenPos.y, value: '' });
      setTimeout(() => textInputRef.current?.focus(), 10);
      return;
    }

    setIsDrawing(true); setSelectedShapeId(null);
    if (['pencil', 'eraser'].includes(tool)) {
      setShapes([...shapes, { id: Math.random().toString(36).substr(2, 9), tool, points: [pos], color, size: brushSize / scale, isFilled: false }]);
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

    if (tool === 'move' && !isDragging) {
      const hit = shapes.slice().reverse().find(s => checkHit(pos, s));
      setHoveredShapeId(hit?.id || null);
    }

    if (isDragging && selectedShapeId) {
      const dx = pos.x - currentPos.x; const dy = pos.y - currentPos.y;
      setShapes(prev => prev.map(s => s.id === selectedShapeId ? { ...s, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) } : s));
      setCurrentPos(pos); return;
    }

    setCurrentPos(pos);
    if (!isDrawing) return;

    if (['pencil', 'eraser'].includes(tool)) {
      setShapes(prev => {
        const last = prev[prev.length - 1];
        if (last && ['pencil', 'eraser'].includes(last.tool)) return [...prev.slice(0, -1), { ...last, points: [...last.points, pos] }];
        return prev;
      });
    }
  };

  const stopDrawing = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (isDragging) { setIsDragging(false); saveHistory(shapes); return; }
    if (!isDrawing) return;
    if (!['pencil', 'eraser', 'move', 'hand'].includes(tool)) {
      let endX = currentPos.x; let endY = currentPos.y;
      if (isShiftPressed && ['rect', 'circle', 'roundRect'].includes(tool)) {
        const dx = currentPos.x - startPos.x; const dy = currentPos.y - startPos.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        endX = startPos.x + (dx >= 0 ? size : -size); endY = startPos.y + (dy >= 0 ? size : -size);
      }
      saveHistory([...shapes, { id: Math.random().toString(36).substr(2, 9), tool, points: [startPos, { x: endX, y: endY }], color, size: brushSize / scale, isFilled }]);
    } else saveHistory(shapes);
    setIsDrawing(false);
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (textInput.value.trim()) {
      const worldPos = toWorldCoords(textInput.x, textInput.y);
      saveHistory([...shapes, { id: Math.random().toString(36).substr(2, 9), tool: 'text', points: [worldPos], color, size: brushSize / scale, isFilled: false, text: textInput.value }]);
    }
    setTextInput({ ...textInput, visible: false, value: '' });
  };

  // Fix: Implement saveToLocalStorage to handle session saving
  const saveToLocalStorage = useCallback((isAuto: boolean = false) => {
    try {
      const data = JSON.stringify({ shapes, scale, offset, bgColor, pattern, gridVisible });
      localStorage.setItem('codecanvas_whiteboard_state', data);
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }, [shapes, scale, offset, bgColor, pattern, gridVisible]);

  // Fix: Implement exportAsSVG to allow users to download their sketches as vector graphics
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
      if (shape.tool === 'pencil' || shape.tool === 'eraser') {
        const path = shape.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        svg += `<path d="${path}" stroke="${stroke}" stroke-width="${shape.size}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
      } else if (shape.tool === 'rect') {
        const [p1, p2] = shape.points;
        svg += `<rect x="${Math.min(p1.x, p2.x)}" y="${Math.min(p1.y, p2.y)}" width="${Math.abs(p2.x - p1.x)}" height="${Math.abs(p2.y - p1.y)}" stroke="${shape.color}" stroke-width="${shape.size}" fill="${fill}" />`;
      } else if (shape.tool === 'circle') {
        const [p1, p2] = shape.points;
        const r = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        svg += `<circle cx="${p1.x}" cy="${p1.y}" r="${r}" stroke="${shape.color}" stroke-width="${shape.size}" fill="${fill}" />`;
      } else if (shape.tool === 'text') {
        const [p1] = shape.points;
        svg += `<text x="${p1.x}" y="${p1.y}" fill="${shape.color}" font-family="Inter, sans-serif" font-weight="bold" font-size="${Math.max(16, shape.size * 5)}">${shape.text || ''}</text>`;
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

  // Fix: Implement exportAsPNG to allow users to download high-resolution raster images of their designs
  const exportAsPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `sketch-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
      <div className="absolute top-6 right-6 z-40 flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-col p-1 backdrop-blur-3xl border rounded-2xl shadow-2xl pointer-events-auto bg-slate-900/95 border-white/5">
           <button onClick={() => setScale(s => Math.min(s + 0.1, MAX_SCALE))} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><Plus size={16}/></button>
           <button onClick={() => { setScale(1); setOffset({x:0, y:0}); }} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all text-[10px] font-black">{Math.round(scale * 100)}%</button>
           <button onClick={() => setScale(s => Math.max(s - 0.1, MIN_SCALE))} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><Minus size={16}/></button>
           <div className="w-full h-px bg-white/5 my-1" />
           <button onClick={() => { setScale(1); setOffset({x:0,y:0}); }} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all" title="Reset Camera"><Maximize size={16}/></button>
        </div>
      </div>

      <div className={`absolute top-0 left-0 h-full w-72 z-50 backdrop-blur-3xl bg-slate-950/98 border-r border-white/5 transition-all duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 pt-24 space-y-8 h-full flex flex-col">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Library Control</span><button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={16} className="text-white"/></button></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8">
            <SidebarGroup label="Clipboard"><SidebarItem icon={<Copy size={16}/>} label="Copy" shortcut="Ctrl+C" onClick={handleCopy}/><SidebarItem icon={<Clipboard size={16}/>} label="Paste" shortcut="Ctrl+V" onClick={handlePaste} disabled={!clipboard}/><SidebarItem icon={<Files size={16}/>} label="Duplicate" shortcut="Ctrl+D" onClick={handleDuplicate}/></SidebarGroup>
            <SidebarGroup label="Session"><SidebarItem icon={<Save size={16}/>} label="Checkpoint" onClick={() => saveToLocalStorage(false)}/><SidebarItem icon={<History size={16}/>} label="History" onClick={() => setIsSidebarOpen(false)}/></SidebarGroup>
            <SidebarGroup label="Output"><SidebarItem icon={<FileCode size={16}/>} label="Export SVG" onClick={exportAsSVG}/><SidebarItem icon={<FileImage size={16}/>} label="Export PNG" onClick={exportAsPNG}/></SidebarGroup>
          </div>
          <div className="p-6 border-t border-white/5 bg-black/20 rounded-xl flex items-center gap-3"><Monitor size={14} className="text-indigo-400"/><div className="flex flex-col"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Arch_v4.7</span><span className="text-[10px] font-mono font-bold text-indigo-300">Infinite_Render</span></div></div>
        </div>
      </div>

      <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onContextMenu={(e) => e.preventDefault()} className={`w-full h-full touch-none ${isPanning ? 'cursor-grabbing' : tool === 'hand' ? 'cursor-grab' : tool === 'text' ? 'cursor-text' : tool === 'move' ? (hoveredShapeId ? 'cursor-grab' : 'cursor-default') : 'cursor-crosshair'}`} />

      {textInput.visible && (
        <form onSubmit={handleTextSubmit} style={{ position: 'absolute', left: textInput.x, top: textInput.y - 10 }} className="z-20">
          <input ref={textInputRef} type="text" value={textInput.value} onChange={(e) => setTextInput({ ...textInput, value: e.target.value })} onBlur={() => handleTextSubmit()} className="bg-transparent border-none outline-none p-0" style={{ color, fontSize: `${Math.max(16, brushSize * 5)}px`, transform: `scale(${scale})`, transformOrigin: 'top left', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }} />
        </form>
      )}

      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 w-full max-w-fit pointer-events-none z-30">
        <div className="flex items-center gap-1.5 p-1.5 backdrop-blur-3xl border rounded-2xl shadow-2xl pointer-events-auto bg-slate-900/95 border-white/5">
          <div className="flex items-center gap-1 px-1 border-r border-white/10">
            <ToolButton active={tool === 'hand'} onClick={() => { setTool('hand'); setSelectedShapeId(null); }} title="Hand (H)"><Hand size={18} /></ToolButton>
            <ToolButton active={tool === 'move'} onClick={() => { setTool('move'); setSelectedShapeId(null); }} title="Select (V)"><MousePointer2 size={18} /></ToolButton>
            <ToolButton active={tool === 'pencil'} onClick={() => { setTool('pencil'); setSelectedShapeId(null); }} title="Draw (P)"><Pencil size={18} /></ToolButton>
            <ToolButton active={tool === 'eraser'} onClick={() => { setTool('eraser'); setSelectedShapeId(null); }} title="Erase (E)"><Eraser size={18} /></ToolButton>
            <ToolButton active={tool === 'text'} onClick={() => { setTool('text'); setSelectedShapeId(null); }} title="Label (T)"><TypeIcon size={18} /></ToolButton>
          </div>
          <div className="flex items-center gap-1 px-1 border-r border-white/10">
            <ToolButton active={tool === 'rect'} onClick={() => { setTool('rect'); setSelectedShapeId(null); }}><Square size={18} /></ToolButton>
            <ToolButton active={tool === 'circle'} onClick={() => { setTool('circle'); setSelectedShapeId(null); }}><Circle size={18} /></ToolButton>
            <ToolButton active={tool === 'arrow'} onClick={() => { setTool('arrow'); setSelectedShapeId(null); }}><ArrowUpRight size={18} /></ToolButton>
            <ToolButton active={isFilled} onClick={() => setIsFilled(!isFilled)}><PaintBucket size={18} /></ToolButton>
          </div>
          <div className="flex items-center gap-1 px-1 border-r border-white/10"><ToolButton disabled={undoStack.length === 0} onClick={undo}><Undo2 size={18} /></ToolButton><ToolButton disabled={redoStack.length === 0} onClick={redo}><Redo2 size={18} /></ToolButton></div>
          <div className="flex gap-1.5 px-2 items-center relative">
            {PRIMARY_COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white' : 'border-slate-800'}`} style={{ backgroundColor: c }} />)}
            <button onClick={() => setShowColorPalette(!showColorPalette)} className="p-2 rounded-xl text-slate-500 hover:text-white"><Palette size={18} /></button>
            <button onClick={() => setShowClearConfirm(true)} className="p-2 rounded-xl text-slate-500 hover:text-rose-500"><Trash2 size={18} /></button>
          </div>
        </div>
        <div className="flex items-center gap-4 px-6 py-2.5 backdrop-blur-xl border rounded-full bg-slate-900/80 border-white/5 pointer-events-auto">
          <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 h-1 appearance-none bg-slate-700 accent-indigo-500 rounded-lg cursor-pointer" />
          <span className="text-[10px] font-mono font-bold w-6 text-slate-400">{brushSize}px</span>
          <button onClick={() => setShowSurfaceSettings(!showSurfaceSettings)} className="p-1 text-slate-500 hover:text-white"><Settings2 size={16} /></button>
        </div>
      </div>
    </div>
  );
});

const SidebarGroup = ({ label, children }: any) => <div className="space-y-4"><label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 flex items-center gap-3"><div className="w-6 h-px bg-white/5" /> {label}</label><div className="space-y-1">{children}</div></div>;
const SidebarItem = ({ icon, label, shortcut, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled} className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${disabled ? 'opacity-20' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}><div className="flex items-center gap-4">{icon}<span className="text-[11px] font-bold">{label}</span></div>{shortcut && <span className="text-[9px] font-mono font-bold opacity-30">{shortcut}</span>}</button>;
const ToolButton = ({ active, children, onClick, title, disabled }: any) => <button onClick={onClick} title={title} disabled={disabled} className={`p-2.5 rounded-xl transition-all ${disabled ? 'opacity-20' : active ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}>{children}</button>;

export default Whiteboard;
