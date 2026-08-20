# Documentación Aluplast · revisión del 2026-08-20

Se entregaron **110 archivos**. Deduplicados por contenido (md5): **39 únicos**, 172 MB. El resto son
copias exactas con sufijos `(1)`, `(2)`.

## Lo que se cargó en la aplicación

### Catálogo de folios · nueve colores dejan de llamarse como su código

De la lista de precios de 2022 la aplicación había heredado nueve folios cuyo nombre era su propio
código. A un arquitecto «BD» no le dice nada. `catalogo de folios 2025.pdf` los nombra, y
`información técnica_Folios.pdf` (aluplastmex, ed. 2019, emitida el 2020-08-28) añade la referencia
Renolit y **los códigos de pedido por una y por dos caras** — que conectan directamente con el
selector «Exterior / Interior / Ambas caras» que la ficha ya tenía.

| Código | Antes | Ahora | Renolit | 1 cara | 2 caras |
|---|---|---|---|---|---|
| jb | JB / Negro | Jet Black Matt | 446-6062 | 271 | 171 |
| ag | Gris antracita | Gris Antracita | 436-7003 | 260 | 160 |
| br | **BR** | Bronce | 436-6055 | 278 | 178 |
| bd | **BD** | Brown Decor | 436-5010 | 233 | 133 |
| nb | **NB** | Nusbaun (nogal) | 436-2035 | 227 | 127 |
| go | **GO** | Golden Oak (roble dorado) | 436-2036 | 223 | 123 |
| sh | **SH** | Sheffield | 456-3081 | 275 | 175 |
| soa | **SOA** | Woodec Sheffield Oak Alpine | 470-3002 | 220 | 120 |
| soc | **SOC** | Woodec Sheffield Oak Concrete | 470-3003 | 221 | 121 |
| tom | **TOM** | Woodec Turner Oak Malt | 470-3001 | 219 | 119 |
| sil | Silver | Aluminio Silver | 436-1001 | 234 | 134 |
| ceylon | Ceylon | Dark Chocolate Ceylon | 446-7069 | 261 | 161 |
| **ma** | *no existía* | **Mahagoni (caoba)** | 436-2002 | 205 | 105 |

**El factor de precio NO se tocó.** El catálogo de folios no lleva precios, y mezclar dos fuentes en
un mismo número es como se fabrican los errores silenciosos. Mahagoni entra con un factor prestado de
su familia (436-20xx, maderas) y **lo dice en su nota**, porque no tiene dato de precio propio.

**`dc` sigue sin nombre.** Es el único: no aparece ni en el catálogo 2025 ni en la ficha técnica de
folios. Queda marcado como pendiente de confirmar con aluplastmex.

Ocho pruebas nuevas lo fijan, incluida una que exige que todo folio con referencia Renolit traiga sus
dos códigos de pedido — si falta uno, ese folio no se puede pedir para una de las dos caras.

## Lo que ya estaba al día

`Lista de Precios IS_V1.2.2.2.xlsx` y `CALCULO DE MATERIAL SISTEMA IS v2.1.xlsx` ya se habían cargado
el 2026-08-19/20. Se volvieron a verificar contra el catálogo y **cuadran exactamente**:

```
Marco de 58 mm 2 rieles IS       1.71 EUR/m  x 21.8  =  37.3  ->  catálogo: frame 37
Hoja corrediza c/felpillo 19 mm  1.20 EUR/m  x 21.8  =  26.2  ->  catálogo: sash  26
```

También el descuento de soldadura (3 mm por extremo soldado) y el junquillo del IS (`hoja − 89`).

## Lo que NO se cargó, y por qué

### La Puerta IS · hay precios, faltan medidas

La lista trae una **segunda sección completa** que la aplicación no tiene:

| Código | Descripción | EUR/m | x 21.8 |
|---|---|---|---|
| 020074 | Marco 93.5 mm mono riel IS | 2.79 | 61 |
| 020075 | Hoja 27.8 mm p/puerta IS | 1.62 | 35 |
| 020076 | Hoja traslape 35.1 mm p/puerta IS | 2.13 | 46 |
| 227174 | Riel alum p/puerta IS | 2.40 | 52 |
| 620078 / 622078 | Broche puerta IS (bl / neg) | 3.69 | 80 |
| 020073 | Junquillo para sistemas IS | 0.27 | 6 |
| 729076 | Junta felpillo p/puerta IS | 0.27 | 6 |

