import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { parseSTL, parse3MF, centerAndAlignGeometry, analyzeGeometry } from '../utils/threeUtils';
import { 
  RotateCw, 
  Box, 
  Maximize2, 
  Eye, 
  Layers, 
  Camera, 
  RefreshCcw, 
  Sun, 
  Palette, 
  Ruler,
  Sliders
} from 'lucide-react';

export default function ThreeCanvas({ 
  fileUrl, 
  fileType = 'stl', 
  initialColor = '#38bdf8', 
  onGeometryLoaded, 
  interactive = true,
  height = '400px'
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef = useRef(null);
  const gridRef = useRef(null);
  const bboxHelperRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [color, setColor] = useState(initialColor);
  const [materialMode, setMaterialMode] = useState('standard'); // standard, wireframe, normal, metallic
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showBBox, setShowBBox] = useState(false);
  const [stats, setStats] = useState(null);

  // Drag interaction states
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const targetLookAtRef = useRef(new THREE.Vector3(0, 10, 0));

  useEffect(() => {
    setColor(initialColor);
  }, [initialColor]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(100, 90, 120);
    camera.lookAt(targetLookAtRef.current);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(150, 250, 180);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90cdf4, 0.5);
    dirLight2.position.set(-150, 100, -150);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.4);
    scene.add(hemiLight);

    // Build Plate Grid (256x256mm standard maker bed)
    const gridSize = 250;
    const gridDivisions = 25;
    const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x06b6d4, 0x334155);
    grid.position.y = 0;
    scene.add(grid);
    gridRef.current = grid;

    // Bed Plate outline plane
    const bedGeo = new THREE.PlaneGeometry(gridSize, gridSize);
    const bedMat = new THREE.MeshBasicMaterial({ 
      color: 0x0f172a, 
      transparent: true, 
      opacity: 0.4, 
      side: THREE.DoubleSide 
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.rotation.x = Math.PI / 2;
    bedMesh.position.y = -0.1;
    scene.add(bedMesh);

    // Animation Loop
    let rotAngle = 0;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (autoRotate && meshRef.current) {
        meshRef.current.rotation.y += 0.01;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer) renderer.dispose();
    };
  }, []);

  // Load Model File
  useEffect(() => {
    if (!fileUrl || !sceneRef.current) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadModel = async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Datei konnte nicht geladen werden (${response.statusText})`);
        const arrayBuffer = await response.arrayBuffer();

        let geometry;
        const ext = fileType.toLowerCase();
        if (ext === '3mf') {
          geometry = await parse3MF(arrayBuffer);
        } else {
          geometry = parseSTL(arrayBuffer);
        }

        if (!isMounted) return;

        // Clean previous mesh & helpers
        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
          meshRef.current.geometry.dispose();
          meshRef.current.material.dispose();
        }
        if (bboxHelperRef.current) {
          sceneRef.current.remove(bboxHelperRef.current);
        }

        // Align geometry to build plate
        centerAndAlignGeometry(geometry);
        const modelStats = analyzeGeometry(geometry);
        setStats(modelStats);
        if (onGeometryLoaded) onGeometryLoaded(modelStats, geometry);

        // Material creation
        const material = createMaterial(materialMode, color);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        sceneRef.current.add(mesh);
        meshRef.current = mesh;

        // Bounding Box Frame
        const bbox = new THREE.Box3().setFromObject(mesh);
        const boxHelper = new THREE.Box3Helper(bbox, 0x38bdf8);
        boxHelper.visible = showBBox;
        sceneRef.current.add(boxHelper);
        bboxHelperRef.current = boxHelper;

        // Auto position camera based on model size
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 20);
        const dist = maxDim * 2.2;
        
        targetLookAtRef.current.set(0, size.y / 2, 0);
        if (cameraRef.current) {
          cameraRef.current.position.set(dist * 0.9, dist * 0.8, dist * 1.1);
          cameraRef.current.lookAt(targetLookAtRef.current);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error parsing 3D file:', err);
        if (isMounted) {
          setError(err.message || 'Fehler beim Parsen der 3D-Datei');
          setLoading(false);
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
    };
  }, [fileUrl, fileType]);

  // Update material / color
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.material = createMaterial(materialMode, color);
    }
  }, [color, materialMode]);

  // Update Grid / BBox visibility
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
    if (bboxHelperRef.current) bboxHelperRef.current.visible = showBBox;
  }, [showGrid, showBBox]);

  function createMaterial(mode, col) {
    switch (mode) {
      case 'wireframe':
        return new THREE.MeshBasicMaterial({ color: col, wireframe: true });
      case 'normal':
        return new THREE.MeshNormalMaterial();
      case 'metallic':
        return new THREE.MeshStandardMaterial({
          color: col,
          metalness: 0.85,
          roughness: 0.2
        });
      case 'standard':
      default:
        return new THREE.MeshStandardMaterial({
          color: col,
          metalness: 0.15,
          roughness: 0.45
        });
    }
  }

  // Camera presets
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
      case 'right':
        cameraRef.current.position.set(dist * 1.5, center.y, 0);
        break;
      case 'iso':
      default:
        cameraRef.current.position.set(dist * 0.9, dist * 0.8, dist * 1.1);
        break;
    }
    cameraRef.current.lookAt(center);
  };

  // Custom Mouse/Touch Controls
  const handleMouseDown = (e) => {
    if (!interactive) return;
    if (e.button === 0) isDraggingRef.current = true;
    if (e.button === 2 || e.shiftKey) isPanningRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!interactive || (!isDraggingRef.current && !isPanningRef.current)) return;

    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    if (isPanningRef.current) {
      // Pan camera & target
      const factor = 0.2;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraRef.current.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraRef.current.quaternion);

      cameraRef.current.position.addScaledVector(right, -deltaX * factor);
      cameraRef.current.position.addScaledVector(up, deltaY * factor);
      targetLookAtRef.current.addScaledVector(right, -deltaX * factor);
      targetLookAtRef.current.addScaledVector(up, deltaY * factor);
      cameraRef.current.lookAt(targetLookAtRef.current);
    } else if (isDraggingRef.current && meshRef.current) {
      // Orbit rotation around target
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

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e) => {
    if (!interactive || !cameraRef.current) return;
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    const offset = cameraRef.current.position.clone().sub(targetLookAtRef.current);
    offset.multiplyScalar(zoomFactor);
    cameraRef.current.position.copy(targetLookAtRef.current).add(offset);
  };

  // Touch Controls for Smartphone & Tablet
  const touchStartDistRef = useRef(0);
  const handleTouchStart = (e) => {
    if (!interactive) return;
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e) => {
    if (!interactive) return;
    if (e.touches.length === 1 && isDraggingRef.current) {
      const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
      const deltaY = e.touches[0].clientY - previousMousePositionRef.current.y;
      
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
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && cameraRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (touchStartDistRef.current > 0) {
        const factor = touchStartDistRef.current / dist;
        const zoomDelta = factor > 1 ? 1.03 : 0.97;
        const offset = cameraRef.current.position.clone().sub(targetLookAtRef.current);
        offset.multiplyScalar(zoomDelta);
        cameraRef.current.position.copy(targetLookAtRef.current).add(offset);
      }
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchStartDistRef.current = 0;
  };

  const filamentColors = [
    { name: 'Cyan Blau', hex: '#38bdf8' },
    { name: 'Maker Orange', hex: '#f97316' },
    { name: 'Neon Grün', hex: '#22c55e' },
    { name: 'Signal Rot', hex: '#ef4444' },
    { name: 'Lila Purple', hex: '#a855f7' },
    { name: 'Anthrazit Grau', hex: '#475569' },
    { name: 'Weiß', hex: '#f8fafc' },
    { name: 'Gelb', hex: '#eab308' },
  ];

  return (
    <div 
      className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-2xl flex flex-col group select-none touch-none"
      style={{ height }}
    >
      {/* 3D Canvas Viewport */}
      <div 
        ref={containerRef}
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

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-200 z-20">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium tracking-wide">3D-Modell wird gerendert...</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-red-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-red-200 p-6 text-center z-20">
          <Box className="w-10 h-10 text-red-400 mb-2" />
          <p className="font-semibold text-base mb-1">Vorschau nicht verfügbar</p>
          <p className="text-xs text-red-300/80 max-w-sm">{error}</p>
        </div>
      )}

      {/* Top Floating Controls Bar */}
      {interactive && !loading && !error && (
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          {/* Quick Camera Presets */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 pointer-events-auto shadow-lg">
            <button 
              onClick={() => setCameraView('iso')} 
              title="Isometrische Ansicht" 
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              ISO
            </button>
            <button 
              onClick={() => setCameraView('top')} 
              title="Draufsicht (Top)" 
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Drauf
            </button>
            <button 
              onClick={() => setCameraView('front')} 
              title="Vorderansicht (Front)" 
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Vorne
            </button>
            <button 
              onClick={() => setCameraView('right')} 
              title="Seitenansicht (Rechts)" 
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Seite
            </button>
          </div>

          {/* Quick Toggles */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 pointer-events-auto shadow-lg">
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              title={autoRotate ? "Auto-Drehung anhalten" : "Auto-Drehung starten"}
              className={`p-1.5 rounded-lg transition ${autoRotate ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              title="Druckbett Gitter an/aus"
              className={`p-1.5 rounded-lg transition ${showGrid ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowBBox(!showBBox)}
              title="Bemaßungs-Rahmen an/aus"
              className={`p-1.5 rounded-lg transition ${showBBox ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Ruler className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Floating Stats & Shading Selector */}
      {interactive && !loading && !error && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          {/* Filament Color Palette Quick Picker */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 pointer-events-auto shadow-lg">
            {filamentColors.map((c) => (
              <button
                key={c.hex}
                onClick={() => setColor(c.hex)}
                title={c.name}
                className={`w-5 h-5 rounded-full transition-transform border ${color === c.hex ? 'scale-125 ring-2 ring-white border-white' : 'border-slate-600 hover:scale-110'}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          {/* Shading Mode */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 pointer-events-auto shadow-lg">
            <button
              onClick={() => setMaterialMode('standard')}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition ${materialMode === 'standard' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Solid
            </button>
            <button
              onClick={() => setMaterialMode('wireframe')}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition ${materialMode === 'wireframe' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Gitter
            </button>
            <button
              onClick={() => setMaterialMode('metallic')}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition ${materialMode === 'metallic' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Glanz
            </button>
          </div>
        </div>
      )}

      {/* Live Dimension HUD overlay */}
      {stats && !loading && !error && (
        <div className="absolute top-14 left-3 px-2.5 py-1.5 rounded-lg bg-slate-950/75 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-cyan-300/90 pointer-events-none shadow-md space-y-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Box className="w-3 h-3 text-cyan-400" />
            <span>{stats.dimensions.x} × {stats.dimensions.y} × {stats.dimensions.z} mm</span>
          </div>
          <div className="text-slate-400">
            Volumen: <span className="text-slate-200">{stats.volumeCm3} cm³</span> (~{stats.estimatedWeightGrams}g)
          </div>
        </div>
      )}
    </div>
  );
}
