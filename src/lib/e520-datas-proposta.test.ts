/*
  E520 (i), reprova de 05/11 — a correção #2496 só pegava a data que não existe (31/02). Ao vivo, no anúncio com
  disponibilidade a partir de 10/01/2027:
    • entrada 10/01/2027 e saída VAZIA → o passo 1 abria sem erro;
    • entrada 05/01/2027 (antes da disponibilidade) → o passo 1 abria sem erro;
    • os campos seguiam "(opcional)".
  Correção: com a janela do anúncio, o resumo exige entrada e saída e confere o período pela MESMA regra do calendário
  de disponibilidade (validarReserva: dentro da disponibilidade, entre o prazo mínimo e o máximo do anúncio, 30 a 180
  dias). Erro na tela e Continuar desligado até corrigir. Os rótulos deixam de dizer "(opcional)".
  Roda: node --test src/lib/e520-datas-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumoSolicitacao } from "./reserva-imovel.ts";

const janela = { availableFrom: "2027-01-10", availableUntil: null, minDias: 30, maxDias: 180 };
const base = { monthlyPrice: 2800, hoje: "2026-11-05", janela };

test("saída vazia (entrada 10/01/2027) acusa erro", () => {
  const r = resumoSolicitacao({ ...base, inicioDesejado: "2027-01-10" });
  assert.match(r.erro ?? "", /Escolha a data de saída/);
});

test("entrada vazia também acusa erro", () => {
  assert.match(resumoSolicitacao({ ...base }).erro ?? "", /Escolha a data de entrada/);
});

test("entrada antes da disponibilidade (05/01/2027) acusa erro com a data de início", () => {
  const r = resumoSolicitacao({ ...base, inicioDesejado: "2027-01-05", fimDesejado: "2027-03-05" });
  assert.match(r.erro ?? "", /antes do início da disponibilidade/);
  assert.match(r.erro ?? "", /10\/01\/2027/);
});

test("fora da janela de 30 a 180 dias (e do prazo do anúncio) acusa erro", () => {
  assert.match(resumoSolicitacao({ ...base, inicioDesejado: "2027-01-10", fimDesejado: "2027-01-25" }).erro ?? "", /mínima de 30 dias/);
  assert.match(resumoSolicitacao({ ...base, inicioDesejado: "2027-01-10", fimDesejado: "2027-08-10" }).erro ?? "", /máxima de 180 dias/);
  const curto = resumoSolicitacao({ ...base, janela: { ...janela, minDias: 60, maxDias: 90 }, inicioDesejado: "2027-01-10", fimDesejado: "2027-02-20" });
  assert.match(curto.erro ?? "", /mínima de 60 dias/);
  // O anúncio que diz mais de 180 não passa do teto vigente.
  const longo = resumoSolicitacao({ ...base, janela: { ...janela, maxDias: 365 }, inicioDesejado: "2027-01-10", fimDesejado: "2027-08-10" });
  assert.match(longo.erro ?? "", /máxima de 180 dias/);
});

test("saída depois do fim da disponibilidade acusa erro", () => {
  const r = resumoSolicitacao({ ...base, janela: { ...janela, availableUntil: "2027-03-01" }, inicioDesejado: "2027-01-10", fimDesejado: "2027-03-20" });
  assert.match(r.erro ?? "", /fim da disponibilidade/);
});

test("período certo passa", () => {
  assert.equal(resumoSolicitacao({ ...base, inicioDesejado: "2027-01-10", fimDesejado: "2027-02-14" }).erro, null);
});

test("a tela passa a janela do anúncio e tira o '(opcional)' das datas", () => {
  const pd = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.match(pd, /janela: \{ availableFrom: property\.availableFrom, availableUntil: property\.availableUntil, minDias: property\.minPeriodDays, maxDias: property\.maxPeriodDays \}/);
  assert.doesNotMatch(pd, /Quando quer entrar\? \(opcional\)/);
  assert.doesNotMatch(pd, /Até quando\? \(opcional\)/);
});
