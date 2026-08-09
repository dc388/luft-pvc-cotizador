"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Brand, GlassSide, Marco, PaneSpec, Report, Side, Tab, Tool, ViewMode, ViewPreset3D, WingType } from "@/types/domain";
import { catalog, EUR_MXN } from "@/data/catalog";
import { glassCatalog } from "@/data/glass";
import { colors, brandAccent } from "@/data/colors";
import { profileFamilies } from "@/data/families";
import { wingDefs } from "@/data/wings";
import {
  createDefaultTree,
  defaultMarco,
  findNode,
  findParentSplitId,
  firstLeafId,
  isLeaf,
  removeSplit,
  setWing,
  splitLeaf,
  updateGlassSide,
  updateMarco,
  updateMarcoSide,
  updateSide,
  updateSpec,
  walkLeaves,
  normalizeTree,
  allowedWingsFor,
  remapTreeToSystem,
  SLIDING_WINGS,
} from "@/lib/tree";
import { BAR_LENGTH_MM, KERF_MM, buildCutList, calcQuote, packBars, MIN_OPENING_MM } from "@/lib/calc";
import { money } from "@/lib/money";
import { downloadFile, exportReportHtml, toCsv } from "@/lib/exportDoc";
import { runSelfCheck, type SelfCheckResult } from "@/lib/selfCheck";
import {
  bootstrap,
  createComponent,
  deleteComponentApi,
  fetchComponent,
  refetchProject,
  renameProjectApi,
  saveComponent,
  setActiveComponentApi,
} from "@/lib/persistence";
import type { ComponentRecord, ComponentSummary } from "@/types/project";
import { Block } from "@/components/Block";
import { TopBar, ModuleNav } from "@/components/layout/Nav";
import { Toolbox } from "@/components/editor/Toolbox";
import { FrameCanvas } from "@/components/editor/FrameCanvas";
import { SectionRender } from "@/components/editor/SectionRender";
import { Scene3D } from "@/components/editor/Scene3D";
import { ExplorerTree } from "@/components/editor/ExplorerTree";
import { EditableDim } from "@/components/editor/EditableDim";
import { TypologyPicker } from "@/components/editor/TypologyPicker";
import type { TypologyDef } from "@/data/typologies";
import type { PartKind, SideKey } from "@/components/editor/frameTypes";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { MarcoPanel } from "@/components/properties/MarcoPanel";
import { Prop, Cost, Item } from "@/components/properties/Prop";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { CotizacionDoc } from "@/components/reports/CotizacionDoc";
import { CorteDoc } from "@/components/reports/CorteDoc";
import { VidrioDoc } from "@/components/reports/VidrioDoc";
import { ProjectCotizacionDoc } from "@/components/reports/ProjectCotizacionDoc";
import { ProjectCorteDoc } from "@/components/reports/ProjectCorteDoc";
import { ProjectVidrioDoc } from "@/components/reports/ProjectVidrioDoc";

const TABS: Tab[] = ["Proyecto", "Resumen", "Diseño", "Consumo", "Servicios", "Informes"];
const REPORTS: Report[] = ["Cotización", "Optimización de corte", "Pedido de vidrio", "Producción", "Herrajes", "Costos"];
// Reports that can aggregate every component in the project instead of just the active one --
// same three the static prototype grouped (Producción/Herrajes/Costos stay per-component only).
const PROJECT_SCOPED_REPORTS: Report[] = ["Cotización", "Optimización de corte", "Pedido de vidrio"];
const VIEW_MODES: ViewMode[] = ["2D", "3D", "Sección"];
const PRESETS_3D: ViewPreset3D[] = ["Frente", "Planta", "Perfil", "Isométrica"];

