import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushParaUsuarios } from "./push";
import { escolherDestinatarios, type AdminDestino } from "./destinatarios-admin";

/** Admins com as marcas de aviso (recebe_avisos_ceo / recebe_alertas_operacionais). Vazio sem Supabase ou se a leitura falhar. */
export async function adminsPorAviso<T extends object = object>(
  tipo: "ceo" | "operacional",
  colunas = "",
): Promise<(AdminDestino & T)[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("profiles")
    .select(`id, role, recebe_avisos_ceo, recebe_alertas_operacionais${colunas ? `, ${colunas}` : ""}`)
    .eq("role", "admin");
  if (error) {
    console.error("[avisos] não foi possível ler os admins:", error.message);
    return [];
  }
  return escolherDestinatarios((data ?? []) as unknown as (AdminDestino & T)[], tipo);
}

/** Push dos avisos do Moacir e das decisões de CEO: SÓ quem tem profiles.recebe_avisos_ceo (o Daniel). Best-effort; sem dado pessoal. */
export async function pushParaCeo(c: { title: string; body: string; url?: string }): Promise<number> {
  const ids = (await adminsPorAviso("ceo")).map((a) => a.id);
  const r = await sendPushParaUsuarios(ids, c);
  return "sent" in r ? r.sent : 0;
}
