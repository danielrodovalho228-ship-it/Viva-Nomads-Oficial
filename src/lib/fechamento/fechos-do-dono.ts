/*
  E1090 — os fechos do dono, numa lista só (ESPEC-E1090, fechada na ORDEM-DUET-610/611). PURO: recebe as candidaturas,
  as propostas e os contratos já lidos (a leitura fica em `src/lib/data/fechos-do-dono-servidor.ts`) e devolve as
  linhas na ordem, com o que cada uma oferece e a candidatura que a página do Fechamento abre.

  Uma linha é uma ESTADIA a fechar (depois do E1086 o contrato é por estadia, não por candidatura):
   • A — estadia com proposta: cada proposta da candidatura em "aceita", "em contrato" ou "contrato assinado". O contrato
         dela é o que tem a MESMA candidatura e a MESMA proposta — nunca só a mesma candidatura.
   • B — contrato sem proposta (fechamento direto, massa, legado), e qualquer contrato que não case com uma linha A.
   • C — candidatura aceita sem nenhuma linha A nem B: ainda por fechar.

  R3a: o estado vem do CONTRATO. Sem contrato, a linha é "Por gerar", diga a proposta o que disser (uma proposta pode
  dizer "em contrato" sem contrato nenhum — o caso 13, visto em produção).
  R2: a candidatura com a pré-aceitação expirada não gera linha por gerar; os contratos que já tenha continuam na lista.
  R4: primeiro o que espera o dono (por gerar), depois os contratos à espera de assinatura, depois o resto; o mais
      recente primeiro em cada grupo.
  R7: abre o assistente a linha C e a linha A da proposta mais recente da candidatura (é a estadia que o assistente
      mostra); sem linha A, a linha B mais recente. As outras levam ao contrato ou, sem contrato, ao orçamento.
  E1141 (2.ª fatia): a linha A de uma estadia ANTERIOR sem contrato abre o assistente DELA (`?c=…&p=<proposta>`); com
      contrato, leva ao contrato (nunca reabre o assistente). A linha que a página abre sem `?c=` não muda (R5).
*/
import { lerDaterange, type Periodo } from "../contrato-periodo.ts";
import { numerosDaLista } from "../contrato-ref.ts";
import { periodoPeloFim } from "../texto-do-periodo.ts";

/**
 * E1204: o período da linha C a partir da janela da candidatura — `inicio_desejado` é a entrada e `fim_desejado` é a
 * SAÍDA (fim exclusivo). Devolve o fim INCLUSIVO (a última noite), como as linhas A e B. Sem as duas datas ou com a
 * saída no dia da entrada, null.
 */
export function periodoDaCandidatura(inicioDesejado: string | null, fimDesejado: string | null): Periodo | null {
  if (!inicioDesejado || !fimDesejado) return null;
  return lerDaterange(`[${inicioDesejado.slice(0, 10)},${fimDesejado.slice(0, 10)})`);
}

/** E1204 (regra do E1089): "Entrada DD/MM/AAAA · Saída DD/MM/AAAA · N diárias" — nunca a última noite em "X a Y". */
export function textoDoPeriodoDoFecho(periodo: Periodo | null): string | null {
  return periodo ? (periodoPeloFim(periodo.inicio, periodo.fim)?.linha ?? null) : null;
}

/** R12: a lista mostra até 50 linhas; o que passa disso é contado e apontado para Contratos. */
export const TETO_FECHOS = 50;

/** R3: o estado da linha sem contrato. Texto em aprovação no PR (ORDEM-610, decisão 5). */
export const ESTADO_POR_GERAR = "Por gerar";

/** As propostas que já são uma estadia acordada (as mesmas que o assistente lê em `propostaAcordadaDoLead`). */
export const STATUS_PROPOSTA_ACORDADA: readonly string[] = [
  "aceita",
  "em_contrato",
  "contrato_assinado",
];

export interface CandidaturaDoFecho {
  id: string;
  donoId: string;
  imovel: string;
  morador: string;
  aceitaEm: string | null;
  /** E968: a pré-aceitação mais recente expirou — a candidatura voltou ao dono. */
  preAceiteExpirado: boolean;
  /** O período escolhido na candidatura (para a linha C), quando há. */
  periodo: Periodo | null;
}

export interface PropostaDoFecho {
  id: string;
  leadId: string;
  numero: string;
  status: string;
  aceitaEm: string | null;
  periodo: Periodo | null;
}

export interface ContratoDoFecho {
  id: string;
  leadId: string;
  propostaId: string | null;
  criadoEm: string;
  periodo: Periodo | null;
  /** O estado pela fonte única (`estadoDoContratoUnico`, papel do dono): o selo e a etapa. */
  estado: { selo: string; etapa: string | null };
}

