/*
  Página da estadia (Prompt 32) — leitura no servidor. Sem "use server": usada pelas páginas e pelas ações.
  Confere a sessão e o papel (morador = tenant_id; dono = properties.owner_id) e só então lê com o cliente de
  serviço: o morador nunca recebe a taxa de serviço nem as instruções antes da liberação; quem não é parte recebe null.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { primeiroPagamentoConfirmado } from "@/lib/contrato-estado";
import { estadoConferencia, type RespostaConferencia } from "@/lib/conferencia";
import { nomeCurto } from "@/lib/perfil/perfil-publico";
import { getAvatarPath, signAvatarPath } from "@/lib/data/avatar-url";
import { diaBRT } from "@/lib/datas-brasilia";
import {
  checklistAntesDaEntrada,
  mesesDoPeriodo,
  periodoDaEstadia,
  prazoDaConferencia,
  topoDaEstadia,
  valoresDaEstadia,
  type ItemChecklist,
  type LinhaValor,
  type PapelEstadia,
  type PeriodoEstadia,
  type TopoEstadia,
} from "@/lib/estadia/estadia";
import { instrucoesEfetivas, instrucoesLiberadas, instrucoesPreenchidas, normalizarInstrucoes, textoAntesDaLiberacao, type Instrucoes } from "@/lib/estadia/instrucoes";
import { blocoIniciado, linhaDoHistorico, mesesNaoIniciados, type BlocoAtual, type MudancasAditivo } from "@/lib/estadia/aditivo";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COLUNAS_ESTADIA =
  "id, property_id, tenant_id, status, encerrado_em, created_at, qtd_ocupantes, capacidade_snapshot, aluguel_mensal, tamanho_bloco_meses, garantia, comissao_percent, comissao_valor, assinado_proprietario_em, assinado_inquilino_em, properties(id, title, owner_id, checkin_after, checkout_before, max_guests), contrato_blocos(id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_status, status), pagamentos_bloco(id, tipo, confirmado_pelo_inquilino, anulado_em)";

export interface LinhaContratoEstadia {
  id: string;
  property_id: string;
  tenant_id: string;
  status: string;
  encerrado_em: string | null;
  created_at: string;
  qtd_ocupantes: number;
  capacidade_snapshot: number | null;
  aluguel_mensal: number | string;
  tamanho_bloco_meses: number;
  garantia: string | null;
  comissao_percent: number | string | null;
  comissao_valor: number | string | null;
  assinado_proprietario_em: string | null;
  assinado_inquilino_em: string | null;
  properties: { id: string; title: string | null; owner_id: string; checkin_after: string | null; checkout_before: string | null; max_guests: number | null } | null;
  contrato_blocos: (BlocoAtual & { id: string; caucao_status: string })[] | null;
  pagamentos_bloco: { id: string; tipo: string; confirmado_pelo_inquilino: boolean; anulado_em: string | null }[] | null;
}

export interface Contexto {
  admin: SupabaseClient;
  userId: string;
  email: string | null;
  papel: PapelEstadia;
  c: LinhaContratoEstadia;
}

/** A sessão e o papel no contrato. Quem não é parte não descobre que o contrato existe. */
export async function contextoDaEstadia(contratoId: string): Promise<Contexto | { erro: string }> {
  if (!UUID_RE.test(String(contratoId))) return { erro: "Contrato não encontrado." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { erro: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Entre para continuar." };
  const { data } = await admin.from("contratos").select(COLUNAS_ESTADIA).eq("id", contratoId).maybeSingle();
  const c = data as unknown as LinhaContratoEstadia | null;
  if (!c) return { erro: "Contrato não encontrado." };
  const papel: PapelEstadia | null = c.tenant_id === user.id ? "inquilino" : c.properties?.owner_id === user.id ? "proprietario" : null;
  if (!papel) return { erro: "Contrato não encontrado." };
  return { admin, userId: user.id, email: user.email ?? null, papel, c };
}

export function blocosOrdenados(c: Pick<LinhaContratoEstadia, "contrato_blocos">) {
  return [...(c.contrato_blocos ?? [])].sort((a, b) => a.numero_bloco - b.numero_bloco);
}

export function periodoDoContrato(c: LinhaContratoEstadia): PeriodoEstadia {
  // Renovação que caducou ("nao_aceito") não entra no período.
  return periodoDaEstadia(blocosOrdenados(c).filter((b) => b.status !== "nao_aceito"), c.properties);
}

export function assinadoPelasDuas(c: Pick<LinhaContratoEstadia, "assinado_proprietario_em" | "assinado_inquilino_em">): boolean {
  return !!c.assinado_proprietario_em && !!c.assinado_inquilino_em;
}

/** Instruções do imóvel com a sobrescrita do contrato (contratos_checkin.instrucoes). */
export async function lerInstrucoes(admin: SupabaseClient, c: LinhaContratoEstadia): Promise<{ doImovel: Instrucoes | null; efetivas: Instrucoes | null }> {
  const [{ data: im }, { data: ck }] = await Promise.all([
    admin.from("imovel_instrucoes_chegada").select("*").eq("property_id", c.property_id).maybeSingle(),
    admin.from("contratos_checkin").select("instrucoes").eq("contrato_id", c.id).maybeSingle(),
  ]);
  const doImovel = im ? normalizarInstrucoes(im as Record<string, unknown>) : null;
  return { doImovel, efetivas: instrucoesEfetivas(doImovel, (ck as { instrucoes?: string | null } | null)?.instrucoes ?? null) };
}

export interface OcupanteView {
  id: string;
  nome: string;
  documento: string;
  relacao: string | null;
}

export interface AditivoView {
  id: string;
  numero: number;
  status: string;
  resumo: string;
  mudancas: MudancasAditivo;
  propostoPorMim: boolean;
  papelProponente: PapelEstadia;
  expiraEm: string;
  criadoEm: string;
  assinadoEm: string | null;
  historico: string;
  assinaturas: PapelEstadia[];
  /** Só na visão do dono. */
  taxa: { valor: number; base: string } | null;
}

export interface EstadiaView {
  id: string;
  numero: string;
  papel: PapelEstadia;
  status: string;
  imovel: { id: string; titulo: string; foto: string | null };
  periodo: PeriodoEstadia;
  topo: TopoEstadia;
  checklist: ItemChecklist[];
  valores: LinhaValor[];
  morador: { nome: string; foto: string | null };
  outraParteId: string;
  ocupantes: OcupanteView[];
  ocupantesPrevistos: number;
  capacidade: number;
  podeEditarOcupantes: boolean;
  instrucoes: { liberadas: boolean; texto: string; campos: Instrucoes | null };
  nota: string;
  aditivos: AditivoView[];
  encerramento: { id: string; motivo: string; status: string; criadoEm: string; texto: string | null } | null;
  documentos: number;
  assinadoPelasDuas: boolean;
  primeiroPagamento: boolean;
  meses: number;
  valorMensal: number;
  blocos: { numero: number; inicio: string; fim: string; meses: number; iniciado: boolean }[];
}

async function fotoDoImovel(admin: SupabaseClient, propertyId: string): Promise<string | null> {
  const { data } = await admin.from("property_photos").select("url").eq("property_id", propertyId).order("sort_order").limit(1).maybeSingle();
  return (data as { url?: string } | null)?.url ?? null;
}

/** A página inteira, já na visão do papel de quem está olhando. */
export async function carregarEstadia(contratoId: string, agora: Date = new Date()): Promise<EstadiaView | null> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return null;
  const { admin, c, papel, userId } = ctx;
  const blocos = blocosOrdenados(c).filter((b) => b.status !== "nao_aceito");
  const periodo = periodoDoContrato(c);
  const pagamentos = c.pagamentos_bloco ?? [];
  const primeiro = primeiroPagamentoConfirmado(pagamentos);
  const ambos = assinadoPelasDuas(c);
  const ownerId = c.properties?.owner_id ?? "";

  const [foto, { data: conf }, { data: ocup }, { data: nota }, { data: adit }, { data: enc }, { count: docs }, instr, { data: perfil }] = await Promise.all([
    fotoDoImovel(admin, c.property_id),
    admin.from("conferencias").select("id, conferencia_respostas(parte, decisao, motivo)").eq("contrato_id", c.id).eq("tipo", "entrada").maybeSingle(),
    admin.from("contrato_ocupantes").select("id, nome, documento, parentesco_ou_relacao").eq("contrato_id", c.id).order("criado_em"),
    admin.from("contrato_notas").select("texto").eq("contrato_id", c.id).eq("autor_id", userId).maybeSingle(),
    admin
      .from("contrato_aditivos")
      .select("id, numero, status, resumo, mudancas, proposto_por, papel_proponente, expira_em, criado_em, assinado_em, contrato_aditivo_assinaturas(papel), contrato_aditivo_taxa(valor, base_texto)")
      .eq("contrato_id", c.id)
      .order("numero", { ascending: false }),
    admin.from("contrato_encerramento_pedidos").select("id, motivo, status, criado_em, texto").eq("contrato_id", c.id).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    admin.from("documentos_fiscais").select("id", { count: "exact", head: true }).eq("contrato_id", c.id).is("anulado_em", null),
    lerInstrucoes(admin, c),
    admin.from("profiles").select("full_name").eq("id", c.tenant_id).maybeSingle(),
  ]);

  const respostas = ((conf as { conferencia_respostas?: RespostaConferencia[] } | null)?.conferencia_respostas ?? []) as RespostaConferencia[];
  const b1 = blocos[0];
  const caucaoRecebida =
    (b1?.caucao_status === "comprovada") || pagamentos.some((p) => p.tipo === "caucao" && p.confirmado_pelo_inquilino && !p.anulado_em);
  const ocupantes = ((ocup ?? []) as { id: string; nome: string; documento: string; parentesco_ou_relacao: string | null }[]).map((o) => ({
    id: o.id,
    nome: o.nome,
    documento: o.documento,
    relacao: o.parentesco_ou_relacao,
  }));
  const previstos = Math.max(1, Number(c.qtd_ocupantes) || 1);
  const checklist = checklistAntesDaEntrada(
    {
      assinadoProprietario: !!c.assinado_proprietario_em,
      assinadoInquilino: !!c.assinado_inquilino_em,
      primeiroPagamento: primeiro,
      caucao: c.garantia === "seguro_fianca" || !b1 || Number(b1.caucao) <= 0 ? "dispensada" : caucaoRecebida ? "recebida" : "pendente",
      conferencia: { estado: conf ? estadoConferencia(respostas) : null, prazo: prazoDaConferencia(periodo) },
      ocupantes: { preenchidos: ocupantes.length, previstos },
      instrucoesPublicadas: instrucoesPreenchidas(instr.efetivas),
    },
    papel,
  );
  const meses = mesesDoPeriodo(periodo) || blocos.reduce((s, b) => s + Number(b.meses), 0);
  const valorMensal = Number(c.aluguel_mensal) || 0;
  const valores = valoresDaEstadia(
    {
      valorMensal,
      meses,
      caucao: blocos.reduce((s, b) => s + Number(b.caucao), 0),
      taxa: c.comissao_percent != null ? { percentual: Number(c.comissao_percent), valor: Number(c.comissao_valor ?? 0) } : null,
    },
    papel,
  );
  const liberadas = papel === "proprietario" || instrucoesLiberadas({ inicio: periodo.inicio, assinadoPelasDuas: ambos, primeiroPagamento: primeiro }, agora);
  const nomeMorador = nomeCurto((((perfil as { full_name?: string | null } | null)?.full_name ?? "") as string).replace(/\S+@\S+/g, "").trim()) ?? "Morador";
  const fotoMorador = await signAvatarPath(await getAvatarPath(c.tenant_id), c.tenant_id);

  type LinhaAditivo = {
    id: string;
    numero: number;
    status: string;
    resumo: string;
    mudancas: MudancasAditivo;
    proposto_por: string;
    papel_proponente: PapelEstadia;
    expira_em: string;
    criado_em: string;
    assinado_em: string | null;
    contrato_aditivo_assinaturas: { papel: PapelEstadia }[] | null;
    contrato_aditivo_taxa: { valor: number | string; base_texto: string } | { valor: number | string; base_texto: string }[] | null;
  };
  const aditivos: AditivoView[] = ((adit ?? []) as unknown as LinhaAditivo[]).map((a) => {
    const t = Array.isArray(a.contrato_aditivo_taxa) ? a.contrato_aditivo_taxa[0] : a.contrato_aditivo_taxa;
    return {
      id: a.id,
      numero: a.numero,
      status: a.status,
      resumo: a.resumo,
      mudancas: a.mudancas,
      propostoPorMim: a.proposto_por === userId,
      papelProponente: a.papel_proponente,
      expiraEm: a.expira_em,
      criadoEm: a.criado_em,
      assinadoEm: a.assinado_em,
      historico: linhaDoHistorico({ numero: a.numero, assinadoEm: a.assinado_em, criadoEm: a.criado_em, resumo: a.resumo }),
      assinaturas: (a.contrato_aditivo_assinaturas ?? []).map((x) => x.papel),
      taxa: papel === "proprietario" && t ? { valor: Number(t.valor), base: t.base_texto } : null,
    };
  });
  const e = enc as { id: string; motivo: string; status: string; criado_em: string; texto: string | null } | null;

  return {
    id: c.id,
    numero: numeroPublicoContrato(c.id),
    papel,
    status: c.status,
    imovel: { id: c.property_id, titulo: c.properties?.title ?? "Imóvel", foto },
    periodo,
    topo: topoDaEstadia(periodo, c, agora),
    checklist,
    valores,
    morador: { nome: nomeMorador, foto: fotoMorador },
    outraParteId: papel === "inquilino" ? ownerId : c.tenant_id,
    ocupantes,
    ocupantesPrevistos: previstos,
    capacidade: Math.max(previstos, Number(c.capacidade_snapshot ?? c.properties?.max_guests ?? previstos) || previstos),
    podeEditarOcupantes: papel === "inquilino" && ambos && c.status === "ativo",
    instrucoes: {
      liberadas,
      texto: liberadas ? "" : textoAntesDaLiberacao({ inicio: periodo.inicio, assinadoPelasDuas: ambos, primeiroPagamento: primeiro }),
      campos: liberadas ? (papel === "proprietario" ? instr.doImovel : instr.efetivas) : null,
    },
    nota: (nota as { texto?: string } | null)?.texto ?? "",
    aditivos,
    encerramento: e ? { id: e.id, motivo: e.motivo, status: e.status, criadoEm: e.criado_em, texto: e.texto } : null,
    documentos: docs ?? 0,
    assinadoPelasDuas: ambos,
    primeiroPagamento: primeiro,
    meses,
    valorMensal,
    blocos: blocos
      .filter((b) => b.status !== "nao_aceito")
      .map((b) => ({ numero: b.numero_bloco, inicio: b.inicio, fim: b.fim, meses: Number(b.meses), iniciado: blocoIniciado(b, hojeEmBrasilia(agora)) })),
  };
}

/** Meses ainda não iniciados (base do aditivo) — exportado para as ações. */
export function mesesFuturos(c: LinhaContratoEstadia, hojeISO: string): number {
  return mesesNaoIniciados(blocosOrdenados(c), hojeISO);
}

/** Hoje (AAAA-MM-DD) em Brasília. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return diaBRT(agora) ?? agora.toISOString().slice(0, 10);
}
