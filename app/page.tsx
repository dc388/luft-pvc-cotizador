"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { Brand, PaneSpec, Report, Tab, Tool, ViewMode } from "@/types/domain";
import { catalog } from "@/data/catalog";
import { glassCatalog } from "@/data/glass";
import { colors } from "@/data/colors";
import { ideal2000Profiles } from "@/data/profiles";
import { wingDefs } from "@/data/wings";
import {
  createDefaultTree,
  findNode,
  findParentSplitId,
  firstLeafId,
  isLeaf,
  removeSplit,
  setWing,
  splitLeaf,
  updateSpec,
} from "@/lib/tree";
import { calcQuote } from "@/lib/calc";
import { money } from "@/lib/money";
import { Block } from "@/components/Block";
import { TopBar, ModuleNav } from "@/components/layout/Nav";
import { Toolbox } from "@/components/editor/Toolbox";
import { FrameCanvas } from "@/components/editor/FrameCanvas";
import { SectionRender } from "@/components/editor/SectionRender";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { Prop, Cost, Item } from "@/components/properties/Prop";
import { ReportPreview } from "@/components/reports/ReportPreview";

const TABS: Tab[] = ["Resumen", "Diseño", "Consumo", "Servicios", "Informes"];
const REPORTS: Report[] = ["Oferta", "Producción", "Perfiles", "Herrajes", "Vidrio", "Costos"];

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
  const [view, setView] = useState<ViewMode>("Frente");
  const [report, setReport] = useState<Report>("Vidrio");
  const [margin, setMargin] = useState(35);
  const [installation, setInstallation] = useState(1200);
  const [transport, setTransport] = useState(450);
  const [discount, setDiscount] = useState(0);
  const [code, setCode] = useState("001");
  const [designation, setDesignation] = useState("V01");
  const [location, setLocation] = useState("Cocina");

  const [tree, setTree] = useState(() => createDefaultTree());
  const [selectedId, setSelectedId] = useState(() => firstLeafId(tree));
  const [activeTool, setActiveTool] = useState<Tool>({ mode: "select" });

  const sys = catalog[brand][Math.min(systemIndex, catalog[brand].length - 1)];
  const glass = glassCatalog[glassIndex];
  const color = colors[brand][Math.min(colorIndex, colors[brand].length - 1)];

  const changeBrand = (b: Brand) => { setBrand(b); setSystemIndex(0); setColorIndex(0); setRail(catalog[b][0].rails[0]); };
  const changeSystem = (i: number) => { setSystemIndex(i); setRail(catalog[brand][i].rails[0]); };
  const changeTab = (t: Tab) => { setTab(t); if (t !== "Diseño") setActiveTool({ mode: "select" }); };

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

  const handleLeafClick = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    if (activeTool.mode === "select") { setSelectedId(id); return; }
    if (activeTool.mode === "split") {
      const rect = e.currentTarget.getBoundingClientRect();
      const fraction = activeTool.axis === "col"
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
      const result = splitLeaf(tree, id, activeTool.axis, fraction);
      const node = findNode(result, id);
      setTree(result);
      if (node && node.kind === "split") setSelectedId(node.children[0].id);
      setActiveTool({ mode: "select" });
      return;
    }
    setTree((prev) => setWing(prev, id, activeTool.wing));
    setSelectedId(id);
    setActiveTool({ mode: "select" });
  };

  const updatePane = (key: keyof PaneSpec, value: string) => {
    if (!selectedLeaf) return;
    setTree((prev) => updateSpec(prev, selectedLeaf.id, { [key]: value }));
  };

  const handleMerge = () => {
    if (!parentSplitId) return;
    setTree((prev) => removeSplit(prev, parentSplitId));
    setSelectedId(parentSplitId);
  };

  const handleResetTree = () => {
    const fresh = createDefaultTree();
    setTree(fresh);
    setSelectedId(firstLeafId(fresh));
    setActiveTool({ mode: "select" });
  };

  const hasRailOptions = sys.rails.some((x) => x > 0);

  const warnings = [
    ...(width > sys.maxW || height > sys.maxH ? [`Medida supera el límite de referencia ${sys.maxW} × ${sys.maxH} mm.`] : []),
    ...(glass.thickness > sys.glazing ? [`Vidrio de ${glass.thickness} mm supera el galce de referencia (${sys.glazing} mm).`] : []),
    ...(rail > 0 && !sys.rails.includes(rail) ? [`El sistema no contempla ${rail} riel(es).`] : []),
  ];

  const toolHint = activeTool.mode === "select"
    ? "Haz clic en una hoja para seleccionarla"
    : activeTool.mode === "split"
    ? `Haz clic dentro de una hoja para dividirla (${activeTool.axis === "col" ? "vertical" : "horizontal"})`
    : `Haz clic en una hoja para asignarle "${wingDefs.find((w) => w.id === activeTool.wing)?.name}"`;

  return (
    <main>
      <TopBar code={code} designation={designation} location={location} onPrint={() => window.print()} />
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
                <button className={brand === "Aluplast" ? "selected" : ""} onClick={() => changeBrand("Aluplast")}>ALUPLAST</button>
                <button className={brand === "Deceuninck" ? "selected" : ""} onClick={() => changeBrand("Deceuninck")}>DECEUNINCK</button>
              </div>
              <label>Sistema
                <select value={systemIndex} onChange={(e) => changeSystem(Number(e.target.value))}>
                  {catalog[brand].map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
                </select>
              </label>
              {hasRailOptions && (
                <label>Tipo de riel
                  <select value={rail} onChange={(e) => setRail(Number(e.target.value))}>
                    {sys.rails.map((x) => <option key={x} value={x}>{x === 1 ? "Monorriel" : `${x} rieles`}</option>)}
                  </select>
                </label>
              )}
              <Block n="02" title="Composición" sub="Usa la paleta de herramientas sobre el lienzo para dividir la ventana y asignar el tipo de cada hoja." />
              <Block n="03" title="Geometría" sub="Cotas generales en milímetros." />
              <div className="inputGrid">
                <label>Ancho<input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
                <label>Alto<input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} /></label>
                <label>Cant.<input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>
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
              {brand === "Aluplast" && (
                <>
                  <Block n="02" title="Perfiles IDEAL 2000" sub="Códigos identificados en catálogo y listas MX." />
                  <div className="profileCatalog">
                    {ideal2000Profiles.map((p) => (
                      <div key={p.code}>
                        <span className="profileSketch">{p.role === "Conector" ? "⊞" : p.role === "Junquillo" ? "⌝" : "▥"}</span>
                        <section><b>{p.code}</b><p>{p.name}</p><small>{p.role} · {p.status}</small></section>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
            <div><span className="statusDot" />VISTA {view.toUpperCase()} · {configSummary}</div>
            <div className="viewSwitch">
              {(["Frente", "Sección", "3D"] as ViewMode[]).map((v) => (
                <button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className={`canvas view-${view.replace("ó", "o")}`}>
            <div className="dim top"><span>W={width.toLocaleString()} mm</span></div>
            <div className="dim side"><span>H={height.toLocaleString()} mm</span></div>
            {tab === "Diseño" && (
              <Toolbox activeTool={activeTool} onToolChange={setActiveTool} canMerge={canMerge} onMerge={handleMerge} onReset={handleResetTree} />
            )}
            {view === "Sección" ? (
              <SectionRender depth={sys.depth} rail={rail} glazing={glass.thickness} />
            ) : (
              <div className="modelStage">
                <FrameCanvas tree={tree} width={width} height={height} selectedId={selectedId} colorName={color.name} onLeafClick={handleLeafClick} />
                {view === "3D" && <><span className="modelSide" /><span className="modelSill" /></>}
              </div>
            )}
            <div className="editHint">{toolHint}</div>
            <div className="specChip">
              <b>{brand} · {sys.name}</b>
              <span>{sys.depth} mm · {sys.chambers} · {rail ? `${rail} riel${rail > 1 ? "es" : ""}` : "practicable"}</span>
              <span>{glass.name} · {face}</span>
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

          {tab === "Diseño" && selectedLeaf && (
            <PropertiesPanel
              wing={selectedLeaf.wing}
              spec={selectedLeaf.spec}
              dims={selectedDims}
              canMerge={canMerge}
              onChange={updatePane}
              onMerge={handleMerge}
            />
          )}

          {tab === "Informes" ? (
            <ReportPreview report={report} code={code} designation={designation} location={location} brand={brand} system={sys.name} qty={qty} width={width} height={height} glassName={glass.name} calc={calc} />
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
              <p className="priceNote">Motor técnico v3 · Editor compositivo estilo RA Workshop. Valores en MXN. Los precios y límites deben validarse con la lista vigente y la ingeniería de cada proyecto.</p>
            </>
          )}
        </aside>
      </section>
      <footer className="sources">
        <b>Base técnica:</b> documentación RA Workshop aportada, <a href="https://www.aluplast.net/eng-int/products/windows/ideal/" target="_blank">sistemas oficiales Aluplast</a> y <a href="https://www.deceuninck.com.mx/en/pdf/catalogo_tecnico.pdf" target="_blank">catálogo técnico Deceuninck México</a>.
      </footer>
    </main>
  );
}
