# Cotizador simplificado (cara al cliente) — LUFT PVC

Spec de una página pública, tipo wizard, para que un cliente final configure y
cotice su propia ventana/puerta sin tocar la aplicación interna. Debe reusar el
motor de cálculo y los catálogos que ya existen (`lib/calc.ts`, `data/*.ts`,
`db/schema.ts` vía `lib/projectRepo.ts`) — **no crea una segunda base de datos
de precios ni un segundo motor de cálculo.**

> **Estado: implementado.** Ruta pública `/cotizar`
> ([app/cotizar/page.tsx](app/cotizar/page.tsx) +
> [components/cotizar/QuoteWizard.tsx](components/cotizar/QuoteWizard.tsx)),
> API en [app/api/public-quote/route.ts](app/api/public-quote/route.ts) y
> [.../submit/route.ts](app/api/public-quote/submit/route.ts), lógica en
> [lib/publicQuote.ts](lib/publicQuote.ts) y
> [lib/publicCatalog.ts](lib/publicCatalog.ts), anti-abuso en
> [lib/rateLimit.ts](lib/rateLimit.ts). Lo único pendiente es publicar el sitio.

## 1. Flujo de pantallas (una decisión importante por pantalla)

1. **INICIO** — Qué quiere el cliente: Ventana, Puerta, etc.
2. **ESTILO** — Imágenes de los estilos disponibles (Fija, Corrediza, Abatible,
   Elevadora...) — limitado a los tipos de apertura que el sistema sourced
   elegido soporta (ver §4).
3. **MEDIDAS** — Ancho, Alto, Cantidad.
4. **COLOR** — Colores disponibles con muestra visual (swatch), tomados de
   `data/colors.ts`.
5. **VIDRIO** — Opciones de vidrio (`data/glass.ts`) explicadas por beneficio
   ("más aislamiento", "más seguridad"), nunca por término técnico
   (mm, tipo "Monolítico"/"DVH").
6. **EXTRAS** — Mosquitero, cerradura/herraje, instalación, etc.
7. **PRECIO** — Se calcula y muestra automáticamente en cada cambio.
8. **RESUMEN** — Imagen, medidas, color, vidrio, precio, total.
9. **CONTACTO** — Nombre, teléfono, email, ciudad.
10. **OPCIONES FINALES** — Descargar PDF, enviar por WhatsApp, contactar.

Cada cambio en cualquier pantalla debe recalcular el precio llamando al backend
(§4) — nunca recalcula en el navegador con una copia local de las tarifas.

## 2. Qué ve el cliente vs. qué nunca debe ver

**Ve:** imágenes, medidas, colores, vidrio explicado en lenguaje simple, precio
final, resumen claro.

**Nunca ve:** costo directo (`direct` en `QuoteCalc`), margen (`margin`),
utilidad (`utility`), nombre de proveedores, errores técnicos/stack traces,
detalles de fabricación (cut list, `frameSeatMm`, `centerOverlapMm`, códigos de
perfil). El endpoint público (§4) debe devolver únicamente `total` (y quizá un
desglose comercial genérico tipo "Perfil / Vidrio / Instalación" si se quiere
un resumen, nunca los campos internos de `QuoteCalc`).

## 3. Alcance de producto: dos líneas, dos niveles de certeza

El allowlist `STYLE_DEFS` de `lib/publicCatalog.ts` es la frontera de lo
cotizable: `findStyle()` solo resuelve lo que esté ahí, así que ninguna otra
combinación de sistema+apertura puede llegar al motor, venga lo que venga en el
payload. Hoy son 20 estilos, 10 por línea.

- **Aluplast** — los 5 sistemas con `sourced: true` en `data/catalog.ts`
  (CORREDERA 60MM, CORREDERA 60MM Monorriel, CORREDERA 96MM, IDEAL 2000
  Practicable, ELEVADORA 70MM). Sus tarifas vienen de la lista EXWORK Veracruz
  real, así que el precio se presenta **en firme**.
