import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MOTIVOS_VERIFICACAO, motivoDaReprovacao, proximaAcaoVerificacao, type LaudoParaMotivo, type MotivoVerificacao } from "@/config/verificacao-motivos";
import { notify } from "@/lib/notifications";

/*
  Prompt 50 (item 4) — depois de cada tentativa de verificação: o motivo legível com o próximo passo, a nova tentativa
  na hora (1ª reprovação automática: a cota de 12 meses volta) e, na 2ª, a análise de uma pessoa da equipe (fila de
  documentos do admin) com o motivo. Nada novo é guardado do laudo: só o motivo da fila.
*/

type Admin = SupabaseClient;

export interface Reprovacao {
  motivo: MotivoVerificacao;
  titulo: string;
  proximoPasso: string;
  acao: "tentar_de_novo" | "analise_humana";
}

/** Laudo simulado reprovado (SÓ no laboratório, pelo cookie): exercita a reprovação sem a CAF. */
export const COOKIE_LAB_CAF = "vn_lab_caf";
export function laudoReprovadoDeLaboratorio(motivo: string | undefined): LaudoParaMotivo | null {
  if (!motivo) return null;
  const mapa: Record<string, LaudoParaMotivo> = {
    foto_escura: { light: "red", document: false, identity: true, liveness: true, notes: ["Imagem escura"] },
    prova_de_vida: { light: "red", document: true, identity: true, liveness: false, notes: [] },
    selfie_nao_confere: { light: "red", document: true, identity: false, liveness: true, notes: [] },
  };
  return mapa[motivo] ?? null;
}

export async function depoisDaTentativa(admin: Admin, userId: string, laudo: LaudoParaMotivo, opts: { devolverCota: boolean }): Promise<Reprovacao | null> {
  const motivo = motivoDaReprovacao(laudo);
  if (!motivo || motivo === "em_analise") return null;
  // Reprovações automáticas desde a última aprovada (a tentativa de agora já está gravada).
  const { data } = await admin.from("tenant_verifications").select("caf_result, created_at").eq("tenant_id", userId).order("created_at", { ascending: false }).limit(20);
  let reprovacoes = 0;
  for (const t of (data ?? []) as { caf_result: LaudoParaMotivo | null }[]) {
    const m = motivoDaReprovacao(t.caf_result ?? {});
    if (m === null) break;
    if (m !== "em_analise") reprovacoes++;
  }
  const acao = proximaAcaoVerificacao(Math.max(1, reprovacoes))!;
  if (acao === "tentar_de_novo" && opts.devolverCota) {
    // A 1ª reprovação automática não gasta a consulta do ano: a pessoa tenta de novo na hora.
    const { data: uso } = await admin.from("limites_uso").select("id").eq("chave", `caf:user:${userId}`).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (uso) await admin.from("limites_uso").delete().eq("id", uso.id);
  }
  if (acao === "analise_humana") {
    const { error } = await admin.from("verificacao_revisoes").insert({ user_id: userId, motivo, reprovacoes });
    if (!error) {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      for (const a of (admins ?? []) as { id: string }[]) {
        const { data: u } = await admin.auth.admin.getUserById(a.id);
        await notify({ event: "verificacao_analise_humana", email: u?.user?.email ?? undefined, userId: a.id, pushUrl: "/admin/documentos#verificacao", detailsText: `Motivo da última reprovação: ${MOTIVOS_VERIFICACAO[motivo].titulo}.`, interno: true }).catch(() => null);
      }
    }
  }
  return { motivo, ...MOTIVOS_VERIFICACAO[motivo], acao };
}
