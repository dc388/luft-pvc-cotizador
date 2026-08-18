# Pruebas funcionales — cotizador público y plataforma interna

Fecha: 2026-08-18 · Entorno: local (`vite dev`, loopback) · Rama: `auditoria/comercial-2026-08`

Estas son pruebas **ejecutadas en el producto corriendo**, no revisión de código. Cierran la prueba T-055 que la pasada anterior dejó bloqueada: el candado interno se abrió por el bypass `__LUFT_LOCAL_DEV__` (activo solo bajo `vite serve` y solo en host de loopback), así que no fue necesario escribir ninguna contraseña.

**25 pruebas nuevas: 18 PASS · 7 FAIL.** Detalle en `MATRIZ-PRUEBAS.csv` (T-061 a T-085), evidencia literal en `evidencias/funcional-hallazgos.txt`.

---

## 1. El hallazgo que cambia el veredicto

### F-01 — El envío final del cotizador falla y deja una cotización huérfana (P0, D-20)

Recorrí las 10 etapas como cliente, con dos diseños, y pulsé «Generar mi cotización». Resultado:

```
POST /api/public-quote/submit → 500 Internal Server Error
UI: "No pudimos guardar tu cotización en este momento. Intenta de nuevo."
```

El log del servidor da la causa exacta:

```
public-quote/submit Failed query: update "projects" set "name" = ?, "folio" = ?, "updated_at" = ?
                                  where "projects"."id" = ?
params: Cotización WEB LUFT-2026-000004 · Proyecto de AUDITORIA PRUEBA QA,
        LUFT-2026-000004, 2026-08-18T21:51:13.882Z, c92c4beb-...
```

Existe un índice `UNIQUE projects_folio_idx ON projects(folio) WHERE folio <> ''`. El folio `LUFT-2026-000004` **ya estaba ocupado por otro proyecto** (`5d07f8f0`), cuyo propio nombre dice `LUFT-2026-000001`. Es decir: `projects.folio` no corresponde al folio de la cotización de ese proyecto (D-21), y esa desalineación viene de una sesión **anterior** a esta auditoría — no la produje yo.

**Lo grave no es el 500, es que la operación no es atómica:**

| | Estado tras el fallo |
|---|---|
| `quotes` | Fila `000004` **creada**, `status = "generada"`, folio consumido |
| `projects` | `folio = ""` — el UPDATE falló |
| Cliente | Lee «no pudimos guardar tu cotización» |

El reintento funcionó con `LUFT-2026-000005`. El folio `000004` quedó quemado y huérfano.

Cruce de las 5 cotizaciones de la base local:

```
000001 → project.folio = 000004   ✗ desalineada (sesión anterior)
000002 → project.folio = 000002   ✓
000003 → project.folio = 000003   ✓
000004 → project.folio = ""       ✗ huérfana (este fallo)
000005 → project.folio = 000005   ✓
```

**2 de 5 (40%) inconsistentes.**

**El daño no se queda en la base.** El panel interno de Clientes muestra:

> 5 cotizaciones · 4 clientes · **$155,269.00 en oportunidades**

y lista `LUFT-2026-000005` **y** `LUFT-2026-000004` para el mismo cliente, el mismo proyecto, 2 diseños · 3 piezas y **$45,728.00 cada una**. El pipeline está inflado en 45,728 sobre 109,541 reales: **+41.9%**.

Esto viola directamente una regla del proyecto —expediente con folio único, sin duplicados— y golpea en el peor sitio posible: el último paso del embudo, justo donde perder al cliente cuesta más.

---

## 2. Los defectos de fabricación, confirmados en el producto

La pasada anterior encontró D-01 y D-09 leyendo código. Ahora están confirmados ejecutando.

### F-02 — La medida de vidrio no depende del sistema (P0, D-01)

Mismo componente de 1800 × 1400. Solo cambié el sistema:

| Sistema | Profundidad | Galce | Hoja fabricada | Vidrio pedido | Resta |
|---|---|---|---|---|---|
| CORREDERA 60MM | 60 mm | 24 mm | 902 × 1384 | **782 × 1264** | −120 / −120 |
| Lift-slide 85 (HS) | 85 mm | 52 mm | 908 × 1384 | **788 × 1264** | −120 / −120 |

La geometría de la hoja **sí** se adapta: 902 → 908, porque `centerOverlapMm` pasa de 20 a 32. Verifiqué la aritmética a mano: 900 − 8 + 10 = 902 y 900 − 8 + 16 = 908, ambas correctas.

La medida de vidrio **no se adapta en absoluto**, aunque el perfil de hoja pase de 75 a 285 €/m —casi cuatro veces— y el galce del sistema de 24 a 52 mm. Un perfil de Lift-slide 85 es mucho más ancho que uno de Corredera 60: su vidrio no puede llevar la misma resta de canto.

El reporte afectado es **«Pedido de vidrio»**, el que se manda al proveedor.

### F-03 — Los junquillos se cortan a la medida de la hoja (P2, D-09)

Reporte de optimización de corte, Lift-slide 85, cantidad 2:

```
Hoja      → 1384 ×8 , 908 ×8
Junquillo → 1384 ×8 , 908 ×8    ← idéntico
```

El junquillo debería cortarse a la luz del galce, que es menor que la medida exterior de la hoja, y normalmente a inglete. Aquí sale con la misma longitud que la hoja y a 90°.

