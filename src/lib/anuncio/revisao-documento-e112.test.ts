/* Roda: node --test src/lib/anuncio/revisao-documento-e112.test.ts
   E112 (reprova ao vivo do E104): na Revisão, o aviso do documento apontava "Enviar no passo Endereço", mas desde o
   E104 o Passo 3 é só endereço. O envio mora no "Antes de publicar" da própria Revisão: o botão diz isso e abre ali. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const NOVO = "app/(dashboard)/dashboard/imoveis/novo";
const revisar = ler(`${NOVO}/etapa-revisar.tsx`);
const pagina = ler(`${NOVO}/page.tsx`);
const ondeFica = ler(`${NOVO}/etapa-onde-fica.tsx`);

test("E112: nenhum botão manda o documento para o passo Endereço", () => {
  assert.doesNotMatch(revisar + pagina, /no passo Endereço/);
  assert.match(revisar, /ROTULO_ENVIAR_DOCUMENTO = "Enviar o documento agora"/);
  assert.match(revisar, /ROTULO_REENVIAR_DOCUMENTO = "Enviar outro documento agora"/);
});

test("E112: o botão abre o envio no 'Antes de publicar' da Revisão (o mesmo 'Enviar documento' do cartão)", () => {
  assert.match(revisar, /onEnviar=\{abrirEnvioDoDocumento\}/);
  assert.match(revisar, /querySelector<HTMLButtonElement>\('\[data-testid="documento-enviar"\]'\)\?\.click\(\)/);
  // O envio existe mesmo lá: o cartão da Revisão desenha o DocumentoVinculo, e o Passo 3 não.
  assert.match(ondeFica, /export function AntesDePublicar[\s\S]*<DocumentoVinculo/);
  assert.doesNotMatch(ondeFica.slice(ondeFica.indexOf("export function EtapaOndeFica"), ondeFica.indexOf("export function AntesDePublicar")), /<DocumentoVinculo/);
  assert.match(pagina, /step === ETAPA\.revisao && \(\s*<div className="mb-6">\s*<AntesDePublicar/);
});

test("E112: 'Resolver' do documento e de quem opera desce até o cartão da Revisão", () => {
  assert.match(pagina, /item\.key === "documento" \|\| item\.key === "sublocacao"/);
  assert.match(pagina, /'\[data-testid="documento-vinculo"\]' : '\[data-testid="antes-de-publicar"\]'/);
});
