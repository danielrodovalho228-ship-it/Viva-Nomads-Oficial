/*
  Pacote de provas do contrato (ordem 283d8001, #14; Prompt 35B, #901) — regras PURAS, sem banco.
  Junta num PDF o que as duas partes já podem ver: o resumo assinado (com a marca de minuta), o hash de cada
  assinatura, os pagamentos marcados (os anulados com a marca, fora dos totais), a conferência (itens por cômodo
  sem as fotos, respostas com o motivo, laudos só pelo nome) e a linha do tempo, em ordem de data. Não leva IP,
  contato nem documento: das partes, só o nome completo junto da assinatura (E1069). A plataforma não recebe dinheiro: o pacote só registra o que as partes declararam.
*/
import type { CabecalhoDocumento, ConteudoDocumento } from "./fiscal/documento.ts";
import { brl, dataBR } from "./fiscal/documento.ts";
import { textoLinhaRecibo, textoLinhaSemDocumento } from "./documentos-linha.ts";
import { compararHashComResumo, dataHoraAssinatura, hashResumo } from "./contrato-assinar.ts";
import { MARCA_MINUTA } from "./contrato-etapas.ts";
import { ROTULO_ESTADO_CONFERENCIA, estadoConferencia, textoPrazoConferencia } from "./conferencia.ts";
import { ETIQUETA_BRASILIA } from "./datas-brasilia.ts";
import { ROTULO_CONTAS, ROTULO_LIMPEZA, componentesDoPagamento, parteDaColuna, type Encargo } from "./pagamento-componentes.ts";

type Parte = "proprietario" | "inquilino";

export interface PagamentoProva {
  tipo: "aluguel" | "caucao";
  valor: number;
  forma: string;
  dia: string;
  /** E1069: instante em que o proprietário REGISTROU o pagamento (created_at). É a hora da linha do tempo. */
  registradoEm?: string | null;
  /** E1074: número do recibo (REC-…) ou do comprovante da caução (CAU-…) deste pagamento; null = ainda não emitido. */
  documento?: string | null;
  /** E1072: o que foi registrado junto com o aluguel — as contas do período e a limpeza de preparação. */
  encargos?: Encargo[];
  /** E1072 (fatia 2): 2 em diante = registro complementar do mesmo bloco (pela ordem dos registros ativos). */
  parte?: number;
  confirmadoEm: string | null;
  /** E1241 (ORDEM-DUET 1233): o bloco do registro (número e datas), para a linha da Central na gramática dos documentos. */
  bloco?: { numero: number; inicio: string | null; fim: string | null } | null;
  /** Registro anulado (0182): aparece uma vez, com a marca, e fica fora dos totais. */
  anuladoEm?: string | null;
  anuladoMotivo?: string | null;
}

export interface ConferenciaProva {
  tipo: "entrada" | "saida";
  abertaEm: string;
  itensPorParte: Record<Parte, number>;
  /** Cômodo + descrição de cada item; a foto fica na plataforma (só se conta). */
  itens?: { parte: Parte; comodo: string; descricao: string; temFoto: boolean; precisaReparo?: boolean }[];
  respostas: { parte: Parte; decisao: "confirmou" | "contestou"; em: string; motivo?: string | null }[];
  /** Laudos independentes: só o nome do arquivo. */
  laudos?: { nome: string; parte: Parte; em: string }[];
}

export type NomesDasPartes = { proprietario: string | null; inquilino: string | null };

export interface DadosProvas {
  contratoId: string;
  imovel: string;
  /** O selo de estadoDoContratoUnico ("Em vigência"), igual às telas — nunca o status cru do banco. */
  situacao: string;
  /** ISO de created_at do contrato. */
  registradoEm: string;
  /** Linhas do resumo como a tela mostra (e como o hash foi calculado). */
  resumo: string[];
  assinaturas: { papel: Parte; em: string; hash: string }[];
  /** E1069: nome completo de cada parte, para "Ana Souza (proprietário)" nas assinaturas. Sem nome, fica o papel. */
  nomes?: NomesDasPartes | null;
  /** E197: papel com a data de assinatura gravada no contrato e SEM o registro com hash (não se inventa hash). */
  assinaturasSemHash?: { papel: Parte; em: string }[];
  pagamentos: PagamentoProva[];
  conferencias: ConferenciaProva[];
  /** Instante do prazo da conferência de entrada (prazoConferenciaEntrada). */
  prazoEntradaEm?: string | null;
  /** Instante do prazo da conferência de saída (prazoConferenciaSaida, Prompt 56). */
  prazoSaidaEm?: string | null;
  /** Pacote gerado pela equipe (admin › contrato): a linha "Gerado pela equipe Viva Nomads em …". */
  geradoPelaEquipeEm?: string | null;
  /** Aditivos (Prompt 32): o que mudou, a situação e as assinaturas com o hash do texto do aditivo. */
  aditivos?: AditivoProva[];
}

