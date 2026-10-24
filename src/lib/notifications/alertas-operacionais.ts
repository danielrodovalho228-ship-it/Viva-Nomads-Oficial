import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "./index";
import { adminsPorAviso } from "./push-admins";

/*
  Prompt 44 (item 3) — alertas operacionais da equipe por push (e e-mail, quando o evento tem), SÓ para admins com
  "receber alertas operacionais" (recebe_alertas_operacionais). Um alerta por chave (automacoes_envios): o cron pode
  rodar de novo sem repetir. Nunca leva dado pessoal.
    • alerta_backup_falhou: a última cópia noturna (backups_execucoes, tipo "copia") não terminou;
    • alerta_email_falhou: o envio de e-mail falhou (no máximo 1 alerta por hora, só push + central — e-mail que
      avisa que o e-mail falhou não chegaria).
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type EventoAlerta = "alerta_backup_falhou" | "alerta_email_falhou";

/** Grava a chave; devolve false se o alerta desta chave já saiu. */
async function primeiraVez(admin: Admin, chave: string, tipo: string): Promise<boolean> {
  const { error } = await admin.from("automacoes_envios").insert({ chave, tipo });
  return !error;
}

export async function alertarEquipe(evento: EventoAlerta, chave: string, admin: Admin | null = createAdminClient()): Promise<number> {
  if (!admin || !(await primeiraVez(admin, chave, evento))) return 0;
  const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>("operacional", "email, full_name, notif_email");
  let n = 0;
  for (const a of admins) {
    const comEmail = evento !== "alerta_email_falhou" && !!a.email && a.notif_email !== false;
    await notify({
      event: evento,
      email: comEmail ? (a.email as string) : undefined,
      name: a.full_name ?? undefined,
      userId: a.id,
      pushUrl: "/admin",
      interno: true,
      // Falha de infraestrutura é prazo do dia: fura o silêncio das 22h–7h.
      prazoHoje: true,
    }).catch(() => null);
    n++;
  }
  return n;
}

/** Cron das 7h: a última cópia noturna falhou? Um alerta por execução. */
export async function verificarCopiaNoturna(admin: Admin): Promise<number> {
  const { data } = await admin.from("backups_execucoes").select("id, ok").eq("tipo", "copia").order("inicio", { ascending: false }).limit(1).maybeSingle();
  const ultima = data as { id: string; ok: boolean } | null;
  if (!ultima || ultima.ok) return 0;
  return alertarEquipe("alerta_backup_falhou", `alerta_backup:${ultima.id}`, admin);
}

/** O envio de e-mail falhou: no máximo 1 alerta por hora (UTC). Best-effort; nunca lança. */
export async function alertarFalhaDeEmail(agora: Date = new Date()): Promise<void> {
  try {
    await alertarEquipe("alerta_email_falhou", `alerta_email:${agora.toISOString().slice(0, 13)}`);
  } catch {
    /* alerta é best-effort */
  }
}