- **Deceuninck** — sus tarifas en `data/catalog.ts` son **estimaciones**, no una
  lista de precios del proveedor, y `data/families.ts` no tiene ni un perfil
  Deceuninck. Se puede cotizar, pero `isEstimatedSystem()` marca el precio como
  aproximado y la UI lo dice en la tarjeta de línea, en la pantalla de precio, en
  el resumen y en el mensaje de WhatsApp: *"Precio aproximado: esta línea la
  confirma tu asesor antes de firmar."* Nunca se presenta como precio cerrado.

La regla de fondo (misma que `lib/profileMatch.ts` y `quotizador_prompt.md`) se
mantiene: no se inventan precios ni datos técnicos. Lo que cambia es que un dato
estimado se puede mostrar **siempre que se declare como tal**. Si algún día entra
la lista real de Deceuninck, basta con marcar `sourced: true` en `data/catalog.ts`
y el aviso desaparece solo, sin tocar la UI.

## 4. Arquitectura: reutilizar, no duplicar

La app ya sigue el patrón `app/api/**/route.ts` → `lib/projectRepo.ts` (Drizzle
sobre D1) para todo lo interno; el cotizador público debe seguir el mismo
patrón, en rutas nuevas y separadas:

- **Nueva ruta pública**: `app/api/public-quote/route.ts` (o similar) — recibe
  `{ systemIndex, colorIndex, glassIndex, widthMm, heightMm, qty, tree, marco,
  extras }`, valida contra los catálogos reales (`data/catalog.ts`,
  `data/colors.ts`, `data/glass.ts`) y contra las reglas de §3, y llama
  **exactamente** a `calcQuote()` (`lib/calc.ts`) — el mismo motor que usa la
  app interna. Responde solo con el campo comercial (`total`), nunca con el
  objeto `QuoteCalc` completo.
- **Nunca** expone `data/families.ts` (precios €/m reales) ni `margin`/
  `installation`/`transport`/`discount` internos al cliente — esos valores los
  fija el negocio server-side, no el formulario público.
- **Persistencia de la cotización**: al llegar a RESUMEN/CONTACTO, crear un
  `ComponentRecord` real vía `lib/projectRepo.ts` (`createProject`/
  `createComponent`), para que la cotización aparezca en la app interna sin
  ningún camino paralelo de guardado. `ComponentData` (`types/project.ts`) ya
  tiene `client`/`clientAddress`; **faltan** `phone`/`email`/`ciudad` — hay que
  ampliar `ComponentData` y la tabla `components.data` (columna JSON, no
  requiere migración de esquema) o agregar columnas dedicadas si se quieren
  filtrables/buscables desde la app interna.
- **Proyecto contenedor**: decidir si cada cotización pública crea su propio
  `ProjectRecord` (p.ej. "Cotizaciones web") o si todas caen en un proyecto
  fijo tipo "Cotizador web" — para que el equipo las encuentre fácil en la app
  interna sin mezclarlas con proyectos de vendedores.

## 5. Seguridad

- El cliente **nunca** llama a D1 directamente ni importa `lib/calc.ts` en el
  navegador con fines de precio final mostrado como oficial — el JS del
  navegador puede mostrar un precio *estimado* mientras el usuario configura,
  pero el precio que se guarda y se muestra en RESUMEN debe venir de una
  respuesta del servidor (mismo patrón que ya usan las 4 rutas API internas).
- Toda validación de rangos (maxW/maxH, `MIN_OPENING_MM`, combinaciones de
  apertura válidas por sistema) se repite en el servidor aunque la UI ya la
  aplique — la UI es UX, el servidor es la garantía.
