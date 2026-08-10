# Proceso post-cotización — análisis previo a implementar

Análisis pedido en la §15 del brief antes de tocar código: qué existe hoy, qué se
reutiliza, qué falta, qué puede salir mal y en qué orden construirlo.

**Conclusión corta:** la parte visual (timeline, cards de vidrio, resumen) es la
menos riesgosa y se puede construir pronto. Lo que la sostiene —estados, link
público, datos bancarios, tiempos de fabricación, agenda— **no existe todavía en
este proyecto**, y dos cosas tienen que resolverse *antes* de mostrarle
información de pago a un cliente: los datos bancarios están escritos en el código
fuente, y ninguna ruta del API tiene autenticación.

---

## A. Arquitectura actual

| Capa | Qué hay hoy |
|---|---|
| **Frontend** | Next.js 16 (App Router) + React 19, compilado por `vinext`. Dos superficies: `app/page.tsx` (app interna, workspace de 3 columnas) y `app/cotizar` (cotizador público, wizard de 11 pasos). |
| **Backend** | Route handlers en `app/api/**/route.ts`. Todos llaman `getDb()` (`db/index.ts`) y delegan en `lib/projectRepo.ts`. Corren dentro de un Cloudflare Worker (`worker/index.ts`). |
| **Base de datos** | Cloudflare D1 (SQLite) vía Drizzle. **Tres tablas**: `projects`, `components`, `rate_limit_hits`. Migraciones en `drizzle/`. |
| **Motor de cotización** | `lib/calc.ts` → `calcQuote()`: función pura y síncrona. Calcula perfil, vidrio, refuerzo, sellos, accesorios, consumibles, margen y descuento, más un optimizador real de corte (bin-packing). `lib/projectReports.ts` lo envuelve por componente. |
| **Catálogos** | `data/catalog.ts` (sistemas + tarifas), `colors.ts`, `glass.ts`, `families.ts` (278 SKUs Aluplast reales), `typologies.ts`, `wings.ts`. Módulos TS planos, sin efectos. |
| **Cotizador público** | `app/cotizar/page.tsx` (server component) + `components/cotizar/QuoteWizard.tsx` (cliente) + `app/api/public-quote/{route,submit}` + `lib/publicCatalog.ts` + `lib/publicQuote.ts` + `lib/rateLimit.ts`. |
| **Informes** | `components/reports/*.tsx` (Cotización, Corte, Vidrio, y sus variantes de proyecto) + `lib/exportDoc.ts`. |

### Lo que el brief da por supuesto y **no existe**

Esto es lo más importante del análisis. Verificado con el grafo del proyecto y
con búsqueda directa: **no hay ni un solo resultado** para ninguno de estos.

| El brief asume | Realidad |
|---|---|
| Sistema de **estados** del proyecto | **No existe.** Ninguna tabla ni tipo tiene columna de estado. No hay `status`, ni máquina de estados, ni historial de transiciones. |
| Módulo de **producción** / tiempos de fabricación | **No existe.** No hay reglas de producción, carga de planta, ni lead time. Lo único parecido es el optimizador de corte, que planea *material*, no *tiempo*. |
| **Calendario / agenda** | **No existe.** Lo único es `ComponentData.deliveryDate`, un string libre que se escribe a mano en la app interna. |
| Sistema de **clientes** | **No existe** como entidad. El cliente son campos de texto sueltos dentro del JSON del componente (`client`, `clientAddress`, `clientPhone`, `clientEmail`). No hay tabla, ni deduplicación, ni historial. |
| **Pagos** | **No existe** integración. Las condiciones de pago son texto libre (`ComponentData.paymentTerms`), sembrado con el 70/30 en `defaultComponentData()`. |
| **Generación de PDF** | **No existe** en servidor. El "PDF" es `window.print()` sobre el DOM renderizado, más exportación a HTML/CSV en `lib/exportDoc.ts`. |
| **Administración** | **No existe.** No hay panel de configuración ni tabla de settings. |
| **Autenticación** | **No existe** en ninguna ruta. `app/chatgpt-auth.ts` está en el repo pero no lo importa nadie. |

---

## B. Qué vamos a reutilizar

Nada de esto se reescribe. La regla del brief (§13) ya está implementada y hay
que sostenerla.

**Motor y datos**
- `calcQuote()` (`lib/calc.ts`) — única fuente del precio. El frontend nunca calcula.
- `data/catalog.ts`, `colors.ts`, `glass.ts`, `families.ts` — únicos catálogos.
- `lib/publicQuote.ts` — `parseConfig()` / `parseProjectConfigs()` /
  `priceConfig()` / `priceProjectConfigs()` / `buildComponentData()`.
  Ya es la frontera de seguridad: valida contra catálogos reales y responde solo
  con el precio comercial, nunca con `direct`, `margin` ni `utility`.
- `lib/publicCatalog.ts` — el allowlist `STYLE_DEFS` es lo que impide cotizar
  combinaciones inexistentes. `isEstimatedSystem()` ya distingue precio en firme
  de estimado.

