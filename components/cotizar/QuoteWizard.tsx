"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicCatalog } from "@/lib/publicCatalog";
import { trackPublicFunnel } from "@/lib/publicFunnel";
import { PUBLIC_STEPS, S, publicStepName } from "@/lib/publicSteps";
import { ProcessSection } from "./ProcessSection";
import { GlassTimeline } from "./glass/GlassTimeline";
import { LiveQuotePreview } from "./LiveQuotePreview";
import { QuoteAssistant } from "./QuoteAssistant";
import type { PublicAssistantAction, PublicAssistantContext } from "./publicAssistant";
import { WindowPreview } from "./WindowPreview";
import { availabilityLabel, sizeRejection, type AvailabilityStatus } from "./availability";
import { newId } from "@/lib/uuid";

const WHATSAPP_NUMBER = "529932211158";

// NINGÚN IMPORTE EN ESTE ARCHIVO.
//
// El cliente configura su proyecto sin ver precios: ni por pieza, ni por m², ni subtotales, ni
// totales, ni anticipos, ni rangos, ni "desde". El motor sigue calculando en el servidor, pero lo
// único que cruza al navegador durante la configuración es si una opción se puede fabricar con la
// medida que dio (ver /api/public-quote y components/cotizar/availability.ts).
//
// El precio aparece por primera y única vez dentro del documento definitivo, que se genera al
// registrar la cotización y se sirve renderizado en el servidor: /cotizacion/<token>.
//
// Si vuelves a necesitar un importe aquí, no lo pidas al servidor: es señal de que la decisión de
// producto cambió, y el lugar de esa cifra sigue siendo el documento.

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
type ProjectItem = { id: string; config: QuoteConfig };
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
type Contact = {
  name: string;
  phone: string;
  email: string;
  company: string;
  projectName: string;
  city: string;
  postalCode: string;
  address: string;
  notes: string;
};

