"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ColorItem, FocusScope, FrameNode, System, Tool, ViewPreset3D } from "@/types/domain";
import type { PartKind, SideKey } from "./frameTypes";

const MM = 0.001; // scene units are meters; geometry is built directly from mm state
const FRAME_RING_MM = 55;

type ClickTag = { id: string; part: PartKind; side?: SideKey; rect: { x: number; y: number; w: number; h: number } };

function colorToHex3D(color: ColorItem): string {
  if (color.hex) return color.hex;
  const n = (color.name || "").toLowerCase();
  if (n.includes("blanco")) return "#f3f3ef";
  if (n.includes("negro") || n.includes("ulti matt")) return "#1a1a1a";
  if (n.includes("antracita")) return "#3e4347";
  if (n.includes("gris")) return "#9aa0a6";
  if (n.includes("bronce")) return "#6b4939";
  if (n.includes("dorado") || n.includes("oak") || n.includes("nogal") || n.includes("winchester") || n.includes("macor")) return "#8a6749";
  return "#e8e8e2";
}

type Props = {
  tree: FrameNode;
  width: number;
  height: number;
  sys: System;
  color: ColorItem;
  selectedId: string;
  focusScope: FocusScope;
  focusPart: PartKind | null;
  focusSide: SideKey | null;
  activeTool: Tool;
  viewPreset: ViewPreset3D;
  /** Bump this to force the camera to re-snap to viewPreset even if the preset didn't change
   * (matches static's presetPending behavior — clicking the same preset button re-applies it). */
  presetToken: number;
  onSelect: (id: string, part: PartKind, side: SideKey | null) => void;
  onSplit: (id: string, axis: "row" | "col", fraction: number) => void;
  onAssignWing: (id: string) => void;
  onReady?: () => void;
  /** Wires the gizmo's clickable N/E compass points + ring + elevation bar to the same
   * setViewPreset/presetToken flow the preset-row buttons in app/page.tsx already use — see
   * changePreset there. Optional so the gizmo still renders (display-only) if a caller doesn't
   * pass it. */
  onPresetSelect?: (preset: ViewPreset3D) => void;
};

