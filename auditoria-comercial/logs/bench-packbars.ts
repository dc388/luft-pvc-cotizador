/**
 * Comparación rigurosa del empaquetado de barras: implementación ANTERIOR contra la ACTUAL, en el
 * mismo proceso.
 *
 * El tiempo de pared en esta máquina tiene una varianza de hasta 9x entre corridas, así que:
 *   - se cuentan OPERACIONES del bucle interno, que es exacto y reproducible; y
 *   - del tiempo se toma el MÍNIMO de N repeticiones, no el promedio: el ruido solo puede sumar
 *     tiempo, nunca restarlo, así que el mínimo es la estimación honesta del costo real.
 * También se comprueba que ambas devuelvan el mismo empaquetado, pieza por pieza.
 */
import { packBars as packNuevo, BAR_LENGTH_MM, KERF_MM, type CutPiece, type PackedBar } from "@/lib/calc";

let opsViejo = 0;
let opsNuevo = 0;

/** Implementación anterior, copiada tal cual de lib/calc.ts antes del cambio. */
function packViejo(pieces: CutPiece[], barLength: number, kerf: number): PackedBar[] {
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const bars: { pieces: CutPiece[] }[] = [];
  for (const piece of sorted) {
    let placed = false;
    for (const bar of bars) {
      // El reduce recorre TODAS las piezas que ya lleva la barra, por cada barra y por cada pieza.
      opsViejo += bar.pieces.length;
      const used = bar.pieces.reduce((a, p) => a + p.length, 0) + bar.pieces.length * kerf;
      if (used + piece.length <= barLength) {
        bar.pieces.push(piece);
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ pieces: [piece] });
  }
  return bars.map((bar) => {
    const used = bar.pieces.reduce((a, p) => a + p.length, 0) + Math.max(0, bar.pieces.length - 1) * kerf;
    return { pieces: bar.pieces, used, waste: barLength - used };
  });
}

/** Cuenta las operaciones de la versión actual: una comparación por barra candidata, sin recorrer
 *  las piezas que la barra ya lleva. Espeja exactamente el bucle de lib/calc.ts. */
function contarNuevo(pieces: CutPiece[], barLength: number, kerf: number): void {
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const bars: { reserved: number }[] = [];
  for (const piece of sorted) {
    let placed = false;
    for (const bar of bars) {
      opsNuevo += 1;
      if (bar.reserved + piece.length <= barLength) {
        bar.reserved += piece.length + kerf;
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ reserved: piece.length + kerf });
  }
}

function pieces(n: number, seed: number): CutPiece[] {
  const p: CutPiece[] = [];
  for (let i = 0; i < n; i++) p.push({ label: `P${i}`, length: 300 + ((i * seed) % 5400), angle: "45°" });
  return p;
}

function huella(bars: PackedBar[]): string {
  return `${bars.length}|` + bars.map((b) => `${b.used}/${b.waste}:${b.pieces.map((p) => p.length).join(".")}`).join(";");
}

/** Mínimo de `reps` mediciones: robusto frente a la carga de la máquina. */
function minMs(reps: number, fn: () => void): number {
  let best = Infinity;
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms < best) best = ms;
  }
  return best;
}

console.log("=".repeat(100));
console.log("EMPAQUETADO DE BARRAS — anterior contra actual (mismo proceso, minimo de 40 mediciones)");
console.log("=".repeat(100));
console.log("piezas |    ops antes |  ops ahora | menos ops |   ms antes |   ms ahora | mas rapido | igual salida");
console.log("-".repeat(100));

let todoIgual = true;
for (const n of [100, 200, 400, 800, 1600, 3200]) {
  const p = pieces(n, 137);

  opsViejo = 0; packViejo(p, BAR_LENGTH_MM, KERF_MM);
  opsNuevo = 0; contarNuevo(p, BAR_LENGTH_MM, KERF_MM);

  const igual = huella(packViejo(p, BAR_LENGTH_MM, KERF_MM)) === huella(packNuevo(p, BAR_LENGTH_MM, KERF_MM));
  if (!igual) todoIgual = false;

  // Calentamiento de ambas antes de medir, para que el JIT no favorezca a la primera.
  for (let i = 0; i < 5; i++) { packViejo(p, BAR_LENGTH_MM, KERF_MM); packNuevo(p, BAR_LENGTH_MM, KERF_MM); }
  const msViejo = minMs(40, () => { packViejo(p, BAR_LENGTH_MM, KERF_MM); });
  const msNuevo = minMs(40, () => { packNuevo(p, BAR_LENGTH_MM, KERF_MM); });

  console.log(
    `${String(n).padStart(6)} | ${opsViejo.toLocaleString("en").padStart(12)} | ${opsNuevo.toLocaleString("en").padStart(10)} | ` +
    `${(opsViejo / opsNuevo).toFixed(1).padStart(8)}x | ${msViejo.toFixed(3).padStart(10)} | ${msNuevo.toFixed(3).padStart(10)} | ` +
    `${(msViejo / msNuevo).toFixed(2).padStart(9)}x | ${igual ? "si" : "NO"}`
  );
}
console.log("-".repeat(100));
console.log(todoIgual ? "Empaquetado identico en todos los tamanos." : "ATENCION: el empaquetado cambio.");
