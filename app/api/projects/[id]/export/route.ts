import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { buildId } from "@/lib/buildVersion";
import { projectFileName, serializeProject } from "@/lib/projectFile";
import { getProject, getProjectComponents } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

/**
 * El proyecto completo como archivo.
 *
 * El archivo se arma en el servidor y no en el navegador porque el navegador solo tiene cargado el
 * componente abierto: exportar desde el cliente exigiría pedir uno por uno los demás y confiar en
 * que ninguna petición falló. Aquí sale de la base en una lectura.
 *
 * `?componentIds=a,b` exporta solo esos componentes, para "Exportar componentes seleccionados". El
 * archivo sigue siendo un proyecto válido -- con su ficha de solicitante y sus metadatos -- porque
 * lo que se quiere al exportar una selección es poder abrirla en otro lado, no un fragmento suelto.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const project = await getProject(db, id);
    if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });

    const requested = new URL(request.url).searchParams.get("componentIds");
    const wanted = requested ? new Set(requested.split(",").filter(Boolean)) : null;
    const all = await getProjectComponents(db, id);
    const selected = wanted ? all.filter((component) => wanted.has(component.id)) : all;
    if (wanted && selected.length === 0) {
      return Response.json({ error: "Ninguno de los componentes pedidos existe en este proyecto." }, { status: 400 });
    }

    const file = serializeProject(project, selected, { exportedBy: buildId() });
    const name = projectFileName(project.folio, wanted ? `${project.name}_seleccion` : project.name);
    return new Response(JSON.stringify(file, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
