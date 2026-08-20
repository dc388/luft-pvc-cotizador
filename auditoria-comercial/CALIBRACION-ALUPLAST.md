# Estado de calibración contra la documentación de Aluplast

Fuente: ZIP `ALUPLAST-20260819T194651Z-1-001.zip` entregado por dc el 2026-08-19, confirmado por él
como «justo como fabricamos y la información técnica que usamos para todo».

---

## 1. Aplicado

| Dato | Valor | Fuente | Efecto |
|---|---|---|---|
| **Descuento de soldadura** | **3 mm por extremo** (+6 total) | `CALCULO DE MATERIAL SISTEMA IS v2.1`, celda F5, aplicada como `Medida Final + (F5*2)` | Marco 2400→2406, hoja 1202→1208. Solo piezas a 45°. Cierra **D-06** |
| **Criterio de a qué piezas se aplica** | Solo a 45°; las de 90° y los junquillos van a su medida | Misma hoja: el traslape vertical del fijo (90°) y los junquillos usan «Medida Final» directa | Travesaño sin cambio. Era el criterio que faltaba |
| **Ángulo del junquillo** | **45°**, no 90° | Misma hoja, columna «Corte» | Corregido en todos los sistemas. Mitad de **D-09** |
| **Descuento de vidrio, corredera** | **30 mm** | Seis tablas «Deduction dimensions»: multi-slide 2023-11 págs. 24/27/88/89 y easy-slide 2023-09 págs. 55/57 | CORREDERA 96MM calibrada. Precios +3.68% a +7.27% |
| **Pie del reporte de corte** | Dice lo que hace | — | Cierra **D-07**: antes afirmaba validar ángulos y soldadura sin hacerlo |

**Impacto de la soldadura en precio: ninguno.** De 805 casos dorados solo cambia la merma, y baja
(2.770→2.746). `bars`, `direct`, `sale` y `total` idénticos. `profileCost` sale de metros netos con
`DEFAULT_WASTE_PCT`, que ya absorbe el material consumido de más; sumarlo también ahí sería contarlo
dos veces.

---

## 2. HALLAZGO PRINCIPAL: el manual mexicano en español

Dentro de `Ventana IS.zip` estaba `Manual y Especificaciones/Manual_ventana_corredera_sliding_window_mx_sp.pdf`:
**«Ventana corredera mx», sliding-window mx, edición 2025-10**, en español, con las tablas de
«Medidas de deducción» completas y la leyenda escrita, no concatenada.

### Anchos — pág. 6, Esquema A, perfiles 020070 + 020071 + 020072

```
Elemento                         B
Apertura libre               D = (B/2) − 12,9      Df = (B/2) − 12,9
Hoja                         C = (B/2) − 52,2      Cf = (B/2) − 52,2   (campo fijo)
Acristalamiento              E = (B/2) − 71,6      Ef = (B/2) − 71,6   (campo fijo)
                                 (B/2) − 48,3  = Ancho libre de la hoja corredera
¡Añadir soldadura!
```

### Alturas — págs. 7 y 8

```
Elemento                     H
Altura libre de la hoja      J  = H − 35      Jf = H − 35
Hoja                         I  = H − 74      If = H − 74
Acristalamiento              K  = H − 93,4    Kf = H − 93,4
¡Añadir soldadura!
```

### Lo que sale de ahí

| Dato | Valor | Consistencia |
|---|---|---|
| **Vidrio = Hoja − 19,4 mm** | 71,6 − 52,2 = **19,4** (ancho) · 93,4 − 74 = **19,4** (alto) | Idéntico en los cuatro ejes, y también para el campo fijo |
| **Hoja, ancho** | `(B/2) − 52,2` | — |
| **Hoja, alto** | `H − 74` | — |
| **Soldadura** | «¡Añadir soldadura!» impreso en las tres tablas | Confirma lo ya implementado |
| **Máximo del sistema** | 1500 × 1500 mm (la puerta: 2000 × 2000) | pág. 2 |
| **Perfiles** | 020070 Marco · 020071 Hoja · 020072 Hoja con cierre central integrado · 020073 Junquillo | pág. 2 |

**Nótese que no es 30 mm.** Los manuales europeos de multi-slide y easy-slide dan 30; este sistema
mexicano da 19,4. Sistemas distintos, números distintos — que es exactamente la razón por la que una
constante única no podía funcionar.

