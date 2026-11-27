import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA } from "@/lib/flags";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { cnpjValido } from "@/lib/documento-pessoa";
import { decidirAtivo, decidirEmTeste, registroDoSistema, type CriteriosEmTeste } from "./ativacao-automatica";
import { ativarParceiroDoAvaliador } from "./parceiro-do-avaliador-servidor";
import { comTesteConcluido, naFilaDoAdmin } from "./servidor";

/*
  E690 — roda a ativação automática do avaliador. ATRÁS DA CHAVE AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA (desligada): sem ela,
  não faz nada. Nunca lança: uma falha de leitura deixa o avaliador onde está (o admin continua podendo decidir).
  A identidade vem da MESMA fonte das telas (estadoIdentidade); em conta is_teste a verificação é simulada e o CPF do
  titular/sócio do CNPJ também. Em conta real, sem fornecedor do quadro societário o CPF fica "não conferível" e nada avança.
*/
export type ResultadoAtivacao = { feito: false; motivo: string } | { feito: true; para: "em_teste" | "ativo" };

interface Cred {
  id: string;
  status: string;
  user_id: string | null;
  parceiro_id: string | null;
  solicitacao_id: string | null;
  cidade: string | null;
  experiencia_path: string | null;
  experiencia_link: string | null;
  conduta_versao: string | null;
  conduta_aceita_em: string | null;
}

const COLUNAS = "id, status, user_id, parceiro_id, solicitacao_id, cidade, experiencia_path, experiencia_link, conduta_versao, conduta_aceita_em";
const NADA = (motivo: string): ResultadoAtivacao => ({ feito: false, motivo });

async function contaDeTeste(admin: SupabaseClient, userId: string): Promise<boolean | null> {
  const { data, error } = await admin.from("profiles").select("is_teste").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return (data as { is_teste: boolean | null }).is_teste === true;
}

/** O CNPJ do pedido (cadastro de parceiro ou solicitação ligada). */
async function cnpjDoPedido(admin: SupabaseClient, c: Cred): Promise<string | null> {
  if (c.parceiro_id) {
    const { data } = await admin.from("parceiros").select("documento").eq("id", c.parceiro_id).maybeSingle();
    const d = String((data as { documento?: string } | null)?.documento ?? "").replace(/\D/g, "");
    if (cnpjValido(d)) return d;
  }
  if (c.solicitacao_id) {
    const { data } = await admin.from("parceiro_solicitacoes").select("documento").eq("id", c.solicitacao_id).maybeSingle();
    const d = String((data as { documento?: string } | null)?.documento ?? "").replace(/\D/g, "");
    if (cnpjValido(d)) return d;
  }
  return null;
}

/** CPF da pessoa verificada é titular/sócio do CNPJ? Conta de teste: simulado (true). Conta real: sem fornecedor, null. */
function cpfTitularOuSocio(teste: boolean, cnpj: string | null): { valor: boolean | null; fonte: "real" | "simulada" } {
  if (!cnpj) return { valor: false, fonte: teste ? "simulada" : "real" };
  return teste ? { valor: true, fonte: "simulada" } : { valor: null, fonte: "real" };
}

async function lerCred(admin: SupabaseClient, ref: { credenciamentoId?: string; userId?: string }): Promise<Cred | null> {
  let q = admin.from("avaliadores_credenciamento").select(COLUNAS);
  q = ref.credenciamentoId ? q.eq("id", ref.credenciamentoId) : q.eq("user_id", ref.userId ?? "");
  const { data, error } = await q.maybeSingle();
  return error || !data ? null : (data as unknown as Cred);
}

