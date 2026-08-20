// Geometría del ajuste del dibujo al lienzo. Vive aparte de PanZoomViewport.tsx para poder
// comprobarla con medidas reales del lienzo (ver tests/fitBox.test.ts): es la que decide el
// tamaño del dibujo 2D, y ya se equivocó una vez por suponer el hueco en vez de medirlo.

// Hueco que el dibujo deja libre dentro del lienzo, lado por lado. Antes era simétrico (76 px a
// izquierda y derecha, 58 arriba y abajo) porque las cotas generales flotaban sobre el lienzo y
// podían caer en cualquier borde. Ahora van pegadas al dibujo, y solo hay cotas abajo y a la
// izquierda: reservar los mismos 76 px a la derecha era regalar 108 px de ancho de un lienzo que
// en 1366x768 mide 333. Estos valores tienen que ser LOS MISMOS que el padding de .panZoomLayer
// en app/globals.css -- ahí se centra el dibujo dentro de la caja que aquí se calcula.
// El hueco de arriba es el que ocupan los controles de zoom y la pista de uso (.viewportControls
// y .viewportHint, ambos de 24 px de alto a 10 px del borde): sin reservarlo, el dibujo crece por
// debajo de ellos y le tapan la esquina del marco.
export const FIT_PAD = { top: 44, right: 18, bottom: 60, left: 56 };

// Por debajo de esto no hay lienzo real que medir (primer render, panel plegado): se deja que el
// CSS aplique su valor de reserva en vez de fijar un tamaño absurdo.
export const MIN_FIT_PX = 80;

/** El rectángulo más grande con proporción `aspect` que cabe en el lienzo, sin deformarlo. */
export function fitBox(containerWidth: number, containerHeight: number, aspect: number) {
  const availableWidth = containerWidth - FIT_PAD.left - FIT_PAD.right;
  const availableHeight = containerHeight - FIT_PAD.top - FIT_PAD.bottom;
  if (!(aspect > 0) || availableWidth < MIN_FIT_PX || availableHeight < MIN_FIT_PX) return null;
  const width = Math.min(availableWidth, availableHeight * aspect);
  return { width, height: width / aspect };
}