### Y confirma la sospecha de la sección 3.2, con fuente en español

```
Aluplast (sliding-window mx 2025-10)   Hoja = (B/2) − 52,2
La aplicación (CORREDERA 60MM)         Hoja = (B/2) + 2
```

Para B = 1800: Aluplast **847,8** contra los **902** de la aplicación. La hoja de la aplicación es
**~54 mm más ancha** de lo que especifica el fabricante, y dos hojas de 902 en un marco de 1800 suman
1804 mientras que dos de 847,8 suman 1695,6, que sí cabe dentro del marco.

Sigue sin aplicarse porque son **sistemas distintos**: el manual es del IS / sliding-window mx, y la
aplicación cotiza CORREDERA 60MM del catálogo de 2022. Pero la dirección del error ya no es una
sospecha, y el orden de magnitud es el mismo.

---

## 2.7 El sistema IS, calibrado con los planos de liberación (2026-08-20)

Los `KS-Konstruktionsfreigabe` --los planos de liberación de construcción, que son el documento de
ingeniería con el que Aluplast aprueba un sistema-- traen los datos que la ficha de usuario no
publica. Y corrigen dos cosas que yo había puesto mal.

### Espesor de vidrio: era 24, es 6

```
020072-01  sliding-window mx   "glazing bead for 3mm glass"   "laminated is not planned"
020074-01  sliding-door mx     "glazing bead for 6mm glass"   "laminated is not planned"
```

Los dos usan el **mismo junquillo 020073**. Seis milímetros es el máximo que respalda cualquier
documento del sistema, así que ése es el valor.

Yo lo había puesto en **24** --el máximo del catálogo de vidrio-- para «no bloquear nada por error».
Era un error grave y del mismo tipo que D-01: permitía cotizar un DVH de 24 mm en un sistema que
acepta 6, y el vidrio a medida no se devuelve.

Efecto de la corrección, medido: de las 10 partidas del catálogo de vidrio ahora **caben 3** (las de
6 mm). Antes cabían las 10.

**Pendiente menor:** el vidrio más delgado del catálogo de la aplicación es de 6 mm. Si el taller
acristala este sistema con 3 mm --que es lo que dice el plano de la ventana-- hay que agregar esa
partida a `data/glass.ts`.

### El herraje sí estaba completo, y ahora se sabe por qué

El plano 020072-01 lista los accesorios nuevos del sistema:

```
locking part  620075   (ap-Mexico lo compra directo a proveedor chino)
roller        620076   (ap-Mexico lo compra directo a proveedor chino)
brush-seal    729075
```

Y anota que **el rodamiento 620076 sirve además de separador para la hoja fija**, así que no hay una
tercera pieza. Eso explica por qué la lista de precios de Aluplast solo trae dos: son esas dos,
bajo sus nombres mexicanos (cerradero media luna y carro p/hoja). El paquete de 39 MXN está
completo para las piezas fijas.

Lo que sigue impreciso no es del IS: sobre ese 39 el motor suma las estimaciones planas y sin
calibrar de `hardwareLeafCount * 110` y `rail * 165`, que son **D-12** y afectan a todos los
sistemas.

### Lo más importante: este sistema no tiene prestaciones certificadas

El plano 020072-01 lo dice literalmente:

> `no requirement for compatibility, U-value, water resistance, wind load, burglary resistance and certification`

Aluplast liberó el IS **sin requisitos** de valor U, estanqueidad al agua, resistencia al viento ni
certificación. Es una línea económica para competir con aluminio sin RPT --lo confirma el propio
`COMPARACION_ALUPLAST_IS_VS_ALUMINIO_SIN_RPT.pdf` del paquete.

**Consecuencia directa para el objetivo de que un arquitecto diseñe con él:** no se puede especificar
donde se exija clasificación NMX-R-060 ni prestación térmica o acústica declarada. Sirve para
proyectos donde el requisito es cerrar el vano a buen precio, no para uno donde haya que declarar
desempeño.

El campo `uf` del sistema dice ahora «sin requisito de valor U (liberado sin certificacion)» en lugar
de exhibir un número. Una prueba impide que alguien le ponga un valor `W/m²K` que el fabricante no
declara.

### Medidas máximas: resuelto, manda el manual

```
020072-01 rev 03   "max. sizes 1200 x 1200 mm"
manual ed. 2025-10  max. 1500 mm      <- este
```

