/*
  E887 — /conferir não dizia o que a conferência devolve nem a validade do documento, e a Central de Ajuda não
  explicava como conferir (lacuna A-276). Correção: uma fonte única (fiscal/conferir) com o que volta (tipo, número e
  versão, data, situação), o que NÃO volta por privacidade (partes e valores) e a validade real (o código não vence; vale
  a situação de hoje). A página de entrada, o resultado e o artigo da Ajuda leem daqui.
  Roda: node --test src/lib/fiscal/e887-conferir-o-que-mostra.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFERENCIA_DEVOLVE, CONFERENCIA_PARTES, CONFERENCIA_VALIDADE, camposExibidos, fraseConferenciaDevolve, situacaoDoDocumento, type LinhaConferida } from "./conferir.ts";
import { FAQ, buscarFaq } from "../atendimento/faq.ts";
import { perguntasDoTema } from "../ajuda/temas.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const doc: LinhaConferida = {
  prefixo: "REC", tipo: "recibo", numero: "REC-2026-000001", versao: 1, status: "valido", anulado_motivo: null, status_em: null,
  emitido_em: "2026-11-01T12:00:00Z", hash_sha256: null, is_teste: false, registro_seq: 1, versao_vigente: null,
};

test("E887: a lista do que a conferência devolve bate com o que o resultado mostra", () => {
  const rotulos = camposExibidos(doc, () => "01/11/2026").map(([k]) => k);
  assert.deepEqual(rotulos, ["Documento", "Número", "Versão", "Emitido em"]);
  const t = CONFERENCIA_DEVOLVE.join(" | ");
  assert.match(t, /tipo de documento/);
  assert.match(t, /número e a versão/);
  assert.match(t, /data de emissão/);
  // a situação: os quatro estados que situacaoDoDocumento devolve
  for (const s of ["valido", "anulado", "substituido"] as const) assert.ok(situacaoDoDocumento({ ...doc, status: s }).estado);
  assert.match(t, /situação: válido, anulado, substituído[^|]*teste/);
});

test("E887: diz o que fica de fora (partes e valores) e a validade real do documento", () => {
  assert.match(CONFERENCIA_PARTES, /não mostra os nomes das partes nem valores/);
  assert.match(CONFERENCIA_VALIDADE, /o código não vence/);
  assert.match(CONFERENCIA_VALIDADE, /deixa de valer se for anulado ou substituído/);
});

test("E887: a página /conferir mostra o que volta e a validade ANTES de conferir", () => {
  const p = ler("../../app/(public)/conferir/page.tsx");
  assert.match(p, /data-testid="conferir-o-que-mostra"[\s\S]*CONFERENCIA_DEVOLVE\.map[\s\S]*\{CONFERENCIA_PARTES\}[\s\S]*data-testid="conferir-validade"[\s\S]*\{CONFERENCIA_VALIDADE\}/);
  assert.ok(p.indexOf("conferir-o-que-mostra") < p.indexOf("<form"), "antes do campo do código");
});

test("E887: o resultado da conferência repete as partes e a validade, da mesma fonte", () => {
  const p = ler("../../app/(public)/conferir/[codigo]/page.tsx");
  assert.match(p, /\{CONFERENCIA_PARTES\}/);
  assert.match(p, /data-testid="conferir-validade"[\s\S]*?\{CONFERENCIA_VALIDADE\}/);
});

test("E887 (A-276): a Ajuda explica como conferir um documento, no tema Segurança e conta, com link para /conferir", () => {
  const a = FAQ.find((p) => p.id === "conferir-documento");
  assert.ok(a, "artigo existe");
  assert.ok(perguntasDoTema("seguranca").includes("conferir-documento"));
  assert.ok(a.resposta.includes(fraseConferenciaDevolve()));
  assert.ok(a.resposta.includes(CONFERENCIA_PARTES) && a.resposta.includes(CONFERENCIA_VALIDADE));
  assert.match(a.resposta, /32 letras e números/);
  assert.deepEqual(a.links, [{ rotulo: "Conferir um documento", href: "/conferir" }]);
  for (const q of ["conferir documento", "recibo verdadeiro", "autenticidade"]) assert.ok(buscarFaq(q).some((p) => p.id === "conferir-documento"), q);
});
