import { createDefaultTree, defaultMarco, firstLeafId } from "@/lib/tree";
import type { ComponentData } from "@/types/project";

// Shared by every place that seeds a brand-new component (first component of a new
// project, or "+ Agregar componente" on an existing one) so they never drift apart.
export function defaultComponentData(): ComponentData {
  const tree = createDefaultTree();
  return {
    rail: 2,
    glassIndex: 7,
    face: "Ambas caras",
    margin: 35,
    installation: 1200,
    transport: 450,
    discount: 0,
    client: "",
    clientAddress: "",
    deliveryDate: "",
    selectedId: firstLeafId(tree),
    tree,
    marco: defaultMarco(),
    termsHeader: "Estimado/a, según sus indicaciones le presentamos la oferta de los productos solicitados. A continuación, el desglose de cada elemento:",
    paymentTerms: "A) 70% al momento de aprobación y firma del presente Contrato/Presupuesto.\nB) 30% al aviso de embarque de cancelería o vidrio.",
  };
}
