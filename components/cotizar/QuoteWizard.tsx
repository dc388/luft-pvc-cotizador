"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/money";
import type { PublicCatalog } from "@/lib/publicCatalog";
import { ProcessSection } from "./ProcessSection";
import { GlassTimeline } from "./glass/GlassTimeline";
import { LiveQuotePreview } from "./LiveQuotePreview";
import { QuoteAssistant } from "./QuoteAssistant";
import { WindowPreview } from "./WindowPreview";
import { PublicQuoteDocument, type PublicQuotePrintableItem } from "./PublicQuoteDocument";

const WHATSAPP_NUMBER = "529932211158";
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
type Extras = { instalacion: boolean };
type QuoteConfig = {
  styleId: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  colorId: string;
  glassId: string;
  extras: Extras;
};
type ProjectItem = { id: string; config: QuoteConfig; price: Price };
type ItemDetails = {
  productName: string;
  styleName: string;
  brandName: string;
  panels: number;
  wings: PublicCatalog["styles"][number]["wings"];
  colorName: string;
  frameHex: string;
  glassName: string;
};

const DEFAULT_EXTRAS: Extras = { instalacion: true };
const STEPS = ["Producto", "Línea", "Estilo", "Medidas", "Color", "Vidrio", "Instalación", "Precio", "Resumen", "Proceso", "Contacto", "Listo"];
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
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);

  const [quotedPrice, setQuotedPrice] = useState<Price | null>(null);
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [savedItems, setSavedItems] = useState<ProjectItem[]>([]);
  const [lockedItems, setLockedItems] = useState<ProjectItem[]>([]);
  const [finalItems, setFinalItems] = useState<ProjectItem[]>([]);
  const [projectPrice, setProjectPrice] = useState<Price | null>(null);
  const [preparingProject, setPreparingProject] = useState(false);
  const [projectError, setProjectError] = useState("");

  const [contact, setContact] = useState({ name: "", phone: "", email: "", city: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [folio, setFolio] = useState("");

  const style = useMemo(() => catalog.styles.find((s) => s.id === styleId) ?? null, [catalog.styles, styleId]);
  const colorsForBrand = useMemo(() => catalog.colors.filter((c) => c.brandId === brandId), [catalog.colors, brandId]);
  const color = colorsForBrand.find((c) => c.id === colorId) ?? colorsForBrand[0] ?? null;
  const glass = catalog.glass.find((entry) => entry.id === glassId) ?? catalog.glass[0];
  const frameHex = color?.hex ?? "#f3f3ef";
  const stylesForProduct = catalog.styles.filter((s) => s.productId === productId && s.brandId === brandId);
  const sizeError = useMemo(() => {
    if (!style) return "";
    if (widthMm < catalog.minMm || heightMm < catalog.minMm) return `La medida mínima es de ${catalog.minMm} mm por lado.`;
    if (widthMm > style.maxW || heightMm > style.maxH) return `Este estilo se fabrica hasta ${style.maxW} × ${style.maxH} mm.`;
    if (widthMm / style.panels < catalog.minMm) return `Con ${style.panels} hojas, el ancho mínimo es de ${catalog.minMm * style.panels} mm.`;
    return "";
  }, [style, widthMm, heightMm, catalog.minMm]);

  const price = style && color && !sizeError ? quotedPrice : null;
  const currentConfig: QuoteConfig | null = style && color ? {
    styleId: style.id,
    widthMm,
    heightMm,
    qty,
    colorId: color.id,
    glassId,
    extras,
  } : null;
  const currentItem: ProjectItem | null = price && currentConfig ? { id: "current", config: currentConfig, price } : null;
  const reviewItems = currentItem ? [...savedItems, currentItem] : savedItems;
  const doneItems = finalItems.length ? finalItems : lockedItems;
  const reviewTotal = reviewItems.reduce((sum, item) => sum + item.price.total, 0);
  const totalPieces = reviewItems.reduce((sum, item) => sum + item.config.qty, 0);
  const isEstimated = projectPrice?.estimated ?? reviewItems.some((item) => item.price.estimated);
  const headerItemCount = step >= S.PROCESS ? (doneItems.length || lockedItems.length) : reviewItems.length;

  function detailsFor(item: ProjectItem): ItemDetails {
    const itemStyle = catalog.styles.find((entry) => entry.id === item.config.styleId);
    const itemProduct = catalog.products.find((entry) => entry.id === itemStyle?.productId);
    const itemBrand = catalog.brands.find((entry) => entry.id === itemStyle?.brandId);
    const itemColor = catalog.colors.find((entry) => entry.id === item.config.colorId && entry.brandId === itemStyle?.brandId);
    const itemGlass = catalog.glass.find((entry) => entry.id === item.config.glassId);
    return {
      productName: itemProduct?.name ?? "Ventana",
      styleName: itemStyle?.name ?? "Configuración",
      brandName: itemBrand?.name ?? "",
      panels: itemStyle?.panels ?? 1,
      wings: itemStyle?.wings ?? ["fixed"],
      colorName: itemColor?.name ?? "",
      frameHex: itemColor?.hex ?? "#f3f3ef",
      glassName: itemGlass?.name ?? "",
    };
  }

  const requestId = useRef(0);
  useEffect(() => {
    if (!style || !color || sizeError) return;
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
          setQuotedPrice(null);
          setPriceError(json.error ?? "No pudimos calcular el precio.");
        } else {
          setQuotedPrice(json.price);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (id !== requestId.current) return;
        setQuotedPrice(null);
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
    if (step === S.PRICE) return !!price;
    if (step === S.SUMMARY) return reviewItems.length > 0 && !preparingProject;
    if (step === S.PROCESS) return !!projectPrice;
    return true;
  })();

  function resetCurrentItem() {
    requestId.current += 1;
    setProductId("");
    setBrandId("");
    setStyleId("");
    setWidthMm(1500);
    setHeightMm(1200);
    setQty(1);
    setColorId("");
    setGlassId(catalog.glass[0].id);
    setExtras(DEFAULT_EXTRAS);
    setQuotedPrice(null);
    setPriceError("");
  }

  function addAnotherItem() {
    if (currentItem) {
      setSavedItems((items) => [...items, { ...currentItem, id: crypto.randomUUID() }]);
    }
    setLockedItems([]);
    setProjectPrice(null);
    setProjectError("");
    resetCurrentItem();
    setStep(S.PRODUCT);
  }

  function removeSavedItem(id: string) {
    setSavedItems((items) => items.filter((item) => item.id !== id));
    setLockedItems([]);
    setProjectPrice(null);
    setProjectError("");
  }

  async function prepareProject() {
    if (reviewItems.length === 0) return;
    setPreparingProject(true);
    setProjectError("");
    try {
      const res = await fetch("/api/public-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: reviewItems.map((item) => item.config) }),
      });
      const json = (await res.json()) as { price?: Price; itemPrices?: Price[]; error?: string };
      if (!res.ok || !json.price || !json.itemPrices || json.itemPrices.length !== reviewItems.length) {
        setProjectError(json.error ?? "No pudimos calcular el total del proyecto.");
        return;
      }
      setLockedItems(reviewItems.map((item, index) => ({ ...item, price: json.itemPrices![index] })));
      setProjectPrice(json.price);
      setStep(S.PROCESS);
    } catch {
      setProjectError("No pudimos calcular el proyecto. Revisa tu conexión.");
    } finally {
      setPreparingProject(false);
    }
  }

  async function submit() {
    if (lockedItems.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/public-quote/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lockedItems.map((item) => item.config), contact }),
      });
      const json = (await res.json()) as { folio?: string; price?: Price; itemPrices?: Price[]; error?: string };
      if (!res.ok || !json.folio || !json.price) {
        setSubmitError(json.error ?? "No pudimos enviar tu cotización.");
        return;
      }
      const authoritativeItems = json.itemPrices?.length === lockedItems.length
        ? lockedItems.map((item, index) => ({ ...item, price: json.itemPrices![index] }))
        : lockedItems;
      setFolio(json.folio);
      setProjectPrice(json.price);
      setFinalItems(authoritativeItems);
      setStep(S.DONE);
    } catch {
      setSubmitError("No pudimos enviar tu cotización. Revisa tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (step === S.SUMMARY && !currentItem && savedItems.length > 0) {
      setStep(S.PRODUCT);
      return;
    }
    setStep((current) => Math.max(S.PRODUCT, current - 1));
  }

  const whatsappLines = doneItems.flatMap((item, index) => {
    const details = detailsFor(item);
    return [`${index + 1}. ${details.styleName} · ${item.config.widthMm} × ${item.config.heightMm} mm · ${item.config.qty} ${item.config.qty === 1 ? "pieza" : "piezas"}`];
  });
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    [
      folio ? `Cotización ${folio}` : "Cotización LUFT PVC",
      ...whatsappLines,
      projectPrice ? `Total del proyecto: ${money(projectPrice.total)}` : "",
      isEstimated ? `(${ESTIMATE_NOTE})` : "",
    ].filter(Boolean).join("\n")
  )}`;
  const printableItems: PublicQuotePrintableItem[] = doneItems.map((item) => {
    const details = detailsFor(item);
    return {
      id: item.id,
      ...details,
      widthMm: item.config.widthMm,
      heightMm: item.config.heightMm,
      quantity: item.config.qty,
      extras: item.config.extras,
      price: item.price,
    };
  });
  const footPrice = step >= S.PROCESS ? projectPrice : price;
  const livePreview = style && color && step >= S.SIZE && step <= S.PRICE ? (
    <LiveQuotePreview
      styleName={style.name}
      wings={style.wings}
      widthMm={widthMm}
      heightMm={heightMm}
      qty={qty}
      frameHex={frameHex}
      colorName={color.name}
      glassName={glass?.name ?? "Vidrio por elegir"}
    />
  ) : null;

  return (
    <div className="cotShell">
      <header className="cotTop">
        <span className="cotBrand"><span className="cotBrandMark">L</span> LUFT <b>PVC</b></span>
        <span className="cotStepCount">
          {headerItemCount > 0 && <b>{headerItemCount} {headerItemCount === 1 ? "diseño" : "diseños"} · </b>}
          {step + 1}/{STEPS.length}
        </span>
      </header>
      <div className="cotProgress" aria-hidden="true"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

      <main className="cotMain">
        {step === S.PRODUCT && (
          <Screen title="¿Qué necesitas?" hint="Elige una opción para empezar.">
            {savedItems.length > 0 && (
              <ProjectBar items={savedItems} total={savedItems.reduce((sum, item) => sum + item.price.total, 0)} onReview={() => setStep(S.SUMMARY)} />
            )}
            <div className="cotCards">
              {catalog.products.map((p) => (
                <button key={p.id} className={`cotCard ${productId === p.id ? "sel" : ""}`} onClick={() => {
                  setProductId(p.id);
                  setBrandId("");
                  setStyleId("");
                  setColorId("");
                  setStep(S.BRAND);
                }}>
                  <b>{p.name}</b><small>{p.blurb}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.BRAND && (
          <Screen title="Elige la línea" hint="PVC de importación con precio respaldado por el catálogo vigente.">
            <div className="cotCards">
              {catalog.brands.map((b) => (
                <button key={b.id} className={`cotCard ${brandId === b.id ? "sel" : ""}`} onClick={() => {
                  setBrandId(b.id);
                  setStyleId("");
                  setColorId(catalog.colors.find((c) => c.brandId === b.id)?.id ?? "");
                  setStep(S.STYLE);
                }}>
                  <b>{b.name}{b.estimated && <i className="cotBadge">Precio estimado</i>}</b>
                  <small>{b.blurb}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.STYLE && (
          <Screen title="Elige el estilo" hint="Cada elemento de tu proyecto puede tener un estilo distinto.">
            <div className="cotCards">
              {stylesForProduct.map((s) => (
                <button key={s.id} className={`cotCard cotCardStyle ${styleId === s.id ? "sel" : ""}`} onClick={() => {
                  setStyleId(s.id);
                  setWidthMm(s.defaultW);
                  setHeightMm(s.defaultH);
                  setStep(S.SIZE);
                }}>
                  <WindowPreview wings={s.wings} widthMm={s.defaultW} heightMm={s.defaultH} frameHex={frameHex} label={`Vista previa de ${s.name}`} />
                  <b>{s.name}{s.estimated && <i className="cotBadge">Precio estimado</i>}</b><small>{s.blurb}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.SIZE && (
          <Screen title="¿De qué medida?" hint="En milímetros. Si no estás seguro, un asesor lo verifica después.">
            {livePreview}
            <label className="cotField">Ancho (mm)<input type="number" inputMode="numeric" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value) || 0)} /></label>
            <label className="cotField">Alto (mm)<input type="number" inputMode="numeric" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value) || 0)} /></label>
            <div className="cotField">Cantidad<div className="cotStepper">
              <button onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Menos">−</button>
              <b>{qty}</b>
              <button onClick={() => setQty((value) => Math.min(catalog.maxQty, value + 1))} aria-label="Más">+</button>
            </div></div>
            {sizeError && <p className="cotWarn">{sizeError}</p>}
          </Screen>
        )}

        {step === S.COLOR && (
          <Screen title="Elige el color" hint="Color del marco, por dentro y por fuera.">
            {livePreview}
            <div className="cotSwatches">
              {colorsForBrand.map((entry) => (
                <button key={entry.id} className={`cotSwatch ${color?.id === entry.id ? "sel" : ""}`} onClick={() => setColorId(entry.id)}>
                  <span style={{ background: entry.hex }} />{entry.name}
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.GLASS && (
          <Screen title="Elige el vidrio" hint="De más económico a mayor aislamiento.">
            {livePreview}
            <div className="cotCards">
              {catalog.glass.map((entry) => (
                <button key={entry.id} className={`cotCard ${glassId === entry.id ? "sel" : ""}`} onClick={() => setGlassId(entry.id)}>
                  <b>{entry.name}</b><small>{entry.benefit}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.EXTRAS && (
          <Screen title="¿Incluimos la instalación?" hint="Elige si deseas que nuestro equipo instale tu proyecto.">
            {livePreview}
            <Toggle label="Instalación" detail="Nuestro equipo la instala en tu domicilio." on={extras.instalacion} onChange={(value) => setExtras((current) => ({ ...current, instalacion: value }))} />
          </Screen>
        )}

        {step === S.PRICE && (
          <Screen title="Tu precio" hint="Se actualiza solo si cambias algo.">
            {livePreview}
            <PriceBox price={price} pricing={pricing} error={priceError} qty={qty} />
          </Screen>
        )}

        {step === S.SUMMARY && (
          <Screen title="Tu proyecto" hint="Revisa tus diseños o agrega otra ventana antes de continuar.">
            <div className="cotProjectList">
              {reviewItems.map((item, index) => (
                <ProjectItemCard key={item.id} index={index} item={item} details={detailsFor(item)} current={item.id === "current"} onRemove={item.id === "current" ? undefined : () => removeSavedItem(item.id)} />
              ))}
            </div>
            {reviewItems.length > 0 && (
              <div className="cotProjectTotal"><span>{reviewItems.length} {reviewItems.length === 1 ? "diseño" : "diseños"} · {totalPieces} {totalPieces === 1 ? "pieza" : "piezas"}</span><b>{money(reviewTotal)}</b></div>
            )}
            <button className="cotAddAnother" onClick={addAnotherItem}>
              <i aria-hidden="true">＋</i><span><b>Agregar otra ventana</b><small>Puede tener otro estilo, medida, color y vidrio.</small></span>
            </button>
            {projectError && <p className="cotWarn">{projectError}</p>}
          </Screen>
        )}

        {step === S.PROCESS && (
          <Screen title="¿Qué sigue después de tu cotización?" hint={`Tu proyecto reúne ${lockedItems.length} ${lockedItems.length === 1 ? "configuración" : "configuraciones"}.`}>
            <ProcessSection deposit={projectPrice ? { total: projectPrice.total, depositPercentage: projectPrice.depositPercentage, deposit: projectPrice.deposit, remaining: projectPrice.remaining } : null} />
          </Screen>
        )}

        {step === S.CONTACT && (
          <Screen title="¿A dónde te enviamos tu cotización?" hint="Un asesor revisa todo tu proyecto contigo.">
            <label className="cotField">Nombre<input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" /></label>
            <label className="cotField">Teléfono<input type="tel" inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" /></label>
            <label className="cotField">Correo (opcional)<input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" /></label>
            <label className="cotField">Ciudad<input value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} autoComplete="address-level2" /></label>
            {submitError && <p className="cotWarn">{submitError}</p>}
          </Screen>
        )}

        {step === S.DONE && (
          <Screen title="¡Listo!" hint={folio ? `Guardamos todo tu proyecto con el folio ${folio}.` : ""}>
            <div className="cotDoc cotPrintable">
              <p className="cotFolio">{folio}</p>
              <div className="cotProjectList cotProjectListCompact">
                {doneItems.map((item, index) => <ProjectItemCard key={item.id} index={index} item={item} details={detailsFor(item)} />)}
              </div>
              {projectPrice && <p className="cotFinalTotal">Total del proyecto <b>{money(projectPrice.total)}</b></p>}
              {isEstimated && <p className="cotNote">{ESTIMATE_NOTE}</p>}
              <p className="cotFinePrint">Tu cotización ya se agregó como proyecto en LUFT PVC. El precio sigue siendo preliminar hasta que un asesor confirme las medidas en sitio.</p>
            </div>
            <div className="cotDoc procTimelineCard"><h3>¿Qué sigue?</h3><GlassTimeline currentIndex={1} /></div>
            {projectPrice && printableItems.length > 0 && (
              <div className="quotePrintOnly">
                <PublicQuoteDocument folio={folio} client={{ name: contact.name, city: contact.city }} items={printableItems} price={projectPrice} />
              </div>
            )}
            <div className="cotFinalActions">
              <button className="cotPrimary" onClick={() => window.print()}>Descargar / imprimir</button>
              <a className="cotSecondary" href={whatsappHref} target="_blank" rel="noopener noreferrer">Continuar por WhatsApp</a>
            </div>
            <p className="cotFinePrint">Un asesor te contacta para confirmar todos los detalles.</p>
          </Screen>
        )}
      </main>

      <QuoteAssistant step={step} supportHref={whatsappHref} />

      {step < S.DONE && (
        <footer className="cotFoot">
          {step > S.PRODUCT && <button className="cotSecondary" onClick={handleBack}>Atrás</button>}
          {footPrice && step >= S.SIZE && step !== S.PRICE && step !== S.SUMMARY && (
            <span className="cotFootPrice">{pricing ? "Calculando…" : money(footPrice.total)}</span>
          )}
          {step === S.CONTACT ? (
            <button className="cotPrimary" onClick={submit} disabled={submitting}>{submitting ? "Enviando…" : "Enviar proyecto"}</button>
          ) : step === S.SUMMARY ? (
            <button className="cotPrimary" onClick={prepareProject} disabled={!canAdvance}>{preparingProject ? "Calculando…" : "Continuar"}</button>
          ) : (
            <button className="cotPrimary" onClick={() => setStep((current) => current + 1)} disabled={!canAdvance}>Continuar</button>
          )}
        </footer>
      )}
    </div>
  );
}

function Screen({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="cotScreen"><h1>{title}</h1>{hint && <p className="cotHint">{hint}</p>}{children}</section>;
}

function Toggle({ label, detail, on, onChange }: { label: string; detail: string; on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`cotToggle ${on ? "sel" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span><b>{label}</b><small>{detail}</small></span><i aria-hidden="true">{on ? "✓" : ""}</i>
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
      </div>
      {price.estimated && <p className="cotNote">{ESTIMATE_NOTE}</p>}
    </>
  );
}

