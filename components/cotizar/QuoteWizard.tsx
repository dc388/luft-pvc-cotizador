"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/money";
import type { PublicCatalog } from "@/lib/publicCatalog";
import { PUBLIC_STEPS, S, publicStepName } from "@/lib/publicSteps";
import { ProcessSection } from "./ProcessSection";
import { GlassTimeline } from "./glass/GlassTimeline";
import { LiveQuotePreview } from "./LiveQuotePreview";
import { QuoteAssistant } from "./QuoteAssistant";
import type { PublicAssistantAction, PublicAssistantContext } from "./publicAssistant";
import { WindowPreview } from "./WindowPreview";
import { PublicQuoteDocument, type PublicQuotePrintableItem } from "./PublicQuoteDocument";
import { priceStatusLabel, sizeRejection, type PriceStatus } from "./priceStatus";

const WHATSAPP_NUMBER = "529932211158";
// Aviso de validación técnica, no de incertidumbre de precio: el número que ve el cliente
// siempre lo calcula el motor real. Se muestra solo en los sistemas cuyas tarifas todavía no
// vienen de la lista del proveedor (`sourced` en data/catalog.ts) y desaparece por sí solo
// cuando esa lista se carga.
const ADVISOR_CONFIRMS_NOTE = "Un asesor confirma esta línea antes de firmar.";

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
// La versión sube cada vez que los índices de paso cambian de significado: v2 al fusionar
// Instalación y Precio, v3 al eliminar la etapa de línea. Un borrador viejo restaurado sobre el
// índice nuevo dejaría al cliente en otra pantalla, así que se descarta en vez de traducirse.
const DRAFT_KEY = "luft-public-quote-draft-v3";
const DRAFT_VERSION = 3;

