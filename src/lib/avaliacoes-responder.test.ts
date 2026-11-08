/* E679 — PR 3: "Responder à avaliação" (mockups avaliacoes-responder-*). Roda: node --test src/lib/avaliacoes-responder.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hrefResponder, linhaContextoResposta, mesEAno, TEXTO_UMA_RESPOSTA } from "./avaliacoes-responder.ts";
import { REGRAS_AVALIACOES } from "./avaliacoes-exibicao.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("o texto público diz que o AVALIADO responde (não só o proprietário), uma vez, sem editar", () => {
  const r = REGRAS_AVALIACOES.find((x) => /respond/i.test(x)) ?? "";
  assert.match(r, /avaliado responde/i);
  assert.match(r, /uma vez/i);
  assert.doesNotMatch(r, /O proprietário pode responder/);
});

test("aviso do mockup: UMA resposta, sem editar nem apagar", () => {
  assert.equal(TEXTO_UMA_RESPOSTA, "Você tem direito a UMA resposta pública. Depois de publicar, não dá para editar nem apagar — revise antes de enviar.");
});

test("mês e ano e a linha de contexto, como no mockup", () => {
  assert.equal(mesEAno("2026-11-12T15:00:00Z"), "novembro de 2026");
  assert.equal(mesEAno(null), "");
  assert.equal(
    linhaContextoResposta({ imovelTitulo: "Apartamento mobiliado, Santa Mônica", cidade: null, publicadaEm: "2026-11-12T15:00:00Z" }),
    "Avaliação da sua estadia em Apartamento mobiliado, Santa Mônica, publicada em 12 de novembro",
  );
  assert.equal(linhaContextoResposta({ imovelTitulo: null, cidade: null, publicadaEm: "2026-11-12T15:00:00Z" }), "Avaliação da sua estadia, publicada em 12 de novembro");
  assert.equal(linhaContextoResposta({ imovelTitulo: null, cidade: null, publicadaEm: null }), "Avaliação da sua estadia");
});

test("endereço da página de responder", () => {
  assert.equal(hrefResponder("abc"), "/dashboard/avaliacoes/responder/abc");
});

test("a página e o painel usam a regra de uma resposta, o contador e o link 'Contestar avaliação'", () => {
  const comp = ler("components/avaliacoes/pagina-responder.tsx");
  for (const id of ["responder-texto", "responder-contador", "responder-publicar", "responder-contestar", "responder-aviso"]) assert.ok(comp.includes(`data-testid="${id}"`), id);
  assert.match(comp, /Publicar resposta/);
  assert.match(comp, /Contestar avaliação/);
  assert.match(ler("components/avaliacoes/painel.tsx"), /hrefResponder\(a\.id\)/);
  assert.match(ler("app/(dashboard)/dashboard/avaliacoes/responder/[avaliacaoId]/page.tsx"), /podeResponder\(/);
});
