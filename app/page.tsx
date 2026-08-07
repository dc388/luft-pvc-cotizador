"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { Brand, GlassSide, Marco, PaneSpec, Report, Side, Tab, Tool, ViewMode, ViewPreset3D } from "@/types/domain";
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
} from "@/lib/tree";
import { calcQuote } from "@/lib/calc";
import { money } from "@/lib/money";
import { runSelfCheck, type SelfCheckResult } from "@/lib/selfCheck";
import { Block } from "@/components/Block";
import { TopBar, ModuleNav } from "@/components/layout/Nav";
import { Toolbox } from "@/components/editor/Toolbox";
import { FrameCanvas } from "@/components/editor/FrameCanvas";
import { SectionRender } from "@/components/editor/SectionRender";
import { Scene3D } from "@/components/editor/Scene3D";
import { ExplorerTree } from "@/components/editor/ExplorerTree";
import type { PartKind, SideKey } from "@/components/editor/frameTypes";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { MarcoPanel } from "@/components/properties/MarcoPanel";
import { Prop, Cost, Item } from "@/components/properties/Prop";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { CotizacionDoc } from "@/components/reports/CotizacionDoc";
import { CorteDoc } from "@/components/reports/CorteDoc";
import { VidrioDoc } from "@/components/reports/VidrioDoc";

const TABS: Tab[] = ["Resumen", "Diseño", "Consumo", "Servicios", "Informes"];
const REPORTS: Report[] = ["Cotización", "Optimización de corte", "Pedido de vidrio", "Producción", "Herrajes", "Costos"];
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
  const [profileSearch, setProfileSearch] = useState("");
  const [profileSystemFilter, setProfileSystemFilter] = useState("Todos");

  const [tree, setTree] = useState(() => createDefaultTree());
  const [selectedId, setSelectedId] = useState(() => firstLeafId(tree));
  const [activeTool, setActiveTool] = useState<Tool>({ mode: "select" });
  const [focusPart, setFocusPart] = useState<PartKind | null>(null);
  const [focusSide, setFocusSide] = useState<SideKey | null>(null);
  const [focusScope, setFocusScope] = useState<"leaf" | "assembly">("leaf");
  const [marco, setMarco] = useState<Marco>(() => defaultMarco());
  const [threeReady, setThreeReady] = useState(false);
  const [selfCheck, setSelfCheck] = useState<SelfCheckResult | null>(null);

  const sys = catalog[brand][Math.min(systemIndex, catalog[brand].length - 1)];
  const glass = glassCatalog[glassIndex];
  const color = colors[brand][Math.min(colorIndex, colors[brand].length - 1)];

  const changeBrand = (b: Brand) => { setBrand(b); setSystemIndex(0); setColorIndex(0); setRail(catalog[b][0].rails[0]); };
  const changeSystem = (i: number) => { setSystemIndex(i); setRail(catalog[brand][i].rails[0]); };
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
    () => calcQuote({ width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount }),
    [width, height, qty, tree, sys, glass, color, rail, installation, transport, margin, discount]
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
      setSelfCheck(runSelfCheck({ tree, width, height, qty, sys, glass, color, rail, installation, transport, margin, discount, marco, threeReady }));
    run();
    const id = setInterval(run, 25000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, width, height, qty, sys, glass, color, rail, installation, transport, margin, discount, marco, threeReady]);

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

  const hasRailOptions = sys.rails.some((x) => x > 0);

  const warnings = [
    ...(width > sys.maxW || height > sys.maxH ? [`Medida supera el límite de referencia ${sys.maxW} × ${sys.maxH} mm.`] : []),
    ...(glass.thickness > sys.glazing ? [`Vidrio de ${glass.thickness} mm supera el galce de referencia (${sys.glazing} mm).`] : []),
    ...(rail > 0 && !sys.rails.includes(rail) ? [`El sistema no contempla ${rail} riel(es).`] : []),
  ];

  const toolHint =
    activeTool.mode === "select"
      ? "Haz clic en el marco, la hoja, el vidrio o el herraje para seleccionar esa parte"
      : activeTool.mode === "split"
      ? `Haz clic dentro de una hoja para dividirla (${activeTool.axis === "col" ? "vertical" : "horizontal"})`
      : `Haz clic en una hoja para asignarle "${wingDefs.find((w) => w.id === activeTool.wing)?.name}"`;

  return (
    <main>
      <TopBar code={code} designation={designation} location={location} onPrint={handlePrint} selfCheck={selfCheck} />
      <ModuleNav tabs={TABS} active={tab} onChange={changeTab} />

      <section className="workspace" id="top">
        <aside className="configPanel">
          <div className="eyebrow">MOTOR DE CONFIGURACIÓN · MX</div>
          <h1>{tab}</h1>
          <p className="lead">Sistema técnico de diseño, consumo y cotización para cancelería de PVC.</p>

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
              <Block n="02" title="Composición" sub="Haz clic en el marco, la hoja, el vidrio o el herraje del dibujo para seleccionar esa parte, o usa la paleta para dividir y asignar tipos de apertura." />
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
              <Block n="03" title="Geometría" sub="Cotas generales en milímetros." />
              <div className="inputGrid">
                <label>Ancho<input type="number" value={width} onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))} /></label>
                <label>Alto<input type="number" value={height} onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))} /></label>
                <label>Cant.<input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} /></label>
              </div>
              <Block n="04" title="Materiales" sub="Color, aplicación y vidrio." />
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
                <select><option>6,000 mm</option><option>6,500 mm</option></select>
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
              <div className="reportList">
                {REPORTS.map((r) => (
                  <button className={report === r ? "selected" : ""} key={r} onClick={() => setReport(r)}>{r}<span>Ver →</span></button>
                ))}
              </div>
              <button className="fullButton" onClick={() => window.print()}>Exportar {report} a PDF <span>↗</span></button>
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
              <Toolbox activeTool={activeTool} onToolChange={setActiveTool} canMerge={canMerge} onMerge={handleMerge} onReset={handleResetTree} />
            )}
            <div className="canvasStage">
              {view !== "3D" && (
                <>
                  <div className="dim top"><span>W={width.toLocaleString()} mm</span></div>
                  <div className="dim side"><span>H={height.toLocaleString()} mm</span></div>
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
              onChange={updatePane}
              onChangeSide={updateLeafSide}
              onChangeGlassSide={updateLeafGlassSide}
              onMerge={handleMerge}
            />
          )}

          {tab === "Informes" ? (
            report === "Cotización" ? (
              <CotizacionDoc
                calc={calc} sys={sys} glass={glass} color={color} brand={brand} tree={tree} width={width} height={height} qty={qty}
                code={code} designation={designation} location={location} client={client} clientAddress={clientAddress} deliveryDate={deliveryDate}
                configSummary={configSummary}
              />
            ) : report === "Optimización de corte" ? (
              <CorteDoc tree={tree} width={width} height={height} qty={qty} designation={designation} location={location} system={sys} />
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
                <Item code="HERRAJE" name="Juego de herrajes" qty={`${calc.leaves.length} set`} />
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