function ProjectBar({ items, total, onReview }: { items: ProjectItem[]; total: number; onReview: () => void }) {
  const pieces = items.reduce((sum, item) => sum + item.config.qty, 0);
  return (
    <div className="cotProjectBar">
      <span><b>Tu proyecto</b><small>{items.length} {items.length === 1 ? "diseño" : "diseños"} · {pieces} {pieces === 1 ? "pieza" : "piezas"} · {money(total)}</small></span>
      <button onClick={onReview}>Revisar</button>
    </div>
  );
}

function ProjectItemCard({ index, item, details, current, onRemove }: { index: number; item: ProjectItem; details: ItemDetails; current?: boolean; onRemove?: () => void }) {
  return (
    <article className={`cotProjectItem ${current ? "isCurrent" : ""}`}>
      <div className="cotProjectItemVisual"><WindowPreview wings={details.wings} widthMm={item.config.widthMm} heightMm={item.config.heightMm} frameHex={details.frameHex} glassName={details.glassName} label={`Vista previa de ${details.styleName}`} /></div>
      <div className="cotProjectItemBody">
        <div className="cotProjectItemHead">
          <span><small>{current ? "Diseño actual" : `Diseño ${index + 1}`}</small><b>{details.styleName}</b></span>
          {onRemove && <button onClick={onRemove} aria-label={`Eliminar ${details.styleName}`}>Eliminar</button>}
        </div>
        <p>{item.config.widthMm.toLocaleString("es-MX")} × {item.config.heightMm.toLocaleString("es-MX")} mm · {item.config.qty} {item.config.qty === 1 ? "pieza" : "piezas"}</p>
        <p>{details.colorName} · {details.glassName}</p>
        <strong>{money(item.price.total)}</strong>
      </div>
    </article>
  );
}
