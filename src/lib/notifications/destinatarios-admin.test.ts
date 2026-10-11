import test from "node:test";
import assert from "node:assert/strict";
import { escolherDestinatarios, type AdminDestino } from "./destinatarios-admin.ts";

const daniel: AdminDestino = { id: "daniel", role: "admin", recebe_avisos_ceo: true, recebe_alertas_operacionais: true };
const rogerio: AdminDestino = { id: "rogerio", role: "admin", recebe_avisos_ceo: false, recebe_alertas_operacionais: true };
const novo: AdminDestino = { id: "novo", role: "admin", recebe_avisos_ceo: false, recebe_alertas_operacionais: false };
const semMarca: AdminDestino = { id: "legado", role: "admin", recebe_avisos_ceo: null, recebe_alertas_operacionais: null };
const dono: AdminDestino = { id: "dono", role: "owner", recebe_avisos_ceo: true, recebe_alertas_operacionais: true };

test("aviso do CEO vai só para quem tem a marca (o Daniel)", () => {
  assert.deepEqual(escolherDestinatarios([daniel, rogerio, novo], "ceo").map((a) => a.id), ["daniel"]);
});

test("admin novo não recebe aviso do CEO nem alerta operacional", () => {
  assert.deepEqual(escolherDestinatarios([novo, semMarca], "ceo"), []);
  assert.deepEqual(escolherDestinatarios([novo, semMarca], "operacional"), []);
});

test("alerta operacional vai para quem ligou, sem dar acesso ao aviso do CEO", () => {
  assert.deepEqual(escolherDestinatarios([daniel, rogerio, novo], "operacional").map((a) => a.id), ["daniel", "rogerio"]);
});

test("quem não é admin nunca recebe, mesmo com a marca ligada", () => {
  assert.deepEqual(escolherDestinatarios([dono], "ceo"), []);
  assert.deepEqual(escolherDestinatarios([dono], "operacional"), []);
});

test("código: nenhum envio usa .eq(\"role\", \"admin\") direto — tudo passa pelo seletor (regressão da ordem 27cfd36a)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["src/lib/agentes/avisos-daniel-servidor.ts", "src/lib/atendimento/servidor.ts", "src/lib/data/actions.ts"]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /\.eq\("role", "admin"\)/, f);
  }
  assert.doesNotMatch(readFileSync("src/lib/agentes/avisos-daniel-servidor.ts", "utf8"), /pushParaAdmins/);
});
