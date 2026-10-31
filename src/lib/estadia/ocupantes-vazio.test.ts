/*
  Estado vazio da lista de ocupantes: diz a quem pode preencher o que fazer e para quê, e a quem não pode o que vai
  aparecer ali — no lugar do genérico "Nenhum ocupante preenchido ainda.".
  Roda: node --test src/lib/estadia/ocupantes-vazio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoOcupantesVazio } from "./ocupantes.ts";

const TELA = readFileSync(new URL("../../app/(dashboard)/dashboard/estadia/[contratoId]/ocupantes/ocupantes-tela.tsx", import.meta.url), "utf8");

test("quem pode editar: o que preencher, o teto do contrato e para que serve", () => {
  assert.equal(
    textoOcupantesVazio({ podeEditar: true, previstos: 3 }),
    "Ninguém na lista ainda. Preencha abaixo quem vai morar no imóvel (até 3 pessoas): a lista para a portaria sai com esses nomes.",
  );
  assert.match(textoOcupantesVazio({ podeEditar: true, previstos: 1 }), /\(1 pessoa\)/);
  assert.match(textoOcupantesVazio({ podeEditar: true, previstos: 0 }), /\(1 pessoa\)/);
});

test("quem não pode editar (dono, ou morador antes da assinatura): o que vai aparecer aqui, sem mandar preencher", () => {
  const t = textoOcupantesVazio({ podeEditar: false, previstos: 2 });
  assert.match(t, /Quando o morador preencher/);
  assert.match(t, /lista para a portaria aparecem aqui/);
  assert.doesNotMatch(t, /Preencha abaixo/);
});

test("a tela usa o texto novo, com testid, e não o genérico", () => {
  assert.doesNotMatch(TELA, /Nenhum ocupante preenchido ainda\./);
  assert.match(TELA, /data-testid="ocupantes-vazio">\{textoOcupantesVazio\(\{ podeEditar, previstos \}\)\}/);
});