export type AcaoDoFecho =
  /** `anterior`: o assistente de uma estadia anterior da candidatura (E1141), com a proposta na URL. */
  | { tipo: "assistente"; href: string; anterior?: true }
  | { tipo: "contrato"; href: string }
  | { tipo: "orcamento"; href: string };

export interface LinhaDoFecho {
  /** Identidade estável da linha (React key e marca da linha atual). */
  chave: string;
  tipo: "A" | "B" | "C";
  leadId: string;
  propostaId: string | null;
  contratoId: string | null;
  imovel: string;
  morador: string;
  periodo: Periodo | null;
  /** O número do orçamento (ORC-…), quando a linha tem proposta. */
  orcamento: string | null;
  /** O número público do contrato (VN-CT-…), com o desempate da lista de Contratos, quando há contrato. */
  contrato: string | null;
  estado: string;
  /** 1 = por gerar, 2 = à espera de assinatura, 3 = o resto (R4). */
  grupo: 1 | 2 | 3;
  acao: AcaoDoFecho;
}

export interface FechosDoDono {
  linhas: LinhaDoFecho[];
  /** Quantas linhas ficaram de fora do teto (R12). */
  foraDoTeto: number;
  /** A candidatura que a página abre sem `?c=` (R5): a da primeira linha que abre o assistente. */
  abrir: string | null;
}

interface Rascunho extends Omit<LinhaDoFecho, "acao" | "contrato"> {
  data: string;
  /** A linha que abre o assistente pela regra de sempre (só a candidatura na URL) — a que a página abre (R5). */
  abreAssistente: boolean;
  /** E1141: a estadia anterior sem contrato — abre o assistente dela, com a proposta na URL. */
  abreAssistenteAnterior?: boolean;
}

const tempo = (s: string | null | undefined): number => {
  const t = Date.parse(String(s ?? ""));
  return Number.isNaN(t) ? 0 : t;
};

