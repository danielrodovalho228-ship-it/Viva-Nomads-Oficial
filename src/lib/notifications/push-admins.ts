import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushParaUsuarios } from "./push";

/** Push para todos os admins (profiles.role = 'admin'). Best-effort; conteúdo sem dado pessoal. */
export async function pushParaAdmins(c: { title: string; body: string; url?: string }): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { data } = await admin.from("profiles").select("id").eq("role", "admin");
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  const r = await sendPushParaUsuarios(ids, c);
  return "sent" in r ? r.sent : 0;
}
