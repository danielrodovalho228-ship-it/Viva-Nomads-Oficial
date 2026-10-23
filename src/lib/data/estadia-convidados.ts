/*
  61-B — convidados da estadia (quem vai morar junto), no servidor. Sem "use server": usada pela página e pelas ações.
  O convidado NÃO é parte do contrato: não passa por contextoDaEstadia (que só aceita morador e dono), então nenhuma
  ação da estadia (ocupantes, aditivo, encerramento, nota, documentos, conversa) se abre para ele. Ele só tem a visão
  de leitura daqui: datas, endereço, instruções de chegada depois do D-7 e a linha do tempo.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { primeiroPagamentoConfirmado } from "@/lib/contrato-estado";
import { enderecoDoDocumento } from "@/lib/fiscal/documento";
import { instrucoesLiberadas, textoAntesDaLiberacao, type Instrucoes } from "@/lib/estadia/instrucoes";
import type { PeriodoEstadia } from "@/lib/estadia/estadia";
import { assinadoPelasDuas, contextoDaEstadia, COLUNAS_ESTADIA, lerInstrucoes, periodoDoContrato, type LinhaContratoEstadia } from "@/lib/data/estadia";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConvidadoView {
  id: string;
  email: string;
  entrou: boolean;
  criadoEm: string;
}

/** Convidados ATIVOS do contrato (o morador vê a lista; removidos não aparecem). Sem a 0225: lista vazia. */
export async function convidadosAtivos(admin: SupabaseClient, contratoId: string): Promise<ConvidadoView[]> {
  const { data, error } = await admin
    .from("estadia_convidados")
    .select("id, email, convidado_user_id, criado_em")
    .eq("contrato_id", contratoId)
    .is("removido_em", null)
    .order("criado_em");
  if (error || !data) return [];
  return (data as { id: string; email: string; convidado_user_id: string | null; criado_em: string }[]).map((c) => ({
    id: c.id,
    email: c.email,
    entrou: !!c.convidado_user_id,
    criadoEm: c.criado_em,
  }));
}

/** A lista do morador na página da estadia (o dono não vê convidados: não é dado dele). */
export async function convidadosParaOMorador(contratoId: string): Promise<ConvidadoView[] | null> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx || ctx.papel !== "inquilino") return null;
  return convidadosAtivos(ctx.admin, ctx.c.id);
}

export interface VisaoConvidado {
  contratoId: string;
  numero: string;
  imovel: { titulo: string; cidade: string | null };
  periodo: PeriodoEstadia;
  endereco: string;
  instrucoes: { liberadas: boolean; texto: string; campos: Instrucoes | null };
}

/**
 * O convite ativo de quem está entrando. No 1º acesso, o convite feito para o e-mail da sessão é ligado à conta
 * (convidado_user_id); depois disso vale só a conta. Removido (removido_em) = sem acesso, na hora.
 */
async function conviteAtivo(admin: SupabaseClient, contratoId: string, userId: string, email: string | null): Promise<string | null> {
  const { data: meu } = await admin
    .from("estadia_convidados")
    .select("id")
    .eq("contrato_id", contratoId)
    .eq("convidado_user_id", userId)
    .is("removido_em", null)
    .maybeSingle();
  if (meu) return (meu as { id: string }).id;
  if (!email) return null;
  const { data: pelo } = await admin
    .from("estadia_convidados")
    .select("id")
    .eq("contrato_id", contratoId)
    .eq("email", email.trim().toLowerCase())
    .is("convidado_user_id", null)
    .is("removido_em", null)
    .maybeSingle();
  if (!pelo) return null;
  const id = (pelo as { id: string }).id;
  await admin.from("estadia_convidados").update({ convidado_user_id: userId }).eq("id", id).is("convidado_user_id", null);
  return id;
}

/** A visão de leitura do convidado. null = sem convite ativo (quem não foi convidado não descobre que o contrato existe). */
export async function carregarVisaoConvidado(contratoId: string, agora: Date = new Date()): Promise<VisaoConvidado | null> {
  if (!UUID_RE.test(String(contratoId))) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const convite = await conviteAtivo(admin, contratoId, user.id, user.email ?? null);
  if (!convite) return null;

  const { data } = await admin.from("contratos").select(COLUNAS_ESTADIA).eq("id", contratoId).maybeSingle();
  const c = data as unknown as LinhaContratoEstadia | null;
  if (!c) return null;
  const periodo = periodoDoContrato(c);
  const ambos = assinadoPelasDuas(c);
  const primeiro = primeiroPagamentoConfirmado(c.pagamentos_bloco ?? []);
  const cond = { inicio: periodo.inicio, assinadoPelasDuas: ambos, primeiroPagamento: primeiro };
  const liberadas = instrucoesLiberadas(cond, agora);
  const [instr, { data: im }] = await Promise.all([
    liberadas ? lerInstrucoes(admin, c) : Promise.resolve(null),
    admin.from("properties").select("title, address, exact_address, city, state").eq("id", c.property_id).maybeSingle(), // consistency-ignore: 61-B — o convidado ativo de estadia assinada vê o endereço, como o morador
  ]);
  const p = im as { title: string | null; address: string | null; exact_address: string | null; city: string | null; state: string | null } | null;
  return {
    contratoId: c.id,
    numero: numeroPublicoContrato(c.id),
    imovel: { titulo: c.properties?.title ?? "Imóvel", cidade: c.properties?.city ?? null },
    periodo,
    // Endereço exato só com a estadia assinada pelas duas partes (antes disso, só o bairro e a cidade).
    endereco: enderecoDoDocumento(ambos ? p ?? {} : { address: p?.address, city: p?.city, state: p?.state, title: p?.title }),
    instrucoes: { liberadas, texto: liberadas ? "" : textoAntesDaLiberacao(cond), campos: liberadas ? instr?.efetivas ?? null : null },
  };
}
