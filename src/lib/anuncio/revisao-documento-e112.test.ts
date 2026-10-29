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
});

test("E112 → E251: o envio do documento mora no 'Antes de publicar' da Revisão, numa seção que abre no lugar", () => {
  // O envio existe mesmo lá: a seção "Documento do imóvel" do acordeão desenha o DocumentoVinculo, e o Passo 3 não.
  assert.match(ondeFica, /export function AntesDePublicar[\s\S]*documento: \([\s\S]*<DocumentoVinculo/);
  assert.doesNotMatch(ondeFica.slice(ondeFica.indexOf("export function EtapaOndeFica"), ondeFica.indexOf("export function AntesDePublicar")), /<DocumentoVinculo/);
  assert.match(pagina, /antesDePublicar=\{\s*<AntesDePublicar/);
  // O aviso solto do documento no topo da Revisão saiu: o estado do documento é a linha da própria seção (sem duplicar).
  assert.doesNotMatch(revisar, /data-testid="revisar-documento"/);
});

test("E112 → E251: 'Resolver' do documento, de quem opera e das declarações abre a seção certa e desce até ela", () => {
  assert.match(pagina, /const secao = secaoDoItem\(item\.key\);\s*if \(secao\) abrirSecaoPasso10\(secao\);/);
  assert.match(pagina, /new CustomEvent\(EVENTO_ABRIR_SECAO, \{ detail: secao \}\)/);
  assert.match(ondeFica, /window\.addEventListener\(EVENTO_ABRIR_SECAO, abrir\)/);
});
