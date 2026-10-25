import "server-only";
/*
  Prompt 39-B, fase 1 — leitura de "Recibos e notas". SÓ LEITURA: nenhum documento novo nasce aqui.

  Documentos de locação: documentos_fiscais pelo cliente da PESSOA (RLS "partes veem os próprios documentos"),
  filtrando o lado dela (dono = owner_id, morador = tenant_id). Contas de teste: o documento cuja outra parte é
  conta de teste não entra no resumo de quem não é de teste (o cliente de serviço só lê is_teste).
  Serviços do parceiro: os pedidos concluídos do próprio parceiro (mesma leitura do painel do parceiro).
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { totalComEncargos } from "@/lib/fiscal/documento";
import { visaoDoParceiro } from "@/lib/parceiros/pedido";
import type { Pessoa, Recibo, ServicoConcluido, TipoRecibo } from "@/lib/recibos/regras";

export type PapelRecibos = "dono" | "morador";

const COLUNAS =
  "id, tipo, numero, valor, encargos, periodo_inicio, periodo_fim, criado_em, contrato_id, owner_id, tenant_id, locador_nome, locador_doc, " +
  "locatario_nome, locatario_doc, imovel_endereco, anulado_em, pagamentos_bloco(data_pagamento), contratos(property_id, properties(id, title))";

interface Linha {
  id: string;
  tipo: string;
  numero: string;
  valor: number | string;
  encargos: { rotulo: string; valor: number }[] | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  criado_em: string;
  contrato_id: string | null;
  owner_id: string | null;
  tenant_id: string | null;
  locador_nome: string | null;
  locador_doc: string | null;
  locatario_nome: string | null;
  locatario_doc: string | null;
  imovel_endereco: string | null;
  anulado_em: string | null;
  pagamentos_bloco: { data_pagamento: string | null } | null;
  contratos: { property_id: string | null; properties: { id: string; title: string | null } | null } | null;
}

const TIPOS: TipoRecibo[] = ["recibo_aluguel", "comprovante_caucao", "termo_devolucao_caucao"];

export interface RecibosDaPessoa {
  userId: string;
  recibos: Recibo[];
  /** Quem é a pessoa nos documentos (o retrato mais recente do lado dela), para o cabeçalho dos relatórios. */
  eu: Pessoa;
  imoveis: { id: string; titulo: string }[];
}

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

/** Conjunto das contas de teste entre os ids pedidos (lido pelo servidor; is_teste não é exposto ao cliente). */
async function contasDeTeste(ids: string[]): Promise<Set<string>> {
  const admin = createAdminClient();
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!admin || !unicos.length) return new Set();
  const { data } = await admin.from("profiles").select("id, is_teste").in("id", unicos);
  return new Set(((data ?? []) as { id: string; is_teste: boolean | null }[]).filter((p) => p.is_teste === true).map((p) => p.id));
}

function paraRecibo(l: Linha): Recibo {
  const titulo = l.contratos?.properties?.title ?? l.imovel_endereco ?? "Imóvel";
  const data = l.pagamentos_bloco?.data_pagamento ?? l.criado_em.slice(0, 10);
  return {
    id: l.id,
    tipo: l.tipo as TipoRecibo,
    numero: l.numero,
    valor: totalComEncargos({ valor: Number(l.valor), encargos: Array.isArray(l.encargos) ? l.encargos : [] }),
    data: data.slice(0, 10),
    pagador: { nome: l.locatario_nome ?? "Morador", doc: l.locatario_doc },
    recebedor: { nome: l.locador_nome ?? "Proprietário", doc: l.locador_doc },
    contratoId: l.contrato_id,
    imovelId: l.contratos?.properties?.id ?? l.contratos?.property_id ?? null,
    imovelTitulo: titulo,
    periodoInicio: l.periodo_inicio,
    periodoFim: l.periodo_fim,
    anulado: !!l.anulado_em,
  };
}

