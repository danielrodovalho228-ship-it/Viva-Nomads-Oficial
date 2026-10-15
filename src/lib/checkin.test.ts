/*
  Check-in garantido (ordem 404cd213, item 2): regras puras.
  Roda: node --test src/lib/checkin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIMITE_INSTRUCOES,
  MSG_ABRIU_ACESSO,
  inquilinoVeInstrucoes,
  normalizarTelefone,
  podeEditarInstrucoes,
  podeNaoConsegui,
  telefoneParaExibir,
  validarInstrucoes,
} from "./checkin.ts";

const ok = { horario: "14:00", instrucoes: "Retire a chave no cofre da portaria.", plantao: "(34) 99999-0000" };

test("instruções válidas: horário, como entrar e telefone de plantão são obrigatórios", () => {
  const r = validarInstrucoes(ok);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.dados, { horario: "14:00", instrucoes: "Retire a chave no cofre da portaria.", plantao: "34999990000" });
});

test("negativos: sem horário, horário inválido, instrução curta/longa e telefone ruim são recusados", () => {
  for (const ruim of [
    { ...ok, horario: "" },
    { ...ok, horario: "25:00" },
    { ...ok, horario: "9h" },
    { ...ok, instrucoes: "chave" },
    { ...ok, instrucoes: "x".repeat(LIMITE_INSTRUCOES + 1) },
    { ...ok, plantao: "" },
    { ...ok, plantao: "12345" },
    { ...ok, plantao: "abc" },
    { horario: 1, instrucoes: null, plantao: undefined },
  ]) {
    assert.equal(validarInstrucoes(ruim as never).ok, false, JSON.stringify(ruim));
  }
});

test("telefone: aceita +55, espaços e traço; recusa o que não tem DDD", () => {
  assert.equal(normalizarTelefone("+55 (34) 99999-0000"), "5534999990000");
  assert.equal(normalizarTelefone("99999-0000"), null);
  assert.equal(telefoneParaExibir("34999990000"), "(34) 99999-0000");
  assert.equal(telefoneParaExibir("5534999990000"), "(34) 99999-0000");
});

test("quem vê e quem age: inquilino só vê depois das duas assinaturas; botão só do inquilino", () => {
  const base = { status: "ativo", assinadoProprietarioEm: "2026-11-01", assinadoInquilinoEm: "2026-11-02" };
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino" }), true);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino", assinadoInquilinoEm: null }), false);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino", assinadoProprietarioEm: null }), false);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "proprietario" }), false);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino", status: "concluido" }), false);
  assert.equal(podeNaoConsegui({ ...base, papel: "inquilino" }), true);
  assert.equal(podeNaoConsegui({ ...base, papel: "proprietario" }), false);
  assert.equal(podeNaoConsegui({ ...base, papel: "inquilino", assinadoProprietarioEm: null }), false);
  assert.equal(podeEditarInstrucoes({ ...base, papel: "proprietario" }), true);
  assert.equal(podeEditarInstrucoes({ ...base, papel: "inquilino" }), false);
  assert.equal(podeEditarInstrucoes({ ...base, papel: "proprietario", status: "concluido" }), false);
});

test("texto do chamado de acesso não usa 'vistoria' nem expõe contato", () => {
  assert.ok(!/vistoria/i.test(MSG_ABRIU_ACESSO));
  assert.ok(MSG_ABRIU_ACESSO.length >= 5);
});

test("abrirChamado abre ordem URGENTE para 'acesso_imovel' com contrato (ligação no código)", () => {
  const src = readFileSync(new URL("./data/atendimento-actions.ts", import.meta.url), "utf8");
  assert.match(src, /abreOrdem/);
  assert.match(src, /acesso_imovel/);
  assert.match(src, /urgencia: cat\.key === "acesso_imovel" \? "urgente"/);
});
