/*
  Erros do banco em pt-BR.
  Roda: node --test src/lib/erros-banco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { erroBancoPT } from "./erros-banco.ts";

test("42501 / 23514 em inglês viram frases em português", () => {
  assert.equal(
    erroBancoPT({ code: "42501", message: 'new row violates row-level security policy for table "properties"' }),
    "Você não tem permissão para esta ação."
  );
  assert.match(
    erroBancoPT({ code: "23514", message: 'new row for relation "contrato_blocos" violates check constraint' }),
    /fora do permitido/
  );
});

test("mensagem dos NOSSOS triggers (português) passa como está", () => {
  assert.equal(
    erroBancoPT({ code: "42501", message: "Documentação do imóvel ainda não aprovada" }),
    "Documentação do imóvel ainda não aprovada"
  );
  assert.equal(
    erroBancoPT({ code: "P0001", message: "Anúncio precisa de pelo menos 8 fotos para ser publicado." }),
    "Anúncio precisa de pelo menos 8 fotos para ser publicado."
  );
});

test("desconhecido em inglês → genérico; nulo → padrão", () => {
  assert.match(erroBancoPT({ code: "XX000", message: "internal error" }), /Não foi possível/);
  assert.equal(erroBancoPT(null, "padrão"), "padrão");
});
