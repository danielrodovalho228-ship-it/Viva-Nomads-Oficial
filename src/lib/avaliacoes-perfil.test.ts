/* E679 — PR 4: avaliações nos perfis públicos (mockups avaliacoes-perfil-proprietario/-parceiro). Roda: node --test src/lib/avaliacoes-perfil.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notaPorExtenso, resumoDasNotas, TEXTO_NOTAS_ENTRE_PARCEIROS } from "./avaliacoes-perfil.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("resumo por critério: média de 1 decimal só com quem avaliou aquele critério, na ordem do par", () => {
  const r = resumoDasNotas("morador_avalia_dono", [
    { imovel_como_anuncio: 5, limpeza_chegada: 4, comunicacao: 5 },
    { imovel_como_anuncio: 4, limpeza_chegada: 5, comunicacao: 5 },
    { imovel_como_anuncio: 5 },
    null,
    {},
  ]);
  assert.deepEqual(r.map((x) => x.rotulo), ["Imóvel como no anúncio", "Limpeza na chegada", "Comunicação"]);
  assert.deepEqual(r.map((x) => x.media), [4.7, 4.5, 5]);
  assert.deepEqual(r.map((x) => x.n), [3, 2, 2]);
});

test("critério sem nenhuma nota fica sem média (a barra não inventa 0)", () => {
  const r = resumoDasNotas("cliente_avalia_parceiro", [{ qualidade: 5 }]);
  assert.equal(r[0].media, 5);
  assert.equal(r[1].media, null);
  assert.equal(r[2].media, null);
});

test("ignora nota fora de 1 a 5 e chaves de outro par", () => {
  const r = resumoDasNotas("dono_avalia_morador", [{ cuidado_imovel: 9, regras_casa: 4, comunicacao: "x", imovel_como_anuncio: 5 }]);
  assert.deepEqual(r.map((x) => x.media), [null, 4, null]);
});

test("nota por extenso em pt-BR: 4,9 e 5,0", () => {
  assert.equal(notaPorExtenso(4.9), "4,9");
  assert.equal(notaPorExtenso(5), "5,0");
});

test("a nota que o parceiro dá ao cliente NUNCA entra na página pública (aviso do mockup e leitura só dos clientes)", () => {
  assert.equal(TEXTO_NOTAS_ENTRE_PARCEIROS("LimpaLar"), "As notas que a LimpaLar dá aos clientes são visíveis só entre parceiros e não aparecem aqui.");
  const dados = ler("lib/data/parceiros-publico.ts");
  const fn = dados.slice(dados.indexOf("export async function getAvaliacoesDoParceiro"));
  assert.match(fn, /\.eq\("papel_autor", "cliente"\)/);
  assert.match(fn, /\.eq\("status", "publicada"\)/);
  assert.doesNotMatch(fn, /papel_autor", "parceiro"/);
});

test("os dois perfis usam o mesmo bloco de avaliações recebidas com o resumo das notas", () => {
  const comp = ler("components/avaliacoes/perfil-avaliacoes.tsx");
  for (const id of ["perfil-avaliacoes", "perfil-resumo-notas", "perfil-avaliacao", "perfil-resposta"]) assert.ok(comp.includes(`data-testid="${id}"`), id);
  assert.match(ler("app/(public)/proprietario/[id]/page.tsx"), /<PerfilAvaliacoes\b/);
  assert.match(ler("app/(public)/parceiros/[slug]/page.tsx"), /<PerfilAvaliacoes\b/);
});
