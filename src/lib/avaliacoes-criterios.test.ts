/*
  E679-B — critérios por par, etiquetas, "recomendaria" e a regra "fato falso × caução" (regras PURAS).
  Roda: node --test src/lib/avaliacoes-criterios.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CRITERIOS,
  ETIQUETAS,
  MAX_ETIQUETAS,
  chavesDoPar,
  validarAvaliacaoCompleta,
  validarFatoFalso,
} from "./avaliacoes-criterios.ts";

test("1: cada par tem exatamente os três critérios aprovados, na ordem", () => {
  assert.deepEqual(chavesDoPar("morador_avalia_dono"), ["imovel_como_anuncio", "limpeza_chegada", "comunicacao"]);
  assert.deepEqual(chavesDoPar("dono_avalia_morador"), ["cuidado_imovel", "regras_casa", "comunicacao"]);
  assert.deepEqual(chavesDoPar("cliente_avalia_parceiro"), ["qualidade", "pontualidade", "cuidado_imovel"]);
  assert.deepEqual(chavesDoPar("parceiro_avalia_cliente"), ["comunicacao", "imovel_pronto", "combinado_cumprido"]);
  for (const par of Object.keys(CRITERIOS) as (keyof typeof CRITERIOS)[]) assert.equal(CRITERIOS[par].length, 3);
});

test("2: avaliação completa: nota geral, três critérios, recomendaria e comentário até 500", () => {
  const ok = validarAvaliacaoCompleta("dono_avalia_morador", {
    notaGeral: 5,
    criterios: { cuidado_imovel: 5, regras_casa: 4, comunicacao: 5 },
    etiquetas: [ETIQUETAS.dono_avalia_morador[0]],
    recomendaria: true,
    comentarioPublico: "Cuidou bem da casa.",
  });
  assert.equal(ok.ok, true);
});

test("3: critério faltando, sobrando ou fora de 1 a 5 é recusado", () => {
  const base = { notaGeral: 4, etiquetas: [], recomendaria: true, comentarioPublico: "" };
  assert.equal(validarAvaliacaoCompleta("morador_avalia_dono", { ...base, criterios: { imovel_como_anuncio: 4, limpeza_chegada: 4 } }).ok, false);
  assert.equal(
    validarAvaliacaoCompleta("morador_avalia_dono", { ...base, criterios: { imovel_como_anuncio: 4, limpeza_chegada: 4, comunicacao: 4, outra: 3 } }).ok,
    false,
  );
  assert.equal(validarAvaliacaoCompleta("morador_avalia_dono", { ...base, criterios: { imovel_como_anuncio: 6, limpeza_chegada: 4, comunicacao: 4 } }).ok, false);
  assert.equal(validarAvaliacaoCompleta("morador_avalia_dono", { ...base, criterios: { imovel_como_anuncio: 3.5, limpeza_chegada: 4, comunicacao: 4 } }).ok, false);
});

test("4: critério de outro par não vale (dono não avalia 'limpeza na chegada')", () => {
  const r = validarAvaliacaoCompleta("dono_avalia_morador", {
    notaGeral: 4,
    criterios: { imovel_como_anuncio: 4, limpeza_chegada: 4, comunicacao: 4 },
    etiquetas: [],
    recomendaria: true,
    comentarioPublico: "",
  });
  assert.equal(r.ok, false);
});

test("5: nota geral 1 a 5 inteira; 'recomendaria' é obrigatório; comentário até 500", () => {
  const criterios = { qualidade: 5, pontualidade: 5, cuidado_imovel: 5 };
  const base = { criterios, etiquetas: [], recomendaria: true, comentarioPublico: "" };
  assert.equal(validarAvaliacaoCompleta("cliente_avalia_parceiro", { ...base, notaGeral: 0 }).ok, false);
  assert.equal(validarAvaliacaoCompleta("cliente_avalia_parceiro", { ...base, notaGeral: 5.5 }).ok, false);
  assert.equal(validarAvaliacaoCompleta("cliente_avalia_parceiro", { ...base, notaGeral: 5, recomendaria: null }).ok, false);
  assert.equal(validarAvaliacaoCompleta("cliente_avalia_parceiro", { ...base, notaGeral: 5, comentarioPublico: "a".repeat(501) }).ok, false);
  assert.equal(validarAvaliacaoCompleta("cliente_avalia_parceiro", { ...base, notaGeral: 5, comentarioPublico: "a".repeat(500) }).ok, true);
});

test("6: etiquetas só as da lista do par, sem repetir, no máximo o teto", () => {
  const base = {
    notaGeral: 5,
    criterios: { comunicacao: 5, imovel_pronto: 5, combinado_cumprido: 5 },
    recomendaria: true,
    comentarioPublico: "",
  };
  const lista = ETIQUETAS.parceiro_avalia_cliente;
  assert.equal(validarAvaliacaoCompleta("parceiro_avalia_cliente", { ...base, etiquetas: ["inventada"] }).ok, false);
  assert.equal(validarAvaliacaoCompleta("parceiro_avalia_cliente", { ...base, etiquetas: [lista[0], lista[0]] }).ok, false);
  assert.equal(validarAvaliacaoCompleta("parceiro_avalia_cliente", { ...base, etiquetas: lista.slice(0, MAX_ETIQUETAS + 1) }).ok, false);
  assert.equal(validarAvaliacaoCompleta("parceiro_avalia_cliente", { ...base, etiquetas: lista.slice(0, MAX_ETIQUETAS) }).ok, true);
});

test("7: comentário com telefone/e-mail ou ofensa NÃO é recusado: vai para moderação", () => {
  const r = validarAvaliacaoCompleta("morador_avalia_dono", {
    notaGeral: 2,
    criterios: { imovel_como_anuncio: 2, limpeza_chegada: 2, comunicacao: 3 },
    etiquetas: [],
    recomendaria: false,
    comentarioPublico: "Me liga no (11) 98888-7777, que babaca",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.moderacao, true);
});

test("8: nota baixa legítima passa limpa (sem moderação)", () => {
  const r = validarAvaliacaoCompleta("morador_avalia_dono", {
    notaGeral: 1,
    criterios: { imovel_como_anuncio: 1, limpeza_chegada: 1, comunicacao: 2 },
    etiquetas: [],
    recomendaria: false,
    comentarioPublico: "O imóvel não era como no anúncio e a limpeza estava ruim.",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.moderacao, false);
});

test("9: fato falso vale só para fato que a Viva consegue conferir", () => {
  assert.equal(validarFatoFalso("A estadia nunca aconteceu: o contrato foi cancelado antes da entrada.").ok, true);
  assert.equal(validarFatoFalso("O avaliador não foi ao imóvel no dia combinado, está no registro de ausência.").ok, true);
});

test("10: fato falso NUNCA sobre dano, sujeira, caução ou valor de devolução", () => {
  for (const t of [
    "Ele diz que quebrei a porta, mas isso é mentira e eu não causei dano nenhum.",
    "A casa estava limpa, a sujeira que ele citou não existe de verdade.",
    "O valor da caução descontado não corresponde ao que ele afirmou na avaliação.",
    "Falaram que estraguei o sofá e que o depósito de garantia cobriu o conserto.",
  ]) {
    const r = validarFatoFalso(t);
    assert.equal(r.ok, false, t);
    if (!r.ok) assert.match(r.erro, /caução|conferir/i);
  }
});

test("11: fato falso exige de 20 a 500 caracteres", () => {
  assert.equal(validarFatoFalso("curto demais").ok, false);
  assert.equal(validarFatoFalso("a".repeat(501)).ok, false);
});