**Decisión de dc el 2026-08-20: «ajusta las cosas al manual».** Queda en 1500. Refuerza la decisión
que en la puerta los dos documentos **sí** coinciden (2000 y 2000), lo que sugiere que el 1200 del
plano quedó superado por una revisión posterior.

### Por qué este sistema tiene especificaciones distintas a todos los demás

Es una **configuración especial de línea económica, para vivienda de interés social**: más barata,
sin prestaciones certificadas, y de volumen bajo comparado con el resto del catálogo. De ahí que su
galce acepte 6 mm donde otros aceptan 24 o 52, que no declare valor U, y que su medida de hoja se
exprese con un descuento directo en lugar del modelo de asiento y traslape.

**No es una anomalía a corregir: es lo que el sistema es.**

### Verificación de que no entra en conflicto con la aplicación

dc pidió no agregarlo si creaba un conflicto grave. Se comprobó, y no lo crea:

| Riesgo | Resultado |
|---|---|
| Su dimensionado propio contamina a otros sistemas | **No.** Aislado en `leafSizingFor`; los otros 20 dan salida idéntica (741 claves doradas sin cambios) y una prueba impide que alguno gane dimensionado propio por accidente |
| `frameSeatMm`/`centerOverlapMm` en 0 rompen algo | **No.** El único lector es `lib/tree.ts`, y solo cuando el sistema no trae dimensionado propio |
| Se pueden diseñar aperturas imposibles | **No.** `allowedWingsFor` lo restringe a corredera por su categoría y sus rieles |
| Se puede cotizar vidrio que no cabe | **No.** El editor avisa: «supera el galce de referencia (6 mm)». Verificado en pantalla |
| Se puede exceder su medida máxima sin darse cuenta | **No.** Avisa: «supera el límite de referencia 1500 × 1500 mm» |
| Un arquitecto le atribuye prestaciones que no tiene | **Cubierto.** Prestaciones del sistema muestra «Valor Uf: sin requisito de valor U (liberado sin certificación)» |
| Se filtra al cotizador público | **No.** Lista blanca en `lib/publicCatalog.ts`, con prueba dedicada |

**Conclusión: se queda.** Se integra en la red de seguridad que la aplicación ya tenía, sin
necesidad de mecanismos nuevos.

---

## 3. Encontrado en los manuales pero NO aplicado, y por qué

### 3.1 El descuento del junquillo: 89 mm

La hoja da `junquillo = hoja − (47.3 − 2.8) × 2 = hoja − 89`. El 47.3 es el ancho de cara del perfil
y el 2.8 el solape del galce — la misma estructura del descuento de vidrio.

**No se aplicó** porque ese dato es del sistema **Ideal IS**, que todavía no existe en
`data/catalog.ts`. Atribuirlo a CORREDERA 60MM o a IDEAL 2000 sería inventar. El parámetro existe ya
(`beadFor`), vale 0 sin calibrar, y el reporte de corte lo advierte.

### 3.2 La medida de la hoja corredera — CONFIRMADO por el manual mexicano, ver sección 2

Las tablas de Aluplast dan, para dos hojas:

```
multi-slide 80   Sash C = (B/2) − 158
easy-slide       Sash C = (B/2) − 121
```

La aplicación calcula, para CORREDERA 60MM de 1800 mm:

```
fabW = (B/2) − frameSeatMm + centerOverlapMm/2 = 900 − 8 + 10 = 902 = (B/2) + 2
```

O sea: Aluplast resta entre 121 y 158 mm donde la aplicación **suma** 2. Y dos hojas de 902 en un
marco de 1800 suman 1804 — más ancho que el propio elemento, lo que físicamente no cierra si las
hojas corren dentro del marco.

**Sospecha:** el modelo de hoja corredera omite el ancho de cara del marco, igual que el vidrio lo
omitía. Si es así, la aplicación sobreestima metros de hoja, superficie de vidrio y lista de corte, y
por tanto el precio.

**Por qué no lo cambié:** el valor absoluto depende de qué es `B` en la tabla de Aluplast, y la
extracción de texto no lo resuelve con certeza (podría ser el elemento o el vano). Lo que sí es
seguro es la *diferencia* vidrio−hoja = 30 mm, porque no depende de `B`. Cambiar el dimensionado de
hoja sin certeza movería metros de perfil, vidrio, corte y precio a la vez.

