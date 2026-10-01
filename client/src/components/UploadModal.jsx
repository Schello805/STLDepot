import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { 
  X, 
  UploadCloud, 
  FileBox, 
  Trash2, 
  Sparkles, 
  Plus, 
  Check, 
  Layers, 
  Clock, 
  Ruler, 
  Palette, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Files,
  FolderArchive,
  RotateCw,
  Box,
  RefreshCw,
  Maximize2,
  Globe,
  Link2,
  ExternalLink
} from 'lucide-react';
import { 
  parseSTL, 
  parse3MF, 
  centerAndAlignGeometry, 
  analyzeGeometry, 
  generateThumbnailSnapshot 
} from '../utils/threeUtils';
import { formatTitleFromFilename } from '../utils/formatUtils';
import confetti from 'canvas-confetti';

export default function UploadModal({ onClose, onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [uploadMode, setUploadMode] = useState('single'); // 'single', 'batch', 'assembly'
  
  // Basic metadata
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Deko & Haushalt');
  const [author, setAuthor] = useState('');
  
  // Collapsed advanced print parameters (closed by default!)
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced print parameters
  const [description, setDescription] = useState('');
  const [filamentType, setFilamentType] = useState('PLA');
  const [filamentColor, setFilamentColor] = useState('#38bdf8');
  const [isMultiColor, setIsMultiColor] = useState(false);
  const [infill, setInfill] = useState(15);
  const [printTime, setPrintTime] = useState('');
  const [nozzleSize, setNozzleSize] = useState(0.4);
  const [supports, setSupports] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);

  // Interactive 3D Canvas States
  const canvasContainerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef = useRef(null);
  const animFrameRef = useRef(null);
  const targetLookAtRef = useRef(new THREE.Vector3(0, 10, 0));
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });

  const [isParsing3D, setIsParsing3D] = useState(false);
  const [previewStats, setPreviewStats] = useState(null);
  const [currentGeometry, setCurrentGeometry] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const gridRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [activeSourceTab, setActiveSourceTab] = useState('file'); // 'file' or 'web'
  const [webUrl, setWebUrl] = useState('');
  const [webStatus, setWebStatus] = useState('');

  const handleWebImport = async (e) => {
    e.preventDefault();
    if (!webUrl.trim() || !webUrl.startsWith('http')) {
      setError('Bitte gib eine gültige URL ein (z.B. von MakerWorld, Printables, Thingiverse oder direkte .stl/.3mf URL).');
      return;
    }

    setUploading(true);
    setError(null);
    setWebStatus('Analysiere Web-Quelle und lade 3D-Dateien herunter...');

    try {
      const res = await fetch('/api/web-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webUrl.trim(),
          category,
          filament_type: filamentType,
          filament_color: filamentColor
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Web-Import fehlgeschlagen');
      }

      confetti({ particleCount: 70, spread: 80, origin: { y: 0.7 } });
      onUploadSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Verbindungsfehler beim Web-Import');
    } finally {
      setUploading(false);
      setWebStatus('');
    }
  };

  const categories = [
    'Deko & Haushalt',
    'Werkstatt & Tools',
    '3D-Druck Zubehör',
    'Gadgets & Elektronik',
    'Tabletop & Gaming',
    'Prototypen',
    'Kalibrierung & Test',
    'Sonstiges'
  ];

  const filamentOptions = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU / Flex', 'PCTG', 'Nylon / PA', 'PC', 'Resin'];

  // Initialize Three.js interactive canvas in modal
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 260;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(90, 80, 110);
    camera.lookAt(targetLookAtRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(150, 200, 150);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
    dirLight2.position.set(-150, 100, -150);
    scene.add(dirLight2);

    // Bed Grid (hidden by default)
    const grid = new THREE.GridHelper(220, 22, 0x06b6d4, 0x334155);
    grid.position.y = 0;
    grid.visible = false;
    scene.add(grid);
    gridRef.current = grid;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (autoRotate && meshRef.current) {
        meshRef.current.rotation.y += 0.012;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer) {
        renderer.dispose();
        try {
          renderer.forceContextLoss();
          const gl = renderer.getContext();
          gl?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch (e) {}
      }
    };
  }, [files.length > 0]);

  // Load geometry into Three.js canvas
  const load3DFileIntoCanvas = async (file) => {
    setIsParsing3D(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      let geom;
      if (file.name.toLowerCase().endsWith('.3mf')) {
        geom = await parse3MF(buffer);
        const hasColors = geom.hasAttribute('color') || !!geom.userData?.hasVertexColors || (geom.userData?.filamentColors && geom.userData.filamentColors.length > 1);
        if (hasColors) {
          setIsMultiColor(true);
        }
      } else {
        geom = parseSTL(buffer);
      }

      centerAndAlignGeometry(geom);
      const stats = analyzeGeometry(geom);
      setPreviewStats(stats);
      setCurrentGeometry(geom);

      if (sceneRef.current) {
        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
          meshRef.current.geometry.dispose();
          meshRef.current.material.dispose();
        }

        const hasColors = geom.hasAttribute('color') || !!geom.userData?.hasVertexColors || (geom.userData?.filamentColors && geom.userData.filamentColors.length > 1);
        const material = new THREE.MeshStandardMaterial({
          color: hasColors ? 0xffffff : new THREE.Color(filamentColor),
          vertexColors: hasColors,
          metalness: 0.2,
          roughness: 0.45
        });
        const mesh = new THREE.Mesh(geom, material);
        sceneRef.current.add(mesh);
        meshRef.current = mesh;

        // Auto position camera
        const bbox = geom.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 20);
        const dist = maxDim * 2.2;
        targetLookAtRef.current.set(0, size.y / 2, 0);

        if (cameraRef.current) {
          cameraRef.current.position.set(dist * 0.9, dist * 0.8, dist * 1.1);
          cameraRef.current.lookAt(targetLookAtRef.current);
        }
      }
    } catch (err) {
      console.error('Error loading 3D preview:', err);
      setError(`3D-Vorschau Fehler: ${err.message || 'Datei konnte nicht gelesen werden'}`);
    } finally {
      setIsParsing3D(false);
    }
  };

  const handleFileChange = async (newFiles) => {
    const validFiles = Array.from(newFiles);
    if (validFiles.length === 0) return;

    setFiles(prev => [...prev, ...validFiles]);

    if (validFiles.length > 1 || files.length + validFiles.length > 1) {
      setUploadMode('batch');
    }

    if (!title && validFiles[0]) {
      const formattedTitle = formatTitleFromFilename(validFiles[0].name);
      setTitle(formattedTitle);
    }

    const first3d = validFiles.find(f => f.name.toLowerCase().endsWith('.stl') || f.name.toLowerCase().endsWith('.3mf'));
    if (first3d) {
      setTimeout(() => load3DFileIntoCanvas(first3d), 50);
    }
  };

  // Update mesh color in real-time
  const handleColorChange = (newColor) => {
    setFilamentColor(newColor);
    if (meshRef.current) {
      meshRef.current.material.color.set(newColor);
    }
  };

  const removeFile = (index) => {
    const remaining = files.filter((_, i) => i !== index);
    setFiles(remaining);
    if (remaining.length === 0) {
      setPreviewStats(null);
      setCurrentGeometry(null);
      setUploadMode('single');
      if (meshRef.current && sceneRef.current) {
        sceneRef.current.remove(meshRef.current);
        meshRef.current = null;
      }
    } else if (remaining.length === 1) {
      setUploadMode('single');
    }
  };

  // Update Grid visibility
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Custom Mouse/Touch Orbit Controls
  const handleMouseDown = (e) => {
    if (e.button === 0) isDraggingRef.current = true;
    if (e.button === 2 || e.shiftKey) isPanningRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current && !isPanningRef.current) return;
    if (!cameraRef.current) return;

    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;

    if (isPanningRef.current) {
      const factor = 0.2;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraRef.current.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraRef.current.quaternion);
      cameraRef.current.position.addScaledVector(right, -deltaX * factor);
      cameraRef.current.position.addScaledVector(up, deltaY * factor);
      targetLookAtRef.current.addScaledVector(right, -deltaX * factor);
      targetLookAtRef.current.addScaledVector(up, deltaY * factor);
      cameraRef.current.lookAt(targetLookAtRef.current);
    } else if (isDraggingRef.current) {
      const rotSpeed = 0.008;
      const offset = cameraRef.current.position.clone().sub(targetLookAtRef.current);
      let radius = offset.length();
      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

      theta -= deltaX * rotSpeed;
      phi -= deltaY * rotSpeed;
      phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));

      offset.x = radius * Math.sin(phi) * Math.sin(theta);
      offset.y = radius * Math.cos(phi);
      offset.z = radius * Math.sin(phi) * Math.cos(theta);

      cameraRef.current.position.copy(targetLookAtRef.current).add(offset);
      cameraRef.current.lookAt(targetLookAtRef.current);
    }

    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e) => {
    if (!cameraRef.current) return;
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    const offset = cameraRef.current.position.clone().sub(targetLookAtRef.current);
    offset.multiplyScalar(zoomFactor);
    cameraRef.current.position.copy(targetLookAtRef.current).add(offset);
  };

  // Touch handlers for mobile
  const uploadTouchDistRef = useRef(0);
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      uploadTouchDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDraggingRef.current && cameraRef.current) {
      const deltaX = e.touches[0].clientX - prevMouseRef.current.x;
      const deltaY = e.touches[0].clientY - prevMouseRef.current.y;
      const rotSpeed = 0.01;
      const offset = cameraRef.current.position.clone().sub(targetLookAtRef.current);
      let radius = offset.length();
      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

      theta -= deltaX * rotSpeed;
      phi -= deltaY * rotSpeed;
      phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));

      offset.x = radius * Math.sin(phi) * Math.sin(theta);
      offset.y = radius * Math.cos(phi);
      offset.z = radius * Math.sin(phi) * Math.cos(theta);

      cameraRef.current.position.copy(targetLookAtRef.current).add(offset);
      cameraRef.current.lookAt(targetLookAtRef.current);
      prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && cameraRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (uploadTouchDistRef.current > 0) {
        const factor = uploadTouchDistRef.current / dist;
        const zoomDelta = factor > 1 ? 1.03 : 0.97;
        const offset = cameraRef.current.position.clone().sub(targetLookAtRef.current);
        offset.multiplyScalar(zoomDelta);
        cameraRef.current.position.copy(targetLookAtRef.current).add(offset);
      }
      uploadTouchDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    uploadTouchDistRef.current = 0;
  };

  const setCameraView = (view) => {
    if (!cameraRef.current || !meshRef.current) return;
    const bbox = new THREE.Box3().setFromObject(meshRef.current);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 20);
    const dist = maxDim * 2.2;
    const center = targetLookAtRef.current;

    switch (view) {
      case 'top':
        cameraRef.current.position.set(0, dist * 1.5, 0.001);
        break;
      case 'front':
        cameraRef.current.position.set(0, center.y, dist * 1.5);
        break;
      case 'iso':
      default:
        cameraRef.current.position.set(dist * 0.9, dist * 0.8, dist * 1.1);
        break;
    }
    cameraRef.current.lookAt(center);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleKeyDownTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Bitte wähle mindestens eine 3D-Datei (.stl, .3mf) aus.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(10);

    try {
      // Capture high-res snapshot from current 3D perspective
      let thumbnailDataUrl = '';
      if (rendererRef.current) {
        thumbnailDataUrl = rendererRef.current.domElement.toDataURL('image/png');
      } else if (currentGeometry) {
        thumbnailDataUrl = await generateThumbnailSnapshot(currentGeometry, filamentColor, 600, 450);
      }

      // BULK MODE: Upload files as individual models in chunks
      if (uploadMode === 'batch') {
        const CHUNK_SIZE = 25;
        const totalFiles = files.length;
        let processed = 0;

        for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
          const chunk = files.slice(i, i + CHUNK_SIZE);
          const formData = new FormData();
          formData.append('category', category);
          formData.append('author', author.trim() || 'Michael Schellenberger');
          formData.append('filament_type', filamentType);
          formData.append('filament_color', filamentColor);
          formData.append('is_multicolor', isMultiColor ? 1 : 0);
          formData.append('tags', JSON.stringify(tags));

          for (const file of chunk) {
            formData.append('files', file);
          }

          const res = await fetch('/api/models/batch', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Fehler beim Massen-Upload');
          }

          processed += chunk.length;
          setUploadProgress(Math.round((processed / totalFiles) * 100));
        }

        confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
        onUploadSuccess();
        onClose();
        return;
      }

      // SINGLE or MULTI-PART ASSEMBLY PROJECT MODE
      if (!title.trim()) {
        setError('Bitte gib einen Titel für das Modell ein.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('author', author.trim() || 'Michael Schellenberger');
      formData.append('filament_type', filamentType);
      formData.append('filament_color', filamentColor);
      formData.append('is_multicolor', isMultiColor ? 1 : 0);
      formData.append('infill_percentage', infill);
      formData.append('print_time_minutes', parseInt(printTime, 10) || 0);
      formData.append('nozzle_size', nozzleSize);
      formData.append('supports_needed', supports ? 1 : 0);
      formData.append('source_url', sourceUrl.trim());
      formData.append('notes', notes.trim());
      formData.append('tags', JSON.stringify(tags));

      if (thumbnailDataUrl) {
        formData.append('thumbnail_base64', thumbnailDataUrl);
      }

      for (const file of files) {
        formData.append('files', file);
      }

      setUploadProgress(60);
      const res = await fetch('/api/models', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

      setUploadProgress(100);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.7 } });
      onUploadSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Verbindungsfehler zum Server');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">3D-Modelle hinzufügen</h2>
              <p className="text-xs text-slate-400">STL & 3MF Dateien hochladen oder direkt aus dem Web importieren</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Switcher Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => { setActiveSourceTab('file'); setError(null); }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
              activeSourceTab === 'file'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Lokale Dateien hochladen</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveSourceTab('web'); setError(null); }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
              activeSourceTab === 'web'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Aus dem Web importieren</span>
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold">MakerWorld / 3MF</span>
          </button>
        </div>

        {/* TAB 2: WEB IMPORTER */}
        {activeSourceTab === 'web' ? (
          <form onSubmit={handleWebImport} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-950 to-slate-900 border border-cyan-500/20 space-y-3">
              <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm">
                <Globe className="w-4 h-4" />
                <span>Direkt von Plattformen oder per 3D-Link importieren</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Füge einen Link zu einer Modellseite auf <span className="text-slate-200 font-semibold">MakerWorld</span>, <span className="text-slate-200 font-semibold">Printables</span>, <span className="text-slate-200 font-semibold">Thingiverse</span> oder eine direkte <span className="text-slate-200 font-semibold">.stl / .3mf</span> URL ein. STLDepot lädt Titel, Beschreibung, Bild und 3D-Geometrie automatisch in deinen lokalen Vault herunter.
              </p>
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Modell-URL oder Direkter Dateilink</span>
                <span className="text-[10px] text-cyan-400 font-normal">HTTP / HTTPS</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://makerworld.com/de/models/... oder https://example.com/model.stl"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-2xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition shadow-inner font-mono"
                  required
                />
                <Link2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Quick Platform Presets */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-2">Unterstützte Plattformen:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-medium">MakerWorld</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span className="font-medium">Printables</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="font-medium">Thingiverse</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="font-medium">Direkte STL/3MF</span>
                </div>
              </div>
            </div>

            {/* Basic Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Standard-Kategorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Standard-Material
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={filamentType}
                    onChange={(e) => setFilamentType(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {filamentOptions.map((fil) => (
                      <option key={fil} value={fil}>{fil}</option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={filamentColor}
                    onChange={(e) => setFilamentColor(e.target.value)}
                    className="w-10 h-9 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer p-0.5"
                    title="Filament-Farbe wählen"
                  />
                </div>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="p-4 rounded-2xl bg-cyan-950/60 border border-cyan-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-200">
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>{webStatus || 'Lade Web-Inhalte herunter...'}</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-cyan-900">
                  <div className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 animate-pulse w-full" />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={uploading || !webUrl.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Importiere...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Aus Web importieren</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
        /* TAB 1: LOCAL FILE UPLOADER */
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* HIDDEN FILE INPUT */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".stl,.3mf,.zip,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files)}
          />

          {/* 1. DROPZONE (ONLY SHOWN WHEN NO FILES SELECTED) */}
          {files.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileChange(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center cursor-pointer bg-slate-950/60 hover:bg-slate-950/80 transition-all text-center group shadow-inner"
            >
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                Klicke hier oder ziehe STL- / 3MF-Dateien hinein
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Unterstützt STL & 3MF (inkl. Bambu Studio, OrcaSlicer, PrusaSlicer)
              </p>
            </div>
          ) : (
            /* 2. REPLACED BY INTERACTIVE 3D PREVIEW & FILE BAR ONCE FILES ARE SELECTED */
            <div className="space-y-3">
              
              {/* Selected File Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileBox className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-slate-100 font-semibold truncate">{files[0].name}</span>
                  <span className="text-slate-500 font-mono text-[10px]">({(files[0].size / 1024).toFixed(0)} KB)</span>
                  {files.length > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                      +{files.length - 1} weitere
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Andere Datei</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(0)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition"
                    title="Datei entfernen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* INTERACTIVE 3D VIEWPORT */}
              <div className="relative h-64 sm:h-72 rounded-2xl bg-slate-950 border border-cyan-500/30 overflow-hidden shadow-2xl flex flex-col group select-none touch-none">
                
                {/* 3D WebGL Canvas */}
                <div
                  ref={canvasContainerRef}
                  className="w-full h-full cursor-grab active:cursor-grabbing flex-1"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => e.preventDefault()}
                />

                {/* Parsing / Loading Overlay */}
                {isParsing3D && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-cyan-300 z-20 space-y-3">
                    <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                    <div className="text-center">
                      <p className="text-xs font-semibold">3D-Geometrie wird geladen...</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Parse STL/3MF Geometrie & erstelle Vorschau</p>
                    </div>
                  </div>
                )}

                {/* Top Floating Controls */}
                {!isParsing3D && (
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 pointer-events-auto shadow-md">
                      <button 
                        type="button"
                        onClick={() => setCameraView('iso')} 
                        className="px-2 py-0.5 text-[11px] font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
                      >
                        ISO
                      </button>
                      <button 
                        type="button"
                        onClick={() => setCameraView('top')} 
                        className="px-2 py-0.5 text-[11px] font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
                      >
                        Drauf
                      </button>
                      <button 
                        type="button"
                        onClick={() => setCameraView('front')} 
                        className="px-2 py-0.5 text-[11px] font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
                      >
                        Vorne
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      <button
                        type="button"
                        onClick={() => setShowGrid(!showGrid)}
                        className={`p-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 transition ${showGrid ? 'text-cyan-400 bg-cyan-950/60 border-cyan-500/60' : 'text-slate-400 hover:text-white'}`}
                        title="Druckbett Gitter ein-/ausblenden"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoRotate(!autoRotate)}
                        className={`p-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 transition ${autoRotate ? 'text-cyan-400 bg-cyan-950/60 border-cyan-500/60' : 'text-slate-400 hover:text-white'}`}
                        title="Auto-Drehung"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Dimension Stats Overlay */}
                {previewStats && !isParsing3D && (
                  <div className="absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-cyan-300 pointer-events-none flex items-center gap-2 shadow-md">
                    <Box className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{previewStats.dimensions.x} × {previewStats.dimensions.y} × {previewStats.dimensions.z} mm</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">{previewStats.volumeCm3} cm³</span>
                  </div>
                )}

                <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-[10px] text-slate-400 pointer-events-none">
                  🖱️ Maus: Drehen / Zoomen
                </div>

              </div>
            </div>
          )}

          {/* Mode Switcher when multiple files are selected */}
          {files.length > 1 && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Import-Modus für {files.length} Dateien:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('batch')}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    uploadMode === 'batch'
                      ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-950/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Files className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="text-left">
                    <div className="font-bold">Massen-Import</div>
                    <div className="text-[10px] text-slate-400">{files.length} separate Modelle</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('assembly')}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    uploadMode === 'assembly'
                      ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-950/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <FolderArchive className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="text-left">
                    <div className="font-bold">Baugruppe</div>
                    <div className="text-[10px] text-slate-400">1 Modell mit {files.length} Teilen</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Simple Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Title only needed for single or assembly mode */}
            {uploadMode !== 'batch' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Titel des Modells *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. Mini Stormtrooper"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Kategorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filament Color (Live re-render on change) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Vorschau-Farbe (Filament)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={filamentColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={filamentColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono uppercase"
                />
              </div>
            </div>

            {/* Multicolor Purge Waste Toggle */}
            <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Palette className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-200 block flex items-center gap-1.5">
                    Mehrfarbdruck (3MF / Farbwechsel-Zuschlag)
                    {isMultiColor && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                        +10% aktiv
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Schlägt ca. 10% Spülverlust (Purge Tower / Filamentwechsel) auf das Modellgewicht und den Druckpreis auf.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMultiColor}
                  onChange={(e) => setIsMultiColor(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

          </div>

          {/* Collapsible Advanced Print Parameters Accordion (COLLAPSED BY DEFAULT) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/60 transition"
            >
              <span className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-cyan-400" />
                <span>Erweiterte Druckinfos & Notizen (optional)</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Filament-Material
                    </label>
                    <select
                      value={filamentType}
                      onChange={(e) => setFilamentType(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      {filamentOptions.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Infill ({infill}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={infill}
                      onChange={(e) => setInfill(parseInt(e.target.value, 10))}
                      className="w-full accent-cyan-500 cursor-pointer mt-2"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Druckzeit (Minuten)
                    </label>
                    <input
                      type="number"
                      value={printTime}
                      onChange={(e) => setPrintTime(e.target.value)}
                      placeholder="z. B. 60"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Düse (Nozzle mm)
                    </label>
                    <select
                      value={nozzleSize}
                      onChange={(e) => setNozzleSize(parseFloat(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="0.2">0.2 mm</option>
                      <option value="0.4">0.4 mm (Standard)</option>
                      <option value="0.6">0.6 mm</option>
                      <option value="0.8">0.8 mm</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Schlagwörter / Tags
                    </label>
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl">
                      {tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-800 text-xs text-cyan-300">
                          #{tag}
                          <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-white">✕</button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleKeyDownTag}
                        placeholder="Tag eingeben (Enter)..."
                        className="flex-1 bg-transparent text-xs text-slate-100 focus:outline-none min-w-[120px]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Notizen & Druckhinweise
                    </label>
                    <textarea
                      rows="2"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="z. B. Mit Brim drucken für bessere Haftung..."
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="p-4 rounded-2xl bg-cyan-950/60 border border-cyan-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-cyan-200">
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  Speichere in Vault...
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-cyan-900">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading || isParsing3D || files.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Speichere...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{uploadMode === 'batch' ? `Alle ${files.length} Modelle speichern` : 'Im Katalog speichern'}</span>
                </>
              )}
            </button>
          </div>

        </form>
        )}
      </div>
    </div>
  );
}