### F-04 — El reporte de corte promete validaciones que no existen (P1, D-07)

Pie impreso, textual:

> «Optimización por primer ajuste descendente (first-fit-decreasing); valida ángulos, soldadura y reglas específicas del catálogo antes de fabricar.»

No existe validación de ángulos, ni de soldadura, ni de reglas de catálogo. El taller lee una garantía inexistente en el documento con el que corta.

### F-05 — La interfaz etiqueta datos de 2022 como «Datos reales» (P1, D-22)

En la pestaña Diseño, bajo el selector de sistema:

> «✓ **Datos reales** — precio de marco/hoja tomado de la lista EXWORK Veracruz (rev. ABR_22), convertido a MXN @ 21.8.»

Lista del 2022-05-01 y tipo de cambio de 2022, presentados al operador como datos reales en agosto de 2026. Quien cotiza confía en un precio obsoleto porque la propia herramienta lo certifica.

---

## 3. Lo que funciona, y funciona bien

No todo es hallazgo. Buena parte de lo que se probó pasó, y algunas cosas pasaron con holgura.

### Cotizador público

- **Cero importes en las 10 etapas.** Ni uno. La regla se cumple.
- **Cero scroll**, vertical y horizontal, en las 10 etapas a 1366 × 768.
- **Validación con el límite real del sistema**: ancho 9000 en una CORREDERA 60MM produce «Este estilo se fabrica hasta 4000 × 2400 mm» y deshabilita Continuar. No es un mensaje genérico: sale del catálogo.
- **Errores junto a su campo**, medido geométricamente: 12 px bajo el campo de ancho, 7 px bajo cada campo obligatorio del formulario de contacto, alineados en el mismo eje horizontal. Con el formulario vacío salen los tres errores y no navega.
- **Volver atrás no borra nada.** Retrocedí tres etapas: 1800 × 1400, 2 piezas, Gris antracita y Doble vidrio seguían ahí.
- **Varios diseños por proyecto**: 2 diseños · 3 piezas, con eliminar y revisar.

### Documento definitivo

- Es el **primer** lugar donde aparece el precio. La regla se cumple.
- **Los datos bancarios no viajan**: «Los datos para pago se entregan de forma segura después de la medición y la confirmación final». Analicé los 89,467 bytes del HTML servido buscando 12 términos internos —`clabe`, `cuenta`, `margen`, `margin`, `profileCost`, `glassCost`, `netUtility`, `overhead`, `proveedor`, `supplier`, `hardwareVerified`, `INTERNAL_PASSWORD`— y hay **0 apariciones de cada uno**.
- Va marcado «COTIZACIÓN PRELIMINAR — NO REALIZAR DEPÓSITOS».
- **La aritmética cuadra**, recalculada de forma independiente:

| Comprobación | Esperado | Documento |
|---|---|---|
| 1.8 × 1.4 | 2.520 m² | 2.520 ✓ |
| 1.5 × 1.2 | 1.800 m² | 1.800 ✓ |
| 18,218 × 2 | 36,436 | 36,436 ✓ |
| Total | 45,728 | 45,728 ✓ |
| Superficie 5.04 + 1.80 | 6.840 m² | 6.840 ✓ |
| Anticipo 70% | 32,009.60 | 32,010 |
| Saldo 30% | 13,718.40 | 13,718 |
| Anticipo + saldo | 45,728 | cuadra ✓ |

### Plataforma interna

- **El circuito completo funciona**: el proyecto creado desde el cotizador público apareció cargado en el Workspace, con su folio.
- Las **8 pestañas** renderizan con contenido y sin scroll horizontal.
- **6 reportes** operativos: Cotización, Optimización de corte, Pedido de vidrio, Producción, Herrajes y Costos.
- **Panel de Clientes** completo: búsqueda, filtro por 12 etapas del proceso, rango de fechas, cambio de etapa por cotización, PDF e Historial.
- **Empaquetado de barras correcto**: la barra 1 lleva 3 × 1800 = 5400 más 2 cortes de sierra de 5 mm = 5410, y reporta resto 390 sobre 5800. Exacto.
- **Consola limpia**: un único error en todo el recorrido, el 500 del envío fallido. Ningún otro.

---

## 4. Efecto sobre el veredicto

El veredicto sigue siendo **NO-GO**, ahora con **tres P0** en lugar de dos, y la puntuación baja de **42 a 40**: el fallo del envío final afecta al flujo de conversión principal, que es la razón de existir del cotizador.

El matiz de la pasada anterior se mantiene y se refuerza: casi todo lo que rodea al problema está bien hecho. Las diez etapas cumplen las reglas del producto una por una, el documento definitivo es sólido y no filtra nada, y la aritmética que pude recalcular cuadra sin excepción. Los tres bloqueantes son concretos y acotados:

1. **D-20** — envolver la creación de cotización y la actualización del proyecto en una transacción, y derivar el folio del proyecto de la misma fuente que el de la cotización. Es el más urgente: se manifiesta con cliente delante.
2. **D-01** — derivar la medida de vidrio del perfil y del rol de acristalamiento, con una sola fuente de verdad.
3. **D-02** — guarda positiva de dominio en la salida del asesor.

Los tres son de días, no de trimestres.
