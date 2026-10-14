import { test } from "node:test";
import assert from "node:assert/strict";
import { validarLead, gravarLead, type LeadEmpresa } from "./empresas-lead.ts";

test("lead válido: limpa espaços, e-mail em minúsculas, opcionais viram null", () => {
  const l = validarLead({ nome: "  Ana ", empresa: "Acme", email: " Ana@Acme.COM.BR ", volumeAno: "", mensagem: " oi " });
  assert.deepEqual(l, { nome: "Ana", empresa: "Acme", email: "ana@acme.com.br", volume_ano: null, mensagem: "oi" });
});

test("lead inválido: sem nome, sem empresa, e-mail ruim ou corpo vazio → null", () => {
  assert.equal(validarLead({ empresa: "A", email: "a@b.co" }), null);
  assert.equal(validarLead({ nome: "A", email: "a@b.co" }), null);
  assert.equal(validarLead({ nome: "A", empresa: "B", email: "sem-arroba" }), null);
  assert.equal(validarLead({ nome: 5, empresa: "B", email: "a@b.co" }), null);
  assert.equal(validarLead(null), null);
});

test("mensagem passa de 2000 caracteres: é cortada", () => {
  const l = validarLead({ nome: "A", empresa: "B", email: "a@b.co", mensagem: "x".repeat(3000) });
  assert.equal(l?.mensagem?.length, 2000);
});

test("gravarLead insere em leads_empresas e devolve true", async () => {
  const vistos: { tabela: string; linha: LeadEmpresa }[] = [];
  const admin = { from: (tabela: string) => ({ insert: async (linha: LeadEmpresa) => (vistos.push({ tabela, linha }), { error: null }) }) };
  const lead = validarLead({ nome: "A", empresa: "B", email: "a@b.co" })!;
  assert.equal(await gravarLead(admin, lead), true);
  assert.equal(vistos[0].tabela, "leads_empresas");
  assert.equal(vistos[0].linha.email, "a@b.co");
});

test("gravarLead: sem cliente ou com erro do banco devolve false, sem lançar", async () => {
  const lead = validarLead({ nome: "A", empresa: "B", email: "a@b.co" })!;
  assert.equal(await gravarLead(null, lead), false);
  const ruim = { from: () => ({ insert: async () => ({ error: { message: "x" } }) }) };
  assert.equal(await gravarLead(ruim, lead), false);
});

test("a rota /api/empresas valida, grava, avisa só o Daniel e limita por IP", async () => {
  const { readFileSync } = await import("node:fs");
  const rota = readFileSync(new URL("../app/api/empresas/route.ts", import.meta.url), "utf8");
  assert.match(rota, /validarLead\(/);
  assert.match(rota, /gravarLead\(/);
  assert.match(rota, /pushParaCeo\(/);
  assert.doesNotMatch(rota, /pushParaAdmins/);
  assert.match(rota, /consumirLimite\(/);
});