/** Tenta o passo que couber ao credenciamento (solicitado → em_teste ou em_teste → ativo). */
export async function tentarAtivacaoAutomatica(admin: SupabaseClient, ref: { credenciamentoId?: string; userId?: string }, agora: Date = new Date()): Promise<ResultadoAtivacao> {
  if (!AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA) return NADA("chave desligada");
  try {
    const c = await lerCred(admin, ref);
    if (!c || !c.user_id) return NADA("credenciamento não encontrado");
    const teste = await contaDeTeste(admin, c.user_id);
    if (teste === null) return NADA("conta não lida");
    const ident = await estadoIdentidade(admin, c.user_id);
    const identidadeVerificada = ident.estado === "confirmada";
    const iso = agora.toISOString();

    if (c.status === "solicitado") {
      const cnpj = await cnpjDoPedido(admin, c);
      const cpf = cpfTitularOuSocio(teste, cnpj);
      const criterios: CriteriosEmTeste = {
        identidadeVerificada,
        cpfTitularOuSocio: cpf.valor,
        experiencia: !!(c.experiencia_path || c.experiencia_link),
        condutaAceita: !!(c.conduta_versao && c.conduta_aceita_em),
        cidade: !!c.cidade && c.cidade.trim().length >= 2,
      };
      const d = decidirEmTeste(criterios);
      if (!d.ok) return NADA(`falta: ${d.falta.join(", ")}`);
      let parceiroId = c.parceiro_id;
      if (!parceiroId) {
        const r = await ativarParceiroDoAvaliador(admin, c.user_id, c.solicitacao_id, null, iso);
        if (!r.ok) return NADA(r.erro);
        parceiroId = r.parceiroId;
      }
      const reg = registroDoSistema("em_teste", criterios, { identidade: teste ? "simulada" : "real", cpf: cpf.fonte }, agora);
      const { data: ok } = await admin
        .from("avaliadores_credenciamento")
        .update({ status: "em_teste", parceiro_id: parceiroId, decidido_por: null, decidido_em: iso, motivo: reg.motivo, decidido_pelo_sistema: true, criterios_decisao: reg.criterios })
        .eq("id", c.id)
        .eq("status", "solicitado")
        .select("id")
        .maybeSingle();
      if (!ok) return NADA("o credenciamento mudou enquanto decidia");
      await naFilaDoAdmin(admin, "avaliacao_teste", { avaliadorId: c.id }, "Marcar a avaliação de teste num imóvel de teste e revisar.");
      return { feito: true, para: "em_teste" };
    }

    if (c.status === "em_teste") {
      const feitos = await comTesteConcluido(admin, [c.id]);
      const testeConcluido = feitos.has(c.id);
      let conferenciaPassou = false;
      if (testeConcluido) {
        const [{ data: laudo, error: eL }, { data: abertos, error: eF }] = await Promise.all([
          admin.from("vistoria_laudos").select("resultado").eq("avaliador_id", c.id).eq("teste", true).order("emitido_em", { ascending: false }).limit(1).maybeSingle(),
          admin.from("vistoria_fila_admin").select("id").eq("avaliador_id", c.id).neq("tipo", "avaliacao_teste").is("resolvido_em", null).limit(1),
        ]);
        if (eL || eF) return NADA("conferência não lida");
        conferenciaPassou = (laudo as { resultado?: string } | null)?.resultado === "aprovado" && !(abertos ?? []).length;
      }
      const criterios = { testeConcluido, conferenciaPassou, identidadeVerificada };
      const d = decidirAtivo(criterios);
      if (!d.ok) return NADA(`falta: ${d.falta.join(", ")}`);
      const reg = registroDoSistema("ativo", criterios, { identidade: teste ? "simulada" : "real" }, agora);
      const { data: ok } = await admin
        .from("avaliadores_credenciamento")
        .update({ status: "ativo", decidido_por: null, decidido_em: iso, ativado_em: iso, motivo: reg.motivo, decidido_pelo_sistema: true, criterios_decisao: reg.criterios })
        .eq("id", c.id)
        .eq("status", "em_teste")
        .select("id")
        .maybeSingle();
      if (!ok) return NADA("o credenciamento mudou enquanto decidia");
      await admin.from("vistoria_fila_admin").update({ resolvido_em: iso, resolvido_por: null }).eq("avaliador_id", c.id).eq("tipo", "avaliacao_teste").is("resolvido_em", null);
      return { feito: true, para: "ativo" };
    }
    return NADA(`situação ${c.status}: nada a fazer`);
  } catch (e) {
    console.error("[ativacao-automatica]", e instanceof Error ? e.message : e);
    return NADA("falha ao decidir");
  }
}
