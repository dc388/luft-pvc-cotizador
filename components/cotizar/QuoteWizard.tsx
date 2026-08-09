"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/money";
import type { PublicCatalog } from "@/lib/publicCatalog";
import { ProcessSection } from "./ProcessSection";
import { GlassTimeline } from "./glass/GlassTimeline";
import { WindowPreview } from "./WindowPreview";

// Número de atención humana: se usa solo cuando el cliente ya decidió avanzar (firma y
// anticipo). El resto del recorrido es autoservicio.
const WHATSAPP_NUMBER = "529932211158";

// Lo que se le dice al cliente cuando la línea que eligió no tiene precio de lista del
// proveedor (hoy, Deceuninck -- ver isEstimatedSystem en lib/publicCatalog.ts). Nunca se le
// presenta ese número como precio en firme.
const ESTIMATE_NOTE = "Precio aproximado: esta línea la confirma tu asesor antes de firmar.";

type Price = {
  unit: number;
  total: number;
  hasQuoteOnRequestItems: boolean;
  estimated: boolean;
  depositPercentage: number;
  deposit: number;
  remaining: number;
};
type Extras = { instalacion: boolean; persianaExterior: boolean; mosquitero: boolean };

const STEPS = ["Producto", "Línea", "Estilo", "Medidas", "Color", "Vidrio", "Extras", "Precio", "Resumen", "Proceso", "Contacto", "Listo"];

// Índices con nombre en vez de números sueltos: el flujo ya cambió de largo una vez (al
// insertar "Línea") y con literales sueltos cada inserción obliga a reenumerar a mano todas
// las comparaciones de `step`, que es justo donde se cuelan los errores.
const S = {
  PRODUCT: 0,
  BRAND: 1,
  STYLE: 2,
  SIZE: 3,
  COLOR: 4,
  GLASS: 5,
  EXTRAS: 6,
  PRICE: 7,
  SUMMARY: 8,
  PROCESS: 9,
  CONTACT: 10,
  DONE: 11,
} as const;

