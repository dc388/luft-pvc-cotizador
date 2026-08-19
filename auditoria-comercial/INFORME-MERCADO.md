# Informe de mercado: software de diseño y cotización de ventanas
## Posición de LUFT PVC Cotizador y mejoras propuestas

Fecha: 2026-08-19 · Elaborado sobre la auditoría técnica de `REPORTE-AUDITORIA.md` y `REPORTE-FUNCIONAL.md`

---

## 0. Método, y una advertencia que cambia cómo hay que leer este informe

Pediste analizar «estados de opinión» y «efectividad». Hay que empezar por un hallazgo incómodo:

> **En esta categoría no existe opinión pública de usuarios en volumen significativo.**

No es que no la haya buscado. Es lo que hay:

| Producto | Plataforma | Calificación | Reseñas reales |
|---|---|---|---|
| LogiKal (Orgadata) | Capterra UK | 4 / 5 | **0** |
| Windowmaker Express | Capterra | 0.0 | **0** |
| Soft Tech V6 | SoftwareAdvice | — | **0** |

Una calificación de «4 de 5» construida sobre cero reseñas no significa nada, y presentarla como sentimiento de usuarios sería inventar. La razón de fondo es estructural: este software se vende por venta directa, con implementación asistida y contrato anual; el comprador es un fabricante que no escribe reseñas de software.

**Segundo problema.** Buena parte de lo que aparece al buscar «best window software 2026» son granjas de contenido generado automáticamente (gitnux.org, wifitalents.com, worldmetrics.org y similares). Producen rankings con aire de autoridad y cero base. **No los uso como fuente en este informe**, y te recomiendo desconfiar de ellos si los encuentras.

**Qué sí se puede afirmar, y con qué respaldo.** Todo lo de abajo está etiquetado:

- **[Verificado]** — documentación oficial del fabricante o prueba independiente citada.
- **[Del fabricante]** — afirmación del vendedor, sin verificación independiente. Se conserva porque revela qué promete el mercado, no qué cumple.
- **[No verificable]** — no encontré fuente suficiente. Se dice, no se rellena.

---

## 1. El mercado no es un bloque: son cuatro mercados distintos

El error de mi comparativo anterior fue medir LUFT contra Klaes y Logikal como si compitieran. No compiten. El sector se divide en categorías con compradores, precios y propósitos diferentes:

### A. ERP industrial de fabricación
**Klaes, LogiKal (Orgadata), Soft Tech V6 / FeneVision (Cyncly), Windowmaker, Paradigm Omni**

Gobiernan la fábrica completa: diseño → cálculo estático → lista de materiales por SKU → optimización → CNC → compras → planificación → facturación. Comprador: fabricante con planta y máquinas.

### B. Software de taller
**RA Workshop, SEIA, Megevand OP 2.1, winDOS**

Diseñar, presupuestar y sacar órdenes de corte. Sin ERP completo. Comprador: carpintería de aluminio/PVC pequeña y mediana.

### C. Configuradores de cara al cliente final
**Vivid 3D, Twikit, IC COMPLEX, WindowPerfect, WinDoor Quote, ClearMax, FHC Instaquote, Tommy Trinder, WindSketch**

Que el cliente o el vendedor configure y vea precio, con o sin conexión a producción. **Aquí es donde vive LUFT.**

### D. Software de la casa de sistemas
**SchüCal (Schüco), ReynaPro (Reynaers)**

Lo da el extrusor para calcular *sus* perfiles. Relevante porque **es el canal por el que el arquitecto especifica**: Reynaers mantiene un «Architect Hub» y entrega modelos BIM de configuraciones. [Verificado]

---

## 2. Corrección a mi comparativo anterior

Debo rectificar dos cosas que te dije el 15 de agosto.

**Primera: dije que el cotizador público de cara al cliente «no aparece en la documentación de ninguno de los cuatro» competidores y lo marqué como ventaja «Superior».** Era cierto de esos cuatro, y engañoso sobre el mercado. La categoría C existe, está poblada y algunos llevan años. **LUFT no inventó esa categoría; entró en ella.** La ventaja real es más estrecha y más específica de lo que dije, y la detallo en la sección 6.

**Segunda: dije que LUFT «no compite con Klaes o Logikal, ocupa un hueco que ellos no cubren».** La primera mitad sigue en pie. La segunda es demasiado generosa: el hueco existe, pero ya hay gente en él.

---

