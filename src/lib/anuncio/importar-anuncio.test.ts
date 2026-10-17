/*
  Ordem 4c178768 (Pacote FF 3/3) — "Importar meu anúncio": parser do texto colado pelo dono.
  Roda: node --test src/lib/anuncio/importar-anuncio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { organizarAnuncio, AVISO_CONTEUDO_PROPRIO, LIMITE_TEXTO_IMPORTAR } from "./importar-anuncio.ts";

const EXEMPLO_1 = `Apartamento mobiliado no Santa Mônica
Lindo apartamento com 2 quartos, 1 banheiro e 65 m², varanda e 1 vaga de garagem.
Cozinha equipada, máquina de lavar, ar-condicionado e internet fibra.
Prédio com piscina, academia, elevador e portaria 24h.
Aceita pets de pequeno porte. Não é permitido fumar.
Valor: R$ 2.800 por mês`;

const EXEMPLO_2 = `Studio perto da UFU
Studio com 1 quarto e 28m2, mesa de trabalho e ambiente silencioso.
Possui lavanderia compartilhada e bicicletário. Sem pets. Pode fumar? Não.`;

test("exemplo 1: título, tipo, quartos, banheiros, área, vagas, comodidades e regras", () => {
  const r = organizarAnuncio(EXEMPLO_1);
  assert.equal(r.titulo, "Apartamento mobiliado no Santa Mônica");
  assert.equal(r.tipo, "apartamento");
  assert.equal(r.quartos, 2);
  assert.equal(r.banheiros, 1);
  assert.equal(r.areaM2, 65);
  assert.equal(r.vagas, 1);
  for (const k of ["varanda", "vaga_garagem", "cozinha_equipada", "maquina_lavar", "ar_condicionado", "internet_fibra", "piscina", "academia", "elevador", "portaria_24h"]) {
    assert.ok(r.comodidades.includes(k), `faltou ${k}`);
  }
  assert.equal(r.aceitaPet, true);
  assert.equal(r.permiteFumar, false);
  assert.match(r.descricao, /2 quartos/);
});

test("exemplo 2: studio, 1 quarto, 28m2, sem pet e sem fumar", () => {
  const r = organizarAnuncio(EXEMPLO_2);
  assert.equal(r.tipo, "studio");
  assert.equal(r.quartos, 1);
  assert.equal(r.areaM2, 28);
  assert.equal(r.aceitaPet, false);
  assert.equal(r.permiteFumar, false);
  assert.deepEqual([...r.comodidades].sort(), ["ambiente_silencioso", "bicicletario", "lavanderia", "mesa_trabalho"]);
});

test("o que não está no texto fica vazio: nada é inventado", () => {
  const r = organizarAnuncio("Casa boa para morar.");
  assert.equal(r.quartos, null);
  assert.equal(r.banheiros, null);
  assert.equal(r.areaM2, null);
  assert.equal(r.aceitaPet, null);
  assert.equal(r.permiteFumar, null);
  assert.deepEqual(r.comodidades, []);
  assert.equal(r.tipo, "casa");
});

test("não copia telefone, e-mail, link nem endereço com número para o texto", () => {
  const r = organizarAnuncio(
    "Apartamento 1 quarto. Ligue (34) 99999-1234 ou joao@exemplo.com, veja https://site.com/anuncio/1. Rua das Flores, 123, ap 4."
  );
  assert.doesNotMatch(r.descricao, /99999|joao@|https?:|Rua das Flores/);
  assert.equal(r.avisos.length > 0, true);
});

test("texto vazio, lixo e texto enorme não quebram", () => {
  assert.equal(organizarAnuncio("").titulo, "");
  assert.equal(organizarAnuncio("   \n  ").comodidades.length, 0);
  const grande = organizarAnuncio("x".repeat(LIMITE_TEXTO_IMPORTAR * 3));
  assert.ok(grande.descricao.length <= LIMITE_TEXTO_IMPORTAR);
  assert.equal(organizarAnuncio("<script>alert(1)</script> 2 quartos").descricao.includes("<script>"), false);
});

test("quartos absurdos são ignorados", () => {
  assert.equal(organizarAnuncio("999 quartos").quartos, null);
});

test("aviso 'use apenas conteúdo que é seu' e sem termos proibidos", () => {
  assert.match(AVISO_CONTEUDO_PROPRIO, /apenas conteúdo que é seu/i);
  const fonte = readFileSync(new URL("./importar-anuncio.ts", import.meta.url), "utf8");
  assert.doesNotMatch(AVISO_CONTEUDO_PROPRIO, /aluguel|comissão|vistoria|temporada/i);
  assert.doesNotMatch(fonte, /fetch\(|XMLHttpRequest|axios/); // só texto colado: nunca busca página de terceiros
});