export interface AditivoProva {
  numero: number;
  resumo: string;
  status: string;
  propostoEm: string;
  assinadoEm: string | null;
  hash: string | null;
  assinaturas: { papel: Parte; em: string; hash: string }[];
}

const SITUACAO_ADITIVO: Record<string, string> = {
  proposto: "proposto, aguardando a outra parte",
  recusado: "recusado (o contrato não mudou)",
  expirado: "vencido sem resposta (o contrato não mudou)",
  aceito: "aceito, aguardando as duas assinaturas",
  assinado: "assinado pelas duas partes",
};

/** As linhas da seção ADITIVOS. */
export function linhasAditivos(aditivos: AditivoProva[] | undefined, nomes?: NomesDasPartes | null): string[] {
  if (!aditivos?.length) return ["Nenhum aditivo."];
  const out: string[] = [];
  for (const a of [...aditivos].sort((x, y) => x.numero - y.numero)) {
    out.push(`Aditivo ${a.numero} (${SITUACAO_ADITIVO[a.status] ?? a.status}): ${a.resumo}`);
    if (a.hash) out.push(`Hash do texto do aditivo: ${a.hash}`);
    for (const s of [...a.assinaturas].sort((x, y) => (x.em < y.em ? -1 : 1))) {
      out.push(`${quemAssinou(s.papel, nomes)} assinou o aditivo ${a.numero} em ${dataHoraAssinatura(s.em)}.`);
    }
  }
  return out;
}

export interface EventoProva {
  /** ISO (ordenável). */
  em: string;
  texto: string;
  /** E1069: só o dia é conhecido (pagamento sem o instante do registro) — a linha não traz hora. */
  soDia?: boolean;
}

const PAPEL: Record<Parte, string> = { proprietario: "O proprietário", inquilino: "O inquilino" };
const ROTULO_PAPEL: Record<Parte, string> = { proprietario: "proprietário", inquilino: "inquilino" };

/** E1069: "Ana Souza (proprietário)" — o mesmo formato do cartão de assinaturas; sem nome, "O proprietário". */
export function quemAssinou(papel: Parte, nomes?: NomesDasPartes | null): string {
  const nome = (nomes?.[papel] ?? "").trim();
  return nome ? `${nome} (${ROTULO_PAPEL[papel]})` : PAPEL[papel];
}
const DA_PARTE: Record<Parte, string> = { proprietario: "do proprietário", inquilino: "do inquilino" };
const PELA_PARTE: Record<Parte, string> = { proprietario: "pelo proprietário", inquilino: "pelo inquilino" };
const FORMA: Record<string, string> = { pix: "Pix", boleto: "boleto", transferencia: "transferência", dinheiro: "dinheiro", outro: "outra forma" };

const nomeConferencia = (tipo: "entrada" | "saida") => `conferência de ${tipo === "entrada" ? "entrada" : "saída"}`;
const maiuscula = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const fotos = (n: number) => `${n} ${n === 1 ? "foto" : "fotos"} na plataforma`;

/** "— registro anulado em 19/10/2026 às 14:32 (registro em duplicidade)". */
export function marcaAnulado(p: Pick<PagamentoProva, "anuladoEm" | "anuladoMotivo">): string {
  if (!p.anuladoEm) return "";
  const motivo = (p.anuladoMotivo ?? "").trim();
  return ` — registro anulado em ${dataHoraAssinatura(p.anuladoEm)}${motivo ? ` (${motivo})` : ""}`;
}

