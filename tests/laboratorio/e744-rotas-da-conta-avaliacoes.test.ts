/*
  E744, passo 3 (15/11/2026) — regressão das varreduras em /dashboard/conta/avaliacoes (verdes em 12/11, vermelhas desde 13/11).

  Causa: o E798 (12/11, 18:11 UTC) passou para o SERVIDOR (proxy) um redirecionamento que já era decisão registrada:
  E679 (E85) — as duas telas "Avaliações" viraram UMA, em /dashboard/avaliacoes; /dashboard/conta/avaliacoes só leva para lá
  (src/app/(dashboard)/dashboard/conta/avaliacoes/page.tsx, src/lib/conta/redirecionar-no-servidor.ts).
  As varreduras abriam o endereço antigo e cobravam "continuo neste endereço". Agora cobram o DESTINO REGISTRADO, pela mesma
  função que o proxy usa, e esperam a tela assentar. Nenhuma tela saiu da varredura e nenhuma cobrança das seis classes mudou.

  O passo 2 (PR à parte) faz o mesmo para /dashboard/conta (E492/E552) e traz as mesmas fixtures; os dois PRs são
  independentes e podem entrar em qualquer ordem. Quando os dois estiverem na main, o último teste deste arquivo passa a
  valer para a suíte inteira: nenhuma varredura nova pode cobrar um endereço antigo da Conta.

  Roda: node --test tests/laboratorio/e744-rotas-da-conta-avaliacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { caminhoEsperado } from "../e2e/fixtures/destino-da-conta.ts";

test("E744 passo 3: /dashboard/conta/avaliacoes leva a /dashboard/avaliacoes em qualquer largura (E679), pela função do proxy", () => {
  for (const largura of [390, 1024, 1280]) {
    assert.equal(caminhoEsperado("/dashboard/conta/avaliacoes", largura), "/dashboard/avaliacoes");
    assert.equal(caminhoEsperado("/dashboard/conta/avaliacoes?aba=positivas&q=Ana", largura), "/dashboard/avaliacoes");
    assert.equal(caminhoEsperado("/dashboard/avaliacoes?aba=feitas", largura), "/dashboard/avaliacoes");
  }
});

const PASTA = "tests/e2e/specs";
const specs = readdirSync(PASTA).filter((f) => f.endsWith(".spec.ts"));
const linhaDaCobranca = (arquivo: string) => readFileSync(`${PASTA}/${arquivo}`, "utf8").split("\n").find((l) => /caiu fora da tela/.test(l)) ?? "";
const cobraODestino = (arquivo: string) => /expect\s*\.poll\(/.test(linhaDaCobranca(arquivo)) && /\.toBe\(caminhoEsperado\((rota|t\.rota), tam\.width\)\)/.test(linhaDaCobranca(arquivo));

/* Vermelhas na rodada completa de 15/11 (main c950ec82) e desde 13/11. */
const VARREDURAS_DE_AVALIACOES = ["t385", "t392", "t679", "t838", "t1411", "t1439", "t1461"];

test("E744 passo 3: as varreduras de /dashboard/conta/avaliacoes cobram o destino registrado e esperam a tela assentar", () => {
  for (const n of VARREDURAS_DE_AVALIACOES) {
    const arquivo = specs.find((f) => f.startsWith(`${n}-`));
    assert.ok(arquivo, `${n} existe`);
    assert.ok(cobraODestino(arquivo), `${n}: espera a tela assentar e compara o endereço final com o destino registrado`);
  }
});

test("E744 passos 2 e 3 juntos: nenhuma varredura cobra um endereço antigo da Conta", () => {
  // Só vale com os dois passos na main. O passo 2 é reconhecido pelo arquivo de guarda dele.
  if (!existsSync("tests/laboratorio/e744-rotas-da-conta.test.ts")) return;
  const ROTA_ANTIGA = /["`]\/dashboard\/conta["`]|\/dashboard\/conta\/avaliacoes|`\/dashboard\/conta\$\{/;
  const semOAjuste = specs.filter((f) => {
    const t = readFileSync(`${PASTA}/${f}`, "utf8");
    return /caiu fora da tela/.test(t) && ROTA_ANTIGA.test(t) && !cobraODestino(f);
  });
  assert.deepEqual(semOAjuste, [], "varreduras que ainda cobram o endereço antigo (ou olham antes de a tela assentar)");
});
