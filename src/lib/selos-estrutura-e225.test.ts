/*
  E225-A — estrutura de acessibilidade no cadastro, sem selo que minta (guardas da tela e da leitura pública).
  Roda: node --test src/lib/selos-estrutura-e225.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PONTOS_REFERENCIA } from "../config/pontos-referencia.ts";
import { TIPO_PONTO_SELO } from "../config/pontos-selos-estrutura.ts";
import { pontosDaCidade, ITENS_ESTRUTURA, GRUPOS_ESTRUTURA } from "./selos-estrutura.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Passo 5: o toggle de estrutura fica no FIM do passo (depois do nível) e também no editar", () => {
  const novo = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const passo5 = novo.slice(novo.indexOf("{step === ETAPA.comodidades && ("), novo.indexOf("{step === ETAPA.regras && ("));
  assert.ok(passo5.indexOf("<NivelNoCadastro") > 0 && passo5.indexOf("<EstruturaAcessibilidade") > passo5.indexOf("<NivelNoCadastro"));
  const editar = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(editar, /<SecaoEstrutura propertyId=\{property\.id\} \/>/);
  const comp = ler("src/components/anuncio/estrutura-acessibilidade.tsx");
  assert.match(comp, /titulo="O imóvel tem estrutura de acessibilidade\?"/);
  assert.match(comp, /<BlocoOpcional/); // padrão E56
  assert.match(comp, /salvarChecklistEstrutura\(propertyId, novo\)/);
  // Desligar apaga o que foi marcado (grava {}).
  assert.match(comp, /onDesligar=\{\(\) => \{\s*setLigado\(false\);\s*void gravar\(\{\}\);/);
});

test("anúncio público: a seção só com itens 'sim', com a nota, sem selo por autodeclaração (provas: [])", () => {
  const sec = ler("src/components/property/estrutura-informada.tsx");
  assert.match(sec, /Estrutura informada pelo proprietário/);
  assert.match(sec, /NOTA_ESTRUTURA_INFORMADA/);
  assert.match(sec, /provas: \[\]/);
  assert.match(sec, /if \(grupos\.length === 0 && selos\.length === 0\) return null;/);
  const detalhe = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(detalhe, /<EstruturaInformada property=\{property\} checklist=\{estrutura\} \/>/);
});

test("leitura pública só de anúncio ATIVO (servidor e RLS da 0228)", () => {
  const loader = ler("src/lib/data/estrutura-publica.ts");
  assert.match(loader, /properties!inner\(status\)/);
  assert.match(loader, /\.eq\("properties\.status", "active"\)/);
  const pagina = ler("src/app/(public)/imoveis/[id]/page.tsx");
  assert.match(pagina, /isExemplo\(property\) \? Promise\.resolve\(null\) : estruturaPublicaDoImovel\(property\.id\)/);
  const leitura = ler("src/lib/data/estrutura-actions.ts");
  const i = leitura.indexOf("export async function lerChecklistEstrutura");
  assert.ok(i > 0 && leitura.indexOf("owner_id !== user.id", i) > i, "o dono confere a posse antes de ler");
});

test("'Perto de…': com a lista de hoje (nenhum ponto verificado) nenhuma cidade tem selo — nada inventado", () => {
  assert.equal(pontosDaCidade("uberlandia", PONTOS_REFERENCIA, TIPO_PONTO_SELO), null);
  for (const slug of Object.keys(TIPO_PONTO_SELO)) assert.ok(PONTOS_REFERENCIA.some((p) => p.slug === slug), `${slug} existe em pontos-referencia`);
});

test("vocabulário: sem promessa — 'acessível' só como nome de selo; nada de aluguel/temporada/hóspede", () => {
  // Só o que vai para a tela (sem os comentários do código).
  const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const textos = [
    semComentarios(ler("src/components/anuncio/estrutura-acessibilidade.tsx")),
    semComentarios(ler("src/components/property/estrutura-informada.tsx")),
    JSON.stringify(ITENS_ESTRUTURA),
    JSON.stringify(GRUPOS_ESTRUTURA),
  ].join("\n");
  assert.doesNotMatch(textos, /acess[íi]vel/i);
  assert.doesNotMatch(textos, /aluguel|temporada|h[óo]spede|inquilino/i);
});