/** Totais dos pagamentos SEM os anulados (mesma regra de contratos-actions: `!anulado_em`). */
export function totaisPagamentos(pags: PagamentoProva[]): { confirmado: number; aguardando: number; anulados: number } {
  const validos = pags.filter((p) => !p.anuladoEm);
  // E1072: o total de cada pagamento é o aluguel + as contas + a limpeza registrados com ele.
  const soma = (xs: PagamentoProva[]) => Math.round(xs.reduce((s, p) => s + componentesDoPagamento(p).total, 0) * 100) / 100;
  return {
    confirmado: soma(validos.filter((p) => p.confirmadoEm)),
    aguardando: soma(validos.filter((p) => !p.confirmadoEm)),
    anulados: pags.length - validos.length,
  };
}

/** A linha do evento na LINHA DO TEMPO do pacote: dia e hora de Brasília; só o dia quando a hora não é conhecida. */
export function linhaDoEvento(e: EventoProva): string {
  return `${e.soDia ? dataBR(e.em.slice(0, 10)) : dataHoraAssinatura(e.em)} — ${e.texto}`;
}

/** E1072: " + contas do período de R$ 310,00 + limpeza de preparação de R$ 250,00 = R$ 3.143,33"; sem componentes, "". */
function somaDosComponentes(p: Pick<PagamentoProva, "valor" | "encargos">): string {
  const c = componentesDoPagamento(p);
  if (c.contas <= 0 && c.limpeza <= 0) return "";
  const partes = [c.contas > 0 ? `${ROTULO_CONTAS.toLowerCase()} de ${brl(c.contas)}` : "", c.limpeza > 0 ? `${ROTULO_LIMPEZA.toLowerCase()} de ${brl(c.limpeza)}` : ""].filter(Boolean);
  return ` + ${partes.join(" + ")} = ${brl(c.total)}`;
}

/** E1072: ", com contas do período de R$ 310,00 e limpeza de preparação de R$ 250,00: total de R$ 3.143,33"; sem componentes, "". */
function comOsComponentes(p: Pick<PagamentoProva, "valor" | "encargos">): string {
  const c = componentesDoPagamento(p);
  if (c.contas <= 0 && c.limpeza <= 0) return "";
  const partes = [c.contas > 0 ? `${ROTULO_CONTAS.toLowerCase()} de ${brl(c.contas)}` : "", c.limpeza > 0 ? `${ROTULO_LIMPEZA.toLowerCase()} de ${brl(c.limpeza)}` : ""].filter(Boolean);
  return `, com ${partes.join(" e ")}: total de ${brl(c.total)}`;
}

/** E1072 (fatia 2): o registro complementar de um bloco (nunca a caução). */
const ehComplemento = (p: Pick<PagamentoProva, "tipo" | "parte">) => p.tipo !== "caucao" && (p.parte ?? 1) > 1;

/** E1241: o TOTAL de um registro (componentesDoPagamento; na caução os encargos não contam). */
export function componentesDoTotal(p: Pick<PagamentoProva, "tipo" | "valor" | "encargos">): number {
  return componentesDoPagamento({ valor: p.valor, encargos: p.tipo === "caucao" ? [] : p.encargos }).total;
}

/**
 * E1241 (ORDENS-DUET 1233 e 1237, decisões do coordenador): a linha de cada pagamento na página do contrato da Central
 * usa a MESMA gramática das linhas de documentos (textoLinhaRecibo) — número · bloco · TOTAL · período; a equipe confere
 * pelo número. Confirmado e ainda sem documento: "Recibo em preparação". Sem documento e NÃO confirmado (aguardando, ou
 * anulado antes da confirmação): a forma curta, sem número — esse registro nunca terá recibo.
 */
export function linhaPagamentoCentral(p: PagamentoProva): string {
  const r = { tipo: p.tipo, total: componentesDoTotal(p), inicio: p.bloco?.inicio ?? null, fim: p.bloco?.fim ?? null, bloco: p.bloco?.numero ?? null, parte: p.tipo === "caucao" ? 1 : (p.parte ?? 1) };
  const doc = (p.documento ?? "").trim();
  return textoLinhaRecibo({ ...r, numero: doc || null });
}

