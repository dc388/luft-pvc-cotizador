export function Block({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="step">
      <span>{n}</span>
      <div><b>{title}</b><small>{sub}</small></div>
    </div>
  );
}
