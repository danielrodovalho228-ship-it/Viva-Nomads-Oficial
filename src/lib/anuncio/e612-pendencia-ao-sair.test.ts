/*
  E612: Continuar livre nos Passos 5, 6 e 7 com bloqueadores pendentes, sem aviso — a trava só no Publicar. O avanço
  segue livre, mas sair de um passo com bloqueador mostra no passo seguinte o que ficou pendente lá.
  Roda: node --test src/lib/anuncio/e612-pendencia-ao-sair.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conferenciaAssistente } from "./assistente-dez-etapas.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { ETAPA } from "./etapas-ids.ts";
import { NOTA_PENDENCIA_AO_SAIR, pendenciaAoSair, tituloPendenciaAoSair } from "./pendencia-ao-sair.ts";

const fatos = (extra: Partial<FatosAnuncio> = {}): FatosAnuncio => ({
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Apto", preco: 3000, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, operacao: "own", documento: "approved", descricao: "x".repeat(80),
  tipoEntradaOk: true, internetOk: true, confortoFaltam: 0, selo: false, video: false, ...extra,
});

test("E612: sair do Passo 5 com o padrão mínimo pendente diz o que ficou", () => {
  const c = conferenciaAssistente(prontidaoAnuncio(fatos({ confortoFaltam: 12 })));
  const p = pendenciaAoSair(c.itens, ETAPA.comodidades);
  assert.ok(p);
  assert.equal(p.passo, 5);
  assert.equal(tituloPendenciaAoSair(p), "Ficou pendente no Passo 5 — Comodidades");
  assert.ok(p.faltam.some((f) => /Padrão mínimo/.test(f) && /12 itens/.test(f)), p.faltam.join(" | "));
});

test("E612: sair do Passo 6 sem o tipo de entrada diz o que ficou", () => {
  const c = conferenciaAssistente(prontidaoAnuncio(fatos({ tipoEntradaOk: false })));
  const p = pendenciaAoSair(c.itens, ETAPA.regras);
  assert.ok(p);
  assert.equal(p.passo, 6);
  assert.equal(p.faltam.length, 1);
});

test("E612: passo sem bloqueador não mostra aviso", () => {
  const c = conferenciaAssistente(prontidaoAnuncio(fatos()));
  for (const e of [ETAPA.comodidades, ETAPA.regras, ETAPA.descricao]) assert.equal(pendenciaAoSair(c.itens, e), null);
  assert.equal(pendenciaAoSair(c.itens, ETAPA.tipo), null);
  assert.match(NOTA_PENDENCIA_AO_SAIR, /pode seguir/);
});

test("E612: o assistente mostra o aviso no passo seguinte, com atalho de volta, sem segurar o avanço", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  const avancar = pagina.slice(pagina.indexOf("function avancarEtapa()"), pagina.indexOf("function voltarEtapa()"));
  assert.match(avancar, /setPendenciaSaida\(pendenciaAoSair\(conferencia\.itens, step\)\);\s*irPara\(/);
  assert.match(pagina, /data-testid="pendencia-ao-sair"/);
  assert.match(pagina, /data-testid="pendencia-ao-sair-voltar"/);
});
