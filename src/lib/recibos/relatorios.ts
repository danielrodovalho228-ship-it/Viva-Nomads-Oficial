/*
  Prompt 39-B, fase 1 — texto dos RELATÓRIOS de "Recibos e notas" (PURO). O PDF é desenhado pelo mesmo gerarPdf dos
  documentos (src/lib/fiscal/pdf.ts, padrão de docs/modelos/): marca Viva Nomads no topo, quadro rótulo → valor e
  rodapé. Relatório não é documento: sem número de registro e sem código de conferência; os documentos que valem são
  os recibos listados, cada um conferível em /conferir.
*/

import type { ConteudoDocumento } from "../fiscal/documento.ts";
import { formatarDocumento } from "../documento-pessoa.ts";
import { brl, dataBR } from "../fiscal/documento.ts";
import { AVISO_FIXO, rotuloMes, type Informe, type Pessoa, type ResumoAnualParceiro, type ResumoMes, type ResumoReembolso } from "./regras.ts";

const NAO_DOCUMENTO = "Relatório da plataforma, sem número de registro. Os documentos que valem são os recibos listados; cada um pode ser conferido em vivanomads.com.br/conferir.";
const comDoc = (p: { nome: string; doc: string | null }) => {
  const doc = formatarDocumento(p.doc);
  return doc ? `${p.nome} (CPF/CNPJ ${doc})` : p.nome;
};
const MESES_ROTULO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function conteudoResumoMes(s: ResumoMes, quem: Pessoa, imovel: string | null, geradoEm: string): ConteudoDocumento {
  const quadro: [string, string][] = [
    ["Recebedor", comDoc(quem)],
    ["Mês", rotuloMes(s.mes)],
    ...(imovel ? ([["Imóvel", imovel]] as [string, string][]) : []),
    ["Total recebido no mês", brl(s.total)],
  ];
  for (const p of s.porPagador) quadro.push([`Pagador: ${p.nome}`, `${p.doc ? `CPF/CNPJ ${p.doc} · ` : ""}${brl(p.total)} (${p.recibos} ${p.recibos === 1 ? "recibo" : "recibos"})`]);
  const corpo = s.recibos.length
    ? ["Recibos que entram na soma:", ...s.recibos.map((r) => `${r.numero} · ${dataBR(r.data)} · ${r.imovelTitulo} · ${r.pagador.nome} · ${brl(r.valor)}`)]
    : ["Nenhum recibo confirmado neste mês."];
  return {
    titulo: "Resumo do mês para o Carnê-Leão",
    subtitulo: `Recebimentos de locação registrados na Viva Nomads · gerado em ${dataBR(geradoEm)}`,
    quadro,
    corpo,
    rodape: [`Cálculo: ${s.formula}. Caução não entra (não é rendimento).`, AVISO_FIXO, NAO_DOCUMENTO],
  };
}

export function conteudoInforme(inf: Informe, quem: Pessoa, geradoEm: string): ConteudoDocumento {
  const recebedor = inf.lado === "pagador";
  const quadro: [string, string][] = [
    [recebedor ? "Recebedor" : "Pagador", comDoc(quem)],
    ["Ano", String(inf.ano)],
    [recebedor ? "Total recebido no ano" : "Total pago no ano", brl(inf.total)],
  ];
  const corpo: string[] = [];
  for (const l of inf.linhas) {
    quadro.push([`${recebedor ? "Pagador" : "Recebedor"}: ${l.nome}`, `${l.doc ? `CPF/CNPJ ${l.doc} · ` : ""}${brl(l.total)}`]);
    const meses = Object.entries(l.meses)
      .filter(([, v]) => v > 0)
      .map(([m, v]) => `${MESES_ROTULO[Number(m) - 1]} ${brl(v)}`);
    corpo.push(`${l.nome}: ${meses.join(" · ") || "sem recibos"}`);
  }
  if (!inf.linhas.length) corpo.push("Nenhum recibo confirmado neste ano.");
  return {
    titulo: recebedor ? "Informe anual de recebimentos (DIRPF)" : "Resumo anual de pagamentos de locação",
    subtitulo: `Ano-calendário ${inf.ano} · gerado em ${dataBR(geradoEm)}`,
    quadro,
    corpo,
    rodape: [`Cálculo: ${inf.formula}.`, AVISO_FIXO, NAO_DOCUMENTO],
  };
}

export function conteudoReembolso(s: ResumoReembolso, morador: Pessoa, geradoEm: string): ConteudoDocumento {
  const periodo = s.periodoInicio ? `${dataBR(s.periodoInicio)} a ${dataBR(s.periodoFim)}` : "—";
  const quadro: [string, string][] = [
    ["Morador", comDoc(morador)],
    ["Estadia", s.imovelTitulo],
    ...(s.recebedor ? ([["Pago a", comDoc(s.recebedor)]] as [string, string][]) : []),
    ["Período", periodo],
    ["Total pago", brl(s.total)],
  ];
  for (const m of s.meses) quadro.push([rotuloMes(m.mes), `${brl(m.total)} · ${m.recibos.map((r) => r.numero).join(", ")}`]);
  if (s.caucao > 0) quadro.push(["Caução (à parte)", `${brl(s.caucao)}: garantia devolvida no fim, não é despesa do mês`]);
  return {
    titulo: "Resumo para reembolso",
    subtitulo: `Valores pagos na estadia, mês a mês · gerado em ${dataBR(geradoEm)}`,
    quadro,
    corpo: [s.meses.length ? "Cada valor corresponde a um recibo da Viva, que pode ser anexado ao pedido de reembolso." : "Ainda não há recibos confirmados nesta estadia."],
    rodape: ["Cálculo: soma dos recibos confirmados de cada mês, pela data do pagamento.", NAO_DOCUMENTO],
  };
}

export function conteudoParceiroAnual(a: ResumoAnualParceiro, parceiro: Pessoa, geradoEm: string): ConteudoDocumento {
  const quadro: [string, string][] = [
    ["Parceiro", comDoc(parceiro)],
    ["Ano", String(a.ano)],
    ["Serviços concluídos", String(a.servicos)],
    ["Valor dos serviços", brl(a.total)],
    ["Taxa de serviço da Viva (10%)", brl(a.taxa)],
    ["Você recebe (90%)", brl(a.liquido)],
    ["Serviços sem a sua nota", String(a.semDocumento)],
  ];
  const corpo = Object.entries(a.porMes)
    .filter(([, v]) => v.servicos > 0)
    .map(([m, v]) => `${MESES_ROTULO[Number(m) - 1]}/${a.ano}: ${v.servicos} ${v.servicos === 1 ? "serviço" : "serviços"} · ${brl(v.total)} · você recebe ${brl(v.liquido)}`);
  return {
    titulo: "Resumo anual de serviços",
    subtitulo: `Para o seu contador · gerado em ${dataBR(geradoEm)}`,
    quadro,
    corpo: corpo.length ? corpo : ["Nenhum serviço concluído neste ano."],
    rodape: ["Cálculo: soma dos serviços concluídos no ano, pelo valor combinado no pedido.", "A nota de cada serviço é sua; a Viva não emite nota em seu nome.", NAO_DOCUMENTO],
  };
}
