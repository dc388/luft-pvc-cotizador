import { money } from "@/lib/money";

export function Prop({ k, v }: { k: string; v: string }) {
  return <div className="prop"><span>{k}</span><b>{v}</b></div>;
}

export function Cost({ label, value }: { label: string; value: number }) {
  return <div className="line"><span>{label}</span><b>{money(value)}</b></div>;
}

export function Item({ code, name, qty }: { code: string; name: string; qty: string }) {
  return <div className="materialItem"><span>{code}</span><div><b>{name}</b><small>{qty}</small></div></div>;
}
