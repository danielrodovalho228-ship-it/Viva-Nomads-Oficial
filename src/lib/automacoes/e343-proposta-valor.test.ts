/*
  E343 — o e-mail proposta_vencendo é o da decisão do dono (aceitar, contrapor ou recusar) e não dizia o VALOR. Agora
  o corpo diz o valor mensal e o total do contrato, e o quadro de dados traz "Valor mensal" e "Total do contrato" com a
  mesma conta aberta da tela (precoDaProposta), como os e-mails de proposta do E202.
  Roda: node --test src/lib/automacoes/e343-proposta-valor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoAutomacao } from "./corpo-automacao.ts";

const imovel = { titulo: "[TESTE QA] Automações E289 R", bairro: "Santa Mônica", cidade: "Uberlândia" };

test("o corpo e o quadro da proposta vencendo dizem o valor mensal e o total do contrato", () => {
  const c = corpoAutomacao("proposta_vencendo", {
    imovel,
    numero: "ORC-2026-0009",
    prazo: "2026-11-01T01:00:00Z",
    valorMensal: 2700,
    totalContrato: 13850,
    contaTotal: "4 × R$ 3.350 + preparação R$ 450 = R$ 13.850",
  });
  const corpo = c.body("Daniel");
  assert.match(corpo, /a proposta ORC-2026-0009 de \[TESTE QA\] Automações E289 R, de R\$ 2\.700 por mês \(total do contrato R\$ 13\.850\), aguarda a sua resposta/);
  assert.deepEqual(
    c.linhas.map((l) => l.rotulo),
    ["Imóvel", "Valor mensal", "Total do contrato", "Proposta", "Vence em"],
  );
  assert.equal(c.linhas.find((l) => l.rotulo === "Valor mensal")?.valor, "R$ 2.700");
  assert.equal(c.linhas.find((l) => l.rotulo === "Total do contrato")?.valor, "4 × R$ 3.350 + preparação R$ 450 = R$ 13.850");
});

test("sem valores lidos, o e-mail não inventa: sem 'R$ 0' nem frase quebrada", () => {
  const c = corpoAutomacao("proposta_vencendo", { imovel, numero: "ORC-1", prazo: "2026-11-01T01:00:00Z" });
  const corpo = c.body("Daniel");
  assert.doesNotMatch(corpo, /R\$|, ,/);
  assert.ok(!c.linhas.some((l) => l.rotulo === "Valor mensal" || l.rotulo === "Total do contrato"));
});

test("o cron lê a versão inteira e manda valor mensal, total e a conta aberta (precoDaProposta)", () => {
  const cron = readFileSync(new URL("../../app/api/cron/automacoes/route.ts", import.meta.url), "utf8");
  assert.match(cron, /proposta_versoes\(\$\{COLUNAS_VERSAO\}\)/);
  assert.match(cron, /precoDaProposta\(\{ \.\.\.termosProposta, valorMensal: totProposta\.valorMensal \}\)\.conta/);
  assert.match(cron, /const valoresProposta = \{ valorMensal: totProposta\.valorMensal, totalContrato: totProposta\.totalContrato, contaTotal: contaProposta \};/);
  assert.match(cron, /comFatos\("proposta_vencendo", \{ imovel: [^\n]*\.\.\.valoresProposta, prazo: p\.valida_ate as string \}\)/);
});
