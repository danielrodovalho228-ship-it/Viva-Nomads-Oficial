import { listLeads } from "@/lib/data/leads";
import { LeadsClient } from "./leads-client";

export default async function LeadsPage() {
  const leads = await listLeads();
  return <LeadsClient leads={leads} />;
}
