/*
  E847 (Phoenix RELATORIO-017, A-37): /para-proprietarios não tinha FAQ — a página que vende taxas, caução e prazos terminava
  em "A plataforma cuida do trabalho chato" + rodapé. Agora tem "Perguntas frequentes" com as respostas da FONTE ÚNICA
  (lib/atendimento/faq.ts — as mesmas da Central de Ajuda), nenhuma resposta nova; blocos abertos (regra do E186).
  Roda: node --test src/lib/ajuda/e847-faq-proprietarios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAQ } from "../atendimento/faq.ts";
import { PERGUNTAS_PARA_PROPRIETARIOS, perguntasParaProprietarios } from "./faq-proprietarios.ts";

test("as perguntas existem na fonte única e cobrem custo, caução, publicação e manutenção", () => {
  const ids = new Set(FAQ.map((p) => p.id));
  for (const id of PERGUNTAS_PARA_PROPRIETARIOS) assert.ok(ids.has(id), id);
  for (const id of ["custo-anunciar", "caucao", "anuncio-nao-publica", "manutencao"]) assert.ok(PERGUNTAS_PARA_PROPRIETARIOS.includes(id), id);
  // Perguntas de parceiro/avaliador não são para quem anuncia o imóvel.
  for (const id of ["como-virar-parceiro", "como-ser-avaliador", "taxa-parceria"]) assert.ok(!PERGUNTAS_PARA_PROPRIETARIOS.includes(id), id);
});

test("a resposta é a mesma da Central (visitante), sem texto novo", () => {
  for (const p of perguntasParaProprietarios()) {
    const fonte = FAQ.find((f) => f.id === p.id)!;
    assert.equal(p.pergunta, fonte.pergunta);
    assert.equal(p.resposta, fonte.porPerfil?.visitante ?? fonte.resposta);
  }
});

test("/para-proprietarios desenha o FAQ da fonte única, com blocos abertos (sem acordeão)", () => {
  const pagina = readFileSync(new URL("../../app/(public)/para-proprietarios/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /data-testid="proprietarios-faq"/);
  assert.match(pagina, /perguntasParaProprietarios\(\)/);
  assert.doesNotMatch(pagina.slice(pagina.indexOf('data-testid="proprietarios-faq"')), /<details/);
});
