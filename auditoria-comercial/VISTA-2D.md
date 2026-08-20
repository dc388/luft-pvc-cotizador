# Vista 2D del editor · qué estaba mal y qué se midió

Fecha: 2026-08-20. Todo lo de aquí está medido sobre la aplicación corriendo, con
`getBoundingClientRect` y `getComputedStyle`, a 1366×768 y 1280×720.

## Advertencia sobre la verificación

El panel de navegador de esta sesión corre con `document.visibilityState === "hidden"` y su bucle de
render está congelado (0 fotogramas de `requestAnimationFrame` en 500 ms). Un `ResizeObserver` no
puede entregar nada en esas condiciones, y el del viewport 2D es quien mide el lienzo y publica
`--fit-w`/`--fit-h`. **No es un defecto de la aplicación**: se comprobó creando un observador nuevo
sobre un elemento conectado y visible, que tampoco recibió ninguna llamada.

Consecuencia práctica: las cajas del DOM (solapes, recortes, choques, scroll) se midieron
directamente, y el tamaño del dibujo se comprobó dándole al viewport el mismo valor que calcularía
`fitBox` a partir del lienzo medido de verdad. Además `fitBox` quedó cubierta por
`tests/fitBox.test.ts` con la medida real del lienzo como caso de referencia.

## 1. El dibujo salía diminuto: 158 × 123 px

Medido antes: `.canvasStage` = **316 × 2080 px** en una ventana de 768 de alto, con el dibujo a
158 × 123 px y la página desplazándose 2604 px.

Causa: `.workspace` es un grid y su fila toma la altura de la columna más alta. La de configuración
son diez pasos apilados, 2272 px. El panel visual se estiraba a esa altura y el lienzo a 2080. Es el
mismo mecanismo que había deformado el 3D; entonces se tapó solo en `.scene3dSlot`, no en la raíz.

Las tres columnas ya pedían su propio scroll (`overflow:auto`), pero un `overflow` no actúa mientras
la caja crece con su contenido: hace falta una altura definida de la que colgar.

Corrección: `main.internalApp` pasa a columna flex acotada a `100dvh`, y `.workspace` toma lo que
sobra con `min-height:0`. Se hace en la raíz y no en cada panel porque las franjas de aviso aparecen
y desaparecen: un `calc(100vh - 140px)` como el que había suponía una altura de encabezado fija.

| | Antes | Después (con 2 avisos) | Después (sesión normal) |
|---|---|---|---|
| Lienzo | 316 × 2080 | 316 × 262 | 331 × 383 |
| Dibujo | 158 × 123 | 203 × 158 | **257 × 200** |
| Scroll de página | 2604 px | no | no |

El hueco reservado alrededor del dibujo era simétrico (76 px a cada lado) porque las cotas flotaban
sobre el lienzo y podían caer en cualquier borde. Ahora van pegadas al dibujo y solo hay cotas abajo
y a la izquierda: `FIT_PAD` reparte 44/18/60/56 en vez de 76/76/58/58.

## 2. No había cadena de cotas

Sólo existían el ancho y el alto totales, ancladas al lienzo (`top:40px`, `left:42px`) con un margen
del 19 %, así que no cerraban con los bordes del producto. El ancho de cada hoja iba dentro de su
propio vidrio, en una pastilla: para saber si el reparto cuadraba había que sumarlas a mano.

Ahora las totales cierran contra el dibujo (medido: 0.0 px de desfase en los cuatro bordes) y por
dentro va la cadena parcial. Las medidas salen de `flattenToRects`, las **nominales** del hueco, no
de las de fabricación: las de una corredera se solapan en el traslape y una cadena hecha con ellas
sumaría más que el ancho de la ventana, que es justo el error que una cadena sirve para detectar.

Comprobado en las 13 tipologías (`tests/cotaChain.test.ts`): la cadena suma la medida total, no deja
huecos ni se pisa, y cada división real tiene su tramo. Ejemplos medidos en pantalla: corrediza de
3 hojas → 600 + 600 + 600 = 1800; combinado → anchos 900 + 900, altos 490 + 910 = 1400.

## 3. Amontonamiento de etiquetas

Medido antes, en una hoja de **79.7 px** de ancho:

- cuatro pastillas sumando **178.4 px** de ancho de etiqueta,
- solape `paneHardware ∩ paneRail` = 27.9 × 16.5 px,
- solape `pane em ∩ paneDim` = 16.0 × 15.0 px,
- «Corrediza» recortada por el `overflow:hidden` de `.pane` (se leía «Correde»),
- el glifo de apertura a 18 px fijos ocupaba 49.7 px de los 79.7 de la hoja.

Ahora es un solo bloque en columna (`.paneTags`), donde el solape es imposible por construcción, con
`text-overflow:ellipsis` contra el recorte. El detalle se retira según el tamaño **real de la hoja en
pantalla** mediante consultas de contenedor sobre `.pane`, no según el tamaño de la ventana: una hoja
estrecha en una pantalla grande tiene el mismo problema de sitio. La hoja seleccionada lo muestra
todo. El glifo pasa a `clamp(7px, 15cqmin, 20px)` — medido en 11.2 px en una hoja de 81 px.