/** E1072 (fatia 2): o que o registro complementar cobre — "contas do período de R$ 310,00", "limpeza de preparação de R$ 250,00". */
function partesDoComplemento(p: Pick<PagamentoProva, "valor" | "encargos">): string[] {
  const c = componentesDoPagamento(p);
  return [c.aluguel > 0 ? `aluguel de ${brl(c.aluguel)}` : "", c.contas > 0 ? `${ROTULO_CONTAS.toLowerCase()} de ${brl(c.contas)}` : "", c.limpeza > 0 ? `${ROTULO_LIMPEZA.toLowerCase()} de ${brl(c.limpeza)}` : ""].filter(Boolean);
}

/**
 * E1074: uma linha por pagamento VÁLIDO na seção PAGAMENTOS — o valor, a situação e o documento pelo número. A caução
 * tem a sua linha (antes ia só somada no total). Não se inventa número: confirmado sem documento diz "ainda não
 * emitido". O registro anulado não ganha linha aqui: ele aparece UMA vez no pacote, com a marca, na linha do tempo
 * (regra do 35B, cobrada pela t240), e a seção já diz quantos ficam fora dos totais.
 */
export function linhasPagamentos(pags: PagamentoProva[]): string[] {
  return pags.filter((p) => !p.anuladoEm).map((p) => {
    const caucao = p.tipo === "caucao";
    const base = ehComplemento(p)
      ? `Registro complementar de ${brl(componentesDoPagamento(p).total)} — ${partesDoComplemento(p).join(" + ")} (${FORMA[p.forma] ?? p.forma}, em ${dataBR(p.dia)})`
      : `${caucao ? "Caução" : "Aluguel"} de ${brl(p.valor)}${caucao ? "" : somaDosComponentes(p)} (${FORMA[p.forma] ?? p.forma}, em ${dataBR(p.dia)})`;
    if (!p.confirmadoEm) return `${base}: aguardando confirmação do inquilino.`;
    const nomeDoc = caucao ? "Comprovante da caução" : "Recibo";
    const doc = (p.documento ?? "").trim();
    return `${base}: ${caucao ? "confirmada" : "confirmado"} pelo inquilino em ${dataHoraAssinatura(p.confirmadoEm)}. ${nomeDoc} ${doc || "ainda não emitido"}.`;
  });
}

export function eventosDoContrato(d: DadosProvas): EventoProva[] {
  const ev: EventoProva[] = [{ em: d.registradoEm, texto: `Contrato registrado (${MARCA_MINUTA}).` }];
  for (const a of d.assinaturas) ev.push({ em: a.em, texto: `${quemAssinou(a.papel, d.nomes)} assinou o resumo do contrato.` });
  for (const p of d.pagamentos) {
    const o = p.tipo === "caucao" ? "Caução" : "Aluguel";
    const forma = FORMA[p.forma] ?? p.forma;
    const complemento = ehComplemento(p) ? `Registro complementar de ${brl(componentesDoPagamento(p).total)}` : null;
    const marcado = complemento
      ? `${complemento} (${partesDoComplemento(p).join(" e ")}) marcado como pago pelo proprietário (${forma}, em ${dataBR(p.dia)})`
      : `${o} de ${brl(p.valor)} marcado como pago pelo proprietário (${forma}, em ${dataBR(p.dia)})${p.tipo === "caucao" ? "" : comOsComponentes(p)}`;
    // E1069: a hora é a do REGISTRO. Antes o dia do pagamento ia ao meio-dia UTC e o pacote escrevia "às 09:00".
    const quando = p.registradoEm ? { em: p.registradoEm } : { em: `${p.dia}T12:00:00Z`, soDia: true };
    if (p.anuladoEm) {
      // Anulado: aparece UMA vez, com a marca; não conta como confirmado nem como aguardando.
      ev.push({ ...quando, texto: `${marcado}${marcaAnulado(p)}.` });
      continue;
    }
    ev.push({ ...quando, texto: `${marcado}${p.confirmadoEm ? "" : "; aguardando confirmação do inquilino"}.` });
    if (p.confirmadoEm) ev.push({ em: p.confirmadoEm, texto: `${complemento ?? `${o} de ${brl(p.valor)}`} confirmado pelo inquilino.` });
  }
  for (const a of d.aditivos ?? []) {
    ev.push({ em: a.propostoEm, texto: `Aditivo ${a.numero} proposto: ${a.resumo}` });
    if (a.status === "assinado" && a.assinadoEm) ev.push({ em: a.assinadoEm, texto: `Aditivo ${a.numero} assinado pelas duas partes.` });
  }
  for (const c of d.conferencias) {
    const nome = nomeConferencia(c.tipo);
    ev.push({
      em: c.abertaEm,
      texto: `${maiuscula(nome)} aberta (itens registrados: proprietário ${c.itensPorParte.proprietario}, inquilino ${c.itensPorParte.inquilino}).`,
    });
    for (const r of c.respostas) {
      ev.push({ em: r.em, texto: `${PAPEL[r.parte]} ${r.decisao === "confirmou" ? "confirmou" : "contestou"} a ${nome}.` });
    }
  }
  return ev.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
}