export function QuoteWizard({ catalog }: { catalog: PublicCatalog }) {
  const [step, setStep] = useState<number>(S.PRODUCT);
  const [productId, setProductId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [widthMm, setWidthMm] = useState(1500);
  const [heightMm, setHeightMm] = useState(1200);
  const [qty, setQty] = useState(1);
  const [colorId, setColorId] = useState("");
  const [glassId, setGlassId] = useState(catalog.glass[0].id);
  const [extras, setExtras] = useState<Extras>({ instalacion: true, persianaExterior: false, mosquitero: false });

  const [price, setPrice] = useState<Price | null>(null);
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState("");

  const [contact, setContact] = useState({ name: "", phone: "", email: "", city: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [folio, setFolio] = useState("");

  const style = useMemo(() => catalog.styles.find((s) => s.id === styleId) ?? null, [catalog.styles, styleId]);
  const brand = catalog.brands.find((b) => b.id === brandId) ?? null;
  // Cada marca tiene su propia paleta real (data/colors.ts), así que la lista de colores
  // depende de la línea elegida, no del catálogo completo.
  const colorsForBrand = useMemo(() => catalog.colors.filter((c) => c.brandId === brandId), [catalog.colors, brandId]);
  const color = colorsForBrand.find((c) => c.id === colorId) ?? colorsForBrand[0] ?? null;
  const frameHex = color?.hex ?? "#f3f3ef";
  const glass = catalog.glass.find((g) => g.id === glassId) ?? catalog.glass[0];
  const stylesForProduct = catalog.styles.filter((s) => s.productId === productId && s.brandId === brandId);
  // El servidor manda la verdad (price.estimated); el estilo la anticipa para poder avisar
  // antes de que exista un precio que mostrar.
  const isEstimated = price?.estimated ?? style?.estimated ?? false;

  const sizeError = useMemo(() => {
    if (!style) return "";
    if (widthMm < catalog.minMm || heightMm < catalog.minMm) return `La medida mínima es de ${catalog.minMm} mm por lado.`;
    if (widthMm > style.maxW || heightMm > style.maxH) return `Este estilo se fabrica hasta ${style.maxW} × ${style.maxH} mm.`;
    if (widthMm / style.panels < catalog.minMm) return `Con ${style.panels} hojas, el ancho mínimo es de ${catalog.minMm * style.panels} mm.`;
    return "";
  }, [style, widthMm, heightMm, catalog.minMm]);

  // Recotiza en el servidor cada vez que cambia la configuración. El precio nunca se calcula
  // en el navegador: aquí solo se muestra lo que responde /api/public-quote.
  const requestId = useRef(0);
  useEffect(() => {
    if (!style || !color || sizeError) {
      setPrice(null);
      return;
    }
    const id = ++requestId.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPricing(true);
      setPriceError("");
      try {
        const res = await fetch("/api/public-quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ styleId: style.id, widthMm, heightMm, qty, colorId: color.id, glassId, extras }),
          signal: controller.signal,
        });
        const json = (await res.json()) as { price?: Price; error?: string };
        if (id !== requestId.current) return;
        if (!res.ok || !json.price) {
          setPrice(null);
          setPriceError(json.error ?? "No pudimos calcular el precio.");
        } else {
          setPrice(json.price);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (id !== requestId.current) return;
        setPrice(null);
        setPriceError("No pudimos calcular el precio. Revisa tu conexión.");
      } finally {
        if (id === requestId.current) setPricing(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [style, color, widthMm, heightMm, qty, glassId, extras, sizeError]);

  const canAdvance = (() => {
    if (step === S.PRODUCT) return !!productId;
    if (step === S.BRAND) return !!brandId;
    if (step === S.STYLE) return !!styleId;
    if (step === S.SIZE) return !sizeError;
    if (step === S.PRICE || step === S.SUMMARY) return !!price;
    return true;
  })();

  async function submit() {
    if (!style || !color) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/public-quote/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          config: { styleId: style.id, widthMm, heightMm, qty, colorId: color.id, glassId, extras },
          contact,
        }),
      });
      const json = (await res.json()) as { folio?: string; price?: Price; error?: string };
      if (!res.ok || !json.folio) {
        setSubmitError(json.error ?? "No pudimos enviar tu cotización.");
        return;
      }
      setFolio(json.folio);
      if (json.price) setPrice(json.price);
      setStep(S.DONE);
    } catch {
      setSubmitError("No pudimos enviar tu cotización. Revisa tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  const summaryLines = [
    `${style?.name ?? ""} · ${catalog.products.find((p) => p.id === productId)?.name ?? ""}`,
    `Línea ${brand?.name ?? ""}`,
    `${widthMm} × ${heightMm} mm · ${qty} ${qty === 1 ? "pieza" : "piezas"}`,
    `Color ${color?.name ?? ""}`,
    `Vidrio ${glass.name}`,
    extras.instalacion ? "Con instalación" : "Sin instalación",
    extras.persianaExterior ? "Con persiana exterior" : "",
    extras.mosquitero ? "Con mosquitero (lo cotiza tu asesor)" : "",
  ].filter(Boolean);

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    [
      folio ? `Cotización ${folio}` : "Cotización LUFT PVC",
      ...summaryLines,
      price ? `Total: ${money(price.total)}` : "",
      isEstimated ? `(${ESTIMATE_NOTE})` : "",
    ]
      .filter(Boolean)
      .join("\n")
  )}`;

  return (
    <div className="cotShell">
      <header className="cotTop">
        <span className="cotBrand">
          <span className="cotBrandMark">L</span> LUFT <b>PVC</b>
        </span>
        <span className="cotStepCount">
          {step + 1}/{STEPS.length}
        </span>
      </header>
      <div className="cotProgress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <main className="cotMain">
        {step === S.PRODUCT && (
          <Screen title="¿Qué necesitas?" hint="Elige una opción para empezar.">
            <div className="cotCards">
              {catalog.products.map((p) => (
                <button
                  key={p.id}
                  className={`cotCard ${productId === p.id ? "sel" : ""}`}
                  onClick={() => {
                    setProductId(p.id);
                    setStyleId("");
                    setStep(S.BRAND);
                  }}
                >
                  <b>{p.name}</b>
                  <small>{p.blurb}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.BRAND && (
          <Screen title="Elige la línea" hint="Las dos son PVC de importación. Cambia el acabado y el precio.">
            <div className="cotCards">
              {catalog.brands.map((b) => (
                <button
                  key={b.id}
                  className={`cotCard ${brandId === b.id ? "sel" : ""}`}
                  onClick={() => {
                    setBrandId(b.id);
                    setStyleId("");
                    // El color pertenece a la paleta de la marca: al cambiar de línea el
                    // anterior deja de existir, así que se reinicia al primero de la nueva.
                    setColorId(catalog.colors.find((c) => c.brandId === b.id)?.id ?? "");
                    setStep(S.STYLE);
                  }}
                >
                  <b>
                    {b.name}
                    {b.estimated && <i className="cotBadge">Precio estimado</i>}
                  </b>
                  <small>{b.blurb}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.STYLE && (
          <Screen title="Elige el estilo" hint="Así se abre tu ventana o puerta.">
            {brand?.estimated && <p className="cotNote">{ESTIMATE_NOTE}</p>}
            <div className="cotCards">
              {stylesForProduct.map((s) => (
                <button
                  key={s.id}
                  className={`cotCard cotCardStyle ${styleId === s.id ? "sel" : ""}`}
                  onClick={() => {
                    setStyleId(s.id);
                    setStep(S.SIZE);
                  }}
                >
                  <WindowPreview panels={s.panels} widthMm={3} heightMm={2} frameHex={frameHex} />
                  <b>{s.name}</b>
                  <small>{s.blurb}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.SIZE && (
          <Screen title="¿De qué medida?" hint="En milímetros. Si no estás seguro, un asesor lo verifica después.">
            <label className="cotField">
              Ancho (mm)
              <input type="number" inputMode="numeric" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value) || 0)} />
            </label>
            <label className="cotField">
              Alto (mm)
              <input type="number" inputMode="numeric" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value) || 0)} />
            </label>
            <div className="cotField">
              Cantidad
              <div className="cotStepper">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
                <b>{qty}</b>
                <button onClick={() => setQty((q) => Math.min(catalog.maxQty, q + 1))} aria-label="Más">+</button>
              </div>
            </div>
            {sizeError && <p className="cotWarn">{sizeError}</p>}
          </Screen>
        )}

        {step === S.COLOR && (
          <Screen title="Elige el color" hint="Color del marco, por dentro y por fuera.">
            <div className="cotSwatches">
              {colorsForBrand.map((c) => (
                <button key={c.id} className={`cotSwatch ${color?.id === c.id ? "sel" : ""}`} onClick={() => setColorId(c.id)}>
                  <span style={{ background: c.hex }} />
                  {c.name}
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.GLASS && (
          <Screen title="Elige el vidrio" hint="De más económico a mayor aislamiento.">
            <div className="cotCards">
              {catalog.glass.map((g) => (
                <button key={g.id} className={`cotCard ${glassId === g.id ? "sel" : ""}`} onClick={() => setGlassId(g.id)}>
                  <b>{g.name}</b>
                  <small>{g.benefit}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.EXTRAS && (
          <Screen title="¿Algo más?" hint="Puedes dejarlo como está y seguir.">
            <Toggle
              label="Instalación"
              detail="Nuestro equipo la instala en tu domicilio."
              on={extras.instalacion}
              onChange={(v) => setExtras((e) => ({ ...e, instalacion: v }))}
            />
            <Toggle
              label="Persiana exterior"
              detail="Da sombra y privacidad desde afuera."
              on={extras.persianaExterior}
              onChange={(v) => setExtras((e) => ({ ...e, persianaExterior: v }))}
            />
            <Toggle
              label="Mosquitero"
              detail="Lo cotiza tu asesor aparte; no se suma al total."
              on={extras.mosquitero}
              onChange={(v) => setExtras((e) => ({ ...e, mosquitero: v }))}
            />
          </Screen>
        )}

        {step === S.PRICE && (
          <Screen title="Tu precio" hint="Se actualiza solo si cambias algo.">
            <PriceBox price={price} pricing={pricing} error={priceError} qty={qty} />
          </Screen>
        )}

        {step === S.SUMMARY && (
          <Screen title="Resumen" hint="Revisa que todo esté bien.">
            <div className="cotDoc">
              <WindowPreview panels={style?.panels ?? 1} widthMm={widthMm} heightMm={heightMm} frameHex={frameHex} />
              <ul className="cotSummary">
                {summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <PriceBox price={price} pricing={pricing} error={priceError} qty={qty} />
            </div>
          </Screen>
        )}

        {step === S.PROCESS && (
          <Screen title="¿Qué sigue después de tu cotización?" hint="Así funciona, de principio a fin.">
            <ProcessSection
              deposit={
                price
                  ? { total: price.total, depositPercentage: price.depositPercentage, deposit: price.deposit, remaining: price.remaining }
                  : null
              }
            />
          </Screen>
        )}

        {step === S.CONTACT && (
          <Screen title="¿A dónde te enviamos tu cotización?" hint="Un asesor la revisa contigo.">
            <label className="cotField">
              Nombre
              <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" />
            </label>
            <label className="cotField">
              Teléfono
              <input type="tel" inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" />
            </label>
            <label className="cotField">
              Correo (opcional)
              <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
            </label>
            <label className="cotField">
              Ciudad
              <input value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} autoComplete="address-level2" />
            </label>
            {submitError && <p className="cotWarn">{submitError}</p>}
          </Screen>
        )}

        {step === S.DONE && (
          <Screen title="¡Listo!" hint={folio ? `Guardamos tu cotización con el folio ${folio}.` : ""}>
            <div className="cotDoc cotPrintable">
              <p className="cotFolio">{folio}</p>
              <WindowPreview panels={style?.panels ?? 1} widthMm={widthMm} heightMm={heightMm} frameHex={frameHex} />
              <ul className="cotSummary">
                {summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {price && (
                <p className="cotFinalTotal">
                  Total <b>{money(price.total)}</b>
                </p>
              )}
              {isEstimated && <p className="cotNote">{ESTIMATE_NOTE}</p>}
              <p className="cotFinePrint">
                Precio estimado con las medidas que capturaste. Un asesor confirma medidas en sitio antes de fabricar.
              </p>
            </div>
            {/* Recordatorio de en qué punto queda el cliente al terminar. currentIndex=1
                ("Revisión") porque acaba de crear la cotización y el siguiente paso real es
                que un asesor la revise. */}
            <div className="cotDoc procTimelineCard">
              <h3>¿Qué sigue?</h3>
              <GlassTimeline currentIndex={1} />
            </div>
            <div className="cotFinalActions">
              <button className="cotPrimary" onClick={() => window.print()}>
                Descargar / imprimir
              </button>
              <a className="cotSecondary" href={whatsappHref} target="_blank" rel="noopener noreferrer">
                Continuar por WhatsApp
              </a>
            </div>
            <p className="cotFinePrint">Un asesor te contacta para confirmar los detalles.</p>
          </Screen>
        )}
      </main>

      {step < S.DONE && (
        <footer className="cotFoot">
          {step > S.PRODUCT && (
            <button className="cotSecondary" onClick={() => setStep((s) => s - 1)}>
              Atrás
            </button>
          )}
          {price && step >= S.SIZE && step !== S.PRICE && step !== S.SUMMARY && (
            <span className="cotFootPrice">{pricing ? "Calculando…" : money(price.total)}</span>
          )}
          {step === S.CONTACT ? (
            <button className="cotPrimary" onClick={submit} disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar cotización"}
            </button>
          ) : (
            <button className="cotPrimary" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Continuar
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

function Screen({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="cotScreen">
      <h1>{title}</h1>
      {hint && <p className="cotHint">{hint}</p>}
      {children}
    </section>
  );
}

function Toggle({ label, detail, on, onChange }: { label: string; detail: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`cotToggle ${on ? "sel" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span>
        <b>{label}</b>
        <small>{detail}</small>
      </span>
      <i aria-hidden="true">{on ? "✓" : ""}</i>
    </button>
  );
}

function PriceBox({ price, pricing, error, qty }: { price: Price | null; pricing: boolean; error: string; qty: number }) {
  if (error) return <p className="cotWarn">{error}</p>;
  if (!price) return <p className="cotHint">{pricing ? "Calculando tu precio…" : "Completa los pasos anteriores para ver tu precio."}</p>;
  return (
    <>
      <div className="cotPriceBox">
        <span>{price.estimated ? "Total aproximado" : "Total"}{pricing ? " · actualizando…" : ""}</span>
        <strong>{money(price.total)}</strong>
        {qty > 1 && <small>{money(price.unit)} por pieza</small>}
        {price.hasQuoteOnRequestItems && <small>El mosquitero lo cotiza tu asesor aparte.</small>}
      </div>
      {price.estimated && <p className="cotNote">{ESTIMATE_NOTE}</p>}
    </>
  );
}
