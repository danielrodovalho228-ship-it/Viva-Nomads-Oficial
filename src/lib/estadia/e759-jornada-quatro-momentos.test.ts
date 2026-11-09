/*
  E759 — jornada de mensagens da estadia: os 4 momentos (confirmação, D-7, chegada, meio) com data determinística, e as
  datas de TODA mensagem saindo de uma fonte só (os blocos da estadia). Sem prova ao vivo.
  Roda: node --test src/lib/estadia/e759-jornada-quatro-momentos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveDaJornada, confirmacaoDevida, corpoDaJornada, datasDaEstadia, momentosDeHoje } from "./jornada-mensagens.ts";

const ALVO = "2026-11-09";
// Família E689 (0328): chegada = entra no ALVO; meio = 60 dias com o meio no ALVO; saída = último dia ALVO+7.
const chegada = { entrada: ALVO, fim: "2026-12-08" };
const meio = { entrada: "2026-10-10", fim: "2026-12-09" };
const d7 = { entrada: "2026-11-16", fim: "2026-12-15" };

test("1. confirmação: estadia CONFIRMADA (assinada + 1º pagamento) e ainda não começou recebe, mesmo assinada há semanas", () => {
  const assinadoHaSemanas = "2026-10-05T15:00:00Z";
  assert.equal(confirmacaoDevida({ assinadoEm: assinadoHaSemanas, hoje: ALVO, pago: true, entrada: chegada.entrada }), true);
  assert.equal(confirmacaoDevida({ assinadoEm: assinadoHaSemanas, hoje: ALVO, pago: false, entrada: chegada.entrada }), false, "sem o 1º pagamento e fora da janela: não");
  assert.equal(confirmacaoDevida({ assinadoEm: assinadoHaSemanas, hoje: "2026-11-20", pago: true, entrada: chegada.entrada }), false, "estadia que já começou não recebe confirmação atrasada");
  assert.equal(confirmacaoDevida({ assinadoEm: "2026-11-08T15:00:00Z", hoje: ALVO }), true, "o caminho antigo (logo após assinar) segue valendo");
  assert.equal(chaveDaJornada("jornada_confirmacao", chegada), "", "chave fixa: uma vez só por morador");
});

test("2. D-7: 7 dias antes da entrada existe como evento da jornada", () => {
  assert.deepEqual(momentosDeHoje({ ...d7, hoje: "2026-11-09" }), ["jornada_d7"]);
  assert.deepEqual(momentosDeHoje({ ...d7, hoje: "2026-11-16" }), ["jornada_chegada"]);
  assert.match(corpoDaJornada("jornada_d7", { ...d7, imovel: { id: "x" } }).texto, /Falta uma semana para a entrada \(16\/11\/2026/);
  assert.notEqual(chaveDaJornada("jornada_d7", d7), chaveDaJornada("jornada_d7", { ...d7, entrada: "2026-11-23" }), "remarcou: reenvia na data nova");
});

test("3. meio da estadia: 60 dias, o meio cai na data certa", () => {
  assert.deepEqual(momentosDeHoje({ ...meio, hoje: ALVO }), ["jornada_meio_estadia"]);
  assert.deepEqual(momentosDeHoje({ entrada: "2026-10-10", fim: "2026-12-08", hoje: ALVO }), [], "59 dias (0327) não tinha meio: a 0328 corrigiu o dado, não o cálculo");
});

test("4. chegada: dispara no dia da entrada que a página mostra (mesma fonte)", () => {
  assert.deepEqual(momentosDeHoje({ ...chegada, hoje: ALVO }), ["jornada_chegada"]);
  assert.deepEqual(momentosDeHoje({ ...chegada, hoje: "2026-11-08" }), [], "um dia antes não dispara");
});

test("5. datas: a página, os e-mails e a jornada leem os blocos pela mesma função (sem bloco não aceito)", () => {
  const blocos = [
    { inicio: "2026-11-09", fim: "2026-12-08", status: "agendado" },
    { inicio: "2026-12-09", fim: "2027-01-07", status: "nao_aceito" },
  ];
  assert.deepEqual(datasDaEstadia(blocos), { entrada: "2026-11-09", fim: "2026-12-08" });
  assert.equal(datasDaEstadia([]), null);
  for (const arq of ["src/app/api/cron/automacoes/route.ts", "src/lib/automacao/servidor.ts", "src/lib/data/estadia-actions.ts"]) {
    assert.match(readFileSync(arq, "utf8"), /datasDaEstadia/, `${arq} usa a fonte única`);
  }
  assert.doesNotMatch(readFileSync("src/app/api/cron/automacoes/route.ts", "utf8"), /blocos\.map\(\(b\) => b\.fim\)\.sort\(\)\.at\(-1\) as string/);
});

test("evento novo registrado onde todo evento precisa estar", () => {
  for (const [arq, re] of [
    ["src/config/matriz-notificacoes.ts", /jornada_d7:/],
    ["src/lib/notifications/eventos-email.ts", /jornada_d7:/],
    ["src/lib/notifications/imagens-email.ts", /jornada_d7:/],
    ["src/lib/automacoes/regras.ts", /"jornada_d7"/],
  ] as const) assert.match(readFileSync(arq, "utf8"), re, arq);
});