**Persistencia**
- `lib/projectRepo.ts` — `createEmptyProject()`, `createComponentWithData()`,
  `updateComponent()`. Cada envío público crea un proyecto con uno o varios
  componentes mediante el mismo camino de guardado de la app interna.
- **`components.data` es una columna JSON**: campos nuevos del cliente (contacto,
  extras, metadatos) entran sin migración de esquema. Lo que sí necesita columna
  propia es cualquier cosa por la que haya que *filtrar o buscar* — el estado, por
  ejemplo.
- `lib/rateLimit.ts` — reutilizable tal cual para cada ruta pública nueva.

**Presentación**
- Los tokens `--cg-*` en `app/globals.css` (`.cotShell`) ya son exactamente el set
  que pide la §10: `--cg-tint`, `--cg-edge`, `--cg-line`, `--cg-shadow`, más la
  paleta pastel. Los componentes nuevos consumen esos tokens, no colores sueltos.
- `lib/exportDoc.ts` + `components/reports/*` — base del PDF por impresión.
- `ComponentData.termsHeader` / `paymentTerms` — texto comercial ya editable por
  componente.

---

## C. Qué falta construir

Ordenado por lo que bloquea a lo demás.

1. **Autenticación para la app interna** (prerequisito, ver riesgo D2). Sin esto,
   los estados y la configuración bancaria son escribibles por cualquiera.
2. **Tabla de configuración** (`settings` o similar), solo servidor:
   banco, beneficiario, CLABE, cuenta, porcentaje de anticipo, textos de
   instrucciones, parámetros de tiempo de fabricación. Con auditoría de cambios.
3. **Máquina de estados**: columna `status` en `components` (indexada), tabla de
   historial de transiciones (quién, cuándo, de qué a qué), y validación de
   transiciones permitidas en servidor.
4. **Link público seguro**: token opaco (32+ caracteres aleatorios) guardado en
   columna propia con índice único, ruta `/q/[token]` y su endpoint de lectura.
   El folio actual (`W-XXXXXX`, 6 hex) sirve como referencia humana, **no** como
   credencial de acceso.
5. **Cálculo de anticipo en servidor**: `depositAmount` y `remainingBalance`
   derivados del total confirmado y del porcentaje configurado. Nunca en el cliente.
6. **Estimador de tiempo de fabricación**, configurable: base + ajustes por
   cantidad, complejidad, color especial y vidrio especial. Como no existe ninguna
   regla previa, hay que **crearla configurable, no inventar un rango fijo**.
7. **Agenda de instalación**: fecha, horario, equipo, observaciones. No hay nada
   que reutilizar.
8. **Componentes de vidrio reutilizables**: `GlassCard`, `GlassBadge`,
   `GlassTimeline`, `GlassProcessStep`, `GlassPaymentCard`, `GlassStatusCard`.
   Hoy los estilos son clases sueltas en `globals.css`, no componentes.
9. **Sección "¿Qué sigue después de tu cotización?"** — los 7 pasos + timeline de
   9 estados, con la versión móvil de scroll vertical.
10. **Secciones nuevas del PDF**: proceso de compra y condiciones de pago, con el
    sello de "COTIZACIÓN PRELIMINAR" mientras no haya confirmación.
11. **Pantallas de administración** para todo lo configurable.

### Decisión pendiente sobre las imágenes

Las 7 referencias que mandaste se apoyan mucho en **fotografía** (asesor, medición,
fábrica, instalación). El brief pide reproducir el lenguaje visual con componentes,
no pegar las imágenes — de acuerdo. Pero las cards se van a sentir más frías sin
foto. Hay que decidir: (a) producir fotos reales del equipo de LUFT, (b) usar
ilustración/iconografía de vidrio sin foto, o (c) mezclar. Lo recomendable es (a)
a mediano plazo y (b) para salir ya.

---

## D. Riesgos

### D1. Datos bancarios reales escritos en el código fuente — CRÍTICO

`components/reports/CotizacionDoc.tsx`, líneas 8–15, contiene en texto plano:

- Razón social, **banco, número de cuenta y CLABE completa**
- El nombre de una persona real como contacto comercial

Está en el repositorio desde el commit `f158e96`, o sea que también vive en todo
el historial de git. Hoy el repo es **privado**, así que la exposición está
contenida — pero:

- El brief pide mostrar información de pago en una página **pública**. Si eso se
  construye leyendo la constante actual, la CLABE queda publicada en internet
  abierto.
- Cualquier cambio de visibilidad del repo, o compartirlo con un tercero, expone
  el dato retroactivamente. Borrarlo de un commit futuro no lo quita del historial.

**Acción:** mover esos datos a la tabla de configuración *antes* de construir
cualquier UI de pago, y tratar la limpieza del historial de git como tarea aparte.

### D2. Ninguna ruta del API tiene autenticación — CRÍTICO para esta fase