## 3. Fichas por competidor

### Categoría A — ERP industrial

#### LogiKal (Orgadata / Forterro)
- **Escala** [Verificado]: más de 18,000 fabricantes, proyectistas y arquitectos; datos de más de 450 proveedores de sistemas; independiente del proveedor.
- **Capacidades** [Verificado]: generación automática de cortes, predimensionado estructural, módulos CNC para centros de 3, 4 y 5 ejes, módulo BIM con intercambio bidireccional contra Revit (medidas de vano y cantidades desde Revit; devuelve modelo 3D con color, valor U y cortes exactos).
- **Debilidades documentadas** [Verificado]: curva de aprendizaje pronunciada, «especialmente para usuarios sin formación en ingeniería estructural»; foco limitado en diseño estético y visualización; **costo alto y orientación a empresa grande, poco idóneo para fabricantes pequeños**.
- **Precio** [No verificable]: no publica lista.
- **Lectura**: el techo técnico del sector. Es también la razón por la que existe hueco abajo: un taller de 3 personas no compra ni opera esto.

#### Klaes
- **Escala** [Verificado]: ~7,000 clientes en más de 50 países, 27 idiomas, ~260 empleados. Líneas Premium / Professional / Vario / Trade + DoorDesigner + CAM 2D + Klaes 3D.
- **Capacidades** [Verificado]: ERP completo de ventas a contabilidad, CAD con generación de secciones y encuentros con obra, datos CNC automáticos, planificación de capacidad manual o automática.
- **Opinión** [Del fabricante]: testimonios propios destacando soporte y servicio.
- **Precio** [No verificable].
- **Lectura**: el más «ERP» de todos. Su propia gama Vario existe porque Professional es demasiado para la mayoría.

#### Soft Tech V6 / FeneVision (Cyncly)
- **Capacidades** [Verificado]: modela productos muy complejos, CPQ, gestión de materiales con optimización de perfil y vidrio, ERP de fabricación.
- **Casos** [Del fabricante]: Crystal Window & Door Systems (Nueva York) reporta mejora de velocidad y exactitud; Evolution Window Systems reporta menos ida y vuelta, menos desperdicio y mejor exactitud en estimaciones.
- **Debilidad documentada** [Verificado, análisis de terceros]: «la complejidad puede ser más de lo que la mayoría de los negocios necesita».
- **Precio** [Verificado]: «a solicitud». Sin lista pública.

#### Windowmaker
- **Capacidades** [Verificado]: WM ERP / WM SQL / WM Express; optimización que además pondera el costo del cambio de posición de cabezal, agrupando piezas iguales; enlaces a tronzadoras y centros CNC (menciona Proline MC330V2 y FENSTEK).
- **Precio** [Verificado]: **Windowmaker Express £1,500 pago único**, con prueba gratuita. Es el único precio firme que encontré en toda la categoría A.
- **Señal de mercado interesante** [Verificado]: la ficha de Capterra marca como carencias «no tiene visualización de producto en tiempo real (crítica para el 50% de los compradores de software similar)» y «no tiene gestión de configuración (importante para el 50%)». Ese dato de intención de compra vale más que las cero reseñas.

#### Paradigm Omni
- **Capacidades** [Verificado, análisis de terceros]: CPQ ligado a producción; la lógica de configuración impone restricciones de fabricación.
- **Límite declarado** [Verificado]: «no es la herramienta adecuada para venta visual directa al consumidor».

### Categoría B — Software de taller

#### RA Workshop
- **Modelo** [Verificado]: **la edición Lite es gratuita**. Ediciones Standard / Professional / Advanced Professional / Enterprise de pago. Complemento CNC aparte.
- **Capacidades** [Verificado]: PVC, aluminio y madera; lista de materiales precisa como base del cálculo financiero; optimización de corte que el fabricante presenta como la mejor del mundo [Del fabricante]; reportes de producción y órdenes de material.
- **Opinión disponible** [Verificado, reseñas de usuarios en agregadores]: «de los más fáciles de usar», «una cotización en minutos»; pero **«la interfaz parece abrumadora al principio»**. La Lite limita los tipos de apertura diseñables.
- **Señal de obsolescencia** [Verificado]: 224.8 MB de instalador y compatibilidad declarada hasta Windows XP y Vista. Es software de escritorio de otra época.
- **Lectura**: **este es el competidor que más debe preocuparte.** Gratis en su entrada, resuelve el 80% de lo que hace LUFT internamente, y lleva años instalado en talleres.

