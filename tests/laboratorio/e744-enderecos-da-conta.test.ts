import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALIAS_SECAO, SECOES_CONTA, destinoDaAncora } from "../../src/lib/conta/secoes.ts";
import { redirecionamentoDaConta } from "../../src/lib/conta/redirecionar-no-servidor.ts";
import { ANCORAS_ANTIGAS, ENDERECOS_DA_CONTA, SECAO_INEXISTENTE } from "../e2e/fixtures/enderecos-da-conta.ts";

/*
  E744 (passo 9): a matriz do t1660 (tests/e2e/fixtures/enderecos-da-conta.ts) tem uma linha para CADA endereço da Conta.
  Esta guarda roda no `npm test` e acusa a seção, o apelido ou a âncora nova que entrar no produto sem linha na matriz,
  e a linha da matriz que deixar de bater com a regra pura do produto (um mudou sem o outro).
*/
const rotas = new Set(ENDERECOS_DA_CONTA.map((e) => e.rota));

test("toda seção da Conta e todo apelido de endereço antigo têm linha na matriz", () => {
  for (const s of SECOES_CONTA) assert.ok(rotas.has(`/dashboard/conta/${s.id}`), `seção sem linha na matriz: ${s.id}`);
  for (const apelido of Object.keys(ALIAS_SECAO)) assert.ok(rotas.has(`/dashboard/conta/${apelido}`), `apelido sem linha na matriz: ${apelido}`);
  assert.ok(rotas.has("/dashboard/conta/perfil-publico"), "a subtela do Perfil (E898) tem linha");
  assert.ok(!rotas.has(SECAO_INEXISTENTE), "o endereço inexistente não é uma seção");
});

test("o destino de cada linha é o da regra do produto (menu da seção ou redirecionamento registrado)", () => {
  for (const e of ENDERECOS_DA_CONTA) {
    const servidor = redirecionamentoDaConta(e.rota, new URLSearchParams(), "larga");
    if (servidor) assert.equal(e.destino, servidor, `${e.rota}: o proxy manda para ${servidor}`);
    const secao = SECOES_CONTA.find((s) => `/dashboard/conta/${s.id}` === e.rota);
    // A seção cujo item do menu aponta para fora da Conta (Avaliações, Notificações) leva a esse endereço.
    if (secao && !secao.href.startsWith("/dashboard/conta/")) assert.equal(e.destino.split("?")[0], secao.href, `${e.rota}: o menu leva a ${secao.href}`);
    if (secao && secao.href === e.rota) assert.equal(e.destino, e.rota, `${e.rota}: tela própria, fica no endereço`);
  }
});

test("toda âncora antiga do produto tem linha, e o destino da linha é o de destinoDaAncora", () => {
  const fonte = readFileSync("src/lib/conta/secoes.ts", "utf8");
  const bloco = fonte.slice(fonte.indexOf("const ANCORA_SECAO"), fonte.indexOf("export function destinoDaAncora"));
  const doProduto = [...bloco.matchAll(/^\s+"?([a-z-]+)"?:\s*"/gm)].map((m) => m[1]);
  assert.ok(doProduto.length >= 13, `leitura das âncoras do produto: ${doProduto.length}`);
  const daMatriz = new Set(ANCORAS_ANTIGAS.map((a) => a.ancora));
  for (const a of doProduto) assert.ok(daMatriz.has(a), `âncora antiga sem linha na matriz: #${a}`);
  for (const a of ANCORAS_ANTIGAS) {
    const puro = destinoDaAncora(`#${a.ancora}`);
    assert.ok(puro, `#${a.ancora} não é mais uma âncora antiga do produto`);
    assert.equal(a.destino.split("#")[0], puro!.split("#")[0], `#${a.ancora}: tela de destino`);
    // A âncora que ainda existe na tela nova segue na URL (ex.: #documento em Dados).
    if (puro!.includes("#")) assert.equal(a.destino, puro, `#${a.ancora}: a âncora que ainda existe segue`);
  }
});
