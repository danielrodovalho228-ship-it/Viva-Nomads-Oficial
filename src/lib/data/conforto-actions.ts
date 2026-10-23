"use server";

/*
  Prompt 59, Parte A — ações do padrão mínimo de conforto (dono confirma; morador marca na entrada; pendências: dono
  corrige ou contesta, morador confirma ou reabre, o atendimento da Viva decide a contestação). Toda gravação passa pelo
  cliente de serviço DEPOIS de conferir quem age; as regras são as de src/lib/conforto/regras.ts.
*/
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import { estadoConfortoDoImovel, pendenciasConforto, salvarDeclaracoesConforto, type PendenciaParaTela } from "@/lib/conforto/servidor";
import { transicaoPendencia, type AcaoPendencia, type EstadoConforto, type PapelPendencia, type PendenciaConforto } from "@/lib/conforto/regras";
import { ehChaveNivel } from "@/config/niveis";
import { recalcularNivel } from "@/lib/niveis/servidor";
import { avisarPendenciaConforto } from "@/lib/conforto/avisos";
import { logModeracao } from "@/lib/data/moderacao-log";
import { integracoesSimuladas } from "@/lib/integracoes";
import { rodarPrazos59, type ResumoPrazos59 } from "@/lib/prazos-59-servidor";

export type ResultadoConforto = { ok: true; mensagem?: string } | { ok: false; erro: string };

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, uid: user.id } : null;
}

/** O dono deste imóvel? (lido com o cliente da sessão: a RLS mostra o próprio imóvel, inclusive rascunho). */
async function ehDonoDoImovel(s: NonNullable<Awaited<ReturnType<typeof sessao>>>, propertyId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return false;
  const { data } = await s.supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  return data?.owner_id === s.uid;
}

/** Estado do padrão mínimo de um imóvel do dono (checklist, faltantes, prazo de adequação). */
export async function confortoDoImovel(propertyId: string): Promise<(EstadoConforto & { pausado: boolean }) | null> {
  const s = await sessao();
  if (!s || !(await ehDonoDoImovel(s, propertyId))) return null;
  return estadoConfortoDoImovel(createAdminClient() ?? s.supabase, propertyId);
}

/**
 * O dono confirma os itens do padrão mínimo. Completo e pausado por conforto: o anúncio volta para a busca.
 * 59-C1: o editor do anúncio e a página "Padrão mínimo" chamam esta ação a cada item marcado ou desmarcado (a lista
 * é sempre a decisão explícita do dono, já carregada do servidor). O erro traz a causa, nunca um "tente de novo" mudo.
 */