#### El mercado mexicano — lo que mi informe anterior ignoró por completo
Los competidores reales de LUFT en México **no son Klaes ni Logikal**. Son estos:

| Producto | Qué ofrece | Dato relevante |
|---|---|---|
| **Optiglass** | Cotizar puertas, ventanas y cancelería | **Trae precargadas las líneas mexicanas**: EuroVent, Panorama 2" y 3", EuroAlum, Línea Española, con corrediza, puerta corrediza, fijo, abatible y guillotina. Prueba gratis un mes y capacitación gratuita [Verificado] |
| **SEIA** | Cancelería simple y combinada | Reportes de presupuesto, orden de compra, **orden de corte, orden de armado**, precios unitarios, resumen de costos, catálogo de módulos [Verificado] |
| **Megevand OP 2.1** | Diseñar, presupuestar, costear, optimizar y fabricar | 30 años de experiencia; presencia en México, Colombia y Argentina [Verificado] |
| **winDOS** | Presupuestación y gestión **en línea** | Desarrollado para instaladores y fabricantes de aluminio y PVC [Verificado] |

**Esto es lo más accionable del informe.** Optiglass viene con las líneas de perfil que el mercado mexicano usa de verdad. LUFT tiene 20 sistemas de **dos** marcas europeas cableadas en `data/catalog.ts`. Un cliente que pide Panorama 3" no existe en LUFT.

### Categoría C — Configuradores de cara al cliente

| Producto | Enfoque | Límite declarado [Verificado] |
|---|---|---|
| **Vivid 3D** | Configurador 3D fotorrealista con RA | Separado de la especificación de fabricación |
| **Twikit** | Configuración 3D en tiempo real ligada a precio | «Menos relevante para gamas de producto estándar» |
| **IC COMPLEX** | Venta en línea real | «Venta en línea de verdad, no solo generación de prospectos» [Del fabricante] |
| **WindowPerfect** | Diseñar, especificar, cotizar, fabricar y vender en una plataforma | [No verificable] |
| **WinDoor Quote** | Cotización en la nube para fabricantes | «La brecha frente a Paradigm se nota a escala empresarial» |
| **Tommy Trinder** | Herramienta de venta para instaladores | **«La cotización es un documento de venta, no una especificación de producción»** |
| **ClearMax** | Comprar ventanas en línea directamente | [No verificable] |

La última fila de Tommy Trinder describe exactamente el riesgo estratégico de LUFT, y vale la pena escribirlo sin adornos: **hoy LUFT está mucho más cerca de un documento de venta que de una especificación de producción.** La auditoría lo demuestra con D-01 (medida de vidrio con constante fija), D-06 (sin descuento de soldadura) y D-09 (junquillos a medida de hoja).

### Categoría D — Casas de sistemas, y por qué te afectan
**ReynaPro (Reynaers)** [Verificado]: módulos de cálculo de ventanas, puertas y correderas, muro cortina, generación automática de secciones, interfaz DXF y pedido electrónico. Sobre proyectos de ReynaPro entregan **modelos BIM fijos de configuraciones en pocos días**. Mantienen «Architect Hub» y publican objetos BIM en BIMobject.

**SchüCal (Schüco)** [Verificado]: software de cálculo para sistemas Schüco.

**Consecuencia para LUFT**: cuando un arquitecto especifica, va a la casa de sistemas por el objeto BIM y los datos de desempeño. Si LUFT no entrega nada de eso, queda fuera de la conversación de especificación y solo entra a competir por precio al final.

---

## 4. Efectividad: qué se puede afirmar con números

### Lo que el mercado promete [Del fabricante, sin verificación independiente]
- «Los fabricantes que adoptan herramientas digitales especializadas han reducido errores de producción en más de 40% y acelerado la cotización en 60%.»

Ese par de cifras circula mucho. **No encontré ningún estudio independiente que las respalde.** Trátalas como objetivo comercial, no como línea base.

### Lo que sí está medido de forma independiente: lectura automática de planos
Esto es lo más importante del informe para tu proyecto del intérprete de planos, porque **la industria ya lo hizo y hay números reales**:

