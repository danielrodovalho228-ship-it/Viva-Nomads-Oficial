/*
  E744, passo 2 (15/11/2026) — regressão das varreduras nas rotas da Conta (verdes em 12/11, vermelhas desde 13/11).

  Causa: o E798 (12/11, 18:11 UTC) passou para o SERVIDOR (proxy) dois redirecionamentos que já eram decisão registrada:
    - E492/E552: no computador (≥ 1024 px), /dashboard/conta abre o Perfil (/dashboard/conta/perfil);
    - E679 (E85): /dashboard/conta/avaliacoes virou /dashboard/avaliacoes.
  As varreduras abriam o endereço antigo e cobravam "continuo neste endereço" logo depois do carregamento. Enquanto o
  redirecionamento era feito no navegador, a cobrança passava por corrida (olhava antes de o navegador trocar de tela);
  com o servidor redirecionando antes de desenhar, 13 specs ficaram vermelhos — e três passam ainda só pela ordem das telas
  (o cookie da largura ainda não existe na primeira tela da conta).

  A correção é na suíte: a varredura cobra o DESTINO REGISTRADO, pela mesma função que o proxy usa, e espera a tela
  assentar. Nenhuma tela saiu da varredura e nenhuma cobrança das seis classes mudou.
  Este arquivo é o do passo 2 (/dashboard/conta); o passo 3 (/dashboard/conta/avaliacoes) tem o seu.

  Roda: node --test tests/laboratorio/e744-rotas-da-conta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { caminhoEsperado } from "../e2e/fixtures/destino-da-conta.ts";

test("E744: o caminho esperado segue as decisões registradas da Conta (E492/E552, E679), pela função do proxy", () => {
  assert.equal(caminhoEsperado("/dashboard/conta", 1280), "/dashboard/conta/perfil", "computador: a Conta abre o Perfil");
  assert.equal(caminhoEsperado("/dashboard/conta", 1024), "/dashboard/conta/perfil", "1024 px já é computador");
  assert.equal(caminhoEsperado("/dashboard/conta", 390), "/dashboard/conta", "celular: o menu da Conta");
  assert.equal(caminhoEsperado("/dashboard/conta/avaliacoes", 390), "/dashboard/avaliacoes");
  assert.equal(caminhoEsperado("/dashboard/conta/avaliacoes?aba=recentes", 1280), "/dashboard/avaliacoes");
});

test("E744: fora dessas duas rotas o caminho esperado é o próprio endereço, sem busca nem âncora", () => {
  for (const largura of [390, 1280]) {
    assert.equal(caminhoEsperado("/dashboard/conta/perfil", largura), "/dashboard/conta/perfil");
    assert.equal(caminhoEsperado("/dashboard/conta/seguranca", largura), "/dashboard/conta/seguranca");
    assert.equal(caminhoEsperado("/dashboard/avaliacoes?aba=feitas", largura), "/dashboard/avaliacoes");
    assert.equal(caminhoEsperado("/buscar?cidade=uberlandia#mapa", largura), "/buscar");
    assert.equal(caminhoEsperado("/", largura), "/");
  }
});

const PASTA = "tests/e2e/specs";

/*
  Passo 2: as varreduras que abrem /dashboard/conta (E492/E552). As de /dashboard/conta/avaliacoes (E679) ficam no passo 3,
  em PR próprio: as 17 juntas levam 25 min no portão, que tem 25 min para o passo inteiro.
  Vermelhas na rodada completa de 15/11 (main c950ec82): t352, t353, t354, t661, t694, t1402, t1448, t279 e t1423.
  A t607 tem a mesma cobrança e passava só pela ordem das telas (o cookie da largura ainda não existia).
*/
const VARREDURAS_DA_CONTA = ["t279", "t352", "t353", "t354", "t607", "t661", "t694", "t1402", "t1423", "t1448"];

test("E744 passo 2: as varreduras de /dashboard/conta cobram o destino registrado e esperam a tela assentar", () => {
  const specs = readdirSync(PASTA).filter((f) => f.endsWith(".spec.ts"));
  for (const n of VARREDURAS_DA_CONTA) {
    const arquivo = specs.find((f) => f.startsWith(`${n}-`));
    assert.ok(arquivo, `${n} existe`);
    const t = readFileSync(`${PASTA}/${arquivo}`, "utf8");
    assert.match(t, /["`]\/dashboard\/conta["`]|`\/dashboard\/conta\$\{/, `${n} abre /dashboard/conta`);
    const linha = t.split("\n").find((l) => /caiu fora da tela/.test(l)) ?? "";
    assert.match(linha, /expect\s*\.poll\(/, `${n} espera a tela assentar`);
    assert.match(linha, /caminhoEsperado\(/, `${n} cobra o destino registrado`);
    // A cobrança continua existindo: o endereço final é comparado, não ignorado.
    assert.match(linha, /\.toBe\(caminhoEsperado\((rota|t\.rota), tam\.width\)\)/, `${n} compara o endereço final`);
  }
});