export async function confirmarConforto(propertyId: string, marcados: string[]): Promise<ResultadoConforto> {
  if (!Array.isArray(marcados)) return { ok: false, erro: "Não foi possível salvar: a lista de itens chegou vazia." };
  const s = await sessao();
  if (!s) return { ok: false, erro: "Não foi possível salvar: sua sessão expirou. Entre de novo." };
  if (!(await ehDonoDoImovel(s, propertyId))) return { ok: false, erro: "Não foi possível salvar: este anúncio não é seu." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, erro: "Não foi possível salvar: o servidor está indisponível agora." };
  const r = await salvarDeclaracoesConforto(admin, propertyId, s.uid, marcados);
  if (!r.ok) return { ok: false, erro: `Não foi possível salvar: ${erroBancoPT(r.erro)}` };
  const e = await estadoConfortoDoImovel(admin, propertyId);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/imoveis/${propertyId}/conforto`);
  revalidatePath("/buscar");
  return { ok: true, mensagem: e.completo ? "Padrão mínimo confirmado." : `Faltam ${e.faltantes.length} ${e.faltantes.length === 1 ? "item" : "itens"}.` };
}

// ── Pendências ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Pendências do contrato, para quem é parte dele (ou admin). */
export async function pendenciasDoContrato(contratoId: string): Promise<{ papel: PapelPendencia; pendencias: PendenciaParaTela[] } | null> {
  const s = await sessao();
  if (!s || !/^[0-9a-f-]{36}$/i.test(contratoId)) return null;
  const papel = await papelNoContrato(s, contratoId);
  if (!papel) return null;
  return { papel, pendencias: await pendenciasConforto(createAdminClient() ?? s.supabase, contratoId) };
}

async function papelNoContrato(s: NonNullable<Awaited<ReturnType<typeof sessao>>>, contratoId: string): Promise<PapelPendencia | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: c } = await admin.from("contratos").select("tenant_id, properties(owner_id)").eq("id", contratoId).maybeSingle();
  if (!c) return null;
  const dono = (c.properties as unknown as { owner_id?: string } | null)?.owner_id;
  if (c.tenant_id === s.uid) return "inquilino";
  if (dono === s.uid) return "proprietario";
  return (await ehAdmin(s.supabase, s.uid)) ? "admin" : null;
}

const MSG: Record<AcaoPendencia, string> = {
  corrigir: "Marcado como corrigido. O morador confirma em até 48 horas.",
  contestar: "Contestação enviada. O atendimento da Viva decide.",
  confirmar: "Correção confirmada.",
  reabrir: "Pendência reaberta. O prazo original continua valendo.",
  decidir: "Decisão registrada.",
};

/** Ação numa pendência: o papel vem do contrato, nunca do pedido. */
export async function agirNaPendencia(
  pendenciaId: string,
  acao: AcaoPendencia,
  extra: { motivo?: string; decisao?: "procedente" | "improcedente"; foto?: string } = {},
): Promise<ResultadoConforto> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin || !/^[0-9a-f-]{36}$/i.test(pendenciaId)) return { ok: false, erro: "Sem permissão." };
  const { data: p } = await admin.from("conforto_pendencias").select("*").eq("id", pendenciaId).maybeSingle();
  if (!p?.contrato_id) return { ok: false, erro: "Pendência não encontrada." };
  // Decidir é só do atendimento da Viva (admin com 2 etapas), nunca do dono — mesmo que seja admin e dono.
  const papel: PapelPendencia | null = acao === "decidir" ? ((await ehAdmin(s.supabase, s.uid)) ? "admin" : null) : await papelNoContrato(s, p.contrato_id as string);
  if (!papel) return { ok: false, erro: acao === "decidir" ? "Só o atendimento da Viva decide a contestação." : "Sem permissão." };
  const campos = transicaoPendencia(p as PendenciaConforto, acao, papel, new Date(), extra.decisao);
  if (!campos) return { ok: false, erro: acao === "decidir" ? "Só o atendimento da Viva decide a contestação." : "Essa ação não vale para a pendência agora." };
  const motivo = (extra.motivo ?? "").trim().slice(0, 500);
  if (acao === "contestar" && motivo.length < 5) return { ok: false, erro: "Conte por que o item estava conforme." };
  const extras: Record<string, string> = {};
  if (acao === "contestar") extras.motivo_contestacao = motivo;
  if (acao === "corrigir" && extra.foto && (extra.foto.startsWith(`${p.contrato_id}/`) || (ehChaveNivel(p.chave as string) && extra.foto.startsWith(`${s.uid}/`)))) extras.foto_dono = extra.foto;
  if (acao === "decidir") extras.decidido_por = s.uid;
  const { error } = await admin.from("conforto_pendencias").update({ ...campos, ...extras }).eq("id", pendenciaId).eq("status", p.status);
  if (error) {
    console.error("[agirNaPendencia]", error.code, error.message);
    return { ok: false, erro: "Não foi possível salvar agora." };
  }
  await avisarPendenciaConforto(admin, pendenciaId, acao).catch((e: unknown) => console.error("[agirNaPendencia] aviso", e));
  // Adendo 59.1: item que define o nível. Corrigido com foto nova → a foto do item é trocada (volta para análise);
  // procedente → a foto deixa de valer até o dono mandar outra. Em todo passo, o nível é recalculado.
  if (ehChaveNivel(p.chave as string)) {
    const foto = typeof extra.foto === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(extra.foto) && extra.foto.startsWith(`${s.uid}/`) ? extra.foto : null;
    if (acao === "corrigir" && foto)
      await admin.from("nivel_itens").update({ foto_path: foto, foto_status: "pendente", motivo_recusa: null, declarado: true, declarado_em: new Date().toISOString() }).eq("property_id", p.property_id).eq("chave", p.chave);
    if (acao === "decidir" && extra.decisao === "procedente")
      await admin.from("nivel_itens").update({ foto_status: "recusada", motivo_recusa: "Pendência procedente: envie uma foto nova do item corrigido.", analisado_por: s.uid, analisado_em: new Date().toISOString() }).eq("property_id", p.property_id).eq("chave", p.chave);
  }
  await recalcularNivel(admin, p.property_id as string);
  revalidatePath(`/dashboard/contratos/${p.contrato_id}`);
  revalidatePath(`/dashboard/locacoes/${p.contrato_id}`);
  revalidatePath("/admin/conforto");
  return { ok: true, mensagem: MSG[acao] };
}

// ── Rotina dos prazos na hora (admin) ────────────────────────────────────────────────────────────────────────────
/**
 * O atendimento roda a rotina dos prazos do 59 na hora (a mesma do cron). A data simulada só vale no laboratório
 * (INTEGRACOES_SIMULADAS=on), assim como o filtro de um imóvel só; fora dele, roda com a hora de agora, em tudo.
 */
export async function rodarPrazosAgora(agoraSimulada?: string, soImovel?: string): Promise<{ ok: true; valor: ResumoPrazos59 & { agora: string } } | { ok: false; erro: string }> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, erro: "Serviço indisponível." };
  if (!(await ehAdmin(s.supabase, s.uid))) return { ok: false, erro: "Só a equipe." };
  const simulada = integracoesSimuladas() && typeof agoraSimulada === "string" && Number.isFinite(Date.parse(agoraSimulada)) ? new Date(agoraSimulada) : null;
  const agora = simulada ?? new Date();
  // No laboratório, o spec pode isolar um imóvel (os outros specs rodam ao mesmo tempo).
  const so = integracoesSimuladas() && typeof soImovel === "string" && /^[0-9a-f-]{36}$/i.test(soImovel) ? [soImovel] : undefined;
  const r = await rodarPrazos59(admin, agora, so);
  await logModeracao(s.supabase, s.uid, "rodar_prazos_59", "automacao", s.uid);
  revalidatePath("/admin/conforto");
  revalidatePath("/admin/solicitacoes");
  return { ok: true, valor: { ...r, agora: agora.toISOString() } };
}
