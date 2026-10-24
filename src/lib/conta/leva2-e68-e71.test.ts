/*
  Conta leva 2 — E68 (Verificação) e E71 (Ajuda). Roda: node --test src/lib/conta/leva2-e68-e71.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTATO_AJUDA, CONTATO_LINHA, LINHAS_AJUDA } from "./ajuda.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E68: a tela da Verificação escreve 'em breve' uma vez só (no estado em breve)", () => {
  const v = ler("app/(dashboard)/dashboard/verificacao/page.tsx");
  const vezes = (v.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").match(/em breve/gi) ?? []).length;
  assert.equal(vezes, 1);
  assert.match(v, /Disponível em breve, por meio de um parceiro\./);
});

test("E71: contato em destaque com a frase do atendimento; descrições das linhas; Sair dentro do cartão", () => {
  assert.equal(CONTATO_LINHA, "Assistente Viva 24 h · resposta de uma pessoa em até 24 h");
  assert.equal(CONTATO_AJUDA.rotulo, "Fale com a Viva");
  assert.deepEqual(
    LINHAS_AJUDA.map((l) => l.descricao),
    ["Guias e respostas rápidas", "As regras da plataforma", "Seus dados, suas regras"],
  );
  const tela = ler("components/account/tela-ajuda.tsx");
  assert.ok(tela.indexOf('data-testid="ajuda-sair"') > tela.indexOf("LINHAS_AJUDA.map"), "Sair é a última linha do cartão dos links");
});

test("E71: artigos de custo e taxa levam a /precos; golpe e contato, a /seguranca", () => {
  const faq = ler("lib/atendimento/faq.ts");
  assert.match(faq, /const LINK_PRECOS = \{ rotulo: "[^"]+", href: "\/precos" \};/);
  assert.match(faq, /const LINK_SEGURANCA = \{ rotulo: "[^"]+", href: "\/seguranca" \};/);
  assert.equal((faq.match(/links: \[LINK_PRECOS\]/g) ?? []).length, 3);
  assert.equal((faq.match(/links: \[LINK_SEGURANCA\]/g) ?? []).length, 2);
  assert.match(ler("components/ajuda/central-ajuda.tsx"), /faq-link-/);
});
