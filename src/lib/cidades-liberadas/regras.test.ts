import test from "node:test";
import assert from "node:assert/strict";
import { cidadeLiberada, mensagemCidadeNaoLiberada, rankingInteresse, validarInteresse, type CidadeLiberada } from "./regras.ts";

const lista: CidadeLiberada[] = [
  { uf: "MG", chave: "uberlandia", cidade: "Uberlândia", liberada: true },
  { uf: "SP", chave: "campinas", cidade: "Campinas", liberada: false },
];

test("cidade liberada ignora acento e caixa; pausada e desconhecida não passam", () => {
  assert.equal(cidadeLiberada(lista, "Uberlândia"), true);
  assert.equal(cidadeLiberada(lista, "UBERLANDIA", "MG"), true);
  assert.equal(cidadeLiberada(lista, "Uberlândia", "SP"), false);
  assert.equal(cidadeLiberada(lista, "Campinas"), false);
  assert.equal(cidadeLiberada(lista, "Goiânia"), false);
  assert.equal(cidadeLiberada(lista, ""), false);
  assert.equal(cidadeLiberada([], "Uberlândia"), false);
});

test("mensagem do convite usa o nome da cidade", () => {
  assert.equal(mensagemCidadeNaoLiberada(" Goiânia "), "A Viva ainda não chegou em Goiânia. Deixe seu interesse e avisamos quando abrir.");
});

test("validarInteresse exige cidade, UF e papel conhecidos", () => {
  const ok = validarInteresse({ cidade: " Goiânia ", uf: "go", papel: "inquilino" });
  assert.deepEqual(ok, { ok: true, uf: "GO", chave: "goiania", cidade: "Goiânia", papel: "inquilino" });
  assert.equal(validarInteresse({ cidade: "G", uf: "GO", papel: "inquilino" }).ok, false);
  assert.equal(validarInteresse({ cidade: "Goiânia", uf: "Goiás", papel: "inquilino" }).ok, false);
  assert.equal(validarInteresse({ cidade: "Goiânia", uf: "GO", papel: "admin" }).ok, false);
  assert.equal(validarInteresse({ cidade: "x".repeat(81), uf: "GO", papel: "inquilino" }).ok, false);
});

test("ranking soma proprietários e inquilinos por cidade e ordena pelo total", () => {
  const r = rankingInteresse([
    { uf: "GO", chave: "goiania", cidade: "Goiânia", papel: "inquilino" },
    { uf: "SP", chave: "campinas", cidade: "Campinas", papel: "proprietario" },
    { uf: "GO", chave: "goiania", cidade: "Goiânia", papel: "proprietario" },
    { uf: "GO", chave: "goiania", cidade: "Goiânia", papel: "inquilino" },
  ]);
  assert.deepEqual(r.map((c) => [c.cidade, c.proprietarios, c.inquilinos, c.total]), [["Goiânia", 1, 2, 3], ["Campinas", 1, 0, 1]]);
});