| Herramienta | Precio [Verificado] | Exactitud |
|---|---|---|
| **Togal.AI** | $299 USD/usuario/mes | Levantamiento arquitectónico completo en **12 minutos con ~5 clics**; 97% detectando espacios [Del fabricante]; **error de medición por debajo de 5% en casi todas las clasificaciones, con ajustes manuales** [Verificado, estudio comparativo con revisión por pares] |
| **STACK Assist AI** | desde $249 USD/usuario/mes | **Dentro del 3% de la línea base** [Verificado, prueba independiente] |
| **Kreo Pro** | $175 USD/usuario/mes | Llega al 95% del camino sin etiquetado manual [Del fabricante]; **sin prueba independiente pública** |
| **Beam AI** | ~$8,000+ USD/año por oficio | Extracción completa de cantidades |
| **Bobyard** | [No verificable] | Lanzó extracción de puertas y ventanas en **junio de 2026** |

**Y el dato que debe gobernar tu decisión** [Verificado, prueba comparativa de 6 plataformas]:

> «Toda afirmación de exactitud del vendedor (95 a 99 por ciento) es autorreportada y no verificada; la exactitud realista es de **90 a 95 por ciento en planos residenciales limpios, y menor en juegos complejos o escaneados**.»

Traducido a tu negocio: entre **1 de cada 10 y 1 de cada 20 ventanas se leerá mal**, y peor si el plano es un escaneo o una foto. Con el vidrio a medida —que no se devuelve— eso es merma directa. **Confirma con números lo que te dije en la auditoría: la lectura de planos tiene que entrar siempre como propuesta a confirmar, nunca aplicarse sola.** Y el andamiaje de aprobación que ya tienes en `lib/luft-ai/` es exactamente la pieza correcta para eso.

---

## 5. Lo que un arquitecto necesita, y qué tan lejos está LUFT

Este es el checklist real, levantado de fuentes de especificación y BIM, no inventado:

| # | Requisito del arquitecto | Fuente | Estado en LUFT | Brecha |
|---|---|---|---|---|
| 1 | **Cuadro de vanos**: marca, cantidad, medidas, altura de antepecho, tipo de vidrio, material de marco, resistencia al fuego | [Verificado] | Lista plana de componentes; ahora agrupable por ubicación. **Sin antepecho ni resistencia al fuego** | Media |
| 2 | **Valor U (Uw) por configuración real**, no por sistema | [Verificado] | `System.uf` es una **cadena informativa** («1.6 W/m²K») del sistema, no un cálculo de la ventana cotizada | **Alta** |
| 3 | **SHGC / factor solar** | [Verificado] | No existe | **Alta** |
| 4 | **Detalles de puente térmico** | [Verificado] | No existe | Alta |
| 5 | **Prestación acústica** | [Verificado] | Solo texto comercial («laminado antirruido») | Alta |
| 6 | **Cálculo estructural**: carga, deflexión, interfaz estructural | [Verificado] | No existe. LogiKal sí trae predimensionado | Alta |
| 7 | **Objetos BIM** (familias Revit / IFC) con datos de desempeño embebidos | [Verificado] | No existe | **Alta** |
| 8 | **Detalles CAD en DWG**: secciones, plantas, alzados que entren al juego de planos | [Verificado] | Solo CSV, HTML y JSON | **Alta** |
| 9 | **Especificaciones formateadas** para el manual de proyecto | [Verificado] | No existe | Media |
| 10 | **Clasificación normativa declarada** (NMX-R-060 en México) | [Verificado] | Sin campos. Ver `MATRIZ-NORMATIVA.csv` | **Alta** |
| 11 | **Distribución del contenido** donde el arquitecto lo busca: BIMobject, Arcat | [Verificado] | No hay presencia | Media |
| 12 | Visualización en tiempo real de la configuración | [Verificado, dato de intención de compra de Capterra: importa al 50%] | **Sí, y bien hecho**: vista 2D/3D y previsualización en vivo en el cotizador público | **Ninguna — es fortaleza** |

**Resumen honesto: de doce requisitos del arquitecto, LUFT cumple uno bien, uno a medias y no cubre diez.** Hoy LUFT es una herramienta de venta al consumidor final y de costeo interno; **no es una herramienta de especificación para arquitectos.** Si el objetivo es que un arquitecto la use para especificar en un proyecto, el trabajo es sustancial y está en los puntos 2, 7, 8 y 10.

Vale la pena decir el contrapunto: AMEVEC publica la NMX-R-060-SCFI-2013 en abierto precisamente para que «arquitectos, prescriptores y constructores la conozcan, consulten y especifiquen» [Verificado]. **Declarar clasificación NMX es la vía más corta y más barata para entrar al radar del arquitecto mexicano** — mucho más que BIM.