**No se cargó.** Un sistema del catálogo necesita además `maxW`, `maxH`, `glazing` y `rails`, y esos
salen del plano `11 Puerta IS.pdf`, que **no tiene una sola letra de texto extraíble**: es vector
puro. Inventar esos cuatro números es exactamente el error que ya se cometió una vez en esta serie de
cambios, cuando el IS entró con `glazing: 24` en un sistema que acepta 6.

Para cargarla hacen falta cuatro datos: **ancho máximo, alto máximo, espesor de acristalamiento
admitido y número de rieles.** Con eso se carga en una sesión.

### El junquillo por sistema · la lámina no se puede leer por texto

`14 Junquillos.pdf` es una lámina DIN A0 con el catálogo de junquillos: da códigos (120638, 120738,
120840, 130887, 130889, 120851…) y alturas de galce (40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18,
16, 14, 12, 18.5, 10.5). Las fichas mexicanas de cada sistema traen la tabla que los relaciona
—`Galce de vidrio | Junquillo + Junta | Espesor de acristalamiento`— y se alcanzaron a ver fragmentos
correctos, por ejemplo en MULTI SLIDE 96: galce 22 → junquillo 120636 → vidrio 18-19 mm, y
120835 → 20-21 mm «Estándar».

**No se cargó.** Son planos CAD con texto rotado: `pypdf` avisa «Rotated text discovered. Output will
be incomplete», y la reconstrucción por coordenadas devuelve la tabla partida. Una tabla de
fabricación reconstruida a medias no es un dato, es una trampa. Esto se resuelve abriendo la lámina y
leyéndola, o pidiendo la tabla en formato de datos.

Mientras siga así, el junquillo del dibujo 2D permanece como **proporción de dibujo declarada**, que
es lo que la leyenda ya dice y lo que una prueba impide que se cuele en el cálculo.

## Inventario de los 39 documentos únicos

### Manuales de elaboración (grandes, no leídos completos)
| Documento | Páginas | Estado |
|---|---|---|
| HB_IDEAL_Manual_de_Elaboracion_General_VM_spanish | 225 | pendiente |
| HB_IDEAL_2000_VM_Verarbeiter_de_Deutsch_2026-01-07_hoja105mm | 197 | pendiente · **edición 2026**, la más nueva de todo el lote |
| Manual de Elaboración Elevadora 70 | 181 | pendiente |
| HB_IDEAL_2000_VM_Verarbeiter_es_Spanisch 2019-04 | 177 | pendiente |
| HB_Schiebefenster_easy-slide_en 2023-09 | 124 | ya usado para las tablas de deducción |
| HB_Schiebefenster_multi-slide_en 2023-11 | 75 | ya usado para las tablas de deducción |
| Reinigungsempfehlungen_ES (limpieza) | 25 | no es dato de la aplicación |

### Fichas de sistema · México
`MULTI SLIDE _96_MX_X`, `CORREDERA_60N+MONORIEL_MX-Model_X`, `ELEVADORA_70mm_MX_X`, `IDEAL 2000_MX_X`,
`IDEAL_4000 Actualizado_2025`, `Multi-Slide USA2013`, `Manual Mono-Riel MEX`, `REFUERZOS_MX_X`,
`PERFILES ADICIONALES-1-2-ACCESORIOS_MX_X`. Todas son láminas de una página con el texto rotado:
sirven para verificar códigos de perfil, no para extraer tablas por programa.

### Herrajes y accesorios
`Riel Plano y Unión Mecánica 600197`, `Umbral_Union_Lateral`, `Esquinas Soldables`, `CIERRE CENTRAL_96`,
`100076+1000372`, `100076+1000374`, `rueda-18m.dxf`, `rueda-18mm-con-orejas.dxf`.

### Planos del sistema IS
`10 Ventana IS`, `11 Puerta IS`, `14 Junquillos`, más los ZIP `Ventana IS` (48 MB) y `Puerta IS`.

