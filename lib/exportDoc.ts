// Browser-only multi-format export for the printable reports (PDF stays window.print()-based,
// unchanged) -- deliberately built on nothing but Blob/URL.createObjectURL so it needs no new
// npm dependency (docx/xlsx generation would each pull in a real library). HTML export produces
// a genuinely standalone file (the page's own compiled stylesheet is inlined, not linked) so it
// still looks right when opened later, offline, on another machine. CSV covers the two reports
// that are naturally tabular (Optimización de corte, Pedido de vidrio); DOCX/XLS are a known gap,
// see the comparison this shipped alongside.

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Exports whatever is currently rendered inside the first ".reportDoc" element (the live
// report preview) as a standalone .html file. Grabs the page's own <link rel="stylesheet">
// content at export time rather than bundling a copy, so it never drifts from the real styles.
export async function exportReportHtml(title: string, filename: string) {
  const el = document.querySelector(".reportDoc");
  if (!el) return;
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  const cssTexts = await Promise.all(
    styleLinks.map((link) =>
      fetch(link.href)
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => "")
    )
  );
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${cssTexts.join("\n")}
body { background: #fff; padding: 24px; }
</style>
</head>
<body>
${el.outerHTML}
</body>
</html>`;
  downloadFile(filename, html, "text/html");
}

// Minimal RFC 4180-ish CSV encoder: quotes a field only when it contains a comma, quote, or
// newline, doubling embedded quotes -- enough for the plain numeric/label data these reports
// produce, not a general-purpose CSV library.
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((v) => {
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\r\n");
}