- **Ninguna ruta `app/api/**` tiene autenticación** (confirmado en el código:
  `app/chatgpt-auth.ts` existe pero no se usa en ninguna ruta), así que las dos
  rutas públicas quedan expuestas a internet abierto. De ahí el anti-abuso de
  `lib/rateLimit.ts`, en dos capas según lo que hace cada ruta:
  - `/api/public-quote/submit` **escribe**, así que lleva el límite exacto
    respaldado en D1 (tabla `rate_limit_hits`): **5 por hora y 20 por día por
    IP**, contra `CF-Connecting-IP` (que Cloudflare reescribe en cada request,
    por lo que no es falsificable desde el navegador). Los intentos rechazados
    no se registran, para que reintentar no alargue el castigo. Falla en
    abierto si D1 no responde: perder un cliente real por un 429 falso es peor
    que dejar pasar una cotización de más.
  - `/api/public-quote` solo **calcula** y el wizard la llama en cada cambio de
    configuración, así que registrarla en D1 costaría más de lo que ahorraría.
    Lleva un freno de ráfaga en memoria del isolate (60/min por IP), explícito
    en que es aproximado: Cloudflare corre varios isolates y el estado no se
    comparte, así que el límite real es por isolate. El volumen de verdad lo
    absorbe la protección de Cloudflare.
- En desarrollo local no hay `CF-Connecting-IP`, así que todo cae en el bucket
  `…:unknown` y el límite se comporta como global. En producción, detrás de
  Cloudflare, es por IP real.
- No pasar datos personales (teléfono, email) por query string; usar body de
  POST.

## 6. Diseño

Mobile-first, interfaz limpia, botones grandes, poco texto, una decisión
importante por pantalla (según §1). Reusar el sistema de diseño/tokens ya
presente en `app/globals.css` en vez de crear una hoja de estilos paralela.

## 7. Salida final (pantalla 10)

- **PDF**: hoy el único export existente (`lib/exportDoc.ts` →
  `exportReportHtml()`) es client-side: toma el DOM de `.reportDoc` y usa
  `window.print()`/descarga de HTML — no hay generación de PDF en servidor.
  Para el cotizador público hay que decidir: (a) reusar ese mismo patrón
  (imprimir un resumen renderizado en el navegador), o (b) generar un PDF real
  en servidor (librería nueva, no existe hoy) — (a) es más rápido de construir
  con lo que ya existe.
- **WhatsApp**: no existe integración hoy. La opción de bajo riesgo es un
  enlace `https://wa.me/<numero>?text=<resumen-urlencoded>` que abre WhatsApp
  del propio cliente con el resumen precargado — el cliente decide si lo
  envía. Esto no requiere backend ni credenciales de WhatsApp Business API.
- **Contactar**: formulario o enlace `tel:`/`mailto:` al equipo de ventas.

## 8. Datos a guardar (mapeo a lo que ya existe)

| Campo pedido           | Dónde vive hoy |
|-------------------------|----------------|
| Cliente (nombre)        | `ComponentData.client` (ya existe) |
| Fecha                   | `ComponentRecord.createdAt` (ya existe, automático) |
| Producto/configuración  | `ComponentRecord.brand/systemIndex/data.tree/data.marco` (ya existe) |
| Medidas                 | `ComponentRecord.widthMm/heightMm/qty` (ya existe) |
| Color                   | `ComponentRecord.colorIndex` (ya existe) |
| Vidrio                  | `ComponentData.glassIndex` (ya existe) |
| Extras                  | Parcial: `Marco.mosquitero/persiana` y `PaneSpec` cubren mosquitero/herraje; **falta** un lugar para "instalación sí/no" pedida por el cliente vs. `ComponentData.installation` (hoy es un monto interno, no un booleano de cliente) |
| Precio calculado        | Recalculable en cualquier momento desde `calcQuote()` con los campos guardados — no hace falta guardar un snapshot aparte, aunque puede convenir guardar el `total` mostrado al cliente para auditoría de "qué vio" si las tarifas cambian después |
| Teléfono/email/ciudad   | **No existen hoy** — requieren extender `ComponentData` (ver §4) |

## 9. Cómo quedó implementado

