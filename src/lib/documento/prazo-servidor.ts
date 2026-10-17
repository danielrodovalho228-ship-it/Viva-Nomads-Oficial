import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Documentos "em revisão" com o prazo de 48 h vencido (prompt 11): um aviso ao Daniel por documento, uma vez só
 * (marca conferencia.avisado_prazo). Roda junto do /api/cron/avisos-daniel, antes do envio dos avisos.
 * O aviso não traz dado do documento — só que há conferência atrasada na fila.
 */
export async function avisarPrazosVencidos(admin: Admin): Promise<number> {
  const { data } = await admin
    .from("qualification_checklists")
    .select("id, conferencia, revisao_ate")
    .eq("document_status", "pending")
    .not("revisao_ate", "is", null)
    .lt("revisao_ate", new Date().toISOString())
    .limit(50);
  let n = 0;
  for (const linha of data ?? []) {
    const conf = (linha.conferencia ?? {}) as Record<string, unknown>;
    if (conf.avisado_prazo === true) continue;
    const { data: marcada } = await admin
      .from("qualification_checklists")
      .update({ conferencia: { ...conf, avisado_prazo: true } })
      .eq("id", linha.id)
      .eq("document_status", "pending")
      .select("id");
    if (!marcada?.length) continue;
    await admin.from("avisos_daniel").insert({
      assunto: "Documento em revisão passou do prazo de 48 h",
      corpo: "Há um documento de imóvel em revisão há mais de 48 horas. Abra Admin → Documentos para aprovar ou recusar.",
      prioridade: "P1",
    });
    n++;
  }
  return n;
}
