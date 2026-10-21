/*
  Prompt 41 — guardas de código (o E2E t259 confere o mesmo na tela, a 390 e 1280 px):
   - cogumelo: mora na página da estadia — as guardas estão em src/lib/estadia/acoes.test.ts;
   - página do imóvel: a ordem, o "Solicitar" (a candidatura de sempre), a visita em texto terciário, o total pela
     duração e "a Viva não segura dinheiro" em todo rótulo de valor;
   - botão: data-cta="primary" só no primário.
  Roda: node --test src/lib/estadia/prompt-41.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("página do imóvel: ordem do Prompt 41 (galeria → título → síntese → anfitrião → comodidades → regras → mapa → avaliações)", () => {
  const d = semComentarios(ler("app/(public)/imoveis/[id]/property-detail.tsx"));
  const marcos = ["<PropertyGallery", "<h1", 'data-testid="imovel-sintese"', "<FaixaProprietario", "<AmenitiesGrid", "<StayRules", 'id="localizacao"', 'id="avaliacoes"', 'id="proprietario"'];
  const pos = marcos.map((m) => d.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), `ordem ${marcos.map((m, i) => `${m}@${pos[i]}`).join(", ")}`);
  // "Ideal para" mora aqui, logo depois da síntese (saiu do cartão no #953).
  assert.ok(d.indexOf("<IdealPara") > d.indexOf('data-testid="imovel-sintese"'));
  // Sem cômodo marcado nas fotos (o dado ainda não existe): o bloco "Onde você vai dormir" não aparece; "Tempo até" não entra.
  assert.doesNotMatch(d, /Onde você vai dormir|Tempo até|em breve/i);
  // Coração e compartilhar como ícones; galeria em tela cheia no celular com "1/N"; mosaico de 5 com "Ver todas as fotos".
  assert.match(d, /<FavoriteButton propertyId=\{property\.id\} \/>/);
  assert.match(d, /<ShareButton icone /);
  const g = ler("components/property-gallery.tsx");
  assert.match(g, /data-testid="galeria-indicador"/);
  assert.match(g, /-mx-5 -mt-8 sm:-mx-8 md:hidden/);
  assert.match(g, /<Images className="h-4 w-4" \/> Ver todas as fotos/);
});

test("página do imóvel: UM primário 'Solicitar' (a candidatura de sempre); a visita é texto terciário", () => {
  const d = semComentarios(ler("app/(public)/imoveis/[id]/property-detail.tsx"));
  const acoes = d.slice(d.indexOf("const actions = candidatouSe"), d.indexOf("const composer ="));
  assert.equal((acoes.match(/variant="primary"/g) ?? []).length, 1);
  assert.match(acoes, /"Solicitar"/);
  assert.match(acoes, /onClick=\{abrirSolicitacao\}/); // o mesmo fluxo da candidatura
  assert.match(acoes, /variante="tertiary"/);
  // O passo final do fluxo segue sendo "Enviar candidatura".
  assert.match(d, /"Enviar candidatura"/);
  const barra = ler("components/property/barra-fixa-celular.tsx");
  assert.match(barra, /\{pending \? "Enviando\.\.\." : "Solicitar"\}/);
  assert.match(barra, /data-cta=\{marcaCta\("primary"\)\}/);
  assert.match(barra, /buttonClasses\(\{ variant: "tertiary", size: "sm" \}\)\}>\s*Agendar visita/);
  assert.match(barra, /shadow-flutuante/);
});

test("valor: 'R$ X/mês · R$ Y em N meses' pela regra do cartão e 'a Viva não segura dinheiro' em todo rótulo de valor", () => {
  const d = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(d, /const meses = mesesDoCartao\(mesesBusca \|\| undefined, property\.minPeriodDays\);/);
  assert.match(ler("lib/barra-fixa-imovel.ts"), /rotuloPrecoCartao\(total, p\.meses \?\? 1\)/);
  assert.match(ler("components/property/price-card.tsx"), /const preco = rotuloPrecoCartao\(mes\.total, meses\);/);
  for (const f of ["components/property/barra-fixa-celular.tsx", "components/property/price-card.tsx"]) assert.match(ler(f), /FRASE_NAO_SEGURA_DINHEIRO/, f);
});

test("botão: data-cta=\"primary\" só no primário (primary e os nomes antigos accent/gold)", () => {
  const b = ler("components/ui/button.tsx");
  assert.match(b, /return variant === "primary" \|\| variant === "accent" \|\| variant === "gold" \? "primary" : "";/);
  assert.match(b, /data-cta=\{marcaCta\(variant\)\}/);
});
