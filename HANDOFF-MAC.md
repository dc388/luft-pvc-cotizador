# Continuidad de trabajo — de la PC de Windows a la Mac

Escrito el 2026-08-15 al cerrar la sesión en Windows.

Una aclaración primero, para que no haya sorpresas: **la conversación de Claude Code no se puede migrar**. El transcript vive en `~/.claude/projects/` de cada máquina y no hay forma de transferir una sesión entre equipos. Este documento existe para reemplazarla: contiene el estado, las decisiones y los pendientes necesarios para retomar en la Mac sin releer nada.

---

## 1. Qué hacer al llegar a la Mac

```bash
git clone https://github.com/dc388/luft-pvc-cotizador.git
cd luft-pvc-cotizador
git fetch --all --tags
```

Si ya tienes el repositorio clonado ahí:

```bash
git fetch --all --tags && git pull
```

Después, abre Claude Code en esa carpeta y dile:

> Lee HANDOFF-MAC.md y auditoria-comercial/REPORTE-AUDITORIA.md y continuamos desde ahí.

---

## 2. Estado del repositorio — leer antes de tocar nada

### Hay 4 commits en `master` que NO están en GitHub

Este es el punto delicado de la migración. `master` local (Windows) va 4 commits adelante de `origin/master`, y **no se pudieron subir**:

```
! [remote rejected] master -> master
  (refusing to allow an OAuth App to create or update workflow
   `.github/workflows/ci.yml` without `workflow` scope)
```

Los 4 commits son:

| Commit | Descripción |
|---|---|
| `186e910` | ci: cubrir en el pipeline las suites que aparecieron después |
| `e6fd11c` | Merge de `ci/fix-workflow` en `integracion/consolidado` |
| `d062d27` | chore: sacar de package.json la ruta atada a esta computadora |
| `86721ac` | docs: notas para migrar la plataforma a otro servidor |

**Para desbloquearlo** hay que refrescar el token con alcance `workflow`. Es interactivo, tiene que hacerlo una persona:

```bash
gh auth refresh -h github.com -s workflow
```

Y después, **desde la PC de Windows** (es donde están los commits):

```bash
git push origin master
```

> ⚠️ **No borres ni reinstales la PC de Windows antes de hacer esto.** Esos 4 commits solo existen ahí. Incluyen el arreglo real del pipeline de CI.

### Lo que sí quedó a salvo en GitHub

| Referencia | Contenido |
|---|---|
| `backup/pre-audit-20260807` | Rama de respaldo con 1 commit propio |
| tag `wip/local-dev-gate` | El trabajo de `__LUFT_LOCAL_DEV__` (desbloqueo del candado interno en loopback durante desarrollo): `vite.config.ts`, `lib/internalGate.ts`, `types/build.d.ts`, `.claude/launch.json` |
| `auditoria/comercial-2026-08` | Los entregables de la auditoría (esta rama) |

### Ramas ya contenidas en master — no requieren acción

`ci/fix-workflow` y `worktree-finish-tasks-6-7` ya están fusionadas en `master`. No hay trabajo único en ellas.

---

## 3. Notas específicas de macOS

