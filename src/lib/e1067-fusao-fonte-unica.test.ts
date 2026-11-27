/*
  E1067 — a fusão do #4078 (ORDENS-DUET 1140, 1141, 1148, 1149, 1154, 1155, 1193 e 1194; mapa v4).
  A duração do bloco lê-se da FONTE ÚNICA do dinheiro: duracaoDoBloco(bloco, prazoTotalDias) decide "em dias" pelo prazo
  do CONTRATO (estadiaEmDias), com a mesma condição do fatorDoBloco — contrato contado em dias: todos os blocos em dias;
  sem datas ou em meses: os meses do bloco. Os dias do bloco contam-se com o diasInclusivos (o mesmo do dinheiro).
  As travas da fusão:
   - a regra e os casos do mapa (31, 43, 45, 28, 61 = 30 + 31, 60, meses de calendário, sem datas);
   - num contrato de 61 dias, texto e conta de cada bloco concordam (diz dias exactamente quando o fator cobra por dias);
   - o rótulo tem duas formas: a compacta ("31 dias", as listas) e a com a conta no formato do Fechamento (o recibo e a
     página do contrato), com o mensal no formato dos documentos (ORDEM-DUET-1154);
   - "% 30" de duração só na fonte única (pagamento-componentes.ts): nem em pagamento-bloco.ts nem em estadia/estadia.ts;
   - os sítios levam o prazo_total_dias do contrato, sem recalcular;
   - o resumo assinado não muda: o hash de contratos assinados é o mesmo e o pacote diz "igual ao resumo atual";
   - a linha do recibo na tela "Documentos do contrato": número, TOTAL do registro (ORDEM-DUET-1194) e período em datas,
     sem "mês", "meses" nem "dias" — também em "Recibo em preparação";
   - o recibo já emitido descarrega o ficheiro guardado (nunca é refeito).
  Roda: node --test src/lib/e1067-fusao-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { duracaoDoBloco, rotuloPagamentoBloco } from "./pagamento-bloco.ts";
import { fatorDoBloco } from "./pagamento-componentes.ts";
import { compararHashComResumo, resumoContrato, TEXTO_HASH_DIFERENTE, TEXTO_HASH_IGUAL } from "./contrato-assinar.ts";
import * as linhaRecibo from "./documentos-linha.ts";
import { fonteSemComentarios as semComentarios } from "./fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
type Duracao = (b: { meses: number; inicio: string | null; fim: string | null; numero?: number }, prazoTotalDias: number) => { emDias: boolean; dias: number | null; texto: string; curto: string };
const duracao = duracaoDoBloco as unknown as Duracao;
const rotulo = rotuloPagamentoBloco as unknown as (p: Record<string, unknown>) => string;

// ── a regra ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test("1. contrato de 31 dias, um bloco: \"31 dias\"", () => {
  assert.deepEqual(duracao({ numero: 1, meses: 2, inicio: "2026-12-20", fim: "2027-01-19" }, 31), { emDias: true, dias: 31, texto: "31 dias", curto: "31 dias" });
});

test("2. contratos de 43 e 45 dias", () => {
  assert.equal(duracao({ meses: 2, inicio: "2026-12-20", fim: "2027-01-31" }, 43).texto, "43 dias");
  assert.equal(duracao({ meses: 2, inicio: "2026-12-20", fim: "2027-02-02" }, 45).texto, "45 dias");
});

test("3. contrato de 61 dias em dois blocos (30 + 31): \"30 dias\" e \"31 dias\" — contrato em dias, todos os blocos em dias", () => {
  assert.equal(duracao({ numero: 1, meses: 1, inicio: "2027-03-01", fim: "2027-03-30" }, 61).texto, "30 dias");
  assert.equal(duracao({ numero: 2, meses: 2, inicio: "2027-03-31", fim: "2027-04-30" }, 61).texto, "31 dias");
});

test("4. contrato em dias de 28 (01/02 a 28/02): \"28 dias\", como o dinheiro (28 ÷ 30)", () => {
  assert.equal(duracao({ meses: 1, inicio: "2027-02-01", fim: "2027-02-28" }, 28).texto, "28 dias");
});

test("5. contrato de 60 dias (ou de 2 meses), e meses de calendário num contrato em meses: em meses", () => {
  assert.deepEqual(duracao({ numero: 1, meses: 2, inicio: "2026-12-19", fim: "2027-02-16" }, 60), { emDias: false, dias: 60, texto: "2 meses", curto: "2m" });
  assert.equal(duracao({ meses: 2, inicio: "2026-10-19", fim: "2026-12-18" }, 60).texto, "2 meses");
  assert.equal(duracao({ meses: 1, inicio: "2027-02-01", fim: "2027-02-28" }, 30).texto, "1 mês");
});

test("6. bloco sem datas: os meses do bloco (também num contrato em dias, como o fatorDoBloco)", () => {
  assert.deepEqual(duracao({ meses: 2, inicio: null, fim: null }, 31), { emDias: false, dias: null, texto: "2 meses", curto: "2m" });
});

test("7. (decisão 1) contrato de 61 dias: texto e conta de cada bloco concordam", () => {
  const blocos = [
    { numero: 1, meses: 1, inicio: "2027-03-01", fim: "2027-03-30" },
    { numero: 2, meses: 2, inicio: "2027-03-31", fim: "2027-04-30" },
  ];
  for (const b of blocos) {
    const d = duracao(b, 61);
    const fator = fatorDoBloco(b, 61);
    assert.equal(d.emDias, true, `bloco ${b.numero} em dias`);
    assert.equal(fator, (d.dias as number) / 30, `bloco ${b.numero}: o texto diz ${d.texto} e o fator cobra ${fator}`);
  }
  // E o contrato em meses: o texto diz meses exactamente quando o fator cobra meses.
  const m = { meses: 2, inicio: "2026-10-19", fim: "2026-12-18" };
  assert.equal(duracao(m, 60).emDias, false);
  assert.equal(fatorDoBloco(m, 60), 2);
});

// ── o rótulo: duas formas ───────────────────────────────────────────────────────────────────────────────────────────
const b31 = { numero: 1, meses: 2, inicio: "2026-12-20", fim: "2027-01-19" };
test("8. a forma compacta (listas): \"31 dias\", sem conta", () => {
  assert.equal(rotulo({ tipo: "aluguel", valor: 2583.33, bloco: b31, valorMensal: 2500, prazoTotalDias: 31 }), "Bloco 1 (31 dias: 20/12 a 19/01) — R$ 2.583,33");
});

test("9. a forma com a conta (recibo e página do contrato): a conta ENTRE PARÊNTESES logo depois do valor, como a de meses — sem \"Base de cálculo\" (ORDEM-DUET-1206); N = os dias do bloco", () => {
  const r31 = rotulo({ tipo: "aluguel", valor: 2583.33, bloco: b31, valorMensal: 2500, prazoTotalDias: 31, comConta: true });
  assert.equal(r31, "Bloco 1 (31 dias: 20/12 a 19/01) — R$ 2.583,33 (R$ 2.500,00 × 31 dias ÷ 30)");
  assert.doesNotMatch(r31, /Base de cálculo/);
  assert.doesNotMatch(r31, / · /);
  // Bloco de 30 dias a R$ 2.500 num contrato em dias: os dois formatos na mesma linha (a nota 10.1 do mapa).
  assert.equal(
    rotulo({ tipo: "aluguel", valor: 2500, bloco: { numero: 1, meses: 1, inicio: "2027-03-01", fim: "2027-03-30" }, valorMensal: 2500, prazoTotalDias: 61, comConta: true }),
    "Bloco 1 (30 dias: 01/03 a 30/03) — R$ 2.500 (R$ 2.500,00 × 30 dias ÷ 30)",
  );
});

test("10. em meses, as duas formas como antes: \"(2 × R$ 3.200)\"", () => {
  const b = { numero: 1, meses: 2, inicio: "2026-10-19", fim: "2026-12-18" };
  const esperado = "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)";
  assert.equal(rotulo({ tipo: "aluguel", valor: 6400, bloco: b, valorMensal: 3200, prazoTotalDias: 60 }), esperado);
  assert.equal(rotulo({ tipo: "aluguel", valor: 6400, bloco: b, valorMensal: 3200, prazoTotalDias: 60, comConta: true }), esperado);
});

test("11. o registro complementar e a caução não ganham conta", () => {
  assert.equal(rotulo({ tipo: "aluguel", valor: 0, bloco: b31, parte: 2, total: 560, prazoTotalDias: 31, comConta: true }), "Bloco 1, registro complementar (31 dias: 20/12 a 19/01) — R$ 560");
  assert.equal(rotulo({ tipo: "caucao", valor: 1292, prazoTotalDias: 31, comConta: true }), "Caução do contrato — R$ 1.292");
});

// ── o código ────────────────────────────────────────────────────────────────────────────────────────────────────────
test("12. \"% 30\" de duração só na fonte única", () => {
  assert.equal((semComentarios(ler("lib/pagamento-componentes.ts")).match(/% 30/g) ?? []).length, 1, "a estadiaEmDias");
  assert.equal((semComentarios(ler("lib/pagamento-bloco.ts")).match(/% 30/g) ?? []).length, 0, "pagamento-bloco.ts");
  assert.equal((semComentarios(ler("lib/estadia/estadia.ts")).match(/% 30/g) ?? []).length, 0, "estadia/estadia.ts");
  const pb = semComentarios(ler("lib/pagamento-bloco.ts"));
  assert.match(pb, /estadiaEmDias\(prazoTotalDias\)/);
  assert.match(pb, /diasInclusivos\(/);
  assert.doesNotMatch(pb, /mesesDeCalendario|diasCorridos/);
  assert.match(semComentarios(ler("lib/estadia/estadia.ts")), /estadiaEmDias\(v\.dias\)/);
});

test("13. os sítios levam o prazo_total_dias do contrato (sem recalcular)", () => {
  const cc = ler("app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(cc, /duracaoDoBloco\(\{ numero: bloco\.numeroBloco, meses: bloco\.meses, inicio: bloco\.inicio, fim: bloco\.fim \}, prazoTotalDias\)\.curto/);
  const acoes = ler("lib/data/contratos-actions.ts");
  assert.match(acoes, /toPagamento\(pg, Number\(c\.aluguel_mensal\), Number\(c\.prazo_total_dias\)\)/);
  // Cada leitura de contratos que alimenta o toPagamento traz o prazo_total_dias (a lista da moradora não o lia: NaN →
  // "2 meses" no "Pagamentos para confirmar" de um contrato de 31 dias — t1708, caso 2).
  const leituras = acoes.match(/\.select\(`[^`]*pagamentos_bloco\(\*, contrato_blocos\(numero_bloco[^`]*`\)/g) ?? [];
  assert.ok(leituras.length >= 2, "as leituras da lista do dono e da moradora");
  for (const sel of leituras) assert.match(sel, /prazo_total_dias|\$\{COLUNAS_CONTRATO_PARTES\}/, sel.slice(0, 90));
  assert.match(acoes, /COLUNAS_CONTRATO_PARTES =\s*"[^"]*prazo_total_dias/);
  const emitir = ler("lib/fiscal/emitir.ts");
  assert.match(emitir, /contratos\(aluguel_mensal, prazo_total_dias\)/);
  assert.match(emitir, /prazoTotalDias: Number\(contrato\?\.prazo_total_dias\)/);
  assert.match(emitir, /comConta: true/);
  const estadia = ler("lib/data/estadia.ts");
  // ORDEM-DUET-1202 (nota da Pista 3): o prazo_total_dias DENTRO da string das colunas (a interface também o tem).
  assert.match(estadia, /COLUNAS_ESTADIA =\s*"[^"]*\bprazo_total_dias\b[^"]*"/);
  assert.match(estadia, /dias: estadiaEmDias\(prazoTotalDias\) \? prazoTotalDias : null,/);
  assert.doesNotMatch(estadia, /duracaoDoBloco/);
  const lembrete = ler("lib/estadia/lembrete-bloco.ts");
  assert.match(lembrete, /prazoTotalDias: o\.prazoTotalDias/);
  // ORDEM-DUET-1202 (D5d): o servidor do lembrete LÊ a coluna (sem ela, o prazo vira 0 e o e-mail de 31 dias diz "2 meses").
  const lembreteServidor = ler("lib/estadia/lembrete-bloco-servidor.ts");
  assert.match(lembreteServidor, /const COLUNAS =\s*"[^"]*\bprazo_total_dias\b[^"]*"/);
  assert.match(lembreteServidor, /prazoTotalDias: Number\(c\.prazo_total_dias\)/);
});

test("14. o resumo assinado não muda: o mesmo hash e \"igual ao resumo atual\" (31, 61 e 60 dias)", () => {
  const base = { imovel: "Studio da Estadia", aluguelMensal: 2500, ocupantes: 1, criadoEm: "2026-12-01T15:00:00Z" };
  const casos: [Record<string, unknown>, string][] = [
    [{ ...base, contratoId: "VN-CT-E1067031", prazoDias: 31, inicioEstadia: "2026-12-20" }, "63320fbf16c25c2a68de7fdded414410a98b8a734c6858f3130f5dea633acd33"],
    [{ ...base, contratoId: "VN-CT-E1067061", prazoDias: 61, inicioEstadia: "2027-03-01" }, "a6978b054a9761a5e7ba3ffc5c1434f1ae9c5d71f62eb0b3be270897e9bde79a"],
    [{ ...base, contratoId: "VN-CT-E1067060", aluguelMensal: 3200, prazoDias: 60, inicioEstadia: "2026-10-19" }, "4cda1ac91545de639e74210e86290e556689f75fc8708b20c09c9533024c915c"],
  ];
  for (const [d, hash] of casos) {
    const c = compararHashComResumo(resumoContrato(d as unknown as Parameters<typeof resumoContrato>[0]), hash);
    assert.equal(c.texto, TEXTO_HASH_IGUAL, String(d.contratoId));
    assert.notEqual(c.texto, TEXTO_HASH_DIFERENTE);
  }
});

type Linha = (r: { tipo: string; numero: string | null; total: number; inicio: string | null; fim: string | null }) => string;
const textoLinhaRecibo = (linhaRecibo as unknown as { textoLinhaRecibo?: Linha }).textoLinhaRecibo;

test("15. a linha do recibo em \"Documentos do contrato\": número, TOTAL do registro e período em datas — sem mês, meses nem dias", () => {
  assert.equal(typeof textoLinhaRecibo, "function");
  const linhas = [
    textoLinhaRecibo!({ tipo: "aluguel", numero: "REC-2026-000123", total: 3143.33, inicio: "2026-12-20", fim: "2027-01-19" }),
    textoLinhaRecibo!({ tipo: "aluguel", numero: null, total: 6400, inicio: "2026-10-19", fim: "2026-12-18" }),
    textoLinhaRecibo!({ tipo: "caucao", numero: "CAU-2026-000010", total: 1292, inicio: null, fim: null }),
  ];
  assert.deepEqual(linhas, [
    // E1233 (ORDEM-DUET 1208, asserção alterada): período dd/mm sem ano; sem bloco, a caução é "do contrato".
    "REC-2026-000123 · R$ 3.143,33 · 20/12 a 19/01",
    "Recibo em preparação · R$ 6.400,00 · 19/10 a 18/12",
    "CAU-2026-000010 · Caução do contrato · R$ 1.292,00",
  ]);
  for (const l of linhas) assert.doesNotMatch(l, /\bm[eê]s(es)?\b|\bdias?\b/i, l);
});

test("16. (ORDEM-DUET-1194) o valor da linha é o TOTAL lido pela fonte única (componentesDoPagamento), e a tela usa a linha", () => {
  const acoes = ler("lib/data/documentos-actions.ts");
  assert.match(acoes, /componentesDoPagamento\(/);
  assert.match(acoes, /encargos/);
  assert.doesNotMatch(acoes, /rotuloPagamentoBloco/);
  const tela = ler("components/documentos/documentos-contrato.tsx");
  assert.match(tela, /textoLinhaRecibo\(/);
  assert.doesNotMatch(tela, /\{r\.rotulo\}/);
});

test("17. o recibo já emitido descarrega o ficheiro guardado (nunca é refeito)", () => {
  const rota = ler("app/api/documentos/[id]/route.ts");
  assert.match(rota, /select\("pdf_path"\)/);
  assert.match(rota, /urlAssinadaDoDocumento\(doc\.pdf_path/);
  assert.doesNotMatch(rota, /gerarPdf|conteudoDocumento|rotuloPagamentoBloco/);
});
