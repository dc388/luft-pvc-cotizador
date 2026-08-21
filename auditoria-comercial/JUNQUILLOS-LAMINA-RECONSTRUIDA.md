# Lámina de junquillos Aluplast · reconstrucción por coordenadas

Fuente: `14 Junquillos.pdf` (aluplast GmbH, lámina DIN A0 → A3, «Perfiles con folio decorativo y
perfiles con junta según lista de precios»).

## Cómo se leyó, y por qué costó

La lámina tiene el texto **rotado**, así que la extracción por orden de lectura devuelve los códigos
y las cotas mezclados: `pypdf` avisa «Rotated text discovered. Output will be incomplete» y el modo
`layout` no devuelve nada.

Lo que sí funciona es leer cada fragmento **con su coordenada** y reagrupar por filas. La lámina son
999 fragmentos, de los que **66 son códigos de junquillo** y 172 son cotas. Agrupando por Y con una
tolerancia de 25 unidades salen **16 filas**, que es la estructura real de la tabla.

## La tabla

| Fila | Códigos de junquillo | Cotas impresas en la fila |
|---|---|---|
| 1 | `120632` `120662` `130683` `120649` | — |
| 2 | `120832` `120862` `130883` `120849` | — |
| 3 | `120633` `120663` `130753` `120642` `120672` `120651` | 14 · 14.5 |
| 4 | `120833` `120863` `130654` `130684` `120851` | 14.5 |
| 5 | `120635` `120659` `120689` `120647` | 20 · 18 · 18.5 |
| 6 | `120835` `130784` `120859` `120889` `120847` | 20 · 18 · 18.5 |
| 7 | `120636` `120666` `130636` `130666` `120650` `130650` `120646` `120676` `130656` `130686` `130680` | 20 · 30 · 22 · 20 · 30 · 22 · 20 · 22.5 |
| 8 | `120836` `120866` `130836` `130866` `120850` `130850` `130880` `120846` `120876` `130856` `130886` | 20 · 30 · 22 · 20 · 30 · 22 · 20 · 20 · 30 · 22.5 |
| 9 | `120736` `120766` | 20 · 22 |
| 10 | `120638` `120855` `120885` | 20 · 20 · 26.5 |
| 11 | `120838` | 20 |
| 12 | `120738` `120768` | 20 · 20 · 30 · 10 · 7 |
| 13 | `120640` `120670` | 20 · 43.5 |
| 14 | `120840` `120870` | 20 · 20 · 30 · 10 |
| 15 | `120740` `120770` `130250` | 20 · 15 |
| 16 | `120846` | — |

## Qué se puede afirmar y qué no

**Se puede afirmar:** son 66 referencias de junquillo, organizadas en 16 filas, y las familias van
por prefijo: `1206xx` y `1208xx` son las dos series principales (aparecen en pareja fila arriba /
fila abajo con el mismo sufijo), `1207xx` y `130xxx` son series aparte. Dentro de una fila los códigos
se emparejan con un salto de 30 en el sufijo: `120632`/`120662`, `120636`/`120666`,
`120640`/`120670`.

**NO se puede afirmar que el sufijo sea el galce.** Fue la primera hipótesis y **es falsa**: en la
ficha de MULTI SLIDE 96 un galce de 22 mm usa el junquillo `120636`, y en CORREDERA 60N aparecen
`120833` y `120835` con galces de 20, 18 y 16. El sufijo es índice de catálogo, no medida.

**NO se puede afirmar qué cota de cada fila es el ancho de cara.** Las cotas son texto suelto sobre
un dibujo de sección; sin las líneas de cota no se sabe a qué mide cada número.

## Y sobre todo: esta lámina no trae lo que la aplicación necesita

`beadFor` necesita el **descuento de longitud de corte** — cuánto mide menos el junquillo que la hoja
en la que se aloja. Ese dato **no está aquí**, ni tenía por qué: es una regla de fabricación y vive en
las hojas de cálculo de material, que es exactamente de donde salió el `hoja − 89` del sistema IS.

Lo que esta lámina es: el **catálogo de piezas**. La correspondencia por sistema
(`Galce de vidrio | Junquillo + Junta | Espesor de acristalamiento`) está en las fichas mexicanas de
cada sistema, y también con texto rotado. De CORREDERA 60N se recuperó la escalera de espesores
—**3-5, 6-7, 8-9, 10-11, 12-13, 14-15, 16-17, 18-19 mm**— con los junquillos `120833`, `120835` y
`140631` y galces de 20, 18 y 16, pero **sin poder emparejar fila por fila**.

## Sospecha que queda abierta, sin actuar sobre ella

La escalera de espesores de CORREDERA 60N **termina en 18-19 mm**, y la aplicación declara
`glazing: 24` para CORREDERA 60MM y su monorriel. Con eso, hoy se pueden cotizar sobre ese sistema un
**DVH 24 mm · 6/12/6** y un **DVH 20 mm · 4/12/4**.

**No se ha cambiado nada.** La escalera reconstruida puede ser solo la de vidrio sencillo y laminado,
con los dobles en otra fila de la lámina que no se recuperó — la ficha de MULTI SLIDE sí muestra un
`24` cerca de la cabecera. Bajar el galce de 24 a 19 bloquearía cotizaciones que quizá son legítimas,
y eso es tan dañino como permitir las que no lo son. **Es la pregunta a confirmar con aluplastmex.**

## Lo que hay que pedir a Aluplast

Una sola cosa, y cierra los dos huecos:

> La tabla **Galce de vidrio · Junquillo + Junta · Espesor de acristalamiento** en formato de datos
> (Excel o CSV), para CORREDERA 60, CORREDERA 96 y ELEVADORA 70; y el descuento de longitud de corte
> del junquillo de cada uno, como el `hoja − 89` que aparece en la hoja de material del IS.
