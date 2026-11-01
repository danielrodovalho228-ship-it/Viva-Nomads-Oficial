import { listLeads } from "@/lib/data/leads";
import { LeadsClient } from "./leads-client";

export default async function LeadsPage() {
  const leads = await listLeads({ exigir: true });
  return <LeadsClient leads={leads} />;
}