---

## 6. La ventaja real de LUFT, dicha con precisión

Quitando la exageración de mi informe anterior, queda algo que sigue siendo genuino y que **no encontré igual en ninguno de los productos revisados**:

1. **Configuración completa sin un solo importe visible, con el precio apareciendo por primera vez dentro del documento definitivo.** No es una decisión de CSS: la auditoría verificó que el dinero **no viaja** al frontend público, y que los 89 KB del documento por token no contienen ni un término interno. Los configuradores de la categoría C hacen lo contrario —precio instantáneo es su argumento de venta. Que LUFT lo haga al revés es una decisión de negocio deliberada y defendible en un mercado donde la medición cambia el precio.
2. **Asesor conversacional acotado por un motor de reglas determinista**, con clases enteras de pregunta —precio, costo, margen, proveedor, otro material— desviadas del modelo antes de llegar a él. No vi esto documentado en ningún competidor. (Con la salvedad grave de D-02: el asesor obedece inyección de prompt de forma determinista, y eso hay que arreglarlo antes de presumirlo.)
3. **Aplicación web sin instalación**, contra escritorio en RA Workshop, Klaes y LogiKal.
4. **Andamiaje de gobierno de IA ya escrito** (`lib/luft-ai/`): permisos por rol, propuestas con confianza y fuente, aprobación humana explícita. Dado el dato de 90–95% de exactitud en lectura de planos, esto vale más de lo que parece.

---

## 7. Mejoras propuestas, priorizadas

Ordenadas por relación entre valor y esfuerzo, no por vistosidad. Cada una con archivo concreto.

### Nivel 0 — Sin esto, lo demás no importa
| # | Mejora | Por qué | Esfuerzo |
|---|---|---|---|
| 0.1 | **Arreglar D-01**: medida de vidrio derivada del perfil y del rol de acristalamiento | Hoy el pedido de vidrio resta 120 mm fijos igual para 20 sistemas. Es dinero real y verificado en el producto corriendo | Alto |
| 0.2 | **Arreglar D-20**: envío final atómico | El cliente que termina el embudo ve un error y queda una cotización huérfana. Falla en el peor punto posible | Medio |
| 0.3 | **Arreglar D-02**: guarda positiva de dominio en el asesor | Endpoint público sin autenticación que obedece inyección 3 de 3 veces | Medio |
| 0.4 | **Reactivar CI** | 224 pruebas que hoy no protegen nada | Bajo |

### Nivel 1 — Cerrar la brecha competitiva en México
| # | Mejora | Por qué | Esfuerzo |
|---|---|---|---|
| 1.1 | **Catálogo de perfiles abierto y multiproveedor** | Optiglass trae EuroVent, Panorama 2" y 3", EuroAlum y Línea Española precargadas. LUFT tiene 2 marcas europeas cableadas en `data/catalog.ts`. Un cliente que pide Panorama 3" hoy no se puede cotizar | Alto |
| 1.2 | **Campos de clasificación NMX-R-060** y declaración en el documento | La vía más corta al arquitecto mexicano. AMEVEC publica la norma en abierto para que se especifique | Medio |
| 1.3 | **Cálculo de Uw por configuración** (ISO 10077), no la cadena por sistema | Requisito 2 del arquitecto y base de cualquier argumento energético. Hoy `System.uf` es texto | Alto |
| 1.4 | **Exportación DWG/DXF** de secciones y alzados | Requisito 8. Es lo que permite que el detalle entre al juego de planos del arquitecto | Alto |

### Nivel 2 — El intérprete de planos, hecho bien
| # | Mejora | Por qué | Esfuerzo |
|---|---|---|---|
| 2.1 | **Bandeja de planos sobre `lib/luft-ai/`**, con confianza y fuente por fila y aprobación humana obligatoria | La exactitud realista del estado del arte es 90–95% en planos limpios. Sin cola de revisión, 1 de cada 10-20 ventanas sale mal | Alto |
| 2.2 | **Priorizar la lectura del cuadro de vanos** sobre la lectura de geometría del dibujo | Extraer una tabla es mucho más confiable que interpretar cotas. Es donde la exactitud sube de golpe | Medio |
| 2.3 | **Tratar el plano como contenido no confiable** | Un PDF puede llevar texto dirigido al modelo. Dado D-02, no es hipotético | Bajo |
| 2.4 | **Configurar R2** | Hoy el Worker no tiene bucket: no hay dónde guardar un plano | Bajo |