### Planos de puerta corrediza línea 96 · hoja 86 mm
`XO-sildingDoor` y `XXXXM-sildingDoor`, con rueda y con *hidden track*, en DWG y PDF. **Configuración
que la aplicación no tiene**: hoja de 86 mm y riel oculto. Mismo caso que la Puerta IS — hay plano,
faltan los datos de catálogo.

### Comprimidos sin abrir
`ACTUALIZACION TECNICA.zip` (3.5 MB), `informaciontecnica.zip` (3.9 MB), `Ventana IS.zip` (48 MB),
`Puerta IS.zip` (7.7 MB).

## Nota de seguridad

La `Lista de Precios IS` trae en sus filas 42-44 **datos bancarios de aluplastmex** (cuenta, SWIFT,
banco). No se han copiado a ningún archivo del repositorio, ni se copiarán: los datos bancarios no
viven en el código. Se apunta aquí solo para que se sepa que ese archivo los contiene.

## Sobre el banner de aludec

La imagen compartida anuncia **aludec**, el acabado con aspecto de aluminio y tacto agradable. No es
dato cargable: no trae códigos, referencias ni precios. Si va a venderse, hace falta su ficha con
código de folio o de perfil y su factor de precio, y entonces entra en `data/colors.ts` como una
entrada más.


---

# Correcciones del 2026-08-20 (segunda pasada)

Al revisar la documentación aparecieron errores propios. Van corregidos.

## El junquillo del IS estaba mal atribuido · afectaba la lista de corte

`beadFor("IDEAL IS · Corredera mx")` devolvía un descuento de **89 mm**, citando «el plano del
sistema, junto a 93,5 del marco y 27,8 de la hoja». La lista de precios lo desmiente:

| Código | Descripción | Sistema |
|---|---|---|
| 020070 | Marco de **58 mm** 2 rieles IS | **VENTANA** |
| 020071 | Hoja corrediza c/felpillo de **19 mm** | **VENTANA** |
| 020074 | Marco **93.5 mm** mono riel IS | **PUERTA** |
| 020075 | Hoja **27.8 mm** p/puerta IS | **PUERTA** |

El 93,5 y el 27,8 son de la **puerta**. El 47,3 de cara de junquillo con el que se calculó el 89
sale de ese mismo plano, así que el 89 es de la puerta, no de la ventana.

Y la geometría lo remata, con hoja de 800 mm:

```
vidrio     descuento 19.4 mm  ->   9.7 mm por lado
junquillo  descuento 89   mm  ->  44.5 mm por lado
=> el junquillo quedaría 34.8 mm POR DENTRO del vidrio que sujeta
=> y no cabe: la cara de la hoja de la ventana mide 19 mm
```

**Consecuencia real:** la lista de corte de la ventana IS cortaba el junquillo 89 mm corto. Ahora el
sistema queda **sin calibrar** (descuento 0, el junquillo sale a la medida de la hoja) y el reporte
de corte lo advierte. Es mejor avisar de que falta el dato que equivocarse con confianza. El 89 se
conserva como `PUERTA_IS_BEAD_DEDUCTION_MM`, para cuando ese sistema exista en el catálogo.

**La prueba que faltaba** ya está: ningún sistema puede tener un descuento de junquillo mayor que el
de su vidrio. Es una regla geométrica, no depende de ningún documento, y habría cazado esto el primer
día. Y la prueba que *afirmaba* el error —exigía junquillo de 759 mm— también estaba mal, así que se
corrigió: una prueba que fija un dato imposible de fabricar no protege nada.

## Tres defectos menores, del mismo día

- **Pie del lienzo vacío en 3D y en Sección.** El `<div>` se dibujaba siempre; con la leyenda y la
  pista ausentes quedaba una franja de 40 px con su borde, quitándole alto al dibujo para no mostrar
  nada. Ahora solo existe si tiene contenido.
- **`.specChip` muerto en el CSS.** Su contenido subió a la cabecera como `.visualSystem`; quedaban
  tres reglas sin elemento.