/** As linhas da seção CONFERÊNCIAS: estado, prazo, itens por parte (sem foto), respostas com motivo e laudos. */
export function linhasConferencias(d: Pick<DadosProvas, "conferencias" | "prazoEntradaEm" | "prazoSaidaEm">): string[] {
  if (!d.conferencias.length) return ["Nenhuma conferência aberta."];
  const out: string[] = [];
  const ordem = [...d.conferencias].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "entrada" ? -1 : 1));
  for (const c of ordem) {
    const nome = nomeConferencia(c.tipo);
    out.push(`${maiuscula(nome)}: ${ROTULO_ESTADO_CONFERENCIA[estadoConferencia(c.respostas.map((r) => ({ parte: r.parte, decisao: r.decisao, motivo: r.motivo ?? null })))]}.`);
    if (c.tipo === "entrada" && d.prazoEntradaEm) out.push(`Prazo para registrar e responder: ${textoPrazoConferencia(d.prazoEntradaEm)}.`);
    if (c.tipo === "saida" && d.prazoSaidaEm) out.push(`Prazo para registrar e responder: ${textoPrazoConferencia(d.prazoSaidaEm)}.`);
    const itens = c.itens ?? [];
    for (const parte of ["proprietario", "inquilino"] as const) {
      const meus = itens.filter((i) => i.parte === parte);
      const n = meus.length || c.itensPorParte[parte];
      if (!n) {
        out.push(`Itens ${DA_PARTE[parte]}: nenhum registrado.`);
        continue;
      }
      out.push(`Itens ${DA_PARTE[parte]} (${n} ${n === 1 ? "item" : "itens"}; ${fotos(meus.filter((i) => i.temFoto).length)}):`);
      for (const i of meus) out.push(`- ${i.comodo}: ${i.descricao}${i.precisaReparo ? " (precisa de reparo)" : ""}`);
    }
    for (const r of [...c.respostas].sort((a, b) => (a.em < b.em ? -1 : 1))) {
      const motivo = r.decisao === "contestou" && r.motivo?.trim() ? ` Motivo: ${r.motivo.trim()}` : "";
      out.push(`${PAPEL[r.parte]} ${r.decisao === "confirmou" ? "confirmou" : "contestou"} a ${nome} em ${dataHoraAssinatura(r.em)}.${motivo}`);
    }
    for (const l of c.laudos ?? []) out.push(`Laudo independente anexado ${PELA_PARTE[l.parte]} em ${dataHoraAssinatura(l.em)}: ${l.nome}.`);
  }
  return out;
}

export function nomeArquivoProvas(contratoId: string): string {
  return `provas-contrato-${contratoId.slice(0, 8)}.pdf`;
}

/**
 * Registro do pacote (Prompt 56): cada geração é um PRV novo, com cabeçalho e rodapé comuns. `contrato` é o número do
 * contrato com o Registro nº ("VN-CT-11281A61 · Registro nº 000001"); sem ele, fica o id (como antes).
 */
export interface RegistroPacote {
  cabecalho: Omit<CabecalhoDocumento, "marca" | "emissor">;
  contrato?: string;
}

