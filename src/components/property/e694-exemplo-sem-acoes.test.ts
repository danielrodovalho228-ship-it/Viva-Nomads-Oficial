/*
  E694 (resíduo): no anúncio de EXEMPLO os CTAs "Pedir para morar", "Enviar mensagem", "Agendar visita" e "Visita por vídeo"
  não ficam ativos — viram uma explicação clara e uma saída para os imóveis reais (decisão aprovada: vitrine de exemplos
  mantida, com aviso antecipado). Anúncio real não muda.
  Roda: node --test src/components/property/e694-exemplo-sem-acoes.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const detalhe = ler("app/(public)/imoveis/[id]/property-detail.tsx");
const barra = ler("components/property/barra-fixa-celular.tsx");
const dono = ler("components/property/owner-card.tsx");

test("cartão do computador: no exemplo, uma explicação no lugar dos 4 botões; no real, os botões de sempre", () => {
  const i = detalhe.indexOf("{exemplo ? (");
  assert.ok(i > 0, "ramo do exemplo");
  const bloco = detalhe.slice(i, i + 1400);
  assert.match(bloco, /data-testid="exemplo-sem-acoes"/);
  assert.match(bloco, /pedir para morar, enviar mensagem, agendar visita ou fazer visita por vídeo/);
  assert.match(bloco, /href="\/buscar"[^>]*data-testid="exemplo-ver-reais"|data-testid="exemplo-ver-reais"[^>]*href="\/buscar"/);
  // Os botões só existem no ramo do anúncio real.
  const real = detalhe.slice(i + bloco.length - 200);
  for (const t of ['data-testid="cartao-solicitar"', "<VisitaPresencial", "<VisitaVideo", "Enviar mensagem"]) {
    assert.ok(detalhe.indexOf(t) > i, `${t} depois do ramo do exemplo`);
  }
  assert.ok(real.length > 0);
});

test("barra fixa do celular: no exemplo não há 'Pedir para morar' nem 'Agendar visita', só a saída para os imóveis reais", () => {
  assert.match(barra, /barra\.demonstracao \? \(/);
  assert.match(barra, /data-testid="barra-ver-reais"/);
  const i = barra.indexOf("barra.demonstracao ? (");
  const exemplo = barra.slice(i, barra.indexOf("        ) : (", i));
  assert.doesNotMatch(exemplo, /barra-solicitar|barra-agendar-visita|Agendar visita/);
});

test("cartão do proprietário: no exemplo, sem botão 'Enviar mensagem'; a explicação fica à vista", () => {
  assert.match(dono, /const podeMensagem = !exemplo && !!onMensagem;/);
  assert.doesNotMatch(dono, /onClick=\{exemplo \? \(\) => setAvisoDemo\(true\) : onMensagem\}/);
  assert.match(dono, /\{exemplo && \(\s*<p role="status" data-testid="mensagem-demo"/);
});