Resultado medido a 1366×768 y a 1280×720: **cero recortes, cero solapes, nada que se salga de su
hoja**. Con tres hojas de 81 px, la seleccionada muestra medida + tipo + herraje + riel, y las otras
dos sólo la medida.

## 4. Dos defectos que introduje al hacer esto, y se corrigieron

- **Los controles de zoom encima del dibujo**: al ganar ancho, `.viewportControls` le pisaba la
  esquina superior derecha 171 × 32 px, y `.viewportHint` 141 × 10 px. En un dibujo técnico eso tapa
  perfil de marco. Se compactaron y se metieron en la franja reservada de arriba (`FIT_PAD.top`).
- **La cota vertical robando clics**: `.cotaTotalY` no lleva `right`, así que su ancho lo fijaba su
  contenido: la etiqueta girada medía 90 px sin girar y la caja se metía 44 px encima del dibujo. No
  se veía, pero ahí había una caja invisible con un botón dentro quitándole el clic al marco de la
  hoja izquierda. Corregido con `width:0` y `pointer-events` sólo en la etiqueta.
- **El 3D recortado**: la altura fija `min(70vh,720px)` de `.scene3dSlot` era una tirita para cuando
  el padre medía 2000 px heredados de una columna vecina. Con la raíz acotada, esa tirita pasó a ser
  el problema: 538 px de slot en un lienzo de 373, o sea 202 px de 3D recortados. Ahora se estira a
  su padre, que ya es una medida definida y de fiar.

## 4b. El lienzo colapsado, encontrado por el usuario

Quitarle a `.canvas` su mínimo de 500 px cambió un problema por otro, y **la primera medición no lo
vio porque se hizo a 1366×768 CSS**. La ventana real tenía zoom del 125 %, o sea un viewport de
**1044 × 443 CSS px**, y ahí:

- el panel de cotización se reordena a una segunda fila (`@media(max-width:1150px)`),
- el grid repartía la altura **a partes iguales entre las dos filas**: 122.4 px cada una de 275,
- al lienzo le quedaban **34 px de alto**. El dibujo no se veía.

Soltar la altura (`height:auto`) tampoco era la salida: probado y medido, devuelve el crecimiento
sin techo — lienzo de 1555 px y 3234 px de desplazamiento de página.

Lo que faltaba no era altura, era **suelo y prioridad de reparto**:

- `.internalApp .workspace` tiene un piso (560 px, 680 en la reordenación a dos filas) en vez de
  `min-height:0`. Un `overflow` que encoge sin suelo no es mejor que una caja que crece sin techo.
- `.internalApp .visualPanel{min-height:520px}` — cabecera 58 + métricas 74 son 132 px fijos que el
  dibujo no ve, así que este piso le garantiza ~390 px de lienzo.
- En la reordenación, las filas se declaran: `minmax(520px,1fr) minmax(140px,.6fr)`. El dibujo tiene
  un mínimo que el reparto no puede tocar; la cotización se queda con lo que sobre y hace su scroll.
- `main.internalApp` gana `overflow-y:auto`, para que si los pisos no caben se desplace eso y no se
  derrame sobre el pie.

Medido a **1044 × 443** después: filas 520 + 140, lienzo 643 × 362, **dibujo 288 × 224**, cotas
parciales dibujándose, configuración y cotización con scroll propio, la página sin desplazarse.
A **1366 × 768** no cambia nada respecto a la medición anterior: una sola fila de 575, dibujo
257 × 200, sin scroll.

Lección concreta: medir en el viewport del usuario, no en el nominal. Un zoom del 125 % en Windows
cambia de rama de `@media` y con ella el reparto del grid.

## 5. Lo que NO se tocó, y por qué

- **El aspecto del vidrio** (degradado azul, brillo blanco en diagonal). Es lo que más se parece a
  una ilustración y no a una alzada técnica, pero es puro criterio visual y en esta sesión no hay
  capturas con las que comprobar el resultado. Cambiar a ciegas el aspecto de lo único que se mira
  no es una mejora, es una apuesta.
- **La paleta de herramientas como columna a la izquierda.** Es una decisión ya documentada en el
  CSS («toolbox-as-flex-sibling, not an overlay») y flotarla no gana nada: si se la deja solapar,
  tapa el dibujo; si no, hay que descontar su ancho igual. Lo que sí está medido es su coste: 168 px
  más 16 de hueco sobre un área de dibujo de 417 px a 1280 de ancho, o sea **44 %**. A 1280×768 el
  dibujo se queda en 156 × 121 px por eso, no por el ajuste.
- **El reparto de columnas** `360px minmax(460px,1fr) 390px`. Dar más ancho al dibujo es quitárselo
  a configuración o a cotización: es una decisión de producto, no un ajuste, y merece tomarse a
  propósito y no como efecto colateral de arreglar el 2D.

## Suites

153 → **164 pruebas unitarias** (las 11 nuevas son `fitBox` y `cotaChain`, ambas enganchadas a
`test:unit`), **19 de build**, **9 de costeo**. Todas en verde. `eslint` limpio en los archivos
tocados.


---

