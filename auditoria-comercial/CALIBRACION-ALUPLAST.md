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

## 2. Encontrado en los manuales pero NO aplicado, y por qué

### 2.1 El descuento del junquillo: 89 mm

La hoja da `junquillo = hoja − (47.3 − 2.8) × 2 = hoja − 89`. El 47.3 es el ancho de cara del perfil
y el 2.8 el solape del galce — la misma estructura del descuento de vidrio.

**No se aplicó** porque ese dato es del sistema **Ideal IS**, que todavía no existe en
`data/catalog.ts`. Atribuirlo a CORREDERA 60MM o a IDEAL 2000 sería inventar. El parámetro existe ya
(`beadFor`), vale 0 sin calibrar, y el reporte de corte lo advierte.

### 2.2 La medida de la hoja corredera — el hallazgo que más conviene verificar

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

### 2.3 `centerOverlapMm` sigue siendo un placeholder

El código lo declara «PLACEHOLDER pending Aluplast's fabrication datasheet». Los datasheets ya
están, pero mientras no se resuelva 2.2 no tiene sentido calibrar la mitad del modelo.

---

## 3. Supuestos de la carga anterior: qué confirma y qué no la documentación nueva

| Supuesto | Estado tras la documentación nueva |
|---|---|
| **`EUR_MXN = 21.8`**, fechado 2022-05-01 | **Sigue mal, y sigue haciendo falta.** Las dos listas —la de 2022 y `Lista de Precios IS_V1.2.2.2`— están en **euros EXWORK Veracruz**, así que el tipo de cambio no desaparece. El real ronda 19.68: actualizarlo **baja** el costo de perfil ~10% y con él los precios. Es una decisión comercial, no técnica |
| **`IMPORT_FACTOR = 1.0`** | **Confirmado como subcosteo.** La lista nueva vuelve a decir «PRECIOS EX WORK ALUPLASTMEX-VERACRUZ»: el precio se detiene en el muelle del vendedor. Cobrarlo como costo puesto en planta es fuga de margen. Sigue faltando un pedimento real para fijar el factor |
| **Lista de precios rev. ABR_22 (2022)** | **No se reemplaza.** `Lista de Precios IS_V1.2.2.2.xlsx` tiene **una sola hoja, «Ideal IS»**: es una orden de material de ese sistema, no un catálogo completo. La de 2022 sigue siendo la única lista con los 278 perfiles. **D-05 sigue abierto** |
| Descuento de vidrio de 120 mm | **Desmentido** para correderas. Ver sección 1 |
| Junquillos a 90° y a la medida de la hoja | **Desmentido**. Ver sección 1 |
| «El reporte valida ángulos y soldadura» | **Era falso**. Corregido |

---

## 4. Lo que el ZIP trae y todavía no se ha explotado

- **`Ventana IS.zip` (49 MB)** y **`Puerta IS.zip`** — sin abrir. Probablemente traen la ficha completa
  del sistema IS, que es el que la lista de precios nueva cotiza.
- **`ACTUALIZACION TECNICA.zip`** — sin abrir.
- **`14 Junquillos.pdf`** — catálogo de junquillos de 10 a 32 mm, cada uno con su junta. Es la pieza
  que define el galce; sirve para calibrar 2.1 por sistema.
- **`REFUERZOS_MX_X.pdf`** — refuerzos. Hoy el costeo usa una estimación plana de 78 $/m cuando no
  hay código de refuerzo (D-12).
- **`catalogo de folios 2025.pdf`** e **`información técnica_Folios.pdf`** — colores/folios 2025. El
  catálogo de la app tiene 18 códigos de color; conviene contrastarlo.
- **`Esquinas Soldables.pdf`**, **`CIERRE CENTRAL_96.pdf`**, **`Umbral_Union_Lateral.pdf`**,
  **`Riel Plano y Unión Mecánica 600197.pdf`** — detalles de herraje y unión.
- **El sistema Ideal IS no existe en `data/catalog.ts`.** Es el único con lista de precios nueva y con
  hoja de cálculo de material. Si es lo que se vende hoy, falta en la aplicación.

---

## 5. Notas de método

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
