/*
  E293 (retenção) — as colunas novas das migrações 0317 (wi-fi/recepção/fechadura do condomínio, E661), 0320 (instrução de
  saída, E662), 0323 (notas e etiquetas do par cliente-parceiro, E679-B) e 0325 (termos do avaliador, E682) já estavam em
  tabelas inventariadas, mas a descrição do dado não as citava. Só texto: fase, base e prazo NÃO mudam; nada é apagado.
  Roda: node --test src/lib/minimizacao/e293-inventario-0315-0326.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { INVENTARIO } from "../../config/retencao.ts";

const dado = (origem: string) => INVENTARIO.find((x) => x.origem === origem)!;

test("imovel_instrucoes_chegada cita wi-fi do condomínio, recepção, fechadura e instrução de saída", () => {
  const d = dado("public.imovel_instrucoes_chegada").dado;
  for (const t of ["wi-fi", "senha", "recepção", "fechadura", "instrução única de saída"]) assert.ok(d.includes(t), t);
});

test("parceiro_avaliacoes cita etiquetas, 'recomendaria' e as notas privadas", () => {
  const d = dado("public.parceiro_avaliacoes").dado;
  for (const t of ["etiquetas", "recomendaria", "notas privadas"]) assert.ok(d.includes(t), t);
});

test("avaliadores_credenciamento cita os termos próprios do avaliador", () => {
  const d = dado("public.avaliadores_credenciamento").dado;
  for (const t of ["preço", "prazo de entrega", "prazo de resposta"]) assert.ok(d.includes(t), t);
});