**Cómo se resuelve en dos minutos:** medir el ancho de una hoja en una corredera de dos hojas ya
fabricada de 1800 mm de ancho. Si mide ~902 la aplicación está bien; si mide ~740–780, está mal y
hay que corregir `frameSeatMm` / `centerOverlapMm` con el ancho de cara del marco.

### 3.3 `centerOverlapMm` sigue siendo un placeholder

El código lo declara «PLACEHOLDER pending Aluplast's fabrication datasheet». Los datasheets ya
están, pero mientras no se resuelva 3.2 no tiene sentido calibrar la mitad del modelo.

---

## 3.4 El tema de los junquillos, cerrado con lo que hay

De `14 Junquillos.pdf` (edición 2020-11) y del manual mexicano:

**1. La selección del junquillo es por espesor de acristalamiento.** El catálogo cruza alturas de
junquillo de **10 a 40 mm en pasos de 2** contra rangos de espesor de vidrio (3-4, 6-8, 10-11, 12-13,
… hasta 58-59 mm). La aplicación **no implementa nada de esto**: el junquillo es solo una categoría
de la lista de corte, sin código ni altura.

Hay materia prima en el modelo de datos para hacerlo: `glassCatalog` ya guarda `thickness` por vidrio
y `System.glazing` es el espesor máximo que acepta el galce. Falta la tabla exacta de rangos, que en
el PDF está dispuesta espacialmente y la extracción de texto no permite reconstruir con seguridad.

**2. Accesorios que cambian el galce**, y que la aplicación tampoco modela:
`Prolongador de galce de vidrio` (h = 10 mm) y `Adaptador de junquillo` (h = 10 mm). Con ellos, un
mismo perfil acepta espesores distintos.

**3. El descuento de longitud sigue siendo por sistema.** El único documentado es el de la puerta IS:
`junquillo = hoja − (47.3 − 2.8) × 2 = hoja − 89`, a 45°. El 47.3 es el ancho de cara del perfil
020073 y aparece confirmado en el plano del sistema (`HB_Schiebetür_sliding_door_mx`, pág. 2, junto a
93.5 del marco, 27.8 de la hoja y 35.1 del traslape).

**Estado en el código:** el ángulo ya está corregido a 45° para todos los sistemas. El descuento de
longitud existe como parámetro por sistema (`beadFor`), vale 0 sin calibrar, y el reporte de corte lo
advierte. No se calibra ninguno porque el único dato disponible es del sistema IS, que no está en
`data/catalog.ts`.

---

## 3.5 El sistema IS es el que se fabrica hoy, y no está en la aplicación

Los zips lo dejan claro. `Ventana IS.zip` y `Puerta IS.zip` traen, para el sistema
**sliding-window mx / sliding-door mx**:

- Manual de fabricación en español, edición **2025-10** (ventana) y alemán **2025-11** (puerta)
- Tablas de deducción completas, que es lo que ningún otro sistema del paquete tiene
- Planos de liberación de construcción (`KS-Konstruktionsfreigabe`) de los perfiles 020070, 020072,
  020074, 020075, 020076
- CAD en DWG y DXF de cada perfil, del riel de aluminio y de la contraforma
- `SB0003 Schweißzulage` — la hoja de descuento de soldadura del fabricante
- Fotos de la ventana fabricada y de sus herrajes
- Hoja de cálculo de material con las fórmulas de despiece
- **La única lista de precios nueva del paquete** (`Lista de Precios IS_V1.2.2.2.xlsx`)
- `COMPARACION_ALUPLAST_IS_VS_ALUMINIO_SIN_RPT.pdf` — material comercial contra aluminio

Es, con diferencia, el sistema mejor documentado del paquete, y el único con precios actualizados.
**No existe en `data/catalog.ts`**, que sigue con los 12 sistemas Aluplast de la lista de 2022.

Añadirlo bien es la pieza de mayor valor pendiente, y requiere decisión: su modelo de hoja
(`(B/2) − 52,2` en ancho, `H − 74` en alto) **no es el modelo genérico de la aplicación**
(`frameSeatMm` / `centerOverlapMm`), así que o se generaliza el modelo o el sistema se trata aparte.

---

---

---

## 4. Supuestos de la carga anterior: qué confirma y qué no la documentación nueva

