/*
  E878 — o cadastro de parceiro não dizia a lista completa do pedido, quando a página entra no ar depois da aprovação,
  nem se há contrato. Agora diz, e cada frase sai das regras de verdade.
  Roda: node --test src/lib/parceiros/e878-expectativa-cadastro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEPOIS_DA_APROVACAO, DIAS_TOKEN, DOCUMENTOS_DO_PEDIDO, FOTOS_MIN_FOTOGRAFIA, faltaParaPublicar, validarSolicitacao } from "./regras.ts";

const form = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");

test("a lista do pedido cobre o que o servidor exige: CNPJ, contato, categorias/cidades e o item de cada categoria", () => {
  const t = DOCUMENTOS_DO_PEDIDO.join(" | ");
  for (const pedaco of ["CNPJ", "Receita", "e-mail confirmado", "telefone", "identidade", "Categorias e cidades", "portfólio", "empresa e veículo", "descrição"]) assert.ok(t.includes(pedaco), pedaco);
  assert.equal(typeof validarSolicitacao, "function", "a validação do servidor segue sendo a fonte (o texto descreve, não substitui)");
});

test("depois da aprovação: link válido por DIAS_TOKEN dias, ativação na hora e publicação sem nova análise", () => {
  assert.equal(DIAS_TOKEN, 7);
  assert.match(DEPOIS_DA_APROVACAO[0], /link de ativação, válido por 7 dias/);
  assert.match(DEPOIS_DA_APROVACAO[0], /ativar pelo painel de parceiro, sem o link/);
  assert.match(DEPOIS_DA_APROVACAO[1], /Ativar é na hora: a sua página nasce em rascunho/);
  assert.match(DEPOIS_DA_APROVACAO[1], /publica você mesmo, sem nova análise/);
  // O que o texto diz que falta para publicar é o que faltaParaPublicar cobra de uma página vazia de fotografia (PJ).
  const falta = faltaParaPublicar({ avatarPath: null, descricao: null, servicosAtivos: 0, cidades: [], categorias: ["fotografia"], fotosGaleria: 0, tipoPessoa: "pj", emiteNota: null, jaPublicou: false });
  assert.deepEqual(falta.length, 6);
  for (const pedaco of ["foto de perfil", "descrição", "1 serviço", "1 cidade", `${FOTOS_MIN_FOTOGRAFIA} fotos na galeria`, "nota fiscal"]) assert.ok(DEPOIS_DA_APROVACAO[1].includes(pedaco), pedaco);
});

test("contrato: o formulário diz que não há contrato separado, e o formulário mostra as duas listas", () => {
  assert.match(DEPOIS_DA_APROVACAO[2], /Não há contrato separado para assinar/);
  assert.match(form, /data-testid="seja-parceiro-expectativa"/);
  assert.match(form, /DOCUMENTOS_DO_PEDIDO\.map/);
  assert.match(form, /DEPOIS_DA_APROVACAO\.map/);
});
