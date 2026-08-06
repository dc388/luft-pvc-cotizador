"use client";

type TopBarProps = {
  code: string;
  designation: string;
  location: string;
  onPrint: () => void;
};

export function TopBar({ code, designation, location, onPrint }: TopBarProps) {
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="brandMark">L</span>
        <span>LUFT <b>PVC</b></span>
      </a>
      <div className="projectName">
        <span>PROYECTO ACTIVO</span>
        <strong>Oferta {code} · {designation} {location}</strong>
      </div>
      <div className="headerActions">
        <button className="primary" onClick={onPrint}>Generar informe</button>
      </div>
    </header>
  );
}

type ModuleNavProps<T extends string> = { tabs: T[]; active: T; onChange: (tab: T) => void };

export function ModuleNav<T extends string>({ tabs, active, onChange }: ModuleNavProps<T>) {
  return (
    <nav className="moduleNav">
      {tabs.map((x) => (
        <button key={x} className={active === x ? "active" : ""} onClick={() => onChange(x)}>{x}</button>
      ))}
    </nav>
  );
}
