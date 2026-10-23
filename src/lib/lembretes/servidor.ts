import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { MOTIVOS_VERIFICACAO, motivoDaReprovacao, type LaudoParaMotivo } from "@/config/verificacao-motivos";
import { chamadoForaDaPromessa, emSilencio, parceiroSemResposta, verificacaoParada } from "./regras";

/*
  Prompt 50 — os lembretes com decisão ou prazo real, rodados pelo cron diário das automações. Cada aviso sai UMA vez
  (automacoes_envios) e nunca no silêncio 22h–7h (Brasília): o que cair nele espera a próxima rodada. Contas de teste
  fora. `simular`: só conta.
    • verificação iniciada e não concluída em 24 h → 1 aviso à pessoa, com a causa da última tentativa;
    • solicitação de parceiro sem resposta em 1 dia útil → alerta à equipe;
    • chamado sem 1ª resposta dentro da promessa (24 h) → alerta à equipe.
*/

type Admin = SupabaseClient;
export interface ResumoLembretes50 {
  silencio: boolean;
  verificacaoParada: number;
  parceiroSemResposta: number;
  chamadoForaDaPromessa: number;
}

async function umaVez(admin: Admin, chave: string, tipo: string, usuarioId: string | null): Promise<boolean> {
  const { error } = await admin.from("automacoes_envios").insert({ chave, tipo, usuario_id: usuarioId });
  return !error;
}

async function teste(admin: Admin): Promise<Set<string>> {
  const { data } = await admin.from("profiles").select("id").eq("is_teste", true).limit(5000);
  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
}

async function avisarEquipe(admin: Admin, ev: "parceiro_sem_resposta" | "chamado_fora_promessa", url: string, detalhe: string): Promise<void> {
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  for (const a of (admins ?? []) as { id: string }[]) {
    const { data: u } = await admin.auth.admin.getUserById(a.id);
    await notify({ event: ev, email: u?.user?.email ?? undefined, userId: a.id, pushUrl: url, detailsText: detalhe, interno: true }).catch(() => null);
  }
}

export async function lembretesDoFunil(admin: Admin, agora: Date, simular: boolean): Promise<ResumoLembretes50> {
  const r: ResumoLembretes50 = { silencio: emSilencio(agora), verificacaoParada: 0, parceiroSemResposta: 0, chamadoForaDaPromessa: 0 };
  if (r.silencio) return r;
  const contasTeste = await teste(admin);
  const desde = new Date(agora.getTime() - 14 * 86_400_000).toISOString();

  // 1) Verificação parada: a última tentativa não passou, sem confirmação depois, há 24 h ou mais.
  const { data: tentativas } = await admin.from("tenant_verifications").select("id, tenant_id, caf_result, created_at").gte("created_at", desde).order("created_at", { ascending: true }).limit(5000);
  const ultima = new Map<string, { id: string; em: string; laudo: LaudoParaMotivo; ok: boolean }>();
  const confirmada = new Set<string>();
  for (const t of (tentativas ?? []) as { id: string; tenant_id: string; caf_result: LaudoParaMotivo | null; created_at: string }[]) {
    const laudo = t.caf_result ?? {};
    const ok = motivoDaReprovacao(laudo) === null;
    if (ok) confirmada.add(t.tenant_id);
    ultima.set(t.tenant_id, { id: t.id, em: t.created_at, laudo, ok });
  }
  const { data: emRevisao } = await admin.from("verificacao_revisoes").select("user_id").is("decidido_em", null);
  const naFila = new Set(((emRevisao ?? []) as { user_id: string }[]).map((x) => x.user_id));
  for (const [userId, t] of ultima) {
    if (contasTeste.has(userId) || naFila.has(userId) || !verificacaoParada({ em: t.em, ok: t.ok }, confirmada.has(userId), agora)) continue;
    const motivo = motivoDaReprovacao(t.laudo);
    if (!motivo) continue;
    if (simular) {
      r.verificacaoParada++;
      continue;
    }
    if (!(await umaVez(admin, `verificacao_parada:${t.id}`, "verificacao_parada", userId))) continue;
    const { data: p } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", userId).maybeSingle();
    const perfil = p as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    const m = MOTIVOS_VERIFICACAO[motivo];
    await notify({
      event: "verificacao_parada",
      email: perfil?.notif_email === false ? undefined : (perfil?.email ?? undefined),
      name: perfil?.full_name ?? undefined,
      userId,
      pushUrl: "/dashboard/verificacao",
      detailsText: `Última tentativa: ${m.titulo}. ${m.proximoPasso}`,
    }).catch(() => null);
    r.verificacaoParada++;
  }

  // 2) Solicitação de parceiro sem resposta em 1 dia útil → equipe.
  const { data: sols } = await admin.from("parceiro_solicitacoes").select("id, user_id, criado_em, decidido_em, status").eq("status", "pendente").not("categorias", "cs", "{vistoria}").limit(1000);
  for (const s of (sols ?? []) as { id: string; user_id: string | null; criado_em: string; decidido_em: string | null }[]) {
    if ((s.user_id && contasTeste.has(s.user_id)) || !parceiroSemResposta(s.criado_em, s.decidido_em, agora)) continue;
    if (simular) {
      r.parceiroSemResposta++;
      continue;
    }
    if (!(await umaVez(admin, `parceiro_sem_resposta:${s.id}`, "parceiro_sem_resposta", null))) continue;
    await avisarEquipe(admin, "parceiro_sem_resposta", "/admin/parceiros", "Solicitação de parceria sem resposta há mais de 1 dia útil.");
    r.parceiroSemResposta++;
  }

  // 3) Chamado sem 1ª resposta dentro da promessa → equipe.
  const { data: chamados } = await admin.from("chamados").select("id, numero_publico, usuario_id, criado_em, primeira_resposta_em, status").eq("simulacao", false).is("primeira_resposta_em", null).not("status", "in", "(resolvido,encerrado)").limit(1000);
  for (const c of (chamados ?? []) as { id: string; numero_publico: string; usuario_id: string | null; criado_em: string; primeira_resposta_em: string | null; status: string }[]) {
    if ((c.usuario_id && contasTeste.has(c.usuario_id)) || !chamadoForaDaPromessa({ criadoEm: c.criado_em, primeiraRespostaEm: c.primeira_resposta_em, resolvido: false }, agora)) continue;
    if (simular) {
      r.chamadoForaDaPromessa++;
      continue;
    }
    if (!(await umaVez(admin, `chamado_fora_promessa:${c.id}`, "chamado_fora_promessa", null))) continue;
    await avisarEquipe(admin, "chamado_fora_promessa", `/admin/atendimento/${c.id}`, `Chamado ${c.numero_publico} sem a 1ª resposta de uma pessoa dentro das 24 horas prometidas.`);
    r.chamadoForaDaPromessa++;
  }
  return r;
}
