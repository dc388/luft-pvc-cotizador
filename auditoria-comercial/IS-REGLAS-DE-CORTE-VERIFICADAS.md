# Sistema IS · reglas de corte del fabricante, verificadas

Fuente: `CALCULO DE MATERIAL SISTEMA IS v2.1.xlsx`, leída **con sus fórmulas** (no con los valores
calculados). Dos hojas: `Ventana` y `Puerta`.

Esto es lo que llevaba dentro y no se había mirado: no es una tabla de deducciones para interpretar,
es **el generador de la lista de corte del fabricante**, con una fórmula por código de perfil y por
orientación.

## Verificación

La hoja `Puerta` trae sus totales consolidados ya calculados, con B=1400, H=2100 y 50 unidades. Se
reprodujeron desde las fórmulas:

| Código | Reconstrucción | Hoja dice | |
|---|---|---|---|
| 020075 Hoja | 2×733,0 + 1×2048,8 = 3514,8 mm/ud → **175,74 m** | 175,74 | ✔ |
| 020076 Traslape | 1×2048,8 + 1×2054,8 = 4103,6 → **205,18 m** | 205,18 | ✔ |
| 020073 Junquillo | 2×(638,0+1953,8+637,3+2054,8) → **528,39 m** | 528,39 | ✔ |
| 227174 Riel | 1×1373,0 → **68,65 m** | 68,65 | ✔ |
| 729076 Felpillo | 4×1332,5 + 5×2032,5 → **774,625 m** | 774,625 | ✔ |

**Cinco de cinco, al céntimo de metro.** No es una interpretación: es la aritmética del fabricante
reproducida.

## VENTANA IS · hoja «Ventana»

Soldadura `+6` mm (2 × 3) en marco y hoja. El junquillo **no** lleva soldadura.

| Código | Pieza | Medida final |
|---|---|---|
| 020070 | Marco horizontal | **B** |
| 020070 | Marco vertical | **H** |
| 020071 | Hoja corrediza horizontal | **(B/2) − 12,9** |
| 020071 | Hoja corrediza vertical | **H − 35** |
| 020072 | Hoja traslape vertical | **H − 35** |
| 020073 | Junquillo horizontal | **hoja_horizontal − 28,2** |
| 020073 | Junquillo vertical | **hoja_vertical − 58,42** |
| 729075 | Junta felpillo vertical | **H − 35** |
| 620075 | Cerradero media luna | 1 pza / unidad |
| 620076 | Carro | 4 pzas / unidad |

Cortes por unidad: marco 2 horizontales + 2 verticales; hoja 4 horizontales + 2 verticales.

## PUERTA IS · hoja «Puerta»

| Código | Pieza | Medida final | Corte |
|---|---|---|---|
| 020074 | Marco horizontal | **B** | 45° |
| 020074 | Marco vertical | **H** | 45° |
| 020075 | Hoja horizontal | **(B/2) + 27** | 45° |
| 020075 | Hoja vertical | **H − 57,2** | 45° |
| 020076 | Traslape vertical hoja | **H − 57,2** | 45° |
| 020076 | Traslape vertical fijo | **H − (25,4−2,8)×2 = H − 45,2** | **90°** |
| 020073 | Junquillo horizontal hoja | **hoja_h − (47,3−2,8)×2 = hoja_h − 89** | 45° |
| 020073 | Junquillo vertical hoja | **hoja_v − 89** | 45° |
| 020073 | Junquillo horizontal fijo | **(B/2) − 62,7** | 45° |
| 020073 | Junquillo vertical fijo | **H − 45,2** | 45° |
| 227174 | Riel de aluminio | **B − 27** | 45° |
| 729076 | Junta felpillo | **B − 67,5** y **H − 67,5** | — |
| 620078 | Broche | 1 pza / unidad | — |

**El 89 es de la puerta, y era correcto atribuirlo ahí.** Lo que estaba mal era aplicarlo a la
ventana, cuyo junquillo va a −28,2 y −58,42 según su propia hoja.

## Lo que esto dice de los datos actuales de la aplicación

| | La aplicación hoy | La hoja del fabricante |
|---|---|---|
| Ventana · hoja ancho | (B/2) − **52,2** | (B/2) − **12,9** |
| Ventana · hoja alto | H − **74** | H − **35** |
| Ventana · junquillo | sin calibrar (0) | **−28,2** ancho · **−58,42** alto |
| Puerta · hoja ancho | (B/2) − **73,6** | (B/2) **+ 27** |
| Puerta · hoja alto | H − **157,8** | H − **57,2** |
| Puerta · junquillo | sin calibrar (0) | **−89** |

El error de fondo fue de lectura: las tablas «Medidas de deducción» de los manuales listan **varias**
dimensiones derivadas (elemento, acristalamiento, hoja, ancho libre), y se asignó la etiqueta «Hoja»
a la letra equivocada. La hoja de material lo resuelve sin ambigüedad porque **etiqueta cada fórmula
con el código de perfil que se corta**: `020071 Hoja corrediza = (E5/2) − 12.9`.

Con la letra correcta identificada, los manuales encajan: en la puerta `D = (B/2) + 27` es
exactamente lo que corta la hoja de material, y `D` es la fila «Flügel».

## Qué no se ha cambiado, y por qué

**Nada.** Estas correcciones alargan la hoja unos 39 mm en la ventana y unos 100 mm en la puerta, así
que **suben el consumo de perfil y por tanto el precio**. Es una decisión de negocio sobre un sistema
que ya está desplegado y cotizando, y la última vez que se corrigió un dato de fabricación del IS con
una lectura confiada, la lectura estaba mal.

Además hay tres reglas que el modelo actual **no puede expresar** y habría que ampliarlo:

1. **Descuentos por eje.** El junquillo de la ventana va a −28,2 en horizontal y −58,42 en vertical.
   `beadFor` devuelve un solo número.
2. **Descuento negativo.** La hoja horizontal de la puerta es `(B/2) + 27`: más ancha que su mitad,
   porque solapa. `leafSizingFor` asume que se resta.
3. **Ángulo de corte por pieza.** El traslape vertical del campo fijo de la puerta va a **90°** y el
   resto a 45°. `buildCutList` decide el ángulo por categoría, no por pieza.

El vidrio queda aparte: **no está en la hoja de material** (el vidrio no es un perfil). Su medida
sigue saliendo de la tabla del manual, y con la letra de la hoja ya corregida el descuento desde la
hoja sería ~58,5 mm en la ventana y 120 mm en la puerta —no los 19,4 actuales—, pero eso descansa en
la lectura del manual, no en una fórmula etiquetada. Antes de tocarlo hay que confirmarlo.
