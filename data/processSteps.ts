// Contenido de la sección "¿Qué sigue después de tu cotización?" del cotizador público.
//
// Solo texto: ni precios, ni tiempos, ni porcentajes escritos a mano. Lo que sea un número del
// negocio (el porcentaje de anticipo, el tiempo de fabricación) llega desde el servidor, porque
// es política comercial configurable y no una constante de la interfaz.
//
// Sin fotografías: las cards se construyen con ilustración de línea y vidrio (ver ProcessIcons),
// para no depender de producir sesión de fotos. Los espacios de ilustración están aislados en un
// componente propio, así que sustituirlos por foto real después no toca esta lista.

export type ProcessStepId =
  | "revision"
  | "medicion"
  | "precio"
  | "deposito"
  | "fabricacion"
  | "agenda"
  | "instalacion";

export type ProcessStep = {
  id: ProcessStepId;
  /** Número visible en la card. */
  n: number;
  title: string;
  body: string;
  /** Tres apoyos cortos, como las cápsulas inferiores de las referencias visuales. */
  chips: string[];
  /** Aviso destacado dentro de la card, cuando el paso necesita aclarar algo al cliente. */
  note?: string;
};

export const processSteps: ProcessStep[] = [
  {
    id: "revision",
    n: 1,
    title: "Revisamos tu cotización",
    body: "Un asesor revisará tu configuración para confirmar que todos los datos sean correctos antes de continuar.",
    chips: ["Revisión experta", "Validación de detalles", "Listo para continuar"],
  },
  {
    id: "medicion",
    n: 2,
    title: "Realizamos la medición profesional",
    body: "Un experto acudirá al lugar para tomar las medidas exactas antes de confirmar tu proyecto.",
    chips: ["Mediciones precisas", "Visita en el lugar", "Base para un proyecto exacto"],
    note: "Las medidas que ingresaste son referenciales. Nuestro especialista verificará las dimensiones exactas antes de fabricar.",
  },
  {
    id: "precio",
    n: 3,
    title: "Confirmamos el precio final",
    body: "Después de validar las medidas y condiciones reales, te compartimos el precio final confirmado.",
    chips: ["Revisión experta", "Validación de detalles", "Precio confirmado"],
  },
  {
    id: "deposito",
    n: 4,
    title: "Depósito inicial",
    body: "Con el precio confirmado, realizas el anticipo para iniciar la fabricación.",
    chips: ["Pago seguro", "Transparencia total", "Iniciamos tu proyecto"],
    // "Este importe" ya no tiene a qué referirse: el desglose del anticipo salió del recorrido
    // público junto con el resto de los precios. La advertencia sí se queda, porque su función es
    // impedir que alguien pague sobre la cifra preliminar del documento.
    note: "El anticipo que aparece en tu cotización es informativo. No realices ningún depósito hasta que nuestro equipo haya realizado la medición y confirmado tu cotización.",
  },
  {
    id: "fabricacion",
    n: 5,
    title: "Fabricación en proceso",
    body: "Fabricamos tus ventanas o canceles según las medidas y especificaciones confirmadas.",
    chips: ["Producción a medida", "Control de calidad", "Seguimiento de tu pedido"],
  },
  {
    id: "agenda",
    n: 6,
    title: "Agendamos la instalación",
    body: "Cuando tu pedido esté listo, coordinamos contigo la fecha de instalación.",
    chips: ["Coordinación a tu medida", "Instalación puntual", "Seguimiento de tu pedido"],
  },
  {
    id: "instalacion",
    n: 7,
    title: "Instalación y sellado",
    body: "Nuestro equipo instala, ajusta y sella tus ventanas o canceles para completar el proyecto.",
    chips: ["Instalación profesional", "Ajuste y sellado preciso", "Proyecto completado"],
  },
];

// Las 9 etapas del timeline. Son la cara pública de los estados que todavía NO existen en el
// backend (ver PROCESO_POST_COTIZACION.md, fase 2): hoy solo se pinta la primera como
// completada. Cuando exista la columna de estado, esta lista es el mapa contra el que se
// resuelve en qué etapa va cada cotización, sin cambiar la interfaz.
export type TimelineStage = { id: string; label: string };

export const timelineStages: TimelineStage[] = [
  { id: "quote_created", label: "Cotización creada" },
  { id: "pending_review", label: "Revisión" },
  { id: "measurement", label: "Medición" },
  { id: "price_confirmed", label: "Precio confirmado" },
  { id: "deposit", label: "Depósito inicial" },
  { id: "manufacturing", label: "Fabricación" },
  { id: "installation_scheduled", label: "Instalación programada" },
  { id: "installation", label: "Instalación y sellado" },
  { id: "project_completed", label: "Proyecto terminado" },
];
