/*
  E1067 — trava: a duração da estadia lê-se dos DIAS REAIS do contrato. Um contrato de 31 dias guarda "2 meses" de
  referência no bloco (o teto do bloco), e as telas, o recibo e os documentos diziam "Bloco 1 (2 meses: 20/12 a 19/01)"
  para 31 dias pagos a R$ 2.583,33. Passa a dizer "31 dias". Meses inteiros continuam em meses.
  A tela é cobrada pela t1708; aqui a regra pura.
  Roda: node --test src/lib/e1067-duracao-em-dias-reais.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { duracaoDoBloco as duracaoDoBlocoComPrazo, rotuloPagamentoBloco as rotuloComPrazo } from "./pagamento-bloco.ts";
// Fusão (mapa v4, ORDEM-DUET-1140 decisão 3): a duração e o rótulo recebem o prazo do contrato; cada caso diz o dele.
const duracaoDoBloco = duracaoDoBlocoComPrazo as unknown as (b: { numero?: number; meses: number; inicio: string | null; fim: string | null }, prazoTotalDias: number) => ReturnType<typeof duracaoDoBlocoComPrazo>;
const rotuloPagamentoBloco = rotuloComPrazo as unknown as (p: Record<string, unknown>) => string;
import { resumoContratoEmDias } from "./contrato-blocos.ts";
import { valoresDaEstadia } from "./estadia/estadia.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("E1067 — o caso da prova ao vivo: 31 dias a R$ 2.500 é \"31 dias\", não \"2 meses\"", () => {
  const bloco = resumoContratoEmDias(31, 2500, 0.1).blocos[0];
  assert.equal(bloco.meses, 2, "o bloco guarda 2 meses de referência (por isso a tela dizia 2 meses)");
  assert.equal(bloco.valor, 2583.33);
  const b = { numero: 1, meses: bloco.meses, inicio: "2026-12-20", fim: "2027-01-19" };
  assert.deepEqual(duracaoDoBloco(b, 31), { emDias: true, dias: 31, texto: "31 dias", curto: "31 dias" });
  assert.equal(rotuloPagamentoBloco({ tipo: "aluguel", valor: 2583.33, bloco: b, valorMensal: 2500, prazoTotalDias: 31 }), "Bloco 1 (31 dias: 20/12 a 19/01) — R$ 2.583,33");
});

test("E1067 — outros prazos em dias quebrados: 43 e 45 dias", () => {
  assert.equal(duracaoDoBloco({ numero: 1, meses: 2, inicio: "2026-12-20", fim: "2027-01-31" }, 43).texto, "43 dias");
  assert.equal(duracaoDoBloco({ numero: 1, meses: 2, inicio: "2026-12-20", fim: "2027-02-02" }, 45).texto, "45 dias");
  // 31 dias que coincidem com um mês de calendário (01/12 a 31/12): o contrato conta em dias (2 de referência) → 31 dias.
  assert.equal(duracaoDoBloco({ numero: 1, meses: 2, inicio: "2026-12-01", fim: "2026-12-31" }, 31).texto, "31 dias");
});

test("E1067 — meses inteiros continuam em meses (contrato em dias de 30 em 30 e contrato em meses de calendário)", () => {
  // 30 e 60 dias corridos = 1 e 2 meses.
  assert.deepEqual(duracaoDoBloco({ numero: 1, meses: 1, inicio: "2026-12-20", fim: "2027-01-18" }, 30), { emDias: false, dias: 30, texto: "1 mês", curto: "1m" });
  assert.deepEqual(duracaoDoBloco({ numero: 2, meses: 2, inicio: "2026-12-19", fim: "2027-02-16" }, 60), { emDias: false, dias: 60, texto: "2 meses", curto: "2m" });
  // Meses de calendário (contratos antigos): 19/10 a 18/12 são 61 dias corridos e 2 meses.
  assert.equal(duracaoDoBloco({ numero: 1, meses: 2, inicio: "2026-10-19", fim: "2026-12-18" }, 60).texto, "2 meses");
  assert.equal(duracaoDoBloco({ numero: 1, meses: 1, inicio: "2027-02-01", fim: "2027-02-28" }, 30).texto, "1 mês");
});

test("E1067 — sem datas, vale o que o bloco guarda (como antes)", () => {
  assert.deepEqual(duracaoDoBloco({ numero: 1, meses: 2, inicio: null, fim: null }, 60), { emDias: false, dias: null, texto: "2 meses", curto: "2m" });
});

test("E1067 — os rótulos que já existiam não mudam", () => {
  assert.equal(
    rotuloPagamentoBloco({ tipo: "aluguel", valor: 6400, bloco: { numero: 1, meses: 2, inicio: "2026-10-19", fim: "2026-12-18" }, valorMensal: 3200, prazoTotalDias: 60 }),
    "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)",
  );
  assert.equal(rotuloPagamentoBloco({ tipo: "aluguel", valor: 3000, bloco: { numero: 2, meses: 2, inicio: "2026-12-19", fim: "2027-02-16" }, valorMensal: 3200, prazoTotalDias: 60 }), "Bloco 2 (2 meses: 19/12 a 16/02) — R$ 3.000");
  assert.equal(rotuloPagamentoBloco({ tipo: "caucao", valor: 1292, prazoTotalDias: 31 }), "Caução do contrato — R$ 1.292");
});

test("E1067 — a página da estadia diz a conta em dias quando o contrato não fecha em meses", () => {
  const v = { valorMensal: 2500, meses: 1, caucao: 1292, taxa: null };
  assert.equal(valoresDaEstadia({ ...v, dias: 31 }, "inquilino")[0].detalhe, "R$ 2.500,00 × 31 dias ÷ 30 · pago direto ao proprietário");
  // Meses inteiros (60 dias) e contrato sem dias: como antes.
  assert.equal(valoresDaEstadia({ ...v, meses: 2, dias: 60 }, "inquilino")[0].detalhe, "R$ 2.500,00 × 2 meses · pago direto ao proprietário");
  assert.equal(valoresDaEstadia(v, "inquilino")[0].detalhe, "R$ 2.500,00 × 1 mês · pago direto ao proprietário");
});

test("E1067 — as telas leem a duração da mesma função (lista de contratos e página da estadia)", () => {
  const contratos = ler("app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(contratos, /duracaoDoBloco\(\{ numero: bloco\.numeroBloco, meses: bloco\.meses, inicio: bloco\.inicio, fim: bloco\.fim \}, prazoTotalDias\)\.curto/);
  assert.doesNotMatch(contratos, /\(\{bloco\.meses\}m\)/);
  const estadia = ler("lib/data/estadia.ts");
  // Fusão (mapa v4, secção 4, mudança 6): a página da estadia pergunta à fonte única pelo prazo do contrato.
  assert.match(estadia, /dias: estadiaEmDias\(prazoTotalDias\) \? prazoTotalDias : null,/);
});