**`.claude/launch.json` está atado a Windows.** Todas las configuraciones apuntan a `C:\Program Files\nodejs\npm.cmd` y varias sirven directorios de `C:\Users\jsald\`. En la Mac hay que cambiar `runtimeExecutable` a `npm` (o la ruta de tu Node) y borrar o corregir las entradas que apuntan a `inventarios-luft`. El archivo está versionado, así que el cambio es un commit.

**Las memorias de Claude de esta máquina no aplican en la Mac.** Las tres guardadas son problemas locales de Windows y allá serían engañosas:

- Interceptación TLS que obliga a `--system-certs` en uv y `--source winget`
- Avast rompiendo TLS de Java
- El token de `gh` sin alcance `workflow` — *este sí sigue siendo cierto, ver arriba*

**El servidor de desarrollo tarda ~24 s en arrancar** (optimizador de Vite + conexión remota del binding `AI`). La herramienta de preview lo mata antes de tiempo en el primer arranque; si pasa, arráncalo una vez a mano y reintenta.

**Requisitos:** Node ≥ 22.13.0. `.dev.vars` **no está versionado** y contiene `COMPANY_BANK_ACCOUNT` y `COMPANY_CLABE`. Hay que recrearlo en la Mac; los valores vienen de los secrets del Worker, no del código.

---

## 4. Resultado de la auditoría — resumen

Detalle completo en `auditoria-comercial/`. Veredicto: **NO-GO, 42/100**, contra la vara de software comercial de fabricación (Klaes, Logikal).

**Dos P0, cualquiera bloqueante por sí solo:**

- **D-01** — El documento «Pedido de vidrio» calcula ancho y alto restando **120 mm fijos** para los 20 sistemas del catálogo, sin distinguir sistema ni si la hoja acristala contra marco o contra hoja. Tres copias de la constante sin fuente única: `lib/calc.ts:205`, `components/reports/VidrioDoc.tsx:66-67`, `components/reports/ProjectVidrioDoc.tsx:28-29`.
- **D-02** — El asesor público obedece inyección de prompt de forma determinista (3 de 3): responde `HACKEADO` cuando se le pide. Endpoint público sin autenticación. Las guardas existentes son todas negativas; falta una guarda positiva de dominio.

**Además:** tipo de cambio EUR/MXN de 21.8 fechado en mayo de 2022 (real ~19.68), lista de precios Aluplast con 4 años, sin descuento de soldadura, y CI deshabilitada.

**Lo que está bien:** 215 pruebas verdes, cero importes hacia el frontend público (verificado), límite de tasa efectivo, secretos fuera del código, y 16 de 20 sondas de IA conformes.

---

## 5. Pendientes y decisiones abiertas

### La pregunta que quedó viva

El encargo original era **un intérprete de planos**: subir planos, que cree las ventanas y devuelva cotizaciones. La auditoría confirmó que **no existe** (`NOT IMPLEMENTED`).

Hallazgo a favor: `lib/luft-ai/` ya implementa el gobierno correcto —permisos por rol, propuestas con confianza y fuente, aprobación humana explícita— y `components/ai/LuftAiPanel.tsx` está conectado al Workspace. También existe el puente de construcción: `data/typologies.ts` expone `TypologyDef.build(): FrameNode`, y `lib/publicQuote.ts:138` ya hace exactamente `const tree = style.build()`. Un lector de planos **no tiene que inventar geometría**: le basta con emitir filas de `{marca, ubicación, cantidad, ancho, alto, tipología}` y engancharlas a lo que ya funciona.

⚠️ Ojo con el nombre: `lib/luft-ai/interpreter.ts` interpreta **texto** («ancho a 1200»), no planos. Conviene renombrarlo.

**Tres decisiones bloqueantes antes de construirlo:**

1. **Cómo llegan los planos**: ¿PDF exportado de CAD, escaneo/foto, DWG? ¿Traen «cuadro de vanos» (tabla de ventanas con marca, cantidad y medidas)? Si lo traen, la extracción es mucho más confiable que leer cotas del dibujo.
2. **Qué modelo**: Workers AI (ya está el binding, sin costo ni llaves nuevas, pero débil con planos) contra API de Anthropic (mucho mejor, requiere API key y gasto por documento). Decisión de costo y arquitectura.
3. **Un plano real para construir y verificar contra él.** Instrucción permanente del proyecto: **NO QUIERO SIMULACIONES**. Construir contra un plano inventado la violaría.

**Falta infraestructura:** el Worker **no tiene bucket R2** (`"r2_buckets": []`). Hoy no hay dónde guardar un plano cargado.

### Otros pendientes arrastrados

- **Despliegue**: producción sirve `f25e515`. Los commits `52a3a22` y `2a0c754` **no están desplegados**. Pregunté si desplegar y no hubo respuesta.
- **PR #3** sigue sin fusionar en `master`.
- **CI**: el workflow de build está en `disabled_manually`. Hoy no hay CI en absoluto.
- **Segundo workflow suelto**: `SLSA generic generator` (id `331229916`) sigue `active`. Ofrecí deshabilitarlo, sin respuesta.
- **Dominio propio** apuntando al Worker: pendiente.
- **Panel de Clientes en producción**: confirmar la interfaz juntos.

---

## 6. Reglas del proyecto que siguen vigentes

Estas no son preferencias, son restricciones que se han sostenido a lo largo del proyecto:

- **Datos bancarios** (Banco, Cuenta, CLABE, Beneficiario) nunca en el código. Vienen de secrets del Worker vía `lib/companySettings.ts`, que **no tiene valores por defecto**. Ninguna ruta de API debe exponerlos.
- **El frontend público nunca decide** precio total, anticipo, saldo, descuento, impuestos, tiempo de fabricación definitivo ni estado del pedido.
- **Ningún importe en la interfaz del cliente durante la configuración** — y no basta con ocultarlo por CSS: el dinero no debe viajar al frontend público. El precio aparece por primera vez dentro del documento definitivo.
- **El cliente nunca ve** costos internos, márgenes, proveedores, errores técnicos ni detalles de fabricación.
- **Perfilería Aluplast** siempre; nunca es una elección del cliente. Aluplast es marca de perfiles de **PVC**, no de aluminio.
- **Expediente con folio único**, sin duplicados y sin borrar cotizaciones pasadas. Volver atrás no debe borrar medidas, configuración, color, vidrio ni datos personales.
- **Errores junto a su campo.** Sin scroll, especialmente en 1366×768 y 1280×720.
- **NO QUIERO SIMULACIONES.**
- La contraseña del acceso interno no se escribe en ningún campo durante auditorías; se usa una contraseña desechable local.

---

## 7. Comandos útiles

```bash
npm run dev          # servidor local (puerto 5173, tarda ~24 s el primer arranque)
npm run build        # build verificado
npm run test         # build + integración (19)
npm run test:unit    # unitarias (125)
npm run test:maco    # herrajes MACO (71)
npm run test:agents  # agentes LUFT (82)
```

Para reproducir las sondas de seguridad de IA con el servidor corriendo:

```bash
node auditoria-comercial/logs/probe-ia.mjs
```
