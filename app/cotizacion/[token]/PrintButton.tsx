"use client";

import { useEffect } from "react";

// Lo único que necesita JavaScript en la página del documento. Se aísla en su propio componente
// de cliente para que la cotización siga siendo HTML renderizado en el servidor: si el script no
// carga, el documento se lee igual y el navegador todavía puede imprimirlo desde su menú.
//
// `auto` es lo que hace que "Descargar PDF" del cotizador abra directamente el diálogo de
// impresión (`?print=1`), en vez de obligar al cliente a encontrar el botón otra vez.
export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    // Un cuadro de espera antes de imprimir: el diálogo congela el render, y sin esta pausa
    // Safari lo abre sobre un documento a medio pintar.
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [auto]);

  return (
    <button className="quoteDocPrint" onClick={() => window.print()}>
      Descargar PDF
    </button>
  );
}
