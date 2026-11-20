/*
  E650 — o parceiro PF que JÁ publicou some da busca e não recebe serviço (E648), mas o painel não explicava o porquê nem
  pedia o CNPJ: o faltaParaPublicar só recebia tipoPessoa quando o parceiro ainda NÃO tinha publicado. Correção: a pendência
  PENDENCIA_CNPJ aparece no painel de TODO parceiro com tipo_pessoa ≠ pj, publicado ou não. A pergunta da nota fiscal
  continua sem tirar do ar quem já publicou.
  Roda: node --test src/lib/parceiros/e650-pendencia-cnpj-painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faltaParaPublicar, PENDENCIA_CNPJ } from "./regras.ts";
import { PENDENCIA_NOTA } from "./fiscal.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const completa = { avatarPath: "a.jpg", descricao: "x".repeat(40), servicosAtivos: 1, cidades: ["Curitiba"], categorias: ["limpeza"], fotosGaleria: 0 };

test("já publicou, CPF: a pendência do CNPJ aparece", () => {
  assert.deepEqual(faltaParaPublicar({ ...completa, tipoPessoa: "pf", emiteNota: null, jaPublicou: true }), [PENDENCIA_CNPJ]);
});
test("já publicou, sem tipo registrado: também aparece (≠ pj)", () => {
  assert.deepEqual(faltaParaPublicar({ ...completa, tipoPessoa: null, emiteNota: null, jaPublicou: true }), [PENDENCIA_CNPJ]);
});
test("já publicou, PJ: nada falta; a nota fiscal sem resposta NÃO tira quem já está no ar", () => {
  assert.deepEqual(faltaParaPublicar({ ...completa, tipoPessoa: "pj", emiteNota: null, jaPublicou: true }), []);
});
test("ainda não publicou: CNPJ e nota continuam bloqueando a primeira publicação", () => {
  assert.deepEqual(faltaParaPublicar({ ...completa, tipoPessoa: "pj", emiteNota: null }), [PENDENCIA_NOTA]);
  assert.ok(faltaParaPublicar({ ...completa, tipoPessoa: "pf", emiteNota: null }).includes(PENDENCIA_CNPJ));
});
test("o painel passa tipoPessoa SEMPRE (e marca jaPublicou), em vez de omitir para quem publicou", () => {
  const src = ler("lib/parceiros/painel-actions.ts");
  assert.match(src, /jaPublicou: Boolean\(p\.publicado_em\)/);
  assert.doesNotMatch(src, /\.\.\.\(p\.publicado_em \? \{\}/);
});
test("a tela mostra a pendência do CNPJ também com a página publicada", () => {
  const src = ler("app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx");
  assert.match(src, /data-testid="parceiro-pendencia-cnpj-publicado"/);
  assert.match(src, /PENDENCIA_CNPJ/);
});