### Nivel 3 — Producción, si el objetivo es dejar de ser solo documento de venta
| # | Mejora | Por qué | Esfuerzo |
|---|---|---|---|
| 3.1 | **Descuento de soldadura** (D-06) y **junquillos a la luz del galce** (D-09) | Sin esto la lista de corte no es fabricable, y el reporte ya afirma validar la soldadura (D-07) | Medio |
| 3.2 | **Salida CNC**, priorizada según la maquinaria real del taller | Toda la categoría A la tiene. Es la frontera entre cotizador y software de fabricación | Alto |
| 3.3 | **Gestión de retales** | La tienen los cuatro de categoría A. Hoy la merma es un porcentaje plano del 12% sin calibrar | Medio |
| 3.4 | **Usuarios con rol y bitácora** (D-17) | Hoy es una contraseña compartida. Imposible separar ventas de producción | Alto |

### Nivel 4 — Especificación para arquitectos, si se decide entrar ahí
| # | Mejora | Esfuerzo |
|---|---|---|
| 4.1 | Objetos BIM (familias Revit / IFC) con Uw, SHGC y acústica embebidos | Alto |
| 4.2 | Publicarlos en BIMobject y Arcat, donde el arquitecto los busca | Bajo, una vez existan 4.1 |
| 4.3 | Especificaciones formateadas para manual de proyecto | Medio |
| 4.4 | Antepecho y resistencia al fuego en el cuadro de vanos | Bajo |

---

## 8. Lo que recomiendo NO hacer

- **No competir con Klaes, LogiKal ni Soft Tech en su terreno.** Son décadas de desarrollo, 450 proveedores de sistemas y CNC de 5 ejes. La documentación de LogiKal misma señala su curva de aprendizaje y su mal ajuste al fabricante pequeño: ahí está el hueco, no en imitarlos.
- **No poner precio instantáneo en el cotizador público** para parecerse a la categoría C. Es la decisión que te distingue y tiene sentido en un negocio donde la medición cambia el precio.
- **No construir BIM antes de arreglar D-01.** Un objeto BIM con datos de desempeño inventados es peor que no tenerlo.
- **No creer las cifras de «40% menos errores y 60% más rápido».** No encontré respaldo independiente. Mide tu propia línea base antes y después.
- **No lanzar el lector de planos sin cola de revisión.** El propio estado del arte falla entre 5% y 10% en planos limpios.

---

## 9. Riesgo competitivo, resumido

| Amenaza | Gravedad | Por qué |
|---|---|---|
| **RA Workshop Lite gratis** | **Alta** | Cubre buena parte del uso interno de LUFT, a costo cero, con base instalada |
| **Optiglass con líneas mexicanas precargadas** | **Alta** | Resuelve el catálogo que LUFT no tiene, en el mercado de LUFT |
| Configuradores de categoría C consolidándose | Media | La ventaja de «configurador propio» se erosiona |
| Casas de sistemas dando software y BIM gratis al arquitecto | Media | Deja a LUFT fuera de la especificación |
| Lectura de planos con IA volviéndose estándar | Media | En 2026 ya es producto comercial con precio |

---

## 10. Conclusión

**Como producto de venta al consumidor final, LUFT está bien posicionado y tiene dos decisiones genuinamente propias** —configuración sin precio y asesor acotado por reglas— que no encontré replicadas. La ejecución de esa parte es sólida: la auditoría funcional le dio 18 de 25 pruebas en verde, cero importes filtrados en diez etapas y aritmética que cuadra.

**Como herramienta de fabricación no está listo**, y los defectos son concretos y conocidos, no vagos.

**Como herramienta de especificación para arquitectos, hoy no existe**: uno de doce requisitos cubierto.

La secuencia que recomiendo es la del informe: nivel 0 completo antes de cualquier función nueva, después catálogo abierto y NMX —que es lo que abre el mercado mexicano y el radar del arquitecto por poco dinero—, y el lector de planos con cola de revisión obligatoria. BIM y CNC son decisiones de estrategia, no de programación, y conviene tomarlas cuando el número que sale del motor sea confiable.

---

## Fuentes