export function conteudoPacoteProvas(d: DadosProvas, registro?: RegistroPacote): ConteudoDocumento {
  const hashAtual = hashResumo(d.resumo);
  const ass = [...d.assinaturas].sort((a, b) => (a.em < b.em ? -1 : 1));
  const semHash = [...(d.assinaturasSemHash ?? [])].sort((a, b) => (a.em < b.em ? -1 : 1));
  const t = totaisPagamentos(d.pagamentos);
  return {
    // Documento da plataforma (D1-a): só a marca Viva.
    ...(registro ? { cabecalho: { marca: "plataforma" as const, ...registro.cabecalho } } : {}),
    titulo: "Pacote de provas do contrato",
    subtitulo: MARCA_MINUTA,
    quadro: [
      ["Contrato", registro?.contrato ?? d.contratoId],
      ["Imóvel", d.imovel],
      ["Situação", d.situacao],
      ["Hash do resumo atual", hashAtual],
    ],
    corpo: [
      ...(d.geradoPelaEquipeEm ? [`Gerado pela equipe Viva Nomads em ${dataHoraAssinatura(d.geradoPelaEquipeEm)} (${ETIQUETA_BRASILIA}).`] : []),
      "RESUMO DO CONTRATO",
      ...d.resumo,
      "ASSINATURAS",
      ...(ass.length || semHash.length
        ? [
          ...ass.map(
            (a) =>
              // QA do Muse no 35B: cada assinatura mostra o próprio hash e um de três estados; "igual" só com o mesmo hash.
              `${quemAssinou(a.papel, d.nomes)} em ${dataHoraAssinatura(a.em)} — Hash do resumo assinado: ${a.hash} (${compararHashComResumo(d.resumo, a.hash, d.registradoEm).texto}).`
          ),
          // E197: a data gravada no contrato, sem registro com hash — a mesma assinatura que a lista do admin mostra.
          ...semHash.map((a) => `${quemAssinou(a.papel, d.nomes)} em ${dataHoraAssinatura(a.em)} — data gravada no contrato, sem o registro do hash do resumo assinado.`),
        ]
        : ["Nenhuma assinatura ainda."]),
      "ADITIVOS",
      ...linhasAditivos(d.aditivos, d.nomes),
      "PAGAMENTOS",
      ...(d.pagamentos.length
        ? [
            `Confirmados pelo inquilino: ${brl(t.confirmado)}. Aguardando confirmação do inquilino: ${brl(t.aguardando)}.`,
            ...(t.anulados ? [`${t.anulados === 1 ? "1 registro anulado fica" : `${t.anulados} registros anulados ficam`} fora dos totais.`] : []),
            ...linhasPagamentos(d.pagamentos),
          ]
        : ["Nenhum pagamento marcado."]),
      "CONFERÊNCIAS",
      ...linhasConferencias(d),
      "LINHA DO TEMPO",
      ...eventosDoContrato(d).map(linhaDoEvento),
    ],
    rodape: [
      "Gerado pela plataforma Viva Nomads a partir dos registros que as duas partes já veem. As fotos ficam na tela da conferência.",
      "A Viva Nomads não recebe aluguel nem caução: os valores são pagos diretamente entre as partes.",
      "Minuta de teste: sem validade jurídica até o parecer da assessoria.",
    ],
  };
}

/* ---- Montagem a partir das linhas do banco (a MESMA para as partes e para a equipe) ---- */