| Pieza | Archivo |
|-------|---------|
| Wizard de 12 pantallas (mobile-first) + proyecto de múltiples configuraciones | `app/cotizar/page.tsx` (server component) + `components/cotizar/QuoteWizard.tsx` (cliente) |
| Dibujo del vano para el cliente | `components/cotizar/WindowPreview.tsx` |
| Catálogo público (sin precios) | `lib/publicCatalog.ts` — `buildPublicCatalog()` corre en servidor; el cliente solo hace `import type` |
| Validación + precio | `lib/publicQuote.ts` — llama `calcQuote()` de `lib/calc.ts` |
| Precio en vivo | `POST /api/public-quote` — cotiza una configuración o un arreglo `items`; devuelve precios comerciales por renglón y total |
| Guardar cotización | `POST /api/public-quote/submit` — repriceo server-side + un proyecto independiente por folio con N componentes |
| Contacto en el modelo | `ComponentData.clientPhone` / `clientEmail` (opcionales) + campos Teléfono/Correo en la pestaña Resumen interna |
| Estilos | bloque "Cotizador público" en `app/globals.css` |

Decisiones aplicadas: PDF = imprimir el resumen multipágina desde el navegador (mismo
patrón que ya existía); WhatsApp = enlace `wa.me/529932211158`, usado como paso
de atención humana cuando el cliente ya decidió avanzar; cada envío se guarda
como su propio proyecto y todas sus ventanas comparten un único folio.

Comportamiento verificado en el navegador (dev): el precio se recalcula solo al
cambiar cualquier opción; un estilo fuera de catálogo o una medida sobre el
máximo del sistema se rechaza con mensaje claro; un `margin`/`discount` inyectado
en el body de la petición **se ignora** (el precio no cambia); el mosquitero no
altera el total y se avisa que lo cotiza un asesor; y la cotización guardada
aparece en la app interna con el mismo total que vio el cliente
($17,557 público vs. $17,556.74 interno, misma cifra redondeada).

## 10. Plan de implementación (orden sugerido)

1. Confirmar con negocio: proyecto contenedor para cotizaciones web (§4),
   política de rate-limiting (§5), y si el PDF puede ser el mismo patrón
   client-side que ya existe (§7) o se necesita PDF real en servidor.
2. Extender `ComponentData`/`types/project.ts` con `phone`, `email`, `ciudad`
   (o el nombre que se decida) y actualizar `lib/projectRepo.ts` si aplica.
3. Crear `app/api/public-quote/route.ts`: valida input contra catálogos +
   reglas de §3, llama `calcQuote()`, devuelve solo el precio comercial.
4. Crear `app/api/public-quote/submit/route.ts` (o extender la anterior) para
   persistir la cotización final vía `lib/projectRepo.ts` una vez el cliente
   llega a CONTACTO.
5. Construir el wizard de 10 pantallas (mobile-first) como una nueva ruta de
   página (p.ej. `app/cotizar/page.tsx`), consumiendo las rutas anteriores —
   nunca importando `lib/calc.ts`/catálogos con precios reales directo en
   código de cliente.
6. Conectar PDF (reusar `lib/exportDoc.ts` o construir el enfoque elegido en
   el paso 1) y el enlace de WhatsApp (`wa.me`).
7. Verificar que las cotizaciones creadas por el wizard aparecen en la app
   interna (`app/page.tsx`) sin cambios adicionales, dado que usan el mismo
   `ProjectRecord`/`ComponentRecord`.

## 11. Pendientes

- **Publicar el sitio** y aplicar la migración `0001` en la D1 remota
  (`wrangler d1 migrations apply DB --remote`), o la ruta de guardado fallará
  al no existir `rate_limit_hits`.
- **Tarifas reales de Deceuninck**: mientras `sourced` siga en false, esa línea
  se cotiza con estimaciones y así se le presenta al cliente (§3). Conseguir la
  lista del proveedor es lo que convierte ese precio en firme.
- **CAPTCHA**: el rate-limiting cubre el abuso por volumen, pero no impide que
  alguien mande 5 cotizaciones falsas por hora. Si aparece spam dirigido, el
  siguiente paso es Cloudflare Turnstile en el paso de CONTACTO.
- **Revisar el copy de vidrios y estilos** con ventas: los textos actuales en
  `lib/publicCatalog.ts` son una primera versión.
- **Imágenes reales**: hoy el estilo se muestra con un dibujo generado
  (`WindowPreview`), no con fotos de producto. Si se quieren fotos, hay que
  producirlas y servirlas desde `public/`.
