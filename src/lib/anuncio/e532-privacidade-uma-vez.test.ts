/*
  E532 (parte 1) — no anúncio, o que o anunciante declarou sobre câmeras e acesso aparecia DUAS vezes: na janela
  "Segurança" do "Bom saber" (proteções da Viva + as linhas declaradas) e no bloco "Privacidade" logo abaixo (as mesmas
  linhas, com ícone). Agora as linhas declaradas ficam só no bloco "Privacidade"; a janela "Segurança" traz as
  proteções da Viva e aponta o bloco. O resumo de uma linha do "Bom saber" continua dizendo o que foi declarado.
  Sem declaração (o bloco não aparece), a janela segue convidando a perguntar pelo chat.
  Roda: node --test src/lib/anuncio/e532-privacidade-uma-vez.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROTECOES_VIVA, SEGURANCA_SEM_DECLARACAO, VER_BLOCO_PRIVACIDADE, linhasBomSaber } from "./resumos-imovel.ts";
import { linhasPrivacidadePublica } from "./privacidade.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";

test("com declaração: a janela não repete as linhas do bloco Privacidade, aponta para ele", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const seg = linhasBomSaber(p)[2];
    const bloco = linhasPrivacidadePublica(p.privacidade, p.chegadaEPedido?.tipoEntrada);
    assert.ok(bloco.length > 0, p.id);
    for (const l of bloco) assert.ok(!seg.detalhe.includes(l), `${p.id}: "${l}" repetida`);
    assert.deepEqual(seg.detalhe, [...PROTECOES_VIVA, VER_BLOCO_PRIVACIDADE]);
    assert.match(seg.resumo, /Sem câmeras no interior/, "o resumo de uma linha segue dizendo o declarado");
  }
});

test("sem declaração: a janela segue convidando a perguntar (não há bloco para apontar)", () => {
  const p = { ...SAMPLE_PROPERTIES[0], privacidade: undefined, chegadaEPedido: undefined };
  assert.deepEqual(linhasBomSaber(p)[2].detalhe, [...PROTECOES_VIVA, SEGURANCA_SEM_DECLARACAO]);
});
