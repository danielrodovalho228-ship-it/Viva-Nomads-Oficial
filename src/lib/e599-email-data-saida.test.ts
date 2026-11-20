/*
  E599 (reprova final do E562, 05/11): o e-mail da proposta dizia saída em 21/02/2027 — um dia ANTES da saída real
  (22/02/2027) gravada na candidatura, no formulário e na proposta. A contagem de dias é saída − entrada (diasDaSelecao),
  então a data de saída é entrada + dias; o e-mail usava o fim inclusivo (a última noite, entrada + dias − 1).
  Roda: node --test src/lib/e599-email-data-saida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataDeSaida } from "./contrato-periodo.ts";
import { diasDaSelecao } from "./imovel/selecao-estadia.ts";
import { linhasProposta } from "./notifications/dados-negociacao.ts";

test("E599: 43 dias a partir de 10/01/2027 saem em 22/02/2027 (a data do formulário)", () => {
  assert.equal(dataDeSaida("2027-01-10", 43), "2027-02-22");
  // ida e volta com a contagem do formulário e da candidatura
  assert.equal(diasDaSelecao({ entrada: "2027-01-10", saida: dataDeSaida("2027-01-10", 43) }), 43);
  assert.equal(dataDeSaida("2026-11-24", 30), "2026-12-24");
});

test("E599: o quadro do e-mail mostra a saída real", () => {
  const linhas = linhasProposta({
    numero: "ORC-2026-0001",
    imovel: { titulo: "Apto" },
    entrada: "2027-01-10",
    saida: dataDeSaida("2027-01-10", 43),
    meses: 2,
    dias: 43,
    valorMensal: 3260,
    contaTotal: "R$ 3.260 × 43 dias ÷ 30 = R$ 4.672,67",
  });
  const periodo = linhas.find((l) => l.rotulo === "Período")?.valor;
  assert.equal(periodo, "10/01/2027 a 22/02/2027 (43 dias)");
});

test("E599: o e-mail da proposta usa dataDeSaida, não o fim inclusivo", () => {
  const fonte = readFileSync(new URL("./data/propostas-actions.ts", import.meta.url), "utf8");
  const corpo = fonte.slice(fonte.indexOf("function dadosDoEmailDaProposta"), fonte.indexOf("import { registrarDocumento }"));
  assert.match(corpo, /saida:\s*dataDeSaida\(/);
  assert.doesNotMatch(corpo, /saida:\s*periodo\.fim/);
});

/*
  E599 reprovado na prova ao vivo (05/11, ORC-2026-0010): o e-mail lido dizia "Período: 10/01/2027 a 21/02/2027 (43 dias)".
  A proposta foi criada às 15:47 UTC, antes de o #2749 entrar (16:33 UTC) — saiu pelo modelo velho. Conferidos os demais
  e-mails do fluxo que imprimem período: o do CONTRATO (pronto para assinar e assinado) tinha a mesma divergência — imprimia
  o fim inclusivo dos blocos (a última noite). Agora todos dizem a saída real.
*/
import { encadearDatas, periodoDosBlocos } from "./contrato-blocos.ts";
import { linhasContrato, saidaDepoisDaUltimaNoite } from "./notifications/dados-negociacao.ts";
import { linhasCandidatura } from "./notifications/dados-candidatura.ts";

test("E599: a saída depois da última noite é o dia seguinte; vazio/inválido → vazio", () => {
  assert.equal(saidaDepoisDaUltimaNoite("2027-02-21"), "2027-02-22");
  assert.equal(saidaDepoisDaUltimaNoite("2026-12-31"), "2027-01-01");
  assert.equal(saidaDepoisDaUltimaNoite(""), "");
  assert.equal(saidaDepoisDaUltimaNoite(null), "");
});

test("E599→E671: e-mail do contrato da estadia de 43 dias (10/01/2027) diz o fim gravado, 21/02/2027, como a página do contrato", () => {
  const blocos = encadearDatas("2027-01-10", [{ meses: 2, dias: 43 } as never]);
  const { inicio, fim } = periodoDosBlocos(blocos);
  assert.equal(fim, "2027-02-21"); // a última noite, como gravado nos blocos
  const l = linhasContrato({ imovel: { titulo: "Apto" }, inicio: inicio!, fim: fim!, meses: 2, valorMensal: 3260, dias: 43 });
  assert.equal(l.find((x) => x.rotulo === "Período")?.valor, "10/01/2027 a 21/02/2027 (43 dias)");
  assert.equal(diasDaSelecao({ entrada: "2027-01-10", saida: "2027-02-22" }), 43);
});

test("E599: proposta e candidatura da mesma estadia imprimem a MESMA saída (22/02/2027); o contrato segue o fim gravado (E671)", () => {
  const prop = linhasProposta({ numero: "ORC-2026-0010", imovel: { titulo: "Apto" }, entrada: "2027-01-10", saida: dataDeSaida("2027-01-10", 43), meses: 2, dias: 43, valorMensal: 3260, contaTotal: "x" });
  const contr = linhasContrato({ imovel: { titulo: "Apto" }, inicio: "2027-01-10", fim: "2027-02-21", meses: 2, valorMensal: 3260, dias: 43 });
  const cand = linhasCandidatura({ imovel: { titulo: "Apto" }, interessado: "Ana", entrada: "2027-01-10", saida: "2027-02-22", valorMensal: 3260, totalMensal: 3260 } as never);
  assert.match(prop.find((x) => x.rotulo === "Período")!.valor, /a 22\/02\/2027 \(43 dias\)/);
  assert.match(contr.find((x) => x.rotulo === "Período")!.valor, /a 21\/02\/2027 \(43 dias\)/);
  assert.equal(cand.find((x) => x.rotulo === "Saída")!.valor, "22/02/2027 (43 dias)");
});

test("E599: o e-mail de assinatura passa os dias da estadia (não arredonda 43 dias para meses)", () => {
  const fonte = readFileSync(new URL("./data/contrato-assinar-actions.ts", import.meta.url), "utf8");
  assert.match(fonte, /linhasContrato\(\{[^}]*dias: Number\(c\.prazo_total_dias/);
});