export function fechosDoDono(entrada: {
  donoId: string;
  candidaturas: readonly CandidaturaDoFecho[];
  propostas: readonly PropostaDoFecho[];
  contratos: readonly ContratoDoFecho[];
}): FechosDoDono {
  // R1: só as candidaturas deste dono; as propostas e os contratos de outra candidatura nunca entram.
  const doDono = new Map(
    entrada.candidaturas
      .filter((c) => c.donoId === entrada.donoId)
      .map((c) => [c.id, c]),
  );
  const propostas = entrada.propostas.filter(
    (p) => doDono.has(p.leadId) && STATUS_PROPOSTA_ACORDADA.includes(p.status),
  );
  const contratos = entrada.contratos.filter((c) => doDono.has(c.leadId));

  const rascunhos: Rascunho[] = [];
  const contratosUsados = new Set<string>();

  for (const cand of doDono.values()) {
    const minhas = propostas.filter((p) => p.leadId === cand.id);
    // A estadia que o assistente mostra: a proposta acordada mais recente (a mesma regra de `propostaAcordadaDoLead`).
    const maisRecente = minhas.reduce<PropostaDoFecho | null>(
      (m, p) => (!m || tempo(p.aceitaEm) > tempo(m.aceitaEm) ? p : m),
      null,
    );
    const linhasDaCandidatura: Rascunho[] = [];

    for (const p of minhas) {
      // O contrato liga-se pela candidatura E pela proposta (E1086); o mais recente, se houver mais de um.
      const ct = contratos
        .filter((c) => c.leadId === cand.id && c.propostaId === p.id)
        .sort((a, b) => tempo(b.criadoEm) - tempo(a.criadoEm))[0];
      // R2: expirada e sem contrato → sem linha por gerar.
      if (!ct && cand.preAceiteExpirado) continue;
      if (ct) contratosUsados.add(ct.id);
      linhasDaCandidatura.push({
        chave: `A:${p.id}`,
        tipo: "A",
        leadId: cand.id,
        propostaId: p.id,
        contratoId: ct?.id ?? null,
        imovel: cand.imovel,
        morador: cand.morador,
        periodo: ct?.periodo ?? p.periodo,
        orcamento: p.numero,
        // R3a: o estado vem do contrato; sem contrato, "Por gerar" — o status da proposta não entra aqui.
        estado: ct ? ct.estado.selo : ESTADO_POR_GERAR,
        grupo: grupoDe(ct),
        data: ct ? ct.criadoEm : (p.aceitaEm ?? cand.aceitaEm ?? ""),
        abreAssistente: !cand.preAceiteExpirado && p.id === maisRecente?.id,
        abreAssistenteAnterior: !cand.preAceiteExpirado && p.id !== maisRecente?.id && !ct,
      });
    }

    // B: os contratos desta candidatura que não ficaram numa linha A (sem proposta, ou de uma proposta que já não está
    // acordada) — nenhum contrato some da lista.
    const soltos = contratos
      .filter((c) => c.leadId === cand.id && !contratosUsados.has(c.id))
      .sort((a, b) => tempo(b.criadoEm) - tempo(a.criadoEm));
    soltos.forEach((ct, i) => {
      contratosUsados.add(ct.id);
      linhasDaCandidatura.push({
        chave: `B:${ct.id}`,
        tipo: "B",
        leadId: cand.id,
        propostaId: ct.propostaId,
        contratoId: ct.id,
        imovel: cand.imovel,
        morador: cand.morador,
        periodo: ct.periodo,
        orcamento: null,
        estado: ct.estado.selo,
        grupo: grupoDe(ct),
        data: ct.criadoEm,
        // Sem proposta acordada, o assistente mostra o contrato sem proposta mais recente.
        abreAssistente:
          !cand.preAceiteExpirado &&
          !maisRecente &&
          ct.propostaId === null &&
          i === soltos.findIndex((s) => s.propostaId === null),
      });
    });

    // C: aceita, sem linha nenhuma, e não expirada.
    if (linhasDaCandidatura.length === 0 && !cand.preAceiteExpirado) {
      linhasDaCandidatura.push({
        chave: `C:${cand.id}`,
        tipo: "C",
        leadId: cand.id,
        propostaId: null,
        contratoId: null,
        imovel: cand.imovel,
        morador: cand.morador,
        periodo: cand.periodo,
        orcamento: null,
        estado: ESTADO_POR_GERAR,
        grupo: 1,
        data: cand.aceitaEm ?? "",
        abreAssistente: true,
      });
    }
    rascunhos.push(...linhasDaCandidatura);
  }

  // R4: grupo, depois o mais recente primeiro; a chave desempata (ordem estável entre leituras).
  rascunhos.sort(
    (a, b) =>
      a.grupo - b.grupo ||
      tempo(b.data) - tempo(a.data) ||
      a.chave.localeCompare(b.chave),
  );

  const visiveis = rascunhos.slice(0, TETO_FECHOS);
  // R6: o número do contrato com o desempate da lista de Contratos (dois ids com os mesmos 8 primeiros caracteres).
  const numeros = numerosDaLista(
    visiveis.flatMap((r) => (r.contratoId ? [r.contratoId] : [])),
  );

  const linhas: LinhaDoFecho[] = visiveis.map((rascunho) => {
    const { abreAssistente, abreAssistenteAnterior } = rascunho;
    const r: Omit<Rascunho, "data" | "abreAssistente" | "abreAssistenteAnterior"> = {
      chave: rascunho.chave,
      tipo: rascunho.tipo,
      leadId: rascunho.leadId,
      propostaId: rascunho.propostaId,
      contratoId: rascunho.contratoId,
      imovel: rascunho.imovel,
      morador: rascunho.morador,
      periodo: rascunho.periodo,
      orcamento: rascunho.orcamento,
      estado: rascunho.estado,
      grupo: rascunho.grupo,
    };
    return {
      ...r,
      contrato: r.contratoId ? (numeros.get(r.contratoId) ?? null) : null,
      acao: abreAssistente
        ? {
            tipo: "assistente",
            href: `/dashboard/fechamento?c=${encodeURIComponent(r.leadId)}`,
          }
        : abreAssistenteAnterior && r.propostaId
          ? {
              tipo: "assistente",
              href: `/dashboard/fechamento?c=${encodeURIComponent(r.leadId)}&p=${encodeURIComponent(r.propostaId)}`,
              anterior: true,
            }
        : r.contratoId
          ? {
              tipo: "contrato",
              href: `/dashboard/contratos/${encodeURIComponent(r.contratoId)}`,
            }
          : {
              tipo: "orcamento",
              href: `/dashboard/propostas/${encodeURIComponent(r.propostaId ?? "")}`,
            },
    };
  });

  return {
    linhas,
    foraDoTeto: Math.max(0, rascunhos.length - TETO_FECHOS),
    abrir: rascunhos.find((r) => r.abreAssistente)?.leadId ?? null,
  };
}

function grupoDe(ct: ContratoDoFecho | undefined): 1 | 2 | 3 {
  if (!ct) return 1;
  return ct.estado.etapa === "aguardando_assinatura" ? 2 : 3;
}
