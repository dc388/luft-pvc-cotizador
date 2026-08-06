export function SectionRender({ depth, rail, glazing }: { depth: number; rail: number; glazing: number }) {
  return (
    <div className="sectionRender">
      <div className="profileSection">
        <span className="chamber c1" /><span className="chamber c2" /><span className="chamber c3" />
        <i className="glassSection" style={{ width: `${Math.max(8, glazing / 2)}px` }} />
      </div>
      <div className="sectionInfo">
        <b>Sección de sistema</b>
        <span>Profundidad: {depth} mm</span>
        <span>Acristalamiento: {glazing} mm</span>
        <span>{rail ? `${rail} riel${rail > 1 ? "es" : ""}` : "Doble contacto"}</span>
      </div>
    </div>
  );
}
