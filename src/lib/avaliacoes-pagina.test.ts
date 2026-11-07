/* E679 — PR 2: a página "Avalie sua estadia / Avalie o morador" (mockups avaliacoes-avaliar-*). Roda: node --test src/lib/avaliacoes-pagina.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hrefPaginaAvaliar, periodoPorExtenso, TEXTOS_AVALIAR } from "./avaliacoes-pagina.ts";

test("morador avalia o proprietário: títulos e perguntas do mockup", () => {
  const t = TEXTOS_AVALIAR.morador_avalia_dono;
  assert.equal(t.pagina, "Avalie sua estadia");
  assert.equal(t.geral, "Como foi, no geral?");
  assert.equal(t.etiquetas, "Tags rápidas");
  assert.equal(t.texto, "Conte para futuros moradores");
  assert.equal(t.recomenda, "Você recomendaria esta estadia?");
  assert.match(t.placeholder, /O que você gostou\?/);
});

test("proprietário avalia o morador: títulos e perguntas do mockup, sem gênero presumido", () => {
  const t = TEXTOS_AVALIAR.dono_avalia_morador;
  assert.equal(t.pagina, "Avalie o morador");
  assert.equal(t.etiquetas, "Destaques da estadia");
  assert.equal(t.texto, "Conte para futuros proprietários");
  assert.equal(t.recomenda, "Você receberia esta pessoa de novo?");
  assert.doesNotMatch(JSON.stringify(t), /moradora|esta morador/i);
});

test("período por extenso, como no mockup: 'Estadia de 12 de agosto a 10 de novembro'", () => {
  assert.equal(periodoPorExtenso("2026-08-12", "2026-11-10"), "Estadia de 12 de agosto a 10 de novembro");
  assert.equal(periodoPorExtenso(null, "2026-11-10"), "");
  assert.equal(periodoPorExtenso("2026-08-12", null), "");
});

test("endereço da página: um por estadia, o mesmo para os dois lados", () => {
  assert.equal(hrefPaginaAvaliar("abc-123"), "/dashboard/avaliacoes/avaliar/abc-123");
});

test("o formulário usa os textos por par e o painel leva 'Avaliar agora' à página", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const form = ler("components/avaliacao-form.tsx");
  assert.match(form, /TEXTOS_AVALIAR\[par\]/);
  for (const id of ['data-testid="avaliacao-geral"', 'data-testid="avaliacao-contador"', 'data-testid="avaliacao-recomenda"']) assert.ok(form.includes(id), id);
  assert.match(ler("components/avaliacoes/painel.tsx"), /hrefPaginaAvaliar\(p\.contratoId\)/);
});