Hoy el peor caso es que alguien ensucie la base con cotizaciones basura (y para
eso ya está el rate limiting). Con estados y datos bancarios en juego, el peor
caso cambia de categoría:

- Cualquiera podría marcar una cotización como "precio confirmado" o
  "lista para depósito".
- Si la configuración bancaria es escribible sin autenticación, **un atacante
  cambia la CLABE y el cliente deposita 70% a la cuenta equivocada.**

Esto deja de ser deuda técnica y pasa a ser bloqueante. La autenticación tiene que
existir antes que la fase de pagos.

### D3. Enumeración del link público

Un folio de 6 caracteres hexadecimales es adivinable por fuerza bruta a escala.
Si ese link muestra nombre, teléfono, dirección y precio del cliente, es una fuga
de datos personales. Por eso el token opaco separado del folio (C4).

### D4. Invitar al depósito antes de tiempo

El brief ya lo previene con el texto informativo, y está bien. La protección real
es más simple: **no renderizar los datos bancarios en absoluto** mientras el
estado no sea "lista para depósito". Que el importe se vea como referencia es
correcto; que se vea la CLABE, no.

### D5. Deceuninck estimado + instrucciones de depósito

Combinación delicada. Hoy Deceuninck se cotiza con tarifas estimadas y así se
declara. Si a esa cotización se le pega un flujo de anticipo del 70%, un cliente
puede depositar contra un precio no verificado. **Regla propuesta:** una
cotización estimada nunca puede llegar al estado "lista para depósito" sin pasar
por confirmación humana. El estado la protege; el texto solo, no.

### D6. Inventar tiempos de fabricación

No existe ninguna regla de producción en el sistema. Poner "3 a 5 semanas" fijo en
el frontend repite exactamente el error que el proyecto ya decidió no cometer con
los precios. Debe salir de configuración, con su aviso de variabilidad.

### D7. Rendimiento en móvil

El timeline agrega 7–9 superficies con `backdrop-filter` a una sola pantalla. En
el cotizador actual el desenfoque ya está dosificado a propósito (fuerte en el
cromo fijo, ligero en listas). Hay que sostener ese criterio: animar por
`IntersectionObserver`, no difuminar todo a la vez, y no meter una librería de
animación para transiciones que resuelve CSS.

### D8. Duplicar la lógica

El riesgo crece con cada dato nuevo que el frontend "ya tiene a la mano":
`depositAmount`, saldo, tiempo estimado, estado. Todos deben venir calculados del
servidor aunque el navegador pudiera derivarlos.

---

## E. Plan de implementación

Cada fase deja algo funcionando y verificable.

**Fase 0 — Sacar los datos bancarios del código** *(no depende de nada, hazlo ya)*
Tabla de configuración + lectura solo desde servidor. `CotizacionDoc.tsx` deja de
tener constantes. Sin esto, ninguna fase de pago es segura.

**Fase 1 — Autenticación de la app interna**
Proteger `app/api/projects/**` y las rutas de administración. Las rutas públicas
siguen abiertas con su rate limiting.

**Fase 2 — Modelo de estados**
Columna `status` + historial + transiciones válidas en servidor. Mapeo a los
estados del brief. La app interna gana los controles para avanzar de estado.

**Fase 3 — Link público seguro y consulta de estado**
Token opaco, ruta `/q/[token]`, endpoint de lectura que expone solo lo que el
cliente puede ver. Aquí ya se puede volver a entrar a ver "en qué voy".

**Fase 4 — Experiencia visual del proceso** *(la parte que más se ve)*
Componentes `Glass*` reutilizables, sección de 7 pasos, timeline de 9 estados,
resumen del proyecto, animaciones sutiles con `prefers-reduced-motion` respetado.
Se puede adelantar en paralelo a las fases 2–3 usando datos de ejemplo.

**Fase 5 — Anticipo e información de pago**
Cálculo en servidor, card de pago que solo revela banco/CLABE en el estado
correcto, y el candado de la D5 para cotizaciones estimadas.

**Fase 6 — Tiempos de fabricación**
Estructura configurable y su presentación como rango, con aviso.

**Fase 7 — Agenda de instalación**
Fecha, horario, equipo. Vista del cliente y control interno.

**Fase 8 — PDF**
Secciones de proceso y condiciones de pago, con el sello de preliminar.

**Fase 9 — QA y seguridad**
Revisión de que ningún dato interno se filtre al público, pruebas de transición de
estados, verificación de contraste y accesibilidad, y prueba en móvil real.

---

## Lo que necesito que decidas antes de la Fase 0

1. **Autenticación**: ¿qué mecanismo quieres para la app interna? (usuario y
   contraseña propios, Cloudflare Access, un token compartido, otro).
2. **Fotografía**: ¿producimos fotos reales del equipo o salimos con ilustración?
3. **Alcance**: esto es bastante más que "la parte final del cotizador" — son
   nueve fases. ¿Quieres las nueve, o cortamos en la Fase 4 (que es lo que se ve)
   y dejamos pagos/producción/agenda para después?
