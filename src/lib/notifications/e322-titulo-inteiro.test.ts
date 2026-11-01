import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { imovelDoCorpo } from "./caixa-teste.ts";
import { tituloNoAssunto } from "./assuntos.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const LONGO = "[TESTE QA] Apto mobiliado 2 quartos – Santa Mônica com varanda";

test("E322: a caixa de teste lê o nome inteiro do imóvel do corpo (o assunto continua encurtado)", () => {
  assert.ok(tituloNoAssunto(LONGO).endsWith("…"), "o assunto do e-mail segue a regra dos 40 caracteres");
  const corpo = `Olá Ana,\nRecebemos sua proposta.\nImóvel: ${LONGO} · Santa Mônica, Uberlândia\nValor mensal: R$ 3.200\n`;
  assert.equal(imovelDoCorpo(corpo), `${LONGO} · Santa Mônica, Uberlândia`);
  assert.equal(imovelDoCorpo("Sem a linha do imóvel"), null);
  assert.equal(imovelDoCorpo(null), null);
  const caixa = ler("components/account/caixa-emails-teste.tsx");
  assert.match(caixa, /data-testid="caixa-email-imovel"/);
  assert.match(caixa, /className="mt-1 break-words text-sm text-ink"/);
});

test("E322: Orçamentos mostra o título inteiro do imóvel (quebra de linha), na tabela e no cartão do celular", () => {
  const o = ler("app/(dashboard)/dashboard/orcamentos/orcamentos-client.tsx");
  assert.doesNotMatch(o, /truncate[^"]*">\{p\.imovel\}/);
  assert.equal((o.match(/data-testid="orcamento-imovel">\{p\.imovel\}/g) ?? []).length, 2);
  assert.match(o, /whitespace-normal break-words px-4 py-3 text-ink" data-testid="orcamento-imovel"/);
});
