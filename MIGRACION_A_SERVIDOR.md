# Migrar la plataforma a un servidor

Notas para quien recibe el repositorio y lo levanta en otro sitio. Escrito el 13/08/2026 sobre
`master` en `85a7db4`.

## Qué clonar

`master`. Contiene todo lo que existe: es la rama por omisión y va por delante de todas las demás.
`production` e `integracion/consolidado` apuntan al mismo commit.

Tres ramas conservan commits que NO están en `master`, a propósito:

| Rama | Qué tiene | Qué hacer |
|---|---|---|
| `costeo/mano-obra-merma-utilidad-neta` | El commit original de la corrección de subcosteo | Nada. Ya está en `master`, portado a mano (`85a7db4`), porque el commit original salió antes de que la app se refactorizara y no se podía fusionar. Se conserva por trazabilidad. |
| `claude/merge-integration` | 3 commits del 07/08, uno de ellos titulado "Backup snapshot of working tree" | Nada. Es un experimento anterior a 55 commits de trabajo posterior; fusionarlo resucitaría código ya reemplazado. |
| `claude/vibrant-raman-24a74b` | 2 commits del 07-08/08 sobre el editor 2D/3D | Igual que el anterior. |

## Base de datos

Cloudflare D1, binding `DB`, base `luft-pvc-cotizador-db` (ver `wrangler.jsonc`). Ocho migraciones
en `drizzle/`, que crean 15 tablas.

**Desde cero** — verificado: las ocho aplican en orden sin un solo error.

```bash
npx wrangler d1 migrations apply DB --remote
```

**Sobre una base que YA tiene proyectos guardados** hay una trampa, y conviene saberla antes y no
a mitad del proceso: `0005_project_manager.sql` crea un índice único sobre `projects.folio`. Si la
base trae dos proyectos con el mismo folio, la migración **falla a medias**: las columnas nuevas ya
quedaron agregadas y el índice no, así que reintentar sin arreglar los datos vuelve a fallar.

Comprobarlo *antes* de migrar:

```sql
SELECT folio, COUNT(*) c FROM projects WHERE folio <> '' GROUP BY folio HAVING c > 1;
```

Si devuelve renglones, hay que decidir folio por folio. Vaciar el folio es válido — el índice es
parcial (`WHERE folio <> ''`) y el explorador muestra esos proyectos como "Sin folio" — pero pierde
la referencia comercial. Darle el siguiente folio libre la conserva. En la base de desarrollo
apareció un duplicado (`LUFT-2026-000001`, dos cotizaciones web) y se resolvió con lo segundo.

## Lista de precios de herrajes MACO

El catálogo de herrajes no viaja en el repositorio: son 637 artículos que se importan desde el
Excel del proveedor, que no está versionado a propósito.

```bash
npm run maco:import -- --file="<ruta al .xlsx o al .lnk>"
```

Escribe **solo en la base local** (Miniflare). No hay bandera para apuntar a la remota: eso es una
decisión humana y un camino distinto. La importación es idempotente — los identificadores se derivan
del contenido, así que repetirla no inserta ni actualiza nada.

La revisión `ABR_22` queda marcada **histórica y no activa**, y `supplier_hardware_mappings` nace
vacía: sin un manual del fabricante que pruebe qué herraje lleva cada configuración, no hay lista de
materiales, y el motor de cotización conserva su estimación. Ver `lib/maco/costing.ts`.

El Excel trae además una hoja `orden` con RFC, domicilio, contactos y datos bancarios de un cliente.
**El importador no la lee**: pide la hoja `precio` por nombre y no existe forma de recorrer todas las
hojas. No la cambien por una que itere el libro completo.

## Lo que este repositorio NO trae

- **Secretos.** Contraseña de la app interna, credenciales de Cloudflare y datos bancarios de la
  empresa viven en variables de entorno y en archivos `.env*` ignorados. Hay que reponerlos.
- **Almacenamiento de archivos privados.** Los manuales técnicos de herrajes necesitarán un bucket
  (R2); hoy solo se guardan metadatos y la ruta.

## Comprobación después de levantarlo

```bash
npm run test:unit && npm run test:maco && npm run test:costeo && npm test
```

En la última corrida verificada: 125 + 71 + 9 unitarias y 19 sobre el artefacto ya construido, todas
en verde. `npm run lint` reporta 59 errores y ~4.2k avisos **preexistentes**, iguales desde antes de
esta consolidación: no son una regresión, pero tampoco están limpios.
