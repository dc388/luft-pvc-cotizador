"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import type { CompanySettings } from "@/lib/companySettings";
import type { Brand, GlassSide, Marco, PaneSpec, Report, Side, Tab, Tool, ViewMode, ViewPreset3D } from "@/types/domain";
import { catalog, EUR_MXN } from "@/data/catalog";
import { glassCatalog } from "@/data/glass";
import { colors, brandAccent } from "@/data/colors";
import { profileFamilies } from "@/data/families";
import { wingDefs } from "@/data/wings";
import {
  allowedWingsFor,
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
  remapTreeToSystem,
  SLIDING_WINGS,
} from "@/lib/tree";
import {
  BAR_LENGTH_MM, KERF_MM, buildCutList, calcQuote, packBars, MIN_OPENING_MM,
  DEFAULT_WASTE_PCT, DEFAULT_LABOR_MXN_PER_M2, DEFAULT_OVERHEAD_PCT,
} from "@/lib/calc";
import { money } from "@/lib/money";
import { downloadFile, exportReportHtml, toCsv } from "@/lib/exportDoc";
import { runSelfCheck, type SelfCheckResult } from "@/lib/selfCheck";
import {
  bootstrap,
  clearDraft,
  clearProjectOutcomeApi,
  createComponent,
  createProjectVersionApi,
  createProjectApi,
  deleteComponentApi,
  deleteProjectApi,
  downloadBackupFile,
  downloadProjectFile,
  duplicateProjectApi,
  fetchComponent,
  fetchProjectOutcome,
  importProjectFileApi,
  listProjectVersionsApi,
  listProjects,
  listTrashedProjects,
  openProject,
  pendingDraftFor,
  probeProjectFile,
  refetchProject,
  renameProjectApi,
  restoreBackupApi,
  restoreProjectApi,
  restoreProjectVersionApi,
  saveComponent,
  saveProjectOutcomeApi,
  setActiveComponentApi,
  setProjectArchivedApi,
  transferComponentsApi,
  updateProjectApi,
  writeDraft,
  type ComponentDraft,
  type SaveState,
} from "@/lib/persistence";
import type {
  ComponentConfigState,
  ComponentPatch,
  ComponentRecord,
  ComponentSummary,
  ProjectMeta,
  ProjectOutcome,
  ProjectRecord,
  ProjectStatus,
  ProjectSummary,
  ProjectVersionRow,
  Requester,
} from "@/types/project";
import {
  buildRecommendations,
  emptyLearningStats,
  type LearningStats,
  type QuoteTemplate,
  type Recommendation,
  type RecommendationContext,
} from "@/lib/learningRules";
import { clearLearning, fetchLearning, learningStore, recordEvent, setLearningEnabled } from "@/lib/learningClient";
import {
  announceClaimChange,
  claimComponent,
  componentKey,
  isClaimedByAnotherTab,
  newTabId,
  releaseComponent,
  subscribeToClaims,
  takeOverComponent,
  HEARTBEAT_MS,
} from "@/lib/sessionLock";
import { projectOriginLabel, projectStatusLabel } from "@/lib/projectStatus";
import { ProjectExplorer } from "@/components/projects/ProjectExplorer";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { RequesterPanel } from "@/components/projects/RequesterPanel";
import { ComponentList, type BulkAction } from "@/components/projects/ComponentList";
import { QuoteInsights } from "@/components/projects/QuoteInsights";
import { ProjectHistory, type OutcomeDraft } from "@/components/projects/ProjectHistory";
import type { LuftAgentState } from "@/types/luft-ai";
import { emptyLuftAgentState } from "@/types/luft-ai";
import { normalizeAgentState, type LuftActor } from "@/lib/luft-ai";
import { Block } from "@/components/Block";
import { LuftAiPanel } from "@/components/ai/LuftAiPanel";
import { TopBar, ModuleNav } from "@/components/layout/Nav";
import { Toolbox } from "@/components/editor/Toolbox";
import { FrameCanvas } from "@/components/editor/FrameCanvas";
import { SectionRender } from "@/components/editor/SectionRender";
import { Scene3D } from "@/components/editor/Scene3D";
import { ExplorerTree } from "@/components/editor/ExplorerTree";
import { EditableDim } from "@/components/editor/EditableDim";
import { DimensionField } from "@/components/editor/DimensionField";
import { TypologyPicker } from "@/components/editor/TypologyPicker";
import { PanZoomViewport } from "@/components/editor/PanZoomViewport";
import { ElevationKey } from "@/components/editor/ElevationKey";
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
import { CustomerBook } from "@/components/admin/CustomerBook";
import { HerrajesMaco } from "@/components/admin/HerrajesMaco";

// "Clientes" va junto a "Proyecto" y no al final: son las dos pestañas de navegación (a quién le
// cotizamos, qué le cotizamos) y las demás son de trabajo sobre el componente abierto.
const TABS: Tab[] = ["Proyecto", "Clientes", "Resumen", "Diseño", "Consumo", "Servicios", "Catálogos", "Informes"];
const REPORTS: Report[] = ["Cotización", "Optimización de corte", "Pedido de vidrio", "Producción", "Herrajes", "Costos"];
// Reports that can aggregate every component in the project instead of just the active one --
// same three the static prototype grouped (Producción/Herrajes/Costos stay per-component only).
const PROJECT_SCOPED_REPORTS: Report[] = ["Cotización", "Optimización de corte", "Pedido de vidrio"];
const VIEW_MODES: ViewMode[] = ["2D", "3D", "Sección"];
const PRESETS_3D: ViewPreset3D[] = ["Frente", "Planta", "Perfil", "Isométrica"];

// Cuál era el proyecto abierto la última vez. Se recuerda porque abrir la app donde la dejaste es
// parte de poder trabajar en ella todos los días, y "el más reciente por fecha de modificación" no
// siempre es el mismo proyecto: cualquier escritura (archivar otro, restaurar una copia) mueve esa
// fecha. Con el id explícito, volver abre lo que estabas viendo.
const LAST_PROJECT_KEY = "luft-pvc-cotizador:last-project:v1";

function rememberLastProject(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch {
    // Sin almacenamiento se abre el más reciente, que es el comportamiento anterior.
  }
}

