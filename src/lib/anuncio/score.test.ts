import test from "node:test";
import assert from "node:assert/strict";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { scoreAnuncio, contarPalavras } from "./score.ts";

const vazio: FatosAnuncio = {
  enderecoOk: false, detalhesOk: false, periodoOk: false, fotos: 0, titulo: "", preco: 0, garantiaOk: false,
  sublocacaoOk: true, privacidadeOk: true, documento: "none", descricao: "", selo: false, video: false,
};
const palavras = (n: number) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(" ");
const completo: FatosAnuncio = {
  ...vazio, enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 12, titulo: "Studio", preco: 3000, garantiaOk: true,
  documento: "approved", descricao: palavras(40), selo: true, video: true,
};
const calc = (f: FatosAnuncio, x = { comodidades: 0, petsDefinido: false }) => scoreAnuncio(prontidaoAnuncio(f), f, x);

test("anúncio vazio: score 0 e dicas clicáveis (etapa) para tudo", () => {
  const r = calc(vazio);
  assert.equal(r.score, 0);
  assert.ok(r.dicas.length >= 15);
  assert.ok(r.dicas.every((d) => Number.isInteger(d.etapa) && d.etapa >= 0 && d.etapa <= 9)); // E104: documento e sublocação se resolvem na Revisão (9)
});

test("parcial: obrigatórios feitos, qualidade em branco = 70", () => {
  const r = calc({ ...completo, fotos: 8, descricao: palavras(10), selo: false, video: false });
  assert.equal(r.score, 70);
  assert.deepEqual(r.dicas.map((d) => d.key).sort(), ["comodidades", "fotos12", "palavras", "pets", "selo", "video"]);
});

test("completo: 100 e nenhuma dica", () => {
  const r = calc(completo, { comodidades: 5, petsDefinido: true });
  assert.equal(r.score, 100);
  assert.equal(r.dicas.length, 0);
});

test("subir um campo sobe o score; dicas vêm das que mais valem", () => {
  const antes = calc({ ...completo, fotos: 8 }, { comodidades: 0, petsDefinido: false });
  const depois = calc({ ...completo, fotos: 8 }, { comodidades: 6, petsDefinido: false });
  assert.equal(depois.score - antes.score, 6);
  assert.equal(antes.dicas[0].key, "fotos12");
});

test("contarPalavras ignora espaços sobrando", () => {
  assert.equal(contarPalavras("  a  b\nc "), 3);
  assert.equal(contarPalavras(""), 0);
});

test("dicas levam ao passo certo do assistente em 10 passos (t98; mockups cadastro-imovel-01..10)", () => {
  const r = calc({ ...completo, fotos: 8, descricao: palavras(10), selo: false, video: false });
  const etapa = (key: string) => r.dicas.find((d) => d.key === key)?.etapa;
  // 0 Tipo · 1 Fotos · 2 Endereço · 3 Detalhes · 4 Comodidades · 5 Regras · 6 Descrição · 7 Preço · 8 Disponibilidade · 9 Revisão.
  assert.equal(etapa("fotos12"), 1);
  assert.equal(etapa("video"), 1);
  assert.equal(etapa("palavras"), 6);
  assert.equal(etapa("comodidades"), 4);
  assert.equal(etapa("pets"), 5);
  assert.equal(etapa("selo"), 2);
});
