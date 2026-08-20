import type { FrameNode } from "@/types/domain";
import { cotaChains } from "./cotaChain";

/**
 * Cadena de cotas parciales: el ancho de cada hoja abajo y el alto de cada fila a la izquierda,
 * pegadas al dibujo como en una alzada de carpintería. Antes la medida de cada hoja iba dentro de
 * su propio vidrio, en una pastilla; eso ni se lee a tamaño real ni se puede comprobar de un
 * vistazo, porque para saber si el reparto cuadra hay que sumar cuatro pastillas a mano.
 *
 * El reparto lo calcula cotaChain.ts, que es donde está explicado por qué son las medidas
 * nominales y no las de fabricación, y está cubierto por tests/cotaChain.test.ts.
 */
export function DimensionChain({ tree, width, height }: { tree: FrameNode; width: number; height: number }) {
  const { xs, ys } = cotaChains(tree, width, height);

  return (
    <>
      {/* Con un solo tramo la cadena repetiría la cota total, así que no se dibuja. */}
      {xs.length > 1 && (
        <div className="cotaChain cotaChainX" aria-label="Anchos parciales">
          {xs.map((s) => (
            <span
              key={`x-${s.at.toFixed(2)}`}
              className="cotaSeg"
              style={{ left: `${(s.at / width) * 100}%`, width: `${(s.len / width) * 100}%` }}
              title={`Ancho parcial ${Math.round(s.len)} mm`}
            >
              <b>{Math.round(s.len)}</b>
            </span>
          ))}
        </div>
      )}
      {ys.length > 1 && (
        <div className="cotaChain cotaChainY" aria-label="Altos parciales">
          {ys.map((s) => (
            <span
              key={`y-${s.at.toFixed(2)}`}
              className="cotaSeg"
              style={{ top: `${(s.at / height) * 100}%`, height: `${(s.len / height) * 100}%` }}
              title={`Alto parcial ${Math.round(s.len)} mm`}
            >
              <b>{Math.round(s.len)}</b>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
