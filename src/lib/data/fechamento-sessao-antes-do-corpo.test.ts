import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem ba271cb5 / #472: visitante sem login recebe 401 mesmo com corpo inválido —
// a sessão é checada antes de validar o leadId (t49).
const fonte = readFileSync("src/lib/data/fechamento-servidor.ts", "utf8");
const corpo = fonte.slice(fonte.indexOf("export async function carregarFechamento"));

test("carregarFechamento checa a sessão antes de validar o leadId", () => {
  const sessao = corpo.indexOf("if (!user) return { status: 401");
  const validacao = corpo.indexOf("UUID_RE.test(leadId)");
  assert.ok(sessao > 0 && validacao > 0, "trechos não encontrados");
  assert.ok(sessao < validacao, "401 deve vir antes do 400");
});

test("/api/comissao e /api/contrato delegam a sessão a carregarFechamento antes de usar o corpo", () => {
  for (const rota of ["comissao", "contrato"]) {
    const src = readFileSync(`src/app/api/${rota}/route.ts`, "utf8");
    const carregar = src.indexOf("carregarFechamento(body.leadId)");
    const guarda = src.indexOf('if ("error" in f) return', carregar);
    const usaCorpo = src.indexOf("body.termMonths", carregar);
    assert.ok(carregar > 0 && guarda > carregar, `${rota}: guarda ausente`);
    if (usaCorpo > 0) assert.ok(guarda < usaCorpo, `${rota}: corpo lido antes da guarda`);
  }
});
