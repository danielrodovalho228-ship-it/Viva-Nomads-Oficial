/*
  Prompt 36, item 4 — "Salvo" / "Tentar de novo" no checklist da ficha de parceria.
  Roda: node --test src/lib/parceiros/checklist-estado.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { algumSalvando, comecarSalvar, terminarSalvar, valorExibido, TEXTO_SALVO, TEXTO_TENTAR_DE_NOVO, ERRO_PADRAO_CHECKLIST } from "./checklist-estado.ts";

test("marcar → 'salvando' (valor pedido na tela, quadrados travados) → 'Salvo'", () => {
  let e = comecarSalvar({}, "documento", true);
  assert.equal(algumSalvando(e), true);
  assert.equal(valorExibido(e, "documento", false), true);
  e = terminarSalvar(e, "documento", { ok: true });
  assert.deepEqual(e.documento, { fase: "salvo", valor: true });
  assert.equal(algumSalvando(e), false);
  assert.equal(valorExibido(e, "documento", false), true);
  assert.equal(TEXTO_SALVO, "Salvo");
});

test("erro → volta ao valor do servidor, guarda o pedido para 'Tentar de novo'", () => {
  let e = comecarSalvar({}, "portfolio", true);
  e = terminarSalvar(e, "portfolio", { ok: false, erro: "Sem conexão. Tente de novo." });
  assert.deepEqual(e.portfolio, { fase: "erro", valor: true, erro: "Sem conexão. Tente de novo." });
  assert.equal(valorExibido(e, "portfolio", false), false);
  assert.equal(terminarSalvar(comecarSalvar({}, "x", false), "x", { ok: false }).x.fase, "erro");
  assert.deepEqual(terminarSalvar(comecarSalvar({}, "x", false), "x", { ok: false }).x, { fase: "erro", valor: false, erro: ERRO_PADRAO_CHECKLIST });
  assert.equal(TEXTO_TENTAR_DE_NOVO, "Tentar de novo");
});

test("item sem estado mostra o valor do servidor; um item não mexe no outro", () => {
  const e = comecarSalvar({ documento: { fase: "salvo", valor: true } }, "portfolio", true);
  assert.equal(valorExibido(e, "identidade_manual", true), true);
  assert.deepEqual(e.documento, { fase: "salvo", valor: true });
});

test("a ficha usa o estado por item, com indicador e botão 'Tentar de novo'", () => {
  const f = readFileSync(new URL("../../app/(dashboard)/admin/parceiros/fichas.tsx", import.meta.url), "utf8");
  assert.match(f, /setEstados\(\(e\) => comecarSalvar\(e, chave, valor\)\)/);
  assert.match(f, /setEstados\(\(e\) => terminarSalvar\(e, chave, r\)\)/);
  assert.match(f, /data-testid=\{`check-estado-\$\{chave\}`\}/);
  assert.match(f, /data-testid=\{`check-tentar-\$\{chave\}`\}/);
  assert.match(f, /animate-spin/);
  assert.match(f, /disabled=\{pendente \|\| salvandoChecklist\}/);
});