/** Os documentos de locação da pessoa no papel pedido (dono: os que emitiu como locador; morador: os que recebeu). */
export async function recibosDaPessoa(papel: PapelRecibos): Promise<RecibosDaPessoa | null> {
  const s = await sessao();
  if (!s) return null;
  const lado = papel === "dono" ? "owner_id" : "tenant_id";
  const { data } = await s.supabase.from("documentos_fiscais").select(COLUNAS).eq(lado, s.userId).in("tipo", TIPOS).order("criado_em", { ascending: false }).limit(2000);
  const linhas = (data ?? []) as unknown as Linha[];
  const outros = linhas.map((l) => (papel === "dono" ? l.tenant_id : l.owner_id)).filter((x): x is string => !!x);
  const teste = await contasDeTeste([s.userId, ...outros]);
  const souTeste = teste.has(s.userId);
  const validas = souTeste ? linhas : linhas.filter((l) => !teste.has((papel === "dono" ? l.tenant_id : l.owner_id) ?? ""));
  const recibos = validas.map(paraRecibo);
  const ultimo = validas[0];
  const eu: Pessoa = ultimo
    ? papel === "dono"
      ? { nome: ultimo.locador_nome ?? "Proprietário", doc: ultimo.locador_doc }
      : { nome: ultimo.locatario_nome ?? "Morador", doc: ultimo.locatario_doc }
    : { nome: (await nomeDoPerfil(s.userId)) ?? "Você", doc: null };
  const imoveis = [...new Map(recibos.filter((r) => r.imovelId).map((r) => [r.imovelId as string, { id: r.imovelId as string, titulo: r.imovelTitulo }])).values()].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
  return { userId: s.userId, recibos, eu, imoveis };
}

async function nomeDoPerfil(userId: string): Promise<string | null> {
  const s = await createClient();
  if (!s) return null;
  const { data } = await s.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return ((data as { full_name?: string | null } | null)?.full_name ?? null) || null;
}

/** Caminho do PDF de um documento da pessoa (o RLS decide; outra pessoa recebe null). */
export async function pdfsDosDocumentos(ids: string[]): Promise<{ id: string; numero: string; pdf_path: string }[]> {
  const s = await sessao();
  if (!s || !ids.length) return [];
  const { data } = await s.supabase.from("documentos_fiscais").select("id, numero, pdf_path").in("id", ids);
  return (data ?? []) as { id: string; numero: string; pdf_path: string }[];
}

export interface ServicosDoParceiro {
  userId: string;
  parceiro: Pessoa;
  servicos: ServicoConcluido[];
}

/** Serviços CONCLUÍDOS do parceiro logado, do mais recente ao mais antigo. Sem parceria → null. */
export async function servicosConcluidosDoParceiro(): Promise<ServicosDoParceiro | null> {
  const s = await sessao();
  const admin = createAdminClient();
  if (!s || !admin) return null;
  const { data: parc } = await admin.from("parceiros").select("id, nome_publico").eq("user_id", s.userId).maybeSingle();
  if (!parc) return null;
  const { data } = await admin
    .from("parceiro_pedidos")
    .select("id, codigo, categoria, cliente_id, status, valor_combinado, valor_taxa, valor_parceiro, concluido_em, documento_parceiro_path")
    .eq("parceiro_id", (parc as { id: string }).id)
    .eq("status", "concluido")
    .not("concluido_em", "is", null)
    .order("concluido_em", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as {
    id: string;
    codigo: string;
    categoria: string;
    cliente_id: string;
    status: string;
    valor_combinado: number | null;
    valor_taxa: number | null;
    valor_parceiro: number | null;
    concluido_em: string;
    documento_parceiro_path: string | null;
  }[];
  const teste = await contasDeTeste([s.userId, ...rows.map((r) => r.cliente_id)]);
  const validos = teste.has(s.userId) ? rows : rows.filter((r) => !teste.has(r.cliente_id));
  const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", [...new Set(validos.map((r) => r.cliente_id))]);
  const nomes = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  return {
    userId: s.userId,
    parceiro: { nome: (parc as { nome_publico?: string | null }).nome_publico ?? "Parceiro", doc: null },
    servicos: validos.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      categoria: r.categoria,
      cliente: visaoDoParceiro(r.status, null, { nomeCompleto: nomes.get(r.cliente_id) ?? null }).nome,
      valor: r.valor_combinado == null ? null : Number(r.valor_combinado),
      valorTaxa: r.valor_taxa == null ? null : Number(r.valor_taxa),
      valorParceiro: r.valor_parceiro == null ? null : Number(r.valor_parceiro),
      concluidoEm: r.concluido_em,
      temDocumento: !!r.documento_parceiro_path,
    })),
  };
}
