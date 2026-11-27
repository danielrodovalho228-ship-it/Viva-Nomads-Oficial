import { listLeads, pendenciaDoDonoParaAceite } from "@/lib/data/leads";
import { LeadsClient } from "./leads-client";

export default async function LeadsPage() {
  // E569: a pendência do dono (documento) vai junto, para o cartão avisar antes de qualquer clique.
  const [leads, pendencia] = await Promise.all([listLeads({ exigir: true }), pendenciaDoDonoParaAceite()]);
  return <LeadsClient leads={leads} pendencia={pendencia} />;
}
