import type { ComponentRecord } from "@/types/project";
import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { BAR_LENGTH_MM, KERF_MM } from "@/lib/calc";
import { buildProjectCutList } from "@/lib/projectReports";
import { CorteCategory } from "./CorteDoc";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type Props = { components: ComponentRecord[]; projectName: string };

// Direct port of renderProjectCorteDoc from static/cotizador.html — nests cut pieces from
// EVERY component that shares brand+system+color into one packBars run per category, instead
// of optimizing each component's bars in isolation (see buildProjectCutList).
export function ProjectCorteDoc({ components, projectName }: Props) {
  const groups = buildProjectCutList(components);
  return (
    <div className="reportDoc">
      <div className="docPage">
        <div className="docHeader">
          <div>
            <div className="docBrandRow">
              <span className="brandMark">L</span>
              <b>LUFT PVC</b>
            </div>
            <h1 className="docTitle">Optimización del corte — Proyecto completo</h1>
          </div>
          <div className="docMeta">
            <div>Proyecto: <b>{projectName}</b></div>
            <div>Fecha: <b>{todayStr()}</b></div>
            <div>Componentes: <b>{components.length}</b></div>
          </div>
        </div>
        {groups.map((g, gi) => {
          const sys = catalog[g.brand][Math.min(g.systemIndex, catalog[g.brand].length - 1)];
          const color = colors[g.brand][Math.min(g.colorIndex, colors[g.brand].length - 1)];
          return (
            <div key={gi}>
              <h2 className="docGroupTitle">
                {g.brand} · {sys.name} · {color.name} — {g.components.length} componente(s): {g.components.map((c) => c.designation).join(", ")}
              </h2>
              <CorteCategory title="Marco" pieces={g.marco} qty={1} />
              <CorteCategory title="Travesaño" pieces={g.travesanos} qty={1} />
              <CorteCategory title="Hoja" pieces={g.hojas} qty={1} />
              <CorteCategory title="Junquillo" pieces={g.junquillos} qty={1} />
            </div>
          );
        })}
        <p className="docIntro">
          Barra comercial de {BAR_LENGTH_MM} mm, tolerancia de corte de {KERF_MM} mm. Las piezas se agrupan y anidan entre TODOS los componentes del
          proyecto que comparten marca, sistema y color — no es una optimización independiente por ventana.
        </p>
      </div>
    </div>
  );
}
