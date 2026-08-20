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