- **`/api/version` tapado por la capa de assets.** Los assets responden antes que el worker, así que
  la petición sin barra final no llegaba a la ruta. Corregido en `wrangler.jsonc` con
  `assets.run_worker_first: ["/api/*"]`: una ruta de API no es un archivo.

  **Verificado, y con una advertencia sobre cómo verificarlo.** Justo después de desplegar, la forma
  sin barra seguía devolviendo el identificador anterior y lo tomé por defecto persistente — era
  propagación. Comprobado luego con 18 llamadas, 12 sin barra y 6 con barra: **todas devuelven el
  commit desplegado**. Sobre este defecto me adelanté dos veces, una dándolo por resuelto solo y otra
  dándolo por no resuelto; la lección es que este endpoint hay que medirlo con varias llamadas y
  dejando pasar la propagación, no con una sola justo tras el deploy.


---

# Tercera pasada · lo que estaba dentro de los comprimidos

**dc tenía razón:** declaré «no cargable por falta de datos» dejando cuatro ZIP sin abrir, uno de
ellos llamado `Puerta IS.zip`. Los cuatro datos que dije que faltaban estaban ahí dentro.

## La Puerta IS, cargada

| Dato | Valor | Documento |
|---|---|---|
| Medidas máximas | **2000 × 2000 mm** | `HB_Schiebetür_sliding_door_mx-Modell.pdf`, pág. 2 |
| Galce | **hasta 6 mm** | `1Flyer IDEAL IS CORREDERAPUERTA.pdf`, ed. 10/2024 |
| Profundidad de perfil | **93,5 mm** | el mismo folleto, y el plano |
| Rieles | **1 (mono riel)** | lista de precios, código 020074 |
| Térmico | **Uf 1,6 · Uw 4,10 W/m²K** | el mismo folleto |
| Precios | marco 61, hoja 35, herraje 80 MXN | lista de precios × 21.8 |

Entra como **Corredera**, no como «Puerta»: la categoría «Puerta» reparte hojas abatibles y ésta es
corrediza. Verificado en pantalla: ofrece Fijo, Corrediza, Corredera elevadora, Plegable corrediza,
Corredera fija e Inactiva.

**Sin descuentos propios inventados.** No tiene entrada en `glazingFor` ni en `leafSizingFor`, así que
su vidrio y su hoja van por el modelo genérico y el pedido de vidrio lo advierte. El plano trae sus
fórmulas de reparto en la página 6 —`(B/2)−73,6`, `(B/2)+27`, `(B/2)−93`, `(B/2)−74,3`, `(B/2)−93,7`—
pero decidir qué letra es la hoja corredera y cuál el panel fijo con el texto desordenado del CAD es
adivinar, y de eso salió un error esta misma semana.

## Corrección: el IS SÍ tiene valor U publicado

El campo `uf` de la ventana decía **«sin requisito de valor U»**. El folleto comercial (ed. 10/2024,
dentro de `Ventana IS.zip`) publica **Uf 1,6 · Uw 4,52 W/m²K**, junto con 58 mm de profundidad, galce
hasta 6 mm y medidas máximas 1500 × 1500 — que confirman lo que ya estaba cargado.

**Los dos documentos no se contradicen**, y por eso el campo dice ahora las dos cosas: el plano de
liberación 020072-01 declara «no requirement for […] U-value […] and certification» —o sea que se
liberó **sin requisito de certificación**— mientras el folleto publica valores **calculados**.
Ocultar el valor engaña a quien busca el dato térmico; exhibirlo a secas engaña a quien necesita una
clasificación certificada.

La prueba que exigía que el campo **no** mostrara ningún valor también estaba mal. Ahora exige las
dos afirmaciones a la vez, para los dos sistemas IS.

El folleto añade dos datos más, ya cargados en `chambers`: **«no requiere refuerzo»** y **«pegado de
vidrio a la hoja»**. El «ni riel» del folleto no contradice el `rails: [2]` de la ventana: su marco
020070 trae los dos carriles moldeados y no necesita riel de aluminio aparte, al contrario que la
puerta, que sí lleva el 227174.

## Lo que sigue pendiente, ahora sí con los archivos abiertos

- **Descuento de vidrio y dimensionado de hoja de la Puerta IS**: las fórmulas están en la página 6
  del plano, en texto CAD desordenado.
