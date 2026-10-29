/*
  F32 — o contrato só é gerado com o documento das duas partes e os documentos do
  inquilino. Roda: node --test src/lib/contrato-trava.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { motivoBloqueioContrato } from "./contrato-trava.ts";

const CPF_OK = "52998224725"; // CPF válido de teste
const completo = { person_type: "pf", cpf: CPF_OK };
const semCpf = { person_type: "pf", cpf: null };

test("tudo completo: pode gerar", () => {
  assert.equal(motivoBloqueioContrato({ dono: completo, inquilino: completo, docsInquilinoCompletos: true }), null);
});

test("inquilino sem CPF: bloqueia com 409 e mensagem clara", () => {
  const b = motivoBloqueioContrato({ dono: completo, inquilino: semCpf, docsInquilinoCompletos: true });
  assert.equal(b?.status, 409);
  assert.match(b!.erro, /inquilino ainda não informou/i);
});

test("dono sem CPF: bloqueia", () => {
  const b = motivoBloqueioContrato({ dono: semCpf, inquilino: completo, docsInquilinoCompletos: true });
  assert.equal(b?.status, 409);
  assert.match(b!.erro, /seu CPF/i);
});

test("CPF com dígito verificador errado não vale", () => {
  assert.ok(motivoBloqueioContrato({ dono: completo, inquilino: { person_type: "pf", cpf: "11111111111" }, docsInquilinoCompletos: true }));
});

test("documentos do inquilino não enviados: bloqueia; sem a tabela (null): não trava", () => {
  assert.ok(motivoBloqueioContrato({ dono: completo, inquilino: completo, docsInquilinoCompletos: false }));
  assert.equal(motivoBloqueioContrato({ dono: completo, inquilino: completo, docsInquilinoCompletos: null }), null);
});

test("os DOIS caminhos de geração usam a mesma trava no servidor", () => {
  const serv = readFileSync(new URL("./data/fechamento-servidor.ts", import.meta.url), "utf8");
  const acts = readFileSync(new URL("./data/actions.ts", import.meta.url), "utf8");
  assert.match(serv, /motivoBloqueioContrato\(/);
  const reg = acts.slice(acts.indexOf("export async function registrarContrato"), acts.indexOf("export async function varrerCicloBlocos"));
  assert.match(reg, /motivoBloqueioContrato\(/, "registrarContrato precisa da trava (F32)");
});
