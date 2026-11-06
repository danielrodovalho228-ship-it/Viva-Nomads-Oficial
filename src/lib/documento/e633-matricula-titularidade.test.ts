/*
  E633 (aprovado pelo Daniel em 05/11/2026; reunião com a Dra. Beatriz): a matrícula atualizada do imóvel (~R$ 35) como
  prova de titularidade de quem anuncia. NASCE OPCIONAL — nunca bloqueia a publicação. Só vira obrigatória com a chave
  MATRICULA_OBRIGATORIA (desligada), que só se liga com a confirmação por escrito da Dra. Beatriz (item 38 da pauta dela).
  Exceções documentadas (inventariante, herdeiros, contrato de gaveta) caem em REVISÃO MANUAL (caso → em_revisao).
  Roda: node --test src/lib/documento/e633-matricula-titularidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prontidaoAnuncio, type FatosAnuncio } from "../anuncio/prontidao.ts";
import { CASOS_DONO, VALORES_CASO } from "./conferencia-matricula.ts";
import { ROTULO_MATRICULA_ATUALIZADA, DICA_MATRICULA_ATUALIZADA, TEXTO_MATRICULA_OPCIONAL } from "./matricula-titularidade.ts";
import { secaoDoItem } from "../anuncio/passo10-colunas.ts";
import { CHAVES_AMBIENTE } from "../../config/chaves-ambiente.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const tudoOk: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 10, titulo: "Apartamento claro", preco: 2500, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, documento: "approved", descricao: "x".repeat(200), selo: false, video: false,
};

test("opcional: sem a matrícula atualizada o anúncio PUBLICA e o item aparece como melhoria, com o custo dito", () => {
  const p = prontidaoAnuncio({ ...tudoOk, matriculaEnviada: false, matriculaObrigatoria: false });
  assert.equal(p.podePublicar, true);
  const item = p.opcionais.find((i) => i.key === "matricula_atualizada");
  assert.ok(item, "item opcional presente");
  assert.equal(item.ok, false);
  assert.equal(item.label, ROTULO_MATRICULA_ATUALIZADA);
  assert.match(item.detalhe ?? "", /R\$ 35/);
  assert.ok(p.melhorar.includes(ROTULO_MATRICULA_ATUALIZADA));
  assert.ok(!p.obrigatorios.some((i) => i.key === "matricula_atualizada"));
  assert.ok(!p.faltam.some((t) => t.includes(ROTULO_MATRICULA_ATUALIZADA)));
});

test("opcional: com a matrícula enviada o item vira feito (não pede de novo)", () => {
  const p = prontidaoAnuncio({ ...tudoOk, matriculaEnviada: true, matriculaObrigatoria: false });
  const item = p.opcionais.find((i) => i.key === "matricula_atualizada");
  assert.equal(item?.ok, true);
  assert.ok(!p.melhorar.includes(ROTULO_MATRICULA_ATUALIZADA));
  assert.equal(p.podePublicar, true);
});

test("não se aplica (anúncio já publicado / editor): sem o fato, nenhum item", () => {
  const p = prontidaoAnuncio(tudoOk);
  assert.ok(!p.opcionais.some((i) => i.key === "matricula_atualizada"));
  assert.ok(!p.obrigatorios.some((i) => i.key === "matricula_atualizada"));
});

test("obrigatória só com a chave ligada: sem a matrícula, bloqueia; com ela, libera", () => {
  const sem = prontidaoAnuncio({ ...tudoOk, matriculaEnviada: false, matriculaObrigatoria: true });
  assert.equal(sem.podePublicar, false);
  assert.ok(sem.obrigatorios.some((i) => i.key === "matricula_atualizada" && !i.ok));
  assert.ok(!sem.opcionais.some((i) => i.key === "matricula_atualizada"));
  const com = prontidaoAnuncio({ ...tudoOk, matriculaEnviada: true, matriculaObrigatoria: true });
  assert.equal(com.podePublicar, true);
});

test("exceções (inventariante, herdeiros, contrato de gaveta) são casos nomeados que caem em revisão manual", () => {
  const texto = CASOS_DONO.map((c) => `${c.rotulo} ${c.documentos}`).join(" | ");
  assert.match(texto, /inventariante/i);
  assert.match(texto, /herdeiro/i);
  assert.match(texto, /contrato de gaveta/i);
  for (const v of ["heranca", "compra_nao_registrada"]) assert.ok(VALORES_CASO.includes(v), v);
  assert.match(ler("app/api/documentos/matricula/caso/route.ts"), /resultado: "em_revisao"/);
});

test("a chave está registrada, desligada por padrão, e diz que só liga com a confirmação da Dra. Beatriz", () => {
  assert.ok(CHAVES_AMBIENTE.some((c) => c.nome === "MATRICULA_OBRIGATORIA" && c.variavel === "NEXT_PUBLIC_MATRICULA_OBRIGATORIA"));
  const flags = ler("lib/flags.ts");
  assert.match(flags, /export const MATRICULA_OBRIGATORIA = process\.env\.NEXT_PUBLIC_MATRICULA_OBRIGATORIA === "on";/);
  assert.match(flags, /Beatriz/);
});

test("servidor: o fato vem de property_ownership_checks, só para anúncio que ainda vai publicar", () => {
  const s = ler("lib/anuncio/prontidao-servidor.ts");
  assert.match(s, /from\("property_ownership_checks"\)/);
  assert.match(s, /f\.matriculaObrigatoria = MATRICULA_OBRIGATORIA/);
  assert.match(s, /if \(p\.status !== "active"\) f\.matriculaEnviada = /);
});

test("tela: o cartão do documento diz que a matrícula atualizada é opcional e quanto custa", () => {
  assert.match(DICA_MATRICULA_ATUALIZADA, /R\$ 35/);
  assert.match(TEXTO_MATRICULA_OPCIONAL, /opcional/i);
  assert.match(ler("components/anuncio/documento-vinculo.tsx"), /data-testid="matricula-atualizada-dica"/);
});

test('o "Resolver" do item abre a seção do documento (onde se envia a matrícula)', () => {
  assert.equal(secaoDoItem("matricula_atualizada"), "documento");
});