export interface LinhasProvas {
  contratoId: string;
  imovel: string;
  situacao: string;
  registradoEm: string;
  resumo: string[];
  prazoEntradaEm: string | null;
  prazoSaidaEm?: string | null;
  assinaturas: { papel: unknown; assinado_em: unknown; hash_documento: unknown }[];
  /** E197: as datas de assinatura gravadas no próprio contrato (assinado_*_em) — a mesma fonte da lista do admin. */
  datasAssinatura?: { proprietario: string | null; inquilino: string | null };
  /** E1074: recibos e comprovantes do contrato (documentos_fiscais), para nomear cada um na linha do seu pagamento. */
  documentos?: { tipo: unknown; numero: unknown; pagamento_id: unknown; anulado_em?: unknown }[];
  pagamentos: {
    id?: unknown;
    tipo: unknown;
    valor: unknown;
    forma: unknown;
    data_pagamento: unknown;
    confirmado_pelo_inquilino: unknown;
    confirmado_em: unknown;
    anulado_em?: unknown;
    anulado_motivo?: unknown;
    /** E1069: quando o proprietário registrou. */
    created_at?: unknown;
    /** E1072: as contas e a limpeza registradas com o aluguel. */
    encargos?: unknown;
    /** E1072 (fatia 2): o bloco do registro. */
    bloco_id?: unknown;
    /** E1241: o bloco do registro (número e datas), pela ligação bloco_id. */
    contrato_blocos?: unknown;
    /** E1072 (ORDEM-DUET-1104): a parte registada na coluna (1 = o primeiro; 2 em diante = complementar). */
    parte?: unknown;
  }[];
  conferencias: { id: unknown; tipo: unknown; criada_em: unknown }[];
  itens: { conferencia_id: unknown; parte: unknown; comodo?: unknown; descricao?: unknown; foto_path?: unknown; precisa_reparo?: unknown }[];
  respostas: { conferencia_id: unknown; parte: unknown; decisao: unknown; motivo?: unknown; decidido_em: unknown }[];
  laudos: { conferencia_id: unknown; path: unknown; parte: unknown; criado_em: unknown }[];
  aditivos?: {
    numero: unknown;
    resumo: unknown;
    status: unknown;
    criado_em: unknown;
    assinado_em?: unknown;
    hash_documento?: unknown;
    contrato_aditivo_assinaturas?: { papel: unknown; assinado_em: unknown; hash_documento: unknown }[] | null;
  }[];
}

const parteDe = (p: unknown): Parte => (p === "proprietario" ? "proprietario" : "inquilino");
export const textoOuNulo = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
/** Só o nome do arquivo do laudo (sem a pasta de quem enviou). */
export const nomeDoLaudo = (path: unknown) => String(path ?? "").split("/").pop() || "laudo.pdf";

/** E1074: o documento VÁLIDO de um pagamento — recibo para o aluguel, comprovante para a caução; anulado não conta. */
const TIPO_DOCUMENTO = { aluguel: "recibo_aluguel", caucao: "comprovante_caucao" } as const;
function documentoDoPagamento(docs: LinhasProvas["documentos"], pagamentoId: unknown, tipo: "aluguel" | "caucao"): string | null {
  if (pagamentoId === null || pagamentoId === undefined || pagamentoId === "") return null;
  const doc = (docs ?? []).find((d) => String(d.pagamento_id ?? "") === String(pagamentoId) && d.tipo === TIPO_DOCUMENTO[tipo] && !d.anulado_em);
  return textoOuNulo(doc?.numero);
}

/** E1072: os encargos do pagamento como vêm do banco ([{rotulo, valor}]); o que não tiver rótulo e valor fica de fora. */
function encargosDaLinha(v: unknown): Encargo[] {
  if (!Array.isArray(v)) return [];
  return (v as { rotulo?: unknown; valor?: unknown }[])
    .filter((e) => e && String(e.rotulo ?? "").trim() && Number(e.valor) > 0)
    .map((e) => ({ rotulo: String(e.rotulo).trim(), valor: Math.round(Number(e.valor) * 100) / 100 }));
}

