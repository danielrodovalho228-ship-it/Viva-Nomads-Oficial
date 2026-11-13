/*
  E880 — estado zero da busca de parceiros: (1) o "Quero ser avisado" exige conta e não havia caminho sem login para o
  dono que só queria um parceiro; (2) "Enviar o link para indicar" só copiava um link cujo destino não aparecia.
  Roda: node --test src/lib/parceiros/e880-zero-sem-login.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { TEXTO_DESTINO_INDICACAO, caminhoIndicacao, caminhosSemConta } from "./indicacao.ts";

const vazia = readFileSync("src/components/parceiros/busca-vazia.tsx", "utf8");
const indicar = readFileSync("src/components/parceiros/indicar-profissional.tsx", "utf8");

test("sem conta: a mesma categoria em todas as cidades (quando há cidade) e falar com a Viva — páginas que existem", () => {
  assert.deepEqual(caminhosSemConta({ categoria: "limpeza", cidade: "Uberlândia" }), [
    { href: "/parceiros/buscar?categoria=limpeza", rotulo: "Ver em todas as cidades" },
    { href: "/ajuda/fale-com-a-viva", rotulo: "Falar com a Viva" },
  ]);
  assert.deepEqual(caminhosSemConta({ categoria: "", cidade: "" }), [{ href: "/ajuda/fale-com-a-viva", rotulo: "Falar com a Viva" }]);
  assert.equal(caminhosSemConta({ categoria: "x?y", cidade: "Uberlândia" })[0].href, "/parceiros/buscar");
  assert.ok(existsSync("src/app/(public)/ajuda/fale-com-a-viva/page.tsx"));
  assert.ok(existsSync("src/app/(public)/parceiros/buscar/page.tsx"));
  for (const c of caminhosSemConta({ categoria: "limpeza", cidade: "Uberlândia" })) assert.doesNotMatch(c.href, /^\/auth|dashboard/);
});

test("o estado zero mostra os caminhos sem conta só para quem não está logado, e diz por que o aviso pede conta", () => {
  assert.match(vazia, /\{!logado && \(\s*<p className="text-sm text-ink" data-testid="busca-parceiros-sem-conta">/);
  assert.match(vazia, /caminhosSemConta\(\{ categoria, cidade \}\)/);
  assert.match(vazia, /O aviso abaixo pede a conta porque guarda para quem avisar\./);
});

test("a indicação mostra o destino e deixa abrir a página do pedido", () => {
  assert.equal(caminhoIndicacao("limpeza"), "/parceiros?categoria=limpeza#quero-ser-parceiro");
  assert.match(TEXTO_DESTINO_INDICACAO, /abre o pedido de parceria da Viva, já nesta categoria/);
  assert.match(indicar, /data-testid="indicar-destino"/);
  assert.match(indicar, /<Link href=\{caminhoIndicacao\(categoria\)\}[^>]*data-testid="indicar-destino-link"/);
});