- **Tabla de junquillo por sistema**: sigue en las láminas A0 con texto rotado.
- Sin abrir por irrelevantes para datos: las 20 fotos de herrajes y detalles de `Ventana IS.zip`, los
  DXF de geometría de perfil, y `COMPARACION_ALUPLAST_IS_VS_ALUMINIO_SIN_RPT.pdf` (material
  comercial).

## Lección

Declarar que un dato no existe es una afirmación fuerte, y la hice con cuatro comprimidos sin abrir.
Antes de decir «falta el dato» hay que haber abierto todo lo que se recibió.


---

# Cuarta pasada · las tablas de deducción estaban en los manuales

Buscando dentro de los comprimidos aparecieron las **tablas de deducción completas** de los dos
sistemas IS, en ediciones más nuevas que cualquier otra fuente del lote.

## Ventana IS · confirmada por su propio manual (ed. 2025-10)

`Manual_ventana_corredera_sliding_window_mx_sp.pdf`, págs. 6 a 8, «Medidas de deducción
020070 + 020071 + 020072», Esquema A:

```
ANCHOS    hoja    C  = (B/2) − 52,2      vidrio  E  = (B/2) − 71,6     ⇒ 19,4
          fijo    Cf = (B/2) − 52,2      vidrio  Ef = (B/2) − 71,6     ⇒ 19,4
ALTURAS   hoja    I  = H − 74            vidrio  K  = H − 93,4         ⇒ 19,4
          fijo    If = H − 74            vidrio  Kf = H − 93,4         ⇒ 19,4
```

**No cambia nada: confirma lo que ya estaba cargado** (52,2 · 74 · 19,4) desde un documento
independiente y posterior. La tabla no tiene fila de junquillo.

## Puerta IS · su plano da la tabla (ed. 2025-11)

`HB_Schiebetür_sliding_door_mx-Modell.pdf`, págs. 6 a 8, «Abzugsmaße», 020074 + 020075 + 020076:

```
ANCHOS    hoja    C  = (B/2) − 73,6      vidrio  E  = (B/2) − 93       ⇒ 19,4
          fijo    Cf = (B/2) − 74,3      vidrio  Ef = (B/2) − 93,7     ⇒ 19,4
ALTURAS   hoja    I  = H − 157,8         vidrio  K  = H − 177,2        ⇒ 19,4
          fijo    If = H − 56,8          vidrio  Kf = H − 76,2         ⇒ 19,4
```

Esto obligó a **ampliar el modelo**: la hoja corredera descuenta **157,8 mm** de alto y el campo fijo
**56,8** — 101 mm de diferencia. `LeafSizingSpec` pasa de dos números a cuatro, y
`flattenToLeafFrames` elige según si la hoja es móvil o fija. Aplicarle a un panel fijo el descuento
de la hoja móvil lo dejaría 101 mm corto, y eso se corta, se suelda y se paga.

En la ventana los dos pares coinciden, así que **no se movió ni un milímetro** ahí; hay una prueba
dedicada a garantizarlo. Comprobado además que los otros 22 sistemas siguen por el modelo genérico:
240 casos recorridos sin cambio.

Verificado contra el manual con B=1800 y H=2000:

| | Calculado por la app | Manual |
|---|---|---|
| Hoja corredera | 826,4 × 1842,2 | (B/2)−73,6 × H−157,8 |
| Campo fijo | 825,7 × 1943,2 | (B/2)−74,3 × H−56,8 |

## Lo que sigue sin aparecer

La **tabla de junquillo por sistema**. Ninguno de los dos manuales IS tiene fila de junquillo: sus
tablas van Elemento · Acristalamiento · Hoja · Ancho/Altura libre, y ahí no está. Sigue viviendo en
las láminas A0 con texto rotado (`14 Junquillos.pdf` y las fichas mexicanas), y ese formato no se
reconstruye de forma fiable por programa.

Los manuales grandes que quedan sin abrir por tamaño —el general de elaboración de 225 páginas, el
IDEAL 2000 alemán ed. 2026-01, la Elevadora 70— son los únicos sitios donde podría estar. Un barrido
de texto sobre los 39 PDF se pasó de los 10 minutos sin terminar.