export function montarDadosProvas(l: LinhasProvas): DadosProvas {
  const comHash = new Set(l.assinaturas.map((a) => parteDe(a.papel)));
  const assinaturasSemHash = (["proprietario", "inquilino"] as const)
    .filter((p) => !comHash.has(p) && !!l.datasAssinatura?.[p])
    .map((p) => ({ papel: p, em: String(l.datasAssinatura![p]) }));
  return {
    assinaturasSemHash,
    aditivos: (l.aditivos ?? []).map((a) => ({
      numero: Number(a.numero),
      resumo: String(a.resumo ?? ""),
      status: String(a.status ?? ""),
      propostoEm: String(a.criado_em),
      assinadoEm: textoOuNulo(a.assinado_em),
      hash: textoOuNulo(a.hash_documento),
      assinaturas: (a.contrato_aditivo_assinaturas ?? []).map((x) => ({ papel: parteDe(x.papel), em: String(x.assinado_em), hash: String(x.hash_documento) })),
    })),
    contratoId: l.contratoId,
    imovel: l.imovel,
    situacao: l.situacao,
    registradoEm: l.registradoEm,
    resumo: l.resumo,
    prazoEntradaEm: l.prazoEntradaEm,
    prazoSaidaEm: l.prazoSaidaEm ?? null,
    assinaturas: l.assinaturas.map((a) => ({ papel: parteDe(a.papel), em: String(a.assinado_em), hash: String(a.hash_documento) })),
    pagamentos: l.pagamentos.map((p) => ({
      tipo: p.tipo === "caucao" ? "caucao" : "aluguel",
      documento: documentoDoPagamento(l.documentos, p.id, p.tipo === "caucao" ? "caucao" : "aluguel"),
      valor: Number(p.valor),
      forma: String(p.forma),
      dia: String(p.data_pagamento).slice(0, 10),
      registradoEm: textoOuNulo(p.created_at),
      encargos: p.tipo === "caucao" ? [] : encargosDaLinha(p.encargos),
      // ORDEM-DUET-1104: a parte da coluna registada (0348), nunca a ordem dos registros.
      parte: p.tipo === "caucao" ? 1 : parteDaColuna(p.parte),
      confirmadoEm: p.confirmado_pelo_inquilino ? String(p.confirmado_em ?? p.data_pagamento) : null,
      anuladoEm: textoOuNulo(p.anulado_em),
      anuladoMotivo: textoOuNulo(p.anulado_motivo),
      bloco: blocoDoRegistro(p.contrato_blocos),
    })),
    conferencias: l.conferencias.map((c) => {
      const daConf = l.itens.filter((i) => i.conferencia_id === c.id);
      return {
        tipo: c.tipo === "saida" ? "saida" : "entrada",
        abertaEm: String(c.criada_em),
        itensPorParte: {
          proprietario: daConf.filter((i) => i.parte === "proprietario").length,
          inquilino: daConf.filter((i) => i.parte === "inquilino").length,
        },
        itens: daConf.map((i) => ({ parte: parteDe(i.parte), comodo: String(i.comodo ?? ""), descricao: String(i.descricao ?? ""), temFoto: !!i.foto_path, precisaReparo: i.precisa_reparo === true })),
        respostas: l.respostas
          .filter((r) => r.conferencia_id === c.id)
          .map((r) => ({ parte: parteDe(r.parte), decisao: r.decisao === "contestou" ? "contestou" : "confirmou", em: String(r.decidido_em), motivo: textoOuNulo(r.motivo) })),
        laudos: l.laudos.filter((x) => x.conferencia_id === c.id).map((x) => ({ nome: nomeDoLaudo(x.path), parte: parteDe(x.parte), em: String(x.criado_em) })),
      };
    }),
  };
}

/** E1241: o bloco do registro pela ligação bloco_id (o PostgREST devolve objeto; o tipo gerado, lista). */
function blocoDoRegistro(v: unknown): { numero: number; inicio: string | null; fim: string | null } | null {
  const b = (Array.isArray(v) ? v[0] : v) as { numero_bloco?: unknown; inicio?: unknown; fim?: unknown } | null | undefined;
  return b && Number(b.numero_bloco) > 0 ? { numero: Number(b.numero_bloco), inicio: textoOuNulo(b.inicio), fim: textoOuNulo(b.fim) } : null;
}

/** Colunas lidas para o pacote (as mesmas nas duas cargas). */
export const COLUNAS_PROVAS = {
  assinaturas: "papel, assinado_em, hash_documento",
  pagamentos: "id, bloco_id, tipo, parte, valor, forma, data_pagamento, confirmado_pelo_inquilino, confirmado_em, anulado_em, anulado_motivo, created_at, encargos, contrato_blocos(numero_bloco, inicio, fim)",
  conferencias: "id, tipo, criada_em",
  itens: "conferencia_id, parte, comodo, descricao, foto_path, precisa_reparo",
  respostas: "conferencia_id, parte, decisao, motivo, decidido_em",
  laudos: "conferencia_id, path, parte, criado_em",
  documentos: "tipo, numero, pagamento_id, anulado_em",
  aditivos: "numero, resumo, status, criado_em, assinado_em, hash_documento, contrato_aditivo_assinaturas(papel, assinado_em, hash_documento)",
} as const;