const DEFAULT_EXTRAS: Extras = { instalacion: true };
const EMPTY_CONTACT: Contact = { name: "", phone: "", email: "", company: "", projectName: "", city: "", postalCode: "", address: "", notes: "" };
// La versión sube cada vez que los índices de paso o la forma del borrador cambian de significado:
// v2 al fusionar Instalación y Precio, v3 al eliminar la etapa de línea, v4 al dejar de guardar
// precios y empezar a guardar los datos del cliente entre recargas. Un borrador viejo restaurado
// sobre la forma nueva dejaría al cliente en otra pantalla, así que se descarta en vez de traducirse.
const DRAFT_KEY = "luft-public-quote-draft-v4";
const DRAFT_VERSION = 4;

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
  // no se puede distinguir "todavía no hay datos" de "ya hay datos", y las tarjetas afirmarían
  // disponibilidad sobre una medida que nadie pidió.
  const [sizeConfirmed, setSizeConfirmed] = useState(false);
  // Disponibilidad por estilo, etiquetada con la firma de la configuración que la produjo. Cuando
  // la firma no coincide con la actual la respuesta está en camino, así que un resultado viejo
  // nunca se muestra junto a una medida nueva.
  const [styleChecks, setStyleChecks] = useState<{ sig: string; byStyle: Record<string, AvailabilityStatus> }>({ sig: "", byStyle: {} });

  // La configuración que el servidor ya aprobó, guardada como su propia firma. `configReady` se
  // deriva de comparar esa firma con la actual, así que cambiar cualquier cosa la invalida sola:
  // no hay que acordarse de apagar un booleano en cada rama que toca la configuración, y no puede
  // quedar un "listo" viejo sobre una medida nueva.
  const [approvedConfig, setApprovedConfig] = useState("");
  const [checking, setChecking] = useState(false);
  const [configError, setConfigError] = useState("");
  const [savedItems, setSavedItems] = useState<ProjectItem[]>([]);
  const [lockedItems, setLockedItems] = useState<ProjectItem[]>([]);
  const [preparingProject, setPreparingProject] = useState(false);
  const [projectError, setProjectError] = useState("");

  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [consentToContact, setConsentToContact] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof Contact, string>>>({});
  const [folio, setFolio] = useState("");
  const [documentPath, setDocumentPath] = useState("");
  const [draftReady, setDraftReady] = useState(false);

  const style = useMemo(() => catalog.styles.find((s) => s.id === styleId) ?? null, [catalog.styles, styleId]);
  const product = catalog.products.find((entry) => entry.id === productId) ?? null;
  // La perfilería no se pregunta. Es la del estilo elegido y, mientras no haya estilo, la única
  // línea del catálogo público.
  const brand = catalog.brands.find((entry) => entry.id === style?.brandId) ?? catalog.brands[0] ?? null;
  const brandId = brand?.id ?? "";
  const colorsForBrand = useMemo(() => catalog.colors.filter((c) => c.brandId === brandId), [catalog.colors, brandId]);
  const color = colorsForBrand.find((c) => c.id === colorId) ?? colorsForBrand[0] ?? null;
  const glass = catalog.glass.find((entry) => entry.id === glassId) ?? catalog.glass[0];
  const frameHex = color?.hex ?? "#f3f3ef";
  // Se filtra solo por producto: la línea ya no acota la lista.
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

  const currentConfig: QuoteConfig | null = style && color && !sizeError ? {
    styleId: style.id,
    widthMm,
    heightMm,
    qty,
    colorId: color.id,
    glassId,
    extras,
  } : null;
  // La configuración se compara por contenido, no por identidad: el objeto se recrea en cada
  // render y depender de él dispararía una petición por render.
  const configPayload = currentConfig ? JSON.stringify(currentConfig) : "";
  const configReady = !!configPayload && approvedConfig === configPayload;
  const currentItem: ProjectItem | null = currentConfig && configReady ? { id: "current", config: currentConfig } : null;
  const reviewItems = currentItem ? [...savedItems, currentItem] : savedItems;
  const totalPieces = reviewItems.reduce((sum, item) => sum + item.config.qty, 0);
  const doneItems = lockedItems;
  const headerItemCount = step >= S.PROCESS ? doneItems.length : reviewItems.length;

  // Recupera la configuración y los datos de contacto de esta pestaña. Nunca hubo precios que
  // recuperar, y ahora tampoco hay ninguno que pudiera quedarse guardado en el navegador.
  //
  // Tiene que ser un efecto y no un inicializador de useState: sessionStorage no existe durante el
  // render del servidor, así que sembrar el estado con el borrador haría que el HTML del servidor
  // (paso 1) y el del navegador (paso N) no coincidieran, y React tiraría la hidratación completa.
  // Por eso se acepta el render extra que la regla advierte.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- ver el párrafo anterior: hidratación */
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
        contact?: Partial<Contact>;
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
      if (draft.contact) setContact((current) => ({ ...current, ...sanitizeContact(draft.contact!) }));
      if (Number.isFinite(draft.step)) setStep(Math.max(S.PRODUCT, Math.min(S.SUMMARY, Number(draft.step))));
      // Los diseños guardados vuelven tal cual: se validan al continuar, no al restaurar. Antes
      // esto disparaba una petición de precios; sin importes que pedir, la restauración es local.
      const savedConfigs = Array.isArray(draft.savedConfigs) ? draft.savedConfigs.slice(0, 100) : [];
      const valid = savedConfigs.filter((config) => catalog.styles.some((entry) => entry.id === config?.styleId));
      if (valid.length) setSavedItems(valid.map((config) => ({ id: newId(), config })));
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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
        contact,
        savedConfigs: savedItems.map((item) => item.config),
      }));
    } catch {
      // La cotización continúa aunque el navegador deshabilite el almacenamiento de sesión.
    }
  }, [draftReady, step, productId, styleId, widthMm, heightMm, qty, colorId, glassId, extras, sizeConfirmed, contact, savedItems]);

  useEffect(() => {
    trackPublicFunnel("quotation_started");
  }, []);

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

  // Confirma con el servidor que la configuración actual se puede fabricar y cotizar. Es el mismo
  // motor de siempre; lo que ya no vuelve es el importe.
  const requestId = useRef(0);
  useEffect(() => {
    // Nada que preguntar: `configReady` ya vale false por derivación, no hay que apagarlo.
    if (!configPayload) return;
    const id = ++requestId.current;
    const controller = new AbortController();
    const payload = configPayload;
    const timer = setTimeout(async () => {
      setChecking(true);
      setConfigError("");
      try {
        const res = await fetch("/api/public-quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          signal: controller.signal,
        });
        const json = (await res.json()) as { available?: boolean; error?: string };
        if (id !== requestId.current) return;
        if (!res.ok || json.available !== true) {
          setConfigError(json.error ?? "Esta combinación no está disponible.");
        } else {
          setApprovedConfig(payload);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (id !== requestId.current) return;
        setConfigError("No pudimos revisar tu configuración. Revisa tu conexión.");
      } finally {
        if (id === requestId.current) setChecking(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [configPayload]);

  // Disponibilidad por tarjeta en la pantalla de estilo, SOLO cuando el cliente ya dio medidas.
  // Sin medidas no se pregunta nada, porque una puerta de 800 × 2100 no se fabrica igual que una
  // de 1200 × 2600.
  const checkSig = `${productId}|${widthMm}|${heightMm}|${qty}|${color?.id ?? ""}|${glassId}|${extras.instalacion}`;
  useEffect(() => {
    if (step !== S.STYLE || !sizeConfirmed || !color) return;

    // Los estilos que ya se sabe que no llegan a esa medida no se mandan: su motivo se resuelve
    // localmente en styleStatus() y así se explica sin esperar al servidor.
    const askable = stylesForProduct.filter((entry) => !sizeRejection(entry, widthMm, heightMm, catalog.minMm));
    if (askable.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const allFailed = () => Object.fromEntries(askable.map((entry) => [entry.id, { kind: "unavailable" } as AvailabilityStatus]));
      try {
        const res = await fetch("/api/public-quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: askable.map((entry) => ({ styleId: entry.id, widthMm, heightMm, qty, colorId: color.id, glassId, extras })),
          }),
          signal: controller.signal,
        });
        const json = (await res.json()) as { items?: Array<{ available: boolean; reason?: string }> };
        if (!res.ok || json.items?.length !== askable.length) {
          setStyleChecks({ sig: checkSig, byStyle: allFailed() });
          return;
        }
        setStyleChecks({
          sig: checkSig,
          byStyle: Object.fromEntries(askable.map((entry, index) => {
            const item = json.items![index];
            return [entry.id, item.available ? { kind: "available" } : { kind: "unavailable", reason: item.reason }] as const;
          })),
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setStyleChecks({ sig: checkSig, byStyle: allFailed() });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [step, sizeConfirmed, stylesForProduct, color, widthMm, heightMm, qty, glassId, extras, catalog.minMm, checkSig]);

  function styleStatus(styleEntry: PublicCatalog["styles"][number]): AvailabilityStatus {
    if (!sizeConfirmed) return { kind: "missing-data" };
    const rejection = sizeRejection(styleEntry, widthMm, heightMm, catalog.minMm);
    if (rejection) return { kind: "unavailable", reason: rejection };
    if (styleChecks.sig !== checkSig) return { kind: "checking" };
    return styleChecks.byStyle[styleEntry.id] ?? { kind: "checking" };
  }

  const canAdvance = (() => {
    if (step === S.PRODUCT) return !!productId;
    if (step === S.STYLE) return !!styleId;
    if (step === S.SIZE) return !sizeError;
    if (step === S.CONFIRM) return configReady;
    if (step === S.SUMMARY) return reviewItems.length > 0 && !preparingProject;
    if (step === S.PROCESS) return lockedItems.length > 0;
    return true;
  })();

  function resetCurrentItem() {
    requestId.current += 1;
    setProductId("");
    setStyleId("");
    setWidthMm(1500);
    setHeightMm(1200);
    setSizeConfirmed(false);
    setStyleChecks({ sig: "", byStyle: {} });
    setQty(1);
    setColorId("");
    setGlassId(catalog.glass[0].id);
    setExtras(DEFAULT_EXTRAS);
    setApprovedConfig("");
    setConfigError("");
  }

  function addAnotherItem() {
    if (currentItem) {
      setSavedItems((items) => [...items, { ...currentItem, id: newId() }]);
    }
    setLockedItems([]);
    setProjectError("");
    resetCurrentItem();
    setStep(S.PRODUCT);
  }

  function removeSavedItem(id: string) {
    setSavedItems((items) => items.filter((item) => item.id !== id));
    setLockedItems([]);
    setProjectError("");
  }

  // Revisa el proyecto completo antes de seguir. El servidor confirma cada configuración con el
  // motor real; el precio se calculará una sola vez, al registrar, y solo saldrá en el documento.
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
      const json = (await res.json()) as { items?: Array<{ available: boolean; reason?: string }>; error?: string };
      if (!res.ok || json.items?.length !== reviewItems.length) {
        setProjectError(json.error ?? "No pudimos revisar tu proyecto. Intenta de nuevo.");
        return;
      }
      const rejected = json.items.findIndex((item) => !item.available);
      if (rejected >= 0) {
        setProjectError(`Revisa el diseño ${rejected + 1}: ${json.items[rejected].reason ?? "no está disponible en esa medida."}`);
        return;
      }
      setLockedItems(reviewItems);
      trackPublicFunnel("configuration_completed", { designCount: reviewItems.length, installation: extras.instalacion });
      setStep(S.PROCESS);
    } catch {
      setProjectError("No pudimos revisar tu proyecto. Revisa tu conexión.");
    } finally {
      setPreparingProject(false);
    }
  }

  function validateContact(): boolean {
    const errors: Partial<Record<keyof Contact, string>> = {};
    if (contact.name.trim().length < 2) errors.name = "Escribe tu nombre completo.";
    if (contact.phone.replace(/\D/g, "").length < 10) errors.phone = "Necesitamos 10 dígitos para escribirte por WhatsApp.";
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) errors.email = "Revisa tu correo electrónico.";
    if (contact.city.trim().length < 2) errors.city = "Escribe tu ciudad o municipio.";
    if (contact.postalCode && !/^\d{5}$/.test(contact.postalCode.trim())) errors.postalCode = "El código postal son 5 dígitos.";
    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit() {
    if (lockedItems.length === 0) return;
    // El permiso de contacto se valida aquí y no apagando el botón: un CTA deshabilitado sin
    // explicación deja al cliente sin saber qué le falta, y éste es el último clic del cotizador.
    // Los dos avisos se calculan antes de salir para que se vean juntos, no de uno en uno.
    const contactOk = validateContact();
    setConsentError(consentToContact ? "" : "Marca esta casilla para que podamos darte seguimiento.");
    if (!contactOk || !consentToContact) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/public-quote/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lockedItems.map((item) => item.config),
          contact: { ...trimContact(contact), consentToContact },
        }),
      });
      const json = (await res.json()) as { folio?: string; documentPath?: string; error?: string };
      if (!res.ok || !json.folio || !json.documentPath) {
        setSubmitError(json.error ?? "No pudimos generar tu cotización.");
        return;
      }
      trackPublicFunnel("customer_data_completed", { designCount: lockedItems.length });
      trackPublicFunnel("quotation_generated", { designCount: lockedItems.length });
      setFolio(json.folio);
      setDocumentPath(json.documentPath);
      setStep(S.DONE);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      setSubmitError("No pudimos generar tu cotización. Revisa tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    // Avanzar desde la pantalla de medidas es aceptar la medida que está en pantalla, aunque no
    // se haya escrito nada: desde aquí ya hay con qué revisar disponibilidad.
    if (step === S.SIZE) {
      setSizeConfirmed(true);
      trackPublicFunnel("dimensions_completed", { productId, styleId });
    }
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
    // Cualquier cambio autorizado invalida el proyecto ya revisado: hay que volver a confirmarlo.
    setLockedItems([]);
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
      // marca como no confirmada para que la interfaz siga pidiéndola.
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

  // El mensaje de WhatsApp describe el proyecto, no su precio: el importe vive en el documento.
  const whatsappLines = doneItems.map((item, index) => {
    const details = detailsFor(item);
    return `${index + 1}. ${details.styleName} · ${item.config.widthMm} × ${item.config.heightMm} mm · ${item.config.qty} ${item.config.qty === 1 ? "pieza" : "piezas"}`;
  });
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    [folio ? `Cotización ${folio}` : "Cotización LUFT PVC", ...whatsappLines].filter(Boolean).join("\n")
  )}`;
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
    // Lo único que el asesor sabe del precio: que ya se puede calcular. Nunca cuánto.
    quotable: configReady || lockedItems.length > 0,
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
          Paso {step + 1} de {PUBLIC_STEPS.length}
        </span>
      </header>
      <div className="cotProgress" aria-hidden="true"><span style={{ width: `${((step + 1) / PUBLIC_STEPS.length) * 100}%` }} /></div>

      {/* El escenario envuelve al contenido y al asesor. Es lo que hace que la burbuja flote
          siempre sobre el área de contenido y nunca sobre la navegación: su posición se resuelve
          contra esta caja, no contra el viewport con un `bottom` calculado a mano. */}
      <div className="cotStage">
        <main className="cotMain">
          {step === S.PRODUCT && (
            <Screen title="¿Qué necesitas?" hint="Elige una opción para empezar.">
              {savedItems.length > 0 && <ProjectBar items={savedItems} onReview={() => setStep(S.SUMMARY)} />}
              <div className="cotCards">
                {catalog.products.map((p) => (
                  <button key={p.id} className={`cotCard ${productId === p.id ? "sel" : ""}`} onClick={() => {
                    setProductId(p.id);
                    setStyleId("");
                    setColorId("");
                    trackPublicFunnel("product_selected", { productId: p.id });
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
              className="cotScreenStyles"
              title="Elige el estilo"
              hint={sizeConfirmed
                ? `Disponibilidad para ${widthMm.toLocaleString("es-MX")} × ${heightMm.toLocaleString("es-MX")} mm.`
                : "Cada elemento de tu proyecto puede tener un estilo distinto."}
            >
              {brand && <SystemNote name={brand.name} />}
              <div className="cotCards cotCardsWide">
                {stylesForProduct.map((s) => {
                  const status = styleStatus(s);
                  return (
                    <button key={s.id} className={`cotCard cotCardStyle ${styleId === s.id ? "sel" : ""}`} onClick={() => {
                      setStyleId(s.id);
                      // Las medidas del cliente mandan sobre la medida de presentación del estilo.
                      if (!sizeConfirmed) {
                        setWidthMm(s.defaultW);
                        setHeightMm(s.defaultH);
                      }
                      setStep(S.SIZE);
                    }}>
                      {/* La caja de dibujo tiene alto propio: el dibujo conserva la proporción
                          real de la ventana, así que sin ella una puerta alta hacía la tarjeta
                          casi el doble de alta que la de una corredera de la misma lista. */}
                      <span className="cotCardArt">
                        <WindowPreview
                          wings={s.wings}
                          widthMm={sizeConfirmed ? widthMm : s.defaultW}
                          heightMm={sizeConfirmed ? heightMm : s.defaultH}
                          frameHex={frameHex}
                          label={`Vista previa de ${s.name}`}
                        />
                      </span>
                      <span className="cotCardBody">
                        <b>{s.name}</b>
                        <small>{s.blurb}</small>
                        <span className={`cotCardState is-${status.kind}`}>{availabilityLabel(status)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Screen>
          )}

          {step === S.SIZE && (
            <Screen title="¿De qué medida?" hint="En milímetros. Si no estás seguro, un asesor lo verifica después." aside={livePreview}>
              <div className="cotFieldGrid cotFieldGridTight">
                <label className="cotField">Ancho (mm)<input type="number" inputMode="numeric" value={widthMm} onChange={(e) => { setWidthMm(Number(e.target.value) || 0); setSizeConfirmed(true); }} /></label>
                <label className="cotField">Alto (mm)<input type="number" inputMode="numeric" value={heightMm} onChange={(e) => { setHeightMm(Number(e.target.value) || 0); setSizeConfirmed(true); }} /></label>
                <div className="cotField">Cantidad<div className="cotStepper">
                  <button onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Menos">−</button>
                  <b>{qty}</b>
                  <button onClick={() => setQty((value) => Math.min(catalog.maxQty, value + 1))} aria-label="Más">+</button>
                </div></div>
              </div>
              {sizeError && <p className="cotWarn">{sizeError}</p>}
            </Screen>
          )}

          {step === S.COLOR && (
            <Screen title="Elige el color" hint="Color del marco, por dentro y por fuera." aside={livePreview}>
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
            <Screen title="Elige el vidrio" hint="De más sencillo a mayor aislamiento." aside={livePreview}>
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
            // Diseño e instalación en una pantalla. Antes aquí vivía el total; ahora vive el acuse
            // de que la configuración quedó completa, que es la información que el cliente necesita
            // para decidir si sigue o cambia algo.
            <Screen className="cotScreenConfirm" title="Revisa tu diseño" hint="Confirma la instalación. Puedes cambiar lo que quieras antes de continuar." aside={livePreview}>
              <Toggle label="Instalación" detail="Nuestro equipo la instala en tu domicilio." on={extras.instalacion} onChange={(value) => setExtras((current) => ({ ...current, instalacion: value }))} />
              <ReadyBox ready={configReady} checking={checking} error={configError} />
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
                <div className="cotProjectTotal">
                  <span>Tu proyecto</span>
                  <b>{reviewItems.length} {reviewItems.length === 1 ? "diseño" : "diseños"} · {totalPieces} {totalPieces === 1 ? "pieza" : "piezas"}</b>
                </div>
              )}
              <button className="cotAddAnother" onClick={addAnotherItem}>
                <i aria-hidden="true">＋</i><span><b>Agregar otra ventana</b><small>Puede tener otro estilo, medida, color y vidrio.</small></span>
              </button>
              {projectError && <p className="cotWarn">{projectError}</p>}
            </Screen>
          )}

          {step === S.PROCESS && (
            <Screen className="cotScreenProcess" title="¿Qué sigue después de tu cotización?" hint={`Tu proyecto reúne ${lockedItems.length} ${lockedItems.length === 1 ? "configuración" : "configuraciones"}.`}>
              <ProcessSection />
            </Screen>
          )}

          {step === S.CONTACT && (
            <Screen title="¿A dónde te enviamos tu cotización?" hint="Con estos datos preparamos tu propuesta y te damos seguimiento.">
              <div className="cotFieldGrid">
                <Field label="Nombre completo" required value={contact.name} error={contactErrors.name} autoComplete="name" onChange={(value) => setContact({ ...contact, name: value })} />
                <Field label="WhatsApp / teléfono" required value={contact.phone} error={contactErrors.phone} type="tel" autoComplete="tel" onChange={(value) => setContact({ ...contact, phone: value })} />
                <Field label="Ciudad / municipio" required value={contact.city} error={contactErrors.city} autoComplete="address-level2" onChange={(value) => setContact({ ...contact, city: value })} />
                <Field label="Correo electrónico" value={contact.email} error={contactErrors.email} type="email" autoComplete="email" onChange={(value) => setContact({ ...contact, email: value })} />
                <Field label="Código postal" value={contact.postalCode} error={contactErrors.postalCode} inputMode="numeric" autoComplete="postal-code" onChange={(value) => setContact({ ...contact, postalCode: value })} />
                <Field label="Empresa" value={contact.company} autoComplete="organization" onChange={(value) => setContact({ ...contact, company: value })} />
                <Field label="Nombre del proyecto" value={contact.projectName} onChange={(value) => setContact({ ...contact, projectName: value })} />
                <Field label="Dirección de instalación" value={contact.address} autoComplete="street-address" onChange={(value) => setContact({ ...contact, address: value })} />
              </div>
              <label className="cotField cotFieldWide">Comentarios u observaciones
                <textarea value={contact.notes} maxLength={1000} rows={2} onChange={(event) => setContact({ ...contact, notes: event.target.value })} />
              </label>
              <label className="cotToggle cotConsent">
                <span><b>Autorizo el seguimiento</b><small>LUFT PVC puede contactarme para continuar con esta cotización.</small></span>
                <input
                  type="checkbox"
                  checked={consentToContact}
                  onChange={(event) => {
                    setConsentToContact(event.target.checked);
                    if (event.target.checked) setConsentError("");
                  }}
                  aria-label="Autorizar contacto de LUFT PVC"
                />
              </label>
              {consentError && <small className="cotFieldError">{consentError}</small>}
              <p className="cotFinePrint">Al continuar aceptas que LUFT PVC utilice estos datos para preparar y dar seguimiento a tu cotización.</p>
              {submitError && <p className="cotWarn">{submitError}</p>}
            </Screen>
          )}

          {step === S.DONE && (
            <Screen title="¡Tu cotización está lista!" hint={folio ? `La guardamos con el folio ${folio}.` : ""}>
              <div className="cotDoc">
                <p className="cotFolio">{folio}</p>
                <p className="cotHint">Hemos preparado tu propuesta personalizada. Ábrela para consultarla o descargarla.</p>
                <div className="cotProjectList cotProjectListCompact">
                  {doneItems.map((item, index) => <ProjectItemCard key={item.id} index={index} item={item} details={detailsFor(item)} />)}
                </div>
                <p className="cotFinePrint">Un asesor de LUFT PVC podrá dar seguimiento a tu proyecto utilizando los datos proporcionados.</p>
              </div>
              <div className="cotDoc procTimelineCard"><h3>¿Qué sigue?</h3><GlassTimeline currentIndex={1} /></div>
              <div className="cotFinalActions">
                {/* Los dos abren el mismo documento renderizado en el servidor: uno para leerlo y
                    otro para el diálogo de impresión del navegador, que es el que genera el PDF. */}
                <a className="cotPrimary cotPrimaryLink" href={documentPath} target="_blank" rel="noopener noreferrer" onClick={() => trackPublicFunnel("pdf_opened")}>Ver cotización</a>
                <a className="cotSecondary" href={`${documentPath}?print=1`} target="_blank" rel="noopener noreferrer" onClick={() => trackPublicFunnel("pdf_opened")}>Descargar PDF</a>
                <a className="cotSecondary" href={whatsappHref} target="_blank" rel="noopener noreferrer">Continuar por WhatsApp</a>
              </div>
            </Screen>
          )}
        </main>

        <QuoteAssistant context={assistantContext} onApply={applyAssistantAction} supportHref={whatsappHref} humanAvailable={step === S.DONE} />
      </div>

      {step < S.DONE && (
        <footer className="cotFoot">
          {step > S.PRODUCT && <button className="cotSecondary" onClick={handleBack}>Atrás</button>}
          {step === S.CONTACT ? (
            <button className="cotPrimary" onClick={submit} disabled={submitting}>{submitting ? "Generando…" : "Generar mi cotización"}</button>
          ) : step === S.SUMMARY ? (
            <button className="cotPrimary" onClick={prepareProject} disabled={!canAdvance}>{preparingProject ? "Revisando…" : "Continuar"}</button>
          ) : (
            <button className="cotPrimary" onClick={handleNext} disabled={!canAdvance}>Continuar</button>
          )}
        </footer>
      )}
    </div>
  );
}

function sanitizeContact(raw: Partial<Contact>): Partial<Contact> {
  const out: Partial<Contact> = {};
  for (const key of Object.keys(EMPTY_CONTACT) as Array<keyof Contact>) {
    if (typeof raw[key] === "string") out[key] = raw[key]!.slice(0, 1000);
  }
  return out;
}

function trimContact(value: Contact): Contact {
  return Object.fromEntries(Object.entries(value).map(([key, text]) => [key, text.trim()])) as Contact;
}

// `aside` es el contenido que en escritorio se va a su propia columna (la vista previa) y en
// móvil se apila arriba. Se pasa como prop en vez de como primer hijo porque la retícula necesita
// saber si existe: sin ella la pantalla ocupa el ancho completo en vez de dejar media columna
// vacía.
function Screen({ title, hint, className, aside, children }: { title: string; hint?: string; className?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={["cotScreen", aside ? "hasAside" : "", className ?? ""].filter(Boolean).join(" ")}>
      <header className="cotScreenHead">
        <h1>{title}</h1>
        {hint && <p className="cotHint">{hint}</p>}
      </header>
      {aside && <div className="cotScreenAside">{aside}</div>}
      <div className="cotScreenBody">{children}</div>
    </section>
  );
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

function Field({
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel" | "text";
  autoComplete?: string;
}) {
  return (
    <label className={`cotField ${error ? "hasError" : ""}`.trim()}>
      {label}{required && <em aria-hidden="true"> *</em>}
      <input type={type} inputMode={inputMode} value={value} autoComplete={autoComplete} aria-invalid={error ? true : undefined} onChange={(event) => onChange(event.target.value)} />
      {/* El error va junto a su campo, no en un resumen arriba: es donde se corrige. */}
      {error && <small className="cotFieldError">{error}</small>}
    </label>
  );
}

// Sustituye a la caja del total. Confirma que la configuración está completa sin adelantar
// ninguna cifra: un fallo se declara, nunca se rellena.
function ReadyBox({ ready, checking, error }: { ready: boolean; checking: boolean; error: string }) {
  if (error) return <p className="cotWarn">{error}</p>;
  if (checking && !ready) return <p className="cotHint">Revisando tu configuración…</p>;
  if (!ready) return <p className="cotHint">Completa los pasos anteriores para terminar tu configuración.</p>;
  return (
    <div className="cotReadyBox">
      <i aria-hidden="true">✓</i>
      <span>
        <b>Configuración completada</b>
        <small>Tu diseño se puede fabricar con estas medidas. Continúa para generar tu cotización.</small>
      </span>
    </div>
  );
}

function ProjectBar({ items, onReview }: { items: ProjectItem[]; onReview: () => void }) {
  const pieces = items.reduce((sum, item) => sum + item.config.qty, 0);
  return (
    <div className="cotProjectBar">
      <span><b>Tu proyecto</b><small>{items.length} {items.length === 1 ? "diseño" : "diseños"} · {pieces} {pieces === 1 ? "pieza" : "piezas"}</small></span>
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
        <p>{details.colorName} · {details.glassName} · {item.config.extras.instalacion ? "Con instalación" : "Sin instalación"}</p>
      </div>
    </article>
  );
}