**Categoría A**
- [LogiKal — Orgadata](https://www.logikal-software.com/en-us/product/logikal) · [Módulos](https://www.orgadata.com/global/en/solutions/logikal/modules-in-logikal.html) · [Foro de comunidad](https://community.orgadata.com/forum/board/19-logikal/)
- [Klaes — software para ventanas](https://www.klaes.de/en-klaes-software) · [Klaes CAM 2D](https://www.klaes.de/en-cam-2d) · [Klaes Vario](https://www.klaes.de/en-klaes-vario)
- [Soft Tech V6 — Cyncly](https://www.cyncly.com/products/soft-tech-v6) · [Caso Crystal Window & Door](https://www.cyncly.com/products/soft-tech-v6/case-study/crystal-windows-doors-systems/) · [FeneVision](https://www.cyncly.com/products/fenevision)
- [Windowmaker Express en Capterra](https://www.capterra.com/p/148243/Windowmaker-Express/) · [Windowmaker — fabricantes](https://windowmaker.com/manufacturers/) · [OptiMaker](https://windowmaker.com/en/Optimaker)
- [Logikal en Capterra UK](https://www.capterra.co.uk/software/1077696/Logikal) · [Soft Tech V6 en SoftwareAdvice](https://www.softwareadvice.com/manufacturing/soft-tech-v6-profile/)

**Categoría B y México**
- [RA Workshop Professional](https://www.raworkshop.com/ra-workshop-professional/) · [RA Workshop Lite](https://www.raworkshop.com/ra-workshop-lite/) · [Complemento CNC](https://www.raworkshop.com/ra-workshop-cnc-add-on/) · [Reseñas de usuarios](https://ra-workshop.software.informer.com/comments/)
- [Optiglass](https://optiglass-software.com/) · [SEIA](https://aluminioseia.wixsite.com/seia) · [Megevand México](https://megevandsoft.com/mexico/) · [winDOS](https://windosweb.com/)

**Categoría C y D**
- [Mercado de CPQ y configuradores de ventanas](https://www.vivid3d.ai/blog/window-door-quoting-cpq-configurator-software) · [Guía de configuradores](https://configurator.tech/blogs/product-configurators-doors-windows-guide/) · [Twikit](https://twikit.com/windows-and-doors/) · [IC COMPLEX](https://iccomplex.cloud/en/) · [WindowPerfect](https://windowperfect.com/) · [WinDoor Quote](https://www.windoorquote.com/)
- [Reynaers — BIM](https://www.reynaers.com/professional-services/bim) · [Reynaers — Architect Hub](https://www.reynaers.com/architect-hub) · [Schüco — descargas digitales](https://www.schueco.com/de-en/digital-solutions/downloads)

**Lectura de planos con IA**
- [Prueba de 6 plataformas de estimación con IA](https://roboticsandautomationnews.com/2026/02/19/6-ai-construction-estimating-software-tested-on-complex-project-accuracy/98967/) · [Estudio Togal.AI con revisión por pares](https://www.togal.ai/case-study/peer-reviewed-study-togal-ai-vs-on-screen-takeoff) · [Bobyard — puertas y ventanas, jun 2026](https://www.globenewswire.com/news-release/2026/06/17/3313581/0/en/bobyard-launches-ai-takeoff-and-estimating-for-flooring-drywall-paint-insulation-and-doors-windows.html) · [Qué significa realmente AI takeoff](https://easytakeoffs.com/blog/best-ai-takeoff-software)

**Requisitos del arquitecto y normativa**
- [Proceso de cuadro de vanos](https://layer.team/blog/the-door-and-window-schedule-process-explained) · [Guía de especificación para arquitectos](https://vanacht.co.za/blog/architects-guide-aluminium-windows-doors-van-acht-technical-resource/) · [BIMobject — ventanas](https://www.bimobject.com/en/categories/windows) · [Arcat — familias Revit de ventanas](https://www.arcat.com/content-type/bim/openings-08/windows-085000)
- [NMX-R-060-SCFI-2013 (AMEVEC)](https://www.amevec.mx/normativa/NMX-R-060-SCFI-2013.pdf) · [Declaratoria de vigencia en el DOF](https://www.dof.gob.mx/nota_detalle.php?codigo=5329472&fecha=13/01/2014) · [NMX-R-068/1-SCFI-2014](https://amevec.mx/normativa/NMX-R-068-1-SCFI-2014.pdf) · [Normalización AMEVEC](https://amevec.mx/portfolio-category/normalizacion/)
