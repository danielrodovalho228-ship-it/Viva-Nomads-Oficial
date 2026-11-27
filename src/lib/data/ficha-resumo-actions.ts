"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FICHA_RESUMO_ATIVA } from "@/lib/flags";
import { consumirLimite, DIA } from "@/lib/limites";
import {
  VERSAO_TEXTO_AUTORIZACAO,
  diaVencimentoValido,
  montarFicha,
  validarContaRecebimento,
  type ContaRecebimentoEntrada,
  type FichaResumo,
} from "@/lib/contrato-ficha-resumo";

/**
 * E634 — ficha-resumo do contrato (aprovado pelo Daniel em 05/11/2026). Tudo atrás de FICHA_RESUMO_ATIVA (desligada): sem a
 * chave nada lê nem grava. A leitura passa pelo RLS (só as partes do contrato). Quem grava é o proprietário, pelo servidor.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Res = { ok: true } | { ok: false; erro: string };
const MSG_DESLIGADA = "Esta função ainda não está disponível.";

export interface FichaDoContrato {
  ficha: FichaResumo;
  /** Quem está vendo é o proprietário (só ele informa vencimento e conta). */
  souProprietario: boolean;
  /** O titular da conta e o vencimento já informados (para reabrir o formulário). */
  diaVencimento: number | null;
}

export async function getFichaResumo(contratoId: string): Promise<FichaDoContrato | null> {
  if (!FICHA_RESUMO_ATIVA || !UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // O RLS prova que a pessoa é parte do contrato (ou admin).
  const { data: c, error } = await supabase
    .from("contratos")
    .select("id, tenant_id, aluguel_mensal, property_id, properties(title, owner_id), contrato_blocos(inicio, fim)")
    .eq("id", contratoId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler o contrato agora.");
  if (!c) return null;
  const imovel = (c.properties as { title?: string; owner_id?: string } | null) ?? {};
  const ownerId = String(imovel.owner_id ?? "");
  const blocos = ((c.contrato_blocos ?? []) as { inicio: string; fim: string }[]).slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
  const [{ data: nomes }, { data: f }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", [ownerId, String(c.tenant_id)]),
    supabase.from("contrato_ficha_resumo").select("*").eq("contrato_id", contratoId).maybeSingle(),
  ]);
  const nome = (id: string) => ((nomes ?? []) as { id: string; full_name: string | null }[]).find((n) => n.id === id)?.full_name?.trim() || "—";
  const linha = f as {
    dia_vencimento: number | null;
    conta_titular_nome: string | null;
    conta_titular_documento_final: string | null;
    conta_instituicao: string | null;
    conta_referencia_final: string | null;
    conta_titular_proprio: boolean | null;
    autorizacao_terceiro_em: string | null;
  } | null;
  const temConta = !!linha?.conta_titular_nome && linha.conta_titular_proprio !== null;
  const ficha = montarFicha({
    numero: `VN-CT-${String(c.id).slice(0, 8).toUpperCase()}`,
    imovel: imovel.title ?? "—",
    proprietario: nome(ownerId),
    inquilino: nome(String(c.tenant_id)),
    inicio: blocos[0]?.inicio ?? null,
    fim: blocos.length ? blocos[blocos.length - 1].fim : null,
    aluguelMensal: Number(c.aluguel_mensal) || 0,
    diaVencimento: linha?.dia_vencimento ?? null,
    conta: temConta
      ? {
          titularNome: linha!.conta_titular_nome!,
          titularDocumentoFinal: linha!.conta_titular_documento_final ?? "—",
          instituicao: linha!.conta_instituicao ?? "—",
          referenciaFinal: linha!.conta_referencia_final ?? "—",
          titularProprio: linha!.conta_titular_proprio === true,
          autorizacaoEm: linha!.autorizacao_terceiro_em,
        }
      : null,
  });
  return { ficha, souProprietario: ownerId === user.id, diaVencimento: linha?.dia_vencimento ?? null };
}

/** O proprietário informa o dia de vencimento e a conta de recebimento. Conta de terceiro grava a autorização expressa (quem, quando, versão do texto). */
export async function salvarContaRecebimento(contratoId: string, diaVencimento: number, conta: ContaRecebimentoEntrada): Promise<Res> {
  if (!FICHA_RESUMO_ATIVA) return { ok: false, erro: MSG_DESLIGADA };
  if (!UUID_RE.test(contratoId)) return { ok: false, erro: "Contrato inválido." };
  if (!diaVencimentoValido(diaVencimento)) return { ok: false, erro: "O dia de vencimento vai de 1 a 28." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta." };
  const { data: c } = await supabase.from("contratos").select("id, properties(owner_id)").eq("id", contratoId).maybeSingle();
  const owner = (c?.properties as { owner_id?: string } | null)?.owner_id;
  if (!c || owner !== user.id) return { ok: false, erro: "Só o proprietário informa a conta de recebimento." };
  if (!(await consumirLimite(`ficha-resumo:${user.id}`, 20, DIA))) return { ok: false, erro: "Muitas alterações hoje. Tente novamente amanhã." };
  const { data: perfil } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const v = validarContaRecebimento(conta, (perfil as { full_name?: string | null } | null)?.full_name ?? "");
  if (!v.ok) return { ok: false, erro: v.erros[0] };
  const agora = new Date().toISOString();
  const { error } = await admin.from("contrato_ficha_resumo").upsert(
    {
      contrato_id: contratoId,
      dia_vencimento: diaVencimento,
      conta_titular_nome: v.valor.titularNome,
      conta_titular_documento_final: v.valor.titularDocumentoFinal,
      conta_instituicao: v.valor.instituicao,
      conta_referencia_final: v.valor.referenciaFinal,
      conta_titular_proprio: v.valor.titularProprio,
      // Conta de terceiro: a autorização expressa fica registrada (quem, quando e a versão do texto aceito).
      autorizacao_terceiro_em: v.valor.precisaAutorizacao ? agora : null,
      autorizacao_terceiro_por: v.valor.precisaAutorizacao ? user.id : null,
      autorizacao_texto_versao: v.valor.precisaAutorizacao ? VERSAO_TEXTO_AUTORIZACAO : null,
      atualizado_em: agora,
    },
    { onConflict: "contrato_id" },
  );
  if (error) return { ok: false, erro: "Não foi possível salvar agora. Tente de novo." };
  revalidatePath(`/dashboard/contratos/${contratoId}/ficha`);
  return { ok: true };
}
