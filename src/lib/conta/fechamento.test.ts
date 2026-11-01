/* E75 — padrão de fechamento da Conta. Roda: node --test src/lib/conta/fechamento.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LINHA_FECHAMENTO_CONTA } from "./secoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("toda tela da Conta (casca) e o menu terminam na linha institucional, sem vão no computador", () => {
  assert.equal(LINHA_FECHAMENTO_CONTA, "Viva Nomads · Uberlândia, MG");
  assert.match(ler("src/components/account/casca-conta.tsx"), /\{children\}\s*<FechamentoConta \/>/);
  assert.match(ler("src/components/account/conta-menu.tsx"), /<FechamentoConta \/>/);
  const css = ler("src/app/globals.css");
  assert.match(css, /\[data-painel-main\]:has\(\[data-conta-casca\]\),\s*html:not\(\[data-app\]\) \[data-painel-main\]:has\(\[data-testid="conta-menu"\]\) \{\s*padding-bottom: 2rem;/);
});

test("E71: Ajuda com o contato em destaque (foto + frase), descrições nas linhas, Sair dentro do cartão e links nos artigos", async () => {
  const a = await import("./ajuda.ts");
  assert.equal(a.CONTATO_LINHA, "Assistente Viva 24 h · resposta de uma pessoa em até 24 h");
  assert.deepEqual(a.LINHAS_AJUDA.map((l) => [l.id, l.descricao]), [
    ["central", "Guias e respostas rápidas"],
    ["termos", "As regras da plataforma"],
    ["privacidade", "Seus dados, suas regras"],
  ]);
  const tela = ler("src/components/account/tela-ajuda.tsx");
  assert.match(tela, /<CartaoComFoto foto=\{PHOTOS\.ajudaContato\}/);
  assert.equal((tela.match(/<CartaoComFoto /g) ?? []).length, 1, "foto só no cartão de contato");
  // E312 (QA 31/10): sem "Sair da conta" na tela — o "Sair" é o do menu da Conta (uma vez no total).
  assert.ok(tela.indexOf("LINHAS_AJUDA.map") > 0);
  assert.doesNotMatch(tela, /ajuda-sair/);
  const { FAQ } = await import("../atendimento/faq.ts");
  const links = (id: string) => FAQ.find((p) => p.id === id)?.links?.map((l) => l.href) ?? [];
  assert.deepEqual(links("custo-anunciar"), ["/precos"]);
  assert.deepEqual(links("golpe"), ["/seguranca"]);
});