| Supuesto | Estado tras la documentación nueva |
|---|---|
| **`EUR_MXN = 21.8`** | **RESUELTO como decisión de negocio, no como defecto.** dc lo fijó el 2026-08-19: es el tipo que maneja la marca, deliberadamente por encima del spot (~19.68) como colchón contra la variación del peso entre cotizar y comprar. Queda documentado en el código y **fijado con una prueba** para que no se mueva por descuido. Ojo a la interacción con `IMPORT_FACTOR`: ver la fila siguiente |
| **`IMPORT_FACTOR = 1.0`** | **Confirmado como subcosteo**, y ahora con una consecuencia importante. La lista nueva vuelve a decir «PRECIOS EX WORK ALUPLASTMEX-VERACRUZ»: el precio se detiene en el muelle. Como `EUR_MXN` se mantiene 10.8% por encima del spot, **el colchón del tipo de cambio está compensando en parte, y sin medirlo, lo que este factor debería recoger.** Bajar el tipo de cambio a spot dejando este factor en 1.0 quitaría el colchón sin poner nada en su lugar. Los dos se revisan juntos o no se revisan |
| **Lista de precios rev. ABR_22 (2022)** | **No se reemplaza.** `Lista de Precios IS_V1.2.2.2.xlsx` tiene **una sola hoja, «Ideal IS»**: es una orden de material de ese sistema, no un catálogo completo. La de 2022 sigue siendo la única lista con los 278 perfiles. **D-05 sigue abierto** |
| Descuento de vidrio de 120 mm | **Desmentido** para correderas. Ver sección 1 |
| Junquillos a 90° y a la medida de la hoja | **Desmentido**. Ver sección 1 |
| «El reporte valida ángulos y soldadura» | **Era falso**. Corregido |

---

## 5. Lo que el ZIP trae y todavía no se ha explotado

- **`Ventana IS.zip` (49 MB)** y **`Puerta IS.zip`** — sin abrir. Probablemente traen la ficha completa
  del sistema IS, que es el que la lista de precios nueva cotiza.
- **`ACTUALIZACION TECNICA.zip`** — sin abrir.
- **`14 Junquillos.pdf`** — catálogo de junquillos de 10 a 32 mm, cada uno con su junta. Es la pieza
  que define el galce; sirve para calibrar 3.1 por sistema.
- **`REFUERZOS_MX_X.pdf`** — refuerzos. Hoy el costeo usa una estimación plana de 78 $/m cuando no
  hay código de refuerzo (D-12).
- **`catalogo de folios 2025.pdf`** e **`información técnica_Folios.pdf`** — colores/folios 2025. El
  catálogo de la app tiene 18 códigos de color; conviene contrastarlo.
- **`Esquinas Soldables.pdf`**, **`CIERRE CENTRAL_96.pdf`**, **`Umbral_Union_Lateral.pdf`**,
  **`Riel Plano y Unión Mecánica 600197.pdf`** — detalles de herraje y unión.
- **El sistema Ideal IS no existe en `data/catalog.ts`.** Es el único con lista de precios nueva y con
  hoja de cálculo de material. Si es lo que se vende hoy, falta en la aplicación.

---

## 6. Notas de método

- Los PDFs de ficha por sistema (`CORREDERA_60N+MONORIEL_MX-Model_X.pdf`, `IDEAL 2000_MX_X.pdf`,
  `ELEVADORA_70mm_MX_X.pdf`, `MULTI SLIDE _96_MX_X.pdf`) son **planos CAD**: el texto sale
  fragmentado y se pierde la relación entre etiqueta y cota. No sirven para extracción automática.
- El **manual español de IDEAL 2000** (268 págs.) y el **general de elaboración** (145 págs.) son de
  *procesamiento* —drenaje, calzos, sellado, adhesivado—, no de despiece. Sí aportan un dato:
  mínimo **5 mm** entre el fondo del galce y el canto del vidrio.
- El manual de **Elevadora 70** dice en pág. 95 «descuentos de vidrio acordes a las normas del
  fabricante» sin dar la tabla.
- Las tablas explotables de «Deduction dimensions» están en los manuales **europeos** de
  multi-slide y easy-slide, en inglés.
- **No se abrió el enlace de Google Drive**: una carpeta de Drive requiere sesión y las herramientas
  solo obtendrían el HTML del visor. El ZIP parece cubrir lo mismo.