// Real WebGL architectural viewer (three.js), not a CSS fake — free orbit + click-to-edit,
// ported from the buildScene3D/handle3DClick/applyPreset3D pattern already validated in
// static/cotizador.html. The canvas is created once and kept alive across renders (mounted via
// a persistent <div ref> + imperative appendChild), so React's reconciliation never fights the
// WebGL render loop; the model itself is fully rebuilt on every relevant prop change since the
// scene is cheap (a few dozen boxes).
export function Scene3D({ tree, width, height, sys, color, selectedId, focusScope, focusPart, focusSide, activeTool, viewPreset, presetToken, onSelect, onSplit, onAssignWing, onReady, onPresetSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const compassRef = useRef<HTMLDivElement | null>(null);
  const elevationRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const clickableRef = useRef<THREE.Object3D[]>([]);
  const stateRef = useRef({ tree, width, height, activeTool, onSelect, onSplit, onAssignWing });
  stateRef.current = { tree, width, height, activeTool, onSelect, onSplit, onAssignWing };

  // One-time init: scene/camera/renderer/controls/lights, mounted forever for the lifetime of
  // this component instance.
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    cameraRef.current = camera;
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.4;
    controls.maxDistance = 25;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-3, 1.5, -3);
    scene.add(fill);

    raycasterRef.current = new THREE.Raycaster();

    let downPos: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => { downPos = { x: e.clientX, y: e.clientY }; };
    const onPointerUp = (e: PointerEvent) => {
      if (!downPos) return;
      const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
      downPos = null;
      if (Math.hypot(dx, dy) > 5) return; // was an orbit/pan drag, not a click
      handleClick(e);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!canvas.isConnected) return;
      controls.update();
      renderer.render(scene, camera);
      // Live orientation gizmo (compass + elevation bar), read straight off OrbitControls'
      // public spherical-angle API -- cheap, and keeps the little "which way am I looking"
      // indicator in sync with drag-rotate/preset changes without any extra state plumbing.
      if (compassRef.current) compassRef.current.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
      if (elevationRef.current) {
        const pct = Math.max(0, Math.min(100, (1 - controls.getPolarAngle() / Math.PI) * 100));
        elevationRef.current.style.height = `${pct}%`;
      }
    };
    raf = requestAnimationFrame(animate);

    const container = containerRef.current;
    if (container) container.appendChild(canvas);
    onReady?.();

    const resize = () => {
      const slot = canvas.parentElement;
      if (!slot) return;
      const w = Math.max(1, slot.clientWidth), h = Math.max(1, slot.clientHeight);
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    if (container) ro.observe(container);

    function handleClick(e: PointerEvent) {
      const cam = cameraRef.current, ray = raycasterRef.current;
      if (!cam || !ray) return;
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(new THREE.Vector2(nx, ny), cam);
      const hits = ray.intersectObjects(clickableRef.current, false);
      if (!hits.length) return;
      const hit = hits[0];
      const tag = hit.object.userData as ClickTag;
      if (!tag || !tag.id) return;
      const { activeTool: tool, width: w, height: h, onSelect: select, onSplit: split, onAssignWing: assign } = stateRef.current;

      if (tool.mode === "select") {
        select(tag.id, tag.part, tag.side ?? null);
        return;
      }
      if (tool.mode === "split") {
        const fraction = tool.axis === "col"
          ? (hit.point.x / MM + w / 2 - tag.rect.x) / tag.rect.w
          : (h / 2 - hit.point.y / MM - tag.rect.y) / tag.rect.h;
        split(tag.id, tool.axis, fraction);
        return;
      }
      assign(tag.id);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuilds the whole 3D model from tree/width/height/sys/color/selection every time any of
  // them change — the scene is small, so this is cheap and keeps the 3D view trivially
  // consistent with the same tree the 2D editor and calc engine already read from.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const old = scene.getObjectByName("model");
    if (old) {
      scene.remove(old);
      old.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
      });
    }
    const clickable: THREE.Object3D[] = [];

    const group = new THREE.Group();
    group.name = "model";
    const w = width, h = height;
    const depthMm = sys.depth;
    const frameHex = colorToHex3D(color);
    const isSelectedPart = (id: string, part: PartKind, side?: SideKey) =>
      focusScope !== "assembly" && selectedId === id && (!focusPart || focusPart === part) && (part !== "marco" || !focusSide || !side || focusSide === side);

    const frameMat = new THREE.MeshStandardMaterial({ color: frameHex, roughness: 0.5, metalness: 0.12 });
    const sashMat = new THREE.MeshStandardMaterial({ color: frameHex, roughness: 0.55, metalness: 0.1 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdcecef, roughness: 0.06, transmission: 0.88, thickness: 0.02, ior: 1.5, transparent: true, opacity: 0.95 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.35, metalness: 0.6 });
    const selMat = new THREE.MeshStandardMaterial({ color: "#1D6CA6", roughness: 0.35, metalness: 0.2, emissive: "#1D6CA6", emissiveIntensity: 0.22 });
    const glassSelMat = () =>
      new THREE.MeshPhysicalMaterial({ color: "#1D6CA6", roughness: 0.06, transmission: 0.6, thickness: 0.02, ior: 1.5, transparent: true, opacity: 0.95, emissive: "#1D6CA6", emissiveIntensity: 0.15 });

    function addBox(x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material, tag: ClickTag | null, selMatOverride?: THREE.Material) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.0005, sx), Math.max(0.0005, sy), Math.max(0.0005, sz)),
        tag && isSelectedPart(tag.id, tag.part, tag.side) ? selMatOverride ?? selMat : mat
      );
      mesh.position.set(x, y, z);
      if (tag) {
        mesh.userData = tag;
        clickable.push(mesh);
      }
      group.add(mesh);
      return mesh;
    }

    const W = w * MM, H = h * MM, D = depthMm * MM, FW = FRAME_RING_MM * MM;
    // outer marco (not individually clickable — clicking a leaf's own marco ring selects that leaf instead)
    addBox(0, H / 2 - FW / 2, 0, W, FW, D, frameMat, null);
    addBox(0, -H / 2 + FW / 2, 0, W, FW, D, frameMat, null);
    addBox(-W / 2 + FW / 2, 0, 0, FW, H, D, frameMat, null);
    addBox(W / 2 - FW / 2, 0, 0, FW, H, D, frameMat, null);

    function walk(node: FrameNode, x: number, y: number, ww: number, hh: number) {
      if (node.kind === "split") {
        let offset = 0;
        node.children.forEach((child, i) => {
          const ratio = node.ratios[i];
          if (node.axis === "col") { walk(child, x + offset, y, ww * ratio, hh); offset += ww * ratio; }
          else { walk(child, x, y + offset, ww, hh * ratio); offset += hh * ratio; }
        });
        offset = 0;
        node.children.forEach((child, i) => {
          const ratio = node.ratios[i];
          if (node.axis === "col") {
            offset += ww * ratio;
            if (i < node.children.length - 1) addBox((x + offset - w / 2) * MM, (h / 2 - (y + hh / 2)) * MM, 0, FW, hh * MM, D, frameMat, null);
          } else {
            offset += hh * ratio;
            if (i < node.children.length - 1) addBox((x + ww / 2 - w / 2) * MM, (h / 2 - (y + offset)) * MM, 0, ww * MM, FW, D, frameMat, null);
          }
        });
        return;
      }
      const cx = (x + ww / 2 - w / 2) * MM, cy = (h / 2 - (y + hh / 2)) * MM;
      const leafW = ww * MM, leafH = hh * MM;
      const rectTag = { x, y, w: ww, h: hh };
      const hasSash = node.wing !== "fixed" && node.wing !== "inactive";

      addBox(cx, cy + leafH / 2 - FW / 2, 0, leafW, FW, D, frameMat, { id: node.id, part: "marco", side: "top", rect: rectTag });
      addBox(cx, cy - leafH / 2 + FW / 2, 0, leafW, FW, D, frameMat, { id: node.id, part: "marco", side: "bottom", rect: rectTag });
      addBox(cx - leafW / 2 + FW / 2, cy, 0, FW, leafH, D, frameMat, { id: node.id, part: "marco", side: "left", rect: rectTag });
      addBox(cx + leafW / 2 - FW / 2, cy, 0, FW, leafH, D, frameMat, { id: node.id, part: "marco", side: "right", rect: rectTag });

      if (hasSash) {
        const sw = Math.max(0.01, leafW - FW * 2), sh = Math.max(0.01, leafH - FW * 2);
        const SR = 34 * MM;
        addBox(cx, cy + sh / 2 - SR / 2, 0, sw, SR, D * 0.82, sashMat, { id: node.id, part: "hoja", rect: rectTag });
        addBox(cx, cy - sh / 2 + SR / 2, 0, sw, SR, D * 0.82, sashMat, { id: node.id, part: "hoja", rect: rectTag });
        addBox(cx - sw / 2 + SR / 2, cy, 0, SR, sh, D * 0.82, sashMat, { id: node.id, part: "hoja", rect: rectTag });
        addBox(cx + sw / 2 - SR / 2, cy, 0, SR, sh, D * 0.82, sashMat, { id: node.id, part: "hoja", rect: rectTag });
        const gw = Math.max(0.01, sw - SR * 2), gh = Math.max(0.01, sh - SR * 2);
        addBox(cx, cy, 0, gw, gh, 6 * MM, glassMat, { id: node.id, part: "vidrio", rect: rectTag }, glassSelMat());
        const handleX = node.spec.direction === "Izquierda" ? cx - sw / 2 + SR + 18 * MM : cx + sw / 2 - SR - 18 * MM;
        addBox(handleX, cy, D * 0.5, 10 * MM, 70 * MM, 14 * MM, handleMat, { id: node.id, part: "herraje", rect: rectTag });
      } else {
        const gw = Math.max(0.01, leafW - FW * 2), gh = Math.max(0.01, leafH - FW * 2);
        addBox(cx, cy, 0, gw, gh, 6 * MM, glassMat, { id: node.id, part: "vidrio", rect: rectTag }, glassSelMat());
      }
    }
    walk(tree, 0, 0, w, h);
    scene.add(group);
    clickableRef.current = clickable;
  }, [tree, width, height, sys, color, selectedId, focusScope, focusPart, focusSide]);

  // View presets: applied on mount and whenever the preset (or the token forcing a re-apply,
  // e.g. re-clicking the same preset, or switching into the 3D view) changes.
  useEffect(() => {
    const camera = cameraRef.current, controls = controlsRef.current;
    if (!camera || !controls) return;
    const w = width * MM, h = height * MM;
    const dist = Math.max(w, h) * 1.6 + 0.6;
    const targets: Record<ViewPreset3D, [number, number, number]> = {
      Frente: [0, 0, dist],
      Planta: [0, dist, 0.0001],
      Perfil: [dist, 0, 0],
      Isométrica: [dist * 0.62, dist * 0.5, dist * 0.62],
    };
    const [x, y, z] = targets[viewPreset] ?? targets.Isométrica;
    camera.position.set(x, y, z);
    controls.target.set(0, 0, 0);
    camera.up.set(0, viewPreset === "Planta" ? 0 : 1, viewPreset === "Planta" ? -1 : 0);
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPreset, presetToken, width, height]);

  return (
    <>
      <div className="scene3dSlot" ref={containerRef}>
        {/* Interactive view-cube-style gizmo: N/E compass points and the ring snap the camera
            to the same Frente/Perfil/Isométrica presets as the preset-row buttons above the
            canvas (see PRESETS_3D in app/page.tsx); the elevation bar's top/bottom halves snap
            to Planta/Frente. Every clickable piece sets pointer-events:auto explicitly — the
            gizmo wrapper itself stays pointer-events:none so the rest of its padding still lets
            drag-to-orbit gestures reach the canvas underneath. */}
        <div className="axisGizmo" title="Orientación de la cámara">
          <div className="axisCompass" ref={compassRef}>
            <button
              type="button"
              className="axisCompassRing"
              title="Vista isométrica"
              aria-label="Vista isométrica"
              onClick={() => onPresetSelect?.("Isométrica")}
            />
            <button
              type="button"
              className="axisCompassN"
              title="Vista frontal"
              aria-label="Vista frontal"
              onClick={() => onPresetSelect?.("Frente")}
            >
              N
            </button>
            <button
              type="button"
              className="axisCompassE"
              title="Vista de perfil"
              aria-label="Vista de perfil"
              onClick={() => onPresetSelect?.("Perfil")}
            >
              E
            </button>
            <span className="axisCompassNeedle" />
          </div>
          <button
            type="button"
            className="axisElevation"
            title="Vista en planta / vista frontal"
            aria-label="Vista en planta o frontal según la mitad pulsada"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relY = (e.clientY - rect.top) / rect.height;
              onPresetSelect?.(relY < 0.5 ? "Planta" : "Frente");
            }}
          >
            <span className="axisElevationFill" ref={elevationRef} />
          </button>
        </div>
      </div>
      <div className="scene3dHint">Arrastra para rotar · rueda para acercar · clic derecho para desplazar</div>
    </>
  );
}
