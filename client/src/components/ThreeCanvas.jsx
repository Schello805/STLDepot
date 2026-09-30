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
  Sliders,
  Scissors,
  Crosshair,
  Trash2,
  Check
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
  const measureGroupRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [color, setColor] = useState(initialColor);
  const [materialMode, setMaterialMode] = useState('standard'); // standard, wireframe, normal, metallic
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showBBox, setShowBBox] = useState(false);
  const [stats, setStats] = useState(null);
  const [hasMultiColor, setHasMultiColor] = useState(false);
  const [detectedFilaments, setDetectedFilaments] = useState([]);
  const bedMeshRef = useRef(null);

  // Pro Tools: Clipping (Schnitt-Ebene) & Point-to-Point Measurement
  const [clippingActive, setClippingActive] = useState(false);
  const [clippingAxis, setClippingAxis] = useState('y'); // 'x', 'y', 'z'
  const [clippingValue, setClippingValue] = useState(50); // percentage 0-100
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 100));

  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]); // [{x, y, z}]
  const [measureDistance, setMeasureDistance] = useState(null);

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

    // Measure helper group
    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(100, 90, 120);
    camera.lookAt(targetLookAtRef.current);
    cameraRef.current = camera;

    // Renderer with Local Clipping enabled
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
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
    grid.visible = false;
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
    bedMesh.visible = false;
    scene.add(bedMesh);
    bedMeshRef.current = bedMesh;

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
      if (renderer) {
        renderer.dispose();
        try {
          renderer.forceContextLoss();
          const gl = renderer.getContext();
          gl?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch (e) {}
      }
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
        const isMulti = geometry.hasAttribute('color') || !!geometry.userData?.hasVertexColors;
        setHasMultiColor(isMulti);
        setDetectedFilaments(geometry.userData?.filamentColors || []);
        if (onGeometryLoaded) onGeometryLoaded(modelStats, geometry);

        // Material creation
        const material = createMaterial(materialMode, color, false, geometry);
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

  // Update material / color & clipping
  useEffect(() => {
    if (!meshRef.current) return;

    if (clippingActive) {
      const bbox = new THREE.Box3().setFromObject(meshRef.current);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bbox.getSize(size);
      bbox.getCenter(center);

      const normal = new THREE.Vector3();
      let constant = 0;
      const fraction = (clippingValue - 50) / 50; // -1 to 1

      if (clippingAxis === 'x') {
        normal.set(-1, 0, 0);
        constant = center.x + (size.x / 2) * fraction;
      } else if (clippingAxis === 'y') {
        normal.set(0, -1, 0);
        constant = center.y + (size.y / 2) * fraction;
      } else {
        normal.set(0, 0, -1);
        constant = center.z + (size.z / 2) * fraction;
      }

      clipPlaneRef.current.normal.copy(normal);
      clipPlaneRef.current.constant = constant;
    }

    meshRef.current.material = createMaterial(materialMode, color, clippingActive, meshRef.current.geometry);
  }, [color, materialMode, clippingActive, clippingAxis, clippingValue]);

  // Update Grid / BBox visibility
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
    if (bedMeshRef.current) bedMeshRef.current.visible = showGrid;
    if (bboxHelperRef.current) bboxHelperRef.current.visible = showBBox;
  }, [showGrid, showBBox]);

  function createMaterial(mode, col, isClipping = false, geom = null) {
    const planes = isClipping ? [clipPlaneRef.current] : [];
    const targetGeom = geom || meshRef.current?.geometry;
    const hasColors = targetGeom?.hasAttribute('color') || !!targetGeom?.userData?.hasVertexColors;

    let mat;
    switch (mode) {
      case 'wireframe':
        mat = new THREE.MeshBasicMaterial({ color: hasColors ? 0xffffff : col, wireframe: true });
        break;
      case 'normal':
        mat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
        break;
      case 'metallic':
        mat = new THREE.MeshStandardMaterial({
          color: hasColors ? 0xffffff : col,
          vertexColors: hasColors,
          metalness: 0.85,
          roughness: 0.2,
          side: THREE.DoubleSide
        });
        break;
      case 'standard':
      default:
        mat = new THREE.MeshStandardMaterial({
          color: hasColors ? 0xffffff : col,
          vertexColors: hasColors,
          metalness: 0.15,
          roughness: 0.45,
          side: THREE.DoubleSide
        });
        break;
    }
    mat.clippingPlanes = planes;
    mat.clipShadows = true;
    return mat;
  }

  // Point-to-Point Measurement Helpers
  const addMeasurePoint = (pt) => {
    if (!measureGroupRef.current) return;
    const newPoints = [...measurePoints, pt];
    setMeasurePoints(newPoints);

    // Add sphere marker
    const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: newPoints.length === 1 ? 0x06b6d4 : 0x22c55e });
    const marker = new THREE.Mesh(sphereGeo, sphereMat);
    marker.position.copy(pt);
    measureGroupRef.current.add(marker);

    if (newPoints.length === 2) {
      const p1 = newPoints[0];
      const p2 = newPoints[1];
      const dist = p1.distanceTo(p2);
      setMeasureDistance(dist.toFixed(2));

      // Draw line between points
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 3 });
      const line = new THREE.Line(lineGeo, lineMat);
      measureGroupRef.current.add(line);
    }
  };

  const clearMeasurement = () => {
    setMeasurePoints([]);
    setMeasureDistance(null);
    if (measureGroupRef.current) {
      while (measureGroupRef.current.children.length > 0) {
        const obj = measureGroupRef.current.children[0];
        measureGroupRef.current.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      }
    }
  };

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

  // Raycast click for Measurement tool
  const handleCanvasClick = (e) => {
    if (!measureMode || !meshRef.current || !cameraRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObject(meshRef.current, false);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;
      if (measurePoints.length >= 2) {
        clearMeasurement();
        addMeasurePoint(hitPoint);
      } else {
        addMeasurePoint(hitPoint);
      }
    }
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
        className={`w-full h-full flex-1 ${measureMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
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
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10 flex-wrap gap-2">
          {/* Quick Camera Presets */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 pointer-events-auto shadow-lg text-[11px]">
            <button 
              onClick={() => setCameraView('iso')} 
              title="Isometrische Ansicht" 
              className="px-2 py-0.5 font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              ISO
            </button>
            <button 
              onClick={() => setCameraView('top')} 
              title="Draufsicht (Top)" 
              className="px-2 py-0.5 font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Drauf
            </button>
            <button 
              onClick={() => setCameraView('front')} 
              title="Vorderansicht (Front)" 
              className="px-2 py-0.5 font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Vorne
            </button>
            <button 
              onClick={() => setCameraView('right')} 
              title="Seitenansicht (Rechts)" 
              className="px-2 py-0.5 font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Seite
            </button>
          </div>

          {/* Pro Tools Toggles: Auto-Rotate, Grid, BBox, Schnitt-Ebene (Clipping), Messwerkzeug */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 pointer-events-auto shadow-lg">
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              title={autoRotate ? "Auto-Drehung anhalten" : "Auto-Drehung starten"}
              className={`p-1.5 rounded-lg transition ${autoRotate ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              title="Druckbett Gitter an/aus"
              className={`p-1.5 rounded-lg transition ${showGrid ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowBBox(!showBBox)}
              title="Bemaßungs-Rahmen an/aus"
              className={`p-1.5 rounded-lg transition ${showBBox ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Ruler className="w-3.5 h-3.5" />
            </button>
            
            {/* Schnitt-Ebene (Cross-Section) */}
            <button
              onClick={() => setClippingActive(!clippingActive)}
              title="Schnitt-Ebene (Cross-Section)"
              className={`p-1.5 rounded-lg transition ${clippingActive ? 'bg-amber-500/25 text-amber-400 border border-amber-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>

            {/* Punkt-zu-Punkt Messen */}
            <button
              onClick={() => {
                const next = !measureMode;
                setMeasureMode(next);
                if (!next) clearMeasurement();
              }}
              title="Punkt-zu-Punkt Messwerkzeug (2 Punkte anklicken)"
              className={`p-1.5 rounded-lg transition ${measureMode ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Schnitt-Ebene (Clipping) Floating Slider Controls */}
      {interactive && clippingActive && !loading && (
        <div className="absolute top-14 right-3 p-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-amber-500/40 text-xs text-slate-200 z-10 shadow-xl space-y-2 animate-in fade-in duration-150 pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-amber-300 flex items-center gap-1 text-[11px]">
              <Scissors className="w-3 h-3" /> Schnitt-Ebene
            </span>
            <div className="flex items-center gap-1">
              {['x', 'y', 'z'].map((axis) => (
                <button
                  key={axis}
                  onClick={() => setClippingAxis(axis)}
                  className={`px-1.5 py-0.5 uppercase text-[10px] font-bold rounded ${clippingAxis === axis ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {axis}
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={clippingValue}
            onChange={(e) => setClippingValue(parseInt(e.target.value, 10))}
            className="w-36 accent-amber-500 cursor-pointer"
          />
        </div>
      )}

      {/* Punkt-zu-Punkt Messwerkzeug Floating Info Badge */}
      {interactive && measureMode && !loading && (
        <div className="absolute top-14 left-3 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 text-xs text-slate-200 z-10 shadow-xl space-y-1.5 animate-in fade-in duration-150 pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-emerald-300 flex items-center gap-1 text-[11px]">
              <Crosshair className="w-3.5 h-3.5" /> Messwerkzeug
            </span>
            {measurePoints.length > 0 && (
              <button
                onClick={clearMeasurement}
                className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-0.5"
                title="Messung zurücksetzen"
              >
                <Trash2 className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            {measurePoints.length === 0 && '👉 Klicke Punkt 1 auf dem Modell an'}
            {measurePoints.length === 1 && '👉 Klicke Punkt 2 auf dem Modell an'}
            {measurePoints.length === 2 && (
              <span className="text-emerald-400 font-bold font-mono text-xs">
                📏 Abstand: {measureDistance} mm
              </span>
            )}
          </p>
        </div>
      )}

      {/* Bottom Floating Stats & Shading Selector */}
      {interactive && !loading && !error && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          {/* Filament Color Palette Quick Picker / 3MF Multi-Color Badge */}
          {hasMultiColor ? (
            <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 pointer-events-auto shadow-lg text-xs font-semibold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-400" />
                <span>3MF Mehrfarb-Vorschau</span>
              </span>
              {detectedFilaments.length > 0 && (
                <div className="flex items-center gap-1 pl-1.5 border-l border-slate-700">
                  {detectedFilaments.map((fCol, idx) => (
                    <span
                      key={idx}
                      className="w-3.5 h-3.5 rounded-full border border-white/60 shadow-sm"
                      style={{ backgroundColor: fCol }}
                      title={`Filament ${idx + 1}: ${fCol}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
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
          )}

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

      {/* Live Dimension HUD overlay (only if not measuring to prevent clutter) */}
      {stats && !loading && !error && !measureMode && !clippingActive && (
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
