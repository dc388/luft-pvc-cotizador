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