function readLastProject(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Nombre del sistema de una marca y un índice cualesquiera, acotado por si el catálogo cambió de
 *  tamaño entre versiones. Fuera del componente a propósito: así se puede usar antes de que el
 *  sistema del componente abierto esté resuelto, sin leer una variable declarada más abajo. */
function systemNameOf(brand: Brand, systemIndex: number): string {
  const systems = catalog[brand];
  return systems[Math.min(systemIndex, systems.length - 1)]?.name ?? "";
}

/** Los metadatos del proyecto, sin el componente abierto, sin el espejo del nombre del cliente y sin
 *  la lista de componentes: esas tres cosas viven en su propio estado porque cambian por su cuenta. */
function projectMetaOf(project: ProjectRecord): ProjectMeta {
  return {
    id: project.id,
    name: project.name,
    folio: project.folio,
    origin: project.origin,
    source: project.source,
    status: project.status,
    requester: project.requester,
    currency: project.currency,
    pricingListId: project.pricingListId,
    notes: project.notes,
    estimatedDate: project.estimatedDate,
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    importedAt: project.importedAt,
    originalCreatedAt: project.originalCreatedAt,
    archivedAt: project.archivedAt,
    deletedAt: project.deletedAt,
    duplicatedFromId: project.duplicatedFromId,
    schemaVersion: project.schemaVersion,
  };
}

// Recibe los datos de empresa ya resueltos por el server component de app/page.tsx. No los lee
// por su cuenta: este archivo es "use client" y lib/companySettings.ts solo existe en servidor
// (ver el comentario de ese archivo sobre por qué la CLABE no puede pasar por el navegador ni
// por una ruta de API mientras no haya autenticación).
export function Workspace({ company, agentActor, agentSignedIn }: { company: CompanySettings; agentActor: LuftActor; agentSignedIn: boolean }) {
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
  // Tarifas de producción. No se guardan con el proyecto todavía: reabrir uno vuelve a los valores
  // por omisión del motor. Persistirlas obliga a tocar el formato .luftproj y la tabla `projects`,
  // y eso es una migración aparte; mientras tanto la referencia es la del motor y no una copia.
  const [wastePct, setWastePct] = useState(DEFAULT_WASTE_PCT);
  const [laborPerM2, setLaborPerM2] = useState(DEFAULT_LABOR_MXN_PER_M2);
  const [overheadPct, setOverheadPct] = useState(DEFAULT_OVERHEAD_PCT);
  const [code, setCode] = useState("001");
  const [designation, setDesignation] = useState("V01");
  const [location, setLocation] = useState("Cocina");
  const [client, setClient] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
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
  // ---------- Estado REAL del autoguardado. Antes solo existía `savedAt`, y con eso un guardado
  // fallido dejaba la insignia mostrando la hora del último éxito: la interfaz decía "Guardado
  // 11:00" mientras nada se estaba guardando. Ahora el estado y el mensaje de error son parte del
  // estado de la aplicación, y "guardado" solo se muestra cuando el servidor lo confirmó. ----------
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  // ---------- Proyecto → Componente: the active component's own fields (width, tree, marco,
  // etc. above) are still flat state exactly as before a single-window app had them -- adding
  // this layer is additive, same as the Proyecto/Vano layer built once in static/cotizador.html:
  // a project with one component behaves identically to the old single-design app. ----------
  const [projectId, setProjectId] = useState<string | null>(null);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Proyecto sin nombre");
  const [components, setComponents] = useState<ComponentSummary[]>([]);
  // ---------- Carpetas: cada proyecto es una carpeta, y cada cotización enviada desde /cotizar
  // crea la suya. Antes la app abría siempre la más reciente y no había pantalla desde la que
  // llegar a las anteriores: quedaban escritas en la base pero invisibles. ----------
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [trashedProjects, setTrashedProjects] = useState<ProjectSummary[]>([]);
  // Los metadatos del proyecto abierto: origen, etapa, folio, ficha del solicitante, preferencias
  // comerciales y sus fechas. Antes solo se guardaban tres campos ({source, folio, client}), que era
  // todo lo que la pantalla podía mostrar.
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [switchingProject, setSwitchingProject] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [luftAi, setLuftAi] = useState<LuftAgentState>(() => emptyLuftAgentState());

  // ---------- Alta de proyecto ----------
  const [showNewProject, setShowNewProject] = useState(false);
  const [createError, setCreateError] = useState("");
  // Se incrementa solo cuando un proyecto se creó de verdad: es la señal para que el formulario
  // descarte lo capturado. Mientras no cambie, un fallo de red conserva todo lo escrito.
  const [createdToken, setCreatedToken] = useState(0);

  // ---------- Deshacer ----------
  // Una sola acción reversible a la vez, la última. No es una pila de deshacer para todo: es la red
  // de seguridad inmediata de archivar y borrar, que son las dos operaciones donde un clic
  // accidental duele.
  const [undoAction, setUndoAction] = useState<{ label: string; run: () => Promise<void> } | null>(null);

  // ---------- Ficha del solicitante ----------
  const [requesterSaving, setRequesterSaving] = useState(false);
  const [requesterError, setRequesterError] = useState("");

  // ---------- Importación ----------
  // Cuando el archivo corresponde a un proyecto que ya existe aquí, no se decide sola: se pregunta.
  const [importPrompt, setImportPrompt] = useState<{
    text: string;
    name: string;
    folio: string;
    componentCount: number;
    warnings: string[];
  } | null>(null);
  const [fileMessage, setFileMessage] = useState("");

  // ---------- Mejora continua ----------
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [learningTemplates, setLearningTemplates] = useState<QuoteTemplate[]>([]);
  // Se marca cuando la respuesta llegó (bien o mal), para poder distinguir "cargando" de "sin datos"
  // sin guardar un estado de carga que habría que poner en marcha desde el cuerpo de un efecto.
  const [learningLoaded, setLearningLoaded] = useState(false);
  // Se incrementa para pedir una relectura (tras borrar el historial). Es la forma de disparar de
  // nuevo el efecto sin llamarlo a mano desde el manejador.
  const [learningToken, setLearningToken] = useState(0);

  // ---------- Historial y cierre de obra ----------
  const [versions, setVersions] = useState<ProjectVersionRow[]>([]);
  const [outcome, setOutcome] = useState<ProjectOutcome | null>(null);
  const [historyError, setHistoryError] = useState("");

  // ---------- Conflicto con otra sesión ----------
  // Lo que hay en el servidor cuando otra sesión guardó después de nosotros. No se aplica ni se
  // descarta solo: se muestra y se decide (ver el aviso más abajo).
  const [conflict, setConflict] = useState<ComponentRecord | null>(null);
  // Última fecha de modificación CONFIRMADA por el servidor, en un ref y no en estado: el guardado la
  // lee desde un temporizador, y con un valor capturado del render podría enviar una versión vieja
  // mientras otro guardado está en vuelo -- y provocar un conflicto que no existe.
  const lastSavedAtRef = useRef<string | null>(null);

  // ---------- Borradores y pestañas ----------
  const [draftOffer, setDraftOffer] = useState<ComponentDraft | null>(null);
  // Identidad de ESTA pestaña, estable mientras viva. Se crea en el inicializador de useState y no
  // escribiendo un ref durante el render: lo segundo no es seguro con render concurrente, porque el
  // render puede descartarse y repetirse.
  const [tabId] = useState(newTabId);
  // Cuándo se abrió el componente actual, para poder medir cuánto se tardó en configurarlo.
  const componentOpenedAtRef = useRef<number>(0);
  const dimensionEditsRef = useRef(0);

  // ---------- "Proyecto completo" report scope: Cotización/Optimización de corte/Pedido de
  // vidrio can either describe the active component alone (default) or aggregate every
  // component in the project (buildProjectCutList nests cut pieces across components that
  // share brand+system+color). The full records (tree/marco included) are fetched on demand --
  // the outliner's ComponentSummary list deliberately omits that payload. ----------
  const [reportScope, setReportScope] = useState<"vano" | "proyecto">("vano");
  const [projectComponentsResult, setProjectComponentsResult] = useState<{
    key: string;
    records: ComponentRecord[] | null;
  }>({ key: "", records: null });
  const scopeApplies = PROJECT_SCOPED_REPORTS.includes(report);
  const projectComponentsKey =
    projectId && reportScope === "proyecto" && scopeApplies && components.length > 1
      ? `${projectId}:${components.map((component) => component.id).join(",")}`
      : "";

  useEffect(() => {
    if (!projectId || !projectComponentsKey) return;
    let cancelled = false;
    Promise.all(components.map((c) => fetchComponent(projectId, c.id)))
      .then((records) => {
        if (!cancelled) setProjectComponentsResult({ key: projectComponentsKey, records });
      })
      .catch(() => {
        if (!cancelled) setProjectComponentsResult({ key: projectComponentsKey, records: null });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, projectComponentsKey, components]);

  const projectComponents =
    projectComponentsResult.key === projectComponentsKey ? projectComponentsResult.records : null;
  const projectComponentsLoading =
    projectComponentsKey !== "" && projectComponentsResult.key !== projectComponentsKey;

  // Aplica un proyecto recién cargado al estado del proyecto abierto.
  const applyProjectMeta = (project: ProjectRecord) => {
    setProjectId(project.id);
    setProjectName(project.name);
    setComponents(project.components);
    setProjectMeta(projectMetaOf(project));
    rememberLastProject(project.id);
  };

  const refreshProjectList = async () => {
    try {
      setProjects(await listProjects());
    } catch {
      // La lista de proyectos es de navegación, no de trabajo: si falla, el proyecto abierto
      // sigue funcionando y autoguardando igual.
    }
  };

  const refreshHistory = async (pid: string) => {
    try {
      const [nextVersions, nextOutcome] = await Promise.all([listProjectVersionsApi(pid), fetchProjectOutcome(pid)]);
      setVersions(nextVersions);
      setOutcome(nextOutcome);
    } catch {
      // El historial es información, no trabajo en curso: si no carga, el resto del proyecto sigue.
      setVersions([]);
      setOutcome(null);
    }
  };

  const refreshTrash = async () => {
    try {
      setTrashedProjects(await listTrashedProjects());
    } catch {
      // Igual que la lista: si falla, la papelera se muestra vacía y se puede reintentar.
    }
  };

  const refreshComponentList = async (pid: string) => {
    try {
      const project = await refetchProject(pid);
      setComponents(project.components);
      setProjectName(project.name);
      setProjectMeta(projectMetaOf(project));
    } catch {
      // offline / DB unreachable -- the outliner just won't reflect other components until
      // connectivity is back; the active component itself still autosaves via saveComponent's
      // own offline fallback.
    }
  };

  const loadComponentIntoState = (rec: {
    id: string;
    /** Fecha de modificación del servidor, cuando el componente viene de él: es la versión contra la
     *  que se comprobará el siguiente guardado. Ausente al recuperar un borrador local. */
    updatedAt?: string;
    code: string; designation: string; location: string; qty: number;
    widthMm: number; heightMm: number; brand: "Aluplast" | "Deceuninck"; systemIndex: number; colorIndex: number;
    data: { rail: number; glassIndex: number; face: string; margin: number; installation: number; transport: number; discount: number; client: string; clientAddress: string; deliveryDate: string; selectedId: string; tree: typeof tree; marco: Marco; termsHeader?: string; paymentTerms?: string; barLengthMm?: number; clientPhone?: string; clientEmail?: string; luftAi?: LuftAgentState };
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
    setClientPhone(rec.data.clientPhone ?? "");
    setClientEmail(rec.data.clientEmail ?? "");
    setDeliveryDate(rec.data.deliveryDate);
    setTermsHeader(rec.data.termsHeader ?? "");
    setPaymentTerms(rec.data.paymentTerms ?? "");
    setBarLengthMm(rec.data.barLengthMm ?? BAR_LENGTH_MM);
    setLuftAi(normalizeAgentState(rec.data.luftAi));
    const normalizedTree = normalizeTree(rec.data.tree);
    setTree(normalizedTree);
    setMarco(rec.data.marco);
    setSelectedId(rec.data.selectedId || firstLeafId(normalizedTree));
    setActiveTool({ mode: "select" });
    setFocusPart(null);
    setFocusSide(null);
    setFocusScope("leaf");
    // Reloj y contador de correcciones del componente que se acaba de abrir: alimentan "tiempo
    // utilizado para cotizar" y "correcciones frecuentes" de las estadísticas de mejora.
    componentOpenedAtRef.current = Date.now();
    dimensionEditsRef.current = 0;
    lastSavedAtRef.current = rec.updatedAt ?? null;
    setConflict(null);
    // Al cambiar de componente el estado del guardado vuelve a cero: lo que se muestre a partir de
    // aquí es de ESTE componente, no un resto del anterior.
    setSaveState("idle");
    setSaveError("");
    setDraftOffer(null);
  };

  /** Deja el editor sin componente abierto: un proyecto puede llegar vacío (recién importado, o del
   *  cotizador público) y eso no es un error, es un estado con su propia pantalla. */
  const clearActiveComponent = () => {
    setComponentId(null);
    setSaveState("idle");
    setSaveError("");
    setDraftOffer(null);
    setSavedAt(null);
    setConflict(null);
    lastSavedAtRef.current = null;
    // El aviso de "abierto en otra pestaña" no hace falta limpiarlo: se deriva de si hay un componente
    // abierto, y sin componente no hay nada que anunciar (ver lockKey).
  };

  // ---------- Load (or create) a project + its active component from the database, once, on
  // mount. Deliberately not run during SSR/first paint -- runs client-only, after hydration,
  // same reasoning the old localStorage restore had: reading persisted state inside a useState
  // initializer would give the server and the client two different values and trigger a
  // hydration mismatch. Falls back to the last offline-saved component if the DB/API isn't
  // reachable (see lib/persistence.ts's bootstrap()). ----------
  useEffect(() => {
    (async () => {
      const { project, component, projects: folders, mode } = await bootstrap();
      setPersistMode(mode);
      setProjects(folders);

      // Si la última vez estabas en otro proyecto, se abre ese. Solo se pide si de verdad es otro y
      // sigue existiendo en la lista: en el caso normal (el último modificado ES el último abierto)
      // no cuesta ninguna petición extra.
      const remembered = readLastProject();
      if (mode === "db" && remembered && remembered !== project?.id && folders.some((entry) => entry.id === remembered)) {
        try {
          const reopened = await openProject(remembered);
          applyProjectMeta(reopened.project);
          await refreshHistory(reopened.project.id);
          if (reopened.component) {
            loadComponentIntoState(reopened.component);
            setSavedAt(reopened.component.updatedAt);
            setDraftOffer(pendingDraftFor(reopened.component));
          } else {
            clearActiveComponent();
          }
          setHydrated(true);
          return;
        } catch {
          // El proyecto recordado no se pudo abrir: se sigue con el más reciente, que ya está aquí.
        }
      }

      if (project) applyProjectMeta(project);
      if (component) {
        loadComponentIntoState(component);
        setSavedAt(component.updatedAt);
        setDraftOffer(pendingDraftFor(component));
      } else {
        clearActiveComponent();
      }
      if (project) await refreshHistory(project.id);
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Mejora continua: el interruptor se lee como estado externo (localStorage) y el historial
  // se pide cuando está encendido. Vive en un efecto y no en el arranque porque no es parte del camino
  // crítico: la app tiene que poder cotizar aunque las estadísticas no carguen. ----------
  const learningEnabled = useSyncExternalStore(
    learningStore.subscribe,
    learningStore.getSnapshot,
    learningStore.getServerSnapshot
  );

  useEffect(() => {
    if (!learningEnabled) return;
    let cancelled = false;
    void fetchLearning().then((payload) => {
      if (cancelled) return;
      setLearningStats(payload?.stats ?? null);
      setLearningTemplates(payload?.templates ?? []);
      setLearningLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [learningEnabled, learningToken]);

  // Con el registro apagado no se muestran estadísticas aunque queden en memoria de una lectura
  // anterior: se derivan del interruptor en vez de borrarlas al apagarlo.
  const visibleStats = learningEnabled ? learningStats : null;
  const visibleTemplates = learningEnabled ? learningTemplates : [];
  const learningLoading = learningEnabled && !learningLoaded;

  // ---------- Aviso de "abierto en otra pestaña".
  //
  // Se lee, no se guarda: quién tiene abierto qué es estado de un sistema externo (localStorage,
  // compartido entre pestañas), así que se consulta con useSyncExternalStore. Antes esto vivía en un
  // useState que un efecto corregía en cada latido -- un render extra cada cuatro segundos, y el aviso
  // tardaba hasta un latido en aparecer. Ahora el evento `storage` lo hace inmediato.
  //
  // El efecto de abajo se queda solo con lo que sí es un efecto: anunciar y renovar el anuncio de esta
  // pestaña, y retirarlo al salir. ----------
  const lockKey = hydrated && projectId && componentId && persistMode !== "offline" ? componentKey(projectId, componentId) : "";
  const lockedByOtherTab = useSyncExternalStore(
    subscribeToClaims,
    () => (lockKey ? isClaimedByAnotherTab(tabId, lockKey) : false),
    // En servidor no hay pestañas que se pisen.
    () => false
  );

  useEffect(() => {
    if (!lockKey) return;
    // Si otra pestaña lo tiene, esta no lo reclama: reclamarlo sería quitárselo sin que nadie lo pida.
    if (!isClaimedByAnotherTab(tabId, lockKey)) claimComponent(tabId, lockKey);
    const timer = window.setInterval(() => {
      if (!isClaimedByAnotherTab(tabId, lockKey)) claimComponent(tabId, lockKey);
    }, HEARTBEAT_MS);
    return () => {
      window.clearInterval(timer);
      releaseComponent(tabId, lockKey);
      announceClaimChange();
    };
  }, [lockKey, tabId]);

  const handleTakeOver = () => {
    if (!lockKey) return;
    takeOverComponent(tabId, lockKey);
    announceClaimChange();
  };

  // El resumen comercial del componente (tipología resuelta, estado de configuración, precio y
  // subtotal) sale de `calc` y de las alertas, que se calculan más abajo en este mismo archivo. Se
  // pasa por un ref en vez de leerlos directamente aquí porque este efecto está declarado antes que
  // ellos: leer un `const` antes de su declaración sería un error en tiempo de ejecución. El ref
  // siempre está al día cuando el guardado dispara, porque el guardado espera 400 ms y los efectos
  // ya corrieron.
  const derivedSaveRef = useRef<{ typology: string; configState: ComponentConfigState; unitPrice: number; total: number }>({
    typology: "",
    configState: "pendiente",
    unitPrice: 0,
    total: 0,
  });

  const buildComponentPatch = (): ComponentPatch => ({
    code, designation, location, qty, widthMm: width, heightMm: height,
    brand, systemIndex, colorIndex, glassIndex,
    typology: derivedSaveRef.current.typology,
    configState: derivedSaveRef.current.configState,
    unitPrice: derivedSaveRef.current.unitPrice,
    total: derivedSaveRef.current.total,
    data: { rail, glassIndex, face, margin, installation, transport, discount, client, clientAddress, clientPhone, clientEmail, deliveryDate, termsHeader, paymentTerms, barLengthMm, tree, marco, selectedId, luftAi },
  });

  // ---------- Autosave: debounced so dragging a divider or typing in a text field doesn't hit
  // the API on every keystroke. Gated on `hydrated` so the bootstrap effect above always gets
  // first say over what the loaded component actually contains.
  //
  // El indicador refleja lo que realmente pasó: "cambios pendientes" mientras corre la espera,
  // "guardando" durante el envío y "guardado" SOLO si el servidor confirmó. Antes un fallo dejaba la
  // insignia con la hora del último éxito, es decir mintiendo.
  //
  // Y no se guarda nada si otra pestaña tiene abierto el mismo componente: el autoguardado envía el
  // estado completo, así que dos pestañas se pisarían en cada pulsación. ----------
  useEffect(() => {
    if (!hydrated || !componentId) return;
    if (lockedByOtherTab) return;
    const pid = projectId ?? "offline";
    const cid = componentId;
    // "Cambios pendientes" se marca en una microtarea y no en el cuerpo del efecto: llamar a setState
    // de forma sincrónica ahí encadena renders (y el compilador de React lo rechaza). Se ve igual de
    // inmediato, y cuando el estado ya es "pending" React no vuelve a renderizar.
    queueMicrotask(() => setSaveState("pending"));
    const id = setTimeout(() => {
      const patch = buildComponentPatch();
      // El borrador se escribe ANTES de intentar guardar: si el navegador se cierra justo aquí, al
      // volver está el trabajo (ver pendingDraftFor en lib/persistence.ts).
      writeDraft(pid, cid, patch);
      setSaveState("saving");
      saveComponent(pid, cid, patch, { expectedUpdatedAt: lastSavedAtRef.current }).then((result) => {
        setPersistMode(result.mode);
        if (result.ok) {
          if (result.savedAt) {
            setSavedAt(result.savedAt);
            lastSavedAtRef.current = result.savedAt;
          }
          setSaveState("saved");
          setSaveError("");
          setConflict(null);
          clearDraft(pid, cid);
        } else if (result.conflict) {
          // Otra sesión guardó después: NO se sobrescribió nada. El borrador local sigue escrito, así
          // que lo de esta pantalla no se pierde mientras se decide.
          setSaveState("error");
          setSaveError("Alguien más guardó este componente desde otra sesión.");
          setConflict(result.conflict);
        } else {
          setSaveState("error");
          setSaveError(result.error ?? "No se pudo guardar.");
        }
      });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated, projectId, componentId, lockedByOtherTab, brand, systemIndex, rail, width, height, qty, glassIndex, colorIndex, face,
    margin, installation, transport, discount, code, designation, location,
    client, clientAddress, clientPhone, clientEmail, deliveryDate, termsHeader, paymentTerms, barLengthMm, tree, marco, selectedId, luftAi,
  ]);

  // ---------- Proyecto tab handlers: switch/add/duplicate/delete a component, rename the
  // project. Switching flushes the outgoing component's pending edits immediately (instead of
  // waiting on the 400ms autosave debounce) so nothing typed right before switching is lost. ----------
  const flushActiveComponent = async () => {
    if (!componentId || lockedByOtherTab) return;
    const pid = projectId ?? "offline";
    const result = await saveComponent(pid, componentId, buildComponentPatch(), {
      expectedUpdatedAt: lastSavedAtRef.current,
    });
    if (result.conflict) {
      setConflict(result.conflict);
      setSaveError(`No se pudo guardar "${designation}": otra sesión lo cambió.`);
      setSaveState("error");
      return;
    }
    if (result.ok) {
      if (result.savedAt) lastSavedAtRef.current = result.savedAt;
      clearDraft(pid, componentId);
      // Se registra el componente guardado en las estadísticas de mejora al SALIR de él, no en cada
      // autoguardado: así el histórico tiene una entrada por componente configurado y no una por
      // pulsación, y el tiempo medido es el que de verdad se tardó en configurarlo.
      recordComponentSaved();
    }
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
    // Si este componente tenía trabajo sin guardar de una sesión anterior, se ofrece recuperarlo al
    // abrirlo -- no solo al arrancar la app.
    setDraftOffer(pendingDraftFor(rec));
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
    await refreshProjectList();
  };

  const handleDuplicateComponent = async (id: string) => {
    if (!projectId) return;
    await flushActiveComponent();
    const source = components.find((component) => component.id === id);
    const rec = await createComponent(projectId, { duplicateFromId: id });
    setComponents((prev) => [...prev, toSummary(rec)]);
    loadComponentIntoState(rec);
    setSavedAt(rec.updatedAt);
    await refreshComponentList(projectId);
    await refreshProjectList();
    // Duplicar es la señal más clara de una configuración que se repite, y §9 la pide expresamente.
    // El sistema que se registra es el DEL COMPONENTE DUPLICADO, resuelto de su propia marca e índice:
    // duplicar desde la lista un componente que no es el abierto registraba antes el sistema del
    // abierto, que es otro dato.
    recordEvent("componente_duplicado", {
      typology: source?.typology ?? "",
      brand: source?.brand ?? brand,
      systemName: source ? systemNameOf(source.brand, source.systemIndex) : "",
    });
  };

  const handleDeleteComponent = async (component: ComponentSummary) => {
    if (!projectId || components.length <= 1) return;
    // La confirmación nombra el componente exacto: "¿eliminar este?" no dice cuál, y con la lista
    // desplazada o un menú abierto sobre otra fila es justo la duda que produce un borrado por error.
    const label = `${component.code} · ${component.designation}`;
    if (
      !window.confirm(
        `¿Eliminar el componente ${label} (${component.widthMm}×${component.heightMm} mm, ${component.qty} pieza(s)) de este proyecto?\n\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    await deleteComponentApi(projectId, component.id);
    setComponents((prev) => prev.filter((c) => c.id !== component.id));
    if (component.id === componentId) {
      const next = components.find((c) => c.id !== component.id);
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
    await refreshProjectList();
  };

  /** Renombra un componente sin abrirlo. Si es el abierto, también mueve el estado en pantalla para
   *  que el encabezado y el dibujo no queden con el nombre viejo. */
  const handleRenameComponent = async (id: string, nextDesignation: string) => {
    if (!projectId) return;
    if (id === componentId) {
      setDesignation(nextDesignation);
      return;
    }
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, designation: nextDesignation } : c)));
    try {
      await saveComponent(projectId, id, { designation: nextDesignation });
    } catch {
      await refreshComponentList(projectId);
    }
  };

  /** Cambia la ubicación de un componente sin abrirlo. Es lo que permite armar los bloques de la
   *  lista (Torre B · Piso 3) sobre la marcha; si es el abierto, pasa por su propio estado, que ya
   *  autoguarda junto con el resto de las propiedades. */
  const handleSetComponentLocation = async (id: string, nextLocation: string) => {
    if (!projectId) return;
    // La lista se actualiza SIEMPRE, incluido el componente abierto: es la que alimenta el agrupado
    // por ubicación, y si se omitiera, cambiar la ubicación del componente en edición no lo movería
    // de bloque hasta recargar. Para el abierto no se llama a saveComponent porque su autoguardado
    // ya persiste `location` junto con el resto de sus propiedades.
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, location: nextLocation } : c)));
    if (id === componentId) {
      setLocation(nextLocation);
      return;
    }
    try {
      await saveComponent(projectId, id, { location: nextLocation });
    } catch {
      await refreshComponentList(projectId);
    }
  };

  const handleChangeComponentQty = async (id: string, nextQty: number) => {
    if (!projectId) return;
    if (id === componentId) {
      // El abierto pasa por el estado normal, que ya recalcula el costo y autoguarda.
      setQty(nextQty);
      return;
    }
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, qty: nextQty } : c)));
    try {
      await saveComponent(projectId, id, { qty: nextQty });
      await refreshProjectList();
    } catch {
      await refreshComponentList(projectId);
    }
  };

  /** Acciones sobre varios componentes seleccionados. */
  const handleBulkComponents = async (action: BulkAction, ids: string[], targetProjectId?: string) => {
    if (!projectId || ids.length === 0) return;
    setProjectsError("");
    setFileMessage("");

    try {
      if (action === "export") {
        await downloadProjectFile(projectId, ids);
        setFileMessage(`Se exportaron ${ids.length} componente(s) a un archivo.`);
        return;
      }

      if (action === "duplicate") {
        await flushActiveComponent();
        for (const id of ids) await createComponent(projectId, { duplicateFromId: id });
        await refreshComponentList(projectId);
        await refreshProjectList();
        setFileMessage(`Se duplicaron ${ids.length} componente(s).`);
        return;
      }

      if (action === "delete") {
        // Nunca se puede dejar un proyecto sin componentes por una acción masiva: eso convertiría un
        // proyecto de trabajo en una carpeta vacía sin querer.
        if (ids.length >= components.length) {
          setProjectsError("No se pueden eliminar todos los componentes: un proyecto conserva al menos uno.");
          return;
        }
        if (
          !window.confirm(
            `¿Eliminar ${ids.length} componente(s) de "${projectName}"?\n\nEsta acción no se puede deshacer.`
          )
        ) {
          return;
        }
        for (const id of ids) await deleteComponentApi(projectId, id);
        const remaining = components.filter((component) => !ids.includes(component.id));
        setComponents(remaining);
        if (componentId && ids.includes(componentId) && remaining[0]) {
          const rec = await fetchComponent(projectId, remaining[0].id);
          loadComponentIntoState(rec);
          setSavedAt(rec.updatedAt);
          await setActiveComponentApi(projectId, remaining[0].id).catch(() => {});
        }
        await refreshComponentList(projectId);
        await refreshProjectList();
        return;
      }

      if ((action === "move" || action === "copy") && targetProjectId) {
        await flushActiveComponent();
        const result = await transferComponentsApi(projectId, ids, targetProjectId, action);
        applyProjectMeta(result.project);
        // Mover puede haberse llevado el componente abierto; en ese caso se abre el que quede.
        if (action === "move" && componentId && ids.includes(componentId)) {
          const next = result.project.components[0];
          if (next) {
            const rec = await fetchComponent(result.project.id, next.id);
            loadComponentIntoState(rec);
            setSavedAt(rec.updatedAt);
          } else {
            clearActiveComponent();
          }
        }
        await refreshProjectList();
        setFileMessage(
          `${result.moved} componente(s) ${action === "move" ? "movido(s)" : "copiado(s)"} a "${result.targetProject.name}".`
        );
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo completar la acción.");
    }
  };

  // Renombrar el proyecto abierto se escribe con retraso: es un campo de texto, y guardar en cada
  // pulsación costaba una lectura y una escritura por letra. La lista se actualiza al instante y sin
  // volver a pedirla, así que la pantalla no espera a la red.
  const renameTimerRef = useRef<number | null>(null);
  const handleRenameProject = (name: string) => {
    setProjectName(name);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, name } : p)));
    if (!projectId) return;
    const pid = projectId;
    if (renameTimerRef.current !== null) window.clearTimeout(renameTimerRef.current);
    renameTimerRef.current = window.setTimeout(() => {
      renameTimerRef.current = null;
      void renameProjectApi(pid, name)
        .then((updated) => setProjectMeta((current) => (current && current.id === pid ? { ...current, updatedAt: updated.updatedAt, name: updated.name } : current)))
        .catch(() => {
          // Sin conexión el nombre vive solo en el estado local hasta que vuelva la red.
        });
    }, 500);
  };

  // ---------- Cambiar de proyecto. Sigue la misma disciplina que handleSwitchComponent: primero
  // se vacía lo pendiente del componente que se abandona (el autoguardado tiene 400 ms de
  // retraso), y si la carga falla no se aplica un cambio a medias. ----------

  /** Abre un proyecto ya cargado del servidor. Compartido por abrir, crear, duplicar e importar, para
   *  que las cuatro dejen la pantalla exactamente en el mismo estado coherente. */
  const adoptProject = async (project: ProjectRecord) => {
    applyProjectMeta(project);
    const activeId = project.activeComponentId ?? project.components[0]?.id;
    if (activeId) {
      const rec = await fetchComponent(project.id, activeId);
      loadComponentIntoState(rec);
      setSavedAt(rec.updatedAt);
      setDraftOffer(pendingDraftFor(rec));
    } else {
      clearActiveComponent();
    }
    setReportScope("vano");
    setProjectComponentsResult({ key: "", records: null });
    setRequesterError("");
    setHistoryError("");
    await refreshHistory(project.id);
  };

  const handleOpenProject = async (id: string) => {
    if (id === projectId || switchingProject) return;
    setSwitchingProject(true);
    setProjectsError("");
    try {
      await flushActiveComponent();
      const { project } = await openProject(id);
      await adoptProject(project);
      await refreshProjectList();
    } catch {
      setProjectsError("No pudimos abrir ese proyecto. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSwitchingProject(false);
    }
  };

  /** Alta de proyecto. Si falla, el diálogo NO se cierra y conserva lo capturado: `createdToken` solo
   *  avanza cuando el proyecto existe de verdad. */
  const handleCreateProject = async (draft: Parameters<typeof createProjectApi>[0]) => {
    if (switchingProject) return;
    setSwitchingProject(true);
    setCreateError("");
    try {
      await flushActiveComponent();
      const project = await createProjectApi(draft);
      await adoptProject(project);
      await refreshProjectList();
      setCreatedToken((token) => token + 1);
      setShowNewProject(false);
      // Se abre en el editor y con el proyecto listo para agregar componentes, sin recargar nada.
      setTab("Diseño");
      recordEvent("proyecto_creado", { currency: project.currency, origin: project.origin });
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? `No se pudo crear el proyecto: ${error.message}`
          : "No se pudo crear el proyecto. Revisa tu conexión e inténtalo de nuevo."
      );
    } finally {
      setSwitchingProject(false);
    }
  };

  const handleDuplicateProject = async (project: ProjectSummary) => {
    setSwitchingProject(true);
    setProjectsError("");
    try {
      await flushActiveComponent();
      const copy = await duplicateProjectApi(project.id);
      await adoptProject(copy);
      await refreshProjectList();
      setFileMessage(`Se duplicó "${project.name}" como "${copy.name}" con folio ${copy.folio || "sin folio"}.`);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo duplicar el proyecto.");
    } finally {
      setSwitchingProject(false);
    }
  };

  const handleRenameProjectFromList = async (project: ProjectSummary) => {
    const next = window.prompt("Nombre del proyecto", project.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === project.name) return;
    try {
      const updated = await updateProjectApi(project.id, { name: trimmed });
      setProjects((prev) => prev.map((entry) => (entry.id === project.id ? { ...entry, name: trimmed } : entry)));
      if (project.id === projectId) {
        setProjectName(updated.name);
        applyProjectMeta(updated);
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo cambiar el nombre.");
    }
  };

  const handleArchiveProject = async (project: ProjectSummary, archived: boolean) => {
    setProjectsError("");
    try {
      await setProjectArchivedApi(project.id, archived);
      await refreshProjectList();
      // Deshacer inmediato: archivar es reversible y ofrecerlo aquí evita tener que ir a buscar el
      // proyecto entre los archivados para devolverlo.
      setUndoAction({
        label: archived ? `Se archivó "${project.name}".` : `Se desarchivó "${project.name}".`,
        run: async () => {
          await setProjectArchivedApi(project.id, !archived);
          await refreshProjectList();
        },
      });
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo archivar el proyecto.");
    }
  };

  const handleDeleteProject = async (project: ProjectSummary) => {
    // La confirmación dice el nombre EXACTO y cuántos componentes se llevan consigo. Es la diferencia
    // entre confirmar a ciegas y saber qué se está borrando.
    const detail = `${project.componentCount} componente(s) y ${project.pieceCount} pieza(s)`;
    if (
      !window.confirm(
        `¿Eliminar el proyecto "${project.name}"${project.folio ? ` (${project.folio})` : ""}?\n\nSe va a la papelera con ${detail}. Podrás restaurarlo desde ahí.`
      )
    ) {
      return;
    }
    setProjectsError("");
    try {
      await deleteProjectApi(project.id);
      await refreshProjectList();
      await refreshTrash();
      setUndoAction({
        label: `Se envió "${project.name}" a la papelera.`,
        run: async () => {
          const restored = await restoreProjectApi(project.id);
          await refreshProjectList();
          await refreshTrash();
          if (restored.id === projectId) await adoptProject(restored);
        },
      });
      // Si se borró el proyecto abierto, se abre otro: quedarse editando un proyecto que ya está en
      // la papelera acabaría guardando cambios en algo borrado.
      if (project.id === projectId) {
        const next = projects.find((entry) => entry.id !== project.id && !entry.deletedAt);
        if (next) {
          const { project: reopened } = await openProject(next.id);
          await adoptProject(reopened);
        }
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo eliminar el proyecto.");
    }
  };

  const handleRestoreProject = async (project: ProjectSummary) => {
    try {
      await restoreProjectApi(project.id);
      await refreshProjectList();
      await refreshTrash();
      setFileMessage(`Se restauró "${project.name}".`);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo restaurar el proyecto.");
    }
  };

  const handlePurgeProject = async (project: ProjectSummary) => {
    if (
      !window.confirm(
        `¿Eliminar DEFINITIVAMENTE "${project.name}" y sus ${project.componentCount} componente(s)?\n\nEsto no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await deleteProjectApi(project.id, { purge: true });
      await refreshTrash();
      await refreshProjectList();
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo eliminar el proyecto.");
    }
  };

  const handleExportProject = async (project: ProjectSummary) => {
    setProjectsError("");
    setFileMessage("");
    try {
      // Si es el proyecto abierto se vacía lo pendiente antes de exportar: el archivo debe llevar lo
      // que está en pantalla, no la versión de hace 400 ms.
      if (project.id === projectId) await flushActiveComponent();
      await downloadProjectFile(project.id);
      setFileMessage(`Se descargó el archivo de "${project.name}".`);
      recordEvent("proyecto_exportado", { componentCount: project.componentCount });
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo exportar el proyecto.");
    }
  };

  // ---------- Importar y respaldar ----------

  /** Lee el archivo y pregunta al servidor si es válido. Si choca con un proyecto que ya existe aquí,
   *  se pregunta antes de decidir; si no, se importa como proyecto nuevo. */
  const handleImportFile = async (file: File) => {
    setProjectsError("");
    setFileMessage("");
    setImportPrompt(null);
    try {
      const text = await file.text();
      const probe = await probeProjectFile(text);
      if (probe.conflictedWith) {
        setImportPrompt({
          text,
          name: probe.name,
          folio: probe.folio,
          componentCount: probe.componentCount,
          warnings: probe.warnings,
        });
        return;
      }
      await applyImport(text, "copy", probe.warnings);
    } catch (error) {
      setProjectsError(
        error instanceof Error ? `No se pudo importar: ${error.message}` : "No se pudo importar ese archivo."
      );
    }
  };

  const applyImport = async (text: string, mode: "copy" | "replace", warnings: string[] = []) => {
    setSwitchingProject(true);
    try {
      await flushActiveComponent();
      const outcome = await importProjectFileApi(text, mode);
      await adoptProject(outcome.project);
      await refreshProjectList();
      setImportPrompt(null);
      const notes = [...warnings, ...outcome.warnings];
      setFileMessage(
        [
          outcome.applied === "replaced"
            ? `Se reemplazó "${outcome.project.name}" con el contenido del archivo.`
            : `Se importó "${outcome.project.name}" con ${outcome.project.components.length} componente(s).`,
          outcome.migratedFrom !== null ? `El archivo venía en formato ${outcome.migratedFrom} y se migró.` : "",
          ...notes,
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (error) {
      setProjectsError(error instanceof Error ? `No se pudo importar: ${error.message}` : "No se pudo importar el archivo.");
    } finally {
      setSwitchingProject(false);
    }
  };

  const handleBackup = async () => {
    setProjectsError("");
    setFileMessage("");
    try {
      await flushActiveComponent();
      await downloadBackupFile();
      setFileMessage("Copia de seguridad descargada.");
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo crear la copia de seguridad.");
    }
  };

  const handleRestoreBackup = async (file: File) => {
    setProjectsError("");
    setFileMessage("");
    if (
      !window.confirm(
        "Restaurar AGREGA los proyectos de la copia a los que ya tienes aquí; no reemplaza ni borra nada.\n\n¿Continuar?"
      )
    ) {
      return;
    }
    setSwitchingProject(true);
    try {
      const text = await file.text();
      const result = await restoreBackupApi(text);
      setProjects(result.projects);
      setFileMessage(
        [
          `Se restauraron ${result.restored} proyecto(s).`,
          result.failed.length > 0 ? `No se pudieron restaurar ${result.failed.length}: ${result.failed.join("; ")}` : "",
          ...result.warnings,
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (error) {
      setProjectsError(
        error instanceof Error ? `No se pudo restaurar: ${error.message}` : "No se pudo restaurar esa copia."
      );
    } finally {
      setSwitchingProject(false);
    }
  };

  // ---------- Ficha del solicitante ----------
  const handleSaveRequester = async (patch: {
    requester: Requester;
    status: ProjectStatus;
    currency: string;
    pricingListId: string;
    estimatedDate: string;
    notes: string;
  }) => {
    if (!projectId) return;
    setRequesterSaving(true);
    setRequesterError("");
    try {
      const updated = await updateProjectApi(projectId, patch);
      applyProjectMeta(updated);
      await refreshProjectList();
    } catch (error) {
      setRequesterError(
        error instanceof Error ? `No se pudo guardar la ficha: ${error.message}` : "No se pudo guardar la ficha."
      );
    } finally {
      setRequesterSaving(false);
    }
  };

  // ---------- Conflicto con otra sesión ----------
  // Las dos salidas posibles, y las dos las decide quien edita: traer lo del servidor (se pierde lo de
  // esta pantalla, que queda en el borrador local) o imponer lo de aquí (`force`, después de haberlo
  // visto). No hay una tercera automática: fusionar dos configuraciones de ventana sin criterio sería
  // inventarse un diseño que nadie hizo.
  const acceptServerVersion = () => {
    if (!conflict) return;
    loadComponentIntoState(conflict);
    setSavedAt(conflict.updatedAt);
    setSaveState("saved");
    setSaveError("");
    setConflict(null);
  };

  const overwriteWithMine = async () => {
    if (!conflict || !projectId || !componentId) return;
    setSaveState("saving");
    const result = await saveComponent(projectId, componentId, buildComponentPatch(), { force: true });
    if (result.ok && result.savedAt) {
      setSavedAt(result.savedAt);
      lastSavedAtRef.current = result.savedAt;
      setSaveState("saved");
      setSaveError("");
      setConflict(null);
      clearDraft(projectId, componentId);
    } else {
      setSaveState("error");
      setSaveError(result.error ?? "No se pudo guardar.");
    }
  };

  // ---------- Historial y cierre de obra ----------
  const handleCreateVersion = async (label: string) => {
    if (!projectId) return;
    setHistoryError("");
    try {
      // Se vacía lo pendiente antes: el punto tiene que guardar lo que está en pantalla, no la versión
      // de hace 400 ms.
      await flushActiveComponent();
      setVersions(await createProjectVersionApi(projectId, label));
      setFileMessage("Punto de restauración creado.");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "No se pudo crear el punto de restauración.");
    }
  };

  const handleRestoreVersion = async (version: ProjectVersionRow) => {
    if (!projectId) return;
    const when = new Date(version.createdAt).toLocaleString("es-MX");
    if (
      !window.confirm(
        `Restaurar el punto "${version.label || when}" reemplaza los datos y TODOS los componentes de este proyecto por los de ese momento.\n\nAntes se guardará un punto con lo que hay ahora, así que se puede volver. ¿Continuar?`
      )
    ) {
      return;
    }
    setSwitchingProject(true);
    setHistoryError("");
    try {
      const result = await restoreProjectVersionApi(projectId, version.id);
      await adoptProject(result.project);
      setVersions(result.versions);
      await refreshProjectList();
      setFileMessage(
        [`Proyecto restaurado al punto del ${when}.`, ...result.warnings].filter(Boolean).join(" ")
      );
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "No se pudo restaurar ese punto.");
    } finally {
      setSwitchingProject(false);
    }
  };

  const handleSaveOutcome = async (draft: OutcomeDraft) => {
    if (!projectId) return;
    setHistoryError("");
    try {
      setOutcome(await saveProjectOutcomeApi(projectId, draft));
      // El cierre alimenta las estadísticas de desviación, así que se vuelven a leer.
      setLearningLoaded(false);
      setLearningToken((token) => token + 1);
      setFileMessage("Cierre de obra registrado.");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "No se pudo guardar el cierre.");
    }
  };

  const handleClearOutcome = async () => {
    if (!projectId) return;
    if (!window.confirm("¿Borrar el cierre de obra de este proyecto? Las estadísticas ya registradas no se borran con esto.")) return;
    setHistoryError("");
    try {
      await clearProjectOutcomeApi(projectId);
      setOutcome(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "No se pudo borrar el cierre.");
    }
  };

  // ---------- Deshacer ----------
  const runUndo = async () => {
    if (!undoAction) return;
    const action = undoAction;
    setUndoAction(null);
    try {
      await action.run();
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo deshacer.");
    }
  };

  const sys = catalog[brand][Math.min(systemIndex, catalog[brand].length - 1)];
  const glass = glassCatalog[glassIndex];
  const color = colors[brand][Math.min(colorIndex, colors[brand].length - 1)];
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
    () => calcQuote({ width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount, marco, barLengthMm, wastePct, laborPerM2, overheadPct }),
    [width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount, marco, barLengthMm, wastePct, laborPerM2, overheadPct]
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
          wastePct, laborPerM2, overheadPct,
          componentIds: components.map((c) => c.id),
          activeComponentId: componentId,
        })
      );
    run();
    const id = setInterval(run, 25000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, width, height, qty, sys, glass, color, rail, installation, transport, margin, discount, marco, threeReady, wastePct, laborPerM2, overheadPct, components, componentId]);

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
  // La leyenda solo nombra el riel si la composicion tiene alguna corrediza: una practicable no
  // tiene guia, y anunciar una pieza que no existe es peor que no nombrarla.
  const hasSliding = useMemo(() => leaves.some((l) => SLIDING_WINGS.includes(l.wing)), [leaves]);
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

  // ---------- Resumen comercial del componente abierto, para las columnas de la lista y para las
  // estadísticas. Se escribe en un ref porque el efecto de autoguardado está declarado más arriba
  // (ver derivedSaveRef). ----------
  const componentConfigState: ComponentConfigState = warnings.length > 0 ? "alertas" : "ok";
  useEffect(() => {
    derivedSaveRef.current = {
      typology: configSummary,
      configState: componentConfigState,
      unitPrice: Math.round(calc.sale),
      total: Math.round(calc.total),
    };
  }, [configSummary, componentConfigState, calc.sale, calc.total]);

  /** Registra el componente configurado en las estadísticas de mejora. Solo datos del producto y del
   *  precio: ni el proyecto, ni el cliente, ni ningún identificador (ver lib/learning.ts). */
  const recordComponentSaved = () => {
    if (!componentOpenedAtRef.current) return;
    recordEvent("componente_guardado", {
      typology: configSummary,
      brand,
      systemName: sys.name,
      glassName: glass.name,
      colorName: color.name,
      hardware: selectedLeaf?.spec.hardware ?? "",
      widthMm: width,
      heightMm: height,
      qty,
      leafCount: calc.leaves.length,
      railCount: rail,
      marginPct: margin,
      discountPct: discount,
      unitPrice: Math.round(calc.sale),
      total: Math.round(calc.total),
      configState: componentConfigState,
      editSeconds: Math.round((Date.now() - componentOpenedAtRef.current) / 1000),
      dimensionEdits: dimensionEditsRef.current,
    });
  };

  // ---------- Recomendaciones. Se construyen con una función pura sobre las estadísticas y el
  // contexto de lo que se está cotizando (ver buildRecommendations en lib/learning.ts), así que lo que
  // se muestra en pantalla es exactamente lo que esa función decide -- y se puede probar sin
  // navegador. ----------
  const identicalSiblings = useMemo(
    () =>
      components.filter(
        (component) =>
          component.id !== componentId &&
          component.widthMm === width &&
          component.heightMm === height &&
          component.systemIndex === systemIndex &&
          component.brand === brand &&
          component.typology === configSummary
      ).length,
    [components, componentId, width, height, systemIndex, brand, configSummary]
  );

  const recommendationContext: RecommendationContext = useMemo(
    () => ({
      typology: configSummary,
      systemName: sys.name,
      glassName: glass.name,
      widthMm: width,
      heightMm: height,
      qty,
      marginPct: margin,
      discountPct: discount,
      hasClientName: !!(projectMeta?.requester.fullName || client),
      hasClientContact: !!(projectMeta?.requester.phone || projectMeta?.requester.email || clientPhone || clientEmail),
      hasLocation: !!location.trim(),
      identicalSiblings,
    }),
    [
      configSummary, sys.name, glass.name, width, height, qty, margin, discount,
      projectMeta, client, clientPhone, clientEmail, location, identicalSiblings,
    ]
  );

  // Sin historial se evalúan igual las reglas que solo miran el proyecto abierto (campos sin llenar,
  // componentes repetidos): no dependen de estadística alguna, y son útiles desde el primer proyecto.
  const recommendations: Recommendation[] = useMemo(
    () => buildRecommendations(visibleStats ?? emptyLearningStats(), recommendationContext),
    [visibleStats, recommendationContext]
  );

  // Encender o apagar el registro solo escribe la preferencia: el valor que se muestra sale del
  // almacén, y el efecto de arriba se encarga de pedir el historial cuando corresponde.
  const handleToggleLearning = (enabled: boolean) => {
    setLearningEnabled(enabled);
  };

  const handleClearLearning = async () => {
    try {
      await clearLearning();
      setLearningLoaded(false);
      setLearningToken((token) => token + 1);
      setFileMessage("Historial de mejora borrado. Tus proyectos y clientes no se tocaron.");
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "No se pudo borrar el historial.");
    }
  };

  /** Aplica una recomendación, y solo cuando alguien la pide. Nada de esto ocurre solo: es la
   *  contraparte del botón "Aplicar" del panel de recomendaciones. */
  const handleApplyRecommendation = (recommendation: Recommendation) => {
    const suggestion = recommendation.suggestion;
    if (!suggestion) return;
    if (suggestion.field === "glassName") {
      const index = glassCatalog.findIndex((entry) => entry.name === suggestion.value);
      if (index >= 0) setGlassIndex(index);
      return;
    }
    if (suggestion.field === "systemName") {
      const index = catalog[brand].findIndex((entry) => entry.name === suggestion.value);
      if (index >= 0) changeSystem(index);
      return;
    }
    if (suggestion.field === "marginPct" && typeof suggestion.value === "number") {
      setMargin(suggestion.value);
      return;
    }
    if (suggestion.field === "qty" && typeof suggestion.value === "number") {
      setQty(Math.max(1, Math.round(suggestion.value)));
    }
    // "typology" no se aplica desde aquí: cambiar la tipología reemplaza la composición completa, y
    // eso se hace desde el selector de tipologías, donde se ve qué se va a reemplazar.
  };

  const handleUseTemplate = (template: QuoteTemplate) => {
    if (template.widthMm > 0) setWidth(template.widthMm);
    if (template.heightMm > 0) setHeight(template.heightMm);
    const glassIdx = glassCatalog.findIndex((entry) => entry.name === template.glassName);
    if (glassIdx >= 0) setGlassIndex(glassIdx);
    const systemIdx = catalog[brand].findIndex((entry) => entry.name === template.systemName);
    if (systemIdx >= 0) changeSystem(systemIdx);
  };

  // ---------- Recuperación de borradores ----------
  const applyDraft = () => {
    const patch = draftOffer?.patch;
    if (!patch || !componentId || !patch.data?.tree) {
      setDraftOffer(null);
      return;
    }
    loadComponentIntoState({
      id: componentId,
      code: patch.code ?? code,
      designation: patch.designation ?? designation,
      location: patch.location ?? location,
      qty: patch.qty ?? qty,
      widthMm: patch.widthMm ?? width,
      heightMm: patch.heightMm ?? height,
      brand: patch.brand ? (patch.brand as Brand) : brand,
      systemIndex: patch.systemIndex ?? systemIndex,
      colorIndex: patch.colorIndex ?? colorIndex,
      data: {
        rail, glassIndex, face, margin, installation, transport, discount, client, clientAddress,
        deliveryDate, selectedId,
        ...patch.data,
        // El árbol y el marco se fijan DESPUÉS del volcado: el borrador es parcial por tipo, y estos
        // dos son obligatorios para poder dibujar. El árbol ya se comprobó arriba.
        tree: patch.data.tree,
        marco: patch.data.marco ?? marco,
      },
    });
    setDraftOffer(null);
  };

  const discardDraft = () => {
    if (projectId && componentId) clearDraft(projectId, componentId);
    setDraftOffer(null);
  };

  // Las medidas se cuentan al confirmarse (no en cada tecla: DimensionField solo confirma al salir
  // del campo o con Enter). Es la señal de "correcciones frecuentes" de las estadísticas.
  const commitWidth = (value: number) => {
    dimensionEditsRef.current += 1;
    setWidth(value);
  };
  const commitHeight = (value: number) => {
    dimensionEditsRef.current += 1;
    setHeight(value);
  };

  // En modo seleccion no hay pista: la leyenda de componentes ya nombra las piezas, y la pista
  // repetia lo mismo ocupando 221x65 px flotando encima del dibujo. Solo se dice lo que la leyenda
  // no puede decir: que hay una herramienta armada y donde hay que pulsar para aplicarla.
  const toolHint =
    activeTool.mode === "select"
      ? null
      : activeTool.mode === "split"
      ? `Haz clic dentro de una hoja para dividirla (${activeTool.axis === "col" ? "vertical" : "horizontal"})`
      : `Haz clic en una hoja para asignarle "${wingDefs.find((w) => w.id === activeTool.wing)?.name}"`;

  const activeSummary = components.find((item) => item.id === componentId);
  const agentComponent: ComponentRecord = {
    id: componentId ?? "offline",
    projectId: projectId ?? "offline",
    position: activeSummary?.position ?? 0,
    code,
    designation,
    location,
    qty,
    widthMm: width,
    heightMm: height,
    brand,
    systemIndex,
    colorIndex,
    glassIndex,
    typology: configSummary,
    configState: componentConfigState,
    unitPrice: Math.round(calc.sale),
    total: Math.round(calc.total),
    data: {
      rail, glassIndex, face, margin, installation, transport, discount, client, clientAddress,
      clientPhone, clientEmail, deliveryDate, selectedId, tree, marco, termsHeader, paymentTerms,
      barLengthMm, luftAi,
    },
    createdAt: activeSummary?.createdAt ?? savedAt ?? "",
    updatedAt: savedAt ?? activeSummary?.updatedAt ?? "",
  };

  const handleAgentApply = (next: ComponentRecord, nextState: LuftAgentState) => {
    setQty(next.qty);
    setWidth(next.widthMm);
    setHeight(next.heightMm);
    setBrand(next.brand);
    setSystemIndex(next.systemIndex);
    setColorIndex(next.colorIndex);
    setRail(next.data.rail);
    setGlassIndex(next.data.glassIndex);
    setTree(normalizeTree(next.data.tree));
    setMarco(next.data.marco);
    setSelectedId(next.data.selectedId || firstLeafId(next.data.tree));
    setLuftAi(nextState);
  };

  return (
    <main className="internalApp">
      <TopBar
        code={code}
        designation={designation}
        location={location}
        projectName={projectName}
        onPrint={handlePrint}
        selfCheck={selfCheck}
        savedAt={savedAt}
        saveState={lockedByOtherTab ? "locked" : saveState}
        saveError={saveError}
      />
      <ModuleNav tabs={TABS} active={tab} onChange={changeTab} />

      {/* Avisos que valen para toda la pantalla, no para una pestaña: se muestran encima del área de
          trabajo para que no dependan de en qué sección estés. */}
      {lockedByOtherTab && (
        <div className="workspaceBanner warn" role="alert">
          <span>
            Este componente está abierto en otra pestaña. Para no sobrescribir lo que se haga allí, aquí
            no se está guardando.
          </span>
          <button type="button" onClick={handleTakeOver}>Editar desde aquí</button>
        </div>
      )}
      {draftOffer && (
        <div className="workspaceBanner info" role="alert">
          <span>
            Se encontró trabajo sin guardar de este componente, de{" "}
            {new Date(draftOffer.savedAt).toLocaleString("es-MX")}, más reciente que lo guardado en el
            servidor.
          </span>
          <button type="button" onClick={applyDraft}>Recuperarlo</button>
          <button type="button" onClick={discardDraft}>Descartar</button>
        </div>
      )}
      {conflict && (
        <div className="workspaceBanner error" role="alert">
          <span>
            Otra sesión guardó este componente el{" "}
            {new Date(conflict.updatedAt).toLocaleString("es-MX")}. No se sobrescribió nada: lo que tienes
            aquí sigue en pantalla y guardado en este navegador.
          </span>
          <button type="button" onClick={acceptServerVersion}>Traer la del servidor</button>
          <button type="button" onClick={() => void overwriteWithMine()}>Guardar la mía</button>
        </div>
      )}
      {saveState === "error" && !conflict && (
        <div className="workspaceBanner error" role="alert">
          <span>No se pudo guardar: {saveError} Tu trabajo sigue en pantalla y guardado en este navegador.</span>
        </div>
      )}
      {undoAction && (
        <div className="workspaceBanner info" role="status">
          <span>{undoAction.label}</span>
          <button type="button" onClick={() => void runUndo()}>Deshacer</button>
          <button type="button" onClick={() => setUndoAction(null)}>Cerrar</button>
        </div>
      )}

      <NewProjectDialog
        open={showNewProject}
        busy={switchingProject}
        error={createError}
        resetToken={createdToken}
        onCancel={() => setShowNewProject(false)}
        onCreate={(draft) => void handleCreateProject(draft)}
      />

      <section className="workspace" id="top">
        <aside className="configPanel">
          <div className="eyebrow">MOTOR DE CONFIGURACIÓN · MX</div>
          <h1>{tab}</h1>
          <p className="lead">Sistema técnico de diseño, consumo y cotización para cancelería de PVC.</p>

          {tab === "Proyecto" && (
            <>
              <Block
                n="01"
                title="Proyectos"
                sub="Separados por origen: los que entraron desde un archivo, un respaldo o el cotizador público, y los que se crearon aquí."
              />
              <ProjectExplorer
                projects={projects}
                trashed={trashedProjects}
                activeProjectId={projectId}
                busy={switchingProject}
                offline={persistMode === "offline"}
                error={projectsError}
                onNeedTrash={refreshTrash}
                onOpen={handleOpenProject}
                onCreate={() => {
                  setCreateError("");
                  setShowNewProject(true);
                }}
                onRename={handleRenameProjectFromList}
                onEditInfo={async (project) => {
                  // "Editar información" abre el proyecto y lleva a su ficha, que es donde se edita.
                  if (project.id !== projectId) await handleOpenProject(project.id);
                  document.getElementById("fichaSolicitante")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onDuplicate={handleDuplicateProject}
                onExport={handleExportProject}
                onArchive={handleArchiveProject}
                onDelete={handleDeleteProject}
                onRestore={handleRestoreProject}
                onPurge={handlePurgeProject}
                onImportFile={handleImportFile}
                onBackup={handleBackup}
                onRestoreBackup={handleRestoreBackup}
              />

              {fileMessage && <p className="explorerNotice" role="status">{fileMessage}</p>}

              {importPrompt && (
                <div className="importPrompt" role="alertdialog" aria-label="Ese proyecto ya existe aquí">
                  <p>
                    <b>“{importPrompt.name}”</b>
                    {importPrompt.folio ? ` (${importPrompt.folio})` : ""} ya existe en esta plataforma. El archivo trae{" "}
                    {importPrompt.componentCount} componente(s).
                  </p>
                  {importPrompt.warnings.map((warning) => (
                    <p key={warning} className="importPromptWarning">⚠ {warning}</p>
                  ))}
                  <div className="importPromptActions">
                    <button type="button" onClick={() => void applyImport(importPrompt.text, "copy", importPrompt.warnings)}>
                      Crear una copia
                    </button>
                    <button
                      type="button"
                      className="explorerDanger"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Reemplazar sustituye los datos y TODOS los componentes de "${importPrompt.name}" por los del archivo. ¿Continuar?`
                          )
                        ) {
                          void applyImport(importPrompt.text, "replace", importPrompt.warnings);
                        }
                      }}
                    >
                      Reemplazar el existente
                    </button>
                    <button type="button" onClick={() => setImportPrompt(null)}>Cancelar</button>
                  </div>
                </div>
              )}

              <Block
                n="02"
                title="Proyecto abierto"
                sub="Un proyecto agrupa varias ventanas/puertas (componentes) que se cotizan y fabrican juntas."
              />
              {projectMeta && (
                <div className="openProjectMeta">
                  <span>
                    Folio<b>{projectMeta.folio || "Sin folio"}</b>
                  </span>
                  <span>
                    Origen<b>{projectOriginLabel(projectMeta.origin)}</b>
                  </span>
                  <span>
                    Estado<b>{projectStatusLabel(projectMeta.status)}</b>
                  </span>
                  <span>
                    Creado<b>{new Date(projectMeta.createdAt).toLocaleString("es-MX")}</b>
                  </span>
                  <span>
                    Modificado<b>{new Date(projectMeta.updatedAt).toLocaleString("es-MX")}</b>
                  </span>
                  {projectMeta.importedAt && (
                    <span>
                      Importado<b>{new Date(projectMeta.importedAt).toLocaleString("es-MX")}</b>
                    </span>
                  )}
                  {projectMeta.originalCreatedAt && projectMeta.originalCreatedAt !== projectMeta.createdAt && (
                    <span>
                      Creación original<b>{new Date(projectMeta.originalCreatedAt).toLocaleString("es-MX")}</b>
                    </span>
                  )}
                  {projectMeta.duplicatedFromId && (
                    <span>
                      Duplicado de<b>otro proyecto</b>
                    </span>
                  )}
                </div>
              )}
              {projectMeta?.source === "web" && (
                <p className="sourceNote">
                  🌐 Llegó del cotizador público · Folio {projectMeta.folio || "—"}
                  {projectMeta.requester.fullName ? ` · ${projectMeta.requester.fullName}` : ""}
                </p>
              )}
              <label>Nombre del proyecto
                <input value={projectName} onChange={(e) => handleRenameProject(e.target.value)} />
              </label>
              {persistMode === "offline" && (
                <p className="sourceNote">⚠ Sin conexión con la base de datos — guardando solo en este navegador. Los componentes de otros dispositivos no aparecerán hasta reconectar.</p>
              )}

              <div id="fichaSolicitante">
                <Block
                  n="03"
                  title="Solicitante"
                  sub="Los datos de quien pide la cotización. Van dentro del archivo del proyecto y se recuperan al importarlo."
                />
                {projectMeta ? (
                  // key por proyecto: cambiar de proyecto remonta la ficha, que es cómo se reinicia
                  // su borrador sin un efecto de sincronización (ver RequesterPanel).
                  <RequesterPanel
                    key={projectMeta.id}
                    requester={projectMeta.requester}
                    status={projectMeta.status}
                    currency={projectMeta.currency}
                    pricingListId={projectMeta.pricingListId}
                    estimatedDate={projectMeta.estimatedDate}
                    notes={projectMeta.notes}
                    folio={projectMeta.folio}
                    saving={requesterSaving}
                    error={requesterError}
                    readOnly={persistMode === "offline"}
                    onSave={handleSaveRequester}
                  />
                ) : (
                  <p className="notice">
                    Sin proyecto en la base de datos: la ficha del solicitante no está disponible en modo sin conexión.
                  </p>
                )}
              </div>

              <Block n="04" title="Componentes" sub="Cada uno es una ventana o puerta independiente dentro del proyecto." />
              <ComponentList
                components={components}
                activeComponentId={componentId}
                projects={projects}
                currentProjectId={projectId}
                busy={switchingProject}
                readOnly={!projectId}
                onSelect={handleSwitchComponent}
                onAdd={handleAddComponent}
                onDuplicate={handleDuplicateComponent}
                onRename={handleRenameComponent}
                onSetLocation={handleSetComponentLocation}
                onChangeQty={handleChangeComponentQty}
                onDelete={handleDeleteComponent}
                onBulk={handleBulkComponents}
              />

              <Block
                n="05"
                title="Historial y cierre de obra"
                sub="Puntos de restauración del proyecto, y lo que costó y se cobró de verdad."
              />
              {projectMeta ? (
                <ProjectHistory
                  key={projectMeta.id}
                  versions={versions}
                  outcome={outcome}
                  quotedTotal={components.reduce((sum, component) => sum + component.total, 0)}
                  quotedPieces={components.reduce((sum, component) => sum + component.qty, 0)}
                  busy={switchingProject}
                  readOnly={persistMode === "offline"}
                  error={historyError}
                  onCreateVersion={(label) => void handleCreateVersion(label)}
                  onRestoreVersion={(version) => void handleRestoreVersion(version)}
                  onSaveOutcome={(draft) => void handleSaveOutcome(draft)}
                  onClearOutcome={() => void handleClearOutcome()}
                />
              ) : (
                <p className="notice">
                  Sin proyecto en la base de datos: el historial y el cierre de obra no están disponibles
                  en modo sin conexión.
                </p>
              )}

              <Block
                n="06"
                title="Mejora continua"
                sub="Sugerencias y avisos con el dato que los respalda. Nada se aplica sin que lo pidas."
              />
              <QuoteInsights
                enabled={learningEnabled}
                loading={learningLoading}
                stats={visibleStats}
                templates={visibleTemplates}
                recommendations={recommendations}
                onToggle={handleToggleLearning}
                onApply={handleApplyRecommendation}
                onUseTemplate={handleUseTemplate}
                onClearHistory={handleClearLearning}
              />

              {hydrated && (
                <LuftAiPanel
                  actor={agentActor}
                  projectId={projectId ?? "offline"}
                  projectName={projectName}
                  component={agentComponent}
                  componentSummaries={components}
                  state={luftAi}
                  onStateChange={setLuftAi}
                  onApply={handleAgentApply}
                  signedIn={agentSignedIn}
                />
              )}
            </>
          )}

          {tab === "Clientes" && (
            <>
              <Block n="01" title="Expediente de clientes" sub="Cada cotización enviada desde el cotizador público queda registrada aquí con los datos de su cliente, su documento y la etapa en que va." />
              <CustomerBook />
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
              <div className="inputGrid two">
                <label>Teléfono<input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} /></label>
                <label>Correo<input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></label>
              </div>
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
                <button className={brand === "Aluplast" ? "selected brandPill" : ""} style={brand === "Aluplast" ? { background: brandAccent.Aluplast } : undefined} onClick={() => changeBrand("Aluplast")}>ALUPLAST</button>
                <button className={brand === "Deceuninck" ? "selected brandPill" : ""} style={brand === "Deceuninck" ? { background: brandAccent.Deceuninck } : undefined} onClick={() => changeBrand("Deceuninck")}>DECEUNINCK</button>
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
                {/* DimensionField keeps a local text draft and only commits on blur/Enter -- typing
                    never touches width/height/qty state mid-edit, so clearing the field, retyping,
                    or a momentarily invalid value never snaps to 0, fights the cursor, or forces a
                    calc/2D/3D recompute per keystroke (see components/editor/DimensionField.tsx). */}
                <label>Ancho<DimensionField value={width} min={MIN_OPENING_MM} onCommit={commitWidth} /></label>
                <label>Alto<DimensionField value={height} min={MIN_OPENING_MM} onCommit={commitHeight} /></label>
                <label>Cant.<DimensionField value={qty} min={1} onCommit={setQty} /></label>
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
              <Block n="01" title="Costos de producción" sub="Mano de obra de taller y merma de perfil. Entran al costo directo, así que mueven el precio." />
              <label>Mano de obra por m²<input type="number" value={laborPerM2} onChange={(e) => setLaborPerM2(Math.max(0, Number(e.target.value)))} /></label>
              <label>Merma de perfil <b>{wastePct}%</b><input type="range" min="0" max="30" value={wastePct} onChange={(e) => setWastePct(Number(e.target.value))} /></label>

              <Block n="02" title="Costos adicionales" sub="Recargos y condiciones comerciales." />
              <label>Instalación por pieza<input type="number" value={installation} onChange={(e) => setInstallation(Number(e.target.value))} /></label>
              <label>Transporte por pieza<input type="number" value={transport} onChange={(e) => setTransport(Number(e.target.value))} /></label>
              <label>Margen de utilidad <b>{margin}%</b><input type="range" min="10" max="60" value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></label>
              <label>Descuento <b>{discount}%</b><input type="range" min="0" max="20" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>

              <Block n="03" title="Gastos fijos" sub="Solo afecta la utilidad neta reportada, no el precio de venta." />
              <label>Gastos fijos sobre venta <b>{overheadPct}%</b><input type="range" min="0" max="45" value={overheadPct} onChange={(e) => setOverheadPct(Number(e.target.value))} /></label>
            </>
          )}

          {tab === "Catálogos" && (
            <>
              <Block n="01" title="Herrajes MACO para sistemas Aluplast" sub="Lista de precios del proveedor de herrajes, por revisión. MACO fabrica los herrajes; Aluplast es la marca de los perfiles con los que son compatibles." />
              <HerrajesMaco />
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
            {/* La cabecera dice QUE estas viendo: vista, composicion y sistema. La ficha del
                sistema estaba flotando sobre el dibujo, donde solo restaba sitio y repetia lo que
                ya dicen el paso 01 y el panel de propiedades. Aqui es un rotulo de estado, que es
                lo que siempre fue. El pie queda para la leyenda, que dice COMO leer el dibujo. */}
            <div className="visualWhat">
              <span><span className="statusDot" />VISTA {view.toUpperCase()}{view === "3D" ? ` · ${viewPreset}` : ""} · {configSummary}</span>
              <small
                className="visualSystem"
                title={`${brand} · ${sys.name} · ${sys.depth} mm · ${sys.chambers} · ${rail ? `${rail} riel${rail > 1 ? "es" : ""}` : "practicable"} · ${glass.name} · ${face}`}
              >
                {brand} · {sys.name} · {sys.depth} mm · {rail ? `${rail} riel${rail > 1 ? "es" : ""}` : "practicable"} · {glass.name} · {face}
              </small>
            </div>
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
              {/* Un proyecto puede llegar sin componentes (recién importado, o del cotizador público).
                  Se dice con claridad en vez de dibujar la ventana genérica del estado inicial, que
                  parecería un componente real que nadie creó. */}
              {hydrated && !componentId && (
                <div className="canvasEmpty">
                  <b>Este proyecto no tiene componentes</b>
                  <p>Cada componente es una ventana o puerta independiente que se cotiza y fabrica con el proyecto.</p>
                  <button type="button" onClick={handleAddComponent} disabled={!projectId || switchingProject}>
                    + Agregar el primer componente
                  </button>
                </div>
              )}
              {view === "Sección" && (
                <>
                  <div className="dim top"><EditableDim label="W" valueMm={width} min={MIN_OPENING_MM} onCommit={commitWidth} /></div>
                  <div className="dim side"><EditableDim label="H" valueMm={height} min={MIN_OPENING_MM} onCommit={commitHeight} /></div>
                  <SectionRender depth={sys.depth} rail={rail} glazing={glass.thickness} />
                </>
              )}
              {view === "2D" && (
                <PanZoomViewport onBackgroundClick={clearFocus} aspect={width / height}>
                  <FrameCanvas
                    tree={tree}
                    width={width}
                    height={height}
                    selectedId={selectedId}
                    color={color}
                    system={sys}
                    railCount={rail}
                    focusScope={focusScope}
                    focusPart={focusPart}
                    focusSide={focusSide}
                    showFocus
                    onPartClick={handlePartClick}
                    onAssemblyMarcoClick={handleAssemblyFocus}
                    onCentralLockClick={handleCentralLockClick}
                  >
                    {/* Las cotas totales van pegadas al dibujo, no a una esquina del lienzo. Antes
                        estaban ancladas al viewport (top:40px, left:42px) con un margen del 19%, asi
                        que no cerraban con los bordes del producto: la cota general de una alzada
                        tiene que arrancar y terminar en la ventana, o no es una cota. */}
                    <div className="cotaTotal cotaTotalX"><EditableDim label="W" valueMm={width} min={MIN_OPENING_MM} onCommit={commitWidth} /></div>
                    <div className="cotaTotal cotaTotalY"><EditableDim label="H" valueMm={height} min={MIN_OPENING_MM} onCommit={commitHeight} /></div>
                  </FrameCanvas>
                </PanZoomViewport>
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
                  onSelectAssemblyMarco={handleAssemblyFocus}
                  onSplit={handle3DSplit}
                  onAssignWing={handle3DAssignWing}
                  onReady={() => setThreeReady(true)}
                />
              </div>
            </div>
          </div>
          {/* Pie del lienzo. Antes eran cuatro cajas flotando sobre un lienzo de 441x314 px, con
              solapes medidos de 227x28 px entre la ficha del sistema y la leyenda, y de 66x14
              entre la pista y los controles de zoom. En una fila compartida el solape es
              imposible por construccion, no por haber elegido bien los desplazamientos. */}
          {/* Solo existe si tiene algo que decir. Sin esta condicion, en 3D y en Seccion quedaba una
              franja vacia de 40 px con su borde, quitandole alto al dibujo para no mostrar nada. */}
          {(view === "2D" || toolHint) && (
            <div className="canvasFooter">
              {view === "2D" && <ElevationKey focusPart={focusPart} hasRail={hasSliding} frameHex={color.hex ?? "#dfe2dc"} />}
              {toolHint && <div className="editHint">{toolHint}</div>}
            </div>
          )}
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
              onChange={updatePane}
              onChangeWing={(wing) => setTree((prev) => setWing(prev, selectedLeaf.id, wing))}
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
                <ProjectCotizacionDoc components={projectComponents} projectName={projectName} client={client} clientAddress={clientAddress} deliveryDate={deliveryDate} company={company} />
              ) : report === "Optimización de corte" ? (
                <ProjectCorteDoc components={projectComponents} projectName={projectName} barLengthMm={barLengthMm} />
              ) : (
                <ProjectVidrioDoc components={projectComponents} projectName={projectName} />
              )
            ) : report === "Cotización" ? (
              <CotizacionDoc
                calc={calc} sys={sys} glass={glass} color={color} brand={brand} tree={tree} width={width} height={height} qty={qty}
                code={code} designation={designation} location={location} client={client} clientAddress={clientAddress} deliveryDate={deliveryDate}
                configSummary={configSummary} termsHeader={termsHeader} paymentTerms={paymentTerms} company={company}
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
                <Cost label={`Perfiles (incl. ${wastePct}% merma)`} value={calc.profileCost} />
                <Cost label="Accesorios y herrajes" value={calc.accessories + calc.reinforce + calc.seals} />
                {calc.addons > 0 && <Cost label="Persianas Mallorquina" value={calc.addons} />}
                <Cost label="Vidrio" value={calc.glassCost} />
                <Cost label="Mano de obra de taller" value={calc.labor} />
                <Cost label="Servicios y consumibles" value={installation + transport + calc.consumables} />
                <div className="direct"><span>Costo directo / pza.</span><b>{money(calc.direct)}</b></div>
              </div>
              <div className="totalBox">
                <span>TOTAL OFERTA <small>IVA no incluido</small></span>
                <strong>{money(calc.total)}</strong>
                {/* Bruta y neta separadas: la bruta no absorbe gastos fijos, así que mostrarla sola
                    hacía leer un 35% que nunca llegaba al resultado. */}
                <div><span>Utilidad bruta</span><b>{money(calc.utility)}</b></div>
                <div><span>Gastos fijos ({overheadPct}%)</span><b>−{money(calc.overhead)}</b></div>
                <div><span>Utilidad neta ({calc.netMarginPct.toFixed(1)}%)</span><b>{money(calc.netUtility)}</b></div>
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