export default function Home() {
  const [brand, setBrand] = useState<Brand>("Aluplast");
  const [systemIndex, setSystemIndex] = useState(0);
  const [rail, setRail] = useState(2);
  const [width, setWidth] = useState(4000);
  const [height, setHeight] = useState(2200);
  const [qty, setQty] = useState(1);
  const [glassIndex, setGlassIndex] = useState(7);
  const [colorIndex, setColorIndex] = useState(1);
  const [face, setFace] = useState("Ambas caras");
  const [tab, setTab] = useState<Tab>("Diseño");
  const [view, setView] = useState<ViewMode>("2D");
  const [viewPreset, setViewPreset] = useState<ViewPreset3D>("Isométrica");
  const [presetToken, setPresetToken] = useState(0);
  const [report, setReport] = useState<Report>("Cotización");
  const [margin, setMargin] = useState(35);
  const [installation, setInstallation] = useState(1200);
  const [transport, setTransport] = useState(450);
  const [discount, setDiscount] = useState(0);
  const [code, setCode] = useState("001");
  const [designation, setDesignation] = useState("V01");
  const [location, setLocation] = useState("Cocina");
  const [client, setClient] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [termsHeader, setTermsHeader] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [barLengthMm, setBarLengthMm] = useState(BAR_LENGTH_MM);
  const [profileSearch, setProfileSearch] = useState("");
  const [profileSystemFilter, setProfileSystemFilter] = useState("Todos");

  const [tree, setTree] = useState(() => createDefaultTree());
  const [selectedId, setSelectedId] = useState(() => firstLeafId(tree));
  const [activeTool, setActiveTool] = useState<Tool>({ mode: "select" });
  const [focusPart, setFocusPart] = useState<PartKind | null>(null);
  const [focusSide, setFocusSide] = useState<SideKey | null>(null);
  const [focusScope, setFocusScope] = useState<"leaf" | "assembly">("leaf");
  const [marco, setMarco] = useState<Marco>(() => defaultMarco());
  // Gates the undo/redo history effect (below) and autosave until the bootstrap effect has had
  // its chance to load the real component -- without this, the very first render's default
  // state would seed/pollute history and autosave before the real data arrives.
  const [hydrated, setHydrated] = useState(false);

  // ---------- Undo/redo: snapshots the active component's full design (tree, marco, dimensions,
  // and every catalog choice) whenever one of them changes via a real edit. Selection/tool/tab/
  // view are deliberately excluded -- undoing a split shouldn't also jump you to a different tab.
  // loadComponentIntoState resets the stacks, so switching components never mixes histories. ----------
  type DesignSnapshot = {
    tree: typeof tree; marco: Marco; width: number; height: number; qty: number;
    brand: Brand; systemIndex: number; colorIndex: number; glassIndex: number; rail: number; face: string;
  };
  const MAX_HISTORY = 100;
  const [past, setPast] = useState<DesignSnapshot[]>([]);
  const [future, setFuture] = useState<DesignSnapshot[]>([]);
  const skipHistoryRef = useRef(false);
  const prevSnapshotRef = useRef<DesignSnapshot | null>(null);

  useEffect(() => {
    const snap: DesignSnapshot = { tree, marco, width, height, qty, brand, systemIndex, colorIndex, glassIndex, rail, face };
    if (!hydrated) {
      prevSnapshotRef.current = snap;
      return;
    }
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      prevSnapshotRef.current = snap;
      return;
    }
    const prev = prevSnapshotRef.current;
    if (prev) {
      const changed =
        prev.tree !== snap.tree || prev.marco !== snap.marco || prev.width !== snap.width || prev.height !== snap.height ||
        prev.qty !== snap.qty || prev.brand !== snap.brand || prev.systemIndex !== snap.systemIndex ||
        prev.colorIndex !== snap.colorIndex || prev.glassIndex !== snap.glassIndex || prev.rail !== snap.rail || prev.face !== snap.face;
      if (changed) {
        setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), prev]);
        setFuture([]);
      }
    }
    prevSnapshotRef.current = snap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, marco, width, height, qty, brand, systemIndex, colorIndex, glassIndex, rail, face, hydrated]);

  const applyDesignSnapshot = (s: DesignSnapshot) => {
    skipHistoryRef.current = true;
    setTree(s.tree);
    setMarco(s.marco);
    setWidth(s.width);
    setHeight(s.height);
    setQty(s.qty);
    setBrand(s.brand);
    setSystemIndex(s.systemIndex);
    setColorIndex(s.colorIndex);
    setGlassIndex(s.glassIndex);
    setRail(s.rail);
    setFace(s.face);
    // The previously selected leaf id may not exist in the restored tree -- fall back safely.
    setSelectedId((id) => (findNode(s.tree, id) ? id : firstLeafId(s.tree)));
    setFocusPart(null);
    setFocusSide(null);
    setFocusScope("leaf");
    setActiveTool({ mode: "select" });
  };

  const handleUndo = () => {
    if (!past.length) return;
    const current: DesignSnapshot = { tree, marco, width, height, qty, brand, systemIndex, colorIndex, glassIndex, rail, face };
    const prevSnap = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [current, ...f]);
    applyDesignSnapshot(prevSnap);
  };

  const handleRedo = () => {
    if (!future.length) return;
    const current: DesignSnapshot = { tree, marco, width, height, qty, brand, systemIndex, colorIndex, glassIndex, rail, face };
    const nextSnap = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, current]);
    applyDesignSnapshot(nextSnap);
  };

  // Clears the current sub-part focus (marco side / vidrio side / active split-or-assign tool)
  // without dropping which leaf is "current" -- matches Escape/click-empty-area canceling the
  // in-progress selection, not erasing the properties panel entirely (see clearFocus callers).
  const clearFocus = () => {
    setActiveTool({ mode: "select" });
    setFocusPart(null);
    setFocusSide(null);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape" && !isEditable) {
        clearFocus();
        return;
      }
      if (isEditable) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (key === "y" || (e.shiftKey && key === "z"))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, tree, marco, width, height, qty, brand, systemIndex, colorIndex, glassIndex, rail, face]);

  const [threeReady, setThreeReady] = useState(false);
  const [selfCheck, setSelfCheck] = useState<SelfCheckResult | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [persistMode, setPersistMode] = useState<"db" | "offline">("offline");

  // ---------- Proyecto → Componente: the active component's own fields (width, tree, marco,
  // etc. above) are still flat state exactly as before a single-window app had them -- adding
  // this layer is additive, same as the Proyecto/Vano layer built once in static/cotizador.html:
  // a project with one component behaves identically to the old single-design app. ----------
  const [projectId, setProjectId] = useState<string | null>(null);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Proyecto sin nombre");
  const [components, setComponents] = useState<ComponentSummary[]>([]);

  // ---------- "Proyecto completo" report scope: Cotización/Optimización de corte/Pedido de
  // vidrio can either describe the active component alone (default) or aggregate every
  // component in the project (buildProjectCutList nests cut pieces across components that
  // share brand+system+color). The full records (tree/marco included) are fetched on demand --
  // the outliner's ComponentSummary list deliberately omits that payload. ----------
  const [reportScope, setReportScope] = useState<"vano" | "proyecto">("vano");
  const [projectComponents, setProjectComponents] = useState<ComponentRecord[] | null>(null);
  const [projectComponentsLoading, setProjectComponentsLoading] = useState(false);
  const scopeApplies = PROJECT_SCOPED_REPORTS.includes(report);

  useEffect(() => {
    if (!projectId || reportScope !== "proyecto" || !scopeApplies || components.length <= 1) {
      setProjectComponents(null);
      return;
    }
    let cancelled = false;
    setProjectComponentsLoading(true);
    Promise.all(components.map((c) => fetchComponent(projectId, c.id)))
      .then((records) => {
        if (!cancelled) setProjectComponents(records);
      })
      .catch(() => {
        if (!cancelled) setProjectComponents(null);
      })
      .finally(() => {
        if (!cancelled) setProjectComponentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reportScope, scopeApplies, components]);

  const refreshComponentList = async (pid: string) => {
    try {
      const project = await refetchProject(pid);
      setComponents(project.components);
      setProjectName(project.name);
    } catch {
      // offline / DB unreachable -- the outliner just won't reflect other components until
      // connectivity is back; the active component itself still autosaves via saveComponent's
      // own offline fallback.
    }
  };

  const loadComponentIntoState = (rec: {
    id: string; code: string; designation: string; location: string; qty: number;
    widthMm: number; heightMm: number; brand: "Aluplast" | "Deceuninck"; systemIndex: number; colorIndex: number;
    data: { rail: number; glassIndex: number; face: string; margin: number; installation: number; transport: number; discount: number; client: string; clientAddress: string; deliveryDate: string; selectedId: string; tree: typeof tree; marco: Marco; termsHeader?: string; paymentTerms?: string; barLengthMm?: number };
  }) => {
    // A newly loaded component starts with a clean undo/redo history -- the previous
    // component's edits aren't meaningful "past" states for this one's tree/marco.
    skipHistoryRef.current = true;
    prevSnapshotRef.current = null;
    setPast([]);
    setFuture([]);
    setComponentId(rec.id);
    setCode(rec.code);
    setDesignation(rec.designation);
    setLocation(rec.location);
    setQty(rec.qty);
    setWidth(rec.widthMm);
    setHeight(rec.heightMm);
    setBrand(rec.brand);
    setSystemIndex(rec.systemIndex);
    setColorIndex(rec.colorIndex);
    setRail(rec.data.rail);
    setGlassIndex(rec.data.glassIndex);
    setFace(rec.data.face);
    setMargin(rec.data.margin);
    setInstallation(rec.data.installation);
    setTransport(rec.data.transport);
    setDiscount(rec.data.discount);
    setClient(rec.data.client);
    setClientAddress(rec.data.clientAddress);
    setDeliveryDate(rec.data.deliveryDate);
    setTermsHeader(rec.data.termsHeader ?? "");
    setPaymentTerms(rec.data.paymentTerms ?? "");
    setBarLengthMm(rec.data.barLengthMm ?? BAR_LENGTH_MM);
    const normalizedTree = normalizeTree(rec.data.tree);
    setTree(normalizedTree);
    setMarco(rec.data.marco);
    setSelectedId(rec.data.selectedId || firstLeafId(normalizedTree));
    setActiveTool({ mode: "select" });
    setFocusPart(null);
    setFocusSide(null);
    setFocusScope("leaf");
  };

  // ---------- Load (or create) a project + its active component from the database, once, on
  // mount. Deliberately not run during SSR/first paint -- runs client-only, after hydration,
  // same reasoning the old localStorage restore had: reading persisted state inside a useState
  // initializer would give the server and the client two different values and trigger a
  // hydration mismatch. Falls back to the last offline-saved component if the DB/API isn't
  // reachable (see lib/persistence.ts's bootstrap()). ----------
  useEffect(() => {
    (async () => {
      const { project, component, mode } = await bootstrap();
      setPersistMode(mode);
      if (project) {
        setProjectId(project.id);
        setProjectName(project.name);
        setComponents(project.components);
      }
      loadComponentIntoState(component);
      setSavedAt(component.updatedAt);
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Autosave: debounced so dragging a divider or typing in a text field doesn't hit
  // the API on every keystroke. Gated on `hydrated` so the bootstrap effect above always gets
  // first say over what the loaded component actually contains. ----------
  useEffect(() => {
    if (!hydrated || !componentId) return;
    const pid = projectId ?? "offline";
    const cid = componentId;
    const id = setTimeout(() => {
      saveComponent(pid, cid, {
        code, designation, location, qty, widthMm: width, heightMm: height,
        brand, systemIndex, colorIndex,
        data: { rail, glassIndex, face, margin, installation, transport, discount, client, clientAddress, deliveryDate, termsHeader, paymentTerms, barLengthMm, tree, marco, selectedId },
      }).then(({ savedAt: savedIso, mode }) => {
        setPersistMode(mode);
        if (savedIso) setSavedAt(savedIso);
      });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated, projectId, componentId, brand, systemIndex, rail, width, height, qty, glassIndex, colorIndex, face,
    margin, installation, transport, discount, code, designation, location,
    client, clientAddress, deliveryDate, termsHeader, paymentTerms, barLengthMm, tree, marco, selectedId,
  ]);

  // ---------- Proyecto tab handlers: switch/add/duplicate/delete a component, rename the
  // project. Switching flushes the outgoing component's pending edits immediately (instead of
  // waiting on the 400ms autosave debounce) so nothing typed right before switching is lost. ----------
  const flushActiveComponent = async () => {
    if (!componentId) return;
    await saveComponent(projectId ?? "offline", componentId, {
      code, designation, location, qty, widthMm: width, heightMm: height, brand, systemIndex, colorIndex,
      data: { rail, glassIndex, face, margin, installation, transport, discount, client, clientAddress, deliveryDate, termsHeader, paymentTerms, barLengthMm, tree, marco, selectedId },
    });
  };

  // Drops the `data` payload from a full record so it can be merged straight into the
  // outliner's ComponentSummary list -- used to update `components` optimistically (see below)
  // instead of solely trusting a follow-up refreshComponentList(), whose own failure (or a
  // transient D1 lock under concurrent writes) used to leave componentId pointing at an id the
  // list didn't know about yet, which is exactly what the self-check's project-integrity check
  // catches.
  const toSummary = (rec: ComponentRecord): ComponentSummary => {
    const { data: _data, ...summary } = rec;
    return summary;
  };

  const handleSwitchComponent = async (id: string) => {
    if (id === componentId || !projectId) return;
    await flushActiveComponent();
    let rec: ComponentRecord;
    try {
      rec = await fetchComponent(projectId, id);
    } catch {
      // Transient fetch failure -- stay on the current component rather than applying a
      // half-loaded switch.
      return;
    }
    loadComponentIntoState(rec);
    setSavedAt(rec.updatedAt);
    await setActiveComponentApi(projectId, id).catch(() => {});
  };

  const handleAddComponent = async () => {
    if (!projectId) return;
    await flushActiveComponent();
    const rec = await createComponent(projectId);
    setComponents((prev) => [...prev, toSummary(rec)]);
    loadComponentIntoState(rec);
    setSavedAt(rec.updatedAt);
    await refreshComponentList(projectId);
  };

  const handleDuplicateComponent = async (id: string) => {
    if (!projectId) return;
    await flushActiveComponent();
    const rec = await createComponent(projectId, { duplicateFromId: id });
    setComponents((prev) => [...prev, toSummary(rec)]);
    loadComponentIntoState(rec);
    setSavedAt(rec.updatedAt);
    await refreshComponentList(projectId);
  };

  const handleDeleteComponent = async (id: string) => {
    if (!projectId || components.length <= 1) return;
    if (!window.confirm("¿Eliminar este componente del proyecto? Esta acción no se puede deshacer.")) return;
    await deleteComponentApi(projectId, id);
    setComponents((prev) => prev.filter((c) => c.id !== id));
    if (id === componentId) {
      const next = components.find((c) => c.id !== id);
      if (next) {
        try {
          const rec = await fetchComponent(projectId, next.id);
          loadComponentIntoState(rec);
          setSavedAt(rec.updatedAt);
          await setActiveComponentApi(projectId, next.id).catch(() => {});
        } catch {
          // The just-deleted component is already gone from `components` above; leaving the
          // (now-deleted) design in view is safer than throwing away unsaved edits by
          // guessing at a replacement that also failed to load.
        }
      }
    }
    await refreshComponentList(projectId);
  };

  const handleRenameProject = async (name: string) => {
    setProjectName(name);
    if (!projectId) return;
    try {
      await renameProjectApi(projectId, name);
    } catch {
      // offline -- name only lives in local state until connectivity is back
    }
  };

  const sys = catalog[brand][Math.min(systemIndex, catalog[brand].length - 1)];
  const glass = glassCatalog[glassIndex];
  const color = colors[brand][Math.min(colorIndex, colors[brand].length - 1)];
  // Wing types the active System can physically host (Fijo/Puerta/Practicable/Corredera
  // categories each allow a different set) -- feeds both the Toolbox palette and the
  // Properties panel's own wing picker so neither ever offers an incompatible assignment.
  const allowedWings = useMemo(() => allowedWingsFor(sys), [sys]);

  const changeBrand = (b: Brand) => {
    const nextSys = catalog[b][0];
    setBrand(b);
    setSystemIndex(0);
    setColorIndex(0);
    setRail(nextSys.rails[0]);
    setTree((prev) => remapTreeToSystem(prev, allowedWingsFor(nextSys)));
  };
  const changeSystem = (i: number) => {
    const nextSys = catalog[brand][i];
    setSystemIndex(i);
    setRail(nextSys.rails[0]);
    setTree((prev) => remapTreeToSystem(prev, allowedWingsFor(nextSys)));
  };
  const changeTab = (t: Tab) => { setTab(t); if (t !== "Diseño") setActiveTool({ mode: "select" }); };
  const changeView = (v: ViewMode) => { setView(v); if (v === "3D") setPresetToken((n) => n + 1); };
  const changePreset = (p: ViewPreset3D) => { setViewPreset(p); setPresetToken((n) => n + 1); };

  const profileSystems = useMemo(() => Array.from(new Set(profileFamilies.map((f) => f.system))).sort(), []);
  const filteredFamilies = useMemo(() => {
    const q = profileSearch.trim().toLowerCase();
    return profileFamilies.filter(
      (f) =>
        (profileSystemFilter === "Todos" || f.system === profileSystemFilter) &&
        (!q || f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q))
    );
  }, [profileSearch, profileSystemFilter]);

  const calc = useMemo(
    () => calcQuote({ width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount, marco, barLengthMm }),
    [width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount, marco, barLengthMm]
  );

  const selectedLeaf = useMemo(() => {
    const n = findNode(tree, selectedId);
    return n && n.kind === "leaf" ? n : null;
  }, [tree, selectedId]);

  const selectedDims = useMemo(() => calc.leaves.find((l) => l.id === selectedId) ?? null, [calc.leaves, selectedId]);

  const parentSplitId = useMemo(() => findParentSplitId(tree, selectedId), [tree, selectedId]);
  const canMerge = useMemo(() => {
    if (!parentSplitId) return false;
    const node = findNode(tree, parentSplitId);
    return !!node && node.kind === "split" && node.children.every(isLeaf);
  }, [tree, parentSplitId]);

  const configSummary = useMemo(
    () => Array.from(new Set(calc.leaves.map((l) => wingDefs.find((w) => w.id === l.wing)?.name ?? l.wing))).join(" + "),
    [calc.leaves]
  );

  // ---------- Self-check: re-run whenever anything relevant to it changes, and periodically ----------
  useEffect(() => {
    const run = () =>
      setSelfCheck(
        runSelfCheck({
          tree, width, height, qty, sys, glass, color, rail, installation, transport, margin, discount, marco, threeReady,
          componentIds: components.map((c) => c.id),
          activeComponentId: componentId,
        })
      );
    run();
    const id = setInterval(run, 25000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, width, height, qty, sys, glass, color, rail, installation, transport, margin, discount, marco, threeReady, components, componentId]);

  // ---------- Tree-mutation click helpers (split/assign-wing tools only apply via a leaf's own
  // pane rect; select-tool clicks just move focus, see handlePartClick below) ----------
  const applyLeafClick = (id: string, clientX: number, clientY: number, rect: DOMRect) => {
    if (activeTool.mode === "split") {
      const axis = activeTool.axis;
      const fraction = axis === "col" ? (clientX - rect.left) / rect.width : (clientY - rect.top) / rect.height;
      const result = splitLeaf(tree, id, axis, fraction);
      const node = findNode(result, id);
      setTree(result);
      if (node && node.kind === "split") setSelectedId(node.children[0].id);
      setActiveTool({ mode: "select" });
      return;
    }
    if (activeTool.mode === "assign-wing") {
      setTree((prev) => setWing(prev, id, activeTool.wing));
      setSelectedId(id);
      setActiveTool({ mode: "select" });
    }
  };

  // Unified handler for every 2D hit zone on a leaf (marco side, hoja, vidrio, vidrio side,
  // herraje) — mirrors static/cotizador.html's "part-click" delegated handler.
  const handlePartClick = (id: string, part: PartKind, side: SideKey | null, e: MouseEvent<HTMLButtonElement>) => {
    if (activeTool.mode === "select") {
      setFocusScope("leaf");
      setSelectedId(id);
      setFocusPart(part);
      setFocusSide(side);
      return;
    }
    const paneEl = (e.target as HTMLElement).closest<HTMLElement>(".pane");
    if (paneEl) applyLeafClick(id, e.clientX, e.clientY, paneEl.getBoundingClientRect());
    setFocusScope("leaf");
    setFocusPart(null);
    setFocusSide(null);
  };

  // Assembly marco (state.marco) focus — always forces select mode, matching static (the
  // assembly marco isn't a leaf, so split/assign-wing tools don't apply to it).
  const handleAssemblyFocus = (side: SideKey | null) => {
    setActiveTool({ mode: "select" });
    setFocusScope("assembly");
    setFocusPart("marco");
    setFocusSide(side);
  };

  // The central-lock marker (⚿) sits outside any leaf's pane DOM (it's drawn at the window
  // level, between two leaves), so unlike other hit zones it only supports select-mode focus —
  // there's no pane rect to compute a split fraction from.
  const handleCentralLockClick = (id: string) => {
    if (activeTool.mode !== "select") return;
    setFocusScope("leaf");
    setSelectedId(id);
    setFocusPart("herraje");
    setFocusSide(null);
  };

  const handleExplorerSelectLeaf = (id: string, part: PartKind) => {
    setActiveTool({ mode: "select" });
    setFocusScope("leaf");
    setSelectedId(id);
    setFocusPart(part);
    setFocusSide(null);
  };
  const handleExplorerLeafSide = (id: string, side: SideKey) => {
    setActiveTool({ mode: "select" });
    setFocusScope("leaf");
    setSelectedId(id);
    setFocusPart("marco");
    setFocusSide(side);
  };
  const handleExplorerGlassSide = (id: string, side: SideKey) => {
    setActiveTool({ mode: "select" });
    setFocusScope("leaf");
    setSelectedId(id);
    setFocusPart("vidrio");
    setFocusSide(side);
  };

  const handle3DSelect = (id: string, part: PartKind, side: SideKey | null) => {
    setFocusScope("leaf");
    setSelectedId(id);
    setFocusPart(part);
    setFocusSide(side);
  };
  const handle3DSplit = (id: string, axis: "row" | "col", fraction: number) => {
    const result = splitLeaf(tree, id, axis, fraction);
    const node = findNode(result, id);
    setTree(result);
    if (node && node.kind === "split") {
      setSelectedId(node.children[0].id);
      setFocusScope("leaf");
      setFocusPart(null);
      setFocusSide(null);
    }
    setActiveTool({ mode: "select" });
  };
  const handle3DAssignWing = (id: string) => {
    if (activeTool.mode !== "assign-wing") return;
    setTree((prev) => setWing(prev, id, activeTool.wing));
    setSelectedId(id);
    setFocusScope("leaf");
    setFocusPart(null);
    setFocusSide(null);
    setActiveTool({ mode: "select" });
  };

  const updatePane = (key: keyof PaneSpec, value: string | boolean | number) => {
    if (!selectedLeaf) return;
    setTree((prev) => updateSpec(prev, selectedLeaf.id, { [key]: value } as Partial<PaneSpec>));
  };
  // Changes a leaf's wing type directly from the Properties panel -- same mutation the
  // Toolbox's assign-wing tool performs, just without needing to click the canvas first.
  const handleChangeWing = (wing: WingType) => {
    if (!selectedLeaf) return;
    setTree((prev) => setWing(prev, selectedLeaf.id, wing));
  };
  const updateLeafSide = (side: SideKey, patch: Partial<Side>) => {
    if (!selectedLeaf) return;
    setTree((prev) => updateSide(prev, selectedLeaf.id, side, patch));
  };
  const updateLeafGlassSide = (side: SideKey, patch: Partial<GlassSide>) => {
    if (!selectedLeaf) return;
    setTree((prev) => updateGlassSide(prev, selectedLeaf.id, side, patch));
  };
  const handleMarcoChange = (patch: Partial<Marco>) => setMarco((prev) => updateMarco(prev, patch));
  const handleMarcoSideChange = (side: SideKey, patch: Partial<Side>) => setMarco((prev) => updateMarcoSide(prev, side, patch));

  const handleMerge = () => {
    if (!parentSplitId) return;
    setTree((prev) => removeSplit(prev, parentSplitId));
    setSelectedId(parentSplitId);
    setFocusPart(null);
    setFocusSide(null);
    setFocusScope("leaf");
  };

  const handleApplyTypology = (t: TypologyDef) => {
    const fresh = t.build();
    setTree(fresh);
    setSelectedId(firstLeafId(fresh));
    setActiveTool({ mode: "select" });
    setFocusPart(null);
    setFocusSide(null);
    setFocusScope("leaf");
  };

  const handleResetTree = () => {
    const fresh = createDefaultTree();
    setTree(fresh);
    setSelectedId(firstLeafId(fresh));
    setActiveTool({ mode: "select" });
    setFocusPart(null);
    setFocusSide(null);
    setFocusScope("leaf");
    setMarco(defaultMarco());
  };

  // Always print one of the polished report documents, never whatever tab happened to be
  // open — printing straight from the Diseño canvas produced a messy, unpaginated dump of the
  // editor UI instead of a real report.
  const handlePrint = () => {
    setTab("Informes");
    setActiveTool({ mode: "select" });
    setReport("Cotización");
    setTimeout(() => window.print(), 0);
  };

  // Exports whatever report is currently on screen (single-component or "Proyecto completo",
  // window.print()'s PDF path doesn't care which) as a standalone .html file -- see
  // lib/exportDoc.ts for why this is DOM-based instead of re-rendering the report server-side.
  const handleExportHtml = () => {
    const scoped = reportScope === "proyecto" && scopeApplies;
    const base = `${report.replace(/\s+/g, "_")}${scoped ? "_Proyecto" : ""}_${designation}`;
    exportReportHtml(`${report}${scoped ? " - Proyecto" : ""} - ${designation}`, `${base}.html`);
  };

  // CSV covers the two reports that are naturally one-row-per-piece tables (see lib/exportDoc.ts
  // for why DOCX/XLS aren't included). Only meaningful for the active component -- a project-wide
  // CSV would need to flatten buildProjectCutList's cross-component groups, not done here.
  const handleExportCsv = () => {
    if (report === "Pedido de vidrio") {
      const rows: (string | number)[][] = [["No.", "Posición", "W (mm)", "H (mm)", "Cant.", "m2", "m2 total", "Vidrio"]];
      calc.leaves.forEach((l, i) => {
        const name = l.spec.glass !== "Heredar vidrio general" ? l.spec.glass : glass.name;
        const w = Math.max(0, Math.round(l.wMm - 120));
        const h = Math.max(0, Math.round(l.hMm - 120));
        rows.push([i + 1, `${designation}.${String.fromCharCode(65 + i)}`, w, h, qty, l.glassArea.toFixed(3), (l.glassArea * qty).toFixed(3), name]);
      });
      downloadFile(`Pedido_de_vidrio_${designation}.csv`, toCsv(rows), "text/csv");
      return;
    }
    if (report === "Optimización de corte") {
      const cut = buildCutList(tree, width, height, sys);
      const rows: (string | number)[][] = [["Categoria", "Barra", "Pieza", "Longitud (mm)", "Angulo", "Etiqueta"]];
      const categories: [string, typeof cut.marco][] = [
        ["Marco", cut.marco],
        ["Travesaño", cut.travesanos],
        ["Hoja", cut.hojas],
        ["Junquillo", cut.junquillos],
      ];
      categories.forEach(([label, pieces]) => {
        const allPieces = [];
        for (let i = 0; i < qty; i++) allPieces.push(...pieces);
        const bars = packBars(allPieces, barLengthMm, KERF_MM);
        bars.forEach((bar, bi) => {
          bar.pieces.forEach((p, pi) => rows.push([label, bi + 1, pi + 1, p.length, p.angle, p.label]));
        });
      });
      downloadFile(`Optimizacion_de_corte_${designation}.csv`, toCsv(rows), "text/csv");
      return;
    }
  };

  const hasRailOptions = sys.rails.some((x) => x > 0);

  const leaves = useMemo(() => walkLeaves(tree), [tree]);
  const leafGlassWarnings = leaves
    .filter((l) => l.spec.glass !== "Heredar vidrio general")
    .map((l) => {
      const g = glassCatalog.find((x) => x.name === l.spec.glass);
      return g && g.thickness > sys.glazing
        ? `Hoja con vidrio propio "${g.name}" (${g.thickness} mm) supera el galce de referencia (${sys.glazing} mm).`
        : null;
    })
    .filter((x): x is string => !!x);
  const leafRailWarnings = leaves
    .filter((l) => SLIDING_WINGS.includes(l.wing) && rail > 0 && l.spec.railIndex > rail)
    .map((l) => `Una hoja corrediza está asignada al riel ${l.spec.railIndex}, pero la configuración actual solo tiene ${rail} riel(es).`);

  const warnings = [
    ...(width < MIN_OPENING_MM || height < MIN_OPENING_MM ? [`Medida menor al mínimo fabricable de ${MIN_OPENING_MM} × ${MIN_OPENING_MM} mm — se ajustará al salir del campo.`] : []),
    ...(width > sys.maxW || height > sys.maxH ? [`Medida supera el límite de referencia ${sys.maxW} × ${sys.maxH} mm.`] : []),
    ...(glass.thickness > sys.glazing ? [`Vidrio de ${glass.thickness} mm supera el galce de referencia (${sys.glazing} mm).`] : []),
    ...(rail > 0 && !sys.rails.includes(rail) ? [`El sistema no contempla ${rail} riel(es).`] : []),
    ...leafGlassWarnings,
    ...leafRailWarnings,
  ];

  const toolHint =
    activeTool.mode === "select"
      ? "Haz clic en el marco, la hoja, el vidrio o el herraje para seleccionar esa parte"
      : activeTool.mode === "split"
      ? `Haz clic dentro de una hoja para dividirla (${activeTool.axis === "col" ? "vertical" : "horizontal"})`
      : `Haz clic en una hoja para asignarle "${wingDefs.find((w) => w.id === activeTool.wing)?.name}"`;

  return (
    <main>
      <TopBar code={code} designation={designation} location={location} onPrint={handlePrint} selfCheck={selfCheck} savedAt={savedAt} />
      <ModuleNav tabs={TABS} active={tab} onChange={changeTab} />

      <section className="workspace" id="top">
        <aside className="configPanel">
          <div className="eyebrow">MOTOR DE CONFIGURACIÓN · MX</div>
          <h1>{tab}</h1>
          <p className="lead">Sistema técnico de diseño, consumo y cotización para cancelería de PVC.</p>

          {tab === "Proyecto" && (
            <>
              <Block n="01" title="Proyecto" sub="Un proyecto agrupa varias ventanas/puertas (componentes) que se cotizan y fabrican juntas." />
              <label>Nombre del proyecto
                <input value={projectName} onChange={(e) => handleRenameProject(e.target.value)} />
              </label>
              {persistMode === "offline" && (
                <p className="sourceNote">⚠ Sin conexión con la base de datos — guardando solo en este navegador. Los componentes de otros dispositivos no aparecerán hasta reconectar.</p>
              )}
              <Block n="02" title="Componentes" sub="Cada uno es una ventana o puerta independiente dentro del proyecto." />
              <div className="componentOutliner">
                {components.map((c) => (
                  <div key={c.id} className={`componentRow ${c.id === componentId ? "active" : ""}`}>
                    <button className="componentMain" onClick={() => handleSwitchComponent(c.id)}>
                      <b>{c.code} · {c.designation}</b>
                      <span>{c.location || "Sin ubicación"} · {c.widthMm}×{c.heightMm} mm · {c.brand} · cant. {c.qty}</span>
                    </button>
                    <div className="componentActions">
                      <button title="Duplicar" onClick={() => handleDuplicateComponent(c.id)}>⧉</button>
                      <button title="Eliminar" disabled={components.length <= 1} onClick={() => handleDeleteComponent(c.id)}>✕</button>
                    </div>
                  </div>
                ))}
                {components.length === 0 && <p className="notice">Este componente aún no se ha guardado en un proyecto (modo sin conexión).</p>}
              </div>
              <button className="fullButton" onClick={handleAddComponent} disabled={!projectId}>+ Agregar componente</button>
            </>
          )}

          {tab === "Resumen" && (
            <>
              <Block n="01" title="Proyecto y cliente" sub="Datos que aparecerán en la oferta." />
              <div className="inputGrid two">
                <label>Código<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
                <label>Designación<input value={designation} onChange={(e) => setDesignation(e.target.value)} /></label>
              </div>
              <label>Ubicación / descripción<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
              <Block n="02" title="Datos para la cotización" sub="Aparecen en la Cotización del cliente imprimible." />
              <label>Cliente<input placeholder="Sr./Sra./Arq. ..." value={client} onChange={(e) => setClient(e.target.value)} /></label>
              <label>Dirección del proyecto<input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></label>
              <label>Fecha de entrega<input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></label>
              <Block n="03" title="Condiciones comerciales" sub="Texto libre de la página de condiciones en la Cotización del cliente. Vacío = texto por defecto." />
              <label>Encabezado de la oferta
                <textarea
                  rows={2}
                  placeholder="Estimado/a, según sus indicaciones le presentamos la oferta de los productos solicitados. A continuación, el desglose de cada elemento:"
                  value={termsHeader}
                  onChange={(e) => setTermsHeader(e.target.value)}
                />
              </label>
              <label>Forma de pago
                <textarea
                  rows={3}
                  placeholder={"A) 70% al momento de aprobación y firma del presente Contrato/Presupuesto.\nB) 30% al aviso de embarque de cancelería o vidrio."}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </label>
              <div className="summaryCard">
                <span>Marca</span><b>{brand}</b>
                <span>Sistema</span><b>{sys.name}</b>
                <span>Configuración</span><b>{configSummary}</b>
                <span>Superficie total</span><b>{(calc.area * qty).toFixed(3)} m²</b>
              </div>
            </>
          )}

          {tab === "Diseño" && (
            <>
              <Block n="01" title="Marca y sistema" sub="Catálogo técnico del proyecto." />
              <div className="segmented">
                <button className={brand === "Aluplast" ? "selected" : ""} style={brand === "Aluplast" ? { background: brandAccent.Aluplast } : undefined} onClick={() => changeBrand("Aluplast")}>ALUPLAST</button>
                <button className={brand === "Deceuninck" ? "selected" : ""} style={brand === "Deceuninck" ? { background: brandAccent.Deceuninck } : undefined} onClick={() => changeBrand("Deceuninck")}>DECEUNINCK</button>
              </div>
              <label>Sistema
                <select value={systemIndex} onChange={(e) => changeSystem(Number(e.target.value))}>
                  {catalog[brand].map((x, i) => <option key={x.name} value={i}>{x.name}{x.sourced ? " ✓" : ""}</option>)}
                </select>
              </label>
              {sys.sourced ? (
                <p className="sourceNote"><b>✓ Datos reales</b> — precio de marco/hoja tomado de la lista EXWORK Veracruz (rev. ABR_22), convertido a MXN @ {EUR_MXN}.</p>
              ) : (
                <p className="sourceNote">Precio de marco/hoja estimado (sin lista de precios de origen para este sistema).</p>
              )}
              {hasRailOptions && (
                <label>Tipo de riel
                  <select value={rail} onChange={(e) => setRail(Number(e.target.value))}>
                    {sys.rails.map((x) => <option key={x} value={x}>{x === 1 ? "Monorriel" : `${x} rieles`}</option>)}
                  </select>
                </label>
              )}
              <Block n="02" title="Tipología" sub="Elige una configuración prediseñada para reemplazar la composición actual, o arma la tuya con la paleta del lienzo." />
              <TypologyPicker onApply={handleApplyTypology} />
              <Block n="03" title="Composición" sub="Haz clic en el marco, la hoja, el vidrio o el herraje del dibujo para seleccionar esa parte, o usa la paleta para dividir y asignar tipos de apertura." />
              <ExplorerTree
                tree={tree}
                selectedId={selectedId}
                focusScope={focusScope}
                focusPart={focusPart}
                focusSide={focusSide}
                onSelectMarco={() => handleAssemblyFocus(null)}
                onSelectMarcoSide={(side) => handleAssemblyFocus(side)}
                onSelectLeaf={handleExplorerSelectLeaf}
                onSelectLeafSide={handleExplorerLeafSide}
                onSelectGlassSide={handleExplorerGlassSide}
              />
              <Block n="04" title="Geometría" sub="Cotas generales en milímetros." />
              <div className="inputGrid">
                {/* Clamp to MIN_OPENING_MM on blur, not on every keystroke -- clamping mid-typing
                    snaps "1" to "300" before the next digit lands, so typing "1200" digit-by-digit
                    never reaches it. The warnings list above still flags an in-progress out-of-range
                    value immediately; only the hard floor waits for blur. */}
                <label>Ancho<input type="number" value={width} onChange={(e) => setWidth(Math.max(0, Number(e.target.value) || 0))} onBlur={() => setWidth((v) => Math.max(MIN_OPENING_MM, v))} /></label>
                <label>Alto<input type="number" value={height} onChange={(e) => setHeight(Math.max(0, Number(e.target.value) || 0))} onBlur={() => setHeight((v) => Math.max(MIN_OPENING_MM, v))} /></label>
                <label>Cant.<input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} /></label>
              </div>
              <Block n="05" title="Materiales" sub="Color, aplicación y vidrio." />
              <label>Color / folio
                <select value={colorIndex} onChange={(e) => setColorIndex(Number(e.target.value))}>
                  {colors[brand].map((x, i) => <option value={i} key={x.code}>{x.code} · {x.name}</option>)}
                </select>
              </label>
              <div className="inputGrid two">
                <label>Aplicación
                  <select value={face} onChange={(e) => setFace(e.target.value)}>
                    <option>Exterior</option><option>Interior</option><option>Ambas caras</option>
                  </select>
                </label>
                <label>Vidrio
                  <select value={glassIndex} onChange={(e) => setGlassIndex(Number(e.target.value))}>
                    {glassCatalog.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}

          {tab === "Consumo" && (
            <>
              <Block n="01" title="Optimización de corte" sub="Patrones preliminares sobre barras comerciales de 6 m." />
              <div className="optimization">
                <strong>{calc.bars}</strong><span>barras estimadas</span>
                <b>{calc.waste.toFixed(2)} m</b><span>remanente teórico</span>
              </div>
              <label>Longitud de barra
                <select value={barLengthMm} onChange={(e) => setBarLengthMm(Number(e.target.value))}>
                  <option value={5800}>5,800 mm (estándar)</option>
                  <option value={6000}>6,000 mm</option>
                  <option value={6500}>6,500 mm</option>
                </select>
              </label>
              <div className="cutPlan">
                {calc.leaves.slice(0, 6).map((l, i) => {
                  const pieces = [Math.round(l.wMm), Math.round(l.hMm)];
                  const used = Math.min(5800, pieces.reduce((a, b) => a + b, 0));
                  return (
                    <div key={l.id}>
                      <header><b>Hoja {String.fromCharCode(65 + i)}</b><span>{used} / 6000 mm</span></header>
                      <section>
                        {pieces.map((p, j) => <i key={j} style={{ width: `${Math.max(12, p / 60)}%` }}>{p}</i>)}
                        <em style={{ flex: 1 }}>{Math.max(0, 6000 - used)}</em>
                      </section>
                    </div>
                  );
                })}
              </div>
              <p className="notice">La optimización definitiva depende de descuentos, ángulos, soldadura, refuerzos, sierra y reglas específicas del catálogo.</p>
              <Block n="02" title="Catálogo de perfiles y accesorios" sub="Datos reales Aluplast · lista EXWORK Veracruz, revisión ABR_22 (01/05/2022). 278 familias normalizadas." />
              <div className="profileFilters">
                <label>Buscar<input type="text" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} /></label>
                <label>Sistema
                  <select value={profileSystemFilter} onChange={(e) => setProfileSystemFilter(e.target.value)}>
                    {["Todos", ...profileSystems].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <p className="profileCount">Mostrando {filteredFamilies.length} de {profileFamilies.length} familias.</p>
              <div className="profileCatalog">
                {filteredFamilies.map((f) => (
                  <div key={f.code}>
                    <span className="profileSketch">▥</span>
                    <section><b>{f.code}</b><p>{f.name}</p><small>{f.system} · €{f.priceEUR.toFixed(2)} (~{money(f.priceEUR * EUR_MXN)})</small></section>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "Servicios" && (
            <>
              <Block n="01" title="Costos adicionales" sub="Recargos y condiciones comerciales." />
              <label>Instalación por pieza<input type="number" value={installation} onChange={(e) => setInstallation(Number(e.target.value))} /></label>
              <label>Transporte por pieza<input type="number" value={transport} onChange={(e) => setTransport(Number(e.target.value))} /></label>
              <label>Margen de utilidad <b>{margin}%</b><input type="range" min="10" max="60" value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></label>
              <label>Descuento <b>{discount}%</b><input type="range" min="0" max="20" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
            </>
          )}

          {tab === "Informes" && (
            <>
              <Block n="01" title="Centro de informes" sub="Selecciona el documento y genera PDF." />
              {scopeApplies && components.length > 1 && (
                <div className="segmented">
                  <button className={reportScope === "vano" ? "selected" : ""} onClick={() => setReportScope("vano")}>Componente actual</button>
                  <button className={reportScope === "proyecto" ? "selected" : ""} onClick={() => setReportScope("proyecto")}>Proyecto completo ({components.length})</button>
                </div>
              )}
              <div className="reportList">
                {REPORTS.map((r) => (
                  <button className={report === r ? "selected" : ""} key={r} onClick={() => setReport(r)}>{r}<span>Ver →</span></button>
                ))}
              </div>
              <button className="fullButton" onClick={() => window.print()}>
                Exportar {report}{reportScope === "proyecto" && scopeApplies ? " (Proyecto)" : ""} a PDF <span>↗</span>
              </button>
              <div className="inputGrid two">
                <button className="fullButton" onClick={handleExportHtml}>Exportar a HTML</button>
                {(report === "Optimización de corte" || report === "Pedido de vidrio") && !(reportScope === "proyecto" && scopeApplies) && (
                  <button className="fullButton" onClick={handleExportCsv}>Exportar a CSV</button>
                )}
              </div>
            </>
          )}
        </aside>

        <section className="visualPanel">
          <div className="visualHeader">
            <div><span className="statusDot" />VISTA {view.toUpperCase()}{view === "3D" ? ` · ${viewPreset}` : ""} · {configSummary}</div>
            <div className="viewSwitch">
              {VIEW_MODES.map((v) => (
                <button key={v} className={view === v ? "active" : ""} onClick={() => changeView(v)}>{v}</button>
              ))}
            </div>
          </div>
          {view === "3D" && (
            <div className="presetRow">
              {PRESETS_3D.map((p) => (
                <button key={p} className={viewPreset === p ? "active" : ""} onClick={() => changePreset(p)}>{p}</button>
              ))}
            </div>
          )}
          <div className={`canvas view-${view.replace("ó", "o")}`}>
            {tab === "Diseño" && (
              <Toolbox
                activeTool={activeTool} onToolChange={setActiveTool} canMerge={canMerge} onMerge={handleMerge} onReset={handleResetTree}
                canUndo={past.length > 0} canRedo={future.length > 0} onUndo={handleUndo} onRedo={handleRedo}
                allowedWings={allowedWings}
              />
            )}
            <div className="canvasStage" onClick={(e) => { if (e.target === e.currentTarget) clearFocus(); }}>
              {view !== "3D" && (
                <>
                  <div className="dim top"><EditableDim label="W" valueMm={width} min={MIN_OPENING_MM} onCommit={setWidth} /></div>
                  <div className="dim side"><EditableDim label="H" valueMm={height} min={MIN_OPENING_MM} onCommit={setHeight} /></div>
                </>
              )}
              {view === "Sección" && <SectionRender depth={sys.depth} rail={rail} glazing={glass.thickness} />}
              {view === "2D" && (
                <FrameCanvas
                  tree={tree}
                  width={width}
                  height={height}
                  selectedId={selectedId}
                  color={color}
                  system={sys}
                  focusScope={focusScope}
                  focusPart={focusPart}
                  focusSide={focusSide}
                  showFocus
                  onPartClick={handlePartClick}
                  onAssemblyMarcoClick={handleAssemblyFocus}
                  onCentralLockClick={handleCentralLockClick}
                />
              )}
              <div className={`canvas3dWrap ${view === "3D" ? "" : "canvas3dWrapHidden"}`}>
                <Scene3D
                  tree={tree}
                  width={width}
                  height={height}
                  sys={sys}
                  color={color}
                  selectedId={selectedId}
                  focusScope={focusScope}
                  focusPart={focusPart}
                  focusSide={focusSide}
                  activeTool={activeTool}
                  viewPreset={viewPreset}
                  presetToken={presetToken}
                  onSelect={handle3DSelect}
                  onSplit={handle3DSplit}
                  onAssignWing={handle3DAssignWing}
                  onReady={() => setThreeReady(true)}
                />
              </div>
              <div className="editHint">{toolHint}</div>
              <div className="specChip">
                <b>{brand} · {sys.name}</b>
                <span>{sys.depth} mm · {sys.chambers} · {rail ? `${rail} riel${rail > 1 ? "es" : ""}` : "practicable"}</span>
                <span>{glass.name} · {face}</span>
              </div>
            </div>
          </div>
          <div className="metricRow">
            <div><span>SUPERFICIE</span><strong>{calc.area.toFixed(3)} m²</strong></div>
            <div><span>VIDRIO ÚTIL</span><strong>{calc.glassArea.toFixed(3)} m²</strong></div>
            <div><span>HOJAS</span><strong>{calc.leaves.length}</strong></div>
            <div><span>REFERENCIA</span><strong>{code}-{designation}</strong></div>
          </div>
        </section>

        <aside className="quotePanel">
          <div className="quoteHead">
            <div><span>PROPIEDADES</span><strong>{designation}</strong></div>
            <span className={`badge ${warnings.length ? "warning" : ""}`}>{warnings.length ? `${warnings.length} alerta${warnings.length > 1 ? "s" : ""}` : "Compatible"}</span>
          </div>
          {warnings.length > 0 && <div className="warnings">{warnings.map((x) => <p key={x}>⚠ {x}</p>)}</div>}

          {tab === "Diseño" && focusScope === "assembly" && (
            <MarcoPanel marco={marco} focusSide={focusSide} onChange={handleMarcoChange} onChangeSide={handleMarcoSideChange} />
          )}
          {tab === "Diseño" && focusScope === "leaf" && selectedLeaf && (
            <PropertiesPanel
              leaf={selectedLeaf}
              dims={selectedDims}
              focusPart={focusPart}
              focusSide={focusSide}
              canMerge={canMerge}
              brand={brand}
              systemName={sys.name}
              railCount={rail}
              allowedWings={allowedWings}
              onChangeWing={handleChangeWing}
              onChange={updatePane}
              onChangeSide={updateLeafSide}
              onChangeGlassSide={updateLeafGlassSide}
              onMerge={handleMerge}
            />
          )}

          {tab === "Informes" ? (
            reportScope === "proyecto" && scopeApplies ? (
              !projectComponents ? (
                <p className="notice">{projectComponentsLoading ? "Cargando componentes del proyecto…" : "No se pudieron cargar los componentes del proyecto."}</p>
              ) : report === "Cotización" ? (
                <ProjectCotizacionDoc components={projectComponents} projectName={projectName} client={client} clientAddress={clientAddress} deliveryDate={deliveryDate} />
              ) : report === "Optimización de corte" ? (
                <ProjectCorteDoc components={projectComponents} projectName={projectName} barLengthMm={barLengthMm} />
              ) : (
                <ProjectVidrioDoc components={projectComponents} projectName={projectName} />
              )
            ) : report === "Cotización" ? (
              <CotizacionDoc
                calc={calc} sys={sys} glass={glass} color={color} brand={brand} tree={tree} width={width} height={height} qty={qty}
                code={code} designation={designation} location={location} client={client} clientAddress={clientAddress} deliveryDate={deliveryDate}
                configSummary={configSummary} termsHeader={termsHeader} paymentTerms={paymentTerms}
              />
            ) : report === "Optimización de corte" ? (
              <CorteDoc tree={tree} width={width} height={height} qty={qty} designation={designation} location={location} system={sys} barLengthMm={barLengthMm} />
            ) : report === "Pedido de vidrio" ? (
              <VidrioDoc calc={calc} glass={glass} qty={qty} designation={designation} location={location} />
            ) : (
              <ReportPreview
                report={report} code={code} designation={designation} location={location} brand={brand} system={sys.name} qty={qty}
                width={width} height={height} glassName={glass.name} configSummary={configSummary} calc={calc}
              />
            )
          ) : (
            <>
              <div className="propertyGroup">
                <h2>Información general</h2>
                <Prop k="Nombre completo" v={`${designation} · ${location}`} />
                <Prop k="Referencia" v={`${code}.${brand.slice(0, 3).toUpperCase()}`} />
                <Prop k="Configuración" v={configSummary} />
                <Prop k="Hojas" v={String(calc.leaves.length)} />
                <Prop k="Riel inferior" v={rail ? String(rail) : "N/A"} />
              </div>
              <div className="propertyGroup">
                <h2>Geometría</h2>
                <Prop k="Forma" v="Rectángulo" />
                <Prop k="W" v={`${width.toLocaleString()} mm`} />
                <Prop k="H" v={`${height.toLocaleString()} mm`} />
                <Prop k="Perímetro" v={`${calc.perimeter.toFixed(3)} m`} />
                <Prop k="Superficie" v={`${calc.area.toFixed(3)} m²`} />
              </div>
              <div className="propertyGroup">
                <h2>Prestaciones del sistema</h2>
                <Prop k="Profundidad" v={`${sys.depth} mm`} />
                <Prop k="Acristalamiento máx." v={`${sys.glazing} mm`} />
                <Prop k="Valor Uf" v={sys.uf} />
                <Prop k="Límite de referencia" v={`${sys.maxW} × ${sys.maxH} mm`} />
              </div>
              <div className="costSummary">
                <h2>Costos del elemento</h2>
                <Cost label="Perfiles" value={calc.profileCost} />
                <Cost label="Accesorios y herrajes" value={calc.accessories + calc.reinforce + calc.seals} />
                {calc.addons > 0 && <Cost label="Persianas Mallorquina" value={calc.addons} />}
                <Cost label="Vidrio" value={calc.glassCost} />
                <Cost label="Servicios y consumibles" value={installation + transport + calc.consumables} />
                <div className="direct"><span>Costo directo / pza.</span><b>{money(calc.direct)}</b></div>
              </div>
              <div className="totalBox">
                <span>TOTAL OFERTA <small>IVA no incluido</small></span>
                <strong>{money(calc.total)}</strong>
                <div><span>Utilidad estimada</span><b>{money(calc.utility)}</b></div>
              </div>
              <details className="materials" open>
                <summary>Consumo calculado</summary>
                <Item code="PVC-MARCO" name="Marco / riel" qty={`${calc.frameM.toFixed(2)} m`} />
                <Item code="PVC-HOJA" name="Perfil de hoja" qty={`${calc.sashM.toFixed(2)} m`} />
                <Item code="VIDRIO" name={glass.name} qty={`${calc.glassArea.toFixed(3)} m²`} />
                <Item code="REF-AC" name="Refuerzo galvanizado" qty={`${(calc.frameM + calc.sashM).toFixed(2)} m`} />
                <Item code="EPDM" name="Juntas y sellos" qty={`${(calc.frameM + calc.sashM).toFixed(2)} m`} />
                <Item code="HERRAJE" name="Juego de herrajes" qty={`${calc.hardwareLeafCount} set`} />
              </details>
              <p className="priceNote">Motor técnico v4 · Editor compositivo estilo RA Workshop + catálogo real Aluplast (EXWORK Veracruz, rev. ABR_22 2022). Valores en MXN. Los precios y límites deben validarse con la lista vigente y la ingeniería de cada proyecto.</p>
            </>
          )}
        </aside>
      </section>
      <footer className="sources">
        <b>Base técnica:</b> documentación RA Workshop aportada, catálogo real Aluplast (lista EXWORK Veracruz, rev. ABR_22 2022), <a href="https://www.aluplast.net/eng-int/products/windows/ideal/" target="_blank">sistemas oficiales Aluplast</a> y <a href="https://www.deceuninck.com.mx/en/pdf/catalogo_tecnico.pdf" target="_blank">catálogo técnico Deceuninck México</a>.
      </footer>
    </main>
  );
}
