/*
  E293 P7 — itens pequenos da auditoria de retenção:
   • o erro da CAF, do Asaas, da ZapSign e da NFS-e não leva mais o corpo da resposta (que pode repetir nome, CPF,
     e-mail) para a mensagem do erro e para o log: só fornecedor, status e o código do erro;
   • ia_chamadas ganha prazo de 90 dias † (fase 2: o relatório simulado conta, nada é apagado nesta rodada);
   • ai_generations e push_envios entram no inventário.
  Roda: node --test src/lib/integrations/erro-fornecedor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { codigoDoErro, erroDoFornecedor } from "./erro-fornecedor.ts";
import { INVENTARIO, SEM_DADO_PESSOAL } from "../../config/retencao.ts";
import { eliminaDeVerdade, planoDoItem, textoPrazo } from "../minimizacao/regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("erro do fornecedor: status e código, nunca o corpo (nome, CPF, e-mail)", () => {
  const corpo = JSON.stringify({ errors: [{ code: "invalid_cpfCnpj", description: "O CPF 111.444.777-35 de Dora Lima é inválido" }] });
  const e = erroDoFornecedor("Asaas", 400, corpo);
  assert.equal(e.message, "Asaas 400 (invalid_cpfCnpj)");
  for (const proibido of ["111", "Dora", "inválido"]) assert.ok(!e.message.includes(proibido), proibido);
  assert.equal(erroDoFornecedor("CAF", 422, '{"code":"DOCUMENT_NOT_FOUND","message":"dora@x.com"}').message, "CAF 422 (DOCUMENT_NOT_FOUND)");
  assert.equal(erroDoFornecedor("ZapSign", 500, "<html>Internal error for maria@x.com</html>").message, "ZapSign 500");
  assert.equal(erroDoFornecedor("NFS-e", 401, '{"error":{"code":"nao_autorizado"}}').message, "NFS-e 401 (nao_autorizado)");
  // Código que parece frase ou dado não passa.
  assert.equal(codigoDoErro('{"code":"CPF 11144477735 inválido"}'), null);
  assert.equal(codigoDoErro('{"code":"11144477735"}'), null);
  assert.equal(codigoDoErro(""), null);
});

test("os quatro clientes usam erroDoFornecedor e não põem o corpo na mensagem", () => {
  for (const [arq, nome] of [
    ["src/lib/integrations/caf.ts", "CAF"],
    ["src/lib/payments/asaas.ts", "Asaas"],
    ["src/lib/integrations/zapsign.ts", "ZapSign"],
    ["src/lib/integrations/nfse.ts", "NFS-e"],
  ] as const) {
    const src = ler(arq);
    assert.match(src, new RegExp(`throw erroDoFornecedor\\("${nome}", res\\.status, await res\\.text\\(\\)\\.catch\\(\\(\\) => ""\\)\\)`), arq);
    assert.doesNotMatch(src, /\$\{await res\.text\(\)\}|\$\{body\}/, `${arq}: corpo da resposta na mensagem`);
  }
});

test("inventário: ia_chamadas com 90 dias † em modo simulado; ai_generations e push_envios declarados", () => {
  const ia = INVENTARIO.find((x) => x.id === "ia_chamadas")!;
  assert.ok(ia, "ia_chamadas no inventário");
  assert.equal(ia.prazoDias, 90);
  assert.equal(ia.gatilho, "criacao");
  assert.equal(eliminaDeVerdade(ia), false, "nada é apagado de verdade nesta rodada");
  assert.equal(textoPrazo(ia), "90 dias depois de criado †");
  assert.ok(!("ia_chamadas" in SEM_DADO_PESSOAL));
  // O relatório conta a linha de 91 dias e nunca a manda apagar.
  const agora = new Date("2026-11-01T12:00:00Z");
  const plano = planoDoItem(ia, [{ ref: "a", desde: "2026-08-01T12:00:00Z" }, { ref: "b", desde: "2026-10-01T12:00:00Z" }], agora);
  assert.equal(plano.quantidade, 1);
  assert.deepEqual(plano.eliminar, []);
  for (const id of ["ai_generations", "push_envios"]) assert.ok(INVENTARIO.some((x) => x.id === id && x.origem === `public.${id}`), id);
  assert.match(ler("src/lib/minimizacao/servidor.ts"), /ia_chamadas: \{\n\s*async candidatos\(admin\)/);
});