export function QuoteWizard({ catalog }: { catalog: PublicCatalog }) {
  const [step, setStep] = useState<number>(S.PRODUCT);
  const [productId, setProductId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [widthMm, setWidthMm] = useState(1500);
  const [heightMm, setHeightMm] = useState(1200);
  const [qty, setQty] = useState(1);
  const [colorId, setColorId] = useState("");
  const [glassId, setGlassId] = useState(catalog.glass[0].id);
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);

  // ¿Las medidas las dio el cliente, o son solo la medida de presentación del estilo? Sin esto
  // no se puede distinguir "todavía no hay datos para calcular" de "ya hay datos", y las
  // tarjetas mostrarían un precio construido sobre una medida que nadie pidió.
  const [sizeConfirmed, setSizeConfirmed] = useState(false);
  // Solo los resultados que llegaron del servidor, etiquetados con la firma de la configuración
  // que los produjo. Cuando la firma no coincide con la actual el precio está en camino, así que
  // un resultado viejo nunca se muestra junto a una medida nueva.
  const [styleQuotes, setStyleQuotes] = useState<{ sig: string; byStyle: Record<string, PriceStatus> }>({ sig: "", byStyle: {} });

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
  const [consentToContact, setConsentToContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [folio, setFolio] = useState("");
  const [draftReady, setDraftReady] = useState(false);

  const style = useMemo(() => catalog.styles.find((s) => s.id === styleId) ?? null, [catalog.styles, styleId]);
  const product = catalog.products.find((entry) => entry.id === productId) ?? null;
  // La perfilería no se pregunta. Es la del estilo elegido y, mientras no haya estilo, la única
  // línea del catálogo público. Antes vivía en un useState que el cliente tenía que llenar en una
  // pantalla propia; al ser un valor derivado ya no existe el estado "sin marca elegida".
  const brand = catalog.brands.find((entry) => entry.id === style?.brandId) ?? catalog.brands[0] ?? null;
  const brandId = brand?.id ?? "";
  const colorsForBrand = useMemo(() => catalog.colors.filter((c) => c.brandId === brandId), [catalog.colors, brandId]);
  const color = colorsForBrand.find((c) => c.id === colorId) ?? colorsForBrand[0] ?? null;
  const glass = catalog.glass.find((entry) => entry.id === glassId) ?? catalog.glass[0];
  const frameHex = color?.hex ?? "#f3f3ef";
  // Se filtra solo por producto: la línea ya no acota la lista. Si el catálogo público llegara a
  // ofrecer una segunda perfilería, sus estilos aparecerían aquí junto a los demás en vez de
  // quedarse invisibles esperando una pantalla de selección que ya no existe.
  const stylesForProduct = useMemo(
    () => catalog.styles.filter((s) => s.productId === productId),
    [catalog.styles, productId]
  );
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

  // Recupera únicamente la configuración no sensible de esta pestaña. Los precios guardados
  // nunca se reutilizan: el servidor vuelve a cotizar cada elemento antes de mostrarlo.
  useEffect(() => {
    let active = true;
    async function restoreDraft() {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw) as {
          version?: number;
          step?: number;
          productId?: string;
          styleId?: string;
          widthMm?: number;
          heightMm?: number;
          qty?: number;
          colorId?: string;
          glassId?: string;
          extras?: Extras;
          sizeConfirmed?: boolean;
          savedConfigs?: QuoteConfig[];
        };
        if (draft.version !== DRAFT_VERSION) return;
        if (draft.productId && catalog.products.some((entry) => entry.id === draft.productId)) setProductId(draft.productId);
        if (draft.styleId && catalog.styles.some((entry) => entry.id === draft.styleId)) setStyleId(draft.styleId);
        if (Number.isFinite(draft.widthMm)) setWidthMm(Number(draft.widthMm));
        if (Number.isFinite(draft.heightMm)) setHeightMm(Number(draft.heightMm));
        if (Number.isFinite(draft.qty)) setQty(Math.max(1, Math.min(catalog.maxQty, Number(draft.qty))));
        if (draft.colorId && catalog.colors.some((entry) => entry.id === draft.colorId)) setColorId(draft.colorId);
        if (draft.glassId && catalog.glass.some((entry) => entry.id === draft.glassId)) setGlassId(draft.glassId);
        if (draft.extras && typeof draft.extras.instalacion === "boolean") setExtras({ instalacion: draft.extras.instalacion });
        if (draft.sizeConfirmed === true) setSizeConfirmed(true);
        if (Number.isFinite(draft.step)) setStep(Math.max(S.PRODUCT, Math.min(S.SUMMARY, Number(draft.step))));

        const savedConfigs = Array.isArray(draft.savedConfigs) ? draft.savedConfigs.slice(0, 100) : [];
        if (savedConfigs.length) {
          const response = await fetch("/api/public-quote", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: savedConfigs }),
          });
          const payload = (await response.json()) as { itemPrices?: Price[] };
          if (active && response.ok && payload.itemPrices?.length === savedConfigs.length) {
            setSavedItems(savedConfigs.map((config, index) => ({ id: crypto.randomUUID(), config, price: payload.itemPrices![index] })));
          }
        }
      } catch {
        sessionStorage.removeItem(DRAFT_KEY);
      } finally {
        if (active) setDraftReady(true);
      }
    }
    void restoreDraft();
    return () => { active = false; };
  }, [catalog]);

  useEffect(() => {
    if (!draftReady || step === S.DONE) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        version: DRAFT_VERSION,
        step,
        productId,
        styleId,
        widthMm,
        heightMm,
        qty,
        colorId,
        glassId,
        extras,
        sizeConfirmed,
        savedConfigs: savedItems.map((item) => item.config),
      }));
    } catch {
      // La cotización continúa aunque el navegador deshabilite el almacenamiento de sesión.
    }
  }, [draftReady, step, productId, styleId, widthMm, heightMm, qty, colorId, glassId, extras, sizeConfirmed, savedItems]);

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

  // Precio real por tarjeta en la pantalla de estilo, SOLO cuando el cliente ya dio medidas
  // (por el formulario o por LUFT Asesor). Cotiza el lote con el mismo endpoint y el mismo
  // motor que el resto del flujo: la tarjeta no calcula nada por su cuenta. Sin medidas no se
  // pide precio, porque una puerta de 800 × 2100 no cuesta lo mismo que una de 1200 × 2600.
  const quoteSig = `${productId}|${widthMm}|${heightMm}|${qty}|${color?.id ?? ""}|${glassId}|${extras.instalacion}`;
  useEffect(() => {
    if (step !== S.STYLE || !sizeConfirmed || !color) return;

    // Los estilos que ya se sabe que no llegan a esa medida NO se mandan: el servidor rechaza el
    // lote completo al primer elemento inválido, así que uno fuera de rango dejaría sin precio a
    // todos los demás. Su motivo se resuelve al renderizar, en styleStatus().
    const priceable = stylesForProduct.filter((entry) => !sizeRejection(entry, widthMm, heightMm, catalog.minMm));
    if (priceable.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const allFailed = () => Object.fromEntries(priceable.map((entry) => [entry.id, { kind: "error" } as PriceStatus]));
      try {
        const res = await fetch("/api/public-quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: priceable.map((entry) => ({ styleId: entry.id, widthMm, heightMm, qty, colorId: color.id, glassId, extras })),
          }),
          signal: controller.signal,
        });
        const json = (await res.json()) as { itemPrices?: Price[] };
        if (!res.ok || json.itemPrices?.length !== priceable.length) {
          setStyleQuotes({ sig: quoteSig, byStyle: allFailed() });
          return;
        }
        setStyleQuotes({
          sig: quoteSig,
          byStyle: Object.fromEntries(priceable.map((entry, index) => [entry.id, { kind: "available", total: json.itemPrices![index].total } as PriceStatus])),
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setStyleQuotes({ sig: quoteSig, byStyle: allFailed() });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [step, sizeConfirmed, stylesForProduct, color, widthMm, heightMm, qty, glassId, extras, catalog.minMm, quoteSig]);

  /** Estado de precio de una tarjeta de estilo. Sin medidas del cliente no hay precio que
   *  mostrar: se muestra la acción para conseguirlo, nunca una cifra de relleno. */
  function styleStatus(styleEntry: PublicCatalog["styles"][number]): PriceStatus {
    if (!sizeConfirmed) return { kind: "missing-data" };
    const rejection = sizeRejection(styleEntry, widthMm, heightMm, catalog.minMm);
    if (rejection) return { kind: "error", reason: rejection };
    if (styleQuotes.sig !== quoteSig) return { kind: "calculating" };
    return styleQuotes.byStyle[styleEntry.id] ?? { kind: "calculating" };
  }

  const canAdvance = (() => {
    if (step === S.PRODUCT) return !!productId;
    if (step === S.STYLE) return !!styleId;
    if (step === S.SIZE) return !sizeError;
    if (step === S.CONFIRM) return !!price;
    if (step === S.SUMMARY) return reviewItems.length > 0 && !preparingProject;
    if (step === S.PROCESS) return !!projectPrice;
    return true;
  })();

  function resetCurrentItem() {
    requestId.current += 1;
    setProductId("");
    setStyleId("");
    setWidthMm(1500);
    setHeightMm(1200);
    setSizeConfirmed(false);
    setStyleQuotes({ sig: "", byStyle: {} });
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
        body: JSON.stringify({ items: lockedItems.map((item) => item.config), contact: { ...contact, consentToContact } }),
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
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      setSubmitError("No pudimos enviar tu cotización. Revisa tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    // Avanzar desde la pantalla de medidas es aceptar la medida que está en pantalla, aunque no
    // se haya escrito nada: desde aquí ya hay con qué cotizar y las tarjetas muestran precio.
    if (step === S.SIZE) setSizeConfirmed(true);
    setStep((current) => current + 1);
  }

  function handleBack() {
    if (step === S.SUMMARY && !currentItem && savedItems.length > 0) {
      setStep(S.PRODUCT);
      return;
    }
    setStep((current) => Math.max(S.PRODUCT, current - 1));
  }

  function applyAssistantAction(action: PublicAssistantAction) {
    // Cualquier cambio autorizado invalida los totales de proyecto bloqueados. El efecto de
    // cotización solicitará un precio nuevo; el asistente jamás escribe un total por su cuenta.
    setLockedItems([]);
    setProjectPrice(null);
    setProjectError("");
    if (action.kind === "dimensions") {
      setWidthMm(action.widthMm);
      setHeightMm(action.heightMm);
      setSizeConfirmed(true);
      return;
    }
    if (action.kind === "width") {
      setWidthMm(action.widthMm);
      setSizeConfirmed(true);
      return;
    }
    if (action.kind === "height") {
      setHeightMm(action.heightMm);
      setSizeConfirmed(true);
      return;
    }
    if (action.kind === "quantity") {
      setQty(Math.max(1, Math.min(catalog.maxQty, action.qty)));
      return;
    }
    if (action.kind === "product") {
      setProductId(action.productId);
      setStyleId("");
      setColorId("");
      setStep(S.STYLE);
      return;
    }
    if (action.kind === "style") {
      const nextStyle = catalog.styles.find((entry) => entry.id === action.styleId);
      if (!nextStyle) return;
      setProductId(nextStyle.productId);
      setStyleId(nextStyle.id);
      setColorId(catalog.colors.find((entry) => entry.brandId === nextStyle.brandId)?.id ?? "");
      // Esta acción trae la medida de presentación del estilo, no una medida del cliente: se
      // marca como no confirmada para que la interfaz siga pidiéndola en vez de cotizarla.
      setWidthMm(nextStyle.defaultW);
      setHeightMm(nextStyle.defaultH);
      setSizeConfirmed(false);
      setStep(S.SIZE);
      return;
    }
    if (action.kind === "configure") {
      const nextStyle = catalog.styles.find((entry) => entry.id === action.styleId);
      if (!nextStyle) return;
      setProductId(nextStyle.productId);
      setStyleId(nextStyle.id);
      const brandColors = catalog.colors.filter((entry) => entry.brandId === nextStyle.brandId);
      const wanted = action.colorId ? brandColors.find((entry) => entry.id === action.colorId) : undefined;
      setColorId((wanted ?? brandColors[0])?.id ?? "");
      // Se conservan las medidas del cliente en vez de las del estilo: ya vienen validadas
      // contra los límites de ESE estilo en lib/briefMatch.ts.
      setWidthMm(action.widthMm);
      setHeightMm(action.heightMm);
      setSizeConfirmed(true);
      setStep(S.SIZE);
      return;
    }
    if (action.kind === "color") {
      if (catalog.colors.some((entry) => entry.id === action.colorId && entry.brandId === brandId)) setColorId(action.colorId);
      return;
    }
    if (action.kind === "glass") {
      if (catalog.glass.some((entry) => entry.id === action.glassId)) setGlassId(action.glassId);
      return;
    }
    setExtras({ instalacion: action.value });
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
      isEstimated ? `(${ADVISOR_CONFIRMS_NOTE})` : "",
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
  const assistantItems = (step >= S.PROCESS ? doneItems : reviewItems).map((item) => ({
    styleId: item.config.styleId,
    widthMm: item.config.widthMm,
    heightMm: item.config.heightMm,
    qty: item.config.qty,
    colorId: item.config.colorId,
    glassId: item.config.glassId,
    installation: item.config.extras.instalacion,
  }));
  const assistantContext: PublicAssistantContext = {
    step,
    stepName: publicStepName(step),
    productId,
    brandId,
    styleId,
    colorId: color?.id ?? "",
    glassId,
    productName: product?.name ?? "",
    brandName: brand?.name ?? "",
    styleName: style?.name ?? "",
    widthMm,
    heightMm,
    qty,
    colorName: color?.name ?? "",
    glassName: glass?.name ?? "",
    installation: extras.instalacion,
    sizeError,
    total: footPrice?.total ?? (reviewTotal || null),
    estimated: footPrice?.estimated ?? isEstimated,
    designCount: reviewItems.length,
    folio,
    minMm: catalog.minMm,
    styleMaxW: style?.maxW ?? null,
    styleMaxH: style?.maxH ?? null,
    stylePanels: style?.panels ?? 1,
    catalog,
    projectItems: assistantItems,
  };
  const livePreview = style && color && step >= S.SIZE && step <= S.CONFIRM ? (
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
          {step + 1}/{PUBLIC_STEPS.length}
        </span>
      </header>
      <div className="cotProgress" aria-hidden="true"><span style={{ width: `${((step + 1) / PUBLIC_STEPS.length) * 100}%` }} /></div>

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
                  setStyleId("");
                  setColorId("");
                  setStep(S.STYLE);
                }}>
                  <b>{p.name}</b><small>{p.blurb}</small>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === S.STYLE && (
          <Screen
            title="Elige el estilo"
            hint={sizeConfirmed
              ? `Precios para ${widthMm.toLocaleString("es-MX")} × ${heightMm.toLocaleString("es-MX")} mm en ${color?.name?.toLowerCase() ?? "el color elegido"}.`
              : "Cada elemento de tu proyecto puede tener un estilo distinto."}
          >
            {brand && <SystemNote name={brand.name} />}
            <div className="cotCards">
              {stylesForProduct.map((s) => {
                const status = styleStatus(s);
                return (
                  <button key={s.id} className={`cotCard cotCardStyle ${styleId === s.id ? "sel" : ""}`} onClick={() => {
                    setStyleId(s.id);
                    // Las medidas del cliente manda sobre la medida de presentación del estilo.
                    if (!sizeConfirmed) {
                      setWidthMm(s.defaultW);
                      setHeightMm(s.defaultH);
                    }
                    setStep(S.SIZE);
                  }}>
                    <WindowPreview
                      wings={s.wings}
                      widthMm={sizeConfirmed ? widthMm : s.defaultW}
                      heightMm={sizeConfirmed ? heightMm : s.defaultH}
                      frameHex={frameHex}
                      label={`Vista previa de ${s.name}`}
                    />
                    <span className="cotCardBody">
                      <b>{s.name}</b>
                      {/* El sistema ya no se repite por tarjeta: con una sola perfilería, decirlo
                          en las siete tarjetas de la pantalla era ruido. Va una vez arriba. */}
                      <small>{s.blurb}</small>
                      <span className={`cotCardPrice ${status.kind === "available" ? "isPrice" : ""}`}>{priceStatusLabel(status)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Screen>
        )}

        {step === S.SIZE && (
          <Screen title="¿De qué medida?" hint="En milímetros. Si no estás seguro, un asesor lo verifica después.">
            {livePreview}
            <label className="cotField">Ancho (mm)<input type="number" inputMode="numeric" value={widthMm} onChange={(e) => { setWidthMm(Number(e.target.value) || 0); setSizeConfirmed(true); }} /></label>
            <label className="cotField">Alto (mm)<input type="number" inputMode="numeric" value={heightMm} onChange={(e) => { setHeightMm(Number(e.target.value) || 0); setSizeConfirmed(true); }} /></label>
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

        {step === S.CONFIRM && (
          // Diseño, instalación y total en una sola pantalla: el cliente no tiene que avanzar
          // para descubrir el precio, y cambiar la instalación lo actualiza aquí mismo.
          <Screen className="cotScreenConfirm" title="Tu diseño y tu precio" hint="Confirma la instalación y revisa el total. Se actualiza solo si cambias algo.">
            {livePreview}
            <Toggle label="Instalación" detail="Nuestro equipo la instala en tu domicilio." on={extras.instalacion} onChange={(value) => setExtras((current) => ({ ...current, instalacion: value }))} />
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
            <label className="cotToggle" style={{ cursor: "pointer" }}>
              <span><b>Autorizo el seguimiento</b><small>LUFT PVC puede contactarme únicamente para continuar con esta cotización.</small></span>
              <input type="checkbox" checked={consentToContact} onChange={(event) => setConsentToContact(event.target.checked)} aria-label="Autorizar contacto de LUFT PVC" />
            </label>
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
              {isEstimated && <p className="cotNote">{ADVISOR_CONFIRMS_NOTE}</p>}
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

      <QuoteAssistant context={assistantContext} onApply={applyAssistantAction} supportHref={whatsappHref} humanAvailable={step === S.DONE} />

      {step < S.DONE && (
        <footer className="cotFoot">
          {step > S.PRODUCT && <button className="cotSecondary" onClick={handleBack}>Atrás</button>}
          {/* En CONFIRM el total ya está en la tarjeta: repetirlo en la barra lo duplicaría. */}
          {footPrice && step >= S.SIZE && step !== S.CONFIRM && step !== S.SUMMARY && (
            <span className="cotFootPrice">{pricing ? "Calculando…" : money(footPrice.total)}</span>
          )}
          {step === S.CONTACT ? (
            <button className="cotPrimary" onClick={submit} disabled={submitting || !consentToContact}>{submitting ? "Enviando…" : "Enviar proyecto"}</button>
          ) : step === S.SUMMARY ? (
            <button className="cotPrimary" onClick={prepareProject} disabled={!canAdvance}>{preparingProject ? "Calculando…" : "Continuar"}</button>
          ) : (
            <button className="cotPrimary" onClick={handleNext} disabled={!canAdvance}>Continuar</button>
          )}
        </footer>
      )}
    </div>
  );
}

function Screen({ title, hint, className, children }: { title: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <section className={`cotScreen ${className ?? ""}`.trim()}><h1>{title}</h1>{hint && <p className="cotHint">{hint}</p>}{children}</section>;
}

// La perfilería como característica del producto, no como opción. Es deliberadamente un párrafo
// y no un botón: no recibe foco, no tiene estado "seleccionado" y no responde al clic, para que
// nadie crea que hay una decisión pendiente donde solo hay información.
function SystemNote({ name }: { name: string }) {
  return (
    <p className="cotSystemNote">
      <i aria-hidden="true">✓</i>
      <span><b>Perfilería {name}</b><small>Sistema alemán de PVC. Toda nuestra cancelería se fabrica con estos perfiles.</small></span>
    </p>
  );
}

function Toggle({ label, detail, on, onChange }: { label: string; detail: string; on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`cotToggle ${on ? "sel" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span><b>{label}</b><small>{detail}</small></span><i aria-hidden="true">{on ? "✓" : ""}</i>
    </button>
  );
}

function PriceBox({ price, pricing, error, qty }: { price: Price | null; pricing: boolean; error: string; qty: number }) {
  // Un fallo de cálculo se dice, no se rellena con una cifra aproximada.
  if (error) return <p className="cotWarn">{error}</p>;
  if (!price) return <p className="cotHint">{pricing ? "Calculando tu precio…" : "Completa los pasos anteriores para ver tu precio."}</p>;
  return (
    <>
      <div className="cotPriceBox">
        <span>Total{pricing ? " · actualizando…" : ""}</span>
        <strong>{money(price.total)}</strong>
        {qty > 1 && <small>{money(price.unit)} por pieza</small>}
      </div>
      {price.estimated && <p className="cotNote">{ADVISOR_CONFIRMS_NOTE}</p>}
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
