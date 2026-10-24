/*
  Correção 62-B3 — a porta de entrada do avaliador credenciado. PURO (node --test), sem imports @/.

  Um PEDIDO ÚNICO: quem ainda não é parceiro manda, no mesmo formulário, os dados de parceiro que o credenciamento
  precisa (nome público, tipo de pessoa, CPF/CNPJ, cidade) e os do credenciamento; quem já é parceiro manda só os do
  credenciamento. A categoria "vistoria" entra SÓ por este caminho (a solicitação comum continua recusando).
  A identidade não verificada não recusa o pedido: fica como pendência visível ao candidato e ao admin, e a aprovação
  para teste continua exigindo a identidade verificada. UMA SÓ APROVAÇÃO ativa o parceiro e põe o credenciamento em teste.
*/
import { chaveCidade } from "../cidades.ts";
import { cnpjValido, cpfValido, soDigitos } from "../documento-pessoa.ts";

export const CATEGORIA_AVALIADOR = "vistoria";
export const ROTA_RECRUTAMENTO = "/parceiros/avaliadores";
export const PENDENCIA_IDENTIDADE = "Verificar a identidade.";

export interface PedidoAvaliadorEntrada {
  jaParceiro: boolean;
  /** Só para quem ainda não é parceiro. */
  nome?: string;
  tipoPessoa?: string;
  documento?: string;
  cidade: string;
  experienciaLink?: string | null;
  experienciaArquivo: boolean;
  aceiteConduta: boolean;
}

export type PedidoAvaliadorValido = {
  cidade: string;
  experienciaLink: string | null;
  parceiro: { nome: string; tipoPessoa: "pf" | "pj"; documento: string } | null;
};

const limpar = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Valida o pedido único. Quem já é parceiro não repete dados (os campos de parceiro são ignorados). */
export function validarPedidoAvaliador(e: PedidoAvaliadorEntrada): { ok: true; valor: PedidoAvaliadorValido } | { ok: false; falta: string[] } {
  const falta: string[] = [];
  let parceiro: PedidoAvaliadorValido["parceiro"] = null;
  if (!e.jaParceiro) {
    const nome = limpar(e.nome, 80);
    const tipo = e.tipoPessoa === "pj" ? "pj" : e.tipoPessoa === "pf" ? "pf" : null;
    const doc = soDigitos(e.documento);
    if (nome.length < 3) falta.push("Informar o nome público (o seu ou o da empresa).");
    if (!tipo) falta.push("Escolher pessoa física ou jurídica.");
    else if (tipo === "pf" ? !cpfValido(doc) : !cnpjValido(doc)) falta.push(tipo === "pf" ? "CPF válido." : "CNPJ válido.");
    if (nome.length >= 3 && tipo && (tipo === "pf" ? cpfValido(doc) : cnpjValido(doc))) parceiro = { nome, tipoPessoa: tipo, documento: doc };
  }
  const cidade = limpar(e.cidade, 80);
  if (!chaveCidade(cidade)) falta.push("Informar a cidade onde vai avaliar.");
  const link = limpar(e.experienciaLink, 300);
  if (!e.experienciaArquivo && !/^https:\/\/\S+\.\S+/.test(link)) falta.push("Comprovar experiência (portfólio ou referência: arquivo ou link https).");
  if (!e.aceiteConduta) falta.push("Aceitar o código de conduta da avaliação.");
  if (falta.length) return { ok: false, falta };
  return { ok: true, valor: { cidade, experienciaLink: link || null, parceiro } };
}

/** O que ainda falta depois do pedido registrado (visível ao candidato e ao admin). */
export function pendenciasDoCredenciamento(e: { identidadeVerificada: boolean }): string[] {
  return e.identidadeVerificada ? [] : [PENDENCIA_IDENTIDADE];
}

/** "Aprovar para teste": só do pedido "solicitado" e com a identidade verificada. */
export function podeAprovarParaTeste(e: { status: string; identidadeVerificada: boolean }): { ok: true } | { ok: false; motivo: string } {
  if (e.status !== "solicitado") return { ok: false, motivo: "Só o pedido recebido vai para teste." };
  if (!e.identidadeVerificada) return { ok: false, motivo: "A identidade do candidato ainda não foi verificada." };
  return { ok: true };
}

/**
 * E30: a ATIVAÇÃO é a segunda aprovação, separada da "Aprovar para teste", e só existe com uma avaliação de teste
 * REAL: um pedido de teste (vistoria_pedidos.teste) designado a este avaliador e com o laudo emitido. Vale também para
 * reativar quem nunca fez o teste. "Aprovar para teste" nunca ativa.
 */
export const STATUS_TESTE_CONCLUIDO = "laudo_emitido";
export const PENDENCIA_TESTE = "A avaliação de teste ainda não foi feita: marque um imóvel de teste e espere o laudo.";

export function podeAtivar(e: { status: string; testeConcluido: boolean }): { ok: true } | { ok: false; motivo: string } {
  if (e.status !== "em_teste" && e.status !== "suspenso") return { ok: false, motivo: "Só quem está em teste (ou suspenso) pode ser ativado." };
  if (!e.testeConcluido) return { ok: false, motivo: PENDENCIA_TESTE };
  return { ok: true };
}

/**
 * E30: quem conta como "avaliador ativo" rumo aos 2 da chave VISTORIA_ATIVA — o mesmo critério do rodízio: ativo e
 * de conta real (conta de teste fica fora da rede real).
 */
export function contaComoAvaliadorAtivo(c: { status: string; contaTeste: boolean }): boolean {
  return c.status === "ativo" && !c.contaTeste;
}

/** A solicitação de parceiro que nasce do pedido de credenciamento (categoria só "vistoria"; uma só cidade). */
export function solicitacaoDoAvaliador(p: NonNullable<PedidoAvaliadorValido["parceiro"]>, cidade: string, link: string | null, uid: string, email: string | null) {
  return {
    user_id: uid,
    email,
    nome: p.nome,
    tipo_pessoa: p.tipoPessoa,
    documento: p.documento,
    categorias: [CATEGORIA_AVALIADOR],
    cidades: [cidade],
    portfolio_url: link,
    status: "pendente" as const,
    origem: "conta" as const,
  };
}

/** A fila geral de parceiros não mostra o pedido do avaliador (ele é decidido em /admin/avaliadores). */
export const ehPedidoDeAvaliador = (categorias: readonly string[] | null | undefined) => (categorias ?? []).includes(CATEGORIA_AVALIADOR);