# Estructura de la ventana · los seis componentes

Fecha: 2026-08-20.

## El diagnóstico

Marco, hoja y junquillo se pintaban los tres con `var(--frame)` y un filtro de brillo. En el 3D,
`frameMat`, `sashMat` y `beadMat` comparten `frameHex`. Tres piezas del mismo color con un 18 % de
diferencia de brillo no son tres piezas: son una masa. Y **el junquillo no se dibujaba en 2D**:
existía en el 3D y en la lista de corte, pero no en la vista donde se lee la estructura.

Físicamente es cierto — una ventana blanca es toda blanca — pero esto es una herramienta de diseño
técnico. Cada capa recibe ahora un tono **derivado** del color del folio, con su filo visible, así
que un bronce sigue siendo bronce y las dos vistas cuentan lo mismo.

Medido a 1366×768, las cuatro capas de una hoja de 122 px: **122 → 98 → 86 → 78**. Cada franja se
distingue de la siguiente por más de 2 px en los dos ejes, a 1366×768 y a 1280×720.

## Qué es medida y qué es convención de dibujo

Esta es la distinción que importa, y está atada con pruebas:

| | Origen | Prueba |
|---|---|---|
| **Vidrio** | `glassSizeMm`, la misma función con la que se compra | idéntico para todos los sistemas del catálogo |
| **Perfil** | complemento exacto del vidrio | `vidrio + perfil×2 = hoja` |
| **Junquillo** | **proporción de dibujo declarada**, no medida | no aparece en `lib/calc.ts` |

El junquillo no se puede medir con lo que hay: repartir esa franja necesita el ancho de cara del
perfil, y **`System.frame` y `System.sash` son precios por metro, no anchos**. El único ancho de cara
en la documentación de Aluplast es el 47,3 mm del Ideal IS, no atribuible al resto. Antes que
inventar un número de fabricación se dibuja como fracción del perfil, la leyenda lo dice y una
prueba comprueba que esa proporción no se cuela en el cálculo.

**Sobre la escala, sin exagerar**: los anchos se calculan a escala real, pero a tamaño de pantalla
caen casi siempre en su mínimo de legibilidad — un perfil de 15 mm en una ventana de 1800 dibujada a
242 px mide 2 px. El dibujo sirve para ver la estructura y seleccionar piezas; las medidas se leen
escritas: la cadena de cotas y, nuevo, **la medida del vidrio en la etiqueta de cada hoja**, marcada
en ámbar cuando el sistema no tiene descuento calibrado.

## Legibilidad

De 344 declaraciones de tamaño de letra, **192 estaban por debajo de 11 px y 117 por debajo de 10**:
catorce a 7 px, treinta y siete a 8, cuarenta a 9. 7 px no se lee, se adivina. Todo el extremo
pequeño sube 3 px conservando el orden, así que la jerarquía visual no cambia. Las anotaciones dentro
del dibujo se quedan aparte y más pequeñas, porque ahí el sitio lo fija el tamaño de la hoja.

Defecto que apareció al subir la letra, medido a 1280×720 y corregido: la hoja seleccionada estaba
exenta de retirar detalle y en una hoja de 71 px mostraba cinco etiquetas, **las cinco truncadas**.
Cinco ilegibles informan menos que una legible.

## Despliegue del 2026-08-20

Migraciones 0005, 0006 y 0007 aplicadas a la base de producción. Comprobado antes: las tres son
aditivas (ADD COLUMN con valor por omisión, CREATE TABLE, CREATE INDEX), ninguna borra datos. La
0005 crea un índice único de folio, que habría abortado con folios repetidos: se verificó en lectura
que producción tenía 10 proyectos, 3 con folio y **3 folios distintos**. Después de aplicar, los 10
proyectos siguen ahí.

Worker desplegado. Verificado: `/` → 401 (candado interno puesto), `/cotizar` → 200 sin importes,
`/api/projects` → «No autorizado.», y la hoja de estilos publicada trae `beadFrame`, `elevationKey`,
`paneTags`, `cotaSeg` y `cotaChain`.

**Va con la subida de precios de la calibración de Aluplast** (+3.68 % a +7.27 % en CORREDERA 96MM,
mediana +4.84 %). Decisión de dc, advertida dos veces antes de publicar.

## Defecto abierto: un asset viejo tapa la ruta de versión

`/api/version` **sin** barra final devuelve un identificador de un build anterior; **con** barra
devuelve el correcto. `worker/index.ts:45` atiende las dos formas, y el artefacto construido
contiene solo el sha nuevo, así que la petición sin barra no está llegando al worker: la capa de
assets la resuelve antes, con un archivo que quedó en el bucket de un despliegue viejo
(`wrangler deploy` informa «19 already uploaded»).

Mientras no se limpie, **la forma con barra es la autoritativa**:

```
curl -s https://luft-pvc-cotizador.luft-pvc.workers.dev/api/version/
```

No es cosmético: es exactamente el mecanismo que hizo perder una sesión entera revisando tres veces
un código ya corregido mientras el navegador miraba un build viejo. Merece purgar el bucket de
assets en el próximo despliegue y comprobar las dos formas.
