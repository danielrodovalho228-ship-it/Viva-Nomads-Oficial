/*
  Pacote de provas do contrato (ordem 283d8001, #14) — regras PURAS, sem banco.
  Junta num PDF o que as duas partes já podem ver: o resumo assinado (com a marca de minuta), o hash de cada
  assinatura, os pagamentos marcados e as respostas da conferência, em ordem de data. Não leva IP, contato,
  documento nem o texto livre das partes. A plataforma não recebe dinheiro: o pacote só registra o que as partes declararam.
*/
import type { ConteudoDocumento } from "./fiscal/documento.ts";
import { brl, dataBR } from "./fiscal/documento.ts";
import { dataHoraAssinatura, hashResumo } from "./contrato-assinar.ts";
import { MARCA_MINUTA } from "./contrato-etapas.ts";

type Parte = "proprietario" | "inquilino";

export interface DadosProvas {
  contratoId: string;
  imovel: string;
  status: string;
  /** ISO de created_at do contrato. */
  registradoEm: string;
  /** Linhas do resumo como a tela mostra (e como o hash foi calculado). */
  resumo: string[];
  assinaturas: { papel: Parte; em: string; hash: string }[];
  pagamentos: { tipo: "aluguel" | "caucao"; valor: number; forma: string; dia: string; confirmadoEm: string | null }[];
  conferencias: {
    tipo: "entrada" | "saida";
    abertaEm: string;
    itensPorParte: Record<Parte, number>;
    respostas: { parte: Parte; decisao: "confirmou" | "contestou"; em: string }[];
  }[];
}

export interface EventoProva {
  /** ISO (ordenável). */
  em: string;
  texto: string;
}

const PAPEL: Record<Parte, string> = { proprietario: "O proprietário", inquilino: "O inquilino" };
const FORMA: Record<string, string> = { pix: "Pix", boleto: "boleto", transferencia: "transferência", dinheiro: "dinheiro", outro: "outra forma" };

export function eventosDoContrato(d: DadosProvas): EventoProva[] {
  const ev: EventoProva[] = [{ em: d.registradoEm, texto: `Contrato registrado (${MARCA_MINUTA}).` }];
  for (const a of d.assinaturas) ev.push({ em: a.em, texto: `${PAPEL[a.papel]} assinou o resumo do contrato.` });
  for (const p of d.pagamentos) {
    const o = p.tipo === "caucao" ? "Caução" : "Aluguel";
    const forma = FORMA[p.forma] ?? p.forma;
    const marcado = `${o} de ${brl(p.valor)} marcado como pago pelo proprietário (${forma}, em ${dataBR(p.dia)})`;
    ev.push({ em: `${p.dia}T12:00:00Z`, texto: `${marcado}${p.confirmadoEm ? "" : "; aguardando confirmação do inquilino"}.` });
    if (p.confirmadoEm) ev.push({ em: p.confirmadoEm, texto: `${o} de ${brl(p.valor)} confirmado pelo inquilino.` });
  }
  for (const c of d.conferencias) {
    const nome = `conferência de ${c.tipo === "entrada" ? "entrada" : "saída"}`;
    ev.push({
      em: c.abertaEm,
      texto: `${nome[0].toUpperCase()}${nome.slice(1)} aberta (itens registrados: proprietário ${c.itensPorParte.proprietario}, inquilino ${c.itensPorParte.inquilino}).`,
    });
    for (const r of c.respostas) {
      ev.push({ em: r.em, texto: `${PAPEL[r.parte]} ${r.decisao === "confirmou" ? "confirmou" : "contestou"} a ${nome}.` });
    }
  }
  return ev.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
}

export function nomeArquivoProvas(contratoId: string): string {
  return `provas-contrato-${contratoId.slice(0, 8)}.pdf`;
}

export function conteudoPacoteProvas(d: DadosProvas): ConteudoDocumento {
  const hashAtual = hashResumo(d.resumo);
  const ass = [...d.assinaturas].sort((a, b) => (a.em < b.em ? -1 : 1));
  return {
    titulo: "Pacote de provas do contrato",
    subtitulo: MARCA_MINUTA,
    quadro: [
      ["Contrato", d.contratoId],
      ["Imóvel", d.imovel],
      ["Situação", d.status],
      ["Hash do resumo atual", hashAtual],
    ],
    corpo: [
      "RESUMO DO CONTRATO",
      ...d.resumo,
      "ASSINATURAS",
      ...(ass.length
        ? ass.map(
            (a) =>
              `${PAPEL[a.papel]} em ${dataHoraAssinatura(a.em)} — hash ${a.hash} (${a.hash === hashAtual ? "igual ao resumo atual" : "diferente do resumo atual"}).`
          )
        : ["Nenhuma assinatura ainda."]),
      "LINHA DO TEMPO",
      ...eventosDoContrato(d).map((e) => `${dataHoraAssinatura(e.em)} — ${e.texto}`),
    ],
    rodape: [
      "Gerado pela plataforma Viva Nomads a partir dos registros que as duas partes já veem. O texto das observações e das fotos da conferência fica na tela da conferência.",
      "A Viva Nomads não recebe aluguel nem caução: os valores são pagos diretamente entre as partes.",
      "Minuta de teste: sem validade jurídica até o parecer da assessoria.",
    ],
  };
}
