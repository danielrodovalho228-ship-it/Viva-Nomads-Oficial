import { test } from "node:test";
import assert from "node:assert/strict";
import { escaparHtml, validarLeadGestor } from "./plano-gestor-lead.ts";

test("lead válido: normaliza e-mail e quantidade", () => {
  const r = validarLeadGestor({ nome: " Ana ", email: "ANA@Ex.com", telefone: "(11) 99999-0000", imoveis: "40" });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.lead, { nome: "Ana", email: "ana@ex.com", telefone: "(11) 99999-0000", imoveis: 40 });
});

test("lead inválido: sem nome, e-mail ruim, quantidade fora do formato", () => {
  assert.equal(validarLeadGestor({ nome: "", email: "a@b.co" }).ok, false);
  assert.equal(validarLeadGestor({ nome: "Ana", email: "ana" }).ok, false);
  assert.equal(validarLeadGestor({ nome: "Ana", email: "a@b.co", imoveis: "1.5" }).ok, false);
  assert.equal(validarLeadGestor({ nome: "Ana", email: "a@b.co", imoveis: 0 }).ok, false);
  assert.equal(validarLeadGestor({ nome: 5, email: {} }).ok, false);
});

test("quantidade é opcional e texto é cortado", () => {
  const r = validarLeadGestor({ nome: "x".repeat(500), email: "a@b.co" });
  assert.equal(r.ok && r.lead.nome.length, 100);
  assert.equal(r.ok && r.lead.imoveis, null);
});

test("escaparHtml neutraliza tags", () => {
  assert.equal(escaparHtml(`<img src=x onerror="a">&`), "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;");
});

test("/precos mostra o botão do Plano Gestor e a rota limita por IP", async () => {
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../../app/(public)/precos/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<PlanoGestorForm \/>/);
  const rota = readFileSync(new URL("../../app/api/plano-gestor/route.ts", import.meta.url), "utf8");
  assert.match(rota, /consumirLimite\(`plano-gestor:ip:/);
  assert.match(readFileSync(new URL("../../components/precos/plano-gestor-form.tsx", import.meta.url), "utf8"), /Falar sobre o Plano Gestor/);
});
