/*
  E506 (ligado ao E196; QA de cliques do proprietário, 02/11) — /qualificar se contradizia:
   1. na página de UM rascunho dizia ao mesmo tempo que a qualificação "vale para o PRÓXIMO imóvel" e que "cada imóvel
      tem a sua qualificação" (o texto do "sem imóvel" aparecia enquanto o imóvel carregava);
   2. num rascunho "100% pronto para publicar", mostrava "0/6 requisitos / não pode ser publicado" — a qualificação do
      rascunho mora nas declarações do Passo 10 (draft_data) e só vai para qualification_checklists ao publicar.
  Correção: (1) com imóvel pedido, nunca o texto do "próximo imóvel" (enquanto carrega, "Carregando o imóvel…"); (2) sem
  linha salva, o rascunho abre a qualificação DERIVADA do draft_data com a mesma regra do assistente e do Início.
  Roda: node --test src/lib/anuncio/e506-qualificar-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { elegibilidadeDoRascunho, qualificacaoDoRascunho } from "./requisitos-passo10.ts";
import { eligibilityChecks, isEligible } from "../qualification.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("a elegibilidade do rascunho é a mesma que o Início conta (qualificacaoDoRascunho)", () => {
  const d = { propertyType: "casa", furnished: true, minPeriodDays: 30, declaracoesPasso10: { iptuOk: true, habitavel: true } };
  const f = { documento: "pending" as const, sublocacaoOk: true };
  const e = elegibilidadeDoRascunho(d, f);
  assert.ok(e);
  assert.equal(isEligible(e!), true);
  assert.equal(eligibilityChecks(e!).filter((c) => c.ok).length, eligibilityChecks(e!).length);
  assert.equal(qualificacaoDoRascunho(d, f), isEligible(e!));
  assert.equal(elegibilidadeDoRascunho(null, f), null);
});

test("servidor: sem qualificação salva, o RASCUNHO abre a derivada do draft_data (não 0/6)", () => {
  const a = ler("src/lib/data/actions.ts");
  const fn = a.slice(a.indexOf("export async function carregarQualificacao"), a.indexOf("export async function resumoImovelDoDono"));
  assert.match(fn, /elegibilidadeDoRascunho\(/);
  assert.match(fn, /property_private_details/);
  assert.match(fn, /\.eq\("status", "draft"\)/);
});

test("tela: com imóvel pedido, nunca \"próximo imóvel\"; o texto do sem-imóvel não se contradiz", () => {
  const c = ler("src/app/(dashboard)/qualificar/qualificar-client.tsx");
  assert.match(c, /imovelPedidoId \? \(/);
  assert.match(c, /Carregando o imóvel…/);
  assert.doesNotMatch(c, /vale para o <strong className="text-ink">próximo imóvel<\/strong>/);
});
