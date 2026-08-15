# Comparativa competitiva — LUFT PVC Cotizador

Fecha: 2026-08-15

## Advertencia de método

Las capacidades de los competidores provienen **solo de su documentación oficial publicada**, citada al final. No se instaló ni se ejecutó ninguno de los cuatro productos, de modo que se describe lo que el fabricante declara, no lo que se verificó. Las capacidades de LUFT provienen de la ejecución y revisión directas descritas en `REPORTE-AUDITORIA.md`.

Esta comparación es deliberadamente desfavorable en un sentido: mide a LUFT contra software de fabricación maduro con décadas de desarrollo, que es el marco que fijó el encargo. Como se explica en el informe principal, LUFT no fue construido para ese perímetro, y esa diferencia de propósito importa más que cualquier casilla de esta tabla.

## Matriz

| Capacidad | LUFT | RA Workshop | Klaes | Logikal | Windowmaker |
|---|---|---|---|---|---|
| Diseño de ventana por composición | Presente | Presente | Presente | Presente | Presente |
| Tipologías predefinidas | Presente (data/typologies.ts) | Presente | Presente | Presente | Presente |
| Formas no rectangulares (arco, trapecio) | **Ausente** | Presente | Presente | Presente | Presente |
| Catálogo multiproveedor | **Ausente** (Aluplast y Deceuninck cableados) | Presente (PVC, aluminio y madera) | Presente | Presente (más de 450 proveedores) | Presente |
| Multimaterial (PVC, aluminio, madera) | **Ausente** (solo PVC por decisión de producto) | Presente | Presente | Presente | Presente |
| Reglas de compatibilidad y límites | Parcial (máximos por sistema, galce vs espesor de vidrio) | Presente | Presente | Presente | Presente |
| Lista de materiales (BOM) | Parcial (por categoría de costo, no por SKU) | Presente | Presente | Presente | Presente |
| Optimización de corte | Parcial (bin packing real, sin soldadura ni retales) | Presente | Presente | Presente | Presente |
| Gestión de retales | **Ausente** | Presente | Presente | Presente | Presente |
| Salida a CNC | **Ausente** | Presente (complemento CNC) | Presente (CAM 2D) | Presente (3, 4 y 5 ejes) | Presente |
| Exportación CAD / DXF | **Ausente** | Presente | Presente | Presente | No verificado |
| BIM / Revit | **Ausente** | No verificado | No verificado | Presente (módulo BIM) | No verificado |
| Cotización y costos | Presente | Presente | Presente | Presente | Presente |
| Cotizador público para cliente final | **Superior** | No verificado | No verificado | No verificado | Parcial (Dealer Client) |
| Asistente de IA conversacional | **Superior** | No verificado | No verificado | No verificado | No verificado |
| Interpretación de planos con IA | **Ausente** | No verificado | No verificado | No verificado | No verificado |
| Inventario y compras | **Ausente** | Presente | Presente | Presente | Presente |
| Planificación de producción | **Ausente** | Presente | Presente | Presente | Presente |
| ERP integrado | **Ausente** | Parcial | Presente | Presente | Presente |
| Multiempresa y multiusuario | **Ausente** | Presente | Presente | Presente | Presente |
| Roles y permisos | Parcial (definidos, no administrables) | Presente | Presente | Presente | Presente |
| Trazabilidad y auditoría | Parcial (historial de proyecto y eventos de cotización) | Presente | Presente | Presente | Presente |
| Aplicación web nativa | **Superior** (Worker, sin instalación) | Cliente/servidor | Escritorio | Escritorio | Nube disponible |
| Cálculo normativo (Uw, aire, agua, viento) | **Ausente** | No verificado | Presente | Presente | No verificado |
| Documentación y soporte formal | **Ausente** | Presente | Presente | Presente | Presente |

Recuento: **Superior 3 · Paridad 4 · Parcial 7 · Ausente 14 · No verificable** en el resto.

## Lectura

**Dónde LUFT gana, y no por poco.** El cotizador público guiado para cliente final, sin precios visibles durante la configuración y con un asesor conversacional acotado por un motor de reglas, no aparece en la documentación de ninguno de los cuatro. Son productos de taller: suponen un operador capacitado. LUFT resuelve el tramo anterior —captar y calificar al cliente— que los otros dejan fuera. Ser una aplicación web sin instalación refuerza esa ventaja.

**Dónde la distancia es estructural.** Las catorce ausencias no son funciones sueltas: son el módulo de producción completo. Sin CNC, sin DXF, sin inventario, sin planificación y sin retales, LUFT termina donde empieza la fábrica. La cadena que la auditoría pedía verificar —diseño → cotización → pedido → BOM → optimización → producción → CNC → factura— se corta después de la optimización.

**La consecuencia práctica.** LUFT no compite con Klaes o Logikal; ocupa un hueco que ellos no cubren. Presentarlo como alternativa a un ERP de fabricación sería insostenible en una demostración. Presentarlo como el frente comercial que alimenta a un taller —eventualmente al lado de uno de ellos— es defendible hoy, una vez corregidos los defectos P0.

## Fuentes

- [RA Workshop Professional](https://www.raworkshop.com/ra-workshop-professional/) y [RA Workshop CNC Add-On](https://www.raworkshop.com/ra-workshop-cnc-add-on/)
- [Klaes — Software for Window and Door Production](https://www.klaes.de/en-klaes-software) y [Klaes CAM 2D](https://www.klaes.de/en-cam-2d)
- [Logikal — Orgadata](https://www.logikal-software.com/en-us/product/logikal) y [Modules in Logikal](https://www.orgadata.com/global/en/solutions/logikal/modules-in-logikal.html)
- [Windowmaker — Manufacturers](https://windowmaker.com/manufacturers/) y [OptiMaker](https://windowmaker.com/en/Optimaker)
